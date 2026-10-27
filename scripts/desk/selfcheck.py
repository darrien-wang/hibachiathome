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
    --guests-file, --add-adult, --remove-guest) and no other line moves
  - the TOTAL is held against desk price, and a wrong stored discount is loud
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
# Catalog numbers of the two engines, as fakes need them. The ladder itself is
# desk's (checked against the TS export below), so a tier change needs nothing here.
WEEKDAY_RATE = {"adult": 54.90, "child": 27.45}  # invoice WEEKDAY_SPECIAL: $5 / $2.45 off
EXTRA_PRICES = {**desk.APPETIZER_PRICES, **desk.SETUP_PRICES, **desk.PROTEIN_SIDE_PRICES}
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
    line = desk.party_line(desk.tier_heads(adults, kids))
    tier = float(line["amount"]) if line else 0.0

    def quote(weekday: bool) -> dict:
        a_rate, k_rate = (WEEKDAY_RATE["adult"], WEEKDAY_RATE["child"]) if weekday else (desk.ADULT_PRICE, desk.CHILD_PRICE)
        food = r2(adults * a_rate + kids * k_rate)
        rentals = tables * 10 + utensils * 5
        after = max(0.0, food + rentals - tier)
        base = max(after, desk.MINIMUM_SPEND)
        return {"plan": "Weekday Special (Mon-Thu)" if weekday else "Standard", "foodSubtotal": food,
                **({"rentals": {"tablesChairsGuests": tables, "tablewareGuests": utensils, "amount": rentals}} if rentals else {}),
                "partySizeDiscount": r2(max(0.0, food + rentals - base)), "minimumApplied": after < desk.MINIMUM_SPEND,
                "travelFee": 0, "total": r2(base)}

    date = params.get("date")
    if date:
        weekday = datetime.date.fromisoformat(date).weekday() <= 3
        return {"ok": True, "price": quote(weekday), "minimum": desk.MINIMUM_SPEND,
                "weekdaySpecial": "applies to this date" if weekday else "Monday-Thursday only"}
    return {"ok": True, "price": quote(False), "ifMondayToThursday": quote(True), "minimum": desk.MINIMUM_SPEND}


# ------------------------------------------------------------ the harness --
ORDER_NO = "RH-20300615-0001"
SATURDAY, MONDAY = "2030-06-15", "2030-06-17"


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


PARTY = {n: desk.party_line(n) for n in (10, 15, 41)}
FREE_GYOZA = {"id": "gyoza_1", "label": "FREE: Gyoza (10 pcs) x1", "amount": 15.0}
WEEKDAY_LINE = {"id": "official_weekday", "label": "Weekday Special (Mon–Thu): $5 off per adult, $2.45 per child + FREE appetizer: Gyoza",
                "amount": 75.0}  # 12 adults: $15 gyoza + 12 x $5
LITTLE_LINE = {"id": "under5_auto", "label": "Little kids (3-4) @ $0 ×1", "amount": 29.9}


class Run:
    """One `desk order set` (or `op`) against the fakes: its output, exit and what it would have saved.
    `reply` is added to save-invoice's answer; `lint` is the order lint the site answers (D-1017-02)."""

    def __init__(self, prefill: dict, *args: str, op: str = "set", reply: dict | None = None, lint: dict | None = None):
        self.prefill, self.saved, self.priced = prefill, None, []
        self.reply, self.lint, self.texted = reply or {}, lint, None
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
        return [{"name": "Self Check", "email": "selfcheck@example.com", "phone": "+15555550100",
                 "orders": [{"order_no": ORDER_NO, "id": "00000000-0000-4000-8000-000000000001"}]}]

    def invoice_post(self, path, payload, timeout=120):
        if path == "/api/self-service/orders/lookup":
            return {"found": True, "order": {"orderNo": ORDER_NO, "updatedAt": "2030-01-01T00:00:00Z", "version": "v-selfcheck"},
                    "prefill": copy.deepcopy(self.prefill)}
        if path == "/api/invoice":
            # remind quotes the card bill only off an address-rated invoice
            return {"invoice": {**fake_invoice(payload), **({"salesTaxRateSource": "address"} if self.lint is not None else {})}}
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
        script.write_text(f"import {{ PARTY_SIZE_DISCOUNT_TIERS as t, PARTY_SIZE_CUSTOM_FROM as c, KID_TIER_WEIGHT as w }} "
                          f"from '{(root / 'config' / 'pricing-rules').as_posix()}'\n"
                          "console.log(JSON.stringify({ t, c, w }))\n", encoding="utf-8")
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

    def __init__(self, thread: list[dict], *args: str, at: str, phone: str = PROM_PHONE, staff: tuple[str, ...] = (), cmd: str = "send"):
        self.thread, self.staff = thread, staff
        self.posted, self.reads, self.uploads = None, [], []
        desk.site_get, desk.site_post, desk._now = self.site_get, self.site_post, lambda: wall(at)
        _api.upload_sales_media = lambda local, dest, content_type="image/jpeg": self.uploads.append(dest) or dest
        _api.signed_sales_media_url = lambda dest, ttl_seconds=3600: f"https://media.example/{dest}"
        buf = io.StringIO()
        self.exit = None
        with contextlib.redirect_stdout(buf):
            try:
                desk.main([cmd, phone, *(["--body", REPLY] if cmd == "send" else []), *args])
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

    def has(self, *parts: str) -> bool:
        return all(p in self.out for p in parts)


def send_checks() -> None:
    kept = desk.site_get, desk.site_post, desk._now, _api.upload_sales_media, _api.signed_sales_media_url
    try:
        _send_checks()
    finally:
        desk.site_get, desk.site_post, desk._now, _api.upload_sales_media, _api.signed_sales_media_url = kept


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


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    tiers_match_the_ts_export()
    check("tiers: 8+2 is 9 paying heads (no tier), 11+1 is 11 (official_party10 $30), 14+2 is 15 (official_party15 $60)",
          desk.party_line(desk.tier_heads(8, 2)) is None
          and PARTY[10] == {"id": "official_party10", "label": "Party Size Discount (10–14 adults): $30 off", "amount": 30}
          and desk.party_line(desk.tier_heads(11, 1)) == PARTY[10] and desk.party_line(desk.tier_heads(14, 2))["id"] == "official_party15")

    # RH-20261022-0063 (2026-10-22): quick mode, 8 adults + 2 kids -> 11 + 1.
    quick_8_2 = invoice(adults=8, kids=2, proteins=prot(chicken=(8, 2), steak=(8, 2)),
                        extras=[{"id": "tables_chairs", "qty": 10}, {"id": "utensils", "qty": 10}])
    args = ["--headcount", "11/1", "--proteins", "chicken=11/1", "steak=11/1", "--add-extra", "tables_chairs=12", "utensils=12"]
    r = Run(quick_8_2, *args, "--dry")
    check("--headcount 11/1 on a quick-mode order: counts set, official_party10 added, TOTAL $838.80 = desk price, --dry saves nothing",
          r.exit is None and r.saved is None and r.has("adultCount/childCount: 8/2 -> 11/1", "none -> official_party10 $30.00",
                                                       "✓ total check: TOTAL $838.80", "DRY   not saved"), r)
    r = Run(quick_8_2, *args)
    d = r.data
    check("  saved: 11/1, the menu, tables/utensils for 12, and exactly the official party10 line",
          d.get("adultCount") == 11 and d.get("childCount") == 1 and d.get("mode") == "quick" and d.get("promotions") == [PARTY[10]]
          and {q["itemId"]: (q["qty"], q.get("childQty")) for q in d.get("quickCountItems") or []} == {"chicken": (11, 1), "steak": (11, 1)}
          and {e["id"]: e["qty"] for e in d.get("partyExtras") or []} == {"tables_chairs": 12, "utensils": 12}
          and r.saved.get("baseVersion") == "v-selfcheck", r)
    r = Run(quick_8_2, "--headcount", "11/1", "--dry")
    check("--headcount alone says the menu and the per-guest setup still count the old party",
          r.has("the menu is still chicken=8/2 steak=8/2", "pass --proteins", "tables_chairs is still billed for 10 guests, the party is now 12"), r)
    r = Run(quick_8_2, "--add-adult", "1", "--dry")
    check("--add-adult on a quick-mode order points at --headcount (not --proteins)",
          "--headcount ADULTS/KIDS" in str(r.exit) and r.saved is None, r)
    r = Run(invoice(mode="detailed", adults=5, guests=rows(5)), "--headcount", "6/0", "--dry")
    check("--headcount refuses an order with guest rows", "guest rows" in str(r.exit), r)
    r = Run(invoice(mode="detailed", adults=5), "--headcount", "6/0")
    check("--headcount works on a fresh order (detailed, no rows yet)", r.data.get("adultCount") == 6 and r.data.get("mode") == "detailed", r)

    # The stored order after the 10-22 rewrite, before the tier was added by hand.
    rewritten = invoice(mode="detailed", adults=11, kids=1, guests=rows(11, 1, setup=True))
    r = Run(rewritten, "--time", "18:30", "--dry")
    check("a stored order missing its tier: TOTAL CHECK FAILED, $868.80 vs desk price $838.80, $30.00 too much, fix named",
          r.has("TOTAL CHECK FAILED", "$868.80", "$838.80", "$30.00 too much", "party size: order no line; desk price -$30.00 for 11 paying heads",
                "likely fix: --retier (puts official_party10 $30.00 on for 11 paying heads)"), r)
    r = Run(rewritten, "--retier")
    check("  --retier on it: official_party10 added, nothing else, ✓ $838.80",
          r.data.get("promotions") == [PARTY[10]] and r.data.get("guests") == rewritten["guests"] and r.has("✓ total check: TOTAL $838.80"), r)
    r = Run(invoice(mode="detailed", adults=11, kids=1, guests=rows(11, 1, setup=True), promos=[PARTY[10]]), "--time", "18:30", "--dry")
    check("  the same order with official_party10: ✓", r.has("✓ total check: TOTAL $838.80") and "TOTAL CHECK FAILED" not in r.out, r)
    r = Run(invoice(mode="detailed", adults=11, kids=1, guests=rows(11, 1, setup=True), promos=[PARTY[15]]), "--retier", "--dry")
    check("  --retier on a wrong tier (official_party15 for 11 heads) replaces it",
          r.has("official_party15 $60.00 -> official_party10 $30.00", "✓ total check: TOTAL $838.80"), r)
    r = Run(invoice(mode="detailed", adults=11, kids=1, guests=rows(11, 1, setup=True), promos=[PARTY[10]]), "--retier", "--dry")
    check("  --retier when the line is right: says so, nothing to change", r.has("is already right") and "nothing to change" in str(r.exit), r)

    # Re-tier on rows: --remove-guest / --add-adult / --guests-file. Only the party line moves, in place.
    courtesy = {"id": "courtesy_1", "label": "Courtesy credit", "amount": 10.0}
    fifteen = invoice(mode="detailed", adults=15, guests=rows(15), extras=[{"id": "gyoza", "qty": 1}], promos=[FREE_GYOZA, PARTY[15], courtesy])
    r = Run(fifteen, "--remove-guest", "Guest 15")
    check("--remove-guest 15 -> 14: official_party15 $60 becomes official_party10 $30 in place, the other lines untouched, ✓",
          r.data.get("promotions") == [FREE_GYOZA, PARTY[10], courtesy]
          and r.has("official_party15 $60.00 -> official_party10 $30.00", "✓ total check: TOTAL $798.60"), r)
    r = Run(invoice(mode="detailed", adults=14, guests=rows(14), promos=[PARTY[10]]), "--add-adult", "1")
    check("--add-adult 14 -> 15: official_party10 becomes official_party15", r.data.get("promotions") == [PARTY[15]] and r.data.get("adultCount") == 15, r)
    with tempfile.TemporaryDirectory() as tmp:
        f = pathlib.Path(tmp) / "rows.json"
        f.write_text(json.dumps([{"name": f"G{i}", "proteins": ["chicken", "steak"], "tables": True, "utensils": True} for i in range(16)]),
                     encoding="utf-8")
        r = Run(quick_8_2, "--guests-file", str(f))
    check("--guests-file 16 adults on an 8+2 order: official_party15 $60 added, rows carry the setup, ✓ $1,138.40",
          r.data.get("promotions") == [PARTY[15]] and r.data.get("mode") == "detailed" and not r.data.get("partyExtras")
          and r.has("✓ total check: TOTAL $1,138.40"), r)

    # The edges of the ladder.
    r = Run(invoice(adults=10, proteins=prot(chicken=(10, 0), steak=(10, 0)), promos=[PARTY[10]]), "--headcount", "9/0")
    check("under 10 paying heads: the party line comes off, and the $599 minimum check still matches",
          r.data.get("promotions") == [] and r.has("official_party10 $30.00 -> none (under 10)", "✓ total check: TOTAL $599.00", "minimum"), r)
    r = Run(invoice(adults=50, promos=[PARTY[41]]), "--headcount", "61/0")
    check("61+ is a custom quote: line left as it is, said so, check skipped",
          r.data.get("promotions") == [PARTY[41]] and r.has("custom quote (61+)", "(total check skipped"), r)

    # Appreciation stands in for the tier (leads skill: they do not stack unless the owner says so).
    teacher = {"id": "appreciation_teacher", "label": "Teacher Appreciation: $50 off", "amount": 50.0}
    r = Run(invoice(adults=9, promos=[teacher]), "--headcount", "12/0")
    check("appreciation on the order: no party line added, said why, ✓ with the stand-in noted",
          r.data.get("promotions") == [teacher] and r.has("not added - appreciation_teacher", "✓ total check: TOTAL $668.80", "stands in"), r)
    r = Run(invoice(adults=12, promos=[PARTY[10]]), "--remove-promo", "official_party10", "--add-promo", "appreciation_teacher=50",
            "--promo-label", "Teacher Appreciation: $50 off", "--headcount", "13/0", "--dry")
    check("--remove-promo official_party10 in the same command: not put back",
          r.has("not put back", "✓ total check: TOTAL $728.70") and "-> official_party10" not in r.out, r)

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
        r = Run(quick_8_2, "--guests-file", guests_file(tmp, 12, 1, 1))
        mia = next((g for g in r.data.get("guests") or [] if g.get("name") == "Mia0"), {})
        check("--guests-file with a little: true row: a child row with no proteins, the Little kids ×1 line added, ✓ $718.70",
              mia.get("isChild") is True and mia.get("isLittle") is True and mia.get("proteins") == [] and r.data.get("childCount") == 2
              and r.data.get("promotions") == [LITTLE_LINE, PARTY[10]]
              and r.has("little kids: none -> Little kids (3-4) @ $0 ×1 $29.90", "✓ total check: TOTAL $718.70"), r)
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

    send_checks()

    print()
    if FAILS:
        print(f"{len(FAILS)} FAILED")
        return 1
    print("all passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
