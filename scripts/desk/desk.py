# -*- coding: utf-8 -*-
"""desk - the sales desk in one command, so no session ever rewrites the tooling.

  python scripts/desk/desk.py next                         what is waiting, one full card each
  python scripts/desk/desk.py card   <phone|leadId>        lead + hold + tags + thread + engine price
  python scripts/desk/desk.py thread <phone|leadId>        the Twilio conversation, oldest first
  python scripts/desk/desk.py search <text>                name / phone / email / order no
  python scripts/desk/desk.py price  --adults 24 [--kids 0] [--date 2026-10-13] [--zip 90802] [--alt-date ...]
  python scripts/desk/desk.py travel <destination>
  python scripts/desk/desk.py send   <phone> [body] --lead <id> [--body-file f] [--force]
  python scripts/desk/desk.py note   <leadId> [note] [--body-file f]
  python scripts/desk/desk.py hold   <leadId> <days>       0 clears
  python scripts/desk/desk.py status <leadId> <new|qualified|won|lost|disqualified>
  python scripts/desk/desk.py contacted <leadId>
  python scripts/desk/desk.py ack    <leadId> [--clear]    「不用回」watermark - tapbacks only
  python scripts/desk/desk.py fields <leadId> guest_count=24 city_or_zip=Long\\ Beach
  python scripts/desk/desk.py link deposit --lead <id> --adults 24 --city "Long Beach" [--kids 0]
                                   [--date 2026-10-13] [--time 18:00] [--email e] [--name n] [--est 1258]
  python scripts/desk/desk.py link planner --email e --phone p [--booked] [--lead <id>]
  python scripts/desk/desk.py link short <url> [--lead <id>]

Every write goes through the workbench APIs, so it lands in the lead timeline
and passes the same brakes as the workbench UI. Rules live in the leads skill;
this file only fetches, prints and posts.
"""
from __future__ import annotations

import argparse
import re
import sys
import urllib.parse

from _api import ApiError, dump, e164, invoice_post, is_uuid, pt, read_text_arg, site_get, site_post  # noqa: F401

TAPBACK = re.compile(r"^(liked|loved|laughed at|emphasized|disliked|questioned)\s", re.I)
THUMB = re.compile(r"^\U0001F44D[\U0001F3FB-\U0001F3FF]?️?[\s.!]*$")
TAG = re.compile(r"\[(callback|occasion|why|data|SOP:[^\]]+)\]", re.I)


def is_tapback(body: str) -> bool:
    b = (body or "").strip()
    return bool(TAPBACK.match(b) or THUMB.match(b))


# ---------------------------------------------------------------- fetchers --
def lead_rows() -> list[dict]:
    return site_get("/api/admin/leads", {"limit": 300}).get("leads") or []


def find_lead(ident: str, rows: list[dict] | None = None) -> dict | None:
    """By id, or the newest un-merged lead on that phone."""
    rows = rows if rows is not None else lead_rows()
    if is_uuid(ident):
        return next((r for r in rows if r.get("id") == ident), None)
    phone = e164(ident)
    hits = [r for r in rows if (r.get("phone") or "") == phone]
    if hits:
        return sorted(hits, key=lambda r: r.get("created_at") or "", reverse=True)[0]
    # older than the newest 300: fall back to search
    for c in site_get("/api/admin/search", {"q": phone}).get("customers") or []:
        if c.get("leads"):
            return c["leads"][0]
    return None


def thread_for(phone: str | None, lead_id: str | None) -> list[dict]:
    params = {}
    if phone:
        params["phone"] = phone
    if lead_id:
        params["leadId"] = lead_id  # also heals the timeline (sms-reconcile)
    msgs = site_get("/api/admin/sms-thread", params).get("messages") or []
    return sorted(msgs, key=lambda m: m.get("at") or "")


def events_for(lead_id: str) -> list[dict]:
    return site_get("/api/admin/leads", {"detail": lead_id}).get("events") or []


def price_for(adults: int, kids: int, date: str | None, zipcode: str | None) -> dict | None:
    params = {"adults": adults, "kids": kids}
    if date:
        params["date"] = date
    if zipcode:
        params["zip"] = zipcode
    try:
        return site_get("/api/agent/price", params, admin=False)
    except ApiError:
        return None


# ---------------------------------------------------------------- renderers --
def fmt_msg(m: dict) -> str:
    who = "客" if m.get("direction") == "inbound" else "我"
    body = (m.get("body") or "").replace("\n", " ").strip()
    tag = "  [tapback·不用回]" if m.get("direction") == "inbound" and is_tapback(body) else ""
    return f"   {who} {pt(m.get('at'))}  {body}{tag}"


def brake_preview(msgs: list[dict]) -> str:
    """What sms-thread will do with the NEXT text: replies are never braked;
    unprompted follow-ups count toward daily 2 / spacing 3h / cap 3."""
    if not msgs:
        return "首条：无对话，走 T0"
    last = msgs[-1]
    if last.get("direction") == "inbound":
        return "客人最后说话 → 回复不受刹车限制"
    run = 0
    for m in reversed(msgs):
        if m.get("direction") == "inbound":
            break
        run += 1
    return f"我方已连发 {run} 条无回复 → 下一条是主动跟进（daily 2 / spacing 3h / 总量封顶 3）"


def tags_from(events: list[dict]) -> list[str]:
    out = []
    for ev in events:
        if ev.get("touchpoint_type") not in ("agent_note", "agent_first_response"):
            continue
        payload = ev.get("raw_payload_json") or {}
        note = payload.get("note") if isinstance(payload, dict) else None
        if not note:
            continue
        if TAG.search(note):
            out.append(f"{pt(ev.get('occurred_at'))} {note[:160]}")
    return out


AUTO_QUOTE = re.compile(r"price is \$([\d,.]+) for (.+?) \((.+?)\)\.")


def quoted_line(msgs: list[dict]) -> str | None:
    """The instant quote already priced this party with the date the customer
    typed; repeat that rather than re-pricing without the date."""
    for m in reversed(msgs):
        if m.get("direction") != "outbound":
            continue
        hit = AUTO_QUOTE.search(m.get("body") or "")
        if hit:
            return f"自动报价 {pt(m.get('at'))}: ${hit.group(1)} · {hit.group(2)} · {hit.group(3)}"
    return None


def price_line(row: dict, date_hint: str | None) -> str:
    guests = row.get("guest_count")
    if not guests:
        return "价: 人数未知"
    zipcode = row.get("city_or_zip") or ""
    zipcode = zipcode if re.fullmatch(r"\d{5}", zipcode) else None
    p = price_for(int(guests), 0, date_hint, zipcode)
    if not p or not p.get("ok"):
        return f"价: 引擎未算（{guests} 人；需要 zip{'' if date_hint else ' 和日期'}）→ desk price --adults {guests} --zip <zip>"
    pr = p["price"]
    return (f"价: {guests} 大人{(' ' + date_hint) if date_hint else ''} → ${pr['total']:,.2f}"
            f" ({pr['plan']}, 路费 ${pr['travelFee']:,.0f}{', zip ' + zipcode if zipcode else ', 按城市'})")


def render_card(row: dict, *, waited: str | None = None, with_thread: bool = True) -> None:
    phone = row.get("phone")
    lead_id = row.get("id")
    name = row.get("full_name") or "-"
    print("━" * 78)
    print(f"{name} · {phone or '-'} · {row.get('email') or '-'}")
    print(f"   {row.get('city_or_zip') or '-'} · {row.get('guest_count') or '?'} 人 · {row.get('status')}"
          f" · 来源 {row.get('lead_source') or '-'}/{row.get('utm_campaign') or '-'} · 建 {pt(row.get('created_at'))}"
          + (f" · 等了 {waited}" if waited else ""))
    hint = row.get("event_hint") or {}
    date_hint = hint.get("date") if isinstance(hint, dict) else None
    hold = row.get("hold_until")
    print(f"   日期线索: {date_hint or '-'} | hold: {pt(hold) if hold else '-'} | 首响: {pt(row.get('first_response_at'))}"
          f" | id {lead_id}")
    msgs = thread_for(phone, lead_id) if (with_thread and phone) else []
    print("   " + (quoted_line(msgs) or price_line(row, date_hint)))
    if lead_id:
        tags = tags_from(events_for(lead_id))
        for t in tags[:6]:
            print(f"   ⋯ {t}")
    if with_thread and phone:
        print(f"   对话 ({len(msgs)}):")
        for m in msgs[-14:]:
            print(fmt_msg(m))
        print("   刹车: " + brake_preview(msgs))


# ---------------------------------------------------------------- commands --
def cmd_next(a):
    data = site_get("/api/admin/mobile/inbox")
    counts = data.get("counts") or {}
    events = data.get("events") or []
    print(f"收件箱 {pt(data.get('serverTime'))} PT · 未回 {counts.get('unreplied', 0)} · 新线索 {counts.get('newLeads', 0)}"
          f" · 订单变动 {counts.get('changedOrders', 0)} · planner {counts.get('plannerLive', 0)}")
    if not events:
        print("没有等着我们的事。")
        return
    rows = lead_rows()
    seen = set()
    for ev in events:
        url = ev.get("url") or ""
        lead_id = urllib.parse.parse_qs(urllib.parse.urlparse(url).query).get("lead", [None])[0]
        key = ev.get("key") or ""
        phone = key.split(":")[1] if key.startswith("sms:") else None
        row = find_lead(lead_id, rows) if lead_id else (find_lead(phone, rows) if phone else None)
        ident = (row or {}).get("id") or phone or key
        if ident in seen:
            continue
        seen.add(ident)
        waited = f"{ev.get('waitedMinutes')} 分钟" if ev.get("waitedMinutes") is not None else None
        if row:
            render_card(row, waited=waited)
        else:
            print("━" * 78)
            print(f"{ev.get('title')} · {ev.get('body')} · 等了 {waited} · {url}")


def cmd_card(a):
    row = find_lead(a.ident)
    if not row:
        raise SystemExit(f"no lead for {a.ident}")
    render_card(row, with_thread=not a.no_thread)


def cmd_thread(a):
    if is_uuid(a.ident):
        row = find_lead(a.ident)
        phone, lead_id = (row or {}).get("phone"), a.ident
    else:
        phone, lead_id = e164(a.ident), None
        row = find_lead(phone)
        lead_id = (row or {}).get("id")
    msgs = thread_for(phone, lead_id)
    print(f"{phone} · {len(msgs)} 条")
    for m in msgs:
        print(fmt_msg(m))
    print("刹车: " + brake_preview(msgs))


def cmd_search(a):
    for c in site_get("/api/admin/search", {"q": a.text}).get("customers") or []:
        print("━" * 78)
        print(f"{c.get('name') or '-'} · {c.get('phone') or '-'} · {c.get('email') or '-'} · 最近 {pt(c.get('lastActivity'))}")
        for l in c.get("leads") or []:
            print(f"   线索 {l['id']}  {l.get('status')}  {l.get('city_or_zip') or '-'}  {l.get('guest_count') or '?'} 人  建 {pt(l.get('created_at'))}")
        for o in c.get("orders") or []:
            bal = o.get("balance_due_cents")
            # event_start is the party's wall-clock time stored as if UTC - print it raw, never convert
            when = (o.get("event_start") or "")[:16].replace("T", " ")
            print(f"   订单 {o.get('order_no') or o.get('id')}  {o.get('order_status') or ''}/{o.get('deposit_status') or ''}"
                  f"  {when or '-'}  {o.get('event_address') or '-'}"
                  f"{f'  尾款 ${bal / 100:,.2f}' if isinstance(bal, (int, float)) else ''}")


def cmd_price(a):
    for date in [a.date] + ([a.alt_date] if a.alt_date else []):
        p = price_for(a.adults, a.kids, date, a.zip)
        if not p or not p.get("ok"):
            print(f"{date or '(no date)'}: 引擎没算出来（zip 对吗？）")
            continue
        pr = p["price"]
        print(f"{date or '(any day)'}: {a.adults} 大人 + {a.kids} 小孩 → ${pr['total']:,.2f}  [{pr['plan']}]  "
              f"食 ${pr['foodSubtotal']:,.2f} − 人数折扣 ${pr['partySizeDiscount']:,.0f} + 路费 ${pr['travelFee']:,.2f}"
              f"{'  (最低消费生效)' if pr.get('minimumApplied') else ''}")
        if a.json:
            print(dump(p))


def cmd_travel(a):
    print(dump(site_get("/api/quote/travel-fee", {"destination": a.destination}, admin=False)))


def cmd_send(a):
    body = read_text_arg(a.body, a.body_file)
    payload = {"phone": e164(a.phone), "body": body}
    if a.lead:
        payload["leadId"] = a.lead
    if a.force:
        payload["force"] = True
    try:
        out = site_post("/api/admin/sms-thread", payload)
    except ApiError as e:
        tag = "BRAKE" if e.status == 409 else "FAIL "
        print(f"{tag} {payload['phone']} {e.status}")
        print("      " + (e.payload.get("error") if isinstance(e.payload, dict) else str(e.payload))[:400])
        if isinstance(e.payload, dict) and e.payload.get("brake"):
            print(f"      brake={e.payload['brake']}")
        sys.exit(2)
    print(f"OK    {payload['phone']}  {out.get('sid', '')}  {out.get('status', '')}")
    print(f"      {body}")


def _patch(payload: dict):
    try:
        out = site_post("/api/admin/leads", payload, method="PATCH")
    except ApiError as e:
        print(f"FAIL  {payload.get('action')} {e.status} {e.payload}")
        sys.exit(2)
    print(f"OK    {payload.get('action')}  {out}")


def cmd_note(a):
    _patch({"action": "add_note", "leadId": a.lead, "note": read_text_arg(a.note, a.body_file)})


def cmd_hold(a):
    _patch({"action": "set_hold", "leadId": a.lead, "days": a.days})


def cmd_status(a):
    _patch({"action": "set_status", "leadId": a.lead, "status": a.status})


def cmd_contacted(a):
    _patch({"action": "mark_contacted", "leadId": a.lead})


def cmd_ack(a):
    _patch({"action": "ack_replies", "leadId": a.lead, "clear": bool(a.clear)})


def cmd_fields(a):
    fields = {}
    for kv in a.pairs:
        k, _, v = kv.partition("=")
        if not k or not _:
            raise SystemExit(f"expected key=value, got {kv!r}")
        fields[k] = int(v) if re.fullmatch(r"-?\d+", v) else v
    _patch({"action": "update_fields", "leadId": a.lead, "fields": fields})


def cmd_link(a):
    if a.kind == "short":
        out = site_post("/api/admin/short-link", {"url": a.url, **({"leadId": a.lead} if a.lead else {})})
        print(out.get("shortUrl") or dump(out))
        return
    if a.kind == "planner":
        payload = {"email": a.email or "", "phone": e164(a.phone) if a.phone else "", "booked": bool(a.booked)}
        if a.lead:
            payload["leadId"] = a.lead
        out = site_post("/api/admin/planner-link", payload)
        url = out.get("url")
        if not url:
            raise SystemExit(dump(out))
        short = site_post("/api/admin/short-link", {"url": url, **({"leadId": a.lead} if a.lead else {})})
        print(short.get("shortUrl") or url)
        return
    # deposit: the same prefilled /deposit/pay the auto quote texts, hand-built
    if not a.adults or not a.city:
        raise SystemExit("deposit link needs --adults and --city")
    est = a.est
    if est is None:
        p = price_for(a.adults, a.kids, a.date, a.zip)
        est = round(p["price"]["total"]) if p and p.get("ok") else None
    q = {"source": "workbench", "location": a.city, "adults": str(a.adults), "kids": str(a.kids)}
    if est is not None:
        q["estimate_low"] = q["estimate_high"] = str(est)
    if a.date:
        q["event_date"] = a.date
    if a.time:
        q["event_time"] = a.time
    if a.email:
        q["customer_email"] = a.email
    if a.name:
        q["customer_name"] = a.name
    if a.lead:
        q["lead_id"] = a.lead
    long_url = "https://www.realhibachi.com/deposit/pay?" + urllib.parse.urlencode(q)
    out = site_post("/api/admin/short-link", {"url": long_url, **({"leadId": a.lead} if a.lead else {})})
    print(out.get("shortUrl") or dump(out))
    print(f"   {a.adults} 大人 + {a.kids} 小孩 · {a.city} · {a.date or '日期待定'}{' ' + a.time if a.time else ''}"
          f" · 估 ${est if est is not None else '?'} · 有效至 {pt(out.get('expiresAt'))}")
    if a.verbose:
        print("   " + long_url)


# ---------------------------------------------------------------- argparse --
def main(argv=None):
    ap = argparse.ArgumentParser(prog="desk", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = ap.add_subparsers(dest="cmd", required=True)

    sp.add_parser("next").set_defaults(fn=cmd_next)
    p = sp.add_parser("card"); p.add_argument("ident"); p.add_argument("--no-thread", action="store_true"); p.set_defaults(fn=cmd_card)
    p = sp.add_parser("thread"); p.add_argument("ident"); p.set_defaults(fn=cmd_thread)
    p = sp.add_parser("search"); p.add_argument("text"); p.set_defaults(fn=cmd_search)
    p = sp.add_parser("price"); p.add_argument("--adults", type=int, required=True); p.add_argument("--kids", type=int, default=0)
    p.add_argument("--date"); p.add_argument("--alt-date"); p.add_argument("--zip"); p.add_argument("--json", action="store_true"); p.set_defaults(fn=cmd_price)
    p = sp.add_parser("travel"); p.add_argument("destination"); p.set_defaults(fn=cmd_travel)
    p = sp.add_parser("send"); p.add_argument("phone"); p.add_argument("body", nargs="?"); p.add_argument("--lead")
    p.add_argument("--body-file"); p.add_argument("--force", action="store_true"); p.set_defaults(fn=cmd_send)
    p = sp.add_parser("note"); p.add_argument("lead"); p.add_argument("note", nargs="?"); p.add_argument("--body-file"); p.set_defaults(fn=cmd_note)
    p = sp.add_parser("hold"); p.add_argument("lead"); p.add_argument("days", type=int); p.set_defaults(fn=cmd_hold)
    p = sp.add_parser("status"); p.add_argument("lead"); p.add_argument("status", choices=["new", "qualified", "won", "lost", "disqualified"]); p.set_defaults(fn=cmd_status)
    p = sp.add_parser("contacted"); p.add_argument("lead"); p.set_defaults(fn=cmd_contacted)
    p = sp.add_parser("ack"); p.add_argument("lead"); p.add_argument("--clear", action="store_true"); p.set_defaults(fn=cmd_ack)
    p = sp.add_parser("fields"); p.add_argument("lead"); p.add_argument("pairs", nargs="+"); p.set_defaults(fn=cmd_fields)
    p = sp.add_parser("link"); p.add_argument("kind", choices=["deposit", "planner", "short"]); p.add_argument("url", nargs="?")
    p.add_argument("--lead"); p.add_argument("--adults", type=int); p.add_argument("--kids", type=int, default=0); p.add_argument("--city")
    p.add_argument("--date"); p.add_argument("--time"); p.add_argument("--email"); p.add_argument("--name"); p.add_argument("--phone")
    p.add_argument("--zip"); p.add_argument("--est", type=int); p.add_argument("--booked", action="store_true"); p.add_argument("--verbose", action="store_true")
    p.set_defaults(fn=cmd_link)

    a = ap.parse_args(argv)
    for key in ("lead",):
        v = getattr(a, key, None)
        if v and not is_uuid(v):
            raise SystemExit(f"--lead must be a lead id (uuid), got {v!r}")
    a.fn(a)


if __name__ == "__main__":
    main()
