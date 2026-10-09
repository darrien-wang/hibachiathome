"""desk report day - the numbers half of the sales daily report (docs/销售日志/README.md, 2026-10-09).

Read-only: it selects from Supabase (service key, PostgREST) and prints a markdown block that goes
into section 1 of the day's report, plus the locks, losses and tagged judgments of the day. Nothing
is counted by hand; the judgment sections are still written by the person writing the report.

Definitions (README §4):
- a day is 00:00-24:00 Pacific; a lead is anything not disqualified;
- first response = lead created -> our first outbound text (machine texts count);
- a customer text is one with content: tapbacks and bare courtesy ("ok", "thank you") are left out;
- reply time = a customer text -> our next outbound text on that lead (looked for until noon next day);
- a lock = an order created that day with deposit_status paid_verified.
"""
from __future__ import annotations

import datetime as dt
import re
import urllib.parse

from _api import _supabase

TAPBACK = re.compile(r"^(liked|loved|laughed at|emphasized|disliked|questioned) ", re.I)
COURTESY = re.compile(r"^\s*(ok|okay|k|thanks?|thank you( so much)?|thx|great|perfect|sounds good|will do|got it|cool|perfect thank you)[!. ]*$", re.I)
TAGS = ("owner", "default30", "concession", "tipped", "miss", "won", "lost")


def _pt_offset(day: dt.date) -> int:
    """Hours to add to Pacific wall time to get UTC: 7 in daylight time, 8 otherwise (US rules)."""
    def nth_sunday(year: int, month: int, n: int) -> dt.date:
        d = dt.date(year, month, 1)
        d += dt.timedelta(days=(6 - d.weekday()) % 7)
        return d + dt.timedelta(weeks=n - 1)
    start, end = nth_sunday(day.year, 3, 2), nth_sunday(day.year, 11, 1)
    return 7 if start <= day < end else 8


def _utc(day: dt.date, hour: int = 0) -> str:
    t = dt.datetime(day.year, day.month, day.day, hour) + dt.timedelta(hours=_pt_offset(day))
    return t.strftime("%Y-%m-%dT%H:%M:%SZ")


def _rows(table: str, params: list[tuple[str, str]]) -> list[dict]:
    out, offset = [], 0
    while True:
        q = urllib.parse.urlencode(params + [("limit", "1000"), ("offset", str(offset))], safe="(),.:*>-")
        page = _supabase("GET", f"/rest/v1/{table}?{q}", None, "application/json")
        out.extend(page or [])
        if not page or len(page) < 1000:
            return out
        offset += 1000


def _ts(s: str) -> dt.datetime:
    # Postgres trims trailing zeros ("17:01:15.04+00:00"); Python 3.10 wants 0, 3 or 6 digits.
    s = s.replace("Z", "+00:00")
    m = re.match(r"^(.*?T\d\d:\d\d:\d\d)(?:\.(\d+))?(.*)$", s)
    if m:
        frac = (m.group(2) or "")[:6].ljust(6, "0")
        s = f"{m.group(1)}.{frac}{m.group(3)}"
    return dt.datetime.fromisoformat(s)


def _pt(s: str, day: dt.date) -> str:
    return (_ts(s) - dt.timedelta(hours=_pt_offset(day))).strftime("%H:%M")


def _pct(values: list[float], q: float) -> float | None:
    if not values:
        return None
    v = sorted(values)
    pos = (len(v) - 1) * q
    lo, hi = int(pos), min(int(pos) + 1, len(v) - 1)
    return v[lo] + (v[hi] - v[lo]) * (pos - lo)


def _m(x: float | None) -> str:
    return "-" if x is None else f"{x:.1f}"


def day_report(day: dt.date) -> str:
    start, end = _utc(day), _utc(day + dt.timedelta(days=1))
    look_until = _utc(day + dt.timedelta(days=1), 12)

    leads = [l for l in _rows("leads", [("select", "id,created_at,lead_source,status"), ("created_at", f"gte.{start}"), ("created_at", f"lt.{end}")])
             if (l.get("status") or "") != "disqualified"]
    tps = _rows("lead_touchpoints", [
        ("select", "lead_id,touchpoint_type,occurred_at,b1:raw_payload_json->>Body,b2:raw_payload_json->>body,note:raw_payload_json->>note"),
        ("touchpoint_type", "in.(sms_inbound,sms_outbound,agent_note,call_inbound)"),
        ("occurred_at", f"gte.{start}"), ("occurred_at", f"lt.{look_until}"), ("order", "occurred_at.asc"),
    ])
    locks = _rows("orders", [("select", "order_no,customer_name,event_start,guest_adult_count,guest_child_count,created_at,balance_due_cents"),
                             ("deposit_status", "eq.paid_verified"), ("created_at", f"gte.{start}"), ("created_at", f"lt.{end}"), ("order", "created_at.asc")])

    out_by_lead: dict[str, list[dt.datetime]] = {}
    for t in tps:
        if t["touchpoint_type"] == "sms_outbound":
            out_by_lead.setdefault(t["lead_id"], []).append(_ts(t["occurred_at"]))

    def next_out(lead_id: str, after: dt.datetime) -> dt.datetime | None:
        return next((o for o in out_by_lead.get(lead_id, []) if o > after), None)

    # first response
    sources: dict[str, int] = {}
    firsts: list[float] = []
    for l in leads:
        sources[l.get("lead_source") or "?"] = sources.get(l.get("lead_source") or "?", 0) + 1
        o = next_out(l["id"], _ts(l["created_at"]) - dt.timedelta(seconds=1))
        if o:
            firsts.append((o - _ts(l["created_at"])).total_seconds() / 60)

    # customer texts and our replies (only texts that arrived during the day)
    day_end = _ts(end)
    inbound = [t for t in tps if t["touchpoint_type"] == "sms_inbound" and _ts(t["occurred_at"]) < day_end]
    real = [t for t in inbound if not TAPBACK.match(t.get("b1") or t.get("b2") or "") and not COURTESY.match(t.get("b1") or t.get("b2") or "")]
    waits, unanswered = [], 0
    for t in real:
        o = next_out(t["lead_id"], _ts(t["occurred_at"]))
        if o:
            waits.append((o - _ts(t["occurred_at"])).total_seconds() / 60)
        else:
            unanswered += 1
    calls = sum(1 for t in tps if t["touchpoint_type"] == "call_inbound" and _ts(t["occurred_at"]) < day_end)

    # notes written during the day: what our texts were for, and the judgment tags
    notes = [t for t in tps if t["touchpoint_type"] == "agent_note" and _ts(t["occurred_at"]) < day_end and t.get("note")]
    sop: dict[str, int] = {}
    tagged: dict[str, list[str]] = {k: [] for k in TAGS}
    for n in notes:
        text = n["note"]
        m = re.match(r"^\[SOP:([a-z_0-9]+)\]", text)
        if m:
            sop[m.group(1)] = sop.get(m.group(1), 0) + 1
        for k in TAGS:
            if re.search(rf"\[{k}\]", text):
                tagged[k].append(f"{_pt(n['occurred_at'], day)} {text[:150]}")

    lock_total = sum((o.get("balance_due_cents") or 0) for o in locks) / 100
    lines = [
        f"## 1. 今天的数（desk report day {day.isoformat()}）",
        "",
        "| 项 | 数 |",
        "|---|---|",
        f"| 新线索 | {len(leads)} 条：" + "、".join(f"{k} {v}" for k, v in sorted(sources.items(), key=lambda kv: -kv[1])) + " |",
        f"| 首响 | {len(firsts)}/{len(leads)}，中位 {_m(_pct(firsts, .5))} 分钟，p90 {_m(_pct(firsts, .9))} 分钟 |",
        f"| 客人短信 | {len(inbound)} 条，有内容的 {len(real)} 条；回了 {len(waits)}，中位 {_m(_pct(waits, .5))} 分钟，p90 {_m(_pct(waits, .9))} 分钟，"
        f"超 15 分钟 {sum(1 for w in waits if w > 15)} 条，没回 {unanswered} 条 |",
        f"| 来电 | {calls} 通 |",
        "| 带标签的外发 | " + ("、".join(f"{k} {v}" for k, v in sorted(sop.items(), key=lambda kv: -kv[1])) or "0") + " |",
        f"| 锁单 | {len(locks)} 单，尾款合计 ${lock_total:,.2f}（菜单、租赁、路费没定的按当前数） |",
        f"| 流失 | {len(tagged['lost'])} 条（按当天 [lost] 备注） |",
        "| 判断标签 | " + " · ".join(f"{k} {len(tagged[k])}" for k in ("owner", "default30", "concession", "tipped", "miss")) + " |",
        "",
    ]
    if locks:
        lines += ["**锁单**", ""]
        for o in locks:
            lines.append(f"- {o['order_no']} · {o.get('customer_name') or '-'} · 派对 {(o.get('event_start') or '')[:16].replace('T', ' ')} · "
                         f"{o.get('guest_adult_count') or 0} 大 {o.get('guest_child_count') or 0} 小 · ${(o.get('balance_due_cents') or 0) / 100:,.2f} · {_pt(o['created_at'], day)} 锁")
        lines.append("")
    for k, title in (("lost", "流失"), ("miss", "失误"), ("tipped", "成交那一下"), ("concession", "让价"), ("owner", "老板拍板"), ("default30", "半小时默认执行")):
        if tagged[k]:
            lines += [f"**{title}（[{k}]）**", ""] + [f"- {x}" for x in tagged[k]] + [""]
    return "\n".join(lines)
