"""审查者 (owner 2026-11-12: 「每次发送链接前都审查一下，保证至少发送的那个节点是对的」).

Before a link goes out - a chef's prep sheet, the day-before invoice link - a reviewer reads the whole
conversation and checks that the order and the prep list carry everything the customer asked for and
everything we said yes to. Chefs work from the prep list and the order only (D-1112-01), so what is not
on them is forgotten.

This module is the reviewer's eyes and its stamp; it sends nothing.
- load() gathers in one read what the reviewer needs: the order (rows, extras, deal, notes, prep note,
  internal notes), the prep-list line, the sheet each chef holds right now (its snapshot, the exact page
  he opens), the machine checks of party_check, and every word on the customer's side: texts, emails,
  website forms, party-page messages and the lead's notes.
- fingerprint() digests what a review vouches for: the order as the chef will get it, the crew, and the
  newest thing the customer said. A review is good only while the fingerprint is unchanged.
- A verdict is an order_events row, action order_reviewed: {verdict, summary, fingerprint}.
"""
from __future__ import annotations

import datetime as _dt
import hashlib
import json
import re

import party_check

REVIEW_ACTION = "order_reviewed"
SKIP_ACTION = "order_review_skipped"
# Payment-display settings: they change the bill's layout, not what the chef brings or the customer was promised.
VOLATILE_INVOICE_KEYS = {"cardFunding", "selectedGratuityRate", "salesTaxRate", "salesTaxJurisdiction", "pricingTerms"}
FORM_TYPES = ("contact_form", "landing_contact", "quote_book_online", "planner_unlock")
EMAIL_TYPES = ("email_inbound", "email_outbound")
PROMISE_NOTE = re.compile(r"\[(promised|owner|callback|why)\]", re.I)
# Where a reply starts quoting the thread: "> ..." lines, Gmail's "On Thu, Nov 12, 2026 at 9:10 AM ... wrote:"
# (often wrapped, "wrote:" on the next line), Outlook's "-----Original Message-----" / "From: ..." block.
_QUOTED = re.compile(r"^\s*>|^On (Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*, |^-{3,} ?Original Message|^From: .+<.+@.+>")


def _get(db_get, path: str, default):
    try:
        out = db_get(path)
    except Exception:  # a missing table or a refused read must not stop the review packet
        return default
    return out if isinstance(out, type(default)) else default


def _email_text(raw: dict) -> str:
    text = str(raw.get("text") or raw.get("body") or raw.get("snippet") or raw.get("html") or "")
    kept = []
    for line in text.replace("\r\n", "\n").split("\n"):
        if _QUOTED.match(line):
            break  # the quoted thread below a reply repeats what is already in the packet
        kept.append(line)
    return re.sub(r"\n{3,}", "\n\n", "\n".join(kept)).strip()


def _form_text(kind: str, raw: dict) -> str:
    keys = ("eventDate", "eventTime", "guestCount", "adults", "kids", "cityOrZip", "cityName", "address", "message", "notes", "stage", "plan")
    bits = [f"{k}={raw[k]}" for k in keys if raw.get(k) not in (None, "", [], {})]
    labels = {"contact_form": "联系表单", "landing_contact": "落地页表单", "quote_book_online": "报价页点了在线订", "planner_unlock": "派对页认领"}
    return f"{labels.get(kind, kind)}: " + ", ".join(bits)


def lead_ids(order: dict, db_get) -> list[str]:
    meta = order.get("source_metadata") if isinstance(order.get("source_metadata"), dict) else {}
    ids = {str(meta.get("lead_id") or "")}
    for e in _get(db_get, f"/rest/v1/order_events?select=metadata&order_id=eq.{order['id']}&action=eq.lead_linked", []):
        ids.add(str((e.get("metadata") or {}).get("lead_id") or ""))
    return sorted(i for i in ids if re.fullmatch(r"[0-9a-f-]{36}", i))


def load(order_no: str, site_get, db_get, now: _dt.datetime | None = None) -> dict:
    """Everything the reviewer reads for one order, by order number (RH-…)."""
    rows = _get(db_get, f"/rest/v1/orders?select={party_check.ORDER_COLUMNS},updated_at&order_no=eq.{order_no}", [])
    if not rows:
        raise SystemExit(f"no order {order_no}")
    order = rows[0]
    day = str(order.get("event_start") or "")[:10]
    prep_entry = None
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", day):
        try:
            prep = site_get("/api/admin/prep", {"date": day}) or {}
            prep_entry = next((e for e in prep.get("orders") or [] if isinstance(e, dict) and e.get("id") == order["id"]), None)
        except Exception:
            prep_entry = None
    party = party_check.load_parties([order["id"]], db_get, site_get, day or None, {order["id"]: prep_entry} if prep_entry else None)[0]
    gaps = party_check.gaps_of(party)
    # A plain UTC "Z" stamp: a "+00:00" offset would reach PostgREST as a space and match nothing.
    stamp_now = (now or _dt.datetime.now(_dt.timezone.utc)).astimezone(_dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    links = _get(db_get, "/rest/v1/chef_sheet_links?select=id,staff_member_id,created_at,first_opened_at,stale,change_pending_since,office_note,sheet_snapshot"
                         f"&order_id=eq.{order['id']}&revoked_at=is.null&expires_at=gt.{stamp_now}&order=created_at.desc", [])
    leads = lead_ids(order, db_get)
    touch = []
    if leads:
        types = ",".join((*EMAIL_TYPES, *FORM_TYPES))
        touch = _get(db_get, "/rest/v1/lead_touchpoints?select=lead_id,touchpoint_type,created_at,raw_payload_json"
                             f"&lead_id=in.({','.join(leads)})&touchpoint_type=in.({types})&order=created_at.asc&limit=500", [])
    reviews = _get(db_get, f"/rest/v1/order_events?select=created_at,actor,action,metadata&order_id=eq.{order['id']}"
                           f"&action=in.({REVIEW_ACTION},{SKIP_ACTION})&order=created_at.desc&limit=5", [])
    emails = [{"at": t.get("created_at"), "direction": "inbound" if t.get("touchpoint_type") == "email_inbound" else "outbound",
               "text": _email_text(t.get("raw_payload_json") or {})} for t in touch if t.get("touchpoint_type") in EMAIL_TYPES]
    forms = [{"at": t.get("created_at"), "kind": t.get("touchpoint_type"), "text": _form_text(t.get("touchpoint_type") or "", t.get("raw_payload_json") or {})}
             for t in touch if t.get("touchpoint_type") in FORM_TYPES]
    packet = {"order": order, "party": party, "gaps": gaps, "links": links, "emails": emails, "forms": forms, "reviews": reviews, "leads": leads}
    packet["fingerprint"] = fingerprint(packet)
    return packet


def _latest(times) -> str:
    return max((str(t) for t in times if t), default="")


def fingerprint(packet: dict) -> str:
    """What a review vouches for, digested. It changes when the order changes in a way the chef or the
    customer would see, when the crew changes, or when the customer says something new."""
    o, party = packet["order"], packet["party"]
    inv = o.get("invoice_data") if isinstance(o.get("invoice_data"), dict) else {}
    parts = {
        "invoice": {k: v for k, v in sorted(inv.items()) if k not in VOLATILE_INVOICE_KEYS},
        "event_start": o.get("event_start"),
        "event_address": o.get("event_address"),
        "prep_note": o.get("prep_note") or "",
        "internal_notes": o.get("internal_notes") or "",
        "setup_selection": o.get("setup_selection"),
        "order_status": o.get("order_status"),
        "crew": sorted([str(t.get("id")), str(t.get("role"))] for t in party.get("team") or []),
        "customer_said": _latest([m.get("at") for m in party.get("customer_sms") or [] if m.get("direction") == "inbound"]
                                 + [e["at"] for e in packet.get("emails") or [] if e["direction"] == "inbound"]
                                 + [f["at"] for f in packet.get("forms") or []]
                                 + [r.get("at") for r in party.get("requests") or []]),
        "promises_noted": _latest([n.get("at") for n in party.get("lead_notes") or [] if PROMISE_NOTE.search(str(n.get("note") or ""))]),
    }
    return hashlib.sha256(json.dumps(parts, sort_keys=True, ensure_ascii=False, default=str).encode("utf-8")).hexdigest()[:16]


def review_state(packet: dict) -> tuple[bool, str]:
    """(fresh, why): fresh only when the newest verdict is a pass for the order as it stands now."""
    reviews = [r for r in packet.get("reviews") or [] if r.get("action", REVIEW_ACTION) == REVIEW_ACTION]
    if not reviews:
        return False, "这单还没审查过"
    last = reviews[0]
    meta = last.get("metadata") or {}
    when = party_check._mdhm(last.get("created_at"))
    if meta.get("verdict") != "pass":
        return False, f"{when} 那次审查没过：{str(meta.get('summary') or '')[:160]}"
    if meta.get("fingerprint") != packet["fingerprint"]:
        return False, f"{when} 审查过，之后订单、派工或客人的话变了（指纹 {meta.get('fingerprint')} → {packet['fingerprint']}），要重新审查"
    return True, f"{when} 审查通过，之后没有变化：{str(meta.get('summary') or '')[:160]}"


def _snapshot_lines(snap: dict) -> list[str]:
    if not isinstance(snap, dict) or not snap:
        return ["      （没有快照）"]
    out = []
    ev = snap.get("event") or {}
    crew = snap.get("crew") or {}
    counts = snap.get("counts") or {}
    out.append(f"      时间 {ev.get('dateLabel', '')} {ev.get('timeLabel', '')} · 地址 {snap.get('address') or '-'} · 师傅 {crew.get('chefs', '?')} 位 / 灶 {crew.get('grills', '?')}"
               + (f" · 帮手 {', '.join(crew.get('assistants') or [])}" if crew.get("assistants") else "") + (f" · 站位 {crew['stationsNote']}" if crew.get("stationsNote") else ""))
    out.append(f"      人数 大 {counts.get('adults', 0)} · 5–12 岁 {counts.get('kids', 0)} · 3–4 岁 {counts.get('littles', 0)} · 共 {counts.get('total', 0)}")
    out.append("      蛋白 " + " · ".join(f"{p.get('label')} {p.get('servings')} 份（{p.get('sub')}）" for p in snap.get("proteins") or []))
    out.append("      装备 " + " · ".join(f"{s.get('label')} ×{s.get('qty')}" for s in snap.get("setup") or []))
    out.append("      食材 " + " · ".join(f"{f.get('label')} {f.get('amount')}".strip() for f in snap.get("food") or [] if f.get("group") != "sauce"))
    out.append(f"      过敏 {'; '.join(snap.get('allergies') or []) or '无'}")
    for n in snap.get("notes") or []:
        out.append(f"      备注 {n}")
    if snap.get("officeNote"):
        out.append(f"      办公室备注 {snap['officeNote']}")
    c = snap.get("collect") or {}
    if c:
        out.append(f"      收款 {c.get('paymentMethod', '?')} · 总价 ${c.get('total')} · 已付 ${c.get('deposit')} · 要收 ${c.get('balance')}")
    return out


def render(packet: dict) -> list[str]:
    o, party = packet["order"], packet["party"]
    inv = o.get("invoice_data") if isinstance(o.get("invoice_data"), dict) else {}
    contact = inv.get("contactInfo") or {}
    fresh, why = review_state(packet)
    out = [
        f"审查材料 {o.get('order_no')} · {str(o.get('event_start') or '')[:16].replace('T', ' ')} · {o.get('event_address') or '-'} · {o.get('customer_name') or '-'} · {o.get('order_status')}",
        f"指纹 {packet['fingerprint']} · 审查状态：{'✓ ' if fresh else '✗ '}{why}",
        "━" * 78,
        "【一】机器核对（party_check：答应过的桌椅、只在备注里的过敏、派对页对不上、师傅手里的单旧没旧）",
    ]
    out += party_check.render(party, packet["gaps"])
    out += ["", "【二】订单（师傅和客人看到的都从这里来）",
            f"   人数 大 {inv.get('adultCount')} · 小 {inv.get('childCount')} · 模式 {inv.get('mode')} · 付款 {inv.get('paymentMethod')} · 路费 {inv.get('travelFee')} · 押金 {inv.get('depositAmount')}"]
    for g in inv.get("guests") or []:
        if not isinstance(g, dict):
            continue
        flags = [label for key, label in (("noodles", "面条"), ("tablesChairs", "桌椅"), ("utensils", "餐具")) if g.get(key)]
        kind = "3–4岁" if g.get("isLittle") else ("5–12岁" if g.get("isChild") else "大人")
        out.append(f"   {kind:>5} {g.get('name') or '-'}: {', '.join(g.get('proteins') or []) or '（没选）'}"
                   + (f" · {'/'.join(flags)}" if flags else "") + (f" · 过敏 {g.get('foodAllergy') or g.get('allergies')}" if (g.get("foodAllergy") or g.get("allergies")) else "")
                   + (f" · 备注 {g.get('note')}" if str(g.get("note") or "").strip() else ""))
    for key in ("partyExtras", "partyWideAddons", "quickCountItems", "promotions", "customDeal"):
        if inv.get(key) not in (None, [], {}):
            out.append(f"   {key}: {json.dumps(inv.get(key), ensure_ascii=False)}")
    if o.get("setup_selection"):
        out.append(f"   setup_selection: {json.dumps(o.get('setup_selection'), ensure_ascii=False)}")
    out.append(f"   订单备注（客人看得到，印在备料单上）：{contact.get('specialNotes') or '（空）'}")
    out.append(f"   备货备注（印在装车单和备料单上）：{o.get('prep_note') or '（空）'}")
    out.append(f"   内部备注（客人和师傅都看不到）：{o.get('internal_notes') or '（空）'}")
    out += ["", "【三】师傅手里的备料单（现在能打开的那一版）"]
    names = {t.get("id"): t.get("name") for t in party.get("team") or []}
    if not packet["links"]:
        out.append("   （还没有在用的备料单链接）")
    for l in packet["links"]:
        state = "旧了（订单改过，链接已作废待重发）" if l.get("stale") else ("改动等发出" if l.get("change_pending_since") else "最新")
        out.append(f"   {names.get(l.get('staff_member_id'), l.get('staff_member_id'))} · 发于 {party_check._mdhm(l.get('created_at'))} · "
                   f"{'打开过 ' + party_check._mdhm(l.get('first_opened_at')) if l.get('first_opened_at') else '还没打开'} · {state}")
        out += _snapshot_lines(l.get("sheet_snapshot") or {})
    out += ["", "【四】对话（按时间；客=客人，我=我们，网=网站表单，页=派对页留言，记=线索备注，师=发给师傅的短信）"]
    items = []
    for m in party.get("customer_sms") or []:
        body = str(m.get("body") or "").strip() + (f" [+{m.get('media')} 张图]" if m.get("media") else "")
        items.append((m.get("at"), "客" if m.get("direction") == "inbound" else "我", "短信", body))
    for e in packet.get("emails") or []:
        items.append((e["at"], "客" if e["direction"] == "inbound" else "我", "邮件", e["text"]))
    for f in packet.get("forms") or []:
        items.append((f["at"], "网", "表单", f["text"]))
    for r in party.get("requests") or []:
        if str(r.get("message") or "").strip():
            items.append((r.get("at"), "页", "派对页", str(r.get("message")).strip()))
    for n in party.get("lead_notes") or []:
        items.append((n.get("at"), "记", "备注", str(n.get("note") or "").strip()))
    for c in party.get("chef_sms") or []:
        items.append((c.get("at"), "师", c.get("chef") or "", str(c.get("body") or "").strip()))
    # Whole text, never cut: Andres 11-12 - a 3,412-character call note cut at 1,500 hid the
    # customer's "I would put the tables out"; what the reviewer cannot read, it cannot check.
    for at, who, kind, text in sorted(items, key=lambda x: str(x[0] or "")):
        text = re.sub(r"\s+", " ", text)
        out.append(f"   {party_check._mdhm(at)} {who}·{kind}  {text}")
    out += ["━" * 78,
            f"审查完：desk order review {o.get('order_no')} --pass --summary \"核了几条、都在哪\"  或  --fail --summary \"缺什么、该怎么补\"",
            "（--pass 只在【一】没有要先补的缺项时才记得上；订单或对话之后再变，这次审查自动作废）"]
    return out
