# -*- coding: utf-8 -*-
"""desk - the sales desk in one command, so no session ever rewrites the tooling.

  python scripts/desk/desk.py next                         what is waiting, one full card each (one call)
  python scripts/desk/desk.py card   <phone|leadId>        the same card for one customer
  python scripts/desk/desk.py scan   [--bucket D] [--no-write] every open lead in a bucket with its reason (线索扫描 skill)
  python scripts/desk/desk.py thread <phone|leadId>        the Twilio conversation, oldest first, then the --seen for a reply
  python scripts/desk/desk.py search <text>                name / phone / email / order no
  python scripts/desk/desk.py price  --adults 24 [--kids 0] [--date 2026-10-13] [--zip 90802] [--alt-date ...]
  python scripts/desk/desk.py travel <destination>
  python scripts/desk/desk.py send   <phone> [body] --lead <id> [--body-file f] --seen <when> [--force] [--voice-ok]
                                   --seen = the customer's last text you read (desk thread / card print it). A text of
                                   theirs after it - with no --seen, one from the last 90 s - stops the send; --force does not
                                   A text that reads like a bot (voice.md §2: " - " twice, "!" twice, "Perfect -",
                                   "your 17", a banned phrase...) stops it too, printed; --voice-ok sends it as written.
                                   Notes, sent anyway: an opening already sent to 2 other customers in 24 h, a first
                                   sentence that does not answer the question they just asked
  python scripts/desk/desk.py voice-log [--date YYYY-MM-DD]   what the voice check did on this machine that day: stops,
                                   how long each rewrite took, notes, --voice-ok (the daily report reads it)
  python scripts/desk/desk.py email  <to> --subject s [--body-file f] [--lead id] [--cc a b]   from support@, logged on the lead
  python scripts/desk/desk.py note   <leadId> [note] [--body-file f]
  python scripts/desk/desk.py hold   <leadId> <days>       0 clears
  python scripts/desk/desk.py status <leadId> <new|qualified|won|lost|disqualified>
  python scripts/desk/desk.py contacted <leadId>
  python scripts/desk/desk.py ack    <leadId> [--clear]    「不用回」watermark - tapbacks only
  python scripts/desk/desk.py block  <leadId> [--why "..."] [--clear]   a sales pitch: its calls to 213 are rejected, lead disqualified
  python scripts/desk/desk.py fields <leadId> guest_count=24 city_or_zip=Long\\ Beach
  python scripts/desk/desk.py link deposit --lead <id> --adults 24 --city "Long Beach" [--kids 0]
                                   [--date 2026-10-13] [--time 18:00] [--email e] [--name n] [--est 1258]
                                   [--free tables_chairs | --rate tables_chairs=5]   signed deal: tables free / at $5 a guest
  python scripts/desk/desk.py link planner --email e --phone p [--booked] [--lead <id>]
  python scripts/desk/desk.py link short <url> [--lead <id>]
  python scripts/desk/desk.py order find <text>            orders on a name / phone / email / order no
  python scripts/desk/desk.py order show <orderNo|orderId> the stored invoice: contact, guests, extras, notes, totals
  python scripts/desk/desk.py order set  <orderNo> [--date 2026-10-13] [--time 18:30] [--address ...]
                                   [--name ...] [--email ...] [--phone ...] [--notes-file f]   re-price, then save
  python scripts/desk/desk.py order set  <orderNo> --chefs 2 --grills 2 [--stations "two U shapes, each chef at an open end"]
                                   dispatch plan on the order (owner override; --plan-rule goes back to the headcount rule)
                                   [--proteins chicken=10 steak=10 shrimp=10]   totals texted by the customer
  python scripts/desk/desk.py order set  <orderNo> --headcount 11/1[/1] [--proteins chicken=11/1 steak=11/1] --dry
                                   headcount of an order without guest rows (adults/kids 5-12[/free 3-4s]). Any headcount change
                                   re-tiers the official_party* line (--retier on its own fixes one already wrong);
                                   every set checks its TOTAL against desk price
  python scripts/desk/desk.py order preview <orderNo>      totals from the invoice engine, nothing saved
  python scripts/desk/desk.py order email <orderNo> [--notes-reviewed]   customer invoice email (+PDF, archived)
  python scripts/desk/desk.py order send  <orderNo>   email the PDF AND text the invoice link asking them to reply "confirm" (the normal way)
  python scripts/desk/desk.py order remind <orderNo> [--dry]   day before / morning of: the balance by how they pay (cash to the chef / card)
  python scripts/desk/desk.py calls <phone|leadId>          recordings on the lead (date, length, sid)
  python scripts/desk/desk.py transcribe <phone|leadId> [--last 2] [--sid RE..] [--model small|medium] [--note] [--swap]
                                   local faster-whisper, customer/us on separate channels; --note files it on the lead

Every write goes through the workbench / invoice APIs, so it lands in the
timeline and passes the same brakes as the UI. Rules live in the leads skill;
this file only fetches, prints and posts. `python scripts/desk/selfcheck.py`
runs the order set headcount rules offline (no network).
"""
from __future__ import annotations

import argparse
import copy
import datetime as _dt
import difflib
import functools
import json
import math
import pathlib
import re
import sys
import time
import urllib.parse
from zoneinfo import ZoneInfo

from _api import ROOT, ApiError, dump, e164, invoice_post, is_uuid, pt, read_text_arg, site_get, site_post

TAPBACK = re.compile(r"^(liked|loved|laughed at|emphasized|disliked|questioned)\s", re.I)
THUMB = re.compile(r"^\U0001F44D[\U0001F3FB-\U0001F3FF]?️?[\s.!]*$")


# Protein ids the invoice engine knows (v0 invoice repo, lib/pricing.ts).
PROTEIN_IDS = {"chicken", "steak", "shrimp", "salmon", "tofu", "scallops", "filet_mignon", "lobster_tail", "ribeye"}
SETUP_PRICES = {"tables_chairs": 10.0, "utensils": 5.0}  # invoice lib/pricing.ts PARTY_EXTRAS
SETUP_LABELS = {"tables_chairs": "Tables & Chairs", "utensils": "Utensils & Tableware"}  # same, as the customer reads them
ADULT_PRICE, CHILD_PRICE = 59.90, 29.90  # invoice ADULT_BASE_PRICE / CHILD_BASE_PRICE, what a deal's rate is cut from
WEEKDAY_ADULT_OFF, WEEKDAY_CHILD_OFF = 5.0, 2.45  # invoice WEEKDAY_SPECIAL adultOff / childOff, the official_weekday line's per-head part
DEAL_PROMO_IDS = ("deal_rate", "deal_free_extras", "deal_extra_rates", "deal_flat")  # invoice isCustomDealPromoId, in its order
FREE_APPETIZER_PROMO_IDS = ("official_weekday", "official_platter20", "official_fullsetup_app")  # invoice bringsFreeAppetizer; never stacked
MINIMUM_SPEND = 599  # config/pricing-rules.ts
# Menu price of the appetizers a free-appetizer promo can bring, so changing
# how many trays it brings moves the discount by the same amount and the
# customer is never charged for what we gave them.
APPETIZER_PRICES = {"gyoza": 15.0, "spring_rolls": 15.0, "edamame": 10.0}
APPETIZER_LABELS = {"gyoza": "Gyoza (10 pcs)", "spring_rolls": "Spring Rolls (10 pcs)", "edamame": "Edamame (feeds 3)"}  # invoice PARTY_EXTRAS labels
# Whole-table protein servings (invoice PARTY_EXTRAS side_*, billed per serving; one serving = one
# adult portion). How "a third protein for everyone" rides on an order that has no guest rows yet:
# the church group RH-20261021-9381 wanted shrimp as the third protein for 15 = side_shrimp=15 ($150).
PROTEIN_SIDE_PRICES = {"side_chicken": 10.0, "side_steak": 10.0, "side_shrimp": 10.0, "side_salmon": 10.0,
                       "side_tofu": 10.0, "side_scallops": 16.0, "side_filet_mignon": 18.0, "side_lobster_tail": 22.0}
# The Party Size Discount ladder is the site's (config/pricing-rules.ts, which
# the invoice engine mirrors). Read from that file, never copied here, so a new
# tier reaches desk with the site.
PRICING_RULES = ROOT / "config" / "pricing-rules.ts"


@functools.lru_cache(maxsize=None)
def party_tiers() -> tuple[tuple[dict, ...], int, float]:
    """(tiers, custom quote from, kid weight): PARTY_SIZE_DISCOUNT_TIERS,
    PARTY_SIZE_CUSTOM_FROM and KID_TIER_WEIGHT from config/pricing-rules.ts.
    Refuses rather than guesses when the file stops reading that way."""
    text = PRICING_RULES.read_text(encoding="utf-8")
    body = re.search(r"export const PARTY_SIZE_DISCOUNT_TIERS = \[(.*?)\]", text, re.S)
    custom = re.search(r"export const PARTY_SIZE_CUSTOM_FROM = (\d+)", text)
    weight = re.search(r"export const KID_TIER_WEIGHT = (\d+(?:\.\d+)?)", text)
    tiers = []
    for obj in re.findall(r"\{([^{}]*)\}", body.group(1) if body else ""):
        v = dict(re.findall(r"(minGuests|maxGuests|amount)\s*:\s*(\d+(?:\.\d+)?)", obj))
        if len(v) == 3:
            tiers.append({"min": int(v["minGuests"]), "max": int(v["maxGuests"]), "amount": float(v["amount"])})
    ordered = all(t["min"] <= t["max"] for t in tiers) and all(b["min"] > a["max"] for a, b in zip(tiers, tiers[1:]))
    if not (tiers and ordered and custom and weight):
        raise SystemExit(f"could not read the party-size tiers from {PRICING_RULES} (PARTY_SIZE_DISCOUNT_TIERS / PARTY_SIZE_CUSTOM_FROM / "
                         "KID_TIER_WEIGHT) - desk will not guess them; fix party_tiers() for the file's new shape")
    return tuple(tiers), int(custom.group(1)), float(weight.group(1))


def tier_heads(adults: int, kids: int) -> int:
    """Paying heads the ladder counts: an adult 1, a kid 5-12 half, floored (tierHeadcount)."""
    return math.floor(max(0, adults) + max(0, kids) * party_tiers()[2])


def party_line(heads: int) -> dict | None:
    """The official_party* line for this many paying heads, as the invoice
    writes it (partySizePromoFor + OFFICIAL_PROMOS); None outside the ladder."""
    tier = next((t for t in party_tiers()[0] if t["min"] <= heads <= t["max"]), None)
    if not tier:
        return None
    amount = int(tier["amount"]) if tier["amount"].is_integer() else tier["amount"]
    return {"id": f"official_party{tier['min']}", "label": f"Party Size Discount ({tier['min']}–{tier['max']} adults): ${amount} off", "amount": amount}


def is_tapback(body: str) -> bool:
    b = (body or "").strip()
    return bool(TAPBACK.match(b) or THUMB.match(b))


def desk_session() -> str:
    """This desk's identity for the just-answered brake: the Claude session when
    run from one, else the machine and the parent shell."""
    import os, socket
    return (os.environ.get("DESK_SESSION") or os.environ.get("CLAUDE_CODE_SESSION_ID") or f"{socket.gethostname()}:{os.getppid()}")[:80]


def money(v) -> str:
    try:
        return f"${float(v):,.2f}"
    except (TypeError, ValueError):
        return "?"


# ---------------------------------------------------------------- renderers --
def fmt_msg(m: dict, seconds: bool = False) -> str:
    who = "客" if m.get("direction") == "inbound" else "我"
    body = (m.get("body") or "").replace("\n", " ").strip()
    media = int(m.get("media") or 0)  # an MMS has no text; three patio photos printed as blank lines once (10-05)
    if media and not body:
        body = f"[{media} 张图片]"
    elif media:
        body = f"{body}  [+{media} 张图片]"
    tag = "  [tapback·不用回]" if m.get("tapback") or (m.get("direction") == "inbound" and is_tapback(body)) else ""
    return f"   {who} {pt(m.get('at'), seconds)}  {body}{tag}"


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
            reason = lead.get("sms_blocked_reason") or ""
            flags.append(f"座机/固话,短信发不了,走邮件({reason[8:].strip()})" if reason.startswith("lookup:") else f"短信打不通({reason or '30003/30006'})")
        if stats.get("quiet"):
            flags.append("不响铃(致谢/挂起/已标不用回)")
        print(f"   日期线索: {hint.get('date') or '-'} | 首响: {pt(lead.get('first_response_at'))} | {' | '.join(flags) or '无挂起'} | id {lead.get('id')}")
        # Our hold ran out and they never spoke since: dormant, not due (leads §5.1). 10-11 two
        # leads the 09-27 review had stopped got one more text each because the card said nothing.
        if stats.get("hold") == "dormant":
            print(f"   💤 休眠：挂起 {pt(lead.get('hold_until'))} 已到期，之后客人没说过话 → 不再主动发（leads §5.1 休眠），他开口立即接")
        if stats.get("hold") in ("active", "dormant"):
            for t in c.get("holdNotes") or []:
                print(f"   ⏸ 挂起理由 {pt(t.get('at'))} {t.get('note', '')[:160]}")
        # 61+ never gets the machine's second text (lib/first-response.ts large_party): until a
        # person texts, nobody has spoken to them. 10-10 a 150-guest lead sat 62 minutes because
        # the desk assumed the machine had it.
        spoke = any(m.get("direction") == "outbound" and not (m.get("body") or "").startswith("Real Hibachi:")
                    for m in (c.get("thread") or []))
        if int(lead.get("guest_count") or 0) >= 61 and not spoke:
            print("   ⚠️ 61+ 大单：机器不发问场合那条（first-response large_party），首条要人工发（leads §3 判型 E）")
        line = source_line(lead.get("source") or {}, lead.get("id"))
        if line:
            print(line)
        rule = lead.get("chef_pay_rule")
        if rule:
            who = "全部大人" if rule.get("adultsAsKids") == "all" else f"{rule.get('adultsAsKids')} 位大人"
            print(f"   师傅工钱特殊规则：发票上{who}按小孩（半个人头）算{('（' + rule['note'] + '）') if rule.get('note') else ''}"
                  " → 派师傅、结账自动用，不用手改")
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
    # support@ emails filed on the lead (in via the Gmail script, out via `desk email`).
    for e in c.get("emails") or []:
        who = "客" if e.get("direction") == "inbound" else "我"
        print(f"   ✉ {who} {pt(e.get('at'))}  {e.get('subject') or '(no subject)'} — {(e.get('snippet') or '')[:120]}")
    # Pre-party contact flags (lead-watch): the customer has not answered the confirmation text.
    for al in c.get("alerts") or []:
        print(f"   ⚑ {al.get('title') or ''} — {al.get('body') or ''}")
    for o in c.get("orders") or []:
        when = (o.get("event_start") or "")[:16].replace("T", " ")  # wall time stored as UTC - never convert
        bal = o.get("balance_due_cents")
        meta = o.get("source_metadata") or {}
        print(f"   订单 {o.get('order_no') or o.get('id')}  {o.get('order_status') or ''}/{o.get('deposit_status') or ''}/{o.get('details_status') or ''}"
              f"  {when or '未定'}{'（时间待定）' if isinstance(meta, dict) and meta.get('event_time_tbd') else ''}  {o.get('event_address') or '-'}"
              f"  {o.get('guest_adult_count') or '?'}大{o.get('guest_child_count') or 0}小"
              f"{f'  尾款 ${bal / 100:,.2f}' if isinstance(bal, (int, float)) else ''}")
    thread = c.get("thread") or []
    # Forms the customer filled on the site are their lines in the conversation
    # ("客 … [网站·报价页点了在线订] …"): a reply through the site is a reply.
    forms = [{"direction": "inbound", "at": f.get("at"), "body": f"[网站·{f.get('label') or f.get('type')}] {f.get('summary') or ''}"} for f in (c.get("forms") or [])]
    # Yelp / Facebook / Instagram messages copied in with `desk channel` are lines of it too.
    chans = [{"direction": m.get("direction"), "at": m.get("at"), "body": f"[{CHANNEL_NAMES.get(m.get('channel') or '', m.get('channel') or '渠道')}] {m.get('body') or ''}"}
             for m in (c.get("channelMessages") or [])]
    merged = sorted(thread + forms + chans, key=lambda m: m.get("at") or "")
    print(f"   对话 ({len(thread)}{f' + 网站 {len(forms)}' if forms else ''}{f' + 渠道 {len(chans)}' if chans else ''}):")
    for m in merged[-14:]:
        print(fmt_msg(m))
    seen = seen_line(thread)
    if seen:
        print(seen)
    print("   刹车: " + brake_line(stats))


# ---------------------------------------------------------------- commands --
def cmd_next(a):
    data = site_get("/api/admin/desk")
    counts = data.get("counts") or {}
    print(f"收件箱 {pt(data.get('serverTime'))} PT · 未回 {counts.get('unreplied', 0)} · 邮件 {counts.get('emailNew', 0)} · 网站回复 {counts.get('formNew', 0)} · 漏网 {counts.get('silenced', 0)} · 没送达 {counts.get('undelivered', 0)} · 联系不上 {counts.get('unreachedParties', 0)} · 新线索 {counts.get('newLeads', 0)}"
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
    ("F", "隐性异议", "按让步带宽出牌：周中 $500 底线 / 先问数再让；只问桌椅的照价答，比价或超预算时桌椅最后出（周五–日最多半价、周一–四最多免费、节假日不给，D-1029-02）"),
    ("E", "派对临近", "真时钟 + 开门句；满 3 条的要 force，先给老板看"),
    ("D", "到期跟进", "台阶句 + 一个真理由 + 一个好答的问题；一批一次批"),
    ("H", "停", "不发；needs_hold 的挂起：满 3 条的挂 14 天，[callback] 没挂起的挂到他说的那天"),
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
    seen = seen_line(msgs)
    if seen:
        print(seen)


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


def price_for(adults: int, kids: int, date: str | None, zipcode: str | None, tables: int = 0, utensils: int = 0) -> dict | None:
    params = {"adults": adults, "kids": kids}
    if tables:
        params["tables"] = tables
    if utensils:
        params["utensils"] = utensils
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
        p = price_for(a.adults, a.kids, date, a.zip, a.tables or 0, a.utensils or 0)
        if not p or not p.get("ok"):
            print(f"{date or '(no date)'}: 引擎没算出来（zip 对吗？）")
            continue
        pr = p["price"]
        rent = f" + 租赁 ${pr['rentals']['amount']:,.2f}" if pr.get("rentals") else ""
        # The listed price only (owner 2026-10-06): tax and payment method are not
        # part of a quote. The two bills come from the invoice engine once the
        # menu and headcount are set (`desk order totals` / /pay).
        print(f"{date or '(any day)'}: {a.adults} 大人 + {a.kids} 小孩 → ${pr['total']:,.2f}  [{pr['plan']}]  "
              f"食 ${pr['foodSubtotal']:,.2f}{rent} − 人数折扣 ${pr['partySizeDiscount']:,.0f} + 路费 ${pr['travelFee']:,.2f}"
              f"{'  (最低消费生效)' if pr.get('minimumApplied') else ''}")
        if a.json:
            print(dump(p))


def cmd_travel(a):
    print(dump(site_get("/api/quote/travel-fee", {"destination": a.destination}, admin=False)))


# ------------------------------------------------------------ unread guard --
# Three replies went out over a text nobody had read, each from `desk thread`
# and `desk send` run in one shell command: JT Possehl's "When do you need the
# menu buy?" 3 s before our answer about tables (10-21), JT's "We want to pay
# with card" 58 s before "I just emailed the complete bill" (10-23), and a prom
# lead's "small private school that doesn't do a prom" 5 s before we asked
# "before they head out, or an after-party?" (10-24). So send reads the thread
# itself (Twilio, the GET `desk thread` makes) and will not go out over a
# customer text the sender has not accounted for: one after the text --seen
# names, or, with no --seen, one from the last 90 s (the inbox's
# "⏳刚到，可能还在打字"). Only the customer's texts count - ours never do,
# whoever sent them - and a staff number is not a lead (a chef's "好的" is no
# reason to stop). --force is for the server's brakes and does not skip this;
# --seen does.
UNREAD_WINDOW_S = 90
PACIFIC = ZoneInfo("America/Los_Angeles")
SEEN_FORM = re.compile(r"(?:(?:(?P<y>\d{4})-)?(?P<mo>\d{1,2})-(?P<d>\d{1,2})[T ])?(?P<h>\d{1,2}):(?P<mi>\d{2})"
                       r"(?::(?P<s>\d{2})(?:\.\d+)?)?(?P<tz>Z|[+-]\d{2}:?\d{2})?", re.I)


def _now() -> _dt.datetime:
    return _dt.datetime.now(_dt.timezone.utc)


def _at(iso: str | None) -> _dt.datetime | None:
    try:
        t = _dt.datetime.fromisoformat((iso or "").replace("Z", "+00:00"))
    except ValueError:
        return None
    return t if t.tzinfo else t.replace(tzinfo=_dt.timezone.utc)


def seen_value(iso: str) -> str:
    """The --seen that names this text to the second, on the Pacific clock."""
    return _at(iso).astimezone(PACIFIC).isoformat(timespec="seconds")


def seen_line(msgs: list[dict]) -> str | None:
    """The line under a conversation that hands the reply its --seen: the customer's newest text."""
    theirs = [m for m in msgs if m.get("direction") == "inbound" and _at(m.get("at"))]
    if not theirs:
        return None
    last = max(theirs, key=lambda m: _at(m["at"]))
    return f"   回复带 --seen {seen_value(last['at'])}（客人最后一条 {pt(last['at'], True)}）"


def parse_seen(text: str, now: _dt.datetime) -> tuple[_dt.datetime, _dt.datetime, bool]:
    """--seen as the span it names, [start, end), and whether it is exact. With
    seconds (what desk prints) it is that second; HH:MM, MM-DD HH:MM or
    YYYY-MM-DD HH:MM is the whole minute. No zone = Pacific; no date = the
    latest such time that has passed (at 00:05, 23:58 is last night)."""
    m = SEEN_FORM.fullmatch((text or "").strip())
    if not m:
        raise SystemExit(f"--seen {text!r}: 写你读到的客人最后一条的时间——desk thread / card 在对话下面打的那个"
                         "（2026-10-24T18:54:18-07:00），或 18:54、10-24 18:54（太平洋时间）")
    tz = (m["tz"] or "").upper()
    if not tz:
        zone = PACIFIC
    elif tz == "Z":
        zone = _dt.timezone.utc
    else:
        zone = _dt.timezone((-1 if tz[0] == "-" else 1) * _dt.timedelta(hours=int(tz[1:3]), minutes=int(tz[-2:])))
    local = now.astimezone(zone)

    def on(day: _dt.date) -> _dt.datetime:
        return _dt.datetime(day.year, day.month, day.day, int(m["h"]), int(m["mi"]), int(m["s"] or 0), tzinfo=zone)

    try:
        if m["mo"]:
            t = on(_dt.date(int(m["y"] or local.year), int(m["mo"]), int(m["d"])))
            if not m["y"] and t > now + _dt.timedelta(days=1):
                t = on(_dt.date(local.year - 1, int(m["mo"]), int(m["d"])))
        else:
            t = on(local.date())
            if t > now + _dt.timedelta(minutes=5):
                t = on(local.date() - _dt.timedelta(days=1))
    except ValueError as e:
        raise SystemExit(f"--seen {text!r}: {e}")
    exact = m["s"] is not None
    return t, t + _dt.timedelta(seconds=1 if exact else 60), exact


def unread_inbound(msgs: list[dict], seen: tuple | None, now: _dt.datetime) -> tuple[str, list[dict]]:
    """The customer's texts a send would talk over, oldest first, and why:
      fresh   - no --seen, and they texted in the last 90 s
      newer   - they texted after the one --seen names (HH:MM names the first
                of that minute: a second text in it may be the unread one)
      unnamed - --seen names none of their texts (their last one comes back)
      minute  - HH:MM names a text from the last 90 s, which the clock would
                too: that needs the seconds
    ("", []) = clear to send. Only inbound texts count."""
    theirs = sorted(((_at(m.get("at")), m) for m in msgs if m.get("direction") == "inbound" and _at(m.get("at"))),
                    key=lambda p: p[0])
    if not theirs:
        return "", []

    def fresh(t: _dt.datetime) -> bool:
        return (now - t).total_seconds() < UNREAD_WINDOW_S

    if seen is None:
        hits = [m for t, m in theirs if fresh(t)]
        return ("fresh", hits) if hits else ("", [])
    start, end, exact = seen
    named = [t for t, _ in theirs if start <= t < end]
    if not named:
        after = [m for t, m in theirs if t >= end]
        return ("newer", after) if after else ("unnamed", [theirs[-1][1]])
    after = [m for t, m in theirs if t > named[0]]
    if after:
        return "newer", after
    if not exact and fresh(named[0]):
        return "minute", [m for t, m in theirs if t == named[0]]
    return "", []


def is_staff_phone(phone: str) -> bool:
    """A chef's, logistics' or the owner's number (the staff list): not a lead (lib/staff-phones.ts)."""
    digits = re.sub(r"\D", "", phone)[-10:]
    try:
        staff = site_get("/api/admin/chefs").get("chefs") or []
    except ApiError:
        return False
    return any(re.sub(r"\D", "", s.get("phone") or "")[-10:] == digits for s in staff)


def check_unread(phone: str, seen_arg: str | None, forced: bool, msgs: list[dict]) -> None:
    """Stop the send (exit 2, nothing sent) over a customer text the sender has not read."""
    now = _now()
    seen = parse_seen(seen_arg, now) if seen_arg else None
    why, hits = unread_inbound(msgs, seen, now)
    if not hits:
        return
    # Read only when there is something to stop for, so a send to a customer pays nothing for it.
    if is_staff_phone(phone):
        print(f"      {phone} 是员工号码，不是线索：不查未读")
        return
    newest = hits[-1]
    age = max(0, round((now - _at(newest["at"])).total_seconds()))
    if why == "fresh":
        head = f"客人 {age} 秒前刚发来，你没读过（⏳刚到，可能还在打字）"
    elif why == "newer":
        head = f"你读到的是 --seen {seen_arg}，客人之后又发了 {len(hits)} 条"
        if not seen[2] and _at(hits[0]["at"]) < seen[1]:
            head += "（HH:MM 按那一分钟客人的第一条算）"
    elif why == "unnamed":
        head = f"--seen {seen_arg} 对不上客人的任何一条短信（要写你读到的客人最后一条），最后一条是"
    else:
        head = f"--seen {seen_arg} 只到分钟，那条 {age} 秒前才到：分钟分不清读过的和刚到的，要写到秒"
    print(f"UNREAD {phone}  {head}：")
    if len(hits) > 6:
        print(f"   …更早还有 {len(hits) - 6} 条")
    for m in hits[-6:]:
        print(fmt_msg(m, seconds=True))
    print(f"      没发。读完再写，稿子要接上客人最后一句；改好再发，带 --seen {seen_value(newest['at'])}")
    if forced:
        print("      --force 只放行服务器的刹车，不跳过这一道")
    sys.exit(2)


# ---------------------------------------------------------------------------
# Voice (owner 2026-10-29, leads voice.md): the owner is not a native English
# speaker and cannot hear what makes a text read like an AI support bot, so
# the countable rules are checked here, before anything goes out. Of the 775
# hand-sent texts 10-15..10-29, 87% spliced two halves with " - ", 55% carried
# a "!", 20% re-introduced "Hi, it's Rowling" mid-conversation, 7% said
# "your 17" for a headcount. Two levels, set by a backtest over every text the
# workbench sent 09-12..10-29 (harness/verification/2026-10-29-desk-send-voice-check):
#   stop - a sure tell; the send stops (exit 2, nothing sent) and names the
#          rule, --voice-ok sends it as written
#   note - fine once, a tell when it is every text (a single " - " after
#          "Yes" is ordinary English); printed, and the text goes
# Only the English matters: a text to a chef is in Chinese and never hits.
# The lists live in config/voice-rules.json, shared with lib/voice-check.ts
# (tests/voice-check.test.ts holds every machine-written text to them).
VOICE_RULES = json.loads((ROOT / "config" / "voice-rules.json").read_text(encoding="utf-8"))
_vl = VOICE_RULES["limits"]
VOICE_SPLICES = _vl["splices"]          # " - " joins per text before a note
VOICE_BANGS = _vl["bangs"]              # "!" per text
VOICE_EMOJI = _vl["emoji"]              # emoji per text
VOICE_REINTRO_H = _vl["reintroHours"]   # "Hi, it's Rowling" again while they spoke this recently: no
_alt = lambda key: "|".join(VOICE_RULES[key])
VOICE_HI = r"^(?:hi\b[^.!?]{0,40}?[-,.!]\s*)?"
VOICE_OPENER = re.compile(VOICE_HI + rf"(?:{_alt('openers')})\b", re.I)
# "No rush - ", "Got it - ", "Done - ": a reaction word, then the splice.
VOICE_SPLICE_OPENER = re.compile(VOICE_HI + rf"(?:{_alt('reactionOpeners')}) - ", re.I)
# "your 17" with no noun after it; "your 16 adults and 3 kids" is ordinary English.
VOICE_YOUR_N = re.compile(
    r"\b(?:for|of|with|and|is|plan for) your (\d{1,3})\b"
    rf"(?!\s*(?:[:%/+]|-year|(?:am|pm|th|st|nd|rd|{_alt('headcountNouns')})\b))", re.I)
VOICE_REINTRO = re.compile(r"^hi\b[^.?]{0,30}\b(?:it's |it is |this is )?rowling\b", re.I)
VOICE_NAMED = re.compile(r"\b(?:Rowling|Bling)\b")
VOICE_EMOJI_RE = re.compile("[\U0001F300-\U0001FAFF\u2600-\u27BF]")
# One per customer (SKILL §1.9): said once, not again. The site's automatic
# quote ("Real Hibachi: your ... price is ...") does not count - the first
# link a person sends still says it (templates.md).
VOICE_ONCE = [
    ("nothing is charged today", re.compile(r"nothing (?:is )?charged today", re.I)),
    ("the headcount can change", re.compile(r"(?:headcount|count|number) can (?:still )?(?:change|grow)", re.I)),
    ("X it is", re.compile(r"\b\w+ it is[.!,]", re.I)),
]
VOICE_SYSTEM_TEXT = re.compile(r"^Real Hibachi:")
VOICE_GREETING = set(VOICE_RULES["greetings"])
VOICE_BANNED = re.compile(rf"\b(?:{_alt('banned')})\b", re.I)
# Two more notes after the 10-22..10-28 backtest (owner 2026-10-29); neither stops a send.
# One mold for many people: 22 follow-ups that week opened "Hi, it's Rowling - figured you're still ..."
# (5 replies). An opening - the first three words once the greeting and our name are off - that this
# machine already sent to VOICE_SAME_FRAME other customers in the last 24 h gets a note (read from VOICE_LOG).
# A first sentence that does not answer: 7 of 30 replies to a question led with "You're welcome!",
# "Good morning, Matthew!" or "5:30 works great!" (they had asked about tables). Read, not understood:
# they asked something since our last text, and our first sentence (after a first text's name intro)
# is a pleasantry, or shares no word with the question and does not open like an answer.
# Every stop and every text sent with its notes is a line in VOICE_LOG; `desk voice-log` sums a day
# for the daily report (owner 10-29: does the check slow a reply or cost a booking).
VOICE_LOG = pathlib.Path.home() / ".realhibachi" / "desk-voice.jsonl"
VOICE_SAME_FRAME = 2
VOICE_LEAD_IN = re.compile(r"^(?:(?:hi|hey|hello)\b[^.!?]{0,40}?(?:[.!?]+|\s-\s)\s*)?"
                           r"(?:(?:it's |this is )?(?:rowling|bling)\b[^.!?-]{0,25}?(?:[.!?]+|\s-\s)\s*)?", re.I)
# "Loved “…”" from an iPhone, "❤️ to “…”" from Android: a reaction, not a question.
VOICE_TAPBACK = re.compile(r"^(?:(?:loved|liked|laughed at|emphasized|disliked|questioned)\s+|\W{0,3}\S{1,4}\W{0,3}\s+to\s+)[“\"]", re.I)
# A question: a "?" outside a link, a wh-word opening a sentence, or "can you" / "do we" / "is it"... ("Will do" is not one).
VOICE_ASKED = re.compile(r"\?|(?:^|[.!\n]\s*)(?:how|what|what's|when|where|which|who|why)\b|(?:^|[.!\n]\s*)"
                         r"(?:can|could|do|does|is|are|will|would|should|did|may)\s+(?:you|u|we|i|it|they|that|this|there|he|she|my|our|"
                         r"the|your|everyone|anyone|someone|y'all)\b", re.I)
VOICE_URL = re.compile(r"https?://\S+")
VOICE_SMALLTALK = re.compile(r"^(?:hi|hey|hello|good (?:morning|afternoon|evening)|morning|you(?:'re| are) (?:so |very )?welcome|"
                             r"thanks|thank you|no apolog\w*|no worries|anytime)\b", re.I)
VOICE_ANSWERISH = re.compile(r"^(?:yes|yep|yeah|yup|no|nope|not|sure|either|both|neither|of course|absolutely|definitely|yay|"
                             r"correct|right|exactly|we|it|it's|they|they're|that's|there|around|about|only|you can|you don't|you do|you'll)\b", re.I)
VOICE_NUMBER_Q = re.compile(r"how much|how many|how long|what time|\bwhen\b|price|cost|\bfees?\b|total|\$|what date|which day|budget", re.I)
VOICE_FILLER = frozenset(
    "the and for with you your are was what how does can will did that this there have has get got just also would could "
    "should about any some our its them they their then than from into been were want need know like much many when where "
    "which who why one more please thanks thank hey hello yes yeah okay i'm we're you're it's that's there's what's let's "
    "u ur pls thx".split())


def voice_frame(body: str) -> str:
    """The first three words once the greeting and our name are off - what a batch of follow-ups shares."""
    rest = VOICE_LEAD_IN.sub("", (body or "").strip(), count=1)
    words = re.sub(r"[^\w' ]", " ", rest).lower().split()
    return " ".join(words[:3]) if len(words) >= 3 else ""


def _voice_words(text: str) -> list[str]:
    return re.findall(r"[a-z0-9']+", (text or "").lower())


def voice_unanswered(body: str, msgs: list[dict]) -> tuple[str, str] | None:
    """(their question, our first sentence) when that sentence does not look like the answer; None when it does,
    or nothing was asked since our last text."""
    last_ours = max((i for i, m in enumerate(msgs) if m.get("direction") == "outbound"), default=-1)
    asked = [(m.get("body") or "").strip() for m in msgs[last_ours + 1:]
             if m.get("direction") == "inbound" and not VOICE_TAPBACK.match((m.get("body") or "").strip())
             and VOICE_ASKED.search(VOICE_URL.sub(" ", m.get("body") or ""))]
    if not asked:
        return None
    sentences = [s for s in re.split(r"(?<=[.!?])\s+", (body or "").strip()) if s]
    named = any(VOICE_NAMED.search(m.get("body") or "") for m in msgs
                if m.get("direction") == "outbound" and not VOICE_SYSTEM_TEXT.match((m.get("body") or "").strip()))
    # A first text gives the name first (SKILL §2): the answer is the sentence after it.
    while len(sentences) > 1 and not named and (VOICE_REINTRO.match(sentences[0])
                                                  or re.fullmatch(r"(?:hi|hey|hello)\b[^.!?]{0,20}[.!?]", sentences[0], re.I)):
        sentences.pop(0)
    first = sentences[0] if sentences else ""
    q = " ".join(asked)
    want = {w for w in _voice_words(q) if (len(w) >= 3 or w.isdigit()) and w not in VOICE_FILLER}
    said = _voice_words(first)
    overlap = any(w in want or (len(w) >= 5 and any(len(x) >= 5 and difflib.SequenceMatcher(None, w, x).ratio() >= 0.8 for x in want))
                  for w in said if w not in VOICE_FILLER)
    numbered = bool(VOICE_NUMBER_Q.search(q) and re.search(r"[\d$]", first))
    small = bool(VOICE_SMALLTALK.match(first)) and len(said) <= 5
    # Only a short sentence is judged on words: a long one ("Every guest gets 2 proteins...") is the answer more often than not.
    if small or (len(said) <= 6 and not (overlap or numbered or VOICE_ANSWERISH.match(first))):
        return asked[-1], first
    return None


def voice_others(phone: str, now: _dt.datetime) -> list[dict]:
    """What this machine sent other customers in the 24 h before `now` (VOICE_LOG; nothing when it cannot be read)."""
    out = []
    try:
        lines = VOICE_LOG.read_text(encoding="utf-8").splitlines()
    except OSError:
        return out
    for line in lines:
        try:
            r = json.loads(line)
        except ValueError:
            continue
        t = _at(r.get("t"))
        if r.get("event") == "sent" and r.get("phone") != phone and t and 0 <= (now - t).total_seconds() <= 24 * 3600:
            out.append(r)
    return out


def voice_log(event: str, phone: str, body: str, hits, ok: bool = False) -> None:
    """One line per stop / send in VOICE_LOG. A write that fails never stops a send."""
    try:
        VOICE_LOG.parent.mkdir(parents=True, exist_ok=True)
        rec = {"t": _now().isoformat(timespec="seconds"), "event": event, "phone": phone, "body": body,
               "hits": [list(h) for h in hits or []], "voice_ok": bool(ok), "session": desk_session()}
        with VOICE_LOG.open("a", encoding="utf-8") as f:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    except OSError:
        pass


def voice_check(body: str, msgs: list[dict], now: _dt.datetime, others: list[dict] = ()) -> list[tuple[str, str]]:
    """What in this text reads like a bot, as (level, line): level "stop" or "note"; [] = clean."""
    b = (body or "").strip()
    hits: list[tuple[str, str]] = []
    stop = lambda line: hits.append(("stop", line))
    note = lambda line: hits.append(("note", line))
    ours = [m.get("body") or "" for m in msgs if m.get("direction") == "outbound"]
    theirs = [m for m in msgs if m.get("direction") == "inbound" and _at(m.get("at"))]
    if "—" in b:
        stop("长破折号 —：手机上没人打这个，换句号")
    n = b.count("!")
    if n > VOICE_BANGS:
        stop(f"感叹号 {n} 个（最多 {VOICE_BANGS}）")
    n = len(VOICE_EMOJI_RE.findall(b))
    if n > VOICE_EMOJI:
        stop(f"emoji {n} 个（最多 {VOICE_EMOJI}）")
    m = VOICE_OPENER.match(b)
    if m:
        stop(f"情绪词开头「{m.group(0).strip()}」：直接从答案开始（Yes, noon works. / Got it. / Sure.）")
    m = VOICE_YOUR_N.search(b)
    if m:
        stop(f"「{m.group(0)}」：人数说 {m.group(1)} people / {m.group(1)} guests / the {m.group(1)} of you，不说光秃秃的 your {m.group(1)}")
    m = VOICE_BANNED.search(b)
    if m:
        stop(f"「{m.group(0)}」：voice.md §3 / SKILL §8 的词，不写")
    said = [o for o in ours if not VOICE_SYSTEM_TEXT.match(o.strip())]
    # The first text a person sends still gives the name (SKILL §2), even when the customer wrote first.
    if VOICE_REINTRO.match(b) and theirs and any(VOICE_NAMED.search(o) for o in said):
        last = max(_at(x["at"]) for x in theirs)
        if (now - last).total_seconds() < VOICE_REINTRO_H * 3600:
            stop(f"已经报过名字、客人 {VOICE_REINTRO_H} 小时内说过话，别再 Hi, it's Rowling：直接接话")
    for name, rx in VOICE_ONCE:
        if rx.search(b) and any(rx.search(o) for o in said):
            stop(f"「{name}」这个客人已经听过一次了：不重复")
    n = b.count(" - ")
    if n > VOICE_SPLICES:
        note(f"\" - \" 用了 {n} 次：想停顿就用句号，拆成两句")
    m = VOICE_SPLICE_OPENER.match(b)
    if m:
        note(f"「{m.group(0).strip()}」：反应词 + \" - \" 开头，偶尔可以，条条都这样就像机器")
    if "(" in b:
        note("括号：能写成一句话就别用括号")
    if ours:
        head = lambda s: " ".join(re.sub(r"[^\w' ]", " ", s).lower().split()[:2])
        h = head(ours[-1].strip())
        if h and h == head(b) and h.split()[0] not in VOICE_GREETING:
            note(f"和我上一条开头一样（「{h}」）：换个开头")
    f = voice_frame(b)
    if f:
        n = len({o.get("phone") for o in others if voice_frame(o.get("body") or "") == f})
        if n >= VOICE_SAME_FRAME:
            note(f"「{f} …」这样开头的，24 小时内已经发给 {n} 位别的客人：一个人一个人写，换个开头")
    miss = voice_unanswered(b, msgs)
    if miss:
        note(f"他问了「{miss[0][:60]}」，你第一句是「{miss[1][:60]}」：第一句先答他问的（voice.md §2 第 1 条）")
    return hits


def check_voice(body: str, msgs: list[dict], ok: bool, phone: str = "") -> list[tuple[str, str]]:
    """Stop the send over a sure tell unless --voice-ok; print the notes and send. The hits go back for the log."""
    now = _now()
    hits = voice_check(body, msgs, now, voice_others(phone, now))
    if not hits:
        return hits
    stops = [line for level, line in hits if level == "stop"]
    if stops:
        print(f"VOICE {'（--voice-ok，照发）' if ok else ''}读起来像机器（leads voice.md §2）：")
    else:
        print("VOICE 提醒（照发）：")
    for level, line in hits:
        print(f"   {'✗' if level == 'stop' else '·'} {line}")
    if not stops or ok:
        return hits
    print("      没发。改了 ✗ 那几条再发；这句确实就该这么写，带 --voice-ok")
    voice_log("stop", phone, body, hits)
    sys.exit(2)


def cmd_voice_log(a):
    """What the voice check did on this machine on one Pacific day, for the daily report (owner 2026-10-29: the week
    after it went live, does it slow a reply or cost a booking). A stop with no send to that number within 30 min is
    the one to look at."""
    day = _dt.date.fromisoformat(a.date) if a.date else _now().astimezone(PACIFIC).date()
    rows = []
    try:
        lines = VOICE_LOG.read_text(encoding="utf-8").splitlines()
    except OSError:
        lines = []
    for line in lines:
        try:
            r = json.loads(line)
        except ValueError:
            continue
        r["_t"] = _at(r.get("t"))
        if r["_t"] and r["_t"].astimezone(PACIFIC).date() == day:
            rows.append(r)
    sent = [r for r in rows if r.get("event") == "sent"]
    stops = [r for r in rows if r.get("event") == "stop"]
    noted = [r for r in sent if r.get("hits")]
    print(f"文风检查 {day}（本机 desk send）：发出 {len(sent)} 条，其中带提醒 {len(noted)}、--voice-ok "
          f"{sum(1 for r in sent if r.get('voice_ok'))}；拦下 {len(stops)} 次")
    tally: dict[str, int] = {}
    for r in rows:
        for level, line in r.get("hits") or []:
            if r.get("event") == "sent" and level == "stop" and not r.get("voice_ok"):
                continue
            key = ("✗ " if level == "stop" else "· ") + re.sub(r"「[^」]*」", "「…」", line.split("：")[0])
            key = "· 第一句没答他问的" if "第一句先答" in line else ("· 同一个开头发给多位客人" if "位别的客人" in line else key)
            tally[key] = tally.get(key, 0) + 1
    for key, n in sorted(tally.items(), key=lambda kv: -kv[1]):
        print(f"   {n:3}  {key}")
    waits = []
    for s in stops:
        after = [r["_t"] for r in sent if r.get("phone") == s.get("phone") and r["_t"] >= s["_t"]]
        mins = (min(after) - s["_t"]).total_seconds() / 60 if after else None
        waits.append(mins)
        when = s["_t"].astimezone(PACIFIC).strftime("%H:%M")
        tail = f"{mins:.0f} 分钟后改好发出" if mins is not None and mins <= 30 else (
            f"{mins:.0f} 分钟后才发出 ⚠" if mins is not None else "之后没发出 ⚠")
        print(f"   {when} {s.get('phone', '')[-4:]}  {tail}  ← {(s.get('body') or '')[:60]!r}")
    done = sorted(w for w in waits if w is not None)
    if done:
        print(f"   改写耗时：中位 {done[len(done) // 2]:.0f} 分钟、最长 {done[-1]:.0f} 分钟；30 分钟内没发出 {sum(1 for w in waits if w is None or w > 30)} 次")


def cmd_send(a):
    # argparse cannot take a positional after `--lead <id>`, so the body may
    # also come as --body / --body-file (the file is the safe path on Windows).
    body = read_text_arg(a.body_opt or a.body, a.body_file)
    phone = e164(a.phone)
    if a.seen:
        parse_seen(a.seen, _now())  # a --seen desk cannot read is refused before anything is read
    msgs = site_get("/api/admin/sms-thread", {"phone": phone}).get("messages") or []
    check_unread(phone, a.seen, a.force, msgs)
    hits = check_voice(body, msgs, a.voice_ok, phone)
    if a.media:
        # A picture goes through the same send route as a text (2026-10-08): the
        # duplicate brake, the follow-up caps and the timeline all apply. Upload
        # it, sign a link Twilio can fetch, hand the link to the route.
        from _api import signed_sales_media_url, upload_sales_media
        import datetime
        src = pathlib.Path(a.media)
        dest = f"sent/{datetime.date.today().isoformat()}/{re.sub(r'[^A-Za-z0-9._-]', '_', src.name)}"
        ctype = "image/png" if src.suffix.lower() == ".png" else "image/jpeg"
        upload_sales_media(str(src), dest, ctype)
        payload = {"phone": phone, "body": body, "session": desk_session(), "mediaUrl": signed_sales_media_url(dest)}
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
            sys.exit(2)
        print(f"OK    {payload['phone']}  {out.get('sid', '')}  {out.get('status', '')}  +1 media ({src.name})")
        print(f"      {body}")
        voice_log("sent", phone, body, hits, a.voice_ok)
        return
    # Which desk is sending: the server refuses a text when another session
    # answered this number minutes ago and the customer has not spoken since
    # (brake just_answered, 2026-10-07 - two desks answered Eileen 17 s apart).
    payload = {"phone": phone, "body": body, "session": desk_session()}
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
    voice_log("sent", phone, body, hits, a.voice_ok)


def cmd_email(a):
    """A customer email from support@, logged on the lead when --lead is given.
    For what a text cannot carry: carriers filter alcohol words on business
    texting, so the drinks answer goes by email (2026-09-29)."""
    text = read_text_arg(a.body, a.body_file)
    if not text.strip():
        raise SystemExit("empty email - pass the text or --body-file")
    if a.lead and not a.any_address:
        # Never an address typed from memory: 10-14 a guessed jackson.rogow@gmail.com got
        # Jackson's booking link, and his address is me@jacksonrogow.com. Allowed: the
        # lead's own email and the addresses the customer has written to us from.
        card = (site_get("/api/admin/desk", {"lead": a.lead}).get("cards") or [{}])[0]
        found = re.findall(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+", " ".join(
            [str((card.get("lead") or {}).get("email") or "")]
            + [str(e.get("from") or "") for e in (card.get("emails") or []) if e.get("direction") == "inbound"]))
        known = {x.lower() for x in found}
        if a.to.strip().lower() not in known:
            raise SystemExit(f"not sent: {a.to} is not this customer's address (on file: {', '.join(sorted(known)) or 'none'}). "
                             "Use one of those, or --any-address if the customer gave you a new one.")
    payload = {"to": a.to, "subject": a.subject, "text": text}
    if a.lead:
        payload["leadId"] = a.lead
    if a.cc:
        payload["cc"] = a.cc
    if a.attach:
        # A company booking wants our W-9 and insurance certificate (Taegan
        # 2026-10-13). The route checks names, types and size (lib/email/attachments.ts).
        import base64
        files = []
        for path in a.attach:
            f = pathlib.Path(path)
            if not f.is_file():
                raise SystemExit(f"--attach: no such file {path}")
            files.append({"filename": f.name, "content": base64.b64encode(f.read_bytes()).decode("ascii")})
        payload["attachments"] = files
    res = site_post("/api/admin/send-followup", payload)
    print(f"OK    emailed {a.to}  {dump(res)[:200]}")
    print("      " + a.subject + (f"  + {', '.join(res.get('attachments') or [])}" if a.attach else ""))


def _patch(payload: dict):
    try:
        out = site_post("/api/admin/leads", payload, method="PATCH")
    except ApiError as e:
        print(f"FAIL  {payload.get('action')} {e.status} {e.payload}")
        sys.exit(2)
    print(f"OK    {payload.get('action')}  {out}")


def source_line(src: dict, lead_id) -> str | None:
    """How did they find us - only for leads the system can't place (lib/heard-from.ts, D-1010)."""
    ask = src.get("ask")
    if ask == "answered":
        return f"   来源（客人说）：{src.get('heard_label') or src.get('heard_channel')} ·「{src.get('heard_from') or ''}」"
    if ask == "returning":
        return "   来源：老客人（这条线索之前办过派对），不问"
    if ask == "party_day":
        return "   来源未知 · 今天是派对日，不问（改天搭在客气话后问）"
    if ask == "asked":
        return (f"   🔎 来源未知 · {pt(src.get('heard_asked_at'))} 问过了，不再问 → 客人答了就"
                f" desk heard {lead_id} \"原话\"")
    if ask == "ask_now":
        done = "派对办完了" if src.get("stage") == "after_party" else "已锁单"
        return (f"   🔎 来源未知 · {done} → 这次回复如果只是一句客气话，结尾加 \"{src.get('question')}\""
                f"（只问一次；答了 desk heard {lead_id} \"原话\"）")
    if ask == "after_booking":
        return "   来源未知（锁单后再问，现在不问）"
    return None


def cmd_heard(a):
    payload = {"action": "set_heard", "leadId": a.lead, "heard": a.words}
    if a.as_channel:
        payload["channel"] = a.as_channel
    _patch(payload)


def cmd_chef_rule(a):
    """Chef-pay head rule decided while negotiating (owner 2026-10-10): the invoice keeps adults
    (adult portions on the prep sheet), the chef is paid kids' half heads. Read automatically
    wherever chef pay is worked out, through the order's lead."""
    if a.clear:
        _patch({"action": "set_chef_rule", "leadId": a.lead, "adultsAsKids": None})
        return
    if not a.kids:
        raise SystemExit("give --kids all|N (or --clear)")
    kids = "all" if a.kids == "all" else int(a.kids)
    _patch({"action": "set_chef_rule", "leadId": a.lead, "adultsAsKids": kids, **({"note": a.note} if a.note else {})})


def cmd_note(a):
    _patch({"action": "add_note", "leadId": a.lead, "note": read_text_arg(a.note, a.body_file)})


CHANNEL_NAMES = {"yelp": "Yelp", "facebook": "Facebook", "instagram": "Instagram"}


def _pt_iso(s: str) -> str:
    """'2026-10-26 18:21' or '10-26 18:21' (':05' seconds to keep same-minute lines in order),
    Pacific - the time the channel shows -> UTC ISO."""
    s = s.strip()
    for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%dT%H:%M", "%m-%d %H:%M", "%Y-%m-%d %H:%M:%S", "%m-%d %H:%M:%S"):
        try:
            d = _dt.datetime.strptime(s, fmt)
        except ValueError:
            continue
        if fmt.startswith("%m-"):
            d = d.replace(year=_dt.datetime.now(PACIFIC).year)
        return d.replace(tzinfo=PACIFIC).astimezone(_dt.timezone.utc).isoformat()
    raise SystemExit(f"--at {s!r}: use 'YYYY-MM-DD HH:MM' or 'MM-DD HH:MM', Pacific time")


def cmd_newlead(a):
    """A lead for a conversation that started outside the site (Yelp / Facebook /
    Instagram / a call): the workbench tracks every channel's leads (owner 2026-10-26).
    Name it the way the channel mail does - "Brenda Q. (Yelp)", "Maria (Facebook)" -
    so a later Yelp message from her lands on it."""
    body = {"name": a.name, "channel": a.via, "message": read_text_arg(a.message, a.body_file) or ""}
    if a.phone:
        body["phone"] = a.phone
    if a.email:
        body["email"] = a.email
    try:
        out = site_post("/api/admin/leads", body)
    except ApiError as e:
        print(f"FAIL  newlead {e.status} {e.payload}")
        sys.exit(2)
    print(f"OK    newlead  {out.get('leadId')}{'  (already on file)' if out.get('deduped') else ''}")


def cmd_channel(a):
    """Copy one Yelp / Facebook / Instagram message into the lead's conversation
    (owner 2026-10-26: the workbench keeps every lead's whole conversation).
    Both sides, as written, at the time the channel shows; the same message twice lands once."""
    text = (read_text_arg(a.text, a.body_file) or "").strip()
    if not text:
        raise SystemExit("the message text: an argument or --body-file")
    payload = {"action": "channel_message", "leadId": a.lead, "channel": a.via, "direction": a.direction, "text": text}
    if a.at:
        payload["at"] = _pt_iso(a.at)
    if a.author:
        payload["author"] = a.author
    _patch(payload)


def cmd_hold(a):
    _patch({"action": "set_hold", "leadId": a.lead, "days": a.days})


def cmd_status(a):
    _patch({"action": "set_status", "leadId": a.lead, "status": a.status})


def cmd_block(a):
    """Keep an identified sales pitch off the 213 booking line (owner 2026-10-28): its calls are
    rejected before they ring - no lead, no missed-call text - and the lead is marked disqualified.
    Only for a number the call itself showed is selling something; never by area code."""
    payload = {"action": "block_caller", "leadId": a.lead}
    if a.clear:
        payload["clear"] = True
    elif a.why:
        payload["note"] = a.why
    _patch(payload)


def cmd_contacted(a):
    _patch({"action": "mark_contacted", "leadId": a.lead})


def cmd_ack(a):
    _patch({"action": "ack_replies", "leadId": a.lead, "clear": bool(a.clear)})


def cmd_callback(a):
    """请回电 (2026-10-09): the customer wants a phone call - ring the owner's App now. He presses 1 to
    be put through from the 213 line, 2 for a reminder in 10 minutes, 3 if no call is needed; until
    then lead-watch rings again every 10 minutes, 3 rings at most, 8 AM-10 PM. Texts that say
    "call me" ring by themselves; this is for the ones that don't ("I'm driving", an email)."""
    out = site_post("/api/admin/callback-ring", {"leadId": a.lead, "why": a.why or ""})
    if out.get("rang"):
        print(f"OK    rang the owner's App (ring {out.get('attempt')} of 3)  {' '.join(out.get('callSids') or [])}")
    else:
        print(f"--    not rung: {out.get('skipped') or out.get('error')}")


def cmd_fields(a):
    fields = {}
    for kv in a.pairs:
        k, sep, v = kv.partition("=")
        if not k or not sep:
            raise SystemExit(f"expected key=value, got {kv!r}")
        fields[k] = int(v) if re.fullmatch(r"-?\d+", v) else v
    _patch({"action": "update_fields", "leadId": a.lead, "fields": fields})


def _parse_rates(pairs, flag: str) -> dict:
    """ID=PRICE pairs for a deal's extraRates: that item at that price per guest
    instead of the catalog's (D-1017-01, Saturday tables: tables_chairs=5)."""
    rates = {}
    for pair in pairs or []:
        m = re.fullmatch(r"([a-z_]+)=(\d+(?:\.\d{1,2})?)", pair)
        if not m:
            raise SystemExit(f"{flag} {pair!r}: use ID=PRICE, e.g. tables_chairs=5")
        x, r = m.group(1), float(m.group(2))
        cap = SETUP_PRICES.get(x)
        if r <= 0 or (cap is not None and r >= cap):
            raise SystemExit(f"{flag} {pair!r}: a deal rate is above $0 and under the catalog price"
                             + (f" ({money(cap)} a guest)" if cap is not None else "") + " - free is --free / --deal-free")
        rates[x] = r
    return rates


def _per_guest(r: float) -> str:
    """$5 / $4.50 - a per-guest deal rate as the invoice line prints it."""
    return f"${r:.0f}" if float(r).is_integer() else f"${r:.2f}"


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
    free_ids = [x.strip() for x in (a.free or "").split(",") if x.strip()]
    rates = _parse_rates(a.rate, "--rate")
    both = sorted(set(free_ids) & set(rates))
    if both:
        raise SystemExit(f"--free and --rate both name {both} - pick one")
    est = a.est
    if est is None:
        # Tables at a deal rate are billed inside the $599 minimum, as the
        # invoice bills them: price the party with them at the catalog price,
        # take the deal's cut back off, never under the minimum.
        heads = a.adults + a.kids
        cut = sum((SETUP_PRICES[x] - r) * heads for x, r in rates.items() if x in SETUP_PRICES)
        p = price_for(a.adults, a.kids, a.date, a.zip,
                      tables=heads if "tables_chairs" in rates else 0, utensils=heads if "utensils" in rates else 0)
        if p and p.get("ok") and p.get("price"):
            pr = p["price"]
            # A waived drive is not in the price the customer sees either.
            waived = (pr.get("travelFee") or 0) if a.waive_travel else 0
            est = round(max(pr["total"] - cut - waived, MINIMUM_SPEND + (pr.get("travelFee") or 0) - waived))
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
    # A concession rides on the link as a signed rule (custom-deal, skill §10):
    # free tables for locking the date, Saturday's half-price tables
    # (D-1017-01), a flat amount off. Rules, never a frozen total, so a changed
    # headcount still prices right. The order puts a free or rated item on the
    # party itself (invoice withDealExtras), so the chef's sheet loads it.
    deal = {}
    if free_ids:
        deal["freeExtraIds"] = free_ids
    if rates:
        deal["extraRates"] = rates
    if a.flat_off:
        deal["flatOff"] = a.flat_off
    if a.waive_travel:
        # The drive is on the owner: the order bills $0 travel on purpose and
        # still records the miles for the chef's pay (2026-10-21).
        deal["travelWaived"] = True
    if deal:
        if not a.lead:
            raise SystemExit("a deal (--free / --rate / --flat-off / --waive-travel) is signed per lead: give --lead")
        signed = site_post("/api/admin/custom-deal", {"leadId": a.lead, **deal, **({"note": a.deal_note} if a.deal_note else {})})
        if not signed.get("ok") or not signed.get("query"):
            raise SystemExit(dump(signed))
        dropped = sorted(set(rates) - set(((signed.get("deal") or {}).get("extraRates") or {})))
        if dropped:
            raise SystemExit(f"--rate {dropped}: the site would not sign that (not an extra a deal can price) - no link made")
        if a.waive_travel and not (signed.get("deal") or {}).get("travelWaived"):
            raise SystemExit("--waive-travel: the site did not sign the waiver (deployed before travelWaived?) - no link made")
        deal = signed.get("deal") or deal
        long_url += "&" + signed["query"]
    out = site_post("/api/admin/short-link", {"url": long_url, **({"leadId": a.lead} if a.lead else {})})
    print(out.get("shortUrl") or dump(out))
    if deal:
        print(f"   deal: {deal}")
    with_tables = f"（含桌椅 {_per_guest(rates['tables_chairs'])}/人）" if "tables_chairs" in rates and a.est is None else ""
    print(f"   {a.adults} 大人 + {a.kids} 小孩 · {a.city} · {a.date or '日期待定'}{' ' + a.time if a.time else ''}"
          f" · 估 ${est if est is not None else '?'}{with_tables} · 有效至 {pt(out.get('expiresAt'))}")
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


def _order_lint(order: dict) -> dict | None:
    """What the order is missing that the customer is owed - the invoice app's
    order lint (D-1017-02): an entitlement the rules give that is not on the
    invoice, a free tray or a deal item the party does not carry, travel never
    measured, no menu in the last three days, a planner that disagrees on the
    headcount. None when it could not be asked."""
    try:
        res = site_get("/api/admin/orders/lint", {"id": order["id"]})
    except ApiError as e:
        print(f"   (订单检查没连上发票系统：{e.status})")
        return None
    return res if isinstance(res, dict) and res.get("ok") else None


def _print_lint(lint: dict | None) -> int:
    """The ⚠ 缺项 block: blocking items (!!) then warnings (!), each with its fix. Returns how many block."""
    if lint is None:
        return 0
    blocking, warnings = lint.get("blocking") or [], lint.get("warnings") or []
    if not blocking and not warnings:
        print("   ✓ 缺项：无")
        return 0
    print(f"   ⚠ 缺项（{len(blocking)} 项拦着备料单和前一天的提醒）：" if blocking else "   ⚠ 缺项（提醒，不拦）：")
    for mark, x in [("!!", x) for x in blocking] + [("! ", x) for x in warnings]:
        print(f"     {mark} {x.get('messageZh') or x.get('message')}")
        if x.get("fix"):
            print(f"        改法：{x['fix']}")
    return len(blocking)


def _invoice_drift(before: dict, after: dict) -> list[str]:
    """What moved on an order between two reads of its invoice - printed when a save is refused as out of date."""
    lines = []
    was, now = before.get("contactInfo") or {}, after.get("contactInfo") or {}
    for key in ("clientName", "email", "phone", "eventDate", "eventTime", "eventAddress", "specialNotes"):
        if (was.get(key) or "") != (now.get(key) or ""):
            lines.append(f"{key}: {was.get(key)!r} -> {now.get(key)!r}")
    for key in ("adultCount", "childCount", "mode", "paymentMethod", "depositAmount"):
        if before.get(key) != after.get(key):
            lines.append(f"{key}: {before.get(key)!r} -> {after.get(key)!r}")
    rows = lambda d: f"{len(d.get('guests') or [])} rows, {sum(1 for g in (d.get('guests') or []) if g.get('proteins'))} with picks"
    if json.dumps(before.get("guests"), sort_keys=True) != json.dumps(after.get("guests"), sort_keys=True):
        lines.append(f"guests: {rows(before)} -> {rows(after)}")
    for key in ("quickCountItems", "partyExtras", "promotions", "customDeal", "travelFee"):
        if json.dumps(before.get(key), sort_keys=True) != json.dumps(after.get(key), sort_keys=True):
            lines.append(f"{key}: changed")
    return lines


def _totals(data: dict) -> dict:
    return invoice_post("/api/invoice", data)["invoice"]


def _setup_units(data: dict, x: str) -> int:
    """Guests the invoice bills a setup item for right now, counted the way the
    engine's extraValue counts them: the rows' flags once there are rows, else
    the party-wide partyExtras line (a fresh order has no rows yet, 2026-10-09)."""
    if data.get("mode") == "detailed" and data.get("guests"):
        flag = "tablesChairs" if x == "tables_chairs" else "utensils"
        return sum(1 for g in data["guests"] if g.get(flag))
    return next((int(e.get("qty") or 0) for e in (data.get("partyExtras") or []) if e.get("id") == x), 0)


def _little_kids(data: dict) -> int:
    """Free 3-4 year olds the promotions count, as the engine reads them: the
    planner's "Little kids (3-4) ×N" line or under5_auto (one when it gives no number)."""
    hit = next((p for p in (data.get("promotions") or []) if _is_little_line(p)), None)
    m = re.search(r"×([0-9]+)", str(hit.get("label") or "")) if hit else None
    return int(m.group(1)) if m else (1 if hit else 0)


def _is_little_line(p: dict) -> bool:
    return p.get("id") == "under5_auto" or bool(re.match(r"little kids", str(p.get("label") or ""), re.I))


def _set_little_line(data: dict, n: int, changes: list, why: str) -> None:
    """The order's Little kids line set to n free 3-4 year olds (none at 0), in
    place, as the planner writes it: under5_auto, "Little kids (3-4) @ $0 ×N",
    their child-rate rows refunded in full. Until 2026-10-24 desk left it to a
    hand-typed --add-promo (the × through the shell), and a toddler row without
    it was billed $29.90."""
    promos = data.get("promotions") or []
    stored = [p for p in promos if _is_little_line(p)]
    new = {"id": "under5_auto", "label": f"Little kids (3-4) @ $0 ×{n}", "amount": math.floor(CHILD_PRICE * n * 100 + 0.5) / 100} if n > 0 else None
    if [(p.get("id"), p.get("label"), float(p.get("amount") or 0)) for p in stored] == ([(new["id"], new["label"], new["amount"])] if new else []):
        return
    keep = [p for p in promos if not _is_little_line(p)]
    at = sum(1 for p in promos[:promos.index(stored[0])] if not _is_little_line(p)) if stored else len(keep)
    data["promotions"] = keep[:at] + ([new] if new else []) + keep[at:]
    old = ", ".join(f"{p.get('label') or p.get('id')} {money(p.get('amount'))}" for p in stored) or "none"
    changes.append(f"little kids: {old} -> {new['label'] + ' ' + money(new['amount']) if new else 'none'} ({why})")


def _paid_heads(data: dict) -> tuple[int, int]:
    """(adults, paying kids 5-12) as the invoice's paidGuestCount counts them
    for the party-size tier: the booking's adults and _paid_children."""
    return max(0, int(data.get("adultCount") or 0)), _paid_children(data)


def _is_party_line(p: dict) -> bool:
    return str(p.get("id") or "").startswith("official_party")


def _party_s(adults: int, kids: int) -> str:
    return f"{adults} adult{'' if adults == 1 else 's'} + {kids} kid{'' if kids == 1 else 's'}"


def _retier_party_size(data: dict, changes: list, removed_by_hand: bool, asked: bool = False) -> None:
    """The party-size line follows the headcount. It is a stored amount like
    every promotion, so a headcount desk moved kept the old tier: RH-20261022-0063
    went from 8+2 to 11+1 and kept no line, $30 too much (owner 2026-10-24).
    Replaces the official_party* line(s) with the tier for the new paying heads
    and touches no other line. `asked` (--retier) also says when it is right."""
    promos = data.get("promotions") or []
    stored = [p for p in promos if _is_party_line(p)]
    adults, kids = _paid_heads(data)
    heads = tier_heads(adults, kids)
    who = f"{heads} paying heads ({_party_s(adults, kids)}, a kid 5-12 counts half)"
    old = ", ".join(f"{p.get('id')} {money(p.get('amount'))}" for p in stored) or "none"
    if heads >= party_tiers()[1]:
        print(f"   ⚠ party size: {who} is a custom quote ({party_tiers()[1]}+) - desk leaves the party-size line as it is ({old}); price it by hand")
        return
    new = party_line(heads)
    if removed_by_hand and not stored:
        if new:
            print(f"   party size: {who} earns {new['id']} {money(new['amount'])} - not put back, the line came off with --remove-promo in this command")
        return
    if new and not stored:
        stand_in = next((p for p in promos if str(p.get("id") or "").startswith("appreciation")), None)
        if stand_in:
            # leads skill: appreciation $50 does not stack with the party-size
            # discount unless the owner says so for that party.
            print(f"   ⚠ party size: {who} earns {new['id']} {money(new['amount'])}, not added - {stand_in.get('id')} "
                  f"{money(stand_in.get('amount'))} stands in for it (they do not stack unless the owner says so)")
            return
    if [(p.get("id"), float(p.get("amount") or 0)) for p in stored] == ([(new["id"], float(new["amount"]))] if new else []):
        if asked:
            print(f"   party size: {who} - {old} is already right")
        return
    keep = [p for p in promos if not _is_party_line(p)]
    at = sum(1 for p in promos[:promos.index(stored[0])] if not _is_party_line(p)) if stored else len(keep)
    data["promotions"] = keep[:at] + ([new] if new else []) + keep[at:]
    now = f"{new['id']} {money(new['amount'])} \"{new['label']}\"" if new else f"none (under {party_tiers()[0][0]['min']})"
    changes.append(f"party size: {who} - {old} -> {now}")
    for p in keep:
        if re.search(r"party.?size", str(p.get("label") or ""), re.I):
            print(f"   ⚠ promo {p.get('id')} {p.get('label')!r} {money(p.get('amount'))} reads like a party-size discount but is not an "
                  "official_party line - left alone; --remove-promo it if the official line now covers it")


def _warn_frozen_weekday(data: dict) -> None:
    # Promotions are stored as a dollar amount, not a rule, so the per-head
    # ones kept the number they were computed at and silently overcharged a
    # new guest. Gregorio 2026-10-05: one late adult left the Weekday Special at
    # 13 adults and "Tables & Chairs on us" at 17 guests, $15 too little off.
    # Since 2026-10-24 the invoice engine moves a line sent back unchanged by
    # the rule's own step when the order is saved ($5 an adult, $2.45 a child,
    # D-1017-02) and the save says so; a --promo in the same command is yours
    # and stands. Until the save, the total check below still shows the old one.
    for x in (data.get("promotions") or []):
        if str(x.get("id", "")).startswith("official_weekday"):
            print(f"   · promo {x.get('id')} {money(x.get('amount'))} was priced for the old headcount - "
                  "the save re-prices it by the rule (the invoice engine reports it below)")


def _weekday_appetizer(line: dict, data: dict) -> float:
    """What of a Weekday Special line refunds free trays on the order (they ride
    in partyExtras, so the two net out); the rest is its per-head cut. Trays
    counted as _swap_free_appetizer counts them: one, unless the order has more
    of that appetizer than the --free-item gifts and one - then the amount over
    the per-head part says how many (one per 10 guests, or some bought). A tray
    the line refunds but the order does not carry is not netted, so it shows."""
    label = str(line.get("label") or "")
    if re.search(r"appetizer platter", label, re.I):  # before 09-22: one of each
        return sum(APPETIZER_PRICES.values())
    m = OFFICIAL_APPETIZER.search(label)
    if not m:
        return 0.0
    app = m.group(1).lower().replace(" ", "_")
    price = APPETIZER_PRICES[app]
    have = next((int(e.get("qty") or 0) for e in (data.get("partyExtras") or []) if e.get("id") == app), 0)
    gifts = (GIFT_APPETIZER.fullmatch(str(x.get("label") or "")) for x in (data.get("promotions") or []))
    free = have - sum(int(g.group(2)) for g in gifts if g and g.group(1) == APPETIZER_LABELS[app])
    trays = 1
    if free > 1:
        adults, kids = _paid_heads(data)
        heads = WEEKDAY_ADULT_OFF * adults + WEEKDAY_CHILD_OFF * kids
        trays = min(free, max(1, round((float(line.get("amount") or 0) - heads) / price)))
    return min(trays, max(0, free)) * price


def _price_check(data: dict, inv: dict) -> None:
    """The order's TOTAL against desk price for the same party (owner
    2026-10-24): RH-20261022-0063 stood at $868.80 with no party-size line
    while desk price said $838.80, and nothing on the dry run showed it.

    Expected = desk price (adults, kids 5-12, date, tables, utensils) + what
    the order adds that desk price does not know (upgrades, trays, noodles,
    sides) - its own promotions (free appetizers, deals, appreciation, FREE:
    trays) + its travel, at the $599 minimum like the invoice. The lines desk
    price stands for are the party-size tier, the Weekday Special's per-head
    cut and the free 3-4 year olds, so a wrong one of those is the gap."""
    try:
        adults, kids = _paid_heads(data)
        if adults + kids < 1:
            print("   (total check skipped: no paying guests on the order)")
            return
        tables, utensils = _setup_units(data, "tables_chairs"), _setup_units(data, "utensils")
        promos = data.get("promotions") or []
        party = [x for x in promos if _is_party_line(x)]
        weekday = [x for x in promos if str(x.get("id") or "").startswith("official_weekday")]
        little = [x for x in promos if _is_little_line(x)]
        import datetime as _dt
        from zoneinfo import ZoneInfo
        date = str((data.get("contactInfo") or {}).get("eventDate") or "")[:10]
        usable = bool(re.fullmatch(r"\d{4}-\d{2}-\d{2}", date)) and date >= _dt.datetime.now(ZoneInfo("America/Los_Angeles")).date().isoformat()
        p = price_for(adults, kids, date if usable else None, None, tables, utensils)
        if not p or not p.get("ok"):
            print("   (total check skipped: desk price did not answer)")
            return
        if p.get("customQuote"):
            print(f"   (total check skipped: {_party_s(adults, kids)} is a custom quote, no desk price)")
            return
        # No date, or one already past (the engine prices neither): the order's
        # own Weekday Special line says which rate it was sold at.
        pr = p["price"] if usable or not weekday else (p.get("ifMondayToThursday") or p["price"])
        food = float(pr.get("foodSubtotal") or 0)
        rentals = float((pr.get("rentals") or {}).get("amount") or 0)
        if pr.get("minimumApplied"):
            # The engine's discount is what the minimum left of it; the invoice
            # takes the whole tier before its own minimum.
            line = party_line(tier_heads(adults, kids))
            tier = float(line["amount"]) if line else 0.0
        else:
            tier = float(pr.get("partySizeDiscount") or 0)
        stand_in = None
        if tier and not party:
            stand_in = next((x for x in promos if str(x.get("id") or "").startswith("appreciation")), None)
            if stand_in:
                tier = 0.0  # appreciation in place of the tier (they do not stack)
        amt = lambda x: float(x.get("amount") or 0)
        appetizers = sum(_weekday_appetizer(x, data) for x in weekday)
        own = [x for x in promos if not (_is_party_line(x) or x in weekday or x in little)]
        other = round(sum(amt(x) for x in own) + appetizers, 2)
        extras = round(float(inv.get("subtotal") or 0) - float(inv.get("baseCost") or 0)
                       - tables * SETUP_PRICES["tables_chairs"] - utensils * SETUP_PRICES["utensils"], 2)
        travel = float(inv.get("travelFee") or 0)
        floor = float(p.get("minimum") or MINIMUM_SPEND)
        raw = food + rentals - tier + extras - other
        expected = round(max(raw, floor) + travel, 2)
        total = float(inv["cashTotal"]) if inv.get("cashTotal") is not None else float(inv.get("finalTotal") or 0) - float(inv.get("creditCardFee") or 0)
        gap = round(total - expected, 2)
        party_s = (_party_s(adults, kids)
                   + (f" · {date}" if usable else " · no date" if not date else f" · {date} (past)")
                   + (f" · tables {tables}" if tables else "") + (f" · utensils {utensils}" if utensils else ""))
        tier_s = f"-{money(tier)}" if tier else "none"
        sums = (f"desk price {party_s} → {money(pr.get('total'))} [{pr.get('plan')}, party size {tier_s}]"
                f" + extras {money(extras)} - other promos {money(other)} + travel {money(travel)}"
                + (f", at the {money(floor)} minimum" if raw < floor else ""))
        notes = ([f"no usable date - compared at the {pr.get('plan')} rate the order's promotions imply"] if not usable else []) + (
            [f"{stand_in.get('id')} stands in for the party-size discount"] if stand_in else [])
        if abs(gap) <= 1:
            print(f"   ✓ total check: TOTAL {money(total)} = {sums}" + (f"  ({'; '.join(notes)})" if notes else ""))
            return
        bar = "   " + "!" * 75
        print(bar)
        print(f"   !!! TOTAL CHECK FAILED: the order's TOTAL is {money(total)}, desk price makes it {money(expected)}"
              f" - {money(abs(gap))} too {'much' if gap > 0 else 'little'}")
        print(f"   !!!   {sums} = {money(expected)}")
        for n in notes:
            print(f"   !!!   {n}")
        heads = tier_heads(adults, kids)
        stored_party = ", ".join(f"{x.get('id')} -{money(amt(x))}" for x in party) or "no line"
        print(f"   !!!   party size: order {stored_party}; desk price {tier_s} for {heads} paying heads")
        for x in weekday:
            a_ = _weekday_appetizer(x, data)
            print(f"   !!!   weekday: {x.get('id')} -{money(amt(x))}" + (f" (of which {money(a_)} is the free appetizer)" if a_ else "")
                  + f"; desk price prices this date at {pr.get('plan')}")
        for x in little:
            print(f"   !!!   little kids: {x.get('label')} -{money(amt(x))}")
        print("   !!!   a stored discount is probably wrong (party size / Weekday Special / little kids) - fix it before this goes out")
        if not stand_in and abs(sum(amt(x) for x in party) - tier) > 0.005:
            right = party_line(heads)
            print(f"   !!!   likely fix: --retier (puts {right['id']} {money(right['amount'])} on for {heads} paying heads)" if right
                  else f"   !!!   likely fix: --retier (takes the party-size line off: {heads} paying heads earn none)")
        elif len(weekday) == 1:
            print(f"   !!!   if the Weekday Special is the stale line: the save re-prices an unchanged one by the rule (invoice D-1017-02); "
                  f"by hand: --promo {weekday[0].get('id')}={amt(weekday[0]) + gap:.2f}")
        print(bar)
    except (Exception, SystemExit) as why:  # advisory: never in the way of a save
        print(f"   (total check skipped: {why})")


def _deal_lines(data: dict) -> list[dict]:
    """The order's deal lines priced from its rules (customDeal) against the party
    as it stands, line for line the invoice engine's customDealPromotions
    (lib/pricing.ts). The planner and the staff tool re-run that on every change;
    a saved invoice keeps the lines as stored amounts, so desk re-runs it here.
    Heads are counted like paidAdultCount / paidChildCountForDeal: the rows once
    there are rows, with the free 3-4 year olds left out, else the booking's
    counts. Only setup items are priced here: a deal on anything else is
    refused, not guessed."""
    deal = data.get("customDeal") or {}
    free_ids = list(deal.get("freeExtraIds") or [])
    rates = deal.get("extraRates") or {}
    odd = sorted(({str(x) for x in free_ids} | set(rates)) - set(SETUP_PRICES))
    if odd:
        raise SystemExit(f"this order's deal covers {odd}, which desk cannot price (only {sorted(SETUP_PRICES)}) - it will not guess "
                         "the deal lines; change the party in the invoice tool, which re-prices the deal itself")
    num = lambda v: isinstance(v, (int, float)) and not isinstance(v, bool)
    cents = lambda v: math.floor(v * 100 + 0.5) / 100  # the engine's Math.round(v * 100) / 100 (half up)
    rows = data.get("guests") or []
    detailed = data.get("mode") == "detailed"
    # Free 3-4 year olds are flagged on the rows or counted on the planner's
    # "Little kids (3-4) ×N" line; countPaidChildren takes the larger.
    little = _little_kids(data)
    if detailed and rows:
        kids = [g for g in rows if g.get("isChild")]
        adults = len(rows) - len(kids)
        children = max(0, len(kids) - max(sum(1 for g in kids if g.get("isLittle")), little))
    else:
        adults = max(0, int(data.get("adultCount") or 0))
        children = max(0, int(data.get("childCount") or 0) - (0 if detailed else little))
    lines = []
    adult_off = max(0.0, ADULT_PRICE - deal["adultRate"]) if num(deal.get("adultRate")) else 0.0
    child_off = max(0.0, CHILD_PRICE - deal["childRate"]) if num(deal.get("childRate")) else 0.0
    cut = cents(adult_off * adults + child_off * children)
    if cut > 0:
        parts = ([f"${deal['adultRate']:.2f}/adult"] if adult_off > 0 else []) + ([f"${deal['childRate']:.2f}/child"] if child_off > 0 else [])
        lines.append({"id": "deal_rate", "label": "Your rate: " + ", ".join(parts), "amount": cut})
    cut = cents(sum(_setup_units(data, x) * SETUP_PRICES[x] for x in free_ids))
    if cut > 0:
        lines.append({"id": "deal_free_extras", "label": " + ".join(SETUP_LABELS[x] for x in free_ids) + " on us", "amount": cut})
    # Items at the deal's price (D-1017-01, Saturday's tables at $5 a guest), in
    # catalog order as the engine walks PARTY_EXTRAS. Free wins over a rate.
    cut, names = 0.0, []
    for x, price in SETUP_PRICES.items():
        r, units = rates.get(x), _setup_units(data, x)
        if not num(r) or x in free_ids or not r >= 0 or r >= price or units <= 0:
            continue
        cut += (price - r) * units
        names.append(f"{SETUP_LABELS[x]} at {_per_guest(r)}/guest" if r > 0 else f"{SETUP_LABELS[x]} on us")
    cut = cents(cut)
    if cut > 0:
        lines.append({"id": "deal_extra_rates", "label": " + ".join(names), "amount": cut})
    flat = cents(max(0.0, deal["flatOff"])) if num(deal.get("flatOff")) else 0.0
    if flat > 0:
        lines.append({"id": "deal_flat", "label": f"Special discount ({deal['note']})" if deal.get("note") else "Special discount", "amount": flat})
    return lines


# The free appetizer is the customer's pick of three (owner 2026-09-22). The
# deposit page writes the default, gyoza, so the pick comes in a text - every
# week. A line names its appetizer in the label, read the way the engine reads
# it (freeAppetizerVariantFromLabel): "... + FREE appetizer: Gyoza" on the
# official lines, "FREE: Gyoza (10 pcs) x2" from --free-item.
OFFICIAL_APPETIZER = re.compile(r"free appetizer[^:]*:\s*(gyoza|edamame|spring rolls)", re.I)
GIFT_APPETIZER = re.compile(r"FREE: (" + "|".join(map(re.escape, APPETIZER_LABELS.values())) + r") x(\d+)")


def _paid_children(data: dict) -> int:
    """Children at the child rate, as the engine's countPaidChildren counts them
    for the weekday cut: the rows once there are rows, else the count, less the
    free 3-4 year olds."""
    rows = data.get("guests") or []
    if data.get("mode") == "detailed" and rows:
        kids = [g for g in rows if g.get("isChild")]
        return max(0, len(kids) - max(sum(1 for g in kids if g.get("isLittle")), _little_kids(data)))
    return max(0, int(data.get("childCount") or 0) - _little_kids(data))


def _swap_free_appetizer(data: dict, new: str) -> list[str]:
    """Make the order's free appetizer `new` (gyoza / edamame / spring_rolls).
    Its trays move to `new` in partyExtras and its lines name `new`, as the
    invoice tool's switch does (changeFreeAppetizer). Each line's amount moves
    by the trays' price difference - exactly what the extras move by - so the
    total does not change, and whatever else the line takes off (the weekday
    per-head part, an amount re-stated by hand) stays. The lines: the official
    one (Weekday Special / 20+ guests / full setup) with the --free-item gifts
    of the same appetizer (more trays of it); with no official line, the
    --free-item gifts if they are all one appetizer. Changes `data`, returns
    the change lines."""
    if new not in APPETIZER_PRICES:
        raise SystemExit(f"--free-appetizer {new!r}: use one of {sorted(APPETIZER_PRICES)}")
    promos = data.get("promotions") or []
    official = [x for x in promos if x.get("id") in FREE_APPETIZER_PROMO_IDS]
    label_id = {v: k for k, v in APPETIZER_LABELS.items()}
    gifts = []  # (line, appetizer, trays)
    for x in promos:
        m = GIFT_APPETIZER.fullmatch(str(x.get("label") or ""))
        if m:
            gifts.append((x, label_id[m.group(1)], int(m.group(2))))
    if len(official) > 1:
        raise SystemExit(f"this order has {[x.get('id') for x in official]} - they never stack; fix it in the invoice tool")
    line = official[0] if official else None
    if line:
        m = OFFICIAL_APPETIZER.search(str(line.get("label") or ""))
        if not m:
            raise SystemExit(f"{line.get('id')} {line.get('label')!r} names no single appetizer (an appetizer platter is all three) - "
                             "nothing to swap; change it in the invoice tool")
        old = m.group(1).lower().replace(" ", "_")
    elif len({k for _, k, _ in gifts}) == 1:
        old = gifts[0][1]
    elif gifts:
        raise SystemExit("this order's free trays are different appetizers (" + ", ".join(str(x.get("label")) for x, _, _ in gifts)
                         + ") - desk will not guess which one they mean; change it in the invoice tool")
    else:
        raise SystemExit("this order has no free appetizer to swap: no " + " / ".join(FREE_APPETIZER_PROMO_IDS)
                         + " line and no --free-item 'FREE:' line (trays they buy are --add-extra)")
    if old == new:
        raise SystemExit(f"--free-appetizer {new}: the free appetizer is already {new} - nothing to change")
    for x, k, _ in gifts:
        if k != old:
            print(f"   ⚠ {x.get('label')} ({x.get('id')}) is a gift of its own - left as it is")
    same = [(x, n) for x, k, n in gifts if k == old]
    gifted = sum(n for _, n in same)
    extras = data.setdefault("partyExtras", [])
    row = next((e for e in extras if e.get("id") == old), None)
    have = int(row.get("qty") or 0) if row else 0
    # The trays each line gives: a --free-item line says so ("x2"); the official
    # line gives what is left, one tray - unless more are left: one per 10
    # guests (--free-appetizer-trays) or some of them bought. Then its amount
    # says how many: their menu price on top of the weekday per-head part.
    free = have - gifted
    trays = free if line else 0
    if line and free > 1:
        heads = 0.0
        if line["id"] == "official_weekday":
            heads = WEEKDAY_ADULT_OFF * int(data.get("adultCount") or 0) + WEEKDAY_CHILD_OFF * _paid_children(data)
        n = (float(line.get("amount") or 0) - heads) / APPETIZER_PRICES[old]
        if abs(n - round(n)) > 0.001 or not 1 <= round(n) <= free:
            raise SystemExit(f"{free} {old} trays could be {line['id']}'s, and its {money(line.get('amount'))} less the per-head part "
                             f"{money(heads)} is not a whole number of {money(APPETIZER_PRICES[old])} trays from 1 to {free} - "
                             f"re-state it first (--promo {line['id']}=<per-head part + {money(APPETIZER_PRICES[old])} a free tray>) "
                             "or swap it in the invoice tool")
        trays = round(n)
    moved = trays + gifted
    if (line and trays < 1) or moved < 1 or moved > have:
        raise SystemExit(f"the free lines name {old}, but the order has {have} {old} tray(s) for them"
                         f"{f' (--free-item gives {gifted})' if gifted else ''} - fix the trays first")
    to = next((e for e in extras if e.get("id") == new), None)
    had = int(to.get("qty") or 0) if to else 0
    row["qty"] = have - moved
    if to:
        to["qty"] = had + moved
    else:
        extras.append({"id": new, "qty": moved})
    data["partyExtras"] = [e for e in extras if int(e.get("qty") or 0) > 0]
    delta = APPETIZER_PRICES[new] - APPETIZER_PRICES[old]
    out = [f"free appetizer: {old} -> {new}, {moved} tray(s): partyExtras {old} {have} -> {have - moved}, {new} {had} -> {had + moved}"]
    for x, n in ([(line, trays)] if line else []) + same:
        was = float(x.get("amount") or 0)
        if x is line:
            m = OFFICIAL_APPETIZER.search(x["label"])
            x["label"] = x["label"][:m.start(1)] + new.replace("_", " ").title() + x["label"][m.end(1):]
        else:
            x["label"] = f"FREE: {APPETIZER_LABELS[new]} x{n}"
        x["amount"] = round(was + delta * n, 2)
        out.append(f"promo {x.get('id')} '{x['label']}': {money(was)} -> {money(x['amount'])}"
                   + (f" ({n} tray(s) x {delta:+.2f}, what the extras move by)" if delta else " (same price)"))
    return out


def _print_totals(inv: dict) -> None:
    print(f"   base {money(inv.get('baseCost'))} | promos -{money(inv.get('promotionsTotal'))} | extras {money(inv.get('partyExtrasCost'))}"
          f" | travel {money(inv.get('travelFee'))} | TOTAL {money(inv.get('finalTotal'))} | deposit {money(inv.get('deposit'))} | BALANCE {money(inv.get('balanceDue'))}")
    # v2 "by method" (orders from 2026-10-06, D-1006-05/06): one listed price, two
    # bills. TOTAL / BALANCE above follow the invoice's payment method; the engine
    # gives both plus the party's own sales-tax rate (gratuity untaxed).
    if inv.get("pricingTerms") == "v2_by_method":
        rate = inv.get("salesTaxRate")
        rate_s = f"{float(rate) * 100:g}%" if isinstance(rate, (int, float)) else "?"
        est = "（估，发票里按地址 Re-rate）" if inv.get("salesTaxRateSource") != "address" else ""
        cash_due = float(inv.get("cashBalanceDue") or 0)
        print(f"   v2 · 现金 BALANCE {money(inv.get('cashBalanceDue'))}"
              f" · Zelle/Venmo 给师傅 {money(round(cash_due * 1.04, 2))}"
              f" · 刷卡 {money(inv.get('cardBalanceDue'))} = 现金 + 消费税 {rate_s}{est} {money(inv.get('salesTax'))}"
              f" + 手续费 3% {money(inv.get('cardProcessingFee'))}")
    else:
        print("   v1 含税价 · 刷卡 +4%")


def _print_plan(row: dict, staffing: dict | None) -> None:
    """One line: chefs / grills / source, the stations note, the promise, who is assigned."""
    plan = row.get("dispatch_plan") if isinstance(row.get("dispatch_plan"), dict) else None
    if not plan:
        print(f"   派工: 按人头规则（required_staff_count={row.get('required_staff_count')}）- 没有单独的计划")
        return
    src = {"rule": "按人头规则", "owner": "老板定的", "promise": "答应过客人"}.get(str(plan.get("source")), str(plan.get("source")))
    print(f"   派工: {plan.get('chefs')} 位师傅 / {plan.get('grills')} 台灶 ({src})"
          + (f"  站位: {plan['stations_note']}" if plan.get("stations_note") else ""))
    pr = plan.get("promise") if isinstance(plan.get("promise"), dict) else None
    if pr:
        print(f"         答应过: {pr.get('chefs')} 厨 / {pr.get('grills')} 灶 {str(pr.get('at') or '')[:10]} \"{str(pr.get('text') or '')[:120]}\"")
    if isinstance(staffing, dict):
        cooks = [c.get("name") for c in (staffing.get("cooks") or [])]
        helpers = [c.get("name") for c in (staffing.get("helpers") or [])]
        print(f"         已派: {', '.join(cooks) or '-'}" + (f"  帮手: {', '.join(helpers)}" if helpers else ""))
        if len(cooks) < int(plan.get("chefs") or 1):
            print(f"         ! 计划 {plan.get('chefs')} 位师傅，只派了 {len(cooks)} 位")


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
    if a.op == "hold":
        # 日期待定 (owner 2026-10-04): the party is still on, the date is not -
        # e.g. Yvette 10-21, the birthday boy left town. The order keeps its
        # card and price; the date comes off the order and the invoice (the
        # calendar lists it under 日期待定) until `order redate`.
        res = site_post("/api/admin/orders/date-hold", {"orderId": order["id"], "action": "hold", "note": a.why or ""})
        was = (order.get("event_start") or "")[:16].replace("T", " ")
        print(f"OK    {order_no} date on hold{' (already)' if res.get('already') else ''} - was {was or '-'}")
        return
    if a.op == "redate":
        if not a.date:
            raise SystemExit("order redate needs --date YYYY-MM-DD [--time HH:MM]")
        payload = {"orderId": order["id"], "action": "set_date", "date": a.date}
        if a.time:
            payload["time"] = a.time
        site_post("/api/admin/orders/date-hold", payload)
        print(f"OK    {order_no} date set {a.date} {a.time or '(time to be confirmed)'}")
        return
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
        _print_plan(row, detail.get("staffing"))
        _print_lint(_order_lint(order))
        if row.get("internal_notes"):
            print(f"   内部备注(客户看不到): {str(row['internal_notes'])[:300]}")
        try:
            _print_totals(_totals(data))
        except ApiError as e:
            print(f"   totals: 引擎拒绝 {e.payload}")
        if a.json:
            print(dump(detail))
        return
    if a.op == "set" and (a.chefs is not None or a.grills is not None or a.stations is not None or a.plan_rule):
        # The dispatch plan (2026-10-18): how many chefs and grills this party
        # gets and where they stand. Lives on the order (orders.dispatch_plan,
        # lib/dispatch-plan.ts), read by the prep sheet and the day map; set by
        # the owner here or in the order dialog, else by the headcount rule
        # (28 paid heads a chef), else by what the desk promised the customer
        # in a text (promise capture). Eileen 10-17: "two stations" promised
        # by text, one grill on the day - the promise had nowhere to land.
        payload = {"action": "set_dispatch_plan", "order_id": order["id"]}
        if a.plan_rule:
            payload["clear"] = True
        else:
            if a.chefs is not None:
                payload["chefs"] = int(a.chefs)
            if a.grills is not None:
                payload["grills"] = int(a.grills)
        if a.stations is not None:
            payload["stations_note"] = a.stations
        res = site_post("/api/admin/chefs", payload)
        plan = res.get("plan") or {}
        print(f"OK    {order_no} dispatch plan: {plan.get('chefs')} chef(s) / {plan.get('grills')} grill(s) ({plan.get('source')})"
              + (f"  stations: {plan['stations_note']}" if plan.get("stations_note") else ""))
        for w in res.get("lint") or []:
            print(f"   {'!!' if w.get('severity') == 'blocking' else '! '} {w.get('message')}")
        invoice_flags = (a.date, a.time, a.address, a.name, a.email, a.phone, a.notes_file, a.travel_miles, a.travel_fee, a.proteins,
                         a.headcount, a.retier, a.guests_file, a.deal_free, a.deal_rate, a.drop_deal or None, a.free_item, a.add_extra, a.add_promo, a.remove_promo,
                         a.free_appetizer, a.free_appetizer_trays, a.add_adult, a.add_child, a.remove_guest, a.promo, a.reconcile or None)
        if all(v in (None, False, []) for v in invoice_flags):
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
        if a.free_appetizer:
            # The customer's pick, texted after the deposit page wrote gyoza
            # (10-24 RH-20261024-2894 went to spring rolls by a one-off
            # script). Free is free whichever tray it is, so the engine prices
            # the party before and after the swap and a total that moved is
            # refused: desk's tray prices are a copy of the engine's.
            before = copy.deepcopy(data)
            changes += _swap_free_appetizer(data, a.free_appetizer)
            try:
                was, now = _totals(before).get("finalTotal"), _totals(data).get("finalTotal")
            except ApiError:
                was = now = None  # the engine cannot price this party yet; the lines moved by what the trays did
            if was is not None and now is not None:
                if abs(float(now) - float(was)) > 0.005:
                    raise SystemExit(f"--free-appetizer would move the total {money(was)} -> {money(now)} - nothing saved; "
                                     f"desk's APPETIZER_PRICES {APPETIZER_PRICES} no longer match the invoice engine's")
                changes.append(f"free appetizer: TOTAL {money(was)} before and after (invoice engine)")
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
        if a.travel_fee is not None:
            # A fixed customer travel fee - "keep it at the $43 you quoted"
            # (2026-10-15 Jenna: quoted Palm Springs, booked an Indio address).
            # The invoice charges manualOverride ahead of the miles, and it sits
            # outside the $599 minimum, so a promo line cannot do this: on an
            # order at the minimum the minimum swallows it. Miles stay true for
            # the chef's drive pay. "none" goes back to pricing by miles.
            tf = data.setdefault("travelFee", {})
            raw = str(a.travel_fee).strip().lower()
            new = None if raw == "none" else round(float(raw), 2)
            changes.append(f"travelFee.manualOverride: {tf.get('manualOverride')!r} -> {new!r}")
            tf["manualOverride"] = new
            tf.setdefault("ratePerMile", 1)
            tf.setdefault("freeRadiusMiles", 50)
            tf.setdefault("distanceMiles", None)
            tf.setdefault("homeZipcode", tf.get("homeZipcode") or "")
        if a.headcount:
            # An order without guest rows (quick mode, or a fresh order before
            # the menu) carries the party as two counts, and they had no flag:
            # --proteins moves only the servings and --add-adult wants rows, so
            # RH-20261022-0063 (8+2 -> 11+1, quick mode) had to be rewritten as
            # 12 guest rows (owner 2026-10-24). Kids are 5-12, as desk price
            # takes them. A third number is the free 3-4 year olds and sets the
            # "Little kids ×N" line, so it is never typed through the shell;
            # without it they stay as that line says.
            m = re.fullmatch(r"(\d+)/(\d+)(?:/(\d+))?", a.headcount.strip())
            if not m or int(m.group(1)) + int(m.group(2)) < 1:
                raise SystemExit("--headcount ADULTS/KIDS[/LITTLE], e.g. 11/1, or 11/1/2 with two free 3-4 year olds (kids are 5-12)")
            if data.get("mode") == "detailed" and data.get("guests"):
                raise SystemExit(f"this order has {len(data['guests'])} guest rows, and the rows are its headcount - "
                                 "--add-adult / --add-child / --remove-guest, or --guests-file")
            if a.guests_file or a.add_adult or a.add_child or a.remove_guest:
                raise SystemExit("--headcount is for an order without guest rows - not together with --guests-file / --add-adult / --add-child / --remove-guest")
            adults, kids = int(m.group(1)), int(m.group(2))
            little = _little_kids(data) if m.group(3) is None else int(m.group(3))
            changes.append(f"adultCount/childCount: {data.get('adultCount')}/{data.get('childCount')} -> {adults}/{kids + little}"
                           + (f" ({kids} kid{'' if kids == 1 else 's'} 5-12 + {little} free 3-4" + ("" if m.group(3) else " on the Little kids line") + ")"
                              if little else ""))
            data["adultCount"], data["childCount"] = adults, kids + little
            if m.group(3) is not None:
                _set_little_line(data, little, changes, f"--headcount: {little} free 3-4 year old(s)" if little else "--headcount: no 3-4 year olds")
            # The menu and the per-guest setup are counted separately and stay
            # as they are unless this command sets them too.
            prot = [q for q in (data.get("quickCountItems") or []) if q.get("category") == "protein"]
            served = (sum(int(q.get("qty") or 0) for q in prot), sum(int(q.get("childQty") or 0) for q in prot))
            if prot and not a.proteins and served != (2 * adults, 2 * kids):
                menu = " ".join(f"{q.get('itemId')}={q.get('qty')}" + (f"/{q['childQty']}" if q.get("childQty") else "") for q in prot)
                print(f"   ⚠ the menu is still {menu} ({served[0]} adult + {served[1]} kid servings); two each for {_party_s(adults, kids)} "
                      f"is {2 * adults} + {2 * kids} - pass --proteins with the new counts")
            for x in SETUP_PRICES:
                qty = next((int(e.get("qty") or 0) for e in (data.get("partyExtras") or []) if e.get("id") == x), 0)
                if qty and qty != adults + kids + little and not any(e.split("=")[0] == x for e in (a.add_extra or [])):
                    print(f"   ⚠ {x} is still billed for {qty} guests, the party is now {adults + kids + little} - "
                          f"--add-extra {x}={adults + kids + little} if they all get it")
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
        if a.guests_file:
            # The whole list texted (or photographed) by the customer: one row
            # per guest with their own picks. Until 10-09 only the planner could
            # enter that; Shaunae sent 17 names with filet / lobster / scallop
            # picks as a photo of her notes. Upgrades and third proteins are
            # just protein ids here - the engine bills them (premium fee each,
            # +$10 per protein past two), so nothing is priced by hand.
            rows = json.loads(pathlib.Path(a.guests_file).read_bytes().decode("utf-8"))
            if not isinstance(rows, list) or not rows:
                raise SystemExit("--guests-file: a JSON list of {name, child?, little?, proteins: [ids], tables?, utensils?, noodles?, allergy?, note?}")
            had = [g for g in (data.get("guests") or []) if g.get("proteins")]
            if had and not a.replace_guests:
                raise SystemExit(f"this order already has {len(had)} guest rows with picks - pass --replace-guests to overwrite them")
            stamp = int(time.time())
            new_rows = []
            for i, r in enumerate(rows):
                prots = [str(x).strip() for x in (r.get("proteins") or [])]
                bad = [x for x in prots if x not in PROTEIN_IDS]
                if bad:
                    raise SystemExit(f"guest {i + 1} {r.get('name')!r}: unknown protein {bad} - ids are {sorted(PROTEIN_IDS)}")
                # A free 3-4 year old gets no proteins of their own (leads
                # skill), so their row may list none; everyone else picks two.
                if len(prots) < 2 and not r.get("little"):
                    raise SystemExit(f"guest {i + 1} {r.get('name')!r}: needs at least 2 proteins (a free 3-4 year old: \"little\": true)")
                row = {
                    "id": f"g{i + 1}_{stamp}",
                    "name": str(r.get("name") or f"Guest {i + 1}").strip(),
                    "isChild": bool(r.get("child") or r.get("little")),  # a 3-4 year old is a child row, refunded by the Little kids line
                    "proteins": prots,
                    "noodles": bool(r.get("noodles")),
                    "tablesChairs": bool(r.get("tables")),
                    "utensils": bool(r.get("utensils")),
                    "foodAllergy": str(r.get("allergy") or ""),
                    "note": str(r.get("note") or ""),
                }
                if r.get("little"):
                    row["isLittle"] = True
                new_rows.append(row)
            adults = sum(1 for g in new_rows if not g["isChild"])
            kids = len(new_rows) - adults
            little = sum(1 for g in new_rows if g.get("isLittle"))
            changes.append(f"guests: {len(data.get('guests') or [])} rows -> {len(new_rows)} ({adults} adults + {kids} kids"
                           + (f", {little} of them 3-4" if little else "") + ")")
            changes.append(f"adultCount/childCount: {data.get('adultCount')}/{data.get('childCount')} -> {adults}/{kids}")
            data["guests"] = new_rows
            data["adultCount"], data["childCount"] = adults, kids
            # The list is the whole party, so its little: true rows are all the
            # free 3-4 year olds there are: the line says as many, or goes.
            _set_little_line(data, little, changes, f"{little} little: true row(s) in the list" if little else
                             "the list has no little: true row - a 3-4 year old who is coming needs one")
            if data.get("mode") != "detailed":
                changes.append(f"mode: {data.get('mode')!r} -> 'detailed'")
                data["mode"] = "detailed"
                data["quickCountItems"] = [q for q in (data.get("quickCountItems") or []) if q.get("category") != "protein"]
            # Before the rows, tables / utensils ride as one party-wide line;
            # the rows carry them per guest, and the engine bills both. Stacy
            # 10-13: tables_chairs=27 stayed next to 29 rows with tables - $270
            # billed twice.
            setup_lines = [e for e in (data.get("partyExtras") or []) if e.get("id") in SETUP_PRICES]
            if setup_lines:
                data["partyExtras"] = [e for e in (data.get("partyExtras") or []) if e.get("id") not in SETUP_PRICES]
                changes.append("partyExtras: dropped " + ", ".join(f"{e.get('id')}={e.get('qty')}" for e in setup_lines)
                               + " (the rows carry tables/utensils now)")
        if a.remove_promo or a.add_promo:
            # A published offer that replaces another (teacher appreciation $50
            # in place of the party-size discount - they do not stack, skill 5):
            # drop one stored line, add one with a label the customer reads.
            promos = data.setdefault("promotions", [])
            for pid in (a.remove_promo or []):
                hit = next((x for x in promos if x.get("id") == pid), None)
                if hit is None:
                    raise SystemExit(f"--remove-promo {pid}: no such line ({[x.get('id') for x in promos]})")
                promos.remove(hit)
                changes.append(f"promo removed: {pid} {hit.get('label')} {money(hit.get('amount'))}")
            if a.add_promo:
                m = re.fullmatch(r"([A-Za-z0-9_]+)=(\d+(?:\.\d{1,2})?)", a.add_promo)
                if not m or not a.promo_label:
                    raise SystemExit("--add-promo ID=AMOUNT needs --promo-label \"what the customer sees\"")
                if any(x.get("id") == m.group(1) for x in promos):
                    raise SystemExit(f"--add-promo {m.group(1)}: that line already exists - use --promo to change its amount")
                promos.append({"id": m.group(1), "label": a.promo_label[:80], "amount": float(m.group(2))})
                changes.append(f"promo added: {m.group(1)} '{a.promo_label[:80]}' {money(float(m.group(2)))}")
        if a.free_item:
            # Appetizer trays promised free (20+ guests, the full setup, a
            # concession): the trays go into partyExtras and a fixed "FREE:"
            # line refunds exactly those trays (skill 10, 2026-09-28) - not a
            # freeExtraIds rule, which would refund every tray of that kind the
            # customer adds in the planner and double up with the auto promos.
            stamp = int(time.time())
            extras = data.setdefault("partyExtras", [])
            promos = data.setdefault("promotions", [])
            for pair in a.free_item:
                m = re.fullmatch(r"([a-z_]+)=(\d+)", pair)
                if not m or m.group(1) not in APPETIZER_PRICES:
                    raise SystemExit(f"--free-item {pair!r}: use id=N with id in {sorted(APPETIZER_PRICES)}")
                app_id, n = m.group(1), int(m.group(2))
                row = next((e for e in extras if e.get("id") == app_id), None)
                if row:
                    row["qty"] = int(row.get("qty") or 0) + n
                else:
                    extras.append({"id": app_id, "qty": n})
                label = APPETIZER_LABELS[app_id]
                amount = round(APPETIZER_PRICES[app_id] * n, 2)
                promos.append({"id": f"{app_id}_{stamp}", "label": f"FREE: {label} x{n}", "amount": amount})
                changes.append(f"free item: {app_id} +{n} in partyExtras, promo 'FREE: {label} x{n}' {money(amount)}")
        if a.add_extra:
            # Trays the customer buys (Heather 10-09: gyoza for 11 on a Sunday - no
            # free-appetizer promo applies). partyExtras at menu price, no promo line;
            # the engine bills them. Setup items (utensils=18) ride the same
            # party-wide line until guest rows carry the flags, and N is the guest
            # count, not a tray count (Yasmin 10-16: website lock with only the
            # tables line, her black-and-gold plates had nowhere to go).
            extras = data.setdefault("partyExtras", [])
            has_rows = data.get("mode") == "detailed" and bool(data.get("guests"))
            for pair in a.add_extra:
                m = re.fullmatch(r"([a-z_]+)=(\d+)", pair)
                if not m or m.group(1) not in {**APPETIZER_PRICES, **SETUP_PRICES, **PROTEIN_SIDE_PRICES}:
                    raise SystemExit(f"--add-extra {pair!r}: use id=N with id in {sorted({**APPETIZER_PRICES, **SETUP_PRICES, **PROTEIN_SIDE_PRICES})}")
                app_id, n = m.group(1), int(m.group(2))
                row = next((e for e in extras if e.get("id") == app_id), None)
                if app_id in SETUP_PRICES:
                    if has_rows:
                        raise SystemExit(f"--add-extra {pair!r}: this order has guest rows - put {app_id} on the rows (--guests-file)")
                    was = int(row.get("qty") or 0) if row else 0
                    if row:
                        row["qty"] = n
                    else:
                        extras.append({"id": app_id, "qty": n})
                    changes.append(f"setup: {app_id} {was} -> {n} guest(s) at {money(SETUP_PRICES[app_id])} each")
                    continue
                if row:
                    row["qty"] = int(row.get("qty") or 0) + n
                else:
                    extras.append({"id": app_id, "qty": n})
                unit = "serving(s)" if app_id in PROTEIN_SIDE_PRICES else "tray(s)"
                changes.append(f"paid extra: {app_id} +{n} {unit} at {money({**APPETIZER_PRICES, **PROTEIN_SIDE_PRICES}[app_id])} each")
        if a.drop_deal:
            # Take a signed deal back off an order: the customDeal rule and the
            # deal_* lines it wrote. Taegan 10-09: the 10-02 flatOff $90 was the
            # stand-in party-size discount from before the tiers reached 31+, and
            # the deposit order also got the official $120 line - $210 off.
            gone = [x for x in (data.get("promotions") or []) if str(x.get("id", "")).startswith("deal_")]
            if not gone and not data.get("customDeal"):
                raise SystemExit("--drop-deal: this order has no deal to drop")
            for x in gone:
                changes.append(f"promo {x.get('id')} removed: {x.get('label')} {money(x.get('amount'))}")
            data["promotions"] = [x for x in (data.get("promotions") or []) if not str(x.get("id", "")).startswith("deal_")]
            changes.append(f"customDeal: {data.get('customDeal')} -> None")
            data["customDeal"] = None
        if a.deal_free or a.deal_rate:
            # A setup item promised free (tables for locking the date, skill 8)
            # or at a set price (Saturday's half-price tables, D-1017-01) is
            # billed as usual and taken back off on its own line, so the loading
            # list still carries the tables. Saved invoices do not re-derive
            # deal lines (self-service-invoice.ts leaves stored promotions
            # alone), so desk writes them (_deal_lines, below - after any rows
            # this command changes). An item is free or at a rate, never both
            # (it would come off twice): the newer one wins.
            deal = dict(data.get("customDeal") or {})
            new_free = [x.strip() for x in (a.deal_free or "").split(",") if x.strip()]
            new_rates = _parse_rates(a.deal_rate, "--deal-rate")
            both = sorted(set(new_free) & set(new_rates))
            if both:
                raise SystemExit(f"--deal-free and --deal-rate both name {both} - pick one")
            ids = sorted({x for x in (deal.get("freeExtraIds") or []) if x not in new_rates} | set(new_free))
            rates = {x: float(r) for x, r in (deal.get("extraRates") or {}).items() if x not in new_free}
            rates.update(new_rates)
            unknown = [x for x in ids + sorted(rates) if x not in SETUP_PRICES]
            if unknown:
                raise SystemExit(f"--deal-free / --deal-rate: only {sorted(SETUP_PRICES)} are priced here, not {unknown}")
            deal.pop("freeExtraIds", None)
            deal.pop("extraRates", None)
            if ids:
                deal["freeExtraIds"] = ids
            if rates:
                deal["extraRates"] = {x: rates[x] for x in sorted(rates)}
            if a.deal_note:
                deal["note"] = a.deal_note[:80]
            changes.append(f"customDeal: {data.get('customDeal')} -> {deal}")
            data["customDeal"] = deal
            for x in new_free + sorted(new_rates):
                if _setup_units(data, x) == 0:
                    print(f"   ⚠ the order bills no {x} yet - nothing to take off; set it on the rows first"
                          f" (before there are rows: --add-extra {x}=<guests> in the same command)")
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
                raise SystemExit("this order carries party-wide counts, not guest rows - change the headcount with --headcount ADULTS/KIDS")
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
        # "Randy can't make it" the night before (Eileen 10-16, 32 named rows):
        # one row off by name, every other row keeps its id and picks so the
        # planner reconciles without touching anyone else. The name must match
        # exactly one row.
        for who in (a.remove_guest or []):
            guests = data.get("guests") or []
            if data.get("mode") == "quick" or not guests:
                raise SystemExit("this order carries party-wide counts, not guest rows - change the headcount with --headcount ADULTS/KIDS")
            hits = [g for g in guests if str(g.get("name") or "").strip().lower() == who.strip().lower()]
            if len(hits) != 1:
                raise SystemExit(f"--remove-guest {who!r}: {len(hits)} rows have that name - rows are: "
                                 + ", ".join(str(g.get("name")) for g in guests))
            gone = hits[0]
            data["guests"] = [g for g in guests if g is not gone]
            key = "childCount" if gone.get("isChild") else "adultCount"
            before = int(data.get(key) or 0)
            data[key] = max(0, before - 1)
            changes.append(f"guest removed: {gone.get('name')} ({', '.join(gone.get('proteins') or ['no proteins'])}); {key}: {before} -> {data[key]}")
            if gone.get("isChild") and gone.get("isLittle"):
                # One free 3-4 year old fewer: the line counts the larger of the
                # flagged rows and its own ×N (planner rows before 09-28 carry no
                # flag), so it drops by one from that, never under the rows left.
                flagged = sum(1 for g in data["guests"] if g.get("isChild") and g.get("isLittle"))
                _set_little_line(data, max(flagged, _little_kids(data) - 1), changes, f"{gone.get('name')} was a free 3-4 year old")
        if a.remove_guest:
            # Same frozen-amount trap as --add-adult, the other way round (the
            # deal lines are re-priced below, the Weekday Special and the
            # party size next).
            for x in (data.get("promotions") or []):
                pid = str(x.get("id", ""))
                if not pid.startswith("deal_") and re.search(r"tables|free", pid, re.I):
                    print(f"   ⚠ promo {x.get('id')} {x.get('label')!r} is still {money(x.get('amount'))} - check it still fits the new headcount")
        moved = bool(a.headcount or a.guests_file or a.add_adult or a.add_child or a.remove_guest)
        if moved:
            _warn_frozen_weekday(data)
        if moved or a.retier:
            _retier_party_size(data, changes, any(str(x).startswith("official_party") for x in (a.remove_promo or [])), asked=a.retier)
        # The deal lines are stored amounts as well, but the order keeps the deal
        # itself as rules (customDeal), so they follow whatever moved what they
        # count: the guest rows, the switch between rows and counts, or the
        # party-wide setup line a fresh order bills its tables from. The planner
        # and the staff tool re-price them the same way. --deal-free /
        # --deal-rate land here too, after any rows the command changed.
        recount = bool(a.headcount or a.guests_file or a.add_adult or a.add_child or a.remove_guest or data.get("mode") != prefill.get("mode")
                       or any(x.split("=")[0] in SETUP_PRICES for x in (a.add_extra or [])))
        if a.deal_free or a.deal_rate or (recount and data.get("customDeal")):
            promos = data.get("promotions") or []
            new = _deal_lines(data)
            for pid in DEAL_PROMO_IDS:
                was = next((x for x in promos if x.get("id") == pid), None)
                now = next((x for x in new if x["id"] == pid), None)
                if was or now:
                    changes.append(f"promo {pid}: {money(was.get('amount')) if was else 'none'} -> {money(now['amount']) if now else 'none'}"
                                   f"  {(now or was).get('label')}")
            data["promotions"] = [x for x in promos if x.get("id") not in DEAL_PROMO_IDS] + new
        elif recount:
            for x in (data.get("promotions") or []):
                if str(x.get("id", "")).startswith("deal_"):
                    print(f"   ⚠ promo {x.get('id')} is still {money(x.get('amount'))}, computed for the OLD headcount, and the order has no "
                          f"customDeal to re-price it from - re-state it with --promo {x.get('id')}=<amount>")
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
        if not changes and a.reconcile:
            # Save the order as it stands: the invoice engine puts on what the
            # rules owe the party (D-1017-02) and the answer lists it.
            changes.append("reconcile: saved as it is, for the invoice engine to put on what the rules owe")
        if not changes:
            raise SystemExit("nothing to change - pass --date/--time/--address/--name/--email/--phone/--notes-file/--travel-miles/--travel-fee/--headcount/--retier/--proteins/--guests-file/--deal-free/--deal-rate/--drop-deal/--free-item/--add-extra/--add-promo/--remove-promo/--free-appetizer/--free-appetizer-trays/--add-adult/--add-child/--remove-guest/--promo/--reconcile")
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
                print(f"   · {a.date} qualifies for the Weekday Special: the save adds it with its free appetizer (the invoice engine)")
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
        # Then hold the TOTAL against desk price, so a wrong stored discount
        # shows on the dry run.
        try:
            inv = _totals(data)
        except ApiError as e:
            inv = None
            print(f"   totals: 引擎暂时算不了（{(e.payload.get('errors') if isinstance(e.payload, dict) else e.payload)}）- 菜单录进来后再看")
        if inv:
            _print_totals(inv)
            _price_check(data, inv)
        # --dry used to be ignored here: `order set ... --dry` saved for real
        # (Stacy's notes, 2026-10-09). It is a preview now, like `remind --dry`.
        if a.dry:
            print("DRY   not saved (--dry)")
            return
        # save-invoice writes this whole copy onto the order, and the lookup it
        # was built from is a few seconds old by now: a customer submitting from
        # their planner in that gap was overwritten by it. So the save says
        # where the order stood when it was read (the lookup's updatedAt and
        # version); if the order changed since, the invoice app answers 409,
        # saves nothing and sends the order back as it stands (2026-10-11).
        base = {k: v for k, v in (("baseUpdatedAt", inv_order.get("updatedAt")), ("baseVersion", inv_order.get("version"))) if v}
        try:
            res = invoice_post("/api/self-service/orders/save-invoice", {"orderId": order["id"], "invoiceData": data, **base})
        except ApiError as e:
            if e.status != 409 or not (isinstance(e.payload, dict) and e.payload.get("conflict")):
                raise
            print(f"STALE not saved - {order_no} changed between the lookup and this save (the customer's planner, the invoice tool, another desk):")
            for line in _invoice_drift(prefill, e.payload.get("prefill") or {}) or ["(none of the fields compared here - see order show)"]:
                print("   " + line)
            # Not retried here: after the customer's own change a relative flag
            # (--add-adult, --free-item, --add-extra) may already be on the order.
            raise SystemExit(f"nothing was saved. Read it again (order show {order_no}), then re-run this command if it still applies.")
        print(f"OK    saved {res.get('orderNo')}  planner_synced={res.get('plannerSynced')}")
        # A save lines the host's planner up with this invoice's counts, and
        # until 2026-10-24 it deleted whoever was over them: RH-20261015-3202's
        # under-5 Shiloh, named with two picks, would have gone with a save
        # whose invoice had no little-kids line. The invoice app now removes
        # blank guests only and names the ones it kept, one line a kind.
        for line in res.get("plannerWarnings") or []:
            print(f"WARN  {line}")
        # What the invoice engine put on, took off or re-priced on top of this
        # copy (the rules, D-1017-02), then what the order still lacks.
        applied = res.get("entitlementsApplied") or []
        for c in applied:
            print(f"   + 引擎按规则：{c.get('text') or c}")
        if applied:
            # The totals and the check above were this copy's; the order now
            # holds the engine's, so both again on what was saved.
            try:
                saved = _lookup(order)[1]
                after = _totals(saved)
                _print_totals(after)
                _price_check(saved, after)
            except (ApiError, SystemExit) as e:
                print(f"   (保存后的总价没取到：{e})")
        _print_lint(res.get("lint") if isinstance(res.get("lint"), dict) else None)
        return
    if a.op == "remind":
        # Owner 2026-10-05: the text before the party says what is left to pay.
        # v2 orders (from 10-06, D-1006-05/06): the two bills itemised - cash to
        # the chef, card with the party's sales tax and card processing - plus
        # the one gratuity question. v1 orders: the old line.
        # Every number comes from the invoice engine, the same ones the chef's
        # sheet and /pay use; nothing is recomputed here.
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
        if inv.get("pricingTerms") == "v2_by_method":
            # Never "no tax" / "tax-free".
            if inv.get("salesTaxRateSource") != "address":
                raise SystemExit("the invoice's sales-tax rate is still the default (estimated) - Re-rate it by the party address in the invoice tool before quoting the card bill")
            cash = float(inv.get("cashBalanceDue") or 0)
            card = float(inv.get("cardBalanceDue") or 0)
            tax = float(inv.get("salesTax") or 0)
            fee = float(inv.get("cardProcessingFee") or 0)
            # Wording per leads voice.md (owner 2026-10-29): no parenthesis, no "charged by Stripe".
            body = (f"See you {when} at {at}. Your balance is {money(cash)} cash to your chef, "
                    f"or {money(card)} by card, since {money(tax)} sales tax and a {money(fee)} card fee get added. "
                    f"Want the 20% gratuity for your chef on the card too, or will you tip in person?")
        else:
            body = f"See you {when} at {at}. Your balance is {money(balance)}, and cash to your chef at the end is easiest, no fees."
        # The day-before text goes out only on an order that carries what the
        # customer is owed (D-1017-02) - the same check that holds the prep sheet.
        lint = _order_lint(order)
        blocked = _print_lint(lint)
        if (blocked or lint is None) and not a.force:
            why = "订单检查没连上发票系统，确认不了有没有缺项" if lint is None else f"订单还有 {blocked} 项缺项"
            if a.dry:
                print(f"DRY   {body}")
                print(f"HOLD  {why}——正式发会被拦。改好（order set …）再发，或核过后加 --force")
                return
            raise SystemExit(f"not sent: {why}. 改好（order set …）再发，或核过后加 --force")
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
        # --dry used to be ignored here: on 2026-10-10 "order send --dry" emailed and texted two
        # customers for real (the owner had said send, so no harm - but a preview must never send).
        if a.dry:
            print(f"DRY   would email the invoice PDF to {prefill.get('contactInfo', {}).get('email') or '?'}"
                  + (" and text the invoice link + 'reply confirm'" if a.op == "send" else "") + " - nothing sent")
            return
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
            body = (f"Here's your invoice{' for ' + day if day else ''}: {short} Please look it over and reply "
                    f"\"confirm\" here if it's all right. A PDF copy is in your email too.")
            # The session id lets the just_answered brake tell this desk from
            # another one. Without it Tonia 10-13 got the invoice email but not
            # the text: our own "updated invoice coming" two minutes earlier
            # counted as someone else's answer.
            payload = {"phone": phone, "body": body, "session": desk_session()}
            if lead_id:
                payload["leadId"] = lead_id
            try:
                sent = site_post("/api/admin/sms-thread", payload)
            except ApiError as e:
                print(f"FAIL  emailed, but the text did not go: {e.status} {e.payload}")
                print(f"      send it by hand: desk send {phone} --lead {lead_id} --body \"{body}\"")
                sys.exit(2)
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
    p.add_argument("--date"); p.add_argument("--alt-date"); p.add_argument("--zip"); p.add_argument("--json", action="store_true")
    p.add_argument("--tables", type=int, help="guests getting tables & chairs ($10 each) - priced inside the $599 minimum, as the invoice does")
    p.add_argument("--utensils", type=int, help="guests getting plates & cutlery ($5 each)")
    p.set_defaults(fn=cmd_price)
    p = sp.add_parser("travel"); p.add_argument("destination"); p.set_defaults(fn=cmd_travel)
    p = sp.add_parser("send"); p.add_argument("phone"); p.add_argument("body", nargs="?"); p.add_argument("--lead")
    p.add_argument("--body", dest="body_opt"); p.add_argument("--body-file"); p.add_argument("--force", action="store_true")
    p.add_argument("--seen", metavar="WHEN", help="the customer's last text you read: the value desk thread / card print under the "
                   "conversation (2026-10-24T18:54:18-07:00), or HH:MM / MM-DD HH:MM Pacific. A text of theirs after it - with no "
                   "--seen, one from the last 90 s - stops the send, printed, exit 2. --force does not skip this")
    p.add_argument("--media", help="a local jpg/png to attach (MMS; same route and brakes as a text)")
    p.add_argument("--voice-ok", action="store_true", help="send even though the text trips the voice check (leads voice.md §2): "
                   "for the sentence that is right as written")
    p.set_defaults(fn=cmd_send)
    p = sp.add_parser("voice-log"); p.add_argument("--date", help="YYYY-MM-DD (Pacific), default today"); p.set_defaults(fn=cmd_voice_log)
    p = sp.add_parser("note"); p.add_argument("lead"); p.add_argument("note", nargs="?"); p.add_argument("--body-file"); p.set_defaults(fn=cmd_note)
    p = sp.add_parser("hold"); p.add_argument("lead"); p.add_argument("days", type=int); p.set_defaults(fn=cmd_hold)
    p = sp.add_parser("chef-rule", help="chef pay counts invoice adults as kids (half heads) for this lead's party")
    p.add_argument("lead"); p.add_argument("--kids", help="all, or how many of the invoice adults count as kids")
    p.add_argument("--note"); p.add_argument("--clear", action="store_true")
    p.set_defaults(fn=cmd_chef_rule)
    p = sp.add_parser("heard", help="record how an unattributed customer says they found us (D-1010)")
    p.add_argument("lead"); p.add_argument("words", help="their own words")
    p.add_argument("--as", dest="as_channel", choices=["google", "google_maps", "yelp", "instagram", "facebook", "tiktok", "nextdoor", "ai_assistant",
                                                     "platform", "party_guest", "returning", "friend", "other"],
                   help="override the automatic bucket")
    p.set_defaults(fn=cmd_heard)
    p = sp.add_parser("status"); p.add_argument("lead"); p.add_argument("status", choices=["new", "qualified", "won", "lost", "disqualified"]); p.set_defaults(fn=cmd_status)
    p = sp.add_parser("contacted"); p.add_argument("lead"); p.set_defaults(fn=cmd_contacted)
    p = sp.add_parser("block", help="a sales pitch: its calls to 213 are rejected before they ring")
    p.add_argument("lead"); p.add_argument("--why"); p.add_argument("--clear", action="store_true"); p.set_defaults(fn=cmd_block)
    p = sp.add_parser("newlead", help="a lead for a Yelp / Facebook / Instagram / phone conversation")
    p.add_argument("name"); p.add_argument("--via", required=True, choices=["yelp", "facebook", "instagram", "phone", "sms", "wechat", "walk_in", "referral", "other"])
    p.add_argument("--phone"); p.add_argument("--email"); p.add_argument("--message"); p.add_argument("--body-file")
    p.set_defaults(fn=cmd_newlead)
    p = sp.add_parser("channel", help="copy a Yelp / Facebook / Instagram message into the lead's conversation")
    p.add_argument("lead"); p.add_argument("direction", choices=["in", "out"], help="in = the customer, out = us")
    p.add_argument("text", nargs="?"); p.add_argument("--via", required=True, choices=sorted(CHANNEL_NAMES))
    p.add_argument("--at", help="when the channel shows it, Pacific: 'YYYY-MM-DD HH:MM' or 'MM-DD HH:MM', ':SS' to order same-minute lines (default now)")
    p.add_argument("--author", help="who wrote it, when not the customer or Rowling"); p.add_argument("--body-file")
    p.set_defaults(fn=cmd_channel)
    p = sp.add_parser("ack"); p.add_argument("lead"); p.add_argument("--clear", action="store_true"); p.set_defaults(fn=cmd_ack)
    p = sp.add_parser("callback", help="ring the owner's App: this customer wants a phone call"); p.add_argument("lead"); p.add_argument("--why"); p.set_defaults(fn=cmd_callback)
    p = sp.add_parser("fields"); p.add_argument("lead"); p.add_argument("pairs", nargs="+"); p.set_defaults(fn=cmd_fields)
    p = sp.add_parser("link"); p.add_argument("kind", choices=["deposit", "planner", "short"]); p.add_argument("url", nargs="?")
    p.add_argument("--lead"); p.add_argument("--adults", type=int); p.add_argument("--kids", type=int, default=0); p.add_argument("--city")
    p.add_argument("--date"); p.add_argument("--time"); p.add_argument("--email"); p.add_argument("--name"); p.add_argument("--phone")
    p.add_argument("--zip"); p.add_argument("--est", type=int); p.add_argument("--booked", action="store_true"); p.add_argument("--verbose", action="store_true")
    p.add_argument("--free", help="comma list of extras the deal gives free, e.g. tables_chairs (deposit only)")
    p.add_argument("--rate", nargs="+", action="extend", metavar="ID=PRICE",
                   help="deal: an extra at a set price per guest instead of the catalog's, e.g. tables_chairs=5 - Saturday's half price "
                        "(D-1017-01). Re-priced on the order when the headcount moves; the order puts the item on the party (deposit only)")
    p.add_argument("--flat-off", type=float, help="deal: dollars off the total (deposit only)")
    p.add_argument("--waive-travel", action="store_true",
                   help="deal: travel is on us - the order bills $0 travel and keeps the miles for chef pay (deposit only; "
                        "an order that already exists: order set --travel-fee 0)")
    p.add_argument("--deal-note", help="deal: why, shown on the order")
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
    p.add_argument("--body-file"); p.add_argument("--lead"); p.add_argument("--cc", nargs="*")
    p.add_argument("--attach", nargs="+", action="extend", metavar="FILE", help="pdf/png/jpg files to attach (up to 3, about 3 MB in all)")
    p.add_argument("--any-address", action="store_true", help="send to an address the lead does not have on file (a new one the customer gave)"); p.set_defaults(fn=cmd_email)
    # Sales daily / weekly report, numbers half (docs/销售日志/README.md): read-only.
    def _report(a):
        import datetime as _dt
        import report
        if a.kind == "day":
            print(report.day_report(_dt.date.fromisoformat(a.date) if a.date else _dt.date.today()))
            return
        start = _dt.date.fromisoformat(a.date) if a.date else report.last_full_week(_dt.date.today())
        start -= _dt.timedelta(days=(start.weekday() + 1) % 7)  # any day -> the Sunday that starts its week
        print(report.week_report(start))
    p = sp.add_parser("report"); p.add_argument("kind", choices=["day", "week"])
    p.add_argument("--date", help="YYYY-MM-DD (Pacific). day: default today; week: any day in the week, default the last full Sun-Sat week")
    p.set_defaults(fn=_report)
    p = sp.add_parser("order"); p.add_argument("op", choices=["find", "show", "set", "preview", "email", "send", "remind", "hold", "redate"]); p.add_argument("ident")
    p.add_argument("--why", help="hold: why the date is off, kept on the order (e.g. birthday boy out of town, picking a new date)")
    p.add_argument("--dry", action="store_true", help="remind: print the text, do not send")
    p.add_argument("--force", action="store_true", help="remind: send even though the order lint lists what the order is missing (checked by a person)")
    p.add_argument("--reconcile", action="store_true", help="set: save the order as it stands, so the invoice engine puts on what the rules owe (D-1017-02)")
    p.add_argument("--date"); p.add_argument("--time"); p.add_argument("--address"); p.add_argument("--name"); p.add_argument("--email"); p.add_argument("--phone")
    p.add_argument("--notes-file"); p.add_argument("--notes-reviewed", action="store_true"); p.add_argument("--json", action="store_true")
    p.add_argument("--lead", help="lead id for order send when the order does not carry one")
    p.add_argument("--chefs", type=int, metavar="N", help="dispatch plan: chefs on this party (owner override; the prep sheet and day map read it)")
    p.add_argument("--grills", type=int, metavar="N", help="dispatch plan: grills (defaults to --chefs)")
    p.add_argument("--stations", help="dispatch plan: where the chefs stand, printed on the prep sheet, e.g. \"two U shapes, each chef at an open end, by the pool\"")
    p.add_argument("--plan-rule", action="store_true", help="dispatch plan: back to the headcount rule (28 paid heads a chef and grill)")
    p.add_argument("--travel-miles", type=float, help="driving miles from base (desk travel <address>); the invoice prices travel from this")
    p.add_argument("--travel-fee", help="fixed customer travel fee in dollars (a concession, e.g. the quoted amount); "
                                        "miles stay for the chef's pay; 'none' prices by miles again")
    p.add_argument("--free-appetizer", metavar="ID", help="the customer's pick for the free appetizer: gyoza, edamame or spring_rolls (the deposit "
                   "page writes gyoza). Its trays and its promotion line (Weekday Special / 20+ guests / full setup, and --free-item lines of "
                   "the same tray) switch to it; the line moves by the trays' price difference, so the total stays the same.")
    p.add_argument("--free-appetizer-trays", type=int, metavar="N",
                   help="how many trays the free-appetizer promo brings (owner 2026-10-01: one per 10 guests). "
                        "Moves the promo's discount by the same amount, so the customer is not billed for it.")
    p.add_argument("--proteins", nargs="+", action="extend", metavar="ID=N", help="protein counts when the customer texts totals instead of per-guest picks: "
                   "chicken=10 steak=10 shrimp=10 (N is adult servings; chicken=10/2 adds child servings). Switches the invoice to quick mode. "
                   "The menu only - the headcount is --headcount.")
    p.add_argument("--headcount", metavar="ADULTS/KIDS[/LITTLE]", help="the headcount of an order without guest rows (quick mode, or a fresh "
                   "order before the menu): 11/1 = 11 adults + 1 kid 5-12, as desk price counts them. 11/1/2 adds two free 3-4 year olds and "
                   "sets the order's Little kids (3-4) @ $0 ×N line to them (11/1/0 takes it off); 11/1 leaves that line as it is. "
                   "The party-size line follows, as it does for --guests-file / --add-adult / --add-child / --remove-guest.")
    p.add_argument("--retier", action="store_true", help="put the party-size line (official_party*) right for the headcount the order has "
                   "now. Every headcount change does this by itself; this is for an order that was already wrong (the total check "
                   "names it). Leaves 61+ and an appreciation line standing in for the tier alone.")
    p.add_argument("--add-adult", type=int, metavar="N", help="add N adults to a party whose guests are already picked. The new rows copy "
                   "the last adult's proteins and their tables/utensils flags, so a late 'can I bring one more' keeps billing the same way "
                   "as everyone else. Check the printed rows before sending - proteins are a guess until the guest says otherwise.")
    p.add_argument("--add-child", type=int, metavar="N", help="same as --add-adult for children 5-12.")
    p.add_argument("--remove-guest", nargs="+", action="extend", metavar="NAME", help="take guest rows off by name (exact, one row each): a guest who cancels. Other rows keep their ids and picks.")
    p.add_argument("--guests-file", help="JSON list of guests the customer sent, one per row: "
                   '[{"name": "Mom", "proteins": ["filet_mignon", "steak", "lobster_tail"], "tables": true}, {"name": "Tyson", "child": true, ...}]. '
                   "Upgrades and third proteins are protein ids; the engine bills them. Sets the head counts from the rows. "
                   '{"name": "Mia", "little": true} is a free 3-4 year old (a child row, no proteins needed): the order\'s '
                   "Little kids (3-4) @ $0 ×N line follows the list's little rows, and --remove-guest of one takes it down by one.")
    p.add_argument("--replace-guests", action="store_true", help="allow --guests-file to overwrite rows that already have picks")
    p.add_argument("--deal-free", help="setup items promised free, e.g. tables_chairs: writes customDeal + the matching refund line at the current row count")
    p.add_argument("--deal-rate", nargs="+", action="extend", metavar="ID=PRICE",
                   help="setup item at a set price per guest, e.g. tables_chairs=5 (Saturday's half price, D-1017-01): writes customDeal.extraRates "
                        "+ the matching 'Tables & Chairs at $5/guest' line at the current count")
    p.add_argument("--drop-deal", action="store_true", help="remove the order's custom deal and its deal_* promotion lines")
    p.add_argument("--free-item", nargs="+", action="extend", metavar="ID=N", help="appetizer trays promised free: gyoza=2 adds 2 trays and a fixed 'FREE: Gyoza (10 pcs) x2' line")
    p.add_argument("--add-extra", nargs="+", action="extend", metavar="ID=N", help="appetizer trays the customer buys (billed at menu price): gyoza=1; or a setup item for N guests before the rows exist: utensils=18")
    p.add_argument("--remove-promo", nargs="+", action="extend", metavar="ID", help="drop stored promotion lines by id")
    p.add_argument("--add-promo", metavar="ID=AMOUNT", help="add a promotion line, e.g. appreciation_teacher=50 (with --promo-label)")
    p.add_argument("--promo-label", help="label for --add-promo, as the customer reads it")
    p.add_argument("--deal-note", help="why the deal (80 chars, shown after the label)")
    p.add_argument("--promo", nargs="+", action="extend", metavar="ID=AMOUNT", help="set a stored promotion's dollar amount, e.g. official_weekday=89.80. "
                   "Promotions are frozen numbers on the invoice, not rules, so a per-head one (the Weekday Special) has to be re-stated "
                   "by hand when the headcount moves - see the warning --add-adult prints. The deal_* lines are re-priced from the "
                   "order's customDeal whenever the rows change.")
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
