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
  - desk order summary (owner 2026-11-20): the party-day text from orders shaped
    like 11/21's (host has everything, full rental + free gyoza, kids under 5,
    an arrival in the notes, nothing owed), clean by the voice check; --send
    texts it, emails a number that cannot take a text, notes [SOP:day_summary],
    and does not send 00:00-07:00, on another day, twice, to an Airbnb party,
    or over a question of theirs
"""
from __future__ import annotations

import contextlib
import copy
import datetime
import io
import json
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile

import _api
import desk
import party_check


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
                 created_at: str | None = None, db=None, review: tuple | None = None, echo: bool = False):
        self.prefill, self.saved, self.priced = prefill, None, []
        # echo: a lookup after the save answers with what was saved (an invoice app that keeps every field sent);
        # without it the lookup keeps answering the order as it was loaded.
        self.echo = echo
        # 审查者 gate (2026-11-12): the remind / send-sheet cases below are about the text, so the order reads as
        # reviewed unless a case passes `review` - its own (fresh, why) - to test the gate itself.
        self.review = review or (True, "selfcheck: reviewed")
        self.reply, self.lint, self.texted = reply or {}, lint, None
        self.created_at = created_at
        self.db = db
        desk._search = self.search
        desk.invoice_post = self.invoice_post
        desk.site_get = self.site_get
        desk.site_post = self.site_post
        desk._supabase = self.supabase
        kept_gate = desk._review_gate
        desk._review_gate = self.review_gate
        buf = io.StringIO()
        self.exit = None
        with contextlib.redirect_stdout(buf):
            try:
                desk.main(["order", op, ORDER_NO, *args])
            except SystemExit as e:
                self.exit = e.code
            finally:
                desk._review_gate = kept_gate
        self.out = buf.getvalue()

    def review_gate(self, order_no, a, what):
        fresh, why = self.review
        print(f"审查  {'✓' if fresh else '✗'} {why}")
        if fresh or getattr(a, "skip_review", False):
            return True, why
        return False, f"{what}没发：{why}。先审查（/order-review {order_no}），过了再发"

    def search(self, text):
        row = {"order_no": ORDER_NO, "id": "00000000-0000-4000-8000-000000000001", **({"created_at": self.created_at} if self.created_at else {})}
        return [{"name": "Self Check", "email": "selfcheck@example.com", "phone": "+15555550100", "orders": [row]}]

    def supabase(self, method, path, data, content_type):
        # order show's party check reads the database directly; without a test's db there is none (no gaps of its own).
        if method != "GET" or self.db is None:
            raise RuntimeError(f"selfcheck: no database here ({method} {path})")
        return copy.deepcopy(self.db(path))

    def invoice_post(self, path, payload, timeout=120):
        if path == "/api/self-service/orders/lookup":
            prefill = (self.saved or {}).get("invoiceData") if self.echo and self.saved else self.prefill
            return {"found": True, "order": {"orderNo": ORDER_NO, "updatedAt": "2030-01-01T00:00:00Z", "version": "v-selfcheck"},
                    "prefill": copy.deepcopy(prefill)}
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


# Paid heads the dispatch rule is checked at against lib/dispatch-plan.ts ruleChefs: none, the edges of one, two and
# three chefs, past the cap.
RULE_HEADS = [0, 1, 27.5, 28, 28.5, 56, 56.5, 84.5, 500]


def rules_match_the_ts_export() -> None:
    npx = shutil.which("npx")
    if not npx:
        print("SKIP  tiers vs the TS export: no npx on PATH")
        return
    root = desk.ROOT
    with tempfile.TemporaryDirectory() as tmp:
        script = pathlib.Path(tmp) / "tiers.ts"
        script.write_text(f"import {{ CLOSED_PARTY_LADDER as t, PARTY_SIZE_CUSTOM_FROM as c, KID_TIER_WEIGHT as w, PARTY_LADDER_CLOSED_AT as at, GUESTS_PER_CHEF as g }} "
                          f"from '{(root / 'config' / 'pricing-rules').as_posix()}'\n"
                          f"import {{ ruleChefs, MAX_CHEFS as mx }} from '{(root / 'lib' / 'dispatch-plan').as_posix()}'\n"
                          f"console.log(JSON.stringify({{ t, c, w, at: Date.parse(at), g, mx, rule: {json.dumps(RULE_HEADS)}.map((h) => ruleChefs(h)) }}))\n",
                          encoding="utf-8")
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
    mine = (party_check.guests_per_chef(), party_check.MAX_CHEFS, [party_check.rule_chefs(h) for h in RULE_HEADS])
    check("dispatch rule: desk's GUESTS_PER_CHEF, MAX_CHEFS and chefs by paid heads equal lib/dispatch-plan.ts (what the sheet prints for a rule plan)",
          mine == (ts["g"], ts["mx"], ts["rule"]), detail=f"desk {mine} / TS {(ts['g'], ts['mx'], ts['rule'])}")


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


# ------------------------------------------- desk email over an unread email (2026-11-19) --
# Sylvia Cantu, 11-19: she confirmed the count at 10:59:54 and sent her street address at 11:01:05. Our "the one
# thing I still need is the street address" went at 11:01:56 - and her email was only filed at 11:02:08, because
# the customer's emails reach the lead once a minute. So `desk email` stops over what is filed, and in a live
# exchange waits one filing round and reads again.
MAIL_TO = "selfcheck@example.com"


def mail(direction: str, when: str, snippet: str, at: str | None = None) -> dict:
    """One email as the desk card lists it (`when` on the Pacific clock; `at` overrides the stamp as the API would write it)."""
    return {"direction": direction, "at": at or wall(when).strftime("%Y-%m-%dT%H:%M:%S+00:00"), "subject": "Re: your date is locked",
            "snippet": snippet, "from": MAIL_TO if direction == "inbound" else "support@realhibachi.com"}


SYLVIA = [
    mail("inbound", "2026-11-19 10:56:34", "Need to change to 30 people"),
    mail("outbound", "2026-11-19 10:58:47", "Your party is now set for 30 guests. Could you also send me the street address?"),
    mail("inbound", "2026-11-19 10:59:54", "Yes is right."),
]
SYLVIA_ADDRESS = mail("inbound", "2026-11-19 11:01:05", "83191 Long Cove Dr Indio, Ca 92203")


class MailRun:
    """One `desk email --lead` at the second `at`: `cards` are the lead's emails as each read of the card finds them
    (the last one repeats). Its output, exit, what it posted (None = nothing sent), how long it waited."""

    def __init__(self, cards: list[list[dict]], *args: str, at: str):
        self.cards, self.card_reads, self.posted, self.slept = cards, 0, None, []
        kept = desk.site_get, desk.site_post, desk._now, desk._sleep
        desk.site_get, desk.site_post, desk._now, desk._sleep = self.site_get, self.site_post, lambda: wall(at), self.slept.append
        buf = io.StringIO()
        self.exit = None
        try:
            with contextlib.redirect_stdout(buf):
                try:
                    desk.main(["email", MAIL_TO, "You're very welcome.", "--subject", "Re: your date is locked", "--lead", LEAD_ID, *args])
                except SystemExit as e:
                    self.exit = e.code
        finally:
            desk.site_get, desk.site_post, desk._now, desk._sleep = kept
        self.out = buf.getvalue()

    def site_get(self, path, params=None, admin=True, timeout=90):
        if path != "/api/admin/desk":
            raise RuntimeError(f"selfcheck: unexpected site read {path} {params}")
        emails = self.cards[min(self.card_reads, len(self.cards) - 1)]
        self.card_reads += 1
        return {"ok": True, "cards": [{"lead": {"id": LEAD_ID, "email": MAIL_TO}, "emails": copy.deepcopy(emails)}]}

    def site_post(self, path, payload, method="POST", timeout=90):
        if path != "/api/admin/send-followup":
            raise RuntimeError(f"selfcheck: unexpected site write {path}")
        self.posted = payload
        return {"ok": True, "id": "selfcheck", "provider": "resend", "cc": [], "attachments": []}

    @property
    def stopped(self) -> bool:
        return self.exit == 2 and self.posted is None and "UNREAD" in self.out

    @property
    def sent(self) -> bool:
        return self.exit is None and self.posted is not None and "OK    emailed" in self.out

    def has(self, *parts: str) -> bool:
        return all(p in self.out for p in parts)


def email_checks() -> None:
    seen_count = ("--seen", "2026-11-19T10:59:54-08:00")
    r = MailRun([SYLVIA, SYLVIA + [SYLVIA_ADDRESS]], *seen_count, at="2026-11-19 11:01:56")
    check("email: Sylvia's address was sent 51 s before our 'still need the address' and not filed yet: waits one filing round, reads again, stopped (exit 2, nothing sent)",
          r.stopped and r.slept == [desk.EMAIL_FILING_WAIT_S] and r.card_reads == 2
          and r.has("等的这一会儿客人又来了 1 封", "11:01:05", "83191 Long Cove Dr", "--seen 2026-11-19T11:01:05-08:00"), r)
    r = MailRun([SYLVIA], *seen_count, at="2026-11-19 11:01:56")
    check("  nothing new after the wait: sent", r.sent and r.slept == [desk.EMAIL_FILING_WAIT_S] and r.posted.get("leadId") == LEAD_ID, r)
    r = MailRun([SYLVIA + [SYLVIA_ADDRESS]], *seen_count, at="2026-11-19 11:02:30")
    check("  her address already filed, --seen names the email before it: stopped at once, no wait",
          r.stopped and r.slept == [] and r.has("之后又来了 1 封", "83191 Long Cove Dr"), r)
    r = MailRun([SYLVIA + [SYLVIA_ADDRESS]], at="2026-11-19 11:01:40")
    check("  no --seen, her email 35 s old: stopped as fresh", r.stopped and r.slept == [] and r.has("35 秒前刚来了一封邮件"), r)
    r = MailRun([SYLVIA], "--seen", "2026-11-19T10:59:54-08:00", at="2026-11-19 14:00:00")
    check("  three hours on, the exchange is not live: sent with no wait", r.sent and r.slept == [], r)
    r = MailRun([SYLVIA], at="2026-11-22 09:00:00")
    check("  no --seen on a quiet thread: sent with no wait", r.sent and r.slept == [], r)
    r = MailRun([SYLVIA], "--seen", "2026-11-19T11:30:00-08:00", at="2026-11-19 14:00:00")
    check("  a --seen that names none of her emails: stopped, her last one printed", r.stopped and r.has("对不上客人的任何一封邮件", "Yes is right."), r)
    # Postgres trims trailing zeros off the fraction; Python 3.10 reads only 0, 3 or 6 digits.
    trimmed = mail("inbound", "", "Thank you!", at="2026-11-19T19:07:07.76433+00:00")
    r = MailRun([SYLVIA + [trimmed]], *seen_count, at="2026-11-19 11:20:00")
    check("  an email stamped .76433 (five fraction digits) still counts as hers: stopped", r.stopped and r.has("11:07:07", "Thank you!"), r)
    check("  pt / _at read a trimmed fraction", desk.pt("2026-11-19T19:06:02.7+00:00", True) == "11-19 11:06:02"
          and desk._at("2026-11-19T19:06:02.76433+00:00") == wall("2026-11-19 11:06:02") + datetime.timedelta(microseconds=764330))
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        desk.render_card({"phone": PROM_PHONE, "emails": SYLVIA + [SYLVIA_ADDRESS]})
    check("card: the --seen for an email reply under the emails, to the second of her last one",
          "   回邮件带 --seen 2026-11-19T11:01:05-08:00（客人最后一封 11-19 11:01:05）" in buf.getvalue(), detail=buf.getvalue())
    r = MailRun([SYLVIA], "--seen", "nonsense", at="2026-11-19 11:01:56")
    check("  a --seen desk cannot read is refused before anything is read", r.exit not in (None, 0) and r.posted is None and r.card_reads == 0, r)


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
    `posts` answers a write (None: any write fails the run); `staff` is the staff list's numbers.
    `db` answers a direct database read (desk._supabase GET), by path; a write there fails the run."""

    def __init__(self, argv: list[str], gets: dict | None = None, posts=None, staff: tuple[str, ...] = (), db=None):
        self.gets, self.posts, self.staff, self.db = gets or {}, posts, staff, db
        self.posted: list[tuple[str, dict, str]] = []
        self.reads: list[str] = []
        self.db_reads: list[str] = []
        kept = desk.site_get, desk.site_post, desk._search, desk._supabase
        desk.site_get, desk.site_post, desk._search, desk._supabase = self.site_get, self.site_post, self.search, self.supabase
        buf = io.StringIO()
        self.exit = None
        try:
            with contextlib.redirect_stdout(buf):
                try:
                    desk.main(argv)
                except SystemExit as e:
                    self.exit = e.code
        finally:
            desk.site_get, desk.site_post, desk._search, desk._supabase = kept
        self.out = buf.getvalue()

    def supabase(self, method, path, data, content_type):
        if method != "GET" or self.db is None:
            raise RuntimeError(f"selfcheck: unexpected database {method} {path}")
        self.db_reads.append(path)
        return copy.deepcopy(self.db(path))

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


# ---------------------------------------------------------------- 派对当天核对 (D-1112-01) --
# The real parties of 11-11/11-12 as they stood before they were fixed by hand (phones, addresses and long
# notes trimmed to what matters), and the same parties as they stand now: every gap is found in the first,
# none in the second. Hosts who bring their own setup are never a setup gap.

def fake_db(tables: dict):
    """desk's direct database reads against rows in memory: in.() and eq. filters, the rest of the query ignored."""
    def get(path: str):
        table, _, query = path.partition("?")
        rows = list(tables.get(table.rsplit("/", 1)[-1], []))
        for part in query.split("&"):
            col, _, cond = part.partition("=")
            if col in ("select", "order", "limit") or not cond:
                continue
            if cond.startswith("in.("):
                vals = set(cond[4:-1].split(","))
                rows = [r for r in rows if str(r.get(col)) in vals]
            elif cond.startswith("eq."):
                rows = [r for r in rows if str(r.get(col)) == cond[3:]]
        return rows
    return get


def pc_guest(name: str, *proteins: str, allergy: str = "", tc: bool = False, ut: bool = False, note: str = "", child: bool = False) -> dict:
    return {"name": name, "proteins": list(proteins), "foodAllergy": allergy, "tablesChairs": tc, "utensils": ut, "note": note, "isChild": child}


def pc_party(order_no: str, start: str, *, name: str, notes: str = "", internal=None, prep_note=None, setup=None, deal=None, guests=None,
             extras=None, mode: str = "detailed", customer_notes=None, lead_notes=(), requests=(), sms=(), sheet_notes=(), chef_sms=(),
             team=(), links=(), notices=(), address: str = "1 Test Way, Palm Springs, CA 92262") -> dict:
    inv = {"mode": mode, "contactInfo": {"specialNotes": notes}, "guests": list(guests or []), "partyExtras": list(extras or [])}
    if deal is not None:
        inv["customDeal"] = deal
    if customer_notes is not None:
        inv["customerNotes"] = customer_notes
    order = {"id": f"id-{order_no}", "order_no": order_no, "customer_name": name, "customer_phone": "+15555550188", "event_start": start,
             "event_address": address, "order_status": "active", "internal_notes": internal, "prep_note": prep_note, "setup_selection": setup,
             "source_metadata": {}, "invoice_data": inv}
    return {"order": order, "prep": None, "team": list(team), "links": list(links), "notices": list(notices),
            "lead_notes": [{"at": a, "note": n} for a, n in lead_notes], "requests": [{"at": a, "message": m} for a, m in requests],
            "customer_sms": [{"at": a, "direction": d, "body": b} for a, d, b in sms],
            "sheet_notes": [{"at": a, "note": n, "chef": c} for a, n, c in sheet_notes],
            "chef_sms": [{"at": a, "body": b, "chef": c} for a, b, c in chef_sms]}


def pc_kinds(party: dict) -> list[tuple[str, str]]:
    return [(g["severity"], g["kind"]) for g in party_check.gaps_of(party)]


GEORGE_INTERNAL = ("[call] 10-04 10:47 老板接 George 来电 25 分钟 + 当场短信备忘：Fri 11/13 8PM，40 大人，两种蛋白，春卷 4 盘免费（一人一个），"
                   "多带炒饭、带 sriracha，牛排 35 / 鸡 30 / 虾 15。两个师傅两个烤台，7:00–7:30 到场；场地要平地（草地也行）。"
                   "客人有对虾过敏的，海鲜最后做。牛排是 top sirloin，虾每份 5 只大虾。桌椅餐具客人自己准备。尾款活动后付，客人选现金。")
GEORGE_NOTES_BEFORE = ("Tables, chairs, plates and silverware provided by the host. Two chefs, two grills. Spring rolls for everyone (4 trays), "
                       "extra fried rice and sriracha on us. Steak is top sirloin; 5 large shrimp per serving.")
GEORGE_NOTES_NOW = ("Tables, chairs, plates and silverware provided by the host. Two chefs, two grills. Spring rolls for everyone (4 trays), "
                    "extra fried rice and sriracha on us. Chefs arrive 7:00-7:30 PM to set up; the grills go on flat ground (grass is fine). "
                    "One guest is allergic to shrimp: cook all seafood last. Steak is top sirloin; 5 large shrimp per serving.")
GEORGE_PREP_NOW = "两位师傅、两台灶，7:00–7:30 到场，烤炉放平地（草地可以）。有客人对虾过敏：海鲜最后做。多带炒饭，带 sriracha。客人自备桌椅餐具。付现金。"


def george(notes: str, prep_note=None) -> dict:  # RH-20261004-3574, 11/13 Corona
    return pc_party("RH-20261004-3574", "2026-11-13T20:00:00+00:00", name="George Test", notes=notes, internal=GEORGE_INTERNAL, prep_note=prep_note,
                    mode="quick", extras=[{"id": "spring_rolls", "qty": 4}], deal={"flatOff": 60, "freeExtraIds": ["spring_rolls"]},
                    lead_notes=[("2026-10-04T17:53:00Z", "[承诺] extra fried rice")], address="1 Test Way, Corona, CA 92882")


ANDREA_INTERNAL = ("[10-09 owner] Tables/chairs/linens + place settings for 8 are FREE (owner option A, 09-29: she covers the $599 minimum; total "
                   "stays $639.40). Theme Gold Rim black-on-black was OUR pick, not hers - owner 10-09: bring the black-gold set as a surprise.\n"
                   "10-17 老板：已经答应过的不受 D-1017-01 影响。09-29 答应桌椅+餐具全送（卡在 $599 最低消费里）。")
ANDREA_SETUP = {"pkg": "full", "cloth": "black", "guests": 8, "source": "rentals_page", "themeId": "goldrim", "chosenAt": "2026-09-29T22:07:18.989Z",
                "variantId": "black-on-black"}
ANDREA_NOTES_NOW = ("Tables, chairs, black linens and place settings for 8 are included at no charge. Ready to start at 6:30: the chef arrives "
                    "about 5:30 PM to set up. To get in the gate to the driveway, call Andrea at 555-555-0123.")
ANDREA_PREP_NOW = "带 8 位全套：桌子、8 把椅子、黑桌布、8 套金边黑盘餐具（送的）。5:30 到场摆台，6:30 准时开始。到门口打 555-555-0123 请 Andrea 开大门进车道。"


def andrea(fixed: bool) -> dict:  # RH-20260929-2057, 11/12 Palm Springs
    names = ["Tim", "Andrea", "Chris", "Katie", "Tracy", "Maureen", "Shaun", "Raj"]
    return pc_party("RH-20260929-2057", "2026-11-12T18:30:00+00:00", name="Andrea Test", notes=ANDREA_NOTES_NOW if fixed else "",
                    internal=ANDREA_INTERNAL, prep_note=ANDREA_PREP_NOW if fixed else None, setup=ANDREA_SETUP,
                    deal={"freeExtraIds": ["tables_chairs", "utensils"]}, extras=[{"id": "gyoza", "qty": 2}],
                    guests=[pc_guest(n, "steak", "shrimp", tc=fixed, ut=fixed) for n in names],
                    requests=[("2026-10-20T18:28:00Z", "Call Andrea to get in the gate to the driveway at 555-555-0123\n\nSubmitted from the party planner: 8 adults.")],
                    lead_notes=[("2026-09-29T20:23:00Z", "[data] 09-29 13:15 she came back on her own and asked to confirm: Thu 2026-11-12, 8 people, 6:30 - and "
                                                         "specifically that the team arrive early enough to be READY at 6:30, which is already how we work.")],
                    sheet_notes=[("2026-11-11T18:08:00Z", "老板今早把这场改派给你（原来是 Gary）。Palm Springs 8 位，6:30 开始，订了桌椅，5:30 左右到摆台。"
                                                          "8 位的桌椅、黑桌布、餐具都是送的，不收钱。老板交代：带黑金那套餐具（Gold Rim），给客人一个惊喜。客人付现金。", "JASON")])


def corrina(fixed: bool) -> dict:  # RH-20260930-3990, 11/12 Los Angeles
    guests = [pc_guest("Karen", "steak", "shrimp", allergy="No mushrooms")] + [pc_guest(f"Guest {i}", "steak", "salmon") for i in range(1, 18)]
    return pc_party("RH-20260930-3990", "2026-11-12T19:00:00+00:00", name="Corrina Test", guests=guests, extras=[{"id": "gyoza", "qty": 1.8}],
                    notes=("Wedding after-party dinner. Dinner is for 18; two more friends will stop by to watch and won't eat (they'll sit a little "
                           "away from the table).") if fixed else "",
                    prep_note="婚礼后的晚宴。做 18 位；另有 2 位朋友只看不吃，会坐远一点。Karen 不要蘑菇。送饺子 18 个。付现金。" if fixed else None,
                    requests=[("2026-11-11T03:37:00Z", "⏰ WITHIN 48H OF EVENT — customer requests this change, needs staff confirmation before it takes effect.\n\n"
                                                       "It's their wedding after party dinner\n\nSubmitted from the party planner: 18 adults.")],
                    lead_notes=[("2026-11-12T03:30:00Z", "[data] 11-11 19:28 问'有两位因为上班不能全程、不吃饭，只看行不行' → 19:3x 回：可以看；问这两位是不是在 18 人名单里。"),
                                ("2026-11-12T03:33:00Z", "[data] 11-11 19:30–19:31 她说那两位是 18 位之外的，会让他们坐远一点 → 回可以，订单不动（18 位）。"
                                                         "19:3x 已短信告诉 Blu：吃饭 18 位，另有 2 位只看不吃。")],
                    sheet_notes=[("2026-11-11T03:33:00Z", "菜单今晚刚填齐：18 位都是大人。Karen 不吃蘑菇，她那份别放蘑菇。送的前菜是饺子 18 个。客人付现金。", "Blu")],
                    address="1 Test Way, Los Angeles, CA 90068")


JEFFREY_NOTES = ("NO BUTTER: cook everything with oil (the host asked, no butter for anyone). 11 adults + 1 toddler (2, free, rice and veggies). "
                 "10 chairs: the toddler uses a high chair and one adult a wheelchair (they bring both), so leave room for them at the tables. "
                 "Alon: double salmon (his only pick). Chef arrives at 4 PM to set up; the party starts at 5. | 1 kid aged 3-4 (free)")


def jeffrey(fixed: bool) -> dict:  # RH-20261107-5825, 11/14 Valencia
    guests = [pc_guest(n, "steak", "chicken", tc=True, ut=True) for n in ("Adi", "Tal", "Ari", "Karen", "Lisa", "Arielle", "Eric", "Jeff", "Laura")]
    guests += [pc_guest("Dov", "steak", "salmon", tc=True, ut=True), pc_guest("Alon", *(["salmon", "salmon"] if fixed else ["salmon"]), tc=True, ut=True),
               pc_guest("Dove", "steak", ut=True, note="3-4 yrs (free)", child=True)]
    return pc_party("RH-20261107-5825", "2026-11-14T17:00:00+00:00", name="Jeffrey Test", guests=guests, extras=[{"id": "gyoza", "qty": 1.2}],
                    notes=("Dov's birthday. " if fixed else "") + JEFFREY_NOTES,
                    deal={"note": "Plates and utensils on us (owner, call 11-07); tables and chairs at $10 a guest", "freeExtraIds": ["utensils"]},
                    requests=[("2026-11-09T12:40:00Z", "Birthday for Dov!\n\nSubmitted from the party planner: 11 adults, 1 kid.")],
                    lead_notes=[("2026-11-07T21:49:00Z", "【来电小结】客户问派对，15成人1童，已说明套餐及蛋白选择，桌椅餐具另收费；客户回电或在线办理"),
                                ("2026-11-07T22:46:00Z", "[promised] 11-07 14:37 第二通电话：桌椅桌布 $10/人照收、餐具免；**KOSHER MEAT：有犹太洁食客人，按市价买 kosher 肉，"
                                                         "kosher 那份先做**；**用油不用黄油**（客人要求换油，老板同意）。"),
                                ("2026-11-07T22:47:00Z", "[data] 11-07 14:47 Jeff 更新：只有 11 人；**不需要 kosher 肉了**；**不能用黄油** → 回：11 位、不要 kosher、全部用油。"),
                                ("2026-11-09T19:16:00Z", "[data] 11-09 11:15 'Alon would like double salmon, the app wouldn't let me select double portion' → "
                                                         "订单备注加 'Alon: double salmon (his only pick)' + 回一句确认。")],
                    address="1 Test Way, Valencia, CA 91354")


def verlener(fixed: bool) -> dict:  # RH-20261111-9315, 11/12 Corona
    guests = [pc_guest(n, "steak", "shrimp") for n in ("Demarii", "Meelah", "Vee", "Michael", "Zoey", "Onie")]
    return pc_party("RH-20261111-9315", "2026-11-12T19:00:00+00:00", name="Verlener Test", guests=guests, notes="Birthday party." if fixed else "",
                    extras=[{"id": "spring_rolls", "qty": 1.6}, {"id": "diy_rice_shrimp", "qty": 2}],
                    lead_notes=[("2026-11-09T18:27:00Z", "[occasion] birthday · [SOP:deposit_ask] 11-09 10:2x 模板 I（生日快乐 + 牛肉/自制酱）+ 自动报价链接")],
                    sheet_notes=[("2026-11-11T18:07:00Z", "老板今早改派给你。生日派对，16 位：12 大 2 小 + 2 个 3-4 岁免费（按规矩不带蛋白、多给炒饭蔬菜）。"
                                                          "炒饭加料虾 2 份、鸡 2 份是客人另加的。客人付现金。", "Gary")],
                    address="1 Test Way, Corona, CA 92879")


def kande(fixed: bool) -> dict:  # RH-20260921-9601, 12/05 San Diego
    internal = ("Deal (owner, 9/20): $50/head for 60+ guests, menu chicken + beef; guests who skip meat get salmon + tofu; tables, chairs and utensils free; "
                "3 chefs; wedding after-party (Kande + fiance Elvis). Start time and exact address TBD (18:00 is a placeholder).")
    notes = ("Wedding reception for Kande and Elvis at the Catalina Room. Chefs arrive around 5:00 PM, cook right outside on 3 grills; dinner around 6:00. "
             "Tables: the venue's round tables, set up by the couple. We bring white plates and gold flatware for 64, plus 2-3 long folding tables "
             "with black tablecloths as backup. No cups.") if fixed else "Wedding reception for Kande and Elvis at the Catalina Room. Chefs arrive around 5:00 PM."
    prep = "3 位师傅 3 台灶，5 点到，在门外平地做。带 64 套白盘金餐具，另带 2–3 张长折叠桌和黑桌布备用。用场地的圆桌，新人自己布置。" if fixed else None
    return pc_party("RH-20260921-9601", "2026-12-05T18:00:00+00:00", name="Kande Test", mode="quick", internal=internal, notes=notes, prep_note=prep,
                    deal={"note": "agreed 9/20", "adultRate": 50, "onlyAgreed": True, **({"freeExtraIds": ["utensils"]} if fixed else {})},
                    extras=[{"id": "utensils", "qty": 64}] if fixed else [], address="1 Test Way, San Diego, CA 92109")


def party_check_checks() -> None:
    g = party_check.gaps_of(george(GEORGE_NOTES_BEFORE))
    check("party check · George (RH-20261004-3574) before: the shrimp allergy / seafood-last only in internal notes blocks; arrival 7:00-7:30 and the flat ground warn",
          [(x["severity"], x["kind"]) for x in g] == [("block", "allergy"), ("warn", "arrival"), ("warn", "site")]
          and "海鲜最后做" in g[0]["evidence"][0]["text"] and g[0]["evidence"][0]["label"] == "内部备注"
          and g[2]["title"] == "场地（平地）：订单备注里没有")
    check("  host brings tables, chairs and tableware: no setup gap; extra rice and sriracha are in the notes: no bring gap",
          not any(x["kind"] in ("setup",) or x["kind"].startswith("bring") for x in g))
    check("  George now (notes and 备货备注 fixed 11-12): nothing", pc_kinds(george(GEORGE_NOTES_NOW, GEORGE_PREP_NOW)) == [])

    g = party_check.gaps_of(andrea(False))
    check("party check · Andrea (RH-20260929-2057) before: free tables, linens, place settings in notes + setup_selection + the deal, 0 on the invoice: blocking",
          g and g[0]["severity"] == "block" and g[0]["kind"] == "setup" and g[0]["title"] == "答应的桌椅、桌布、餐具，发票上一件都没有：备货清单不装车"
          and {e["label"] for e in g[0]["evidence"]} >= {"租赁页选了 09-29", "优惠约定", "内部备注"})
    check("  the gate call only on the party page, and the 5:30 / ready-by-6:30 arrival, warn",
          ("warn", "gate") in [(x["severity"], x["kind"]) for x in g] and ("warn", "arrival") in [(x["severity"], x["kind"]) for x in g]
          and next(x for x in g if x["kind"] == "gate")["evidence"][0]["label"] == "派对页留言 10-20")
    check("  Andrea now (rows ticked, notes and 备货备注 written): nothing", pc_kinds(andrea(True)) == [])

    check("party check · Corrina (RH-20260930-3990) before: the wedding after-party (party page) and 2 spectators (texts, notes) warn; Karen's mushrooms are on her row",
          pc_kinds(corrina(False)) == [("warn", "occasion:wedding"), ("warn", "spectators")])
    check("  Corrina now: nothing", pc_kinds(corrina(True)) == [])

    g = party_check.gaps_of(jeffrey(False))
    check("party check · Jeffrey (RH-20261107-5825) before: Dov's birthday (party page) warns, Alon's double salmon on a single-salmon row warns",
          [(x["severity"], x["kind"]) for x in g] == [("warn", "occasion:birthday"), ("warn", "double")] and g[1]["title"].startswith("Alon 要双份 salmon"))
    check("  the kosher 'cook first' was taken back (不需要 kosher 肉了), no butter is in the notes, tables at $10 a guest is no promise: none of them is a gap",
          not any(x["kind"] in ("allergy", "setup") or x["kind"].startswith("diet") for x in g))
    check("  Jeffrey now (Alon two salmon, birthday in the notes): nothing - Dov's birthday next to Alon's double is not Dov's double",
          pc_kinds(jeffrey(True)) == [])

    check("party check · Verlener (RH-20261111-9315) before: [occasion] birthday only in the lead's notes warns",
          pc_kinds(verlener(False)) == [("warn", "occasion:birthday")])
    check("  Verlener now: nothing", pc_kinds(verlener(True)) == [])

    marissa = pc_party("RH-20260910-5026", "2026-12-12T18:00:00+00:00", name="Marissa Test", mode="quick",
                       notes="60th birthday. Guests want to START EATING at 6:00 PM - chef arrival ~5:15 PM for setup. No tables/chairs/tableware (customer providing).",
                       internal="2026-09-09: 30 adults x $59.90. Customer declined tables/chairs/tableware. Wants to START EATING at 6:00 PM - schedule chef arrival ~5:15 PM.",
                       extras=[{"id": "gyoza", "qty": 1}])
    saundra = pc_party("RH-20261017-9824", "2026-12-31T18:00:00+00:00", name="Saundra Test",
                       internal="10-17 11:17 成交：跨年夜家庭聚餐，Palm Desert。门口要用 call box 呼叫；主人自备桌椅。",
                       prep_note="小区有门禁：到了在门口对讲机（call box）呼叫，不用密码。主人有桌椅。")
    check("party check · hosts who bring their own (RH-20261004-3574, RH-20260910-5026, RH-20261017-9824): never a setup gap",
          all(not any(k == "setup" for _, k in pc_kinds(p)) for p in (george(GEORGE_NOTES_BEFORE), marissa, saundra)) and pc_kinds(marissa) == [])

    check("party check · Kande (RH-20260921-9601, 12/05) before: tables, chairs and utensils free in the internal notes, 0 on the invoice: blocking",
          party_check.gaps_of(kande(False))[:1] and party_check.gaps_of(kande(False))[0]["title"] == "答应的桌椅、餐具，发票上一件都没有：备货清单不装车")
    check("  Kande now (64 place settings on the invoice, the venue's tables, folding tables only as backup): no setup gap",
          not any(k == "setup" for _, k in pc_kinds(kande(True))))

    quiet = pc_party("RH-20301101-0001", "2030-11-02T18:00:00+00:00", name="Quiet Test", guests=[pc_guest("Ann", "steak", "chicken")],
                     sms=[("2030-10-20T18:00:00Z", "outbound", "Any allergies we should know about? And what's the celebration?"),
                          ("2030-10-20T18:01:00Z", "outbound", "Happy birthday to her! Tables & chairs are $10 a guest if you'd like them."),
                          ("2030-10-20T18:05:00Z", "inbound", "No allergies here! Do you guys provide tables?"),
                          ("2030-10-20T18:06:00Z", "inbound", "My brother won't eat pork though")],
                     internal="问过敏：没有过敏。",
                     lead_notes=[("2030-10-21T18:00:00Z", "[owner] 她回信后：先弄清是什么空间（公寓/院子/有没有阳台、车道），给具体摆法（灶放车道/阳台、客人室内）。"),
                                 ("2030-10-21T18:05:00Z", "[data] 先弄清有没有阳台，问她要不要加桌椅？")])
    check("party check · false alarms stay out: our own questions and offers, 'no allergies', a question about tables, a planning note, one guest's pork",
          pc_kinds(quiet) == [])
    # What the run over the next three weeks of real parties (11-16 to 12-31) raised by mistake, before it was tightened.
    seen = pc_party("RH-20301101-0002", "2030-11-25T18:00:00+00:00", name="Seen Test",
                    guests=[pc_guest("Emma", "steak", "chicken", allergy="Gluten", tc=True), pc_guest("Natalie", "salmon", "chicken", allergy="Egg", tc=True)],
                    notes=("Allergy plates are cooked first on a clean griddle and served before anything else. Emma is gluten-free: salt and gluten-free soy "
                           "sauce. The chef arrives around 6:30 PM to set up; cooking starts at 7."),
                    prep_note="FULL TABLES, CHAIRS, LINENS for 12 (free deal) - chef arrives ~5 PM to set up. No plates/silverware ordered (customer uses own).",
                    sms=[("2030-10-20T18:00:00Z", "outbound", "Gluten-free plates are cooked first and seasoned with salt and gluten-free soy sauce."),
                         ("2030-10-20T18:01:00Z", "outbound", "Yes, we bring our homemade yum yum and ginger sauces, plus sriracha."),
                         ("2030-10-20T18:02:00Z", "inbound", "For 35 we send two chefs, each with their own grill, so everyone's served together"),
                         ("2030-10-20T18:03:00Z", "inbound", "And what are the meat and vegetarian options")],
                    lead_notes=[("2030-10-21T18:00:00Z", "[data] 全套含餐具 $659（没说）。Fri 11/27 (Thanksgiving week = holiday floor $50)。"),
                                ("2030-10-21T18:01:00Z", "[data] 11-11 17:58–17:59 三问：坐着吃还是自助排队 / 客人 4–5 点到、6:30–7 开饭 / 有没有寿司 → 18:0x 一条答完。"),
                                ("2030-10-21T18:02:00Z", "[data] 10-06 问烤台要多大地方 → 按 §8 比喻答：烤台 king-size 床大小的平地。"),
                                ("2030-10-21T18:03:00Z", "[data] 11:30 选 6 PM → 带时间链接，师傅 5:30 到。")])
    check("  nor do: 'plates' that are food, the 'free' of gluten-free, a host who uses their own tableware, a quote option, two chefs' own grills, "
          "a holiday as a price period, a menu question, the guests' arrival, our space spec, what we always bring, a superseded arrival time",
          pc_kinds(seen) == [], None, json.dumps(party_check.gaps_of(seen), ensure_ascii=False)[:600])

    # the pieces it reads with
    check("party check · times: 7:00-7:30 PM, 4 PM, 5 点半, 18:00; a note's own stamps ('11-11 19:28', '19:3x') are not times asked for",
          party_check.times_in("Chefs arrive 7:00-7:30 PM to set up") == {"7:00", "7:30"} and party_check.times_in("Chef arrives at 4 PM") == {"4:00"}
          and party_check.times_in("5 点半到场") == {"5:30"} and party_check.times_in("开始 18:00") == {"6:00"}
          and party_check.times_in("11-11 19:28 问 → 19:3x 回：可以看") == set())
    check("party check · the party page's words without the 48-hour line or the planner summary; a lead note's tagged parts only",
          party_check.page_words("⏰ WITHIN 48H OF EVENT — needs staff confirmation.\n\nGate code 4321\n\nSubmitted from the party planner: 8 adults.") == "Gate code 4321"
          and party_check.lead_segments("[callback] no chasing. [data] 8 adults, start 6:30 [SOP:x] template") == ["8 adults, start 6:30"]
          and party_check.lead_segments("【来电小结】客人问桌椅") == ["客人问桌椅"])
    check("party check · city from the address, the comma before CA or not",
          [party_check.city_of(a) for a in ("1 Test Way, Palm Springs, CA 92262", "11968 Gorham Ave, Los Angeles CA 90049", "")] == ["Palm Springs", "Los Angeles", ""])
    link = lambda **o: {"staff_member_id": "s1", "sent_via": "twilio", "sent_at": None, "first_opened_at": None, "last_opened_at": None, "revoked_at": None,
                        "stale": False, "change_pending_since": None, **o}
    team = [{"id": "s1", "name": "Blu", "role": "lead_chef"}, {"id": "s2", "name": "易非", "role": "assistant_chef"}]
    base = pc_party("RH-20301112-0001", "2030-11-12T18:00:00+00:00", name="Sheet Test", team=team)
    lines = lambda p, today: party_check.sheet_lines(p, today)
    check("party check · the sheet: before the party day 'not sent yet' is the day-before send's; on the day it is !!; a helper's line is never !!",
          lines(base, "2030-11-10") == [("· ", "Blu：还没发备料单（前一天统一发）"), ("· ", "易非 (帮手)：还没发备料单（前一天统一发）")]
          and lines(base, "2030-11-12") == [("!!", "Blu：手里没有备料单"), ("· ", "易非 (帮手)：手里没有备料单")])
    opened = {**base, "links": [link(first_opened_at="2030-11-11T20:00:00Z")]}
    check("  the latest version, opened, the last change confirmed: ✓",
          lines({**opened, "notices": [{"staff_member_id": "s1", "sent_at": "2030-11-12T16:00:00Z", "acked_at": "2030-11-12T16:05:00Z", "sms_sid": "SM1"}]}, "2030-11-12")[0]
          == ("✓", "Blu：最新版，已打开，改单通知 11-12 08:00 已回 1"))
    check("  a change text that never went out, one with no 1, a text that never reached him: flagged",
          lines({**opened, "notices": [{"staff_member_id": "s1", "sent_at": "2030-11-12T16:00:00Z", "acked_at": None, "sms_sid": ""}]}, "2030-11-12")[0]
          == ("!!", "Blu：最新版，已打开，改单短信 11-12 08:00 没发出去")
          and lines({**opened, "notices": [{"staff_member_id": "s1", "sent_at": "2030-11-12T16:00:00Z", "acked_at": None, "sms_sid": "SM1"}]}, "2030-11-12")[0][0] == "! "
          and lines({**base, "links": [link(sent_via="failed")]}, "2030-11-12")[0] == ("!!", "Blu：备料单短信没发到，他手里没有能打开的"))
    # One link per chef per party since 2026-11-13: a change no longer voids it. stale = he has not been told yet.
    check("  a change he has not been told about (stale): the link still opens with it on top - a ! to watch, not a missing sheet; a helper's is ·",
          lines({**base, "links": [link(stale=True, change_pending_since="2030-11-12T16:00:00Z")]}, "2030-11-12")[0]
          == ("! ", "Blu：订单改过，还没通知到他（链接不变，改动在最上面）（11-12 08:00 起在等），还没打开")
          and lines({**base, "team": team[1:], "links": [link(staff_member_id="s2", stale=True)]}, "2030-11-12")
          == [("· ", "易非 (帮手)：订单改过，还没通知到他（链接不变，改动在最上面），还没打开")])
    check("  a save the system has not looked at yet: !, and the text it may send keeps the same link",
          lines({**opened, "links": [link(first_opened_at="2030-11-11T20:00:00Z", change_pending_since="2030-11-12T16:00:00Z")]}, "2030-11-12")[0]
          == ("! ", "Blu：最新版，刚有改动，10 分钟后系统核对，要通知的会发短信（链接不变），已打开"))
    resent = link(sent_at="2030-11-12T15:00:00Z", first_opened_at="2030-11-11T20:00:00Z", last_opened_at="2030-11-11T21:00:00Z")
    check("  已打开 = opened since it last went to him: an open from before a re-send in place does not count, a newer open does",
          lines({**base, "links": [resent]}, "2030-11-12")[0] == ("✓", "Blu：最新版，还没打开")
          and lines({**base, "links": [{**resent, "last_opened_at": "2030-11-12T15:30:00Z"}]}, "2030-11-12")[0] == ("✓", "Blu：最新版，已打开")
          and lines({**base, "links": [link(sent_at="2030-11-12T15:00:00Z", first_opened_at="2030-11-12T15:10:00Z")]}, "2030-11-12")[0] == ("✓", "Blu：最新版，已打开")
          and party_check.opened_since_sent(link(first_opened_at="2030-11-11T20:00:00Z")) is True
          and party_check.opened_since_sent(link(sent_at="2030-11-12T15:00:00Z")) is False)

    # desk order check: the day's parties, read-only; desk order show: the blocking ones in its 缺项 block.
    p = andrea(False)
    o = {**p["order"], "id": "00000000-0000-4000-8000-0000000000e1", "event_start": "2030-11-12T18:30:00+00:00"}
    tables = {
        "orders": [o],
        "order_staff_assignments": [{"order_id": o["id"], "staff_member_id": "s-jason", "assignment_role": "lead_chef", "assignment_status": "confirmed"}],
        "staff_members": [{"id": "s-jason", "display_name": "JASON", "full_name": None, "phone": "+15555550177"}],
        "chef_sheet_links": [], "chef_change_notices": [],
        "order_events": [{"order_id": o["id"], "action": "chef_sheet_sent", "created_at": "2030-11-11T18:08:00Z",
                          "metadata": {"note": p["sheet_notes"][0]["note"], "staff_name": "JASON"}}],
        "invoice_update_requests": [{"order_id": o["id"], "created_at": "2030-10-20T18:28:00Z", "customer_message": p["requests"][0]["message"]}],
        "lead_touchpoints": [],
    }
    prep = {"ok": True, "orders": [{"id": o["id"], "orderNo": o["order_no"], "timeLabel": "6:30 PM", "adults": 8, "kids": 0, "menuKnown": True,
                                    "proteinLine": "Steak ×8 · Shrimp ×8", "extrasLine": "Gyoza 20pcs", "cooler": {"note": None}}]}
    r = DeskRun(["order", "check", "2030-11-12"], gets={"/api/admin/prep": prep, "/api/admin/sms-thread": {"messages": []}}, db=fake_db(tables))
    check("desk order check <date>: one block per party - prep line, notes, allergies, the chef's sheet - then the gaps, !! first, each with its fix",
          r.exit is None and r.has("派对当天核对 2030-11-12 · 1 场 · 缺项 3（1 项要先补）", "RH-20260929-2057 · 6:30 PM · Palm Springs · Andrea · 8 大 · 师傅 JASON",
                                   "备货：Steak ×8 · Shrimp ×8 | Gyoza 20pcs", "订单备注（客人看得到）：(空)", "过敏：无",
                                   "备料单 ·  JASON：还没发备料单（前一天统一发）",
                                   "!! 答应的桌椅、桌布、餐具，发票上一件都没有：备货清单不装车", "!  门禁 / 到了打电话：订单备注里没有",
                                   "派对页留言 10-20：Call Andrea to get in the gate", "改法：写进订单备注")
          and r.out.index("!! 答应的") < r.out.index("!  门禁"), r)
    check("  it reads and never writes: the prep list, the texts and the database, nothing posted",
          r.posted == [] and set(r.reads) == {"/api/admin/prep", "/api/admin/sms-thread"} and r.db_reads and all(x.startswith("/rest/v1/") for x in r.db_reads), r)
    r = DeskRun(["order", "check", "11/12"], gets={}, db=fake_db({}))
    check("  a date that is not YYYY-MM-DD is refused before anything is read", "YYYY-MM-DD" in str(r.exit) and r.reads == [] and r.db_reads == [], r)

    show_db = fake_db({**tables, "orders": [{**o, "id": "00000000-0000-4000-8000-000000000001"}],
                       "order_events": [], "invoice_update_requests": []})
    lint = {"ok": True, "blocking": [], "warnings": []}
    r = Run(invoice(adults=8, proteins=prot(steak=(8, 0), shrimp=(8, 0))), op="show", lint=lint, db=show_db)
    check("desk order show: the setup promised and not on the invoice is a !! 缺项 line, with where it was promised and the fix",
          r.has("⚠ 缺项（1 项拦着备料单和前一天的提醒）", "!! 答应的桌椅、桌布、餐具，发票上一件都没有：备货清单不装车（租赁页选了 09-29「全套 · black · 8 位」",
                "改法：写成订单行") and "门禁" not in r.out, r)
    r = Run(invoice(adults=8, proteins=prot(steak=(8, 0), shrimp=(8, 0))), op="show", lint=lint)
    check("  no database to read: the block is the invoice lint's alone, and show still prints", r.has("✓ 缺项：无") and r.exit is None, r)


# ---------------------------------------------------------------- whose chef texts --
# Which texts we sent a chef are a party's (owner 2026-11-16). Steven had George's 40 in Corona on Fri 11/13 8 PM
# (RH-20261004-3574) and Jacob Park's lunch for 19 in Corona on Tue 11/17 noon (RH-20261029-0692). The city was enough, so
# every text of Steven's in the five days before 11/17 that said "Corona" was read as Jacob's, and the review raised George's
# shrimp allergy on Jacob's party; and the reminder Steven got at 4:07 PM on 11/13 (00:07 UTC on the 14th) was left out of
# George's own. His texts as they went out, the links shortened.
STEVEN_TEXTS = [
    ("2026-11-13T01:15:54Z", "Real Hibachi prep sheet - Fri Nov 13 8:00 PM - Corona - 40 guests - 2 chefs, 2 grills\n"
                             "https://invoice.realhibachi.com/chef/tokGeorgeSteven1\n(link works until the party wraps up)"),
    ("2026-11-13T20:58:02Z", "Real Hibachi 改单通知\n周五 11/13 8:00 PM · Corona · George · 40 位\n这场订单有改动：\n"
                             "1. 办公室备注改为：两位师傅、两台灶，7:00–7:30 到场，烤炉放平地（草地可以）。有客人对虾过敏：海鲜最后做。…\n"
                             "2. 新备注：If it rains, the host has a covered spot for the grills.\n新备料单（旧链接已作废，用这个）：\n"
                             "https://invoice.realhibachi.com/chef/tokGeorgeSteven2\n看完请回 1 确认。"),
    ("2026-11-14T00:07:55Z", "Steven，今晚 8 点 Corona George 那场，中午 12:58 发你的新备料单你已经打开过了，麻烦回个 1 确认：有客人对虾过敏，"
                             "海鲜最后做，小游戏只扔西葫芦。"),
    ("2026-11-16T18:11:25Z", "Real Hibachi prep sheet - Tue Nov 17 12:00 PM - Corona - 19 guests\n明天周二中午 Corona Jacob 公司团队午餐，19 位："
                             "11:30 到场布置，12:00 准时开始。客人没在派对页选菜，先按全员鸡+牛备；他要是发名单改了，系统会再通知你。送饺子 19 个。看完回个 1。\n"
                             "https://invoice.realhibachi.com/chef/tokJacobSteven1\n(link works until the party wraps up)"),
]


def jacob() -> dict:  # RH-20261029-0692, Tue 11/17 noon, Corona
    return pc_party("RH-20261029-0692", "2026-11-17T12:00:00+00:00", name="Jacob Test", mode="quick",
                    notes="Company team lunch for 19. The chef arrives at 11:30 to set up; lunch starts at 12:00.",
                    prep_note="公司团队午餐 19 位：11:30 到场布置，12:00 准时开始。先按全员鸡+牛备。送饺子 19 个。", address="1 Test Way, Corona, CA 92879")


def chef_text_checks() -> None:
    g, j = george(GEORGE_NOTES_NOW, GEORGE_PREP_NOW)["order"], jacob()["order"]
    link = lambda lid, o, token, at, revoked=None: {"id": lid, "order_id": o["id"], "staff_member_id": "s-steven", "token": token, "sent_via": "twilio",
                                                   "sent_at": at, "first_opened_at": None, "last_opened_at": None, "revoked_at": revoked, "stale": False,
                                                   "change_pending_since": None}
    db = fake_db({
        "orders": [g, j],
        "order_staff_assignments": [{"order_id": o["id"], "staff_member_id": "s-steven", "assignment_role": "lead_chef", "assignment_status": "confirmed"}
                                    for o in (g, j)],
        "staff_members": [{"id": "s-steven", "display_name": "Steven", "full_name": None, "phone": "+15555550166"}],
        "chef_sheet_links": [link("l-g1", g, "tokGeorgeSteven1", "2026-11-13T01:15:53Z", "2026-11-13T20:58:00Z"),
                             link("l-g2", g, "tokGeorgeSteven2", "2026-11-13T20:58:00Z"), link("l-j1", j, "tokJacobSteven1", "2026-11-16T18:11:24Z")],
        "chef_change_notices": [], "order_events": [], "invoice_update_requests": [], "lead_touchpoints": [],
    })
    steven = [{"at": at, "direction": "outbound", "body": body, "status": "delivered"} for at, body in STEVEN_TEXTS]
    site = lambda path, params=None: {"messages": steven if (params or {}).get("phone") == "+15555550166" else []}
    load = lambda chef_auto: {p["order"]["order_no"]: p for p in party_check.load_parties([g["id"], j["id"]], db, site, None, chef_auto=chef_auto)}
    bodies = lambda p: [m["body"] for m in p["chef_sms"]]
    seen = load(True)  # as the review reads them (desk order review)
    check("chef texts · Jacob Park (RH-20261029-0692, Tue 11/17 Corona): only his own prep sheet - not George's prep sheet, change notice or "
          "4:07 PM reminder, though all three say Corona",
          bodies(seen["RH-20261029-0692"]) == [STEVEN_TEXTS[3][1]], None, json.dumps(bodies(seen["RH-20261029-0692"]), ensure_ascii=False)[:400])
    check("  so no shrimp-allergy item on Jacob's party (the review raised one on 11-16)",
          not any(x["kind"] == "allergy" for x in party_check.gaps_of(seen["RH-20261029-0692"])))
    check("  George (RH-20261004-3574, Fri 11/13 8 PM Corona): his sheet and change notice by their links, the reminder by his name - "
          "sent 4:07 PM on the party day, 00:07 UTC the next; the link tokens stay out of the party",
          bodies(seen["RH-20261004-3574"]) == [b for _, b in STEVEN_TEXTS[:3]]
          and all("token" not in l for p in seen.values() for l in p["links"]) and len(seen["RH-20261004-3574"]["links"]) == 2,
          None, json.dumps(bodies(seen["RH-20261004-3574"]), ensure_ascii=False)[:400])
    day = load(False)  # desk order check: the system's own texts left out
    check("  desk order check (no system texts): George has the reminder, Jacob nothing",
          bodies(day["RH-20261004-3574"]) == [STEVEN_TEXTS[2][1]] and bodies(day["RH-20261029-0692"]) == [])

    def says(body: str, at: str, order: dict, chef: str = "Steven") -> bool:
        return party_check._mentions_party(body, order, str(order["event_start"])[:10], sent=party_check._pt(at).date(), chef=chef)

    nov13, nov16 = "2026-11-13T18:00:00Z", "2026-11-16T18:00:00Z"  # 10 AM Pacific
    check("  what a person writes still finds the party: a weekday with the city, tomorrow with the start time, the date alone, "
          "the order number - and only that party",
          says("Steven，周二 Corona 那场客人改成 21 位", nov13, j) and not says("Steven，周二 Corona 那场客人改成 21 位", nov13, g)
          and says("明天中午 12 点那场多带一包炒饭", nov16, j) and says("11/17 多带一包炒饭", nov16, j)
          and says("RH-20261004-3574 的雨棚在后院", nov13, g) and not says("RH-20261004-3574 的雨棚在后院", nov13, j))
    verlener_o = verlener(False)["order"]  # 11/12 7 PM Corona
    check("  and nothing less: the city alone, a weekday or 'tomorrow' alone (a reminder to every chef with a Friday party), "
          "another party that day by its time, 前后天 (not 后天)",
          not says("Corona 那场多带一包炒饭", nov16, j) and not says("周五派对前的小提醒：抛接对准人手，点火离桌面远一点。", "2026-11-12T06:02:00Z", g)
          and not says("可以，收到了，谢谢！明天辛苦了。", nov16, j) and not says("11/17 6 点 Irvine 那场多带一包炒饭", nov16, j)
          and not says("Gary，今天 5:30 Jamie 那场补充两点：5 点前后天就黑了，带上灯。", "2026-11-10T20:57:00Z", verlener_o, chef="Gary"))
    steven_lee = {**j, "order_no": "RH-20301117-0001", "customer_name": "Steven Lee"}
    will = {**j, "order_no": "RH-20301117-0002", "customer_name": "Will Test"}
    check("  a customer's first name counts as written ('Will', not 'will'), and not when it is the chef's own ('Steven，…') - the full name does",
          not says(STEVEN_TEXTS[2][1], STEVEN_TEXTS[2][0], steven_lee) and says("Steven Lee 那场多带一包炒饭", nov16, steven_lee)
          and not says("Blu will bring the extra rice", nov16, will) and says("Will 那场多带一包炒饭", nov16, will))


# ---------------------------------------------------------------- 派工计划 in the review --
# Whitney RH-20261007-9434 (11/15 Los Angeles) on 11-14, before the owner rewrote the stations note: the plan still
# seated the guests at "10 six-foot tables ... two U shapes", captured from an 11-04 email, while the order had gone
# to 30 chairs and no tables. The reviewer's packet showed no plan (no sheet sent yet); only `desk order show` did,
# and the pass's fingerprint did not move when the note was rewritten. Texts and notes trimmed.
WHITNEY_STATIONS = "That's 2 chefs, and for seating, 10 six-foot tables with 4 guests each, set up as two U shapes, one around each chef's grill."
WHITNEY_FIXED = ("2 chefs, 2 grills. No tables: we bring only 30 black chairs. Guests need not sit around the grills; "
                 "ask the host where to set up (a flat outdoor spot for each grill).")


def whitney(fixed: bool) -> dict:  # RH-20261007-9434, 11/15 Los Angeles
    p = pc_party("RH-20261007-9434", "2026-11-15T17:30:00+00:00", name="Whitney Test", guests=[pc_guest(f"Guest {i}", "chicken", "steak") for i in range(1, 41)],
                 extras=[{"id": "gyoza", "qty": 4}, {"id": "folding_chairs", "qty": 30}],
                 notes="Your chefs arrive around 4:30 PM to set up, so cooking starts at 5:30. We'll bring 30 black chairs, no tables.",
                 prep_note="4 点半到场布置，5:30 开始。带 30 把黑色椅子（客人只要椅子，不带桌子）。",
                 team=[{"id": "s-blu", "name": "Blu", "role": "lead_chef"}, {"id": "s-gary", "name": "Gary", "role": "lead_chef"}],
                 address="1 Test Way, Los Angeles, CA 90049")
    promise = {"chefs": 2, "grills": 2, "via": "email", "at": "2026-11-05T03:18:55.087Z", "sid": "selfcheck-email",
               "text": f"Hi Whit, here's the plan for your 40. {WHITNEY_STATIONS} Let me know if that works."}
    p["order"]["dispatch_plan"] = {"chefs": 2, "grills": 2, "heads": 40, "promise": promise,
                                   **({"source": "owner", "stations_note": WHITNEY_FIXED, "set_by": "workbench:owner", "set_at": "2026-11-14T22:00:37.025Z"} if fixed else
                                      {"source": "promise", "stations_note": WHITNEY_STATIONS, "set_by": "promise_capture", "set_at": "2026-11-05T03:18:55.087Z"})}
    return p


def review_db(party: dict, reviews=()) -> dict:
    """The tables `desk order review` reads, for one pc_party: the order, its crew (no phones), no sheet sent yet."""
    o = party["order"]
    return {"orders": [o],
            "order_staff_assignments": [{"order_id": o["id"], "staff_member_id": t["id"], "assignment_role": t["role"], "assignment_status": "confirmed"}
                                        for t in party["team"]],
            "staff_members": [{"id": t["id"], "display_name": t["name"], "full_name": None, "phone": None} for t in party["team"]],
            "chef_sheet_links": [], "chef_change_notices": [], "invoice_update_requests": [], "lead_touchpoints": [],
            "order_events": [{"order_id": o["id"], **r} for r in reviews]}


def dispatch_plan_checks() -> None:
    per = party_check.guests_per_chef()
    g = party_check.gaps_of(whitney(False))
    check("dispatch plan · Whitney (RH-20261007-9434) 11-14 before: the stations note seats 40 at '10 six-foot tables ... two U shapes', "
          "the order has 30 chairs and no table: a warning, not blocking, with the fix for this order",
          [(x["severity"], x["kind"]) for x in g] == [("warn", "stations")] and g[0]["evidence"][0]["text"] == WHITNEY_STATIONS
          and "desk order set RH-20261007-9434 --stations" in g[0]["fix"], None, json.dumps(g, ensure_ascii=False)[:600])
    check("  Whitney now (the owner's note: 'No tables: we bring only 30 black chairs'): nothing", pc_kinds(whitney(True)) == [])
    tabled, ticked, hosts = whitney(False), whitney(False), whitney(False)
    tabled["order"]["invoice_data"]["partyExtras"].append({"id": "folding_tables", "qty": 10})
    for row in ticked["order"]["invoice_data"]["guests"]:
        row["tablesChairs"] = True
    hosts["order"]["dispatch_plan"]["stations_note"] = "Two U shapes of the host's own tables, one around each chef's grill."
    check("  bare tables on the order, the package ticked on the guest rows, or the host's own tables in the note: no stations warning",
          all(not any(k == "stations" for _, k in pc_kinds(p)) for p in (tabled, ticked, hosts)))

    crew = pc_party("RH-20301114-0001", "2030-11-14T18:00:00+00:00", name="Crew Test", guests=[pc_guest(f"Guest {i}", "steak", "chicken") for i in range(1, 12)],
                    team=[{"id": "s1", "name": "Blu", "role": "lead_chef"}, {"id": "s2", "name": "易非", "role": "lead_chef"}])
    g = party_check.gaps_of(crew)
    check("dispatch plan · two cooks on an 11-guest party, one chef by the rule: a warning - the sheet loads one grill, and the lint only flags too few",
          [(x["severity"], x["kind"]) for x in g] == [("warn", "crew")] and g[0]["title"] == "派了 2 位主厨，派工计划只有 1 位师傅 / 1 台灶：备料单只装 1 台灶"
          and "desk order set RH-20301114-0001 --chefs 2 --grills 2" in g[0]["fix"], None, json.dumps(g, ensure_ascii=False)[:600])
    helper, owner = copy.deepcopy(crew), copy.deepcopy(crew)
    helper["team"][1]["role"] = "assistant_chef"
    owner["order"]["dispatch_plan"] = {"chefs": 2, "grills": 2, "source": "owner"}
    check("  one of them a helper, or the owner's plan for two: nothing", pc_kinds(helper) == [] and pc_kinds(owner) == [])

    # The rule counts paid heads the way the chef sheet does: an adult 1, a kid 5-12 half, a free 3-4 nothing.
    rows = lambda adults, kids=0, little=0: {"mode": "detailed", "guests": [pc_guest(f"A{i}", "steak", "chicken") for i in range(adults)]
                                             + [pc_guest(f"K{i}", "chicken", "shrimp", child=True) for i in range(kids)]
                                             + [{**pc_guest(f"L{i}", "chicken", child=True), "isLittle": True} for i in range(little)]}
    chefs = lambda inv, plan=None: party_check.effective_plan({"invoice_data": inv, "dispatch_plan": plan})["chefs"]
    check(f"dispatch plan · the rule by paid heads ({per} a chef): {per - 1} adults + 2 kids + a free little one is one chef, + 3 kids two; "
          "a stored rule plan's old count does not count, an owner's plan stands",
          [chefs(rows(per - 1, 2, 1)), chefs(rows(per - 1, 3)), chefs(rows(per - 1, 3), {"chefs": 1, "grills": 1, "source": "rule", "heads": 20}),
           chefs(rows(3 * per), {"chefs": 2, "grills": 3, "source": "owner"})] == [1, 2, 2, 2])
    check("  quick mode: the counts, less the 'Little kids … ×N' line", chefs({"mode": "quick", "adultCount": per - 1, "childCount": 3, "promotions": [LITTLE_LINE]}) == 1
          and chefs({"mode": "quick", "adultCount": per - 1, "childCount": 3}) == 2)

    # desk order show prints the same line (desk._print_plan -> party_check.plan_lines).
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        desk._print_plan({"invoice_data": rows(per + 1), "dispatch_plan": {"chefs": 2, "grills": 2, "source": "promise", "stations_note": "Two U shapes by the pool.",
                          "promise": {"chefs": 2, "grills": 2, "at": "2030-11-10T20:00:00Z", "via": "sms", "text": "For 29 we send two chefs,\n each with their own grill."}}},
                         {"cooks": [{"name": "Gary"}], "helpers": [{"name": "易非"}]})
        desk._print_plan({"invoice_data": {"mode": "quick", "adultCount": 12}, "dispatch_plan": None}, {"cooks": [], "helpers": []})
    check("desk order show: the crew line - plan and why, who cooks and helps, the stations note, the whole promise, a cook short; no plan: the rule's count",
          buf.getvalue().splitlines() == ["   派工: 2 位师傅 / 2 台灶 · 答应过客人 · 已派 Gary · 帮手 易非",
                                          "         站位（备料单原样印出）: Two U shapes by the pool.",
                                          "         答应过: 2 厨 / 2 灶 · 11-10 12:00 短信 \"For 29 we send two chefs, each with their own grill.\"",
                                          "         ! 计划 2 位师傅，只派了 1 位",
                                          f"   派工: 1 位师傅 / 1 台灶 · 按人头规则（付费 12 人，{per} 人一位；没有单独的计划） · 已派 还没派"],
          None, buf.getvalue())

    # desk order review: the plan is in 【二】 before any sheet was sent, and a pass does not survive a rewritten note.
    prep = {"ok": True, "orders": [{"id": "id-RH-20261007-9434", "orderNo": "RH-20261007-9434", "timeLabel": "5:30 PM", "adults": 40, "kids": 0, "menuKnown": True,
                                    "proteinLine": "Chicken ×40 · Steak ×40", "extrasLine": "Gyoza 40pcs · 椅子 30把", "cooler": {"note": None}}]}
    gets = {"/api/admin/prep": prep, "/api/admin/sms-thread": {"messages": []}}
    r = DeskRun(["order", "review", "RH-20261007-9434"], gets=gets, db=fake_db(review_db(whitney(False))))
    two, three = r.out.find("【二】"), r.out.find("【三】")
    check("desk order review · Whitney before: 【二】 shows the plan the sheet prints - 2 chefs / 2 grills promised, Blu + Gary, the stations note whole, "
          "the 11-04 email - with no sheet sent yet; 【一】 warns that the note seats them at tables",
          r.exit is None and r.has("派工: 2 位师傅 / 2 台灶 · 答应过客人 · 已派 Blu + Gary", f"站位（备料单原样印出）: {WHITNEY_STATIONS}",
                                   "答应过: 2 厨 / 2 灶 · 11-04 19:18 邮件 \"Hi Whit,", "（还没有在用的备料单链接）",
                                   "!  派工站位写着桌子 / U 形，订单上没有桌子：备料单最上面会照印这句")
          and 0 < two < r.out.find("派工: 2 位师傅") < three and r.out.find("!  派工站位") < two, r)
    check("  it reads and never writes", r.posted == [] and r.db_reads and all(x.startswith("/rest/v1/") for x in r.db_reads), r)
    fp = (re.search(r"指纹 ([0-9a-f]{16})", r.out) or [None, None])[1]
    passed = {"action": "order_reviewed", "created_at": "2026-11-14T21:00:00Z", "actor": "reviewer:selfcheck",
              "metadata": {"verdict": "pass", "summary": "核了 14 条，都在", "fingerprint": fp}}
    r = DeskRun(["order", "review", "RH-20261007-9434"], gets=gets, db=fake_db(review_db(whitney(False), [passed])))
    check("  a pass for the order as it stands holds", bool(fp) and r.has("审查状态：✓"), r)
    r = DeskRun(["order", "review", "RH-20261007-9434"], gets=gets, db=fake_db(review_db(whitney(True), [passed])))
    check("  the owner rewrites the stations note after the pass: the pass no longer holds (11-14 the fingerprint stayed b9439e56b74ae31d across it)",
          r.has("审查状态：✗", f"（指纹 {fp} → ", "要重新审查", f"站位（备料单原样印出）: {WHITNEY_FIXED}") and "派工站位写着桌子" not in r.out, r)


# ---------------------------------------------------------------- 外包 (owner 2026-11-18) --
# A party sold to a partner company that runs it (lib/outsourced.ts): orders.dispatch_plan.outsourced. No chef of ours and
# no prep sheet - neither is a gap on it - and the partner gets a lasting invoice link instead.

PARTNER_TOKEN = "AbCdEfGhIjKlMnOpQrStUvWxYz012-_9"
PARTNER_LINK = f"https://www.realhibachi.com/p/invoice/{PARTNER_TOKEN}"
OUTSOURCED = {"at": "2026-11-18T20:00:00.000Z", "by": "workbench:owner", "invoice_token": PARTNER_TOKEN}


def outsourced_checks() -> None:
    mark = party_check.outsourced_mark
    check("外包 · the mark as lib/outsourced.ts reads it: an object, true, or nothing; a token not of ours is no link",
          mark({"dispatch_plan": {"chefs": 2, "grills": 2, "source": "owner", "outsourced": OUTSOURCED}}) == {**OUTSOURCED, "note": None}
          and mark({"dispatch_plan": {"outsourced": True}}) == {"at": None, "by": None, "invoice_token": None, "note": None}
          and mark({"dispatch_plan": {"chefs": 2, "grills": 2, "source": "owner"}}) is None and mark({"dispatch_plan": None}) is None
          and party_check.partner_invoice_url({"dispatch_plan": {"outsourced": OUTSOURCED}}) == PARTNER_LINK
          and party_check.partner_invoice_url({"dispatch_plan": {"outsourced": {**OUTSOURCED, "invoice_token": "short"}}}) is None)

    # The party the owner sold on 11-18 (RH-20261107-9978): 11 heads, a two-chef promise from 11-07, the chef already gone.
    sold = pc_party("RH-20261107-9978", "2026-11-21T17:00:00+00:00", name="Partner Test", guests=[pc_guest(f"Guest {i}", "chicken", "steak") for i in range(1, 12)],
                    address="1 Test Way, Irvine, CA 92618")
    sold["order"]["dispatch_plan"] = {"chefs": 2, "grills": 2, "source": "promise", "heads": 11, "outsourced": OUTSOURCED,
                                      "promise": {"chefs": 2, "grills": 2, "via": "sms", "at": "2026-11-07T20:00:00Z", "text": "Two chefs, two grills."}}
    check("外包 · the crew line (desk order show, the reviewer's 【二】): the partner runs it, the invoice link, what the customer was promised",
          party_check.plan_lines(sold["order"], [], []) == [
              "   派工: 外包（合作公司做，我们不派师傅）",
              f"         给合作方的 invoice（派对后两周内能打开，打开就是订单现在的样子）: {PARTNER_LINK}",
              "         答应过: 2 厨 / 2 灶 · 11-07 12:00 短信 \"Two chefs, two grills.\""],
          None, "\n".join(party_check.plan_lines(sold["order"], [], [])))
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        desk._print_plan(sold["order"], {"cooks": [], "helpers": []})
    check("  desk order show prints it: 派工: 外包（合作公司做，我们不派师傅）, then the link",
          buf.getvalue().splitlines()[:2] == ["   派工: 外包（合作公司做，我们不派师傅）", f"         给合作方的 invoice（派对后两周内能打开，打开就是订单现在的样子）: {PARTNER_LINK}"],
          None, buf.getvalue())

    lines = party_check.sheet_lines(sold, "2026-11-21")
    check("外包 · the party day: no chef and no sheet are not gaps - one plain line with the partner's link, no !!",
          lines == [("· ", f"外包（合作公司做）：我们不派师傅、不发备料单；给合作方的 invoice {PARTNER_LINK}")], None, str(lines))
    held = {**sold, "links": [{"staff_member_id": "s-blu", "sent_via": "twilio", "first_opened_at": None, "revoked_at": None},
                              {"staff_member_id": "s-gary", "sent_via": "twilio", "first_opened_at": None, "revoked_at": "2026-11-18T20:05:00Z"}]}
    check("  a sheet that went out before it was outsourced and was never called off: a ! to tell him he does not have to go",
          party_check.sheet_lines(held, "2026-11-21")[1:] == [("! ", "外包前发出去的备料单还有 1 份没作废：日地图「通知改动」里告诉他不用去")])
    # The prep list's line for it (app/api/admin/prep): listed, nothing counted, no cooler.
    listed = {**sold, "prep": {"id": sold["order"]["id"], "timeLabel": "5:00 PM", "adults": 11, "kids": 0, "menuKnown": True, "proteinLine": "", "extrasLine": "", "outsourced": True}}
    out = party_check.render(listed, party_check.gaps_of(listed), "2026-11-21")
    check("  desk order check: the header names the partner, not 未派; the prep line says nothing is packed",
          "RH-20261107-9978 · 5:00 PM · Irvine · Partner · 11 大 · 师傅 外包（合作公司做）" in out and "   备货：外包 · 不备货（合作公司做）" in out
          and not any("还没派师傅" in x or "未派" in x for x in out), None, "\n".join(out))
    before = george(GEORGE_NOTES_BEFORE)
    sold_george = copy.deepcopy(before)
    sold_george["order"]["dispatch_plan"] = {"outsourced": OUTSOURCED}
    check("  every other check stays: George's gaps (the shrimp allergy only in the internal notes is !!) are the same on the outsourced party",
          pc_kinds(sold_george) == pc_kinds(before) and any(s == "block" for s, _ in pc_kinds(before)), None, str(pc_kinds(sold_george)))

    # desk order send-sheet: refused before the review gate, with the partner's link; nothing posted.
    o = {**sold["order"], "order_no": ORDER_NO, "id": CANCEL_ID}
    r = DeskRun(["order", "send-sheet", ORDER_NO], db=fake_db({"orders": [o]}))
    check("外包 · desk order send-sheet: refused - no chef, no sheet - and it names the partner's invoice link instead; nothing written",
          "外包给合作公司了" in str(r.exit) and PARTNER_LINK in str(r.exit) and r.posted == [] and r.reads == [], r)

    # desk order review: 【二】 names the partner, 【三】 says no sheet goes out, and outsourcing changes the fingerprint.
    direct = copy.deepcopy(sold)
    direct["order"]["dispatch_plan"] = {k: v for k, v in sold["order"]["dispatch_plan"].items() if k != "outsourced"}
    prep = {"ok": True, "orders": [{"id": sold["order"]["id"], "orderNo": sold["order"]["order_no"], "timeLabel": "5:00 PM", "adults": 11, "kids": 0,
                                    "menuKnown": True, "proteinLine": "", "extrasLine": "", "outsourced": True}]}
    gets = {"/api/admin/prep": prep, "/api/admin/sms-thread": {"messages": []}}
    r = DeskRun(["order", "review", sold["order"]["order_no"]], gets=gets, db=fake_db(review_db(sold)))
    fp_out = (re.search(r"指纹 ([0-9a-f]{16})", r.out) or [None, None])[1]
    r2 = DeskRun(["order", "review", sold["order"]["order_no"]], gets=gets, db=fake_db(review_db(direct)))
    fp_direct = (re.search(r"指纹 ([0-9a-f]{16})", r2.out) or [None, None])[1]
    check("外包 · desk order review: 【二】 names the partner and the link, 【三】 says no sheet goes out, nothing !! about a chef",
          r.exit is None and r.has("派工: 外包（合作公司做，我们不派师傅）", PARTNER_LINK, "（外包：合作公司做，我们不发备料单）", "备货：外包 · 不备货（合作公司做）")
          and "还没派师傅" not in r.out and r.posted == [], r)
    check("  outsourcing is in the fingerprint (a pass for the party we ran does not hold for the partner's), and only there",
          bool(fp_out) and bool(fp_direct) and fp_out != fp_direct and "（还没有在用的备料单链接）" in r2.out, r2)


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
    check("  no sheet has failed to reach a chef: the header does not bring it up", "师傅没收到备料单" not in r.out.split("\n", 1)[0], r)

    # A change text that never reached the chef ([chef_unsent]). From 2026-11-11 to 11-13 the new link was issued
    # and his old one revoked before the text bounced, so he held no sheet he could open - the card says so when
    # the inbox finds no link of his that opens. Counted up front, its own words.
    party = chef_card["staff"]["parties"][0]
    unsent_why = f"他手里现在没有能打开的备料单 · {CANCEL_PARTY} · 【短信没发出去：Twilio 21211 号码无效】8 位加餐具"
    unsent_card = {**chef_card, "kinds": ["chef_unsent"], "waitedMinutes": 3, "thread": [],
                   "staff": {**chef_card["staff"], "parties": [{**party, "sheet": "undelivered"}]},
                   "alerts": [{"kind": "chef_unsent", "title": "师傅没收到改单短信 · Gary", "body": unsent_why}]}
    r = DeskRun(["next"], gets={"/api/admin/desk": {**inbox, "cards": [unsent_card, customer_card], "counts": {**inbox["counts"], "chefUnsent": 1}}})
    check("desk next: a change text that never reached the chef is counted with the chefs' items, flagged",
          "师傅 1 · 师傅没确认改动 1 · 师傅没收到备料单/改单 1 ⚠️ · 未回 1" in r.out.split("\n", 1)[0], r)
    chef_part = r.out.partition("Joyce Lin ·")[0]
    check("  its card comes before the customer's and says it in full: no sheet he can open, which party, why the text failed",
          f"师傅 Gary · {CHEF_PHONE}   [chef_unsent] 等了 3 分钟 ⚠️" in chef_part
          and f"派对 {ORDER_NO}  2030-11-14 17:30  Irvine · Joyce · 18 人 · 备料单短信没发到，他手里没有能打开的" in chef_part
          and f"⚑ 师傅没收到改单短信 · Gary — {unsent_why}" in chef_part, r)
    check("  and what to do about it: the owner sends the sheet again from the order; chef-confirm only if it reached him another way",
          "「发备料单给他」重发" in chef_part and f"已经从别的路给到他了（微信发了链接、当面或电话说了）: desk chef-confirm {CHEF_PHONE}" in chef_part
          and "只是没回 1" not in chef_part and "他的链接还能打开" not in chef_part, r)
    # Since 2026-11-13 the change text that bounced left his one link in place, up to date: it opens, he was
    # just not told. The card says that, and that sending it again is the same link.
    told_why = f"他还不知道改了（链接还能打开，改动在最上面） · {CANCEL_PARTY} · 【短信没发出去：Twilio 21211 号码无效】8 位加餐具"
    open_card = {**unsent_card, "staff": {**chef_card["staff"], "parties": [{**party, "sheet": "opened"}]},
                 "alerts": [{"kind": "chef_unsent", "title": "师傅没收到改单短信 · Gary", "body": told_why}]}
    r = DeskRun(["next"], gets={"/api/admin/desk": {**inbox, "cards": [open_card], "counts": {**inbox["counts"], "chefUnsent": 1}}})
    check("  a change text that bounced on his one link (2026-11-13): he was not told, the link still opens - said so, same link to re-send",
          r.has(f"⚑ 师傅没收到改单短信 · Gary — {told_why}", "18 人 · 备料单已打开", "他的链接还能打开、改动在最上面，只是他不知道改了",
                "「发备料单给他」重发（还是原来那条链接", f"desk chef-confirm {CHEF_PHONE}")
          and "他手里没有能打开的" not in r.out, r)
    # The sheet reassigning sent him did not get to him (D-1112-01): same card, and no chef-confirm - there is
    # no notice to mark; it goes when a sheet reaches him or he opens one.
    sheetless_card = {**unsent_card, "alerts": [{"kind": "chef_unsent", "title": "师傅没收到备料单 · Gary",
                                                 "body": f"他手里现在没有能打开的备料单 · {CANCEL_PARTY} · 原因：没存手机号"}]}
    r = DeskRun(["next"], gets={"/api/admin/desk": {**inbox, "cards": [sheetless_card], "counts": {**inbox["counts"], "chefUnsent": 1}}})
    check("  a sheet that never reached him after a reassign: the same card and fix, and no chef-confirm to clear it",
          r.has("⚑ 师傅没收到备料单 · Gary — 他手里现在没有能打开的备料单", "「发备料单给他」重发", "或者他打开了链接，这条自己消")
          and "desk chef-confirm" not in r.out, r)
    changed_card = {**chef_card, "kinds": ["chef"], "alerts": [], "staff": {**chef_card["staff"], "parties": [{**party, "sheet": "opened", "notTold": True}]}}
    r = DeskRun(["next"], gets={"/api/admin/desk": {**inbox, "cards": [changed_card]}})
    check("  a party whose order changed since he was last told: his link still opens (one link per party, 2026-11-13), the change not told yet",
          "18 人 · 备料单已打开 · 订单改过、还没通知到他（链接不变，改动在最上面）" in r.out and "作废" not in r.out, r)
    stale_card = {**chef_card, "kinds": ["chef"], "alerts": [], "staff": {**chef_card["staff"], "parties": [{**party, "sheet": "stale"}]}}
    r = DeskRun(["next"], gets={"/api/admin/desk": {**inbox, "cards": [stale_card]}})
    check("  a deploy from before 11-13 still says \"stale\": read as not told yet, never as void",
          "18 人 · 订单改过，还没通知到他" in r.out and "作废" not in r.out and "备料单已打开" not in r.out, r)

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

    # A new lead who wrote the site's contact form (2026-11-12 Victoria): the machine sends no first text
    # (lib/first-response.ts contactFormMisfit), so the card says so until someone has texted.
    form_card = {
        "key": f"lead:{LEAD_ID}", "kinds": ["lead"], "waitedMinutes": 2, "urgent": False, "phone": PROM_PHONE, "staff": None,
        "lead": {"id": LEAD_ID, "full_name": "Victoria Hernandez", "phone": PROM_PHONE, "status": "new", "guest_count": 25},
        "alerts": [], "thread": [], "orders": [], "stats": {},
        "forms": [{"type": "landing_contact", "label": "落地页表单", "summary": "", "at": "2026-11-12T18:13:09.000Z"},
                  {"type": "contact_form", "label": "联系表单", "summary": "2026-12-18 · 25 人 · 90275 · Outdoor", "at": "2026-11-12T18:14:44.000Z"}]}
    form_inbox = {"ok": True, "serverTime": "2026-11-12T18:16:00.000Z", "cards": [form_card], "counts": {"newLeads": 1}}
    r = DeskRun(["next"], gets={"/api/admin/desk": form_inbox})
    check("desk next: a new lead who wrote the contact form - the card says the machine will not text first",
          r.has("⚠️ 客人填了联系表单：机器不发首条", "[网站·联系表单] 2026-12-18 · 25 人 · 90275 · Outdoor"), r)
    texted = {**form_card, "thread": [sms(PROM_PHONE, "outbound", "2026-11-12 10:18:00", "Hi Victoria, it's Rowling from Real Hibachi.")]}
    r = DeskRun(["next"], gets={"/api/admin/desk": {**form_inbox, "cards": [texted]}})
    check("  once someone has texted, the line is gone", "机器不发首条" not in r.out, r)
    r = DeskRun(["next"], gets={"/api/admin/desk": {**form_inbox, "cards": [{**form_card, "forms": form_card["forms"][:1]}]}})
    check("  the estimator's own contact step alone does not raise it (template A still answers that one)", "机器不发首条" not in r.out, r)

    # desk order set --prep-note-file (D-1112-01): the 备货备注 through the workbench's set_prep_note, 300 characters.
    note_file = pathlib.Path(tempfile.mkdtemp()) / "prep-note.txt"
    note = "带 8 位全套：桌子、8 把椅子、黑桌布、8 套餐具（送的）。5:30 到场摆台。到门口打电话请客人开大门。"
    note_file.write_bytes(note.encode("utf-8"))
    current = lambda path: [{"prep_note": "付现金。"}] if path.startswith(f"/rest/v1/orders?select=prep_note&id=eq.{CANCEL_ID}") else []
    setp = ["order", "set", ORDER_NO, "--prep-note-file", str(note_file)]
    r = DeskRun([*setp, "--dry"], posts=lambda p, b: {"ok": True}, db=current)
    check("order set --prep-note-file --dry: the new 备货备注 next to the current one, how long it is, nothing written",
          r.exit is None and r.posted == [] and r.has(f"DRY   {ORDER_NO} 备货备注（{len(note)}/300 字），没写（--dry）", f"新：{note}", "原：付现金。"), r)
    r = DeskRun(setp, posts=lambda p, b: {"ok": True}, db=current)
    check("  for real: one set_prep_note with the order id and the file's text, and what it replaced",
          r.posted == [("/api/admin/chefs", {"action": "set_prep_note", "order_id": CANCEL_ID, "note": note}, "POST")]
          and r.has(f"OK    {ORDER_NO} 备货备注（{len(note)}/300 字）：{note}", "原来是：付现金。"), r)
    note_file.write_bytes(("多带炒饭。" * 61).encode("utf-8"))
    r = DeskRun(setp, posts=lambda p, b: {"ok": True}, db=current)
    check("  over 300 characters: refused before anything is read or sent (the site would cut it)",
          "备货备注最多 300 字，这份 305 字" in str(r.exit) and r.posted == [] and r.db_reads == [], r)
    note_file.write_bytes(b"  ")
    r = DeskRun(setp, posts=lambda p, b: {"ok": True}, db=current)
    check("  an empty file clears it", r.posted == [("/api/admin/chefs", {"action": "set_prep_note", "order_id": CANCEL_ID, "note": ""}, "POST")]
          and r.has(f"OK    {ORDER_NO} 备货备注 清空"), r)
    note_file.write_bytes("付现金。".encode("utf-8"))
    r = DeskRun(setp, posts=lambda p, b: {"ok": True}, db=current)
    check("  the same note again: nothing written", r.posted == [] and r.has("备货备注没变，不写"), r)

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


def rice_party(prep_guests=None) -> dict:  # the 11-20 case (RH-20261119-1164): food for 20 promised, 15 booked
    p = pc_party("RH-20301120-0001", "2030-11-21T17:00:00+00:00", name="Rice Test", mode="quick",
                 internal="11-19 老板答应：多带点炒饭和蔬菜，怕多来人，按 20 人带。", address="1 Test Way, Walnut, CA 91789")
    p["order"]["invoice_data"].update({"adultCount": 15, "childCount": 0, **({"prepGuests": prep_guests} if prep_guests is not None else {})})
    return p


def prep_guests_checks() -> None:
    """Base food for more guests than are booked (owner 2026-11-20): --prep-guests N, order show, the day check."""
    fifteen = invoice(adults=15, proteins=prot(steak=(15, 0), chicken=(15, 0)))
    r = Run(fifteen, "--prep-guests", "20", "--dry")
    check("--prep-guests 20 on 15 booked: base food for 20 (备餐按 20 人（订单 15 人）), the TOTAL unchanged, --dry saves nothing",
          r.exit is None and r.saved is None and r.has("prepGuests: none -> 20 (备餐按 20 人（订单 15 人）", "✓ total check: TOTAL $898.50", "DRY   not saved"), r)
    r = Run(fifteen, "--prep-guests", "20", echo=True)
    check("  saved: prepGuests 20 and nothing else on the invoice moved; read back from the order",
          r.data.get("prepGuests") == 20 and {k: v for k, v in r.data.items() if k != "prepGuests"} == fifteen
          and r.has("OK    prepGuests on the order: 20 - the chef's sheet and the prep list size the base food for 20"), r)
    r = Run(fifteen, "--prep-guests", "20")
    check("  an invoice app that dropped it (not deployed yet): the save says so instead of OK",
          r.saved is not None and r.has("WARN  the order has prepGuests None, not 20") and "OK    prepGuests" not in r.out, r)
    r = Run(fifteen, "--prep-guests", "15", "--dry")
    check("  --prep-guests 15 on 15 booked is refused: the base food is already for them",
          "has to be more than that" in str(r.exit) and r.saved is None, r)
    r = Run(fifteen, "--prep-guests", "0", "--dry")
    check("  --prep-guests 0 on an order without one: nothing to take off", "no prep count to take off" in str(r.exit), r)
    promised = {**copy.deepcopy(fifteen), "prepGuests": 20}
    r = Run(promised, "--prep-guests", "0", echo=True)
    check("  --prep-guests 0 takes it off: the key is gone, read back as none",
          r.saved is not None and "prepGuests" not in r.data and r.has("prepGuests: 20 -> none", "OK    prepGuests on the order: none"), r)
    r = Run(promised, "--prep-guests", "20", "--dry")
    check("  the same number again: nothing to change", r.has("· prepGuests is already 20") and "nothing to change" in str(r.exit), r)
    r = Run(fifteen, "--headcount", "18/0", "--proteins", "steak=18", "chicken=18", "--prep-guests", "20", "--dry")
    check("  with --headcount in the same command it is held against the new headcount: 20 on 18",
          r.exit is None and r.has("备餐按 20 人（订单 18 人）"), r)
    r = Run(fifteen, "--headcount", "20/0", "--proteins", "steak=20", "chicken=20", "--prep-guests", "20", "--dry")
    check("  ... and refused when the new headcount reaches it", "already counts 20 guests" in str(r.exit), r)
    r = Run(promised, "--time", "18:30")
    check("  any other order set keeps it (the lookup carries it back) and does not read it back",
          r.data.get("prepGuests") == 20 and "prepGuests" not in r.out.split("OK    saved")[-1], r)
    r = Run(promised, op="show", lint={"ok": True, "blocking": [], "warnings": []})
    check("order show prints it: 备餐按 20 人（订单 15 人）, proteins and price unchanged",
          r.has("备餐按 20 人（订单 15 人）：炒饭、蔬菜、沙拉和配的蛋、酱按 20 人备；蛋白和价格不变"), r)
    r = Run({**copy.deepcopy(fifteen), "adultCount": 22, "prepGuests": 20}, op="show", lint={"ok": True, "blocking": [], "warnings": []})
    check("  an order that has grown past it says it rests", r.has("备餐人数 20（订单已有 22 人，不比它多：现在按订单人数备）"), r)
    r = Run(fifteen, op="show", lint={"ok": True, "blocking": [], "warnings": []})
    check("  an order without it prints no such line", "备餐" not in r.out, r)

    check("party check · extra rice promised (11-19) and not on the order: the bring gap warns",
          ("warn", "bring:rice") in pc_kinds(rice_party()))
    p = rice_party(20)
    check("  the order's prep count (--prep-guests 20 on 15) carries it: no bring gap, and the day check prints the line",
          ("warn", "bring:rice") not in pc_kinds(p) and "   备餐按 20 人（订单 15 人）：炒饭、蔬菜、沙拉按这个人数备" in party_check.render(p, party_check.gaps_of(p), "2030-11-20"))
    check("  the prep list's own line wins when it is there; a count not above the booking carries nothing",
          party_check.prep_line({**rice_party(), "prep": {"prepLine": "备餐按 24 人（订单 15 人）"}}) == "备餐按 24 人（订单 15 人）"
          and ("warn", "bring:rice") in pc_kinds(rice_party(15)) and party_check.prep_line(rice_party(15)) == "")


# ---------------------------------------------------------------- 当天上午小结 (owner 2026-11-20) --
# desk order summary: the party-day text (what we bring, what to have ready, the cash total; no question), built from
# fake orders shaped like the real ones of 11/21, then the command against a fake site: what it posts, and when it
# does not (00:00-07:00, another day, sent already, Airbnb, a question of theirs waiting, a brake) and the email for a
# number that cannot take a text.
SUM_PHONE, SUM_LEAD, SUM_ID = "+15555550142", "00000000-0000-4000-8000-0000000000b1", "00000000-0000-4000-8000-0000000000a1"
SUM_TOTAL_LINE = "• Total {} cash. Card, Venmo or Zelle add fees, and gratuity isn't included."
SUM_NOW = datetime.datetime(2030, 6, 15, 16, 0, tzinfo=datetime.timezone.utc)  # 09:00 Pacific on the party day


def sum_guest(name: str, *proteins: str, child: bool = False, little: bool = False, tc: bool = False, ut: bool = False, noodles: bool = False) -> dict:
    return {"id": f"g-{name}", "name": name, "isChild": child or little, "proteins": list(proteins), "noodles": noodles, "tablesChairs": tc,
            "utensils": ut, "foodAllergy": "", "note": "", **({"isLittle": True} if little else {})}


def sum_text(*lines: str) -> str:
    return "\n".join(["Here's the plan for today:", *lines])


def sum_row(data: dict, *, order_no: str = ORDER_NO, oid: str = SUM_ID, start: str = "2030-06-15T17:00:00+00:00", lead: str | None = SUM_LEAD,
            phone: str = SUM_PHONE, status: str = "active", paid_cents: int = 0, ledger_cents: int | None = None, prep_note=None, internal=None) -> dict:
    """An orders row as the summary reads it; the ledger agrees with the fake engine unless told otherwise."""
    cents = round(fake_invoice(data)["cashBalanceDue"] * 100)
    return {"id": oid, "order_no": order_no, "customer_name": "Sam Host", "customer_phone": phone, "customer_email": "host@example.com",
            "event_start": start, "event_address": "1 Test St, Long Beach, CA 90802", "order_status": status, "internal_notes": internal,
            "prep_note": prep_note, "setup_selection": None, "source_metadata": {"lead_id": lead} if lead else {}, "invoice_data": data,
            "dispatch_plan": None, "deposit_status": "paid_verified", "quoted_total_cents": cents, "amount_paid_total_cents": paid_cents,
            "balance_due_cents": max(0, cents - paid_cents) if ledger_cents is None else ledger_cents, "created_at": "2030-06-01T18:00:00+00:00"}


def sum_lead(lid: str = SUM_LEAD, phone: str = SUM_PHONE, **over) -> dict:
    return {"id": lid, "normalized_phone": phone[-10:], "merged_into": None, "lead_source": "landing_quote", "lead_channel": None,
            "sms_blocked_at": None, "sms_blocked_reason": None, "created_at": "2030-05-20T18:00:00+00:00", **over}


class SummaryRun:
    """One `desk order summary` against fakes: the database rows, the leads, what was already logged, the Twilio thread,
    the engine (fake_invoice). `sms` = an ApiError the send route answers with (None: it sends). Records every write."""

    def __init__(self, argv: list[str], rows: list[dict], *, at: datetime.datetime = SUM_NOW, leads=None, touches=(), thread=(), sms=None):
        self.rows, self.leads, self.touches, self.thread, self.sms = rows, [sum_lead()] if leads is None else leads, list(touches), list(thread), sms
        self.posted: list[tuple[str, dict, str]] = []
        kept = desk.site_get, desk.site_post, desk._supabase, desk.invoice_post, desk._now
        desk.site_get, desk.site_post, desk._supabase, desk.invoice_post, desk._now = self.site_get, self.site_post, self.db, self.invoice_post, lambda: at
        buf, self.exit = io.StringIO(), None
        try:
            with contextlib.redirect_stdout(buf):
                try:
                    desk.main(["order", "summary", *argv])
                except SystemExit as e:
                    self.exit = e.code
        finally:
            desk.site_get, desk.site_post, desk._supabase, desk.invoice_post, desk._now = kept
        self.out = buf.getvalue()

    def db(self, method, path, data, content_type):
        if method != "GET":
            raise RuntimeError(f"selfcheck: a database write ({method} {path})")
        q = urllib_unquote(path)
        if path.startswith("/rest/v1/orders?"):
            m = re.search(r"order_no=eq\.([^&]+)", q)
            if m:
                return copy.deepcopy([r for r in self.rows if r["order_no"] == m.group(1)])
            m = re.search(r"event_start=gte\.(\d{4}-\d{2}-\d{2})", q)
            if m:
                return copy.deepcopy([r for r in self.rows if r["event_start"][:10] == m.group(1)])
        if path.startswith(("/rest/v1/order_staff_assignments?", "/rest/v1/order_events?")):
            return []
        if path.startswith("/rest/v1/leads?"):
            m = re.search(r"normalized_phone=in\.\(([^)]*)\)", q) or re.search(r"[?&]id=in\.\(([^)]*)\)", q)
            want = set(m.group(1).split(",")) if m else set()
            key = "normalized_phone" if "normalized_phone=in." in q else "id"
            return copy.deepcopy([l for l in self.leads if l[key] in want])
        if path.startswith("/rest/v1/lead_touchpoints?"):
            return copy.deepcopy(self.touches)
        raise RuntimeError(f"selfcheck: unexpected database read {path}")

    def invoice_post(self, path, payload, timeout=120):
        if path == "/api/invoice":
            return {"invoice": fake_invoice(payload)}
        raise RuntimeError(f"selfcheck: unexpected invoice call {path}")

    def site_get(self, path, params=None, admin=True, timeout=90):
        if path == "/api/admin/sms-thread" and list(params or {}) == ["phone"]:
            return {"ok": True, "messages": copy.deepcopy(self.thread)}
        raise RuntimeError(f"selfcheck: unexpected site read {path} {params}")

    def site_post(self, path, payload, method="POST", timeout=90):
        self.posted.append((path, copy.deepcopy(payload), method))
        if path == "/api/admin/sms-thread":
            if self.sms is not None:
                raise self.sms
            return {"ok": True, "sid": "SMsummary", "status": "queued"}
        if path in ("/api/admin/send-followup", "/api/admin/leads"):
            return {"ok": True}
        raise RuntimeError(f"selfcheck: unexpected site write {path}")

    def to(self, path: str) -> list[dict]:
        return [p for x, p, _ in self.posted if x == path]

    def has(self, *parts: str) -> bool:
        return all(p in self.out for p in parts)


def urllib_unquote(s: str) -> str:
    import urllib.parse
    return urllib.parse.unquote(s)


def day_summary_checks() -> None:
    kept = desk.VOICE_LOG
    with tempfile.TemporaryDirectory() as tmp:
        desk.VOICE_LOG = pathlib.Path(tmp) / "desk-voice.jsonl"  # a send is logged; never in the real ~/.realhibachi log
        try:
            _day_summary_checks()
        finally:
            desk.VOICE_LOG = kept


def _day_summary_checks() -> None:
    texts: list[tuple[str, str]] = []

    def summary(label: str, data: dict, **kw) -> dict:
        s = desk.day_summary(data, **{"start": "17:00", "due": 0.0, **kw})
        texts.append((label, s["text"]))
        return s

    # Host provides everything (RH-20261118-5862, 11/21 4 PM): quick mode, no rentals.
    host = invoice(adults=10, proteins=prot(chicken=(10, 0), steak=(10, 0)))
    host["contactInfo"]["specialNotes"] = "Birthday. Host has own tables, chairs and place settings."
    s = summary("host", host, start="16:00", due=615.90)
    check("summary · host has everything: our part, theirs (tables and chairs, plates and utensils, cups and drinks), the cash total",
          s["text"] == sum_text("• Your chef arrives about 30 minutes early to set up, and dinner starts at 4.",
                                "• We bring: the grill and propane, 10 chicken and 10 steak portions, fried rice, veggies, salad and sauces.",
                                "• Please have ready: a flat outdoor spot for the grill, about the size of a king-size bed, your own tables and chairs, "
                                "plates and utensils, and your own cups and drinks.",
                                SUM_TOTAL_LINE.format("$615.90")) and s["warn"] == [] and s["hold"] == [], detail=s["text"])

    # The full setup with its free appetizer (RH-20261116-6021, 11/21 5 PM): the notes promise a 4 PM arrival.
    jon = invoice(mode="detailed", adults=14, guests=[sum_guest("Guest 1", "tofu", "tofu", tc=True, ut=True)]
                  + [sum_guest(f"Guest {i}", "chicken", "steak", "shrimp", tc=True, ut=True) for i in range(2, 15)],
                  extras=[{"id": "gyoza", "qty": 1.4}], promos=[{"id": "official_fullsetup_app", "auto": True, "label": "FREE appetizer (full setup): Gyoza", "amount": 21}])
    jon["contactInfo"]["specialNotes"] = "Chef arrives around 4 PM to set up the tables and chairs before the 5 PM start."
    s = summary("full setup", jon, due=1178.60)
    check("summary · full rental + the free gyoza + the arrival the notes promise, word for word as the owner's template",
          s["text"] == sum_text("• Your chef arrives around 4, and dinner starts at 5.",
                                "• We bring: the grill and propane, 13 chicken, 13 steak, 13 shrimp and 2 tofu portions, fried rice, veggies, salad and sauces, "
                                "gyoza on us, tables and chairs with linens for 14, plates and utensils for 14.",
                                "• Please have ready: a flat outdoor spot for the grill, about the size of a king-size bed, and your own cups and drinks.",
                                SUM_TOTAL_LINE.format("$1,178.60")), detail=s["text"])
    bought = copy.deepcopy(jon)
    bought["partyExtras"] = [{"id": "gyoza", "qty": 2.4}, {"id": "edamame", "qty": 1}, {"id": "spring_rolls", "qty": 2}]
    s = summary("appetizers", bought)
    check("  a tray bought on top of the free one is counted (24 gyoza with 14 on us); bought ones by name and count",
          "gyoza on us" not in s["text"] and "24 gyoza with 14 on us, 20 spring rolls, an order of edamame," in s["text"], detail=s["text"])

    # Kids under 5 (RH-20261116-9219, 11/21 5 PM): no protein for them, butter noodles; nothing rented.
    tai = invoice(mode="detailed", adults=7, kids=2, guests=[sum_guest(f"Guest {i}", "chicken", "steak", "lobster_tail") for i in range(1, 8)]
                  + [sum_guest("Guest 8", little=True, noodles=True), sum_guest("Guest 9", little=True, noodles=True)],
                  promos=[{"id": "under5_auto", "label": "Little kids (3-4) @ $0 ×2", "amount": 59.8}])
    s = summary("littles", tai, due=599.0)
    check("summary · two free 3-4 year olds: rice and veggies for the little ones, their butter noodles, the upgrade by name",
          "• We bring: the grill and propane, 7 chicken, 7 steak and 7 lobster tail portions, fried rice, veggies, salad and sauces, "
          "rice and veggies for the little ones, 2 butter noodles.\n" in s["text"], detail=s["text"])
    picked = copy.deepcopy(tai)
    picked["guests"] = picked["guests"][:8]
    picked["guests"][7]["proteins"] = ["steak", "chicken"]
    s = summary("little with picks", picked)
    check("  a 3-4 year old's picks are not portions (the prep list leaves them out from 11-13): 7 steak, the little one",
          "7 chicken, 7 steak and 7 lobster tail portions" in s["text"] and "rice and veggies for the little one," in s["text"], detail=s["text"])
    before = copy.deepcopy(picked)
    before["contactInfo"]["eventDate"] = "2026-11-10"
    s = summary("little before 11-13", before)
    check("  ... and on a party before 11-13 they were cooked, so counted, and no little-ones line",
          "8 chicken, 8 steak and 7 lobster tail portions" in s["text"] and "little one" not in s["text"], detail=s["text"])
    quick_littles = invoice(adults=8, kids=3, proteins=prot(chicken=(8, 1), steak=(8, 1)), promos=[{"id": "under5_auto", "label": "Little kids (3-4) @ $0 ×2", "amount": 59.8}])
    s = summary("quick littles", quick_littles)
    check("  quick mode: the Little kids ×2 line is the little ones", "9 chicken and 9 steak portions" in s["text"]
          and "rice and veggies for the little ones" in s["text"] and s["warn"] == [], detail=s["text"] + str(s["warn"]))

    # Arrivals the notes give, and the ones they do not.
    told = copy.deepcopy(host)
    told["contactInfo"]["specialNotes"] = "Guests arrive at 5:30. Your chef will arrive around 6 PM to set up."
    s = summary("arrival", told, start="19:00")
    check("summary · an arrival the notes promise (\"arrive around 6 PM\"), not the guests' 5:30",
          s["text"].splitlines()[1] == "• Your chef arrives around 6, and dinner starts at 7.", detail=s["text"])
    told["contactInfo"]["specialNotes"] = "Chef will arrive around 4 to set up."
    s = summary("arrival no pm", told)
    check("  an hour with no AM/PM is the one before the start", s["text"].splitlines()[1] == "• Your chef arrives around 4, and dinner starts at 5.", detail=s["text"])
    told["contactInfo"]["specialNotes"] = "Chef arrives at 10:30 to set up."
    s = summary("lunch", told, start="11:30")
    check("  a morning party: AM said, lunch not dinner", s["text"].splitlines()[1] == "• Your chef arrives at 10:30 AM, and lunch starts at 11:30 AM.", detail=s["text"])
    told["contactInfo"]["specialNotes"] = "Chef arrives 30 minutes early."
    s = summary("no clock", told)
    check("  \"30 minutes early\" is no clock time: the usual line", "arrives about 30 minutes early to set up, and dinner starts at 5." in s["text"], detail=s["text"])
    told["contactInfo"]["specialNotes"] = "Surprise party: the birthday girl arrives at 6:30, so the chef has to be set up before."
    s = summary("someone else arrives", told, start="19:00")
    check("  someone else's arrival is not the chef's (the birthday girl at 6:30)", "arrives about 30 minutes early to set up, and dinner starts at 7." in s["text"], detail=s["text"])
    told["contactInfo"]["specialNotes"] = "Please arrive around 4 PM."
    s = summary("bare arrive", told)
    check("  a bare \"Please arrive around 4 PM\" is ours", s["text"].splitlines()[1] == "• Your chef arrives around 4, and dinner starts at 5.", detail=s["text"])
    chairs = invoice(adults=30, proteins=prot(chicken=(30, 0), steak=(30, 0)), extras=[{"id": "folding_chairs", "qty": 30}])
    s = summary("chairs only", chairs, start="12:00")
    check("summary · chairs on their own: an hour early (\"around 11 AM\", lunch at noon), 30 chairs, their own tables",
          s["text"].splitlines()[1] == "• Your chef arrives around 11 AM, and lunch starts at noon." and ", 30 chairs." in s["text"]
          and "bed, your own tables, plates and utensils, and your own cups" in s["text"], detail=s["text"])
    cloths = invoice(adults=12, proteins=prot(chicken=(12, 0), shrimp=(12, 0)), extras=[{"id": "white_linen", "qty": 4}])
    s = summary("cloths", cloths)
    check("summary · tablecloths only: 4 black tablecloths, their own tables and chairs, no early arrival for them",
          ", 4 black tablecloths." in s["text"] and "your own tables and chairs, plates and utensils" in s["text"]
          and "about 30 minutes early" in s["text"], detail=s["text"])

    # A deal: tables free, or at $5 a guest (not free); utensils not rented.
    blanca = invoice(mode="detailed", adults=9, guests=[sum_guest(f"G{i}", "steak", "chicken", tc=True, noodles=(i == 1)) for i in range(1, 10)],
                     extras=[{"id": "side_steak", "qty": 1}], promos=[{"id": "deal_free_extras", "label": "Tables & Chairs on us", "amount": 90}])
    blanca["customDeal"] = {"note": "Tables on us if locked 10/2", "freeExtraIds": ["tables_chairs"]}
    s = summary("deal free", blanca, start="19:30")
    check("summary · tables on us by the deal, a side counted in, an adult's noodles, an hour early at 6:30",
          "• Your chef arrives around 6:30, and dinner starts at 7:30." in s["text"]
          and "9 chicken and 10 steak portions" in s["text"] and "an order of hibachi noodles, tables and chairs with linens for 9 on us." in s["text"]
          and "bed, plates and utensils, and your own cups" in s["text"], detail=s["text"])
    rate = copy.deepcopy(blanca)
    rate["customDeal"] = {"extraRates": {"tables_chairs": 5}}
    rate["promotions"] = [{"id": "deal_extra_rates", "label": "Tables & Chairs at $5/guest", "amount": 45}]
    s = summary("deal rate", rate)
    check("  at $5 a guest they are not on us", "tables and chairs with linens for 9." in s["text"] and "on us" not in s["text"], detail=s["text"])

    # The cash line: none once nothing is owed; with a gratuity they picked, that it is in.
    s = summary("paid", host, due=0.0)
    check("summary · nothing owed: no Total line (four lines, no amount)", len(s["text"].splitlines()) == 4 and "$" not in s["text"]
          and "Total" not in s["text"], detail=s["text"])
    s = summary("gratuity", host, due=739.08, gratuity_rate=0.2)
    check("  a gratuity picked on the bill: the total says it is in it",
          s["text"].splitlines()[-1] == "• Total $739.08 cash, including the 20% gratuity you picked. Card, Venmo or Zelle add fees.", detail=s["text"])

    # More food promised (--prep-guests), a crew of two, the menu.
    more = {**copy.deepcopy(host), "prepGuests": 15}
    s = summary("prep guests", more)
    check("summary · --prep-guests above the headcount: with extra fried rice and veggies",
          "fried rice, veggies, salad and sauces, with extra fried rice and veggies." in s["text"], detail=s["text"])
    big = invoice(adults=40, proteins=prot(chicken=(40, 0), steak=(40, 0)))
    s = summary("two grills", big, chefs=2, grills=2)
    check("  two chefs and grills: chefs arrive, the grills, a spot for each - and no count, so the send's promise capture reads none",
          s["text"].startswith(sum_text("• Your chefs arrive about 30 minutes early to set up")) and "the grills and propane" in s["text"]
          and "a flat outdoor spot for each grill" in s["text"] and not re.search(r"\b(?:\d|one|two|three)[\s-]*(?:chefs?|grills?)\b", s["text"], re.I), detail=s["text"])
    empty = invoice(mode="detailed", adults=8, kids=2)
    s = summary("no menu", empty)
    check("summary · no menu yet: 2 proteins for each of the 10 guests, and desk says to get the menu",
          "the grill and propane, 2 proteins for each of the 10 guests, fried rice" in s["text"] and any("菜单未定" in w for w in s["warn"]) and s["hold"] == [],
          detail=s["text"] + str(s["warn"]))
    part = invoice(mode="detailed", adults=3, guests=[sum_guest("Ann", "steak", "chicken"), sum_guest("Bo"), sum_guest("Cy")])
    s = summary("half menu", part)
    check("  half a menu: held (2 of 3 have not picked, by name)", any("2 位还没选蛋白（Bo、Cy）" in h for h in s["hold"]), detail=str(s["hold"]))

    now = datetime.datetime(2030, 6, 15, 16, 0, tzinfo=datetime.timezone.utc)
    for label, text in texts:
        check(f"summary · voice check: clean, no question, plain characters ({label})",
              desk.voice_check(text, [], now, []) == [] and "?" not in text and "—" not in text and text.count("!") <= 1
              and not re.search(r"[‘’“”–]", text) and "balance" not in text.lower(), detail=text)

    # ---- the command against a fake site ----
    rows = [sum_row(jon)]
    r = SummaryRun([ORDER_NO], rows)
    check("order summary <RH-…>: prints the text and sends nothing", r.exit is None and r.posted == [] and r.has("Here's the plan for today:", "DRY   没发"), r)
    r = SummaryRun([ORDER_NO, "--send"], rows)
    sent, notes = r.to("/api/admin/sms-thread"), r.to("/api/admin/leads")
    text = desk.day_summary(jon, start="17:00", due=fake_invoice(jon)["cashBalanceDue"])["text"]
    check("  --send at 9:00 on the party day: one text through the workbench send (phone, body, lead, session, no force), then the [SOP:day_summary] note",
          r.exit is None and len(sent) == 1 and sent[0]["phone"] == SUM_PHONE and sent[0]["body"] == text and sent[0]["leadId"] == SUM_LEAD
          and sent[0].get("session") and "force" not in sent[0] and len(notes) == 1 and notes[0]["action"] == "add_note"
          and notes[0]["note"].startswith(f"[SOP:day_summary] {ORDER_NO} sms SMsummary: Here's the plan for today:") and r.has("OK    texted"), r)
    r = SummaryRun([ORDER_NO, "--send"], rows, at=datetime.datetime(2030, 6, 15, 13, 30, tzinfo=datetime.timezone.utc))
    check("  --send at 06:30 Pacific: refused, nothing read or sent", r.posted == [] and "00:00–07:00" in str(r.exit), r)
    r = SummaryRun([ORDER_NO, "--send"], rows, at=datetime.datetime(2030, 6, 14, 17, 0, tzinfo=datetime.timezone.utc))
    check("  --send the day before: refused (only on the party day); without --send it prints", r.posted == [] and "只在派对当天发" in str(r.exit), r)
    r = SummaryRun([ORDER_NO, "--send"], rows, at=datetime.datetime(2030, 6, 16, 1, 0, tzinfo=datetime.timezone.utc))
    check("  --send after the start: skipped", r.posted == [] and r.has("SKIP", "已经开始了"), r)
    blocked = [sum_lead(sms_blocked_at="2030-06-01T00:00:00Z", sms_blocked_reason="lookup: landline")]
    r = SummaryRun([ORDER_NO, "--send"], rows, leads=blocked)
    mail = r.to("/api/admin/send-followup")
    check("  a number that cannot take a text (landline): the same text by email from support@, no text tried, noted as email",
          r.to("/api/admin/sms-thread") == [] and len(mail) == 1 and mail[0]["to"] == "host@example.com" and mail[0]["text"] == text
          and mail[0]["leadId"] == SUM_LEAD and r.to("/api/admin/leads")[0]["note"].startswith(f"[SOP:day_summary] {ORDER_NO} email host@example.com"), r)
    r = SummaryRun([ORDER_NO, "--send"], rows, sms=_api.ApiError(409, {"error": "这个号码收不到短信（twilio 30006），已停发，改用邮件", "brake": "sms_blocked"}))
    check("  the send refusing the number (sms_blocked): falls back to the email", len(r.to("/api/admin/send-followup")) == 1 and r.has("OK    emailed"), r)
    r = SummaryRun([ORDER_NO, "--send"], rows, sms=_api.ApiError(409, {"error": "2 分钟前已经有人回过这位客人", "brake": "just_answered"}))
    check("  another brake (just_answered): nothing sent, no note, exit 2", r.to("/api/admin/send-followup") == [] and r.to("/api/admin/leads") == []
          and r.exit == 2 and r.has("BRAKE"), r)
    done = [{"lead_id": SUM_LEAD, "occurred_at": "2030-06-15T16:00:30Z", "touchpoint_type": "agent_note", "note": f"[SOP:day_summary] {ORDER_NO} sms SM1: …"}]
    r = SummaryRun([ORDER_NO, "--send"], rows, touches=done)
    check("  already summarized today ([SOP:day_summary] note): skipped", r.posted == [] and r.has("SKIP", "今天已经发过"), r)
    r = SummaryRun([ORDER_NO, "--send", "--force"], rows, touches=done)
    check("  ... --force sends it again (the order changed)", len(r.to("/api/admin/sms-thread")) == 1, r)
    asked = [sms(SUM_PHONE, "outbound", "2030-06-14 10:00:00", "Hi Sam, it's Rowling from Real Hibachi. Your party is tomorrow at 5 PM."),
             sms(SUM_PHONE, "inbound", "2030-06-15 08:10:00", "Can we add 2 more people?")]
    r = SummaryRun([ORDER_NO, "--send"], rows, thread=asked)
    check("  a question of theirs not answered yet: held (answer first)", r.posted == [] and r.exit == 2 and r.has("HOLD", "Can we add 2 more people?"), r)
    r = SummaryRun([ORDER_NO, "--send"], [sum_row(jon, ledger_cents=50000)])
    check("  the order's balance and the engine's do not agree: held, nothing sent", r.posted == [] and r.has("HOLD", "对不上"), r)
    paid = sum_row(jon, paid_cents=round(fake_invoice(jon)["cashBalanceDue"] * 100))
    r = SummaryRun([ORDER_NO, "--send"], [paid])
    check("  paid in full on the ledger: sent with no Total line", len(r.to("/api/admin/sms-thread")) == 1 and "Total" not in r.to("/api/admin/sms-thread")[0]["body"], r)

    # --date: the day's orders; an Airbnb party paid there is skipped, a cancelled one is not on it.
    air = sum_row(host, order_no="RH-20300601-0002", oid="00000000-0000-4000-8000-0000000000a2", lead="00000000-0000-4000-8000-0000000000b2",
                  phone="+15555550143", paid_cents=round(fake_invoice(host)["cashBalanceDue"] * 100), prep_note="Airbnb 单：客人已在 Airbnb 付清，现场不收钱")
    gone = sum_row(host, order_no="RH-20300601-0003", oid="00000000-0000-4000-8000-0000000000a3", lead=None, phone="+15555550144", status="cancelled")
    day_leads = [sum_lead(), sum_lead("00000000-0000-4000-8000-0000000000b2", "+15555550143", lead_source="manual_airbnb", lead_channel="airbnb")]
    r = SummaryRun(["--date", SATURDAY], [rows[0], air, gone], leads=day_leads)
    check("order summary --date: every order of the day not cancelled, the Airbnb one skipped, nothing sent without --send",
          r.posted == [] and r.has(f"当天小结 {SATURDAY} · 2 场", "Airbnb 单，已在 Airbnb 付清", "合计 DRY 1 · SKIP 1") and "RH-20300601-0003" not in r.out, r)
    r = SummaryRun(["--date", "today", "--send"], [rows[0], air, gone], leads=day_leads)
    check("  --date today --send: the one text, nothing to the Airbnb party", [p["phone"] for p in r.to("/api/admin/sms-thread")] == [SUM_PHONE]
          and r.exit is None and r.has("合计 OK 1 · SKIP 1"), r)
    unpaid = {**air, "amount_paid_total_cents": 0, "balance_due_cents": air["quoted_total_cents"]}
    r = SummaryRun(["--date", SATURDAY], [unpaid], leads=day_leads)
    check("  an Airbnb party still owing on the order: held (it has to be marked paid), no text", r.posted == [] and r.has("HOLD", "Airbnb 单还挂着"), r)


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    rules_match_the_ts_export()
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
    # Canopies rented for a rainy day (owner 2026-11-19): $20 each, by count.
    r = Run(quick_8_2, "--add-extra", "canopy=6", "--dry")
    check("--add-extra canopy=6: six 10x10 canopies at $20 each, by count",
          r.exit is None and r.has("10x10 canopies: 0 -> 6 at $20.00 each"), r)
    prep_guests_checks()
    day_summary_checks()
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
    check("  an order with no customerNotes prints no 客人留言 line", "客人留言" not in r.out, r)
    noted = {**party, "customerNotes": [{"at": "2026-11-10T16:24:00.000Z", "text": "Surprise birthday,\nentrance thru the side gate", "source": "party_page"},
                                        {"at": "", "text": "  ", "source": "party_page"}, "Call when you arrive"]}
    r = Run(noted, op="show", lint=missing)
    check("order show prints what the customer wrote on the party page (invoice_data.customerNotes), blanks skipped",
          r.has("客人留言 11-10 08:24: Surprise birthday, entrance thru the side gate", "客人留言: Call when you arrive") and r.out.count("客人留言") == 2, r)
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
    clean = {"ok": True, "blocking": [], "warnings": []}
    r = Run(party, op="remind", lint=clean, review=(False, "这单还没审查过"))
    check("  审查者: an order nobody reviewed is not texted, and says to review first",
          r.texted is None and "先审查" in str(r.exit) and r.has("审查  ✗ 这单还没审查过"), r)
    r = Run(party, "--dry", op="remind", lint=clean, review=(False, "11-12 14:00 审查过，之后订单变了"))
    check("  --dry on an unreviewed order shows the text and the hold", r.texted is None and r.has("DRY   See you", "HOLD") and "先审查" in r.out, r)
    r = Run(party, "--skip-review", "--why", "老板说先发", op="remind", lint=clean, review=(False, "这单还没审查过"))
    check("  --skip-review with a reason sends anyway", bool(r.texted) and r.has("OK    texted"), r)

    quoted_price_checks()
    send_checks()
    email_checks()
    order_flow_checks()
    party_check_checks()
    chef_text_checks()
    dispatch_plan_checks()
    outsourced_checks()

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

    # 审查者 (owner 2026-11-12): a link goes out only after a review that still holds.
    import order_review
    base_order = {"id": CANCEL_ID, "order_no": ORDER_NO, "event_start": "2030-11-14T17:30:00+00:00", "event_address": "1 Main St, Irvine, CA 92618",
                  "order_status": "active", "prep_note": "付现金。", "internal_notes": "", "setup_selection": None,
                  "invoice_data": {"guests": [{"name": "Joyce", "proteins": ["steak", "shrimp"]}], "contactInfo": {"specialNotes": "Birthday."},
                                   "selectedGratuityRate": 0.2, "pricingTerms": "v2_by_method"}}
    base_party = {"team": [{"id": "s1", "role": "lead_chef"}], "customer_sms": [{"direction": "inbound", "at": "2030-11-10T18:00:00.000Z", "body": "8 of us"}],
                  "requests": [], "lead_notes": []}
    def pk(order=None, party=None, emails=(), forms=(), reviews=()):
        p = {"order": order or base_order, "party": party or base_party, "emails": list(emails), "forms": list(forms), "reviews": list(reviews)}
        p["fingerprint"] = order_review.fingerprint(p)
        return p
    fp = pk()["fingerprint"]
    stamp = lambda verdict, f=fp: {"action": order_review.REVIEW_ACTION, "created_at": "2030-11-12T20:00:00Z", "metadata": {"verdict": verdict, "fingerprint": f, "summary": "核了 6 条"}}
    check("review gate: no review yet -> not fresh", order_review.review_state(pk()) == (False, "这单还没审查过"))
    check("review gate: a pass for the order as it stands -> fresh", order_review.review_state(pk(reviews=[stamp("pass")]))[0] is True)
    check("review gate: the newest verdict is a fail -> not fresh, and says it failed",
          (lambda s: s[0] is False and "没过" in s[1])(order_review.review_state(pk(reviews=[stamp("fail"), stamp("pass")]))))
    changed = copy.deepcopy(base_order); changed["invoice_data"]["guests"].append({"name": "Shin", "proteins": ["filet_mignon", "chicken"]})
    check("review gate: a guest added after the pass -> stale, re-review", order_review.review_state(pk(order=changed, reviews=[stamp("pass")]))[0] is False)
    texted = copy.deepcopy(base_party); texted["customer_sms"].append({"direction": "inbound", "at": "2030-11-12T21:00:00.000Z", "body": "Can we add tables?"})
    check("review gate: the customer texted after the pass -> stale", order_review.review_state(pk(party=texted, reviews=[stamp("pass")]))[0] is False)
    ours = copy.deepcopy(base_party); ours["customer_sms"].append({"direction": "outbound", "at": "2030-11-12T21:00:00.000Z", "body": "See you Saturday."})
    check("review gate: only our own text after the pass -> still fresh", order_review.review_state(pk(party=ours, reviews=[stamp("pass")]))[0] is True)
    tip = copy.deepcopy(base_order); tip["invoice_data"]["selectedGratuityRate"] = 0.25
    check("review gate: the gratuity the customer picked on the bill does not void a review", order_review.review_state(pk(order=tip, reviews=[stamp("pass")]))[0] is True)
    crew = copy.deepcopy(base_party); crew["team"] = [{"id": "s2", "role": "lead_chef"}]
    check("review gate: a reassigned chef -> stale", order_review.review_state(pk(party=crew, reviews=[stamp("pass")]))[0] is False)
    # The dispatch plan (Whitney RH-20261007-9434, 11-14): its chefs, grills and stations note are in the digest. An order
    # with no plan of its own keeps the digest it had before, so its review was not undone by adding the plan.
    check("review gate: an order with no dispatch plan keeps the fingerprint it had before the plan was digested", fp == "a7dc8d8852025f69", None, fp)
    planned = copy.deepcopy(base_order)
    planned["dispatch_plan"] = {"chefs": 2, "grills": 2, "source": "promise", "stations_note": "Two U shapes, each chef at an open end.", "heads": 30,
                                "set_at": "2030-11-10T18:00:00Z", "promise": {"chefs": 2, "grills": 2, "at": "2030-11-10T18:00:00Z", "text": "For 30 we send two chefs."}}

    def replanned(**changes):
        o = copy.deepcopy(planned)
        o["dispatch_plan"].update(changes)
        return o
    plan_pass = stamp("pass", pk(order=planned)["fingerprint"])
    check("review gate: the plan's stations note, chefs or grills changed after the pass -> stale",
          [order_review.review_state(pk(order=replanned(**c), reviews=[plan_pass]))[0] for c in ({"stations_note": "No tables: 30 chairs only."}, {"chefs": 3}, {"grills": 1})]
          == [False, False, False])
    check("  the plan saved again as it was (the owner's now, a new set_at, the promise gone) -> still fresh",
          order_review.review_state(pk(order=replanned(source="owner", set_at="2030-11-12T21:00:00Z", promise=None), reviews=[plan_pass]))[0] is True)
    legacy = stamp("pass", order_review.fingerprint(pk(order=planned), with_plan=False))
    said = order_review.review_state(pk(order=planned, reviews=[legacy]))
    check("  a pass stamped before the plan was in the digest -> stale, and it says that is all, not that the order changed",
          said[0] is False and "之后订单和对话都没变，但那次的指纹不含派工计划" in said[1] and "【二】派工" in said[1], None, said[1])
    texted_too = order_review.review_state(pk(order=planned, party=texted, reviews=[legacy]))
    check("  ... and once the customer has texted since, the usual 'changed since'", texted_too[0] is False and "之后订单、派工或客人的话变了" in texted_too[1], None, texted_too[1])
    check("review email: the quoted thread below a reply is dropped",
          order_review._email_text({"text": "Carla is pescatarian.\r\n\r\nOn Thu, Nov 12, 2026 at 9:10 AM Real Hibachi <support@realhibachi.com>\r\nwrote:\r\n> Hi Jane"}) == "Carla is pescatarian.")
    # 【三】 since 2026-11-13: one link per chef per party, updated in place - 发于 is when it last went to him,
    # an open counts from then, and stale is a change he has not been told about (the link still opens).
    held = {"staff_member_id": "s1", "created_at": "2030-11-10T18:00:00Z", "sent_at": "2030-11-12T16:00:00Z", "first_opened_at": "2030-11-10T19:00:00Z",
            "last_opened_at": "2030-11-11T19:00:00Z", "stale": True, "change_pending_since": "2030-11-12T17:00:00Z"}
    check("review packet 【三】: 发于 = sent_at, an open from before the last send says so, stale = not told yet, never void",
          order_review.link_line(held, {"s1": "Blu"})
          == "   Blu · 发于 11-12 08:00 · 打开过 11-11 11:00（这次发了还没打开） · 订单改过，还没通知到他（链接不变：他打开看到的是现在的订单，改动在最上面；下面是他上次被告知的那版）")
    check("  an open since the last send, no change waiting: the snapshot is what he sees; a row with no sent_at goes by created_at",
          order_review.link_line({**held, "last_opened_at": "2030-11-12T16:30:00Z", "stale": False, "change_pending_since": None}, {"s1": "Blu"})
          == "   Blu · 发于 11-12 08:00 · 打开过 11-12 08:30 · 最新版（下面这版就是他打开看到的）"
          and order_review.link_line({"staff_member_id": "s1", "created_at": "2030-11-10T18:00:00Z"}, {"s1": "Blu"}) == "   Blu · 发于 11-10 10:00 · 还没打开 · 最新版（下面这版就是他打开看到的）")

    print()
    if FAILS:
        print(f"{len(FAILS)} FAILED")
        return 1
    print("all passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
