# -*- coding: utf-8 -*-
"""desk - the sales desk in one command, so no session ever rewrites the tooling.

  python scripts/desk/desk.py next                         what is waiting, one full card each (one call)
  python scripts/desk/desk.py card   <phone|leadId>        the same card for one customer
  python scripts/desk/desk.py scan   [--bucket D] [--no-write] every open lead in a bucket with its reason (线索扫描 skill)
  python scripts/desk/desk.py thread <phone|leadId>        the Twilio conversation, oldest first
  python scripts/desk/desk.py search <text>                name / phone / email / order no
  python scripts/desk/desk.py price  --adults 24 [--kids 0] [--date 2026-10-13] [--zip 90802] [--alt-date ...]
  python scripts/desk/desk.py travel <destination>
  python scripts/desk/desk.py send   <phone> [body] --lead <id> [--body-file f] [--force]
  python scripts/desk/desk.py email  <to> --subject s [--body-file f] [--lead id] [--cc a b]   from support@, logged on the lead
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
  python scripts/desk/desk.py order find <text>            orders on a name / phone / email / order no
  python scripts/desk/desk.py order show <orderNo|orderId> the stored invoice: contact, guests, extras, notes, totals
  python scripts/desk/desk.py order set  <orderNo> [--date 2026-10-13] [--time 18:30] [--address ...]
                                   [--name ...] [--email ...] [--phone ...] [--notes-file f]   re-price, then save
                                   [--proteins chicken=10 steak=10 shrimp=10]   totals texted by the customer
  python scripts/desk/desk.py order preview <orderNo>      totals from the invoice engine, nothing saved
  python scripts/desk/desk.py order email <orderNo> [--notes-reviewed]   customer invoice email (+PDF, archived)
  python scripts/desk/desk.py order send  <orderNo>   email the PDF AND text the invoice link asking them to reply "confirm" (the normal way)
  python scripts/desk/desk.py order remind <orderNo> [--dry]   day before / morning of: balance + "cash to your chef is easiest, no fees"
  python scripts/desk/desk.py calls <phone|leadId>          recordings on the lead (date, length, sid)
  python scripts/desk/desk.py transcribe <phone|leadId> [--last 2] [--sid RE..] [--model small|medium] [--note] [--swap]
                                   local faster-whisper, customer/us on separate channels; --note files it on the lead

Every write goes through the workbench / invoice APIs, so it lands in the
timeline and passes the same brakes as the UI. Rules live in the leads skill;
this file only fetches, prints and posts.
"""
from __future__ import annotations

import argparse
import copy
import json
import pathlib
import re
import sys
import urllib.parse

from _api import ApiError, dump, e164, invoice_post, is_uuid, pt, read_text_arg, site_get, site_post

TAPBACK = re.compile(r"^(liked|loved|laughed at|emphasized|disliked|questioned)\s", re.I)
THUMB = re.compile(r"^\U0001F44D[\U0001F3FB-\U0001F3FF]?️?[\s.!]*$")


# Protein ids the invoice engine knows (v0 invoice repo, lib/pricing.ts).
PROTEIN_IDS = {"chicken", "steak", "shrimp", "salmon", "tofu", "scallops", "filet_mignon", "lobster_tail", "ribeye"}
# Menu price of the appetizers a free-appetizer promo can bring, so changing
# how many trays it brings moves the discount by the same amount and the
# customer is never charged for what we gave them.
APPETIZER_PRICES = {"gyoza": 15.0, "spring_rolls": 15.0, "edamame": 10.0}


def is_tapback(body: str) -> bool:
    b = (body or "").strip()
    return bool(TAPBACK.match(b) or THUMB.match(b))


def money(v) -> str:
    try:
        return f"${float(v):,.2f}"
    except (TypeError, ValueError):
        return "?"


# ---------------------------------------------------------------- renderers --
def fmt_msg(m: dict) -> str:
    who = "客" if m.get("direction") == "inbound" else "我"
    body = (m.get("body") or "").replace("\n", " ").strip()
    tag = "  [tapback·不用回]" if m.get("tapback") or (m.get("direction") == "inbound" and is_tapback(body)) else ""
    return f"   {who} {pt(m.get('at'))}  {body}{tag}"


def brake_line(stats: dict) -> str:
    """What sms-thread will do with the NEXT text: replies are never braked;
    unprompted follow-ups count toward daily 2 / spacing 3h / cap 3."""
    if not stats or not stats.get("lastAt"):
        return "首条：无对话，走 T0"
    if stats.get("lastSpeaker") == "customer":
        return "客人最后说话 → 回复不受刹车限制"
    run = stats.get("unansweredRun", 0)
    return f"我方已连发 {run} 条无回复 → 下一条是主动跟进（daily 2 / spacing 3h / 总量封顶 3；24h 内人工已发 {stats.get('ourLast24h', 0)}）"


def render_card(c: dict) -> None:
    lead = c.get("lead") or {}
    phone = c.get("phone") or lead.get("phone") or "-"
    stats = c.get("stats") or {}
    print("━" * 78)
    head = f"{lead.get('full_name') or '-'} · {phone} · {lead.get('email') or '-'}"
    if c.get("kinds"):
        head += f"   [{' '.join(c['kinds'])}]"
    if c.get("waitedMinutes") is not None:
        head += f" 等了 {c['waitedMinutes']} 分钟" + (" ⚠️" if c.get("urgent") else "")
    # Inside the 2-minute grace the phone stays silent on purpose (people send
    # one thought as three texts). The desk shows it anyway, labelled - a human
    # reading the list should never have a two-minute blind spot.
    if c.get("justArrived"):
        head += "  ⏳刚到，可能还在打字"
    print(head)
    if lead:
        print(f"   {lead.get('city_or_zip') or '-'} · {lead.get('guest_count') or '?'} 人 · {lead.get('status')}"
              f" · 来源 {lead.get('lead_source') or '-'}/{lead.get('utm_campaign') or '-'}"
              f"{(' · 词 ' + lead['utm_term']) if lead.get('utm_term') else ''} · 建 {pt(lead.get('created_at'))}")
        hint = lead.get("event_hint") or {}
        flags = []
        if stats.get("onHold"):
            flags.append(f"hold→{pt(lead.get('hold_until'))}")
        if lead.get("sms_blocked_at"):
            flags.append("短信打不通(30003/30006)")
        if stats.get("quiet"):
            flags.append("不响铃(致谢/挂起/已标不用回)")
        print(f"   日期线索: {hint.get('date') or '-'} | 首响: {pt(lead.get('first_response_at'))} | {' | '.join(flags) or '无挂起'} | id {lead.get('id')}")
    quoted = c.get("quoted")
    price = c.get("price")
    if quoted:
        print(f"   自动报价 {pt(quoted.get('at'))}: ${quoted.get('total')} · {quoted.get('guests')} · {quoted.get('plan')}")
    elif price and price.get("customQuote"):
        print(f"   价: {price.get('adults')} 人属大单（31+），走 §5.0 成交包")
    elif price and price.get("options"):
        opts = " / ".join(f"{money(o['total'])} {o['plan']}" for o in price["options"])
        print(f"   引擎价 {price.get('adults')} 大人{(' ' + price['date']) if price.get('date') else ''}: {opts}"
              f"{'' if price.get('travelKnown') else '  (路费未算: 线索无 zip → desk price --zip)'}")
    elif lead:
        print("   价: 人数未知")
    for t in (c.get("tags") or [])[:6]:
        print(f"   ⋯ {pt(t.get('at'))} {t.get('note', '')[:160]}")
    for at in c.get("calls") or []:
        print(f"   ☎ 来电 {pt(at)}")
    for o in c.get("orders") or []:
        when = (o.get("event_start") or "")[:16].replace("T", " ")  # wall time stored as UTC - never convert
        bal = o.get("balance_due_cents")
        meta = o.get("source_metadata") or {}
        print(f"   订单 {o.get('order_no') or o.get('id')}  {o.get('order_status') or ''}/{o.get('deposit_status') or ''}/{o.get('details_status') or ''}"
              f"  {when or '未定'}{'（时间待定）' if isinstance(meta, dict) and meta.get('event_time_tbd') else ''}  {o.get('event_address') or '-'}"
              f"  {o.get('guest_adult_count') or '?'}大{o.get('guest_child_count') or 0}小"
              f"{f'  尾款 ${bal / 100:,.2f}' if isinstance(bal, (int, float)) else ''}")
    thread = c.get("thread") or []
    print(f"   对话 ({len(thread)}):")
    for m in thread[-14:]:
        print(fmt_msg(m))
    print("   刹车: " + brake_line(stats))


# ---------------------------------------------------------------- commands --
def cmd_next(a):
    data = site_get("/api/admin/desk")
    counts = data.get("counts") or {}
    print(f"收件箱 {pt(data.get('serverTime'))} PT · 未回 {counts.get('unreplied', 0)} · 新线索 {counts.get('newLeads', 0)}"
          f" · 订单变动 {counts.get('changedOrders', 0)} · planner {counts.get('plannerLive', 0)} · reddit {counts.get('redditNew', 0)}")
    cards = data.get("cards") or []
    if not cards:
        print("没有等着我们的事。")
        return
    for c in cards:
        render_card(c)
    if a.json:
        print(dump(data))


BUCKETS = [
    ("A", "欠回复", "立刻回：事实直发，聊类拟稿"),
    ("C", "热信号", "10 分钟内动：答疑或递链接（唯一该主动递链接的时候）"),
    ("G", "已付未齐", "运营催齐，不受刹车"),
    ("B", "承诺到期", "接着他自己的话问，不是催"),
    ("F", "隐性异议", "按让步带宽出牌：桌椅换锁日期 / 周中 $500 底线 / 先问数再让"),
    ("E", "派对临近", "真时钟 + 开门句；满 3 条的要 force，先给老板看"),
    ("D", "到期跟进", "台阶句 + 一个真理由 + 一个好答的问题；一批一次批"),
    ("H", "停", "不发；needs_hold 的挂 14 天"),
]


def cmd_scan(a):
    data = site_get("/api/admin/scan", {"write": "0" if a.no_write else "1"})
    items = data.get("items") or []
    orders = data.get("orders") or []
    summ = data.get("summary") or {}
    print(f"扫描 {pt(data.get('serverTime'))} PT · 池 {data.get('pool')} · "
          + " · ".join(f"{k} {summ.get(k, 0)}" for k, _, _ in BUCKETS))
    want = (a.bucket or "").upper()

    def line(it: dict) -> str:
        bits = [it.get("name") or "-", it.get("phone") or "-", it.get("city") or "-", f"{it.get('guests') or '?'} 人"]
        if it.get("eventDate"):
            d = it.get("daysToEvent")
            bits.append(f"{it['eventDate']}{f' ({d} 天)' if d is not None else ''}")
        q = it.get("quoted")
        if q:
            bits.append(f"报价 ${q.get('total')}")
        flags = [f for f in (it.get("flags") or []) if f not in ("has_paid_order",)]
        return f"   {' · '.join(bits)}\n      → {it.get('reason')}" + (f"   [{' '.join(flags)}]" if flags else "")

    for key, label, action in BUCKETS:
        if want and key != want:
            continue
        if key == "G":
            rows = orders
        elif key == "F":
            rows = [it for it in items if it.get("objection")]
        else:
            rows = [it for it in items if it.get("bucket") == key and not (key in ("D", "E") and it.get("objection"))]
        if not rows:
            continue
        print("━" * 78)
        print(f"{key} {label} · {len(rows)} · {action}")
        for it in rows:
            if key == "G":
                when = (it.get("eventStart") or "")[:16].replace("T", " ")
                dte = it.get("daysToEvent")
                days = f" ({dte} 天)" if dte is not None else ""
                gaps = "、".join(it.get("gaps") or [])
                lead_ref = f"   lead {it.get('leadId')}" if it.get("leadId") else ""
                print(f"   {it.get('orderNo')} · {it.get('name') or '-'} · {it.get('phone') or '-'} · {when}{days}")
                print(f"      → 缺：{gaps}{lead_ref}")
            else:
                print(line(it) + f"   id {it.get('leadId')}")
        if want and key != "G":
            # The full card for each, so the wording can be written from the thread.
            for it in rows:
                for c in (site_get("/api/admin/desk", {"lead": it["leadId"]}).get("cards") or []):
                    render_card(c)
    if a.json:
        print(dump(data))


def cmd_card(a):
    params = {"lead": a.ident} if is_uuid(a.ident) else {"phone": e164(a.ident)}
    data = site_get("/api/admin/desk", params)
    for c in data.get("cards") or []:
        render_card(c)
    if a.json:
        print(dump(data))


def cmd_thread(a):
    params = {"leadId": a.ident} if is_uuid(a.ident) else {"phone": e164(a.ident)}
    d = site_get("/api/admin/sms-thread", params)
    msgs = sorted(d.get("messages") or [], key=lambda m: m.get("at") or "")
    print(f"{', '.join(d.get('phones') or [])} · {len(msgs)} 条")
    for m in msgs:
        print(fmt_msg(m))


def _search(text: str) -> list[dict]:
    return site_get("/api/admin/search", {"q": text}).get("customers") or []


def cmd_search(a):
    for c in _search(a.text):
        print("━" * 78)
        print(f"{c.get('name') or '-'} · {c.get('phone') or '-'} · {c.get('email') or '-'} · 最近 {pt(c.get('lastActivity'))}")
        for l in c.get("leads") or []:
            print(f"   线索 {l['id']}  {l.get('status')}  {l.get('city_or_zip') or '-'}  {l.get('guest_count') or '?'} 人  建 {pt(l.get('created_at'))}")
        for o in c.get("orders") or []:
            when = (o.get("event_start") or "")[:16].replace("T", " ")
            bal = o.get("balance_due_cents")
            print(f"   订单 {o.get('order_no') or o.get('id')}  {o.get('order_status') or ''}/{o.get('deposit_status') or ''}"
                  f"  {when or '-'}  {o.get('event_address') or '-'}"
                  f"{f'  尾款 ${bal / 100:,.2f}' if isinstance(bal, (int, float)) else ''}  id {o.get('id')}")


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


def cmd_price(a):
    for date in [a.date] + ([a.alt_date] if a.alt_date else []):
        p = price_for(a.adults, a.kids, date, a.zip)
        if not p or not p.get("ok"):
            print(f"{date or '(no date)'}: 引擎没算出来（zip 对吗？）")
            continue
        pr = p["price"]
        # total = the cash price (10% cash discount offsets the tax); cardTotal = +10% sales tax (2026-10-06 terms).
        card = f"  刷卡/Venmo/Zelle ${pr['cardTotal']:,.2f}（+10% 税）" if isinstance(pr.get("cardTotal"), (int, float)) else ""
        print(f"{date or '(any day)'}: {a.adults} 大人 + {a.kids} 小孩 → 现金 ${pr['total']:,.2f}{card}  [{pr['plan']}]  "
              f"食 ${pr['foodSubtotal']:,.2f} − 人数折扣 ${pr['partySizeDiscount']:,.0f} + 路费 ${pr['travelFee']:,.2f}"
              f"{'  (最低消费生效)' if pr.get('minimumApplied') else ''}")
        if a.json:
            print(dump(p))


def cmd_travel(a):
    print(dump(site_get("/api/quote/travel-fee", {"destination": a.destination}, admin=False)))


def cmd_send(a):
    # argparse cannot take a positional after `--lead <id>`, so the body may
    # also come as --body / --body-file (the file is the safe path on Windows).
    body = read_text_arg(a.body_opt or a.body, a.body_file)
    if a.media:
        # A picture: Twilio directly (the workbench endpoint is text-only), so
        # the brakes and the context lint do not run - use it for REPLIES, a
        # customer who spoke last, never for an unprompted follow-up. The
        # timeline is healed right after by opening the thread.
        from _api import signed_sales_media_url, twilio_send, upload_sales_media
        import datetime
        src = pathlib.Path(a.media)
        dest = f"sent/{datetime.date.today().isoformat()}/{re.sub(r'[^A-Za-z0-9._-]', '_', src.name)}"
        ctype = "image/png" if src.suffix.lower() == ".png" else "image/jpeg"
        upload_sales_media(str(src), dest, ctype)
        url = signed_sales_media_url(dest)
        try:
            out = twilio_send(e164(a.phone), body, url)
        except ApiError as e:
            print(f"FAIL  {e164(a.phone)} {e.status}\n      {e.payload}")
            sys.exit(2)
        print(f"OK    {e164(a.phone)}  {out.get('sid', '')}  {out.get('status', '')}  +1 media ({src.name})")
        print(f"      {body}")
        if a.lead:
            site_get("/api/admin/sms-thread", {"leadId": a.lead})  # reconcile into the timeline
        return
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


def cmd_email(a):
    """A customer email from support@, logged on the lead when --lead is given.
    For what a text cannot carry: carriers filter alcohol words on business
    texting, so the drinks answer goes by email (2026-09-29)."""
    text = read_text_arg(a.body, a.body_file)
    if not text.strip():
        raise SystemExit("empty email - pass the text or --body-file")
    payload = {"to": a.to, "subject": a.subject, "text": text}
    if a.lead:
        payload["leadId"] = a.lead
    if a.cc:
        payload["cc"] = a.cc
    res = site_post("/api/admin/send-followup", payload)
    print(f"OK    emailed {a.to}  {dump(res)[:200]}")
    print("      " + a.subject)


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
        k, sep, v = kv.partition("=")
        if not k or not sep:
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
        est = round(p["price"]["total"]) if p and p.get("ok") and p.get("price") else None
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


# ---------------------------------------------------------------- orders ----
# The invoice app owns the party's details (guests, extras, notes, time). The
# proven path (wk_invoices.py, 09-25): lookup by the customer's contact ->
# prefill (the canonical InvoiceData) -> change -> /api/invoice to price ->
# save-invoice with the order id. Lookup returns the newest order for that
# contact, so the order number is checked before anything is saved.

def _order_row(ident: str) -> dict:
    """The marketing order row (id, order_no, contact) for an order no / id."""
    for c in _search(ident):
        for o in c.get("orders") or []:
            if o.get("order_no") == ident or o.get("id") == ident:
                o.setdefault("customer_email", c.get("email"))
                o.setdefault("customer_phone", c.get("phone"))
                return o
    raise SystemExit(f"no order matches {ident!r}")


def _lookup(order: dict) -> tuple[dict, dict]:
    """(invoice order, prefill) for the marketing order row, verified by number."""
    look = invoice_post("/api/self-service/orders/lookup", {"email": order.get("customer_email") or "", "phone": order.get("customer_phone") or ""})
    if not look.get("found"):
        raise SystemExit(f"invoice lookup found nothing for {order.get('order_no')}: {look.get('message')}")
    inv_order = look["order"]
    if inv_order.get("orderNo") != order.get("order_no"):
        raise SystemExit(f"lookup returned {inv_order.get('orderNo')} (newest for this contact), not {order.get('order_no')} - not touching it")
    return inv_order, look["prefill"]


def _totals(data: dict) -> dict:
    return invoice_post("/api/invoice", data)["invoice"]


def _print_totals(inv: dict) -> None:
    print(f"   base {money(inv.get('baseCost'))} | promos -{money(inv.get('promotionsTotal'))} | extras {money(inv.get('partyExtrasCost'))}"
          f" | travel {money(inv.get('travelFee'))} | TOTAL {money(inv.get('finalTotal'))} | deposit {money(inv.get('deposit'))} | BALANCE {money(inv.get('balanceDue'))}")
    # v2 terms (orders from 2026-10-06): TOTAL / BALANCE above are the cash figures;
    # card / Venmo / Zelle pay the 10% sales tax on top (gratuity untaxed).
    if inv.get("pricingTerms") == "v2_tax_added":
        print(f"   v2 税前价 · sales tax {money(inv.get('salesTax'))} · 现金折扣 -{money(inv.get('cashDiscount'))}"
              f" · CARD TOTAL {money(inv.get('cardTotal'))} · CARD BALANCE {money(inv.get('cardBalanceDue'))}")
    else:
        print("   v1 含税价 · 刷卡/Venmo/Zelle +4%")


def _print_invoice(order_no: str, data: dict) -> None:
    c = data.get("contactInfo") or {}
    print(f"{order_no} · {c.get('clientName') or '-'} · {c.get('phone') or '-'} · {c.get('email') or '-'}")
    print(f"   {c.get('eventDate') or '日期未定'} {c.get('eventTime') or ''} · {c.get('eventAddress') or '地址未定'}")
    print(f"   {data.get('adultCount')} 大 {data.get('childCount')} 小 · mode {data.get('mode')} · pay {data.get('paymentMethod')} · deposit {money(data.get('depositAmount'))}")
    for g in data.get("guests") or []:
        bits = [", ".join(g.get("proteins") or []) or "(no proteins)"]
        if g.get("noodles"): bits.append("noodles")
        if g.get("tablesChairs"): bits.append("table+chair")
        if g.get("utensils"): bits.append("utensils")
        if g.get("foodAllergy"): bits.append(f"ALLERGY: {g['foodAllergy']}")
        if g.get("note"): bits.append(g["note"])
        print(f"     {'小' if g.get('isChild') else '大'} {g.get('name') or '-'}: {' · '.join(bits)}")
    # Quick mode carries the menu as party-wide counts instead of guest rows,
    # which is how a texted menu lands ("15 steaks 10 shrimps 5 chickens").
    # Without this the proteins were saved but invisible here, so there was no
    # way to check what went in (Frank Musso, 2026-09-30).
    for q in data.get("quickCountItems") or []:
        qty = q.get("qty")
        child = q.get("childQty")
        print(f"   · {q.get('category', '?')} {q.get('itemId')}: {qty}"
              + (f" + {child} child" if child else ""))
    for x in data.get("partyExtras") or []:
        print(f"   + extra {x}")
    for p in data.get("promotions") or []:
        print(f"   - promo {p.get('label') or p.get('id') or p}: {money(p.get('amount'))}")
    if data.get("customDeal"):
        print(f"   custom deal: {json.dumps(data['customDeal'], ensure_ascii=False)[:200]}")
    notes = (c.get("specialNotes") or "").strip()
    print(f"   NOTES(客户会看到): {notes or '(空)'}")


def cmd_order(a):
    if a.op == "find":
        for c in _search(a.ident):
            for o in c.get("orders") or []:
                when = (o.get("event_start") or "")[:16].replace("T", " ")
                print(f"{o.get('order_no')}  {c.get('name') or '-'} · {c.get('phone') or '-'} · {c.get('email') or '-'}"
                      f"  {o.get('order_status') or ''}/{o.get('deposit_status') or ''}  {when or '-'}  {o.get('event_address') or '-'}  id {o.get('id')}")
        return
    order = _order_row(a.ident)
    order_no = order.get("order_no")
    if a.op == "show":
        # The invoice app's prefill is the canonical InvoiceData (it builds
        # guest rows from the counts when the menu is not in yet); the
        # marketing row adds what the customer never sees.
        try:
            _, data = _lookup(order)
        except SystemExit as why:
            print(f"   (lookup: {why}; showing the stored invoice_data instead)")
            data = None
        detail = site_get("/api/admin/orders", {"id": order["id"]})
        row = detail.get("order") if isinstance(detail.get("order"), dict) else {}
        if not data:
            data = row.get("invoice_data") or {}
        _print_invoice(order_no, data)
        if row.get("internal_notes"):
            print(f"   内部备注(客户看不到): {str(row['internal_notes'])[:300]}")
        try:
            _print_totals(_totals(data))
        except ApiError as e:
            print(f"   totals: 引擎拒绝 {e.payload}")
        if a.json:
            print(dump(detail))
        return
    inv_order, prefill = _lookup(order)
    if a.op == "preview":
        _print_invoice(order_no, prefill)
        # /api/invoice already mints a PDF token to price the invoice; printing
        # the url it hands back is what "let me look at it first" needs, and
        # saves pasting the order into the invoice tool to see the same page.
        # It is the customer's view, so it is also what they will receive.
        priced = invoice_post("/api/invoice", {**prefill, "orderNo": order_no})
        _print_totals(priced["invoice"])
        if priced.get("pdfUrl"):
            # The url comes back on whatever host we posted to, which is the
            # staff tool's (invoice.*, password-gated at its root). Customers
            # get party.* - the same app, the name we have always texted them.
            print(f"   PDF(客户视角): {priced['pdfUrl'].replace('//invoice.', '//party.')}&view=confirmed")
        return
    if a.op == "set":
        data = copy.deepcopy(prefill)
        c = data.setdefault("contactInfo", {})
        changes = []
        for key, val in (("eventDate", a.date), ("eventTime", a.time), ("eventAddress", a.address), ("clientName", a.name), ("email", a.email), ("phone", a.phone)):
            if val is not None:
                changes.append(f"{key}: {c.get(key)!r} -> {val!r}")
                c[key] = val
        if a.notes_file:
            new_notes = pathlib.Path(a.notes_file).read_bytes().decode("utf-8").strip()
            changes.append(f"specialNotes: {c.get('specialNotes')!r} -> {new_notes!r}")
            c["specialNotes"] = new_notes
        if a.free_appetizer_trays is not None:
            # The free appetizer used to be one tray whatever the party size, so
            # 21 people shared 10 gyoza (Annie Phan, 10/01). Owner 2026-10-01:
            # give a tray per 10 guests. The promo line and the extras have to
            # move together - the promo's amount includes the menu price of what
            # it brings, so raising the trays without raising the amount would
            # bill the customer for the gift.
            want = max(1, int(a.free_appetizer_trays))
            promo = next((p for p in (data.get("promotions") or [])
                          if re.search(r"free appetizer|appetizer platter", str(p.get("label") or ""), re.I)), None)
            if not promo:
                raise SystemExit("this order has no free-appetizer promotion line - add the promo in the invoice tool first")
            named = [i for i in APPETIZER_PRICES if re.search(i.replace("_", "[ _]"), str(promo.get("label") or ""), re.I)]
            if not named:  # "appetizer platter" names none of them: it is all three
                named = sorted(APPETIZER_PRICES)
            extras = data.setdefault("partyExtras", [])
            delta = 0.0
            for app_id in named:
                row = next((e for e in extras if e.get("id") == app_id), None)
                have = int(row.get("qty") or 0) if row else 0
                if row:
                    row["qty"] = want
                else:
                    extras.append({"id": app_id, "qty": want})
                delta += (want - have) * APPETIZER_PRICES[app_id]
            promo["amount"] = round(float(promo.get("amount") or 0) + delta, 2)
            changes.append(f"free appetizer: {', '.join(named)} -> {want} tray(s) each; "
                           f"promo '{str(promo.get('label'))[:40]}…' amount {promo['amount']:.2f} ({delta:+.2f})")
        if a.travel_miles is not None:
            # The invoice charges travel from distanceMiles (first 50 free, $1/mi,
            # same rule as the site); a deposit-created order starts with none,
            # so an address without this line would be invoiced at $0 travel.
            tf = data.setdefault("travelFee", {})
            changes.append(f"travelFee.distanceMiles: {tf.get('distanceMiles')!r} -> {a.travel_miles!r}")
            tf["distanceMiles"] = float(a.travel_miles)
            tf.setdefault("ratePerMile", 1)
            tf.setdefault("freeRadiusMiles", 50)
            tf.setdefault("manualOverride", None)
            tf.setdefault("homeZipcode", tf.get("homeZipcode") or "")
        if a.proteins:
            # A customer who texts "chicken, steak and shrimp for 15" has given
            # totals, not a pick per guest - that is what quick mode is for.
            # Servings past two per guest are billed as extras by the engine,
            # so the count here is the menu, not the chef's safety margin.
            has_picks = any((g.get("proteins") or g.get("protein1") or g.get("protein2")) for g in (data.get("guests") or []))
            if has_picks and data.get("mode") != "quick":
                raise SystemExit("this order already has per-guest picks - change those in the planner / invoice tool, not with --proteins")
            items = [q for q in (data.get("quickCountItems") or []) if q.get("category") != "protein"]
            before = [f"{q.get('itemId')}={q.get('qty')}" for q in (data.get("quickCountItems") or []) if q.get("category") == "protein"]
            adult_servings = 0
            for pair in a.proteins:
                m = re.fullmatch(r"([a-z_]+)=(\d+)(?:/(\d+))?", pair)
                if not m or m.group(1) not in PROTEIN_IDS:
                    raise SystemExit(f"--proteins {pair!r}: use id=N with id in {sorted(PROTEIN_IDS)}")
                item = {"itemId": m.group(1), "category": "protein", "qty": int(m.group(2))}
                if m.group(3):
                    item["childQty"] = int(m.group(3))
                adult_servings += item["qty"]
                items.append(item)
            changes.append(f"proteins: {before or 'none'} -> {a.proteins}")
            if data.get("mode") != "quick":
                changes.append(f"mode: {data.get('mode')!r} -> 'quick'")
                data["mode"] = "quick"
                data["guests"] = []
            data["quickCountItems"] = items
            expected = 2 * int(data.get("adultCount") or 0)
            if adult_servings != expected:
                print(f"   ! {adult_servings} adult servings for {data.get('adultCount')} adults - two each would be {expected}; extras are billed")
        # "Can I add one more?" the day of. order set used to have no answer for
        # a detailed-mode party: --proteins refuses one (and would wipe every
        # guest's picks), so the only route was the planner. The new rows copy
        # the last guest of that kind, because a late add is almost always "same
        # as everyone else" - and because an empty proteins list bills
        # differently from a filled one, so leaving it blank is not neutral.
        for kind, count in (("adult", a.add_adult), ("child", a.add_child)):
            if not count:
                continue
            if count < 1:
                raise SystemExit(f"--add-{kind} needs a positive number")
            is_child = kind == "child"
            guests = data.setdefault("guests", [])
            if data.get("mode") == "quick":
                raise SystemExit("this order carries party-wide counts, not guest rows - change the headcount with --proteins instead")
            like = next((g for g in reversed(guests) if bool(g.get("isChild")) == is_child), None)
            if like is None:
                raise SystemExit(f"no existing {kind} row to copy - add the first one in the planner so the proteins are the guest's own")
            key = "adultCount" if not is_child else "childCount"
            before = int(data.get(key) or 0)
            for i in range(count):
                guests.append({
                    "name": f"Guest {len(guests) + 1}",
                    "isChild": is_child,
                    "proteins": list(like.get("proteins") or []),
                    "noodles": bool(like.get("noodles")),
                    "tablesChairs": bool(like.get("tablesChairs")),
                    "utensils": bool(like.get("utensils")),
                })
            data[key] = before + count
            changes.append(f"{key}: {before} -> {before + count} (copied {', '.join(like.get('proteins') or ['no proteins'])})")
            # Promotions are stored as a dollar amount, not a rule, so the
            # per-head ones keep the number they were computed at and silently
            # overcharge the new guest. Gregorio 2026-10-05: one late adult left
            # the Weekday Special at 13 adults and "Tables & Chairs on us" at 17
            # guests, $15 too little off. Nothing here can re-derive those rates
            # from an amount, so say so loudly rather than guess.
            stale = [x for x in (data.get("promotions") or [])
                     if str(x.get("id", "")).startswith("official_weekday") or str(x.get("id", "")).startswith("deal_")]
            for x in stale:
                print(f"   ⚠ promo {x.get('id')} is still {money(x.get('amount'))}, computed for the OLD headcount - "
                      f"re-state it with --promo {x.get('id')}=<amount> or the extra guest is overcharged")
        if a.promo:
            promos = data.setdefault("promotions", [])
            for pair in a.promo:
                m = re.fullmatch(r"([A-Za-z0-9_]+)=(\d+(?:\.\d{1,2})?)", pair)
                if not m:
                    raise SystemExit(f"--promo {pair!r}: use id=AMOUNT, e.g. official_weekday=89.80")
                pid, amount = m.group(1), float(m.group(2))
                hit = next((x for x in promos if x.get("id") == pid), None)
                if hit is None:
                    raise SystemExit(f"--promo {pid}: this invoice has no such promotion ({[x.get('id') for x in promos]})")
                changes.append(f"promo {pid}: {money(hit.get('amount'))} -> {money(amount)}")
                hit["amount"] = amount
        if not changes:
            raise SystemExit("nothing to change - pass --date/--time/--address/--name/--email/--phone/--notes-file/--travel-miles/--proteins/--free-appetizer-trays/--add-adult/--add-child/--promo")
        if a.date and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", a.date):
            raise SystemExit("--date must be YYYY-MM-DD")
        if a.time and not re.fullmatch(r"\d{2}:\d{2}", a.time):
            raise SystemExit("--time must be HH:MM (24h)")
        # Promotions are stored as data, so a date change can leave a Weekday
        # Special on a Friday (Esme, 09-27: the deposit link seeded a Monday
        # placeholder date). The site's rule decides (holidays included);
        # dropping the promo also drops the free appetizer it bundled.
        if a.date:
            p = price_for(int(data.get("adultCount") or 0), int(data.get("childCount") or 0), a.date, None)
            applies = bool(p and p.get("ok") and str(p.get("weekdaySpecial", "")).startswith("applies"))
            promos = data.get("promotions") or []
            weekday = [x for x in promos if str(x.get("id", "")).startswith("official_weekday")]
            if weekday and not applies:
                for x in weekday:
                    m = re.search(r"FREE appetizer:\s*([A-Za-z ]+)", x.get("label") or "")
                    if m:
                        app_id = m.group(1).strip().lower().replace(" ", "_")
                        extras = data.get("partyExtras") or []
                        for ex in extras:
                            if ex.get("id") == app_id and int(ex.get("qty") or 0) > 0:
                                ex["qty"] = int(ex["qty"]) - 1
                                changes.append(f"partyExtras: {app_id} qty -1 (was the weekday promo's free appetizer)")
                                break
                        data["partyExtras"] = [ex for ex in extras if int(ex.get("qty") or 0) > 0]
                data["promotions"] = [x for x in promos if x not in weekday]
                changes.append(f"promotions: removed {[x['id'] for x in weekday]} - {a.date} is not a weekday-special date")
            elif applies and not weekday:
                print(f"   ⚠ {a.date} qualifies for the Weekday Special but the invoice has no official_weekday promo - add it in the invoice tool")
        # The deposit webhook seeds the customer-visible NOTES with a process
        # string; replacing or clearing it here is always right (it is
        # filtered at print time anyway, 09-25).
        if (c.get("specialNotes") or "").startswith("Auto-generated booking") and not a.notes_file:
            changes.append("specialNotes: dropped the auto-generated placeholder")
            c["specialNotes"] = ""
        for ch in changes:
            print("   " + ch)
        # Price it before saving when the engine can: a party whose menu is not
        # in yet has no guest rows, and /api/invoice refuses detailed mode
        # without them, while save-invoice (lib/invoice-validate.ts) accepts it.
        try:
            _print_totals(_totals(data))
        except ApiError as e:
            print(f"   totals: 引擎暂时算不了（{(e.payload.get('errors') if isinstance(e.payload, dict) else e.payload)}）- 菜单录进来后再看")
        res = invoice_post("/api/self-service/orders/save-invoice", {"orderId": order["id"], "invoiceData": data})
        print(f"OK    saved {res.get('orderNo')}  planner_synced={res.get('plannerSynced')}")
        return
    if a.op == "remind":
        # Owner 2026-10-05: the text before the party says what is left to pay
        # and that cash to the chef is easiest - cash is the price, and card,
        # Venmo and Zelle add 4%. The balance comes from the invoice engine, the
        # same number the chef's sheet and /pay use.
        import datetime as _dt
        from zoneinfo import ZoneInfo
        c = prefill.get("contactInfo") or {}
        date, hhmm = str(c.get("eventDate") or "")[:10], str(c.get("eventTime") or "")
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date) or not re.fullmatch(r"\d{2}:\d{2}", hhmm):
            raise SystemExit(f"the invoice needs the party date and time first (has {date!r} {hhmm!r})")
        inv = _totals(prefill)
        _print_totals(inv)
        balance = float(inv.get("balanceDue") or 0)
        if balance <= 0:
            raise SystemExit("nothing left to pay - no reminder needed")
        party = _dt.date.fromisoformat(date)
        days = (party - _dt.datetime.now(ZoneInfo("America/Los_Angeles")).date()).days
        hh, mm = (int(x) for x in hhmm.split(":"))
        if days == 0:
            when = "tonight" if hh >= 17 else "today"
        elif days == 1:
            when = "tomorrow"
        else:
            raise SystemExit(f"the party is {days} days away - this goes out the day before (or the morning of)")
        at = f"{(hh + 11) % 12 + 1}{f':{mm:02d}' if mm else ''}"
        if inv.get("pricingTerms") == "v2_tax_added":
            # 2026-10-06 terms: cash balance already carries the 10% cash discount;
            # card / Venmo / Zelle balance includes the 10% sales tax. Never "no tax".
            card = float(inv.get("cardBalanceDue") or 0)
            body = (f"See you {when} at {at}! Your balance is {money(balance)} in cash (that's with your 10% cash discount), "
                    f"or {money(card)} by card, Venmo or Zelle.")
        else:
            body = f"See you {when} at {at}! Your balance is {money(balance)} - cash to your chef at the end is easiest, no fees."
        if a.dry:
            print(f"DRY   {body}")
            return
        detail = site_get("/api/admin/orders", {"id": order["id"]})
        row = detail.get("order") if isinstance(detail.get("order"), dict) else {}
        lead_id = ((row.get("source_metadata") or {}).get("lead_id")) or a.lead
        phone = e164(row.get("customer_phone") or order.get("customer_phone") or "")
        if not phone:
            raise SystemExit("no phone on the order")
        sent = site_post("/api/admin/sms-thread", {"phone": phone, "body": body, **({"leadId": lead_id} if lead_id else {})})
        print(f"OK    texted {phone}  {sent.get('sid', '')}\n      {body}")
        return
    if a.op in ("email", "send"):
        _print_invoice(order_no, prefill)
        _print_totals(_totals(prefill))
        payload = {"invoiceData": prefill, "orderNo": order_no}
        if a.notes_reviewed:
            payload["notesReviewed"] = True
        try:
            res = invoice_post("/api/invoice/email", payload, timeout=180)
        except ApiError as e:
            if e.status == 409 and isinstance(e.payload, dict) and e.payload.get("error") == "notes_need_review":
                print("HOLD  notes_need_review - 发票 NOTES 里有内部内容。会印给客户的行 / 会被丢掉的行：")
                print(dump({k: v for k, v in e.payload.items() if k != "error"})[:2000])
                print("      看完再决定：改干净备注（order set --notes-file），或 --notes-reviewed 发过滤后的版本。")
                sys.exit(3)
            raise
        print(f"OK    emailed {res.get('email')}  pdf={res.get('pdfAttached')}  archive={res.get('archiveId')}")
        if res.get("notesPrinted") is not None:
            print(f"      notes printed: {res.get('notesPrinted')}")
        if a.op == "send":
            # Owner 2026-09-30: the email carries the PDF; the text carries the
            # link and the ask, and the customer confirms in the text thread.
            # (The invoice email's sender, notify@, has no mailbox - Daria's
            # emailed "confirm" bounced.)
            detail = site_get("/api/admin/orders", {"id": order["id"]})
            row = detail.get("order") if isinstance(detail.get("order"), dict) else {}
            lead_id = ((row.get("source_metadata") or {}).get("lead_id")) or a.lead
            phone = e164(row.get("customer_phone") or order.get("customer_phone") or "")
            url = res.get("invoiceUrl")
            if not (url and phone):
                raise SystemExit(f"emailed, but no text sent: invoiceUrl={url!r} phone={phone!r}")
            short = site_post("/api/admin/short-link", {"url": url, **({"leadId": lead_id} if lead_id else {})}).get("shortUrl") or url
            day = ""
            date = (prefill.get("contactInfo") or {}).get("eventDate") or ""
            if re.fullmatch(r"\d{4}-\d{2}-\d{2}", date):
                import datetime as _dt
                day = _dt.date.fromisoformat(date).strftime("%A")
            body = (f"Here's your invoice{' for ' + day if day else ''}: {short} - please look it over and reply "
                    f"\"confirm\" here if it's all right. A PDF copy is in your email too.")
            payload = {"phone": phone, "body": body}
            if lead_id:
                payload["leadId"] = lead_id
            sent = site_post("/api/admin/sms-thread", payload)
            print(f"OK    texted {phone}  {sent.get('sid', '')}\n      {body}")
        return


# ---------------------------------------------------------------- argparse --
def main(argv=None):
    ap = argparse.ArgumentParser(prog="desk", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = ap.add_subparsers(dest="cmd", required=True)

    p = sp.add_parser("next"); p.add_argument("--json", action="store_true"); p.set_defaults(fn=cmd_next)
    p = sp.add_parser("card"); p.add_argument("ident"); p.add_argument("--json", action="store_true"); p.set_defaults(fn=cmd_card)
    p = sp.add_parser("scan"); p.add_argument("--bucket", help="A C G B F E D H - print the full card of each lead in that bucket")
    p.add_argument("--no-write", action="store_true", help="do not store the bucket in leads.segment / next_action_at")
    p.add_argument("--json", action="store_true"); p.set_defaults(fn=cmd_scan)
    p = sp.add_parser("thread"); p.add_argument("ident"); p.set_defaults(fn=cmd_thread)
    p = sp.add_parser("search"); p.add_argument("text"); p.set_defaults(fn=cmd_search)
    p = sp.add_parser("price"); p.add_argument("--adults", type=int, required=True); p.add_argument("--kids", type=int, default=0)
    p.add_argument("--date"); p.add_argument("--alt-date"); p.add_argument("--zip"); p.add_argument("--json", action="store_true"); p.set_defaults(fn=cmd_price)
    p = sp.add_parser("travel"); p.add_argument("destination"); p.set_defaults(fn=cmd_travel)
    p = sp.add_parser("send"); p.add_argument("phone"); p.add_argument("body", nargs="?"); p.add_argument("--lead")
    p.add_argument("--body", dest="body_opt"); p.add_argument("--body-file"); p.add_argument("--force", action="store_true")
    p.add_argument("--media", help="a local jpg/png to attach (MMS via Twilio; replies only)"); p.set_defaults(fn=cmd_send)
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
    # Calls: recordings on the lead, transcribed locally with the speakers
    # known (scripts/desk/calls.py). Imported lazily - faster-whisper is slow to load.
    def _calls(a):
        import calls
        calls.cmd_calls(a)

    def _transcribe(a):
        import calls
        calls.cmd_transcribe(a)

    p = sp.add_parser("calls"); p.add_argument("ident"); p.set_defaults(fn=_calls)
    p = sp.add_parser("transcribe"); p.add_argument("ident"); p.add_argument("--last", type=int, default=1); p.add_argument("--sid")
    p.add_argument("--model", default="small", choices=["base", "small", "medium"]); p.add_argument("--note", action="store_true")
    p.add_argument("--swap", action="store_true", help="flip who is 客/我 if the channels came the other way round")
    p.add_argument("--json", action="store_true"); p.set_defaults(fn=_transcribe)
    p = sp.add_parser("email"); p.add_argument("to"); p.add_argument("body", nargs="?"); p.add_argument("--subject", required=True)
    p.add_argument("--body-file"); p.add_argument("--lead"); p.add_argument("--cc", nargs="*"); p.set_defaults(fn=cmd_email)
    p = sp.add_parser("order"); p.add_argument("op", choices=["find", "show", "set", "preview", "email", "send", "remind"]); p.add_argument("ident")
    p.add_argument("--dry", action="store_true", help="remind: print the text, do not send")
    p.add_argument("--date"); p.add_argument("--time"); p.add_argument("--address"); p.add_argument("--name"); p.add_argument("--email"); p.add_argument("--phone")
    p.add_argument("--notes-file"); p.add_argument("--notes-reviewed", action="store_true"); p.add_argument("--json", action="store_true")
    p.add_argument("--lead", help="lead id for order send when the order does not carry one")
    p.add_argument("--travel-miles", type=float, help="driving miles from base (desk travel <address>); the invoice prices travel from this")
    p.add_argument("--free-appetizer-trays", type=int, metavar="N",
                   help="how many trays the free-appetizer promo brings (owner 2026-10-01: one per 10 guests). "
                        "Moves the promo's discount by the same amount, so the customer is not billed for it.")
    p.add_argument("--proteins", nargs="+", metavar="ID=N", help="protein counts when the customer texts totals instead of per-guest picks: "
                   "chicken=10 steak=10 shrimp=10 (N is adult servings; chicken=10/2 adds child servings). Switches the invoice to quick mode.")
    p.add_argument("--add-adult", type=int, metavar="N", help="add N adults to a party whose guests are already picked. The new rows copy "
                   "the last adult's proteins and their tables/utensils flags, so a late 'can I bring one more' keeps billing the same way "
                   "as everyone else. Check the printed rows before sending - proteins are a guess until the guest says otherwise.")
    p.add_argument("--add-child", type=int, metavar="N", help="same as --add-adult for children 5-12.")
    p.add_argument("--promo", nargs="+", metavar="ID=AMOUNT", help="set a stored promotion's dollar amount, e.g. official_weekday=89.80. "
                   "Promotions are frozen numbers on the invoice, not rules, so any per-head one (the Weekday Special, a free-extras deal) "
                   "has to be re-stated by hand when the headcount moves - see the warning --add-adult prints.")
    p.set_defaults(fn=cmd_order)

    a = ap.parse_args(argv)
    v = getattr(a, "lead", None)
    if v and not is_uuid(v):
        raise SystemExit(f"--lead must be a lead id (uuid), got {v!r}")
    try:
        a.fn(a)
    except ApiError as e:
        # One readable line instead of a traceback: the status says whether the
        # endpoint is missing (404 = not deployed yet), refused (401/403) or braked (409).
        detail = e.payload if isinstance(e.payload, str) else json.dumps(e.payload, ensure_ascii=False)
        raise SystemExit(f"HTTP {e.status} from the site: {detail[:400]}")


if __name__ == "__main__":
    main()
