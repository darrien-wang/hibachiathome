# -*- coding: utf-8 -*-
"""Offline self-check for desk's order set headcount rules (owner 2026-10-24)
and desk send's unread guard (2026-10-26).

  python scripts/desk/selfcheck.py

Nothing leaves this machine: the site and invoice calls go to two small fakes
(the invoice engine's calcInvoiceTotal and the site's /api/agent/price), and a
call that gets past them fails the run instead of reaching production.

  - the party-size ladder desk reads from config/pricing-rules.ts is the
    module's own export (evaluated with tsx; SKIP when npx is not there)
  - --headcount on a quick-mode order: RH-20261022-0063, 8+2 -> 11+1
  - the official_party* line follows every headcount change (--headcount,
    --guests-file, --add-adult, --remove-guest) on an order that keeps the old
    ladder, and no other line moves; an order booked after it closed
    (D-1105-01) gets none
  - the TOTAL is held against desk price, and a wrong stored discount is loud
  - desk order cancel posts one request (--dry: dryRun), needs --why, prints
    each chef's text and the $99 line; desk next prints a chef's card first and
    as a chef's; desk ack / chef-confirm on a chef's number; desk scan lists
    party page / invoice differences under G (order-flow rebuild, 2026-11-11)
  - desk send stops over a customer text the sender has not read (the three
    replies of 10-21..24, replayed on fake threads at the second they went
    out), --seen lets it through, --force does not, staff numbers and our own
    texts never stop it
"""
from __future__ import annotations

import contextlib
import copy
import datetime
import io
import json
import pathlib
import shutil
import subprocess
import sys
import tempfile

import _api
import desk


def _no_network(*args, **kwargs):
    raise RuntimeError("selfcheck: a call reached the network layer")


_api._call = _no_network

# ------------------------------------------------------------- the engines --
# Catalog numbers of the two engines, as fakes need them. The old ladder is
# desk's (checked against the TS export below); the site prices none since
# 2026-11-05 (D-1105-01), and neither does fake_price.
WEEKDAY_RATE = {"adult": 54.90, "child": 27.45}  # invoice WEEKDAY_SPECIAL: $5 / $2.45 off
EXTRA_PRICES = {**desk.APPETIZER_PRICES, **desk.SETUP_PRICES, **desk.PROTEIN_SIDE_PRICES, **desk.CLOTH_PRICES, **desk.PIECE_PRICES}
EXTRA_PROTEIN = 10.0  # invoice EXTRA_REGULAR_PROTEIN_PRICE


def r2(v: float) -> float:
    return round(v + 1e-9, 2)


def fake_invoice(d: dict) -> dict:
    """calcInvoiceTotal for what these scenarios use (regular proteins, v2)."""
    rows = d.get("guests") or []
    mode = "quick" if d.get("mode") == "detailed" and not rows else d.get("mode")
    base = upgrades = addons = 0.0
    if mode == "detailed":
        for g in rows:
            base += desk.CHILD_PRICE if g.get("isChild") else desk.ADULT_PRICE
            upgrades += max(0, len(g.get("proteins") or []) - 2) * EXTRA_PROTEIN
            addons += 5 * bool(g.get("noodles")) + 10 * bool(g.get("tablesChairs")) + 5 * bool(g.get("utensils"))
    else:
        guests = d["adultCount"] + d["childCount"]
        base = d["adultCount"] * desk.ADULT_PRICE + d["childCount"] * desk.CHILD_PRICE
        qty = sum((q.get("qty") or 0) + (q.get("childQty") or 0) for q in d.get("quickCountItems") or [] if q.get("category") == "protein")
        upgrades = max(0, qty - guests * 2) * EXTRA_PROTEIN
    extras = sum(EXTRA_PRICES[e["id"]] * e["qty"] for e in d.get("partyExtras") or [])
    subtotal = base + upgrades + addons + extras
    promos = sum(float(p["amount"]) for p in d.get("promotions") or [])
    adjusted = max(max(0.0, subtotal - promos), desk.MINIMUM_SPEND)
    tf = d.get("travelFee") or {}
    miles = tf.get("distanceMiles")
    travel = tf["manualOverride"] if tf.get("manualOverride") is not None else (r2(max(0, miles - 50)) if miles else 0.0)
    cash = r2(adjusted + travel)
    tax = r2(cash * 0.1025)
    return {"baseCost": r2(base), "proteinUpgrades": r2(upgrades), "addonsCost": r2(addons), "partyExtrasCost": r2(extras),
            "subtotal": r2(subtotal), "promotionsTotal": r2(promos), "travelFee": travel, "adjustedTotal": r2(adjusted),
            "creditCardFee": 0, "finalTotal": cash, "deposit": 0, "balanceDue": cash, "pricingTerms": "v2_by_method",
            "cashTotal": cash, "cashBalanceDue": cash, "salesTax": tax, "salesTaxRate": 0.1025, "salesTaxRateSource": "default",
            "cardProcessingFee": r2((cash + tax) * 0.03), "cardBalanceDue": r2((cash + tax) * 1.03)}


def fake_price(params: dict) -> dict:
    """/api/agent/price: calcSimpleEstimate by the date's rate, no zip."""
    adults, kids = int(params.get("adults", 0)), int(params.get("kids", 0))
    if adults + kids >= desk.party_tiers()[1]:
        return {"ok": True, "customQuote": True}
    tables, utensils = int(params.get("tables", 0)), int(params.get("utensils", 0))

    def quote(weekday: bool) -> dict:
        a_rate, k_rate = (WEEKDAY_RATE["adult"], WEEKDAY_RATE["child"]) if weekday else (desk.ADULT_PRICE, desk.CHILD_PRICE)
        food = r2(adults * a_rate + kids * k_rate)
        rentals = tables * 10 + utensils * 5
        before = r2(food + rentals)
        base = max(before, desk.MINIMUM_SPEND)
        return {"plan": "Weekday Special (Mon-Thu)" if weekday else "Standard", "foodSubtotal": food,
                **({"rentals": {"tablesChairsGuests": tables, "tablewareGuests": utensils, "amount": rentals}} if rentals else {}),
                "minimumApplied": before <= desk.MINIMUM_SPEND, "travelFee": 0, "total": r2(base)}

    date = params.get("date")
    if date:
        weekday = datetime.date.fromisoformat(date).weekday() <= 3
        return {"ok": True, "price": quote(weekday), "minimum": desk.MINIMUM_SPEND,
                "weekdaySpecial": "applies to this date" if weekday else "Monday-Thursday only"}
    return {"ok": True, "price": quote(False), "ifMondayToThursday": quote(True), "minimum": desk.MINIMUM_SPEND}


# ------------------------------------------------------------ the harness --
ORDER_NO = "RH-20300615-0001"
SATURDAY, MONDAY = "2030-06-15", "2030-06-17"
# The order row's created_at: booked while the whole ladder stood, between the
# two closings (10-14 gone, 15+ still on), and after (D-1102-01, D-1105-01).
BEFORE_1102, BEFORE_LADDER, AFTER_LADDER = "2026-10-20T18:00:00.000+00:00", "2026-11-03T18:00:00.000+00:00", "2030-01-01T00:00:00.000+00:00"


def invoice(*, mode="quick", adults=0, kids=0, guests=None, proteins=None, extras=None, promos=None, date=SATURDAY) -> dict:
    return {
        "contactInfo": {"clientName": "Self Check", "email": "selfcheck@example.com", "phone": "+15555550100", "eventDate": date,
                        "eventTime": "18:00", "eventAddress": "1 Test St, Long Beach, CA 90802", "specialNotes": ""},
        "adultCount": adults, "childCount": kids, "mode": mode, "guests": guests or [], "quickCountItems": proteins or [],
        "partyWideAddons": [], "partyExtras": extras or [], "paymentMethod": "cash", "depositAmount": 0,
        "promotions": promos or [], "customDeal": None,
        "travelFee": {"homeZipcode": "", "ratePerMile": 1, "freeRadiusMiles": 50, "distanceMiles": 20, "manualOverride": None},
        "selectedGratuityRate": None, "pricingTerms": "v2_by_method", "salesTaxRate": None,
    }


def rows(adults: int, kids: int = 0, little: int = 0, setup: bool = False) -> list[dict]:
    out = []
    for i in range(adults + kids + little):
        out.append({"id": f"g{i + 1}", "name": f"Guest {i + 1}", "isChild": i >= adults, "proteins": ["chicken", "steak"],
                    "noodles": False, "tablesChairs": setup, "utensils": setup, "foodAllergy": "", "note": "",
                    **({"isLittle": True} if i >= adults + kids else {})})
    return out


def prot(**counts) -> list[dict]:
    """chicken=(8, 2) -> the quick-mode protein item with 8 adult and 2 child servings."""
    return [{"itemId": k, "category": "protein", "qty": a, **({"childQty": c} if c else {})} for k, (a, c) in counts.items()]


PARTY = {10: desk.closed_line(), **{n: desk.party_line(n) for n in (15, 41)}}  # 10: the closed tier, on the invoices that keep it
FREE_GYOZA = {"id": "gyoza_1", "label": "FREE: Gyoza (10 pcs) x1", "amount": 15.0}
WEEKDAY_LINE = {"id": "official_weekday", "label": "Weekday Special (Mon–Thu): $5 off per adult, $2.45 per child + FREE appetizer: Gyoza",
                "amount": 75.0}  # 12 adults: $15 gyoza + 12 x $5
LITTLE_LINE = {"id": "under5_auto", "label": "Little kids (3-4) @ $0 ×1", "amount": 29.9}


class Run:
    """One `desk order set` (or `op`) against the fakes: its output, exit and what it would have saved.
    `reply` is added to save-invoice's answer; `lint` is the order lint the site answers (D-1017-02);
    `created_at` is the order row's (None: the search has no time, as an order booked after the ladder closed reads)."""

    def __init__(self, prefill: dict, *args: str, op: str = "set", reply: dict | None = None, lint: dict | None = None,
                 created_at: str | None = None):
        self.prefill, self.saved, self.priced = prefill, None, []
        self.reply, self.lint, self.texted = reply or {}, lint, None
        self.created_at = created_at
        desk._search = self.search
        desk.invoice_post = self.invoice_post
        desk.site_get = self.site_get
        desk.site_post = self.site_post
        buf = io.StringIO()
        self.exit = None
        with contextlib.redirect_stdout(buf):
            try:
                desk.main(["order", op, ORDER_NO, *args])
            except SystemExit as e:
                self.exit = e.code
        self.out = buf.getvalue()

    def search(self, text):
        row = {"order_no": ORDER_NO, "id": "00000000-0000-4000-8000-000000000001", **({"created_at": self.created_at} if self.created_at else {})}
        return [{"name": "Self Check", "email": "selfcheck@example.com", "phone": "+15555550100", "orders": [row]}]

    def invoice_post(self, path, payload, timeout=120):
        if path == "/api/self-service/orders/lookup":
            return {"found": True, "order": {"orderNo": ORDER_NO, "updatedAt": "2030-01-01T00:00:00Z", "version": "v-selfcheck"},
                    "prefill": copy.deepcopy(self.prefill)}
        if path == "/api/invoice":
            # remind sends the card bill only off an address-rated invoice
            return {"invoice": {**fake_invoice(payload), **({"salesTaxRateSource": "address"} if self.lint is not None else {})}}
        if path == "/api/invoice/email" and self.lint is not None:
            return {"email": "guest@example.com", "pdfAttached": True, "invoiceUrl": "https://party.example/api/invoice/pdf?token=selfcheck"}
        if path == "/api/self-service/orders/save-invoice":
            self.saved = payload
            return {"orderNo": ORDER_NO, "plannerSynced": False, **self.reply}
        raise RuntimeError(f"selfcheck: unexpected invoice call {path}")

    def site_get(self, path, params=None, admin=True, timeout=90):
        if path == "/api/agent/price":
            self.priced.append(dict(params or {}))
            return fake_price(params or {})
        if path == "/api/admin/orders/lint" and self.lint is not None:
            return self.lint
        if path == "/api/admin/orders" and self.lint is not None:
            return {"order": {"customer_phone": "+15555550100", "source_metadata": {}}}
        raise RuntimeError(f"selfcheck: unexpected site read {path}")

    def site_post(self, path, payload, method="POST", timeout=90):
        if path == "/api/admin/short-link" and self.lint is not None:
            return {"shortUrl": "https://www.realhibachi.com/d/selfcheck"}
        if path == "/api/admin/sms-thread" and self.lint is not None:
            self.texted = payload
            return {"sid": "SMselfcheck"}
        raise RuntimeError(f"selfcheck: a site write ({path}) - order set must not write to the site")

    @property
    def data(self) -> dict:
        return (self.saved or {}).get("invoiceData") or {}

    def has(self, *parts: str) -> bool:
        return all(p in self.out for p in parts)


FAILS: list[str] = []


def check(name: str, ok: bool, run: Run | None = None, detail: str = "") -> None:
    print(("PASS  " if ok else "FAIL  ") + name)
    if not ok:
        FAILS.append(name)
        if detail:
            print("      " + detail)
        if run is not None:
            print("      ---- desk said ----\n" + "\n".join("      | " + line for line in run.out.rstrip().splitlines()))
            if run.exit not in (None, 0):
                print(f"      | exit: {run.exit}")


def tiers_match_the_ts_export() -> None:
    npx = shutil.which("npx")
    if not npx:
        print("SKIP  tiers vs the TS export: no npx on PATH")
        return
    root = desk.ROOT
    with tempfile.TemporaryDirectory() as tmp:
        script = pathlib.Path(tmp) / "tiers.ts"
        script.write_text(f"import {{ CLOSED_PARTY_LADDER as t, PARTY_SIZE_CUSTOM_FROM as c, KID_TIER_WEIGHT as w, PARTY_LADDER_CLOSED_AT as at }} "
                          f"from '{(root / 'config' / 'pricing-rules').as_posix()}'\n"
                          "console.log(JSON.stringify({ t, c, w, at: Date.parse(at) }))\n", encoding="utf-8")
        try:
            res = subprocess.run([npx, "-y", "tsx", "--tsconfig", str(root / "tsconfig.json"), str(script)],
                                 cwd=root, capture_output=True, text=True, timeout=180)
        except (OSError, subprocess.TimeoutExpired) as why:
            print(f"SKIP  tiers vs the TS export: tsx did not run ({why})")
            return
    if res.returncode != 0:
        print(f"SKIP  tiers vs the TS export: tsx exit {res.returncode}: {res.stderr.strip()[:200]}")
        return
    ts = json.loads(res.stdout.strip().splitlines()[-1])
    tiers, custom, weight = desk.party_tiers()
    mine = [{"minGuests": t["min"], "maxGuests": t["max"], "amount": t["amount"]} for t in tiers]
    check("tiers: desk's read of config/pricing-rules.ts equals the TS export", (mine, custom, weight) == (ts["t"], ts["c"], ts["w"]),
          detail=f"desk {(mine, custom, weight)} / TS {(ts['t'], ts['c'], ts['w'])}")
    check("tiers: desk reads the moment the ladder closed as the TS does", desk.ladder_closed_at().timestamp() * 1000 == ts["at"],
          detail=f"desk {desk.ladder_closed_at().isoformat()} / TS {ts['at']}")


# ----------------------------------------------- desk send: unread texts --
# The three replies that went out over a text nobody had read (desk.py, unread
# guard), on 555 numbers, replayed at the second each reply went out.
PROM_PHONE, JT_PHONE, CHEF_PHONE = "+16195550142", "+13035550176", "+16265550188"
LEAD_ID = "00000000-0000-4000-8000-000000000042"
REPLY = "Congrats to your son - prom is a big one! Is it a dinner before they head out, or an after-party?"


def wall(text: str) -> datetime.datetime:
    """'2026-10-24 18:54:18' on the Pacific clock, as UTC."""
    return datetime.datetime.fromisoformat(text).replace(tzinfo=desk.PACIFIC).astimezone(datetime.timezone.utc)


def sms(phone: str, direction: str, when: str, body: str) -> dict:
    """One message as GET /api/admin/sms-thread hands it over (`when` on the Pacific clock)."""
    return {"sid": f"SM{direction[:2]}{when}", "direction": direction, "body": body, "at": wall(when).strftime("%Y-%m-%dT%H:%M:%S.000Z"),
            "status": "received" if direction == "inbound" else "delivered", "media": 0, "peer": phone}


# The prom lead, 10-24: their second text landed at 18:54:18, our "before they head out, or an after-party?" at 18:54:23.
PROM = [
    sms(PROM_PHONE, "outbound", "2026-10-24 18:49:31", "Real Hibachi: your San Diego hibachi price is $1,770.00 for 30 adults (Standard (any day), Sat, May 15, 2027)."),
    sms(PROM_PHONE, "outbound", "2026-10-24 18:52:01", "Hi! Rowling from Real Hibachi 👋 Sat, May 15 is open on our end for your 30 in San Diego — what's the celebration?"),
    sms(PROM_PHONE, "inbound", "2026-10-24 18:53:36", "Just getting quotes. Its my son's prom. "),
    sms(PROM_PHONE, "inbound", "2026-10-24 18:54:18", "Its a small private school that doesn't do a prom. So we are looking to do one"),
]
PROM_LATER = PROM + [
    sms(PROM_PHONE, "outbound", "2026-10-24 18:54:23", REPLY),
    sms(PROM_PHONE, "inbound", "2026-10-24 18:55:32", "A dinner before hand "),
    sms(PROM_PHONE, "inbound", "2026-10-24 18:56:44", "4 or 5? What is the total time to cook  approximately? Take down time? Set up time? "),
    sms(PROM_PHONE, "outbound", "2026-10-24 18:57:32", "Either works! Dinner and the show run about an hour and a half."),
]
# JT Possehl, 10-21: our answer about tables went 3 s after "When do you need the menu buy?".
JT_TABLES = [
    sms(JT_PHONE, "outbound", "2026-10-21 18:43:01", "Hi! Rowling from Real Hibachi 👋 Fri, Oct 23 is open on our end for your 9 in Palm Springs — what's the celebration?"),
    sms(JT_PHONE, "inbound", "2026-10-21 20:05:30", "Hey!   We are in town to celebrate our buddy getting married.   I don't think our Airbnb will have enough seating."),
    sms(JT_PHONE, "inbound", "2026-10-21 20:06:18", "We'll probably need tables and chairs too. "),
    sms(JT_PHONE, "inbound", "2026-10-21 20:06:30", "When do you need the menu buy? "),
]
# JT Possehl, 10-23: "I just emailed the complete bill" went at 20:01:53, after "We want to pay with card" and "I apologize".
JT_BILL = [
    sms(JT_PHONE, "outbound", "2026-10-23 13:05:08", "Quick update for tonight: your chef will be John instead of Jason."),
    sms(JT_PHONE, "inbound", "2026-10-23 13:08:10", "Loved “Quick update for tonight: your chef will be John instead of Jason.”"),
    sms(JT_PHONE, "inbound", "2026-10-23 19:59:57", "Hey man, John did amazing."),
    sms(JT_PHONE, "inbound", "2026-10-23 20:00:12", "Please forward me the complete bill "),
    sms(JT_PHONE, "inbound", "2026-10-23 20:00:55", "We want to pay with card bc we are all lazy "),
    sms(JT_PHONE, "inbound", "2026-10-23 20:01:03", "I apologize "),
]


class SendRun:
    """One `desk send` (or `desk thread`) against a fake thread, at the second `at` on the Pacific clock: its output,
    exit, what it posted (None = nothing sent), what it read, and the pictures it uploaded."""

    def __init__(self, thread: list[dict], *args: str, at: str, phone: str = PROM_PHONE, staff: tuple[str, ...] = (), cmd: str = "send",
                 body: str = REPLY, log: list[dict] | None = None):
        if log is not None:  # what this machine logged before the run (voice log); None keeps what earlier runs left
            desk.VOICE_LOG.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in log), encoding="utf-8")
        self.thread, self.staff = thread, staff
        self.posted, self.reads, self.uploads = None, [], []
        desk.site_get, desk.site_post, desk._now = self.site_get, self.site_post, lambda: wall(at)
        _api.upload_sales_media = lambda local, dest, content_type="image/jpeg": self.uploads.append(dest) or dest
        _api.signed_sales_media_url = lambda dest, ttl_seconds=3600: f"https://media.example/{dest}"
        buf = io.StringIO()
        self.exit = None
        with contextlib.redirect_stdout(buf):
            try:
                desk.main([cmd, phone, *(["--body", body] if cmd == "send" else []), *args])
            except SystemExit as e:
                self.exit = e.code
        self.out = buf.getvalue()

    def site_get(self, path, params=None, admin=True, timeout=90):
        self.reads.append(path)
        if path == "/api/admin/sms-thread" and list(params or {}) == ["phone"]:
            return {"ok": True, "phones": [params["phone"]], "messages": copy.deepcopy(self.thread)}
        if path == "/api/admin/chefs":
            return {"ok": True, "chefs": [{"name": "Staff", "phone": p, "status": "active"} for p in self.staff]}
        raise RuntimeError(f"selfcheck: unexpected site read {path} {params}")

    def site_post(self, path, payload, method="POST", timeout=90):
        if path == "/api/admin/sms-thread":
            self.posted = payload
            return {"ok": True, "sid": "SMselfcheck", "status": "queued"}
        raise RuntimeError(f"selfcheck: unexpected site write {path}")

    @property
    def stopped(self) -> bool:
        """Refused with nothing sent: exit 2, no post, no upload, said why."""
        return self.exit == 2 and self.posted is None and not self.uploads and "UNREAD" in self.out

    @property
    def sent(self) -> bool:
        return self.exit is None and self.posted is not None and "OK    " in self.out

    @property
    def voiced(self) -> bool:
        """Refused by the voice check: exit 2, no post, said which rule."""
        return self.exit == 2 and self.posted is None and "VOICE" in self.out and "UNREAD" not in self.out

    @property
    def noted(self) -> bool:
        """Sent, with voice notes printed and nothing that stops."""
        return self.sent and "VOICE 提醒（照发）" in self.out and "✗" not in self.out

    def has(self, *parts: str) -> bool:
        return all(p in self.out for p in parts)


def voice_rec(event: str, phone: str, body: str, when: str, hits: list | None = None) -> dict:
    """One line of desk's voice log, as `desk send` writes it (`when` on the Pacific clock)."""
    return {"t": wall(when).isoformat(timespec="seconds"), "event": event, "phone": phone, "body": body,
            "hits": hits or [], "voice_ok": False, "session": "selfcheck"}


def quoted_price_checks() -> None:
    """desk price prints the old price a lead from before a tier closed was quoted, and
    desk link deposit --lead puts that price on the link (D-1102-01, D-1105-01)."""
    kept = desk.site_get, desk.site_post
    posted: list[dict] = []

    def run(argv: list[str], lead_created: str | None = None) -> tuple[str, object, str]:
        def site_get(path, params=None, admin=True, timeout=90):
            if path == "/api/agent/price":
                return fake_price(params or {})
            if path == "/api/admin/desk":
                return {"cards": [{"lead": {"id": LEAD_ID, "created_at": lead_created}}] if lead_created else []}
            raise RuntimeError(f"selfcheck: unexpected site read {path}")

        def site_post(path, payload, method="POST", timeout=90):
            if path == "/api/admin/short-link":
                posted.append(payload)
                return {"shortUrl": "https://www.realhibachi.com/d/selfcheck"}
            if path == "/api/admin/custom-deal":
                return {"ok": True, "query": "deal=selfcheck", "deal": {k: v for k, v in payload.items() if k not in ("leadId", "note")}}
            raise RuntimeError(f"selfcheck: unexpected site write {path}")

        desk.site_get, desk.site_post = site_get, site_post
        posted.clear()
        buf, exit_ = io.StringIO(), None
        with contextlib.redirect_stdout(buf):
            try:
                desk.main(argv)
            except SystemExit as e:
                exit_ = e.code
        url = posted[-1]["url"] if posted else ""
        return buf.getvalue(), exit_, url

    try:
        out, _, _ = run(["price", "--adults", "20", "--date", SATURDAY])
        check("desk price 20 adults: the new price, then the old one for leads from before the ladder closed",
              "→ $1,198.00" in out and "前来的线索已报过含 $60 人数折扣的价，照旧报 $1,138.00（D-1105-01）" in out and "11/02" not in out,
              detail=out)
        out, _, _ = run(["price", "--adults", "12", "--date", SATURDAY])
        check("  12 adults: only the 11/02 line (10-14 closed first)",
              "→ $718.80" in out and "照旧报 $688.80（D-1102-01）" in out and "D-1105-01" not in out, detail=out)
        link = ["link", "deposit", "--lead", LEAD_ID, "--city", "Irvine", "--date", SATURDAY]
        out, _, url = run([*link, "--adults", "20"], BEFORE_LADDER)
        check("desk link deposit --lead for a lead from before the ladder closed: the link carries $1,138",
              "estimate_low=1138" in url and "链接照旧报 $1,138（含 $60 人数折扣，D-1105-01）" in out, detail=out + url)
        out, _, url = run([*link, "--adults", "20"], AFTER_LADDER)
        check("  a lead from after: $1,198, no old price", "estimate_low=1198" in url and "照旧" not in out, detail=out + url)
        out, _, url = run([*link, "--adults", "12"], BEFORE_1102)
        check("  12 adults on a lead from before 11/02: $689 with the $30 (D-1102-01)",
              "estimate_low=689" in url and "链接照旧报 $689（含 $30 人数折扣，D-1102-01）" in out, detail=out + url)
        out, _, url = run([*link, "--adults", "12"], BEFORE_LADDER)
        check("  12 adults on a lead from between the closings: $719, nothing old to give", "estimate_low=719" in url and "照旧" not in out,
              detail=out + url)
        out, _, url = run([*link, "--adults", "20", "--flat-off", "60"], BEFORE_LADDER)
        check("  --flat-off on an old lead says the lock already brings the old tier", "--flat-off 会叠在上面" in out, detail=out + url)
    finally:
        desk.site_get, desk.site_post = kept


def send_checks() -> None:
    kept = desk.site_get, desk.site_post, desk._now, _api.upload_sales_media, _api.signed_sales_media_url, desk.VOICE_LOG
    with tempfile.TemporaryDirectory() as tmp:
        desk.VOICE_LOG = pathlib.Path(tmp) / "desk-voice.jsonl"  # never the real log in ~/.realhibachi
        try:
            _send_checks()
        finally:
            desk.site_get, desk.site_post, desk._now, _api.upload_sales_media, _api.signed_sales_media_url, desk.VOICE_LOG = kept


def _send_checks() -> None:
    reply_at = "2026-10-24 18:54:23"
    r = SendRun(PROM, at=reply_at)
    check("send: the prom reply 5 s after the customer's second text, no --seen: stopped (exit 2, nothing sent), both fresh texts and the exact --seen printed",
          r.stopped and r.has("5 秒前刚发来", "18:53:36  Just getting quotes", "18:54:18  Its a small private school that doesn't do a prom",
                              "--seen 2026-10-24T18:54:18-07:00"), r)
    r = SendRun(PROM, "--seen", "18:53", at=reply_at)
    check("  --seen 18:53 (their first text, the one we answered): stopped, only the text after it printed",
          r.stopped and r.has("之后又发了 1 条", "doesn't do a prom") and "son's prom" not in r.out and "第一条算" not in r.out, r)
    r = SendRun(PROM, "--seen", "2026-10-24T18:53:36-07:00", at=reply_at)
    check("  --seen to the second of their first text: stopped", r.stopped and r.has("doesn't do a prom"), r)
    r = SendRun(PROM, "--force", at=reply_at)
    check("  --force alone does not skip it: stopped, and says so", r.stopped and r.has("doesn't do a prom", "--force 只放行服务器的刹车"), r)
    r = SendRun(PROM, "--seen", "18:54", at=reply_at)
    check("  --seen 18:54 (HH:MM of a text 5 s old - the clock reads the same): stopped, asks for the seconds",
          r.stopped and r.has("只到分钟", "--seen 2026-10-24T18:54:18-07:00"), r)
    r = SendRun(PROM, "--seen", "2026-10-24T18:54:18-07:00", "--lead", LEAD_ID, at=reply_at)
    p = r.posted or {}
    check("  --seen to the second of their last text: sent, the payload as before (phone, body, lead, no force), staff list never read",
          r.sent and p.get("phone") == PROM_PHONE and p.get("body") == REPLY and p.get("leadId") == LEAD_ID and "force" not in p
          and r.reads == ["/api/admin/sms-thread"], r)
    r = SendRun(PROM, "--force", "--seen", "2026-10-25T01:54:18Z", at=reply_at)
    check("  --force with --seen (the API's UTC form): sent, force still passed on to the server's brakes", r.sent and (r.posted or {}).get("force") is True, r)
    r = SendRun(PROM, "--media", "patio.jpg", at=reply_at)
    check("  a picture is stopped the same way, before anything is uploaded", r.stopped, r)
    r = SendRun(PROM, "--media", "patio.jpg", "--seen", "10-24 18:54:18", at=reply_at)
    check("  ... and goes with --seen (MM-DD HH:MM:SS): uploaded and sent with its link",
          r.exit is None and len(r.uploads) == 1 and str((r.posted or {}).get("mediaUrl", "")).startswith("https://media.example/sent/"), r)
    r = SendRun(PROM, "--seen", "6pm", at=reply_at)
    check("  a --seen desk cannot read is refused before anything is read or sent", "--seen '6pm'" in str(r.exit) and not r.reads and r.posted is None, r)

    later = "2026-10-24 18:58:30"
    r = SendRun(PROM_LATER, "--seen", "18:57", at=later)
    check("  --seen naming none of their texts (18:57 is our own reply): stopped, their last text and its --seen printed",
          r.stopped and r.has("对不上客人的任何一条短信", "18:56:44  4 or 5?", "--seen 2026-10-24T18:56:44-07:00"), r)
    r = SendRun(PROM_LATER, "--seen", "18:56", at=later)
    check("  --seen 18:56 (HH:MM of their last text, 106 s old, alone in its minute): sent", r.sent, r)
    r = SendRun(PROM_LATER, at=later)
    check("  no --seen, their last text 106 s old: sent (only the last 90 s are checked without --seen)", r.sent, r)
    ours = PROM_LATER + [sms(PROM_PHONE, "outbound", "2026-10-24 19:30:00", "Anytime!")]
    r = SendRun(ours, at="2026-10-24 19:30:20")
    check("  our own text 20 s before (any desk, the App, the machine) is not one of theirs: sent", r.sent, r)
    r = SendRun([], at="2026-10-24 18:49:00")
    check("  a number with no texts at all: sent", r.sent, r)

    r = SendRun(JT_TABLES, at="2026-10-21 20:06:33", phone=JT_PHONE)
    check("send: JT's 10-21 tables answer, 3 s after 'When do you need the menu buy?', no --seen: stopped, both fresh texts printed",
          r.stopped and r.has("20:06:18  We'll probably need tables", "20:06:30  When do you need the menu buy?"), r)
    r = SendRun(JT_TABLES, "--seen", "20:06", at="2026-10-21 20:08:00", phone=JT_PHONE)
    check("  --seen 20:06 two minutes on, two of JT's texts in that minute: stopped on the second (HH:MM names the first)",
          r.stopped and r.has("之后又发了 1 条", "按那一分钟客人的第一条算", "When do you need the menu buy?") and "need tables" not in r.out, r)
    r = SendRun(JT_TABLES, "--seen", "2026-10-21T20:06:30-07:00", at="2026-10-21 20:08:00", phone=JT_PHONE)
    check("  --seen to the second of the later one: sent", r.sent, r)
    r = SendRun(JT_BILL, "--seen", "2026-10-23T20:00:12-07:00", at="2026-10-23 20:01:53", phone=JT_PHONE)
    check("send: JT's 10-23 bill reply, read up to 'Please forward me the complete bill': stopped, the two texts after it printed",
          r.stopped and r.has("之后又发了 2 条", "20:00:55  We want to pay with card", "20:01:03  I apologize") and "forward me" not in r.out, r)
    r = SendRun(JT_BILL, at="2026-10-23 20:01:53", phone=JT_PHONE)
    check("  the same with no --seen: stopped on the 90 s rule (58 s and 50 s old)", r.stopped and r.has("pay with card", "I apologize"), r)
    r = SendRun(JT_BILL[:2], at="2026-10-23 13:08:40", phone=JT_PHONE)
    check("  a tapback is a text of theirs too (Loved … 30 s before): stopped", r.stopped and r.has("[tapback·不用回]"), r)

    chef = [sms(CHEF_PHONE, "outbound", "2026-10-24 15:00:00", "Prep sheet for Saturday is up."), sms(CHEF_PHONE, "inbound", "2026-10-24 15:00:40", "好的")]
    r = SendRun(chef, at="2026-10-24 15:01:00", phone=CHEF_PHONE, staff=("(626) 555-0188",))
    check("send: a staff number's 好的 20 s before does not stop a text to them (not a lead)", r.sent and r.has("员工号码"), r)
    r = SendRun(chef, at="2026-10-24 15:01:00", phone=CHEF_PHONE, staff=("(626) 555-0199",))
    check("  the same number when it is not on the staff list: stopped", r.stopped and r.reads == ["/api/admin/sms-thread", "/api/admin/chefs"], r)

    # Voice (leads voice.md §2, owner 2026-10-29): what reads like a bot is stopped, printed, --voice-ok sends it.
    ok_seen = ("--seen", "2026-10-24T18:54:18-07:00")
    r = SendRun(PROM, *ok_seen, at=reply_at, body="Perfect - steak and shrimp for everyone, it's on your order! 🥩🍤")
    check("voice: 'Perfect - ... ! 🥩🍤' is stopped (exit 2, nothing sent): emotion-word opener and two emoji named",
          r.voiced and r.has("情绪词开头「Perfect", "emoji 2 个"), r)
    r = SendRun(PROM, *ok_seen, at=reply_at, body="Hi Jacob! Rowling from Real Hibachi 👋 Yes, 12:00 works - your chef arrives around 11:30 - so you can start right at noon! Is Dec 5 still the plan for your 17?")
    check("  two '!', 'your 17', and 'Hi ... Rowling' 5 s after the customer spoke stop it; the two ' - ' are a note",
          r.voiced and r.has("✗ 感叹号 2 个", "✗ 「plan for your 17」", "✗ 已经报过名字、客人 24 小时内说过话", "· \" - \" 用了 2 次"), r)
    r = SendRun(PROM, *ok_seen, at=reply_at, body="Great question! Paying cash on the day, sales tax is already included (card adds a small fee). Let me know if you have any questions.")
    check("  'Great question!' and 'Let me know if you have any' stop it; the parenthesis is a note",
          r.voiced and r.has("✗ 情绪词开头「Great question", "✗ 「Let me know if you have any」", "· 括号"), r)
    r = SendRun(PROM_LATER, "--seen", "18:56", at=later, body="Either works. Dinner and the show run about an hour and a half.")
    check("  the same first two words as our last text ('Either works'): a note, sent", r.noted and r.has("和我上一条开头一样"), r)
    r = SendRun(PROM_LATER, "--seen", "18:56", at=later, body="No rush - just text me once you've picked a day.")
    check("  'No rush - ' opener: a note, sent", r.noted and r.has("「No rush -」"), r)
    greeted = PROM + [sms(PROM_PHONE, "outbound", "2026-10-24 18:54:23", "Hi, it's Rowling from Real Hibachi. Saturday works.")]
    r = SendRun(greeted, *ok_seen, at="2026-10-27 10:00:00", body="Hi, it's Rowling. Has the group landed on a weekend yet?")
    check("  two texts that both open 'Hi, it's ...' days apart: no same-opener note, sent clean", r.sent and "VOICE" not in r.out, r)
    first = [m for m in PROM if "Rowling" not in m["body"]]
    r = SendRun(first, *ok_seen, at=reply_at, body="Hi, it's Rowling from Real Hibachi. Yes, Temecula's in our area. Roughly how many people?")
    check("  the first text a person sends gives the name even though the customer wrote first: sent clean", r.sent and "VOICE" not in r.out, r)
    r = SendRun(PROM, *ok_seen, at=reply_at, body="For your 16 adults and 3 kids it's $991.10 all in.")
    check("  'your 16 adults' (a noun after the number) is ordinary English: sent clean", r.sent and "VOICE" not in r.out, r)
    quoted = [sms(PROM_PHONE, "outbound", "2026-10-24 18:49:31", "Real Hibachi: your San Diego hibachi price is $1,770.00 for 30 adults. "
                  "Lock your date here - card on file, nothing charged today: https://x.y/q")] + PROM[1:]
    r = SendRun(quoted, *ok_seen, at=reply_at, body="Here's the link to lock it. It just saves a card, nothing is charged today: https://x.y/z")
    check("  'nothing is charged today' after only the site's automatic quote said it: sent clean (the first link a person sends says it)",
          r.sent and "VOICE" not in r.out, r)
    once = PROM + [sms(PROM_PHONE, "outbound", "2026-10-24 18:54:23", "Here's the link - it just saves a card, nothing is charged today: https://x.y/z")]
    r = SendRun(once, "--seen", "18:54:18", at="2026-10-24 19:00:00", body="Same link works. It just saves a card, nothing is charged today.")
    check("  'nothing is charged today' said to this customer before: named", r.voiced and r.has("已经听过一次了"), r)
    r = SendRun(PROM, *ok_seen, at=reply_at, body="Sat, May 15 is open on our end for your 30 — what's the celebration?")
    check("  an em dash: named", r.voiced and r.has("长破折号"), r)
    r = SendRun(PROM, "--voice-ok", *ok_seen, at=reply_at, body="Perfect - steak and shrimp for everyone, it's on your order! 🥩🍤")
    check("  --voice-ok: sent, the hits still printed", r.sent and r.has("VOICE", "照发", "Perfect"), r)
    for body in (REPLY, "Yes, noon works. Your chef will get there around 11:30 to set up.", "Happy birthday! When's the party?",
                 "30 people is $1,707 with tax if you pay cash.", "Got it, 7:30 then.", "See you on the 17th.",
                 "Could you send me the street address when you have a minute?", "Your chef is Blu. He'll be there around 5 to set up. 🔥",
                 "Hi, it's Rowling from Real Hibachi. Saturday the 18th is open for the 15 of you in Palm Springs. What's the celebration?"):
        r = SendRun(PROM_LATER, "--seen", "2026-10-24T18:56:44-07:00", at="2026-10-26 12:00:00", body=body)
        check(f"  clean: {body[:60]!r} sent, no VOICE line", r.sent and "VOICE" not in r.out, r)
    r = SendRun(PROM, at=reply_at, body="Perfect - steak and shrimp for everyone!")
    check("  unread comes first: the prom reply with no --seen stops on UNREAD, the voice check is not reached", r.stopped and "VOICE" not in r.out, r)

    # One opening for many people, and a first sentence that does not answer (owner 2026-10-29): notes, sent anyway.
    later_seen = ("--seen", "2026-10-24T18:56:44-07:00")
    moldy = "Hi, it's Rowling - figured you're still sorting out the details. Is the 7th still the plan?"
    two_others = [voice_rec("sent", "+16195550001", "Hi, it's Rowling - figured you're still picking a date. Did a weekend win?", "2026-10-26 10:00:00"),
                  voice_rec("sent", "+16195550002", "Hi! Rowling here - figured you're still comparing calendars.", "2026-10-26 10:05:00")]
    r = SendRun(PROM_LATER, *later_seen, at="2026-10-26 12:00:00", body=moldy, log=two_others)
    check("voice: an opening this machine sent 2 other customers in 24 h ('figured you're still'): a note, sent",
          r.noted and r.has("「figured you're still …」", "2 位别的客人"), r)
    r = SendRun(PROM_LATER, *later_seen, at="2026-10-26 12:00:00", body=moldy, log=two_others[:1])
    check("  sent to 1 other customer: no note", r.sent and "VOICE" not in r.out, r)
    r = SendRun(PROM_LATER, *later_seen, at="2026-10-27 12:00:00", body=moldy, log=two_others)
    check("  the two others 26 h back: no note", r.sent and "VOICE" not in r.out, r)
    same_phone = [voice_rec("sent", PROM_PHONE, moldy, "2026-10-26 10:00:00"), voice_rec("sent", PROM_PHONE, moldy, "2026-10-26 10:05:00")]
    r = SendRun(PROM_LATER, *later_seen, at="2026-10-26 12:00:00", body=moldy, log=same_phone)
    check("  sent before to this same customer only: not 'other customers', no note", r.sent and "VOICE" not in r.out, r)

    asked = PROM_LATER + [sms(PROM_PHONE, "inbound", "2026-10-24 19:10:00", "Do you provide tables and chairs?")]
    asked_seen = ("--seen", "2026-10-24T19:10:00-07:00")
    r = SendRun(asked, *asked_seen, at="2026-10-24 19:11:00", body="5:30 works great. Tables and chairs are $10 a guest.", log=[])
    check("voice: they asked about tables, our first sentence '5:30 works great.': a note naming both, sent",
          r.noted and r.has("第一句先答他问的", "Do you provide tables and chairs?", "5:30 works great."), r)
    for body in ("Yes, tables and chairs are $10 a guest.", "We do. They're $10 a guest with linens.", "Tables and chairs are $10 a guest, linens included."):
        r = SendRun(asked, *asked_seen, at="2026-10-24 19:11:00", body=body, log=[])
        check(f"  {body[:40]!r}: answers first, clean", r.sent and "VOICE" not in r.out, r)
    thanked = PROM_LATER + [sms(PROM_PHONE, "inbound", "2026-10-24 19:10:00", "Thank you! Does that include gratuity?")]
    r = SendRun(thanked, *asked_seen, at="2026-10-24 19:11:00", body="You're welcome! Gratuity isn't included, 20-25% is customary.", log=[])
    check("  'You're welcome!' first when they asked about gratuity: a note", r.noted and r.has("第一句先答他问的", "You're welcome!"), r)
    r = SendRun(thanked, *asked_seen, at="2026-10-24 19:11:00", body="Not included. 20-25% is customary, and all of it goes to your chef.", log=[])
    check("  'Not included. ...': clean", r.sent and "VOICE" not in r.out, r)
    first_q = [PROM[0], sms(PROM_PHONE, "inbound", "2026-10-24 18:53:36", "How much for 25 guests?")]
    r = SendRun(first_q, "--seen", "2026-10-24T18:53:36-07:00", at="2026-10-24 18:54:00", log=[],
                body="Hi, it's Rowling from Real Hibachi. 25 people is $1,407.50 if you pay cash.")
    check("  a first text: the name intro, then the price for 'How much for 25 guests?': clean", r.sent and "VOICE" not in r.out, r)
    tapped = PROM_LATER + [sms(PROM_PHONE, "inbound", "2026-10-24 19:10:00", "Loved “Either works! Dinner and the show run about an hour and a half.”")]
    r = SendRun(tapped, *asked_seen, at="2026-10-24 19:11:00", body="Sounds good, see you then.", log=[])
    check("  a tapback is not a question: clean", r.sent and "VOICE" not in r.out, r)

    # The log the daily report reads: a stop, then the rewrite that went 4 min later.
    r = SendRun(PROM, *ok_seen, at=reply_at, body="Perfect - steak and shrimp for everyone! 🥩🍤", log=[])
    logged = [json.loads(x) for x in desk.VOICE_LOG.read_text(encoding="utf-8").splitlines()]
    check("voice log: a stop is a line (event stop, phone, the rule)",
          r.voiced and len(logged) == 1 and logged[0]["event"] == "stop" and logged[0]["phone"] == PROM_PHONE
          and any("情绪词开头" in h[1] for h in logged[0]["hits"]), r)
    r = SendRun(PROM, *ok_seen, at="2026-10-24 18:58:23", body="Steak and shrimp for everyone, got it.")
    logged = [json.loads(x) for x in desk.VOICE_LOG.read_text(encoding="utf-8").splitlines()]
    check("  the rewrite 4 min later: sent, a sent line after it", r.sent and [x["event"] for x in logged] == ["stop", "sent"], r)
    buf = io.StringIO()
    desk._now = lambda: wall("2026-10-24 23:00:00")
    with contextlib.redirect_stdout(buf):
        desk.main(["voice-log", "--date", "2026-10-24"])
    out = buf.getvalue()
    check("  desk voice-log: 1 sent, 1 stop, the opener rule counted, the rewrite took 4 min",
          "发出 1 条" in out and "拦下 1 次" in out and "情绪词开头" in out and "4 分钟后改好发出" in out, detail=out)

    r = SendRun(PROM, at=reply_at, cmd="thread")
    check("thread: ends with the --seen for a reply, to the second of their last text",
          r.out.rstrip().splitlines()[-1] == "   回复带 --seen 2026-10-24T18:54:18-07:00（客人最后一条 10-24 18:54:18）", r)
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        desk.render_card({"phone": PROM_PHONE, "thread": PROM_LATER})
    check("card: the same line under the conversation", "   回复带 --seen 2026-10-24T18:56:44-07:00（客人最后一条 10-24 18:56:44）" in buf.getvalue(),
          detail=buf.getvalue())
    start, end, exact = desk.parse_seen("23:58", wall("2026-10-25 00:03:00"))
    check("--seen 23:58 read at 00:03 is last night's minute", (start, end - start, exact) == (wall("2026-10-24 23:58:00"), datetime.timedelta(minutes=1), False),
          detail=f"{start} {end} {exact}")
    start, end, exact = desk.parse_seen("12-31 23:59:30", wall("2027-01-01 00:10:00"))
    check("--seen 12-31 23:59:30 early on New Year's Day is last year's, that second", (start, end - start, exact) == (wall("2026-12-31 23:59:30"), datetime.timedelta(seconds=1), True),
          detail=f"{start} {end} {exact}")


# ------------------------------------------------- order flow (2026-11-11) --
# desk order cancel, the chef cards of desk next, desk ack / chef-confirm on a
# chef's number, and the party-page / invoice lines of desk scan's bucket G
# (D-1111-03). The site is a fake that records what desk would have posted;
# what the site itself does with a cancel is tests/order-cancel.test.ts.
CANCEL_ID = "00000000-0000-4000-8000-000000000001"
CANCEL_WHY = "Customer texted 11/11: family emergency, not holding the party"
CANCEL_PARTY = "11月14日下午5:30 Irvine（Joyce）"
CANCEL_TEXT = f"{CANCEL_PARTY}那场取消了，你不用去，之前的备料单作废。"
LATE_FEE = "离派对只有 30 小时（不到 48 小时）：按政策可以收 $99 取消费，系统没有扣，收不收由老板定。"


def cancel_reply(path: str, payload: dict, **over) -> dict:
    """POST /api/admin/orders/cancel the way lib/order-cancel.ts answers it (two chefs on the party, one with no phone)."""
    dry = bool(payload.get("dryRun"))
    return {"ok": True, "dryRun": dry, "already": False, "nothingToDo": False, "orderId": payload.get("orderId"), "orderNo": ORDER_NO,
            "customerName": "Joyce Lin", "eventStart": "2030-11-14T17:30:00+00:00", "party": CANCEL_PARTY, "reason": payload.get("reason"),
            "hoursToParty": 30, "within48h": True, "lateFeeNote": LATE_FEE, "assignmentsCancelled": 2,
            "chefs": [{"staffId": "s1", "name": "Gary", "phone": CHEF_PHONE, "hadSheet": True, "linksRevoked": 1, "text": CANCEL_TEXT,
                       "texted": not dry, **({} if dry else {"sid": "SMselfcheck"})},
                      {"staffId": "s2", "name": "易非", "phone": None, "hadSheet": False, "linksRevoked": 0,
                       "text": f"{CANCEL_PARTY}那场取消了，你不用去。", "texted": False, "error": "staff_has_no_phone"}],
            "lead": {"id": LEAD_ID, "was": "won", "markedLost": True}, "warnings": [], **over}


class DeskRun:
    """One desk command against a fake site: its output, exit, what it read and every write it tried.
    `posts` answers a write (None: any write fails the run); `staff` is the staff list's numbers."""

    def __init__(self, argv: list[str], gets: dict | None = None, posts=None, staff: tuple[str, ...] = ()):
        self.gets, self.posts, self.staff = gets or {}, posts, staff
        self.posted: list[tuple[str, dict, str]] = []
        self.reads: list[str] = []
        kept = desk.site_get, desk.site_post, desk._search
        desk.site_get, desk.site_post, desk._search = self.site_get, self.site_post, self.search
        buf = io.StringIO()
        self.exit = None
        try:
            with contextlib.redirect_stdout(buf):
                try:
                    desk.main(argv)
                except SystemExit as e:
                    self.exit = e.code
        finally:
            desk.site_get, desk.site_post, desk._search = kept
        self.out = buf.getvalue()

    def search(self, text):
        return [{"name": "Joyce Lin", "email": "selfcheck@example.com", "phone": "+15555550100", "orders": [{"order_no": ORDER_NO, "id": CANCEL_ID}]}]

    def site_get(self, path, params=None, admin=True, timeout=90):
        self.reads.append(path)
        if path == "/api/admin/chefs":
            return {"ok": True, "chefs": [{"name": "Staff", "phone": p, "status": "active"} for p in self.staff]}
        if path in self.gets:
            return copy.deepcopy(self.gets[path])
        raise RuntimeError(f"selfcheck: unexpected site read {path} {params}")

    def site_post(self, path, payload, method="POST", timeout=90):
        self.posted.append((path, payload, method))
        if self.posts is None:
            raise RuntimeError(f"selfcheck: unexpected site write {path}")
        return self.posts(path, payload)

    def has(self, *parts: str) -> bool:
        return all(p in self.out for p in parts)


def order_flow_checks() -> None:
    cancel = ["order", "cancel", ORDER_NO]
    r = DeskRun([*cancel, "--why", CANCEL_WHY, "--dry"], posts=cancel_reply)
    check("order cancel --dry: one request, dryRun true, the order's id and the reason - and it is the only thing desk sends",
          r.exit is None and r.posted == [("/api/admin/orders/cancel", {"orderId": CANCEL_ID, "reason": CANCEL_WHY, "dryRun": True, "source": "desk"}, "POST")], r)
    check("  prints the plan: DRY, the three order columns, each chef's text word for word, the chef with no number, the lead",
          r.has(f"DRY   {ORDER_NO} · {CANCEL_PARTY} → 取消（空跑：什么都没写、没发）", f"原因: {CANCEL_WHY}",
                "order_status=cancelled · date_lock_status=not_locked · calendar_status=not_synced",
                f"师傅: Gary {CHEF_PHONE} 会收到", f"「{CANCEL_TEXT}」", "师傅: 易非 (没存手机号) 发不了（没存手机号）→ 自己告诉他",
                "派工: 会撤 2 条，备料单链接作废", f"线索: {LEAD_ID} won → lost"), r)
    check("  says nothing goes to the customer and no money moves; inside 48 h the $99 line is the owner's to decide",
          r.has("客人: 没有给客人发任何消息；没有扣款、没有退款", f"⚠ {LATE_FEE}"), r)
    r = DeskRun([*cancel, "--why", CANCEL_WHY], posts=cancel_reply)
    check("order cancel for real: dryRun false, OK, the sent text with its sid, the chef nobody could text, the $99 line again",
          r.exit is None and len(r.posted) == 1 and r.posted[0][1]["dryRun"] is False
          and r.has(f"OK    {ORDER_NO} · {CANCEL_PARTY} 已取消", f"师傅: Gary {CHEF_PHONE} 已发 SMselfcheck", f"「{CANCEL_TEXT}」",
                    "师傅: 易非 (没存手机号) 没通知到（没存手机号）→ 自己告诉他", "派工: 已撤 2 条", "→ lost，原因已记", f"⚠ {LATE_FEE}"), r)
    r = DeskRun(cancel, posts=cancel_reply)
    check("order cancel without --why: refused before anything is sent", "needs --why" in str(r.exit) and r.posted == [], r)
    r = DeskRun([*cancel, "--why", " ", "--dry"], posts=cancel_reply)
    check("  a blank --why is no reason either", "needs --why" in str(r.exit) and r.posted == [], r)
    r = DeskRun([*cancel, "--why", CANCEL_WHY],
                posts=lambda p, b: cancel_reply(p, b, already=True, nothingToDo=True, chefs=[], assignmentsCancelled=0, lateFeeNote=None))
    check("  already cancelled with nobody left to tell: one line saying so", r.has(f"--    {ORDER_NO}", "已经取消过了") and "OK " not in r.out, r)
    kept_lead = {"id": LEAD_ID, "was": "won", "markedLost": False, "kept": "客人还有一场没办的派对（RH-20300701-0002），线索不标流失"}
    r = DeskRun([*cancel, "--why", CANCEL_WHY, "--dry"],
                posts=lambda p, b: cancel_reply(p, b, hoursToParty=96, within48h=False, lateFeeNote=None, lead=kept_lead,
                                                warnings=["这单已经收过 $19.90，系统不会自动退，退不退由老板定。"]))
    check("  four days out: no $99 line; money already taken and a lead that stays are both said",
          "$99" not in r.out and r.has("⚠ 这单已经收过 $19.90", f"线索: {LEAD_ID} 不动 - 客人还有一场没办的派对"), r)

    def refused(path, body):
        raise _api.ApiError(403, {"ok": False, "error": "只有老板能取消订单"})

    r = DeskRun([*cancel, "--why", CANCEL_WHY], posts=refused)
    check("  refused by the site (not the owner's key): one readable line, no traceback", "HTTP 403" in str(r.exit) and "只有老板能取消订单" in str(r.exit), r)

    # desk next: a chef's card comes first and reads as a chef's, a customer's card is as it was.
    chef_card = {
        "key": f"phone:{CHEF_PHONE}", "kinds": ["chef", "chef_notice"], "waitedMinutes": 20, "urgent": True, "justArrived": False, "lead": None,
        "phone": CHEF_PHONE,
        "staff": {"id": "s1", "name": "Gary", "role": "chef", "parties": [
            {"orderId": CANCEL_ID, "orderNo": ORDER_NO, "eventStart": "2030-11-14T17:30:00+00:00", "city": "Irvine", "customer": "Joyce", "guests": 18,
             "role": "chef", "sheet": "opened"}]},
        "alerts": [{"kind": "chef_notice", "title": "师傅没确认改动 · Gary", "body": f"{CANCEL_PARTY} · 8 位加餐具 · 发出 2 小时没回 1"}],
        "thread": [sms(CHEF_PHONE, "outbound", "2026-11-12 10:00:00", "11月14日 Irvine 那场改了：8 位加餐具。回 1 确认"),
                   sms(CHEF_PHONE, "inbound", "2026-11-12 12:05:00", "备料单打不开，再发一次")],
        "orders": [], "stats": {}}
    change = "RH-20300615-0001 · 48 小时内提交，确认后才写进订单 · Guest Count: 8 adults + 2 kids → 10 adults + 2 kids"
    customer_card = {
        "key": f"lead:{LEAD_ID}", "kinds": ["sms", "order_change"], "waitedMinutes": 45, "urgent": True, "phone": PROM_PHONE, "staff": None,
        "lead": {"id": LEAD_ID, "full_name": "Joyce Lin", "phone": PROM_PHONE, "status": "won", "guest_count": 18},
        "alerts": [{"kind": "order_change", "title": "改单等确认 · Joyce Lin", "body": change}],
        "thread": [sms(PROM_PHONE, "inbound", "2026-11-12 11:40:00", "Do you bring the propane?")], "orders": [],
        "stats": {"lastSpeaker": "customer", "lastAt": "2026-11-12T19:40:00.000Z"}}
    inbox = {"ok": True, "serverTime": "2026-11-12T20:25:00.000Z", "cards": [chef_card, customer_card],
             "counts": {"chefTexts": 1, "chefNotices": 1, "unreplied": 1, "changedOrders": 1, "heldChanges": 1}}
    r = DeskRun(["next"], gets={"/api/admin/desk": inbox})
    head = r.out.split("\n", 1)[0]
    check("desk next: the counts open with the chefs' two, and say how many changes wait inside 48 h",
          "师傅 1 · 师傅没确认改动 1 · 未回 1" in head and "订单变动 1（48h 内等确认 1）" in head, r)
    chef_part, _, customer_part = r.out.partition("Joyce Lin ·")
    check("  the chef's card is printed first, as a chef's: name, his party and its sheet, what is open, the thread as 师 / 我",
          "师傅 Gary" in chef_part and f"师傅 Gary · {CHEF_PHONE}   [chef chef_notice] 等了 20 分钟 ⚠️" in chef_part
          and f"派对 {ORDER_NO}  2030-11-14 17:30  Irvine · Joyce · 18 人 · 备料单已打开" in chef_part
          and f"⚑ 师傅没确认改动 · Gary — {CANCEL_PARTY} · 8 位加餐具 · 发出 2 小时没回 1" in chef_part
          and "师 11-12 12:05  备料单打不开，再发一次" in chef_part and "我 11-12 10:00" in chef_part, r)
    check("  it says how to answer, how to close it without a text and how to mark the change confirmed - no brake line, no --seen to copy",
          f"desk send {CHEF_PHONE}" in chef_part and f"desk ack {CHEF_PHONE}" in chef_part and f"desk chef-confirm {CHEF_PHONE}" in chef_part
          and "刹车: " not in chef_part and "回复带 --seen" not in chef_part, r)
    check("  the customer's card after it, with the open change and what changed on it, its brake line as before",
          f"⚑ 改单等确认 · Joyce Lin — {change}" in customer_part and "客 11-12 11:40  Do you bring the propane?" in customer_part
          and "刹车: 客人最后说话 → 回复不受刹车限制" in customer_part, r)
    r = DeskRun(["next"], gets={"/api/admin/desk": {**inbox, "cards": [{**chef_card, "kinds": ["chef"], "alerts": []}]}})
    check("  a plain chef text (no change waiting) does not offer chef-confirm", "desk chef-confirm" not in r.out and f"desk ack {CHEF_PHONE}" in r.out, r)

    # desk ack / chef-confirm on a chef's number.
    r = DeskRun(["ack", CHEF_PHONE], posts=lambda p, b: {"ok": True, "ackedUntil": "2026-11-12T20:30:00.000Z"}, staff=(CHEF_PHONE,))
    check("desk ack <chef phone>: checked against the staff list, then ack_text for that number",
          r.exit is None and r.reads == ["/api/admin/chefs"] and r.posted == [("/api/admin/chefs", {"action": "ack_text", "phone": CHEF_PHONE}, "POST")]
          and r.has("OK    标了「不用回」"), r)
    r = DeskRun(["ack", "626-555-0188", "--clear"], posts=lambda p, b: {"ok": True, "cleared": True}, staff=(CHEF_PHONE,))
    check("  --clear takes it back", r.posted == [("/api/admin/chefs", {"action": "ack_text", "phone": CHEF_PHONE, "clear": True}, "POST")] and r.has("撤销了"), r)
    r = DeskRun(["ack", PROM_PHONE], posts=lambda p, b: {"ok": True}, staff=(CHEF_PHONE,))
    check("  a number that is not staff is refused: a customer's 不用回 goes by lead id", "不在员工名单里" in str(r.exit) and r.posted == [], r)
    r = DeskRun(["ack", LEAD_ID], posts=lambda p, b: {"ok": True})
    check("  a lead id still marks the lead, exactly as before",
          r.posted == [("/api/admin/leads", {"action": "ack_replies", "leadId": LEAD_ID, "clear": False}, "PATCH")] and r.reads == [], r)
    r = DeskRun(["chef-confirm", CHEF_PHONE], posts=lambda p, b: {"ok": True, "acked": 2, "orderIds": [CANCEL_ID]})
    check("desk chef-confirm <phone>: confirm_notice for that number, and how many it marked",
          r.posted == [("/api/admin/chefs", {"action": "confirm_notice", "phone": CHEF_PHONE}, "POST")] and r.has("2 条改动通知标成已确认"), r)
    r = DeskRun(["chef-confirm", CHEF_PHONE, "--order", ORDER_NO], posts=lambda p, b: {"ok": True, "acked": 0})
    check("  --order narrows it to that party; nothing open is said plainly, not an error",
          r.exit is None and r.posted[0][1] == {"action": "confirm_notice", "phone": CHEF_PHONE, "order_id": CANCEL_ID} and r.has("没有待确认的改动通知"), r)

    # desk scan, bucket G: the party page and the invoice disagree.
    diffs = ["派对页 12 位已选菜，发票菜单是空的", "8 位加餐具"]
    scan = {"ok": True, "serverTime": "2026-11-12T20:25:00.000Z", "pool": 0, "summary": {"G": 2}, "items": [],
            "orders": [{"orderId": "o2", "orderNo": "RH-20300620-0002", "name": "Darah", "phone": "+15555550101", "leadId": None,
                        "eventStart": "2030-06-20T18:00:00+00:00", "daysToEvent": 5, "gaps": ["菜单空"]}],
            "reconcile": [{"orderNo": ORDER_NO, "orderId": CANCEL_ID, "name": "Gillian", "phone": "+15555550100", "leadId": LEAD_ID,
                           "eventStart": "2030-06-15T17:00:00+00:00", "daysToEvent": 3, "diffs": diffs}]}
    r = DeskRun(["scan", "--no-write"], gets={"/api/admin/scan": scan})
    check("desk scan G: the orders' own gaps, then one line per order whose party page and invoice disagree, with every difference",
          r.has("G 已付未齐 · 2", "RH-20300620-0002 · Darah", "→ 缺：菜单空", f"{ORDER_NO} · Gillian · +15555550100 · 2030-06-15 17:00 (3 天)",
                f"→ 派对页和发票不一致：{'；'.join(diffs)}   lead {LEAD_ID}"), r)
    r = DeskRun(["scan", "--no-write"], gets={"/api/admin/scan": {**scan, "summary": {"G": 0}, "orders": [], "reconcile": []}})
    check("  nothing reported, or the endpoint not there yet: no G block, nothing invented", "已付未齐" not in r.out and "派对页和发票不一致" not in r.out, r)
    r = DeskRun(["scan", "--no-write"], gets={"/api/admin/scan": {k: v for k, v in scan.items() if k != "reconcile"}})
    check("  a site that does not send the list yet (old deploy): the gaps as before", r.has("→ 缺：菜单空") and "派对页和发票不一致" not in r.out, r)


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    tiers_match_the_ts_export()
    check("tiers: the old ladder reads 8+2 as 9 paying heads (no tier), 11+1 as 11 (none, 10-14 closed first), 14+2 as 15 (official_party15 $60)",
          desk.party_line(desk.tier_heads(8, 2)) is None
          and PARTY[10] == {"id": "official_party10", "label": "Party Size Discount (10–14 adults): $30 off", "amount": 30}
          and desk.party_line(desk.tier_heads(11, 1)) is None and desk.party_line(desk.tier_heads(14, 2))["id"] == "official_party15")
    check("tiers: an order keeps the ladder when booked before it closed or carrying a line, nobody else does (D-1105-01)",
          desk.kept_party_line(20, [], BEFORE_LADDER) == PARTY[15] and desk.kept_party_line(20, [], AFTER_LADDER) is None
          and desk.kept_party_line(20, [], None) is None and desk.kept_party_line(20, [PARTY[41]], AFTER_LADDER) == PARTY[15]
          and desk.kept_party_line(12, [], BEFORE_LADDER) is None and desk.kept_party_line(12, [], BEFORE_1102) == PARTY[10]
          and desk.kept_party_line(12, [PARTY[10]], AFTER_LADDER) == PARTY[10] and desk.kept_party_line(12, [PARTY[15]], AFTER_LADDER) is None)

    # RH-20261022-0063 (2026-10-22): quick mode, 8 adults + 2 kids -> 11 + 1.
    quick_8_2 = invoice(adults=8, kids=2, proteins=prot(chicken=(8, 2), steak=(8, 2)),
                        extras=[{"id": "tables_chairs", "qty": 10}, {"id": "utensils", "qty": 10}])
    args = ["--headcount", "15/1", "--proteins", "chicken=15/1", "steak=15/1", "--add-extra", "tables_chairs=16", "utensils=16"]
    r = Run(quick_8_2, *args, "--dry", created_at=AFTER_LADDER)
    check("--headcount 15/1 on a quick-mode order booked after the ladder closed: counts set, no party line, TOTAL $1,168.40 = desk price, --dry saves nothing",
          r.exit is None and r.saved is None and r.has("adultCount/childCount: 8/2 -> 15/1", "✓ total check: TOTAL $1,168.40", "DRY   not saved")
          and "official_party" not in r.out, r)
    r = Run(quick_8_2, *args, created_at=AFTER_LADDER)
    d = r.data
    check("  saved: 15/1, the menu, tables/utensils for 16, and no promotion line",
          d.get("adultCount") == 15 and d.get("childCount") == 1 and d.get("mode") == "quick" and d.get("promotions") == []
          and {q["itemId"]: (q["qty"], q.get("childQty")) for q in d.get("quickCountItems") or []} == {"chicken": (15, 1), "steak": (15, 1)}
          and {e["id"]: e["qty"] for e in d.get("partyExtras") or []} == {"tables_chairs": 16, "utensils": 16}
          and r.saved.get("baseVersion") == "v-selfcheck", r)
    r = Run(quick_8_2, *args, "--dry", created_at=BEFORE_LADDER)
    check("  the same order booked before the ladder closed keeps it: official_party15 added, TOTAL $1,108.40",
          r.has("none -> official_party15 $60.00", "✓ total check: TOTAL $1,108.40"), r)
    r = Run(quick_8_2, *args, created_at=BEFORE_LADDER)
    check("  saved with exactly the official party15 line", r.data.get("promotions") == [PARTY[15]], r)
    r = Run(quick_8_2, "--headcount", "11/1", "--proteins", "chicken=11/1", "steak=11/1", "--add-extra", "tables_chairs=12", "utensils=12", "--dry",
            created_at=BEFORE_LADDER)
    check("--headcount 11/1 on an order from between the two closings: 10-14 earns no line, TOTAL $868.80 = desk price",
          r.has("✓ total check: TOTAL $868.80") and "official_party" not in r.out, r)
    r = Run(quick_8_2, "--headcount", "11/1", "--proteins", "chicken=11/1", "steak=11/1", "--add-extra", "tables_chairs=12", "utensils=12", "--dry",
            created_at=BEFORE_1102)
    check("  booked before 11/02 it keeps 10-14 too: official_party10 added, TOTAL $838.80 (D-1102-01)",
          r.has("none -> official_party10 $30.00", "✓ total check: TOTAL $838.80"), r)
    r = Run(invoice(adults=20, promos=[PARTY[15]]), "--headcount", "26/0", "--dry", created_at=AFTER_LADDER)
    check("an order booked after the cutoff but carrying a party line (a lead quoted with the ladder) re-tiers on it: 20 -> 26 is official_party25",
          r.has("official_party15 $60.00 -> official_party25 $90.00", "✓ total check: TOTAL $1,467.40"), r)
    r = Run(quick_8_2, "--headcount", "11/1", "--dry")
    check("--headcount alone says the menu and the per-guest setup still count the old party",
          r.has("the menu is still chicken=8/2 steak=8/2", "pass --proteins", "tables_chairs is still billed for 10 guests, the party is now 12"), r)
    r = Run(quick_8_2, "--add-adult", "1", "--dry")
    check("--add-adult on a quick-mode order points at --headcount (not --proteins)",
          "--headcount ADULTS/KIDS" in str(r.exit) and r.saved is None, r)
    # Tablecloths for their own tables (owner 11-03): $5 a cloth, $8 in white.
    r = Run(quick_8_2, "--add-extra", "white_linen=2", "white_tablecloth=5", "--dry")
    check("--add-extra white_linen=2 white_tablecloth=5: two cloths at $5, five white ones at $8",
          r.exit is None and r.has("tablecloths: 0 -> 2 at $5.00 each", "white tablecloths: 0 -> 5 at $8.00 each"), r)
    # Chairs and tables by the piece (D-1106-03): a party on its own tables rents chairs only.
    r = Run(quick_8_2, "--add-extra", "folding_chairs=30", "folding_tables=2", "--dry")
    check("--add-extra folding_chairs=30 folding_tables=2: thirty chairs and two bare tables, by count",
          r.exit is None and r.has("chairs on their own: 0 -> 30 at $5.00 each", "6-ft tables on their own (no cloth): 0 -> 2 at $10.00 each"), r)
    r = Run(invoice(mode="detailed", adults=5, guests=rows(5)), "--headcount", "6/0", "--dry")
    check("--headcount refuses an order with guest rows", "guest rows" in str(r.exit), r)
    r = Run(invoice(mode="detailed", adults=5), "--headcount", "6/0")
    check("--headcount works on a fresh order (detailed, no rows yet)", r.data.get("adultCount") == 6 and r.data.get("mode") == "detailed", r)

    # The stored order after the 10-22 rewrite, before the tier was added by hand.
    rewritten = invoice(mode="detailed", adults=15, kids=1, guests=rows(15, 1, setup=True))
    r = Run(rewritten, "--time", "18:30", "--dry", created_at=BEFORE_LADDER)
    check("a stored order missing the tier it keeps: TOTAL CHECK FAILED, $1,168.40 vs $1,108.40, $60.00 too much, fix named",
          r.has("TOTAL CHECK FAILED", "$1,168.40", "$1,108.40", "$60.00 too much", "party size: order no line; it should carry -$60.00 for 15 paying heads",
                "likely fix: --retier (puts official_party15 $60.00 on for 15 paying heads)"), r)
    r = Run(rewritten, "--retier", created_at=BEFORE_LADDER)
    check("  --retier on it: official_party15 added, nothing else, ✓ $1,108.40",
          r.data.get("promotions") == [PARTY[15]] and r.data.get("guests") == rewritten["guests"] and r.has("✓ total check: TOTAL $1,108.40"), r)
    r = Run(rewritten, "--time", "18:30", "--dry", created_at=AFTER_LADDER)
    check("  the same order booked after the ladder closed has no tier to miss: ✓ $1,168.40",
          r.has("✓ total check: TOTAL $1,168.40") and "TOTAL CHECK FAILED" not in r.out, r)
    r = Run(rewritten, "--retier", "--dry", created_at=AFTER_LADDER)
    check("  and --retier says no line is right for it", r.has("none is already right", "D-1105-01") and "nothing to change" in str(r.exit), r)
    r = Run(invoice(mode="detailed", adults=15, kids=1, guests=rows(15, 1, setup=True), promos=[PARTY[15]]), "--time", "18:30", "--dry")
    check("  the same order with official_party15: ✓", r.has("✓ total check: TOTAL $1,108.40") and "TOTAL CHECK FAILED" not in r.out, r)
    r = Run(invoice(mode="detailed", adults=15, kids=1, guests=rows(15, 1, setup=True), promos=[PARTY[10]]), "--retier", "--dry")
    check("  --retier on a wrong tier (official_party10 for 15 heads) replaces it",
          r.has("official_party10 $30.00 -> official_party15 $60.00", "✓ total check: TOTAL $1,108.40"), r)
    r = Run(invoice(mode="detailed", adults=15, kids=1, guests=rows(15, 1, setup=True), promos=[PARTY[15]]), "--retier", "--dry")
    check("  --retier when the line is right: says so, nothing to change", r.has("is already right") and "nothing to change" in str(r.exit), r)
    # D-1102-01: an order that has the closed tier keeps it, and desk's checks agree.
    kept = invoice(mode="detailed", adults=11, kids=1, guests=rows(11, 1, setup=True), promos=[PARTY[10]])
    r = Run(kept, "--time", "18:30", "--dry")
    check("  an order keeping official_party10: ✓ $838.80", r.has("✓ total check: TOTAL $838.80") and "TOTAL CHECK FAILED" not in r.out, r)
    r = Run(kept, "--retier", "--dry")
    check("  --retier leaves the kept line alone", r.has("is already right") and "nothing to change" in str(r.exit), r)
    r = Run(invoice(adults=12, promos=[PARTY[10]]), "--headcount", "13/0", "--dry")
    check("  a headcount inside 10-14 keeps the line, ✓ $748.70", r.has("✓ total check: TOTAL $748.70") and "-> none" not in r.out, r)

    # Re-tier on rows: --remove-guest / --add-adult / --guests-file. Only the party line moves, in place.
    courtesy = {"id": "courtesy_1", "label": "Courtesy credit", "amount": 10.0}
    fifteen = invoice(mode="detailed", adults=15, guests=rows(15), extras=[{"id": "gyoza", "qty": 1}], promos=[FREE_GYOZA, PARTY[15], courtesy])
    r = Run(fifteen, "--remove-guest", "Guest 15")
    check("--remove-guest 15 -> 14: official_party15 $60 comes off, the other lines untouched, ✓",
          r.data.get("promotions") == [FREE_GYOZA, courtesy]
          and r.has("official_party15 $60.00 -> none (under 15)", "✓ total check: TOTAL $828.60"), r)
    r = Run(invoice(mode="detailed", adults=14, guests=rows(14), promos=[PARTY[10]]), "--add-adult", "1")
    check("--add-adult 14 -> 15: official_party10 becomes official_party15", r.data.get("promotions") == [PARTY[15]] and r.data.get("adultCount") == 15, r)
    with tempfile.TemporaryDirectory() as tmp:
        f = pathlib.Path(tmp) / "rows.json"
        f.write_text(json.dumps([{"name": f"G{i}", "proteins": ["chicken", "steak"], "tables": True, "utensils": True} for i in range(16)]),
                     encoding="utf-8")
        r = Run(quick_8_2, "--guests-file", str(f), created_at=BEFORE_LADDER)
        r_new = Run(quick_8_2, "--guests-file", str(f), created_at=AFTER_LADDER)
    check("--guests-file 16 adults on an 8+2 order booked before the cutoff: official_party15 $60 added, rows carry the setup, ✓ $1,138.40",
          r.data.get("promotions") == [PARTY[15]] and r.data.get("mode") == "detailed" and not r.data.get("partyExtras")
          and r.has("✓ total check: TOTAL $1,138.40"), r)
    check("  booked after it: no party line, ✓ $1,198.40",
          r_new.data.get("promotions") == [] and r_new.data.get("mode") == "detailed" and r_new.has("✓ total check: TOTAL $1,198.40"), r_new)
    with tempfile.TemporaryDirectory() as tmp:
        f = pathlib.Path(tmp) / "rows.json"
        f.write_text(json.dumps([{"name": f"G{i}", "proteins": ["chicken", "steak"]} for i in range(16)]), encoding="utf-8")
        r = Run(quick_8_2, "--guests-file", str(f))
    check("--guests-file with no setup on the rows stops: the order's plates and tables do not fall off", "no row carries it" in str(r.exit), r)
    # Chairs beyond the guests who eat (RH-20261029-8929, 2026-11-06): 30 chairs
    # for 28 diners and 2 who are not eating. The rows carry 28; the 2 stay on the line.
    chairs_30 = invoice(adults=28, proteins=prot(chicken=(28, 0), steak=(28, 0)), extras=[{"id": "tables_chairs", "qty": 30}])
    with tempfile.TemporaryDirectory() as tmp:
        f = pathlib.Path(tmp) / "rows.json"
        f.write_text(json.dumps([{"name": f"G{i}", "proteins": ["chicken", "steak"], "tables": True} for i in range(28)]), encoding="utf-8")
        r = Run(chairs_30, "--guests-file", str(f), created_at=AFTER_LADDER)
    check("--guests-file 28 rows with tables on an order with 30 chairs: the 2 beyond the guests stay on the party line, 30 billed, ✓",
          {e["id"]: e["qty"] for e in r.data.get("partyExtras") or []} == {"tables_chairs": 2}
          and desk._setup_units(r.data, "tables_chairs") == 30
          and r.has("kept tables_chairs=2 beyond the guests", "✓ total check: TOTAL"), r)

    # Rows exported from the party page keep their guest's id there (RH-20261107-9978,
    # 2026-11-09): with a fresh id, a picked guest with no name matched nothing on the
    # save and stayed next to its "Guest 4" row - 15 guests on the page for 13 rows.
    page = {"guests": [
        {"id": "g_robert", "kind": "adult", "name": "Robert", "proteins": ["steak", "shrimp"]},
        {"id": "g_unnamed", "kind": "adult", "name": "", "proteins": ["shrimp"]},
        {"id": "g_toddler", "kind": "under5", "name": "", "proteins": ["steak", "chicken"]},
        {"id": "g_baby", "kind": "baby", "name": "Ava", "proteins": []},
    ], "extras": {"tablesChairs": True}}
    exported = desk._plan_rows(page)
    check("order plan --rows-out: every row keeps its party-page id, the baby is no row",
          [x.get("id") for x in exported] == ["g_robert", "g_unnamed", "g_toddler"] and exported[1]["proteins"] == ["shrimp", "shrimp"])
    with tempfile.TemporaryDirectory() as tmp:
        f = pathlib.Path(tmp) / "rows.json"
        extra = {"name": "Plus one", "proteins": ["steak", "shrimp"], "tables": True}
        f.write_text(json.dumps([*exported, extra, dict(exported[0], name="Robert's twin")]), encoding="utf-8")
        r = Run(invoice(mode="detailed", adults=3, guests=rows(3), extras=[]), "--guests-file", str(f), "--replace-guests",
                created_at=AFTER_LADDER)
    ids = [g.get("id") for g in r.data.get("guests") or []]
    check("--guests-file: rows from the page are saved with its ids, a new row and a copied row get new ones",
          ids[:3] == ["g_robert", "g_unnamed", "g_toddler"] and len(ids) == 5 and len(set(ids)) == 5
          and all(i and i.startswith(("g4_", "g5_")) for i in ids[3:])
          and [g.get("name") for g in r.data.get("guests") or []][1] == "Guest 2", r)

    # The edges of the ladder.
    r = Run(invoice(adults=10, proteins=prot(chicken=(10, 0), steak=(10, 0)), promos=[PARTY[10]]), "--headcount", "9/0")
    check("under 10 paying heads: the kept line comes off too, and the $599 minimum check still matches",
          r.data.get("promotions") == [] and r.has("official_party10 $30.00 -> none (under 15)", "✓ total check: TOTAL $599.00", "minimum"), r)
    r = Run(invoice(adults=50, promos=[PARTY[41]]), "--headcount", "61/0")
    check("61+ is a custom quote: line left as it is, said so, check skipped",
          r.data.get("promotions") == [PARTY[41]] and r.has("custom quote (61+)", "(total check skipped"), r)

    # Appreciation stands in for the tier (leads skill: they do not stack unless the owner says so).
    teacher = {"id": "appreciation_teacher", "label": "Teacher Appreciation: $50 off", "amount": 50.0}
    r = Run(invoice(adults=9, promos=[teacher]), "--headcount", "15/0", created_at=BEFORE_LADDER)
    check("appreciation on an order that keeps the ladder: no party line added, said why, ✓ with the stand-in noted",
          r.data.get("promotions") == [teacher] and r.has("not added - appreciation_teacher", "✓ total check: TOTAL $848.50", "stands in"), r)
    r = Run(invoice(adults=15, promos=[PARTY[15]]), "--remove-promo", "official_party15", "--add-promo", "appreciation_teacher=50",
            "--promo-label", "Teacher Appreciation: $50 off", "--headcount", "16/0", "--dry", created_at=BEFORE_LADDER)
    check("--remove-promo official_party15 in the same command: not put back",
          r.has("not put back", "✓ total check: TOTAL $908.40") and "-> official_party15" not in r.out, r)

    # Free 3-4 year olds: kept on top of --headcount's kids, never in the tier.
    r = Run(invoice(adults=10, kids=3, promos=[LITTLE_LINE, PARTY[10]]), "--headcount", "14/2")
    check("--headcount 14/2 with a 'Little kids ×1' line: childCount 3, 15 paying heads -> official_party15, ✓",
          r.data.get("childCount") == 3 and r.data.get("promotions") == [LITTLE_LINE, PARTY[15]]
          and r.has("(2 kids 5-12 + 1 free 3-4 on the Little kids line)", "✓ total check: TOTAL $838.40"), r)
    # --headcount's third number is the free 3-4 year olds: it sets the Little kids line (owner 2026-10-24).
    r = Run(invoice(adults=12, promos=[PARTY[10]]), "--headcount", "12/1/1")
    check("--headcount 12/1/1 on a quick-mode order: childCount 2, the Little kids ×1 line added, ✓ $718.70",
          r.data.get("adultCount") == 12 and r.data.get("childCount") == 2 and r.data.get("promotions") == [PARTY[10], LITTLE_LINE]
          and r.has("12/0 -> 12/2 (1 kid 5-12 + 1 free 3-4)", "little kids: none -> Little kids (3-4) @ $0 ×1 $29.90 (--headcount: 1 free",
                    "✓ total check: TOTAL $718.70"), r)
    toddler_quick = invoice(adults=12, kids=2, promos=[LITTLE_LINE, PARTY[10]])
    r = Run(toddler_quick, "--headcount", "12/1/2")
    check("  12/1/2 on an order whose line said ×1: childCount 3, the line ×2 in place, ✓ $718.70",
          r.data.get("childCount") == 3 and r.data.get("promotions") == [dict(LITTLE_LINE, label="Little kids (3-4) @ $0 ×2", amount=59.8), PARTY[10]]
          and r.has("✓ total check: TOTAL $718.70"), r)
    r = Run(toddler_quick, "--headcount", "12/1/0")
    check("  12/1/0: the line comes off, childCount 1, ✓ $718.70",
          r.data.get("childCount") == 1 and r.data.get("promotions") == [PARTY[10]] and r.has("--headcount: no 3-4 year olds", "✓ total check: TOTAL $718.70"), r)
    r = Run(invoice(adults=14, promos=[PARTY[10]]), "--headcount", "14/0/3")
    check("  14/0/3: three toddlers never move the tier (official_party10 stays)",
          r.data.get("childCount") == 3 and r.data.get("promotions") == [PARTY[10], dict(LITTLE_LINE, label="Little kids (3-4) @ $0 ×3", amount=89.7)]
          and "-> official_party" not in r.out, r)
    r = Run(invoice(mode="detailed", adults=12), "--headcount", "12/1/1")
    check("  a fresh order (detailed, no rows yet) takes it too",
          r.data.get("mode") == "detailed" and r.data.get("childCount") == 2 and LITTLE_LINE in (r.data.get("promotions") or []), r)
    for bad_count in ("12/1/x", "12/1/1/1", "0/0/2"):
        r = Run(invoice(adults=12, promos=[PARTY[10]]), "--headcount", bad_count, "--dry")
        check(f"  --headcount {bad_count} is refused", "--headcount ADULTS/KIDS[/LITTLE]" in str(r.exit) and r.saved is None, r)

    r = Run(invoice(mode="detailed", adults=12, kids=2, guests=rows(12, 1, little=1), promos=[LITTLE_LINE, PARTY[10]]), "--time", "19:00", "--dry")
    check("a little kid's row with its $0 line: ✓", r.has("✓ total check: TOTAL $718.70"), r)
    r = Run(invoice(mode="detailed", adults=12, kids=2, guests=rows(12, 1, little=1), promos=[PARTY[10]]), "--time", "19:00", "--dry")
    check("a little kid's row billed at the child price (no $0 line): loud, $29.90 too much", r.has("TOTAL CHECK FAILED", "$29.90 too much"), r)

    # --guests-file: the list's little: true rows are the Little kids line (owner 2026-10-24).
    def guests_file(tmp: str, adults: int, kids: int, little: int) -> str:
        people = ([{"name": f"A{i}", "proteins": ["chicken", "steak"]} for i in range(adults)]
                  + [{"name": f"K{i}", "child": True, "proteins": ["chicken", "steak"]} for i in range(kids)]
                  + [{"name": f"Mia{i}", "little": True} for i in range(little)])  # no "child", no proteins
        f = pathlib.Path(tmp) / f"rows-{adults}-{kids}-{little}.json"
        f.write_text(json.dumps(people), encoding="utf-8")
        return str(f)

    little_2 = dict(LITTLE_LINE, label="Little kids (3-4) @ $0 ×2", amount=59.8)
    with tempfile.TemporaryDirectory() as tmp:
        r = Run({**quick_8_2, "partyExtras": []}, "--guests-file", guests_file(tmp, 12, 1, 1))
        mia = next((g for g in r.data.get("guests") or [] if g.get("name") == "Mia0"), {})
        check("--guests-file with a little: true row: a child row with no proteins, the Little kids ×1 line added, ✓ $748.70",
              mia.get("isChild") is True and mia.get("isLittle") is True and mia.get("proteins") == [] and r.data.get("childCount") == 2
              and r.data.get("promotions") == [LITTLE_LINE]
              and r.has("little kids: none -> Little kids (3-4) @ $0 ×1 $29.90", "✓ total check: TOTAL $748.70"), r)
        two_toddlers = invoice(mode="detailed", adults=12, kids=3, guests=rows(12, 1, little=2), promos=[little_2, PARTY[10]])
        r = Run(two_toddlers, "--guests-file", guests_file(tmp, 12, 1, 1), "--replace-guests")
        check("  a list with one toddler on an order whose line said ×2: the line becomes ×1 in place, ✓ $718.70",
              r.data.get("promotions") == [LITTLE_LINE, PARTY[10]]
              and r.has("Little kids (3-4) @ $0 ×2 $59.80 -> Little kids (3-4) @ $0 ×1 $29.90", "✓ total check: TOTAL $718.70"), r)
        one_toddler = invoice(mode="detailed", adults=12, kids=2, guests=rows(12, 1, little=1), promos=[LITTLE_LINE, PARTY[10]])
        r = Run(one_toddler, "--guests-file", guests_file(tmp, 12, 1, 0), "--replace-guests")
        check("  a list with no toddler on an order with a ×1 line: the line comes off, said why, ✓ $718.70",
              r.data.get("promotions") == [PARTY[10]] and r.has("-> none (the list has no little: true row", "✓ total check: TOTAL $718.70"), r)
        bad = pathlib.Path(tmp) / "one-protein.json"
        bad.write_text(json.dumps([{"name": "Ann", "proteins": ["chicken"]}]), encoding="utf-8")
        r = Run(quick_8_2, "--guests-file", str(bad), "--dry")
        check("  a guest who is not little still needs two proteins", "needs at least 2 proteins" in str(r.exit) and r.saved is None, r)
    r = Run(two_toddlers, "--remove-guest", "Guest 15")
    check("--remove-guest of a toddler: the line drops to ×1 in place, ✓ $718.70",
          r.data.get("promotions") == [LITTLE_LINE, PARTY[10]] and r.data.get("childCount") == 2 and r.has("✓ total check: TOTAL $718.70"), r)
    r = Run(two_toddlers, "--remove-guest", "Guest 14", "Guest 15")
    check("  both toddlers: the line comes off", r.data.get("promotions") == [PARTY[10]] and r.has("✓ total check: TOTAL $718.70"), r)
    r = Run(one_toddler, "--remove-guest", "Guest 13")
    check("--remove-guest of a paying kid leaves the toddler's line alone, ✓ $688.80",
          r.data.get("promotions") == [LITTLE_LINE, PARTY[10]] and "little kids:" not in r.out and r.has("✓ total check: TOTAL $688.80"), r)

    # The Weekday Special: its free appetizer nets out; a stale per-head cut is the gap.
    monday = invoice(adults=12, proteins=prot(chicken=(12, 0), steak=(12, 0)), extras=[{"id": "gyoza", "qty": 1}],
                     promos=[WEEKDAY_LINE, PARTY[10]], date=MONDAY)
    r = Run(monday, "--time", "19:00", "--dry")
    check("a Monday order with its Weekday Special and free gyoza: ✓ $628.80", r.has("✓ total check: TOTAL $628.80", "Weekday Special (Mon-Thu)"), r)
    r = Run(monday, "--headcount", "13/0", "--proteins", "chicken=13", "steak=13", "--dry")
    check("--headcount 13/0 on it: the frozen weekday line is called out, the check is $5.00 too much, fix named",
          r.has("promo official_weekday $75.00 was priced for the old headcount", "the save re-prices it", "TOTAL CHECK FAILED", "$5.00 too much", "of which $15.00 is the free appetizer",
                "--promo official_weekday=80.00") and "-> official_party" not in r.out and "--retier" not in r.out, r)

    r = Run(monday, "--free-appetizer", "edamame", "--dry")
    check("--free-appetizer edamame on it (the line drops $5 with the tray): ✓ $628.80, the free edamame netted",
          r.has("✓ total check: TOTAL $628.80", "extras $10.00 - other promos $10.00"), r)
    # --set-extra: the whole count, free tray included (Joyce 11-09 took her bought gyoza off on the page).
    r = Run(dict(monday, partyExtras=[{"id": "gyoza", "qty": 2}]), "--set-extra", "gyoza=1", "edamame=1")
    check("--set-extra gyoza=1 edamame=1 over a bought gyoza: back to the free tray, one edamame on",
          r.data.get("partyExtras") == [{"id": "gyoza", "qty": 1}, {"id": "edamame", "qty": 1}]
          and r.has("party extra: gyoza 2 -> 1 tray(s)", "party extra: edamame 0 -> 1 tray(s)"), r)
    r = Run(monday, "--set-extra", "gyoza=0", "--dry")
    check("  gyoza=0 takes the line off, --dry saves nothing", r.saved is None and r.has("party extra: gyoza 1 -> 0 tray(s)"), r)
    r = Run(monday, "--set-extra", "utensils=8", "--dry")
    check("  a setup item is not a party extra (those ride the rows)", "--set-extra 'utensils=8'" in str(r.exit) and r.saved is None, r)
    # One free tray per 10 guests rides on the weekday line; a tray they bought does not.
    def monday_20(line_amount: float) -> dict:
        return invoice(adults=20, proteins=prot(chicken=(20, 0), steak=(20, 0)), extras=[{"id": "gyoza", "qty": 2}], date=MONDAY,
                       promos=[dict(WEEKDAY_LINE, amount=line_amount), PARTY[15]])
    r = Run(monday_20(130.0), "--time", "19:00", "--dry")
    check("20 adults on a Monday, two free gyoza on the weekday line ($30 + 20 x $5): ✓ $1,038.00",
          r.has("✓ total check: TOTAL $1,038.00", "extras $30.00 - other promos $30.00"), r)
    r = Run(monday_20(115.0), "--time", "19:00", "--dry")
    check("  the same with one of the two gyoza bought ($15 + 20 x $5): ✓ $1,053.00, the bought tray billed",
          r.has("✓ total check: TOTAL $1,053.00", "extras $30.00 - other promos $15.00"), r)
    no_tray = copy.deepcopy(monday)
    no_tray["partyExtras"] = []
    r = Run(no_tray, "--time", "19:00", "--dry")
    check("a weekday line refunding a gyoza the order does not carry: loud, $15.00 too little", r.has("TOTAL CHECK FAILED", "$15.00 too little"), r)

    # The free appetizer goes by the head (2026-10-30): a tray row is 2.6 of them, and nothing here may truncate it.
    def monday_26(line_amount: float, trays: float) -> dict:
        return invoice(adults=26, proteins=prot(chicken=(26, 0), steak=(26, 0)), extras=[{"id": "gyoza", "qty": trays}], date=MONDAY,
                       promos=[dict(WEEKDAY_LINE, amount=line_amount), desk.party_line(26)])
    gyoza = lambda r, id_="gyoza": next((e["qty"] for e in r.data.get("partyExtras") or [] if e["id"] == id_), 0)  # noqa: E731
    r = Run(monday_26(169.0, 2.6), "--time", "19:00", "--dry")
    check("26 adults on a Monday, 26 gyoza by the head (2.6 trays, $39 + 26 x $5): ✓ $1,337.40",
          r.has("✓ total check: TOTAL $1,337.40", "extras $39.00 - other promos $39.00"), r)
    r = Run(monday_26(169.0, 3.6), "--time", "19:00", "--dry")
    check("  the same with a tray they bought: ✓ $1,352.40, the bought tray billed",
          r.has("✓ total check: TOTAL $1,352.40", "extras $54.00 - other promos $39.00"), r)
    r = Run(monday_26(169.0, 2.6), "--add-extra", "gyoza=1")
    check("  --add-extra on it keeps the pieces (3.6 trays)", gyoza(r) == 3.6, r)
    r = Run(monday_26(169.0, 2.6), "--free-item", "gyoza=1")
    check("  --free-item on it keeps the pieces (3.6 trays)", gyoza(r) == 3.6 and r.data["promotions"][-1]["label"] == "FREE: Gyoza (10 pcs) x1", r)
    r = Run(monday_26(169.0, 2.6), "--free-appetizer", "spring_rolls")
    check("  --free-appetizer spring_rolls moves all 2.6 and the same money", gyoza(r, "spring_rolls") == 2.6 and gyoza(r) == 0
          and r.data["promotions"][0]["amount"] == 169.0 and "Spring Rolls" in r.data["promotions"][0]["label"], r)
    r = Run(monday_26(169.0, 2.6), "--free-appetizer", "edamame")
    check("  --free-appetizer edamame: the count crosses at the new price, the save settles it by the head",
          gyoza(r, "edamame") == 2.6 and r.data["promotions"][0]["amount"] == 156.0 and r.has("TOTAL $"), r)
    r = Run(monday_26(169.0, 2.6), "--free-appetizer-trays", "3")
    check("  --free-appetizer-trays 3 is above the rule: $6 more on the line, three trays",
          gyoza(r) == 3 and r.data["promotions"][0]["amount"] == 175.0, r)
    r = Run(monday_26(169.0, 3.6), "--date", SATURDAY, "--time", "19:00")
    check("  moved to a Saturday: the line goes and takes its 2.6, the bought tray stays",
          gyoza(r) == 1 and not any(p["id"] == "official_weekday" for p in r.data.get("promotions") or []) and r.has("gyoza qty -2.6"), r)

    # "(feeds 3)" came off the menu (2026-10-30): a gift saved with it is still edamame, and what desk writes does not say it.
    def gift_on(app: str, label: str, amount: float) -> dict:
        return invoice(adults=12, proteins=prot(chicken=(12, 0), steak=(12, 0)), extras=[{"id": app, "qty": 2}],
                       promos=[{"id": f"{app}_1", "label": label, "amount": amount}, PARTY[10]])
    r = Run(gift_on("edamame", "FREE: Edamame (feeds 3) x2", 20.0), "--free-appetizer", "gyoza")
    check("a gift saved as 'FREE: Edamame (feeds 3) x2' still swaps", gyoza(r) == 2 and gyoza(r, "edamame") == 0
          and r.data["promotions"][0]["label"] == "FREE: Gyoza (10 pcs) x2" and r.data["promotions"][0]["amount"] == 30.0, r)
    r = Run(gift_on("gyoza", "FREE: Gyoza (10 pcs) x2", 30.0), "--free-appetizer", "edamame")
    check("  swapped the other way it says 'FREE: Edamame x2'", gyoza(r, "edamame") == 2 and r.data["promotions"][0]["label"] == "FREE: Edamame x2", r)
    r = Run(gift_on("edamame", "FREE: Edamame x2", 20.0), "--free-appetizer", "spring_rolls")
    check("  and that new label swaps too", gyoza(r, "spring_rolls") == 2 and r.data["promotions"][0]["label"] == "FREE: Spring Rolls (10 pcs) x2", r)

    # The minimum must not raise a false alarm when the order has a paid tray.
    r = Run(invoice(adults=6, proteins=prot(chicken=(6, 0), steak=(6, 0)), extras=[{"id": "gyoza", "qty": 1}]), "--time", "19:00", "--dry")
    check("6 adults + a paid gyoza tray under the $599 minimum: ✓ $599.00", r.has("✓ total check: TOTAL $599.00"), r)

    # A past date: the engine prices neither, the order's own lines say which rate it was sold at.
    past = copy.deepcopy(monday)
    past["contactInfo"]["eventDate"] = "2026-10-05"
    r = Run(past, "--time", "19:00", "--dry")
    check("a past Monday party: compared at the weekday rate its lines imply, ✓", r.has("✓ total check", "(past)", "no usable date")
          and all("date" not in p for p in r.priced), r)

    # ---- the order lint (D-1017-02): what the engine put on, what is still missing ----
    applied = {"entitlementsApplied": [{"id": "official_platter20", "action": "added", "label": "FREE appetizer (20+ guests): Gyoza", "amount": 15,
                                        "text": 'added official_platter20 "FREE appetizer (20+ guests): Gyoza" -$15.00 [+1 gyoza]'}],
               "lint": {"blocking": [], "warnings": [{"code": "travel_unmeasured", "message": "travel", "messageZh": "有地址但路费没算"}]}}
    r = Run(invoice(adults=12, proteins=prot(chicken=(12, 0), steak=(12, 0)), promos=[PARTY[10]]), "--time", "19:00", reply=applied)
    check("order set prints what the invoice engine added, the totals again, and the lint after the save",
          r.has("引擎按规则：added official_platter20", "⚠ 缺项（提醒，不拦）", "有地址但路费没算") and r.out.count("total check") >= 2, r)
    r = Run(invoice(adults=12, proteins=prot(chicken=(12, 0), steak=(12, 0)), promos=[PARTY[10]]), "--reconcile")
    check("order set --reconcile saves the order as it stands", r.saved is not None and r.has("reconcile: saved as it is"), r)

    tomorrow = (datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=-8))) + datetime.timedelta(days=1)).date().isoformat()
    party = invoice(adults=12, proteins=prot(chicken=(12, 0), steak=(12, 0)), promos=[PARTY[10]], date=tomorrow)
    missing = {"ok": True, "blocking": [{"code": "entitlement_missing", "message": "owed", "messageZh": "按规则该有、发票上没有：FREE appetizer (20+ guests): Gyoza",
                                         "fix": "order set <order> --reconcile"}], "warnings": []}
    r = Run(party, op="show", lint=missing)
    check("order show prints the ⚠ 缺项 block with the fix", r.has("⚠ 缺项（1 项拦着备料单和前一天的提醒）", "!! 按规则该有", "改法：order set <order> --reconcile"), r)
    r = Run(party, op="remind", lint=missing)
    check("order remind refuses an order the lint says is missing something", r.texted is None and "not sent" in str(r.exit) and r.has("!! 按规则该有"), r)
    r = Run(party, "--dry", op="remind", lint=missing)
    check("  --dry shows the text and that it would be held", r.texted is None and r.has("DRY   See you", "HOLD"), r)
    r = Run(party, "--force", op="remind", lint=missing)
    check("  --force sends it anyway", bool(r.texted) and r.has("OK    texted"), r)
    r = Run(party, op="remind", lint={"ok": True, "blocking": [], "warnings": []})
    check("  a clean order is texted as before", bool(r.texted) and r.has("✓ 缺项：无"), r)
    body = (r.texted or {}).get("body", "")
    check("  the text links the invoice and quotes no amount", "/d/selfcheck" in body and "$" not in body and "balance" not in body.lower(), r)

    quoted_price_checks()
    send_checks()
    order_flow_checks()

    # A request with no "please" stops a send (owner 2026-11-01). Same samples as tests/voice-check.test.ts.
    now = datetime.datetime(2026, 11, 1, 12, 0, tzinfo=datetime.timezone.utc)
    rude = lambda text: any("命令口气" in line for _, line in desk.voice_check(text, [], now, []))
    for text in ("Got it. Tell me if anyone needs something different.", "Hi Irene, pick your proteins on the party page.",
                 "If anything looks off, just text me here.", "No rush, just let me know."):
        check(f"voice stops: {text}", rude(text))
    for text in ("Please tell me if anyone needs something different.", "Could you tell me which appetizer you'd like?",
                 "You can pick how you're paying at the top.", "Text works too, whichever is easier.",
                 "See you Friday. Reply STOP to opt out."):
        check(f"voice passes: {text}", not rude(text))
    said = lambda body, ago_h: [{"direction": "inbound", "body": body, "at": (now - datetime.timedelta(hours=ago_h)).isoformat()}]
    lines = lambda text, msgs: [line for _, line in desk.voice_check(text, msgs, now, [])]
    check("voice stops a courtesy sent a day late", any("客气话不补了" in x for x in lines("Anytime. See you on the 7th.", said("Thank you so much!", 11))))
    check("  and lets it through right away", not any("客气话不补了" in x for x in lines("You're very welcome.", said("Thank you so much!", 0.1))))
    check("voice notes good news left unanswered", any("替他高兴" in x for x in lines("Got it. What city will it be in?", said("my husbands 75th", 0.1))))
    check("  and is quiet when we are glad for them", not any("替他高兴" in x for x in lines("Happy 75th to your husband! What city will it be in?", said("my husbands 75th", 0.1))))
    check("voice notes a congratulation with a full stop", any("句号" in x for x in lines("Congratulations on the wedding. Is it an evening event?", said("Wedding", 0.1))))

    # Nicole Weston 11-11: 7 adults + 1 kid in Indio ($449.20 food, $65 travel) with the $50 thank-you.
    indio = {"foodSubtotal": 449.2, "travelFee": 65}
    check("price: upgrades swapped into all 16 picks stay at the $599 minimum ($664 with travel)",
          desk.protein_quote(indio, {"filet": 12, "scallops": 1, "lobster": 3}, {}, 50)["total"] == 664.0)
    check("price: chicken + shrimp for all, 7 filet / 1 scallops / 3 lobster on top is $672.20",
          desk.protein_quote(indio, {}, {"filet": 7, "scallops": 1, "lobster": 3}, 50)["total"] == 672.2)
    check("price: all five for all 8 is $912.20, not the /quote page's $672.20",
          desk.protein_quote(indio, {}, {"filet": 8, "scallops": 8, "lobster": 8}, 50)["total"] == 912.2)
    check("price: a swap costs the premium, an extra the side price (filet $8 / $18)",
          desk.SWAP_PREMIUM == {"scallops": 6.0, "filet": 8.0, "lobster": 12.0}
          and desk.protein_quote({"foodSubtotal": 700, "travelFee": 0}, {"filet": 1}, {"filet": 1})["total"] == 726.0)

    print()
    if FAILS:
        print(f"{len(FAILS)} FAILED")
        return 1
    print("all passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
