"""desk report day / week - the numbers half of the sales daily and weekly reports (docs/销售日志/README.md).

Read-only. Texts come from Twilio: README §4 makes Twilio the source of truth, because texts sent
from the App or a script reach the lead timeline only when someone opens that conversation (10-09:
Ellen's 17:01 "So are we!" was in Twilio but not on the timeline, so the first version of this
report counted her as unanswered). Leads, notes and orders come from Supabase (service key,
PostgREST). Nothing is counted by hand; the judgment sections are still written by whoever writes
the report.

Definitions (README §4):
- a day is 00:00-24:00 Pacific, a week Sunday-Saturday;
- a lead is a row of the lead_attribution view with counts_as_lead (a phone or an email, not merged,
  not disqualified, not "NOT A CUSTOMER"), minus staff phones and 555 test numbers, one per phone;
  its channel is the view's (rh_resolve_channel - the one place channels are classified);
- first response = lead created -> our first text that is not a system receipt. "Real Hibachi: ..."
  texts (quote, deposit, lock, missed call) go out the moment the customer does something and answer
  nothing; the machine first-response text counts;
- a customer text has content: tapbacks, bare courtesy ("ok", "thank you") and STOP-type words are
  left out; a picture with no words is content;
- reply time = a customer text -> our next text to that number (receipts left out); texts sent in a row
  before we answer are one wait, timed from the first;
- a lock = an order with deposit_status paid_verified, by its created_at.
"""
from __future__ import annotations

import base64
import datetime as dt
import email.utils
import json
import re
import urllib.parse
import urllib.request

from _api import ROOT, UA, _supabase, env

try:
    from zoneinfo import ZoneInfo

    PT = ZoneInfo("America/Los_Angeles")
except Exception:  # no tz database: fall back to the US rule below
    PT = None
UTC = dt.timezone.utc

# iPhone reactions arrive as text: "Liked “…”"; on Spanish and Russian phones the verb is localized.
TAPBACK = re.compile(r"^(liked|loved|laughed at|emphasized|disliked|questioned|reacted|le gustó|le encantó|se rió de|enfatizó|no le gustó|cuestionó"
                     r"|reaccionó|очень понравилось|понравилось|не понравилось) ", re.I)
_CLOSER = (r"(ok(ay)?|k+|thanks?( you)?( so much| very much)?|thank you|ty|tysm|thx|great|perfect|awesome|amazing|cool|nice|sounds (good|great|perfect)"
           r"|will do|got it|see (you|ya)( then| soon| there| tomorrow| saturday| sunday| friday)?|you too|you as well|same to you"
           r"|(i )?appreciate (it|you)|yay|no problem|np|lol|haha)")
COURTESY = re.compile(rf"^(?:[^\w?]+|\W*{_CLOSER}([\s,.!&-]+(and )?{_CLOSER})*[^\w?]*)$", re.I)  # emoji-only counts; "ok?" does not
STOPWORD = re.compile(r"^\s*(stop|stopall|unsubscribe|cancel|end|quit|start|unstop|help)\s*[.!]*\s*$", re.I)
OPT_OUT = re.compile(r"^\s*(stop|stopall|unsubscribe|cancel|end|quit)\s*[.!]*\s*$", re.I)
RECEIPT = re.compile(r"^\s*Real Hibachi:", re.I)
QUOTE = re.compile(r"realhibachi\.com/d/|^\s*Real Hibachi: your .*price", re.I | re.S)
TAGS = ("owner", "default30", "concession", "tipped", "miss", "won", "lost", "why")
CHANNEL_LABELS = {  # display only - lib/channels.ts CHANNEL_LABELS
    "google_ads": "Google Ads", "chatgpt_ads": "ChatGPT Ads", "meta_ads": "Meta Ads", "yelp_ads": "Yelp Ads", "other_ads": "其他付费",
    "google_organic": "Google 自然", "search_organic": "其他搜索自然", "chatgpt_referral": "ChatGPT 自然", "meta_organic": "Meta 自然",
    "fb_marketplace": "FB Marketplace", "yelp_organic": "Yelp 自然", "marketplace_referral": "平台转介", "other_referral": "其他来源",
    "word_of_mouth": "口碑转介绍", "partner": "合作伙伴", "ai_agent": "AI 代理代订", "organic_direct": "直接/未追踪", "unresolved": "未归因",
}
LOST_KINDS = (  # first match wins; anything else is "其他"
    ("选了别家", re.compile(r"found someone|someone else|(another|alternate|alternative|other) (company|caterer|vendor|place)|went with|booked (someone|another|with)|competitor", re.I)),
    ("价格/预算", re.compile(r"price|expensive|budget|too much|cheaper|afford|cost", re.I)),
    ("取消/改期", re.compile(r"cancel|postpone|reschedul|change of plans|called off|not happening|no longer", re.I)),
    ("联系不上", re.compile(r"no response|never replied|ghost|silent|unreachable|undeliver|wrong number", re.I)),
)


# ---------------------------------------------------------------- time ----
def _pt_offset(day: dt.date) -> int:
    """Hours to add to Pacific wall time to get UTC (only used without a tz database)."""
    def nth_sunday(year: int, month: int, n: int) -> dt.date:
        d = dt.date(year, month, 1)
        d += dt.timedelta(days=(6 - d.weekday()) % 7)
        return d + dt.timedelta(weeks=n - 1)
    start, end = nth_sunday(day.year, 3, 2), nth_sunday(day.year, 11, 1)
    return 7 if start <= day < end else 8


def _at(day: dt.date, hour: int = 0) -> dt.datetime:
    """Pacific wall time on `day` as an aware UTC datetime."""
    if PT is not None:
        return dt.datetime(day.year, day.month, day.day, hour, tzinfo=PT).astimezone(UTC)
    return dt.datetime(day.year, day.month, day.day, hour, tzinfo=UTC) + dt.timedelta(hours=_pt_offset(day))


def _local(t: dt.datetime) -> dt.datetime:
    if PT is not None:
        return t.astimezone(PT)
    return t.astimezone(UTC) - dt.timedelta(hours=_pt_offset(t.astimezone(UTC).date()))


def _hm(t: dt.datetime) -> str:
    return _local(t).strftime("%H:%M")


def _mdhm(t: dt.datetime) -> str:
    return _local(t).strftime("%m-%d %H:%M")


def _z(t: dt.datetime) -> str:
    return t.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def _ts(s: str) -> dt.datetime:
    # Postgres trims trailing zeros ("17:01:15.04+00:00"); Python 3.10 wants 0, 3 or 6 digits.
    s = s.replace("Z", "+00:00")
    m = re.match(r"^(.*?T\d\d:\d\d:\d\d)(?:\.(\d+))?(.*)$", s)
    if m:
        frac = (m.group(2) or "")[:6].ljust(6, "0")
        s = f"{m.group(1)}.{frac}{m.group(3)}"
    t = dt.datetime.fromisoformat(s)
    return t if t.tzinfo else t.replace(tzinfo=UTC)


# ---------------------------------------------------------------- data ----
def _rows(table: str, params: list[tuple[str, str]]) -> list[dict]:
    out, offset = [], 0
    while True:
        q = urllib.parse.urlencode(params + [("limit", "1000"), ("offset", str(offset))], safe="(),.:*>-")
        page = _supabase("GET", f"/rest/v1/{table}?{q}", None, "application/json")
        out.extend(page or [])
        if not page or len(page) < 1000:
            return out
        offset += 1000


def _digits(s: str | None) -> str:
    d = re.sub(r"\D", "", s or "")
    return d[-10:] if len(d) >= 10 else ""


def _texts(start: dt.datetime, end: dt.datetime) -> list[dict]:
    """Every text on the 213 line between start and end, oldest first: {phone, at, dir, body, media}.
    Outbound texts that never reached the phone (failed / undelivered / canceled) are left out."""
    sid, tok = env("TWILIO_ACCOUNT_SID"), env("TWILIO_AUTH_TOKEN")
    auth = "Basic " + base64.b64encode(f"{sid}:{tok}".encode()).decode()
    q = urllib.parse.urlencode({"DateSent>": _z(start), "DateSent<": _z(end), "PageSize": 1000})
    url: str | None = f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json?{q}"
    out = []
    while url:
        req = urllib.request.Request(url, headers={"authorization": auth, "user-agent": UA})
        with urllib.request.urlopen(req, timeout=120) as r:
            page = json.loads(r.read().decode("utf-8"))
        for m in page.get("messages") or []:
            inbound = m.get("direction") == "inbound"
            if not inbound and m.get("status") in ("failed", "undelivered", "canceled"):
                continue
            when = m.get("date_sent") or m.get("date_created")
            phone = _digits(m.get("from") if inbound else m.get("to"))
            if not when or not phone:
                continue
            out.append({"phone": phone, "at": email.utils.parsedate_to_datetime(when), "dir": "in" if inbound else "out",
                        "body": (m.get("body") or "").strip(), "media": int(m.get("num_media") or 0)})
        nxt = page.get("next_page_uri")
        url = "https://api.twilio.com" + nxt if nxt else None
    out.sort(key=lambda x: x["at"])
    return out


class Texts:
    def __init__(self, msgs: list[dict]):
        self.by_phone: dict[str, list[dict]] = {}
        for m in msgs:
            self.by_phone.setdefault(m["phone"], []).append(m)

    def first(self, phone: str, after: dt.datetime, until: dt.datetime, direction: str, pred=None) -> dict | None:
        for m in self.by_phone.get(phone, []):
            if m["at"] <= after or m["dir"] != direction:
                continue
            if m["at"] > until:
                return None
            if pred is None or pred(m):
                return m
        return None


def _content(m: dict) -> bool:
    b = m["body"]
    return m["media"] > 0 or bool(b and not TAPBACK.match(b) and not COURTESY.match(b) and not STOPWORD.match(b))


def _ours(m: dict) -> bool:
    return not RECEIPT.match(m["body"])


def _staff_phones() -> set[str]:
    s = {_digits(r.get("phone")) for r in _rows("staff_members", [("select", "phone")])}
    try:
        s.add(_digits(env("TWILIO_FORWARD_TO")))
    except SystemExit:
        pass
    s.discard("")
    return s


def _leads() -> tuple[list[dict], dict[str, dict]]:
    """(leads that count, oldest first; every lead by id - notes can sit on any of them)."""
    attr = {r["id"]: r for r in _rows("lead_attribution", [("select", "id,channel,counts_as_lead")])}
    staff = _staff_phones()
    every: dict[str, dict] = {}
    counted = []
    for l in _rows("leads", [("select", "id,full_name,normalized_phone,email,created_at,lead_source,status")]):
        a = attr.get(l["id"]) or {}
        l["phone"] = _digits(l.get("normalized_phone"))
        l["channel"] = a.get("channel") or "unresolved"
        l["at"] = _ts(l["created_at"])
        l["name"] = (l.get("full_name") or "").strip() or (l["phone"] and f"{l['phone'][:3]}-{l['phone'][3:6]}-{l['phone'][6:]}") or (l.get("email") or "?")
        every[l["id"]] = l
        if a.get("counts_as_lead") and l["phone"] not in staff and l["phone"][3:6] != "555":
            counted.append(l)
    counted.sort(key=lambda l: l["at"])
    return counted, every


def _notes(start: dt.datetime, end: dt.datetime) -> list[dict]:
    rows = _rows("lead_touchpoints", [("select", "lead_id,occurred_at,note:raw_payload_json->>note"), ("touchpoint_type", "eq.agent_note"),
                                      ("occurred_at", f"gte.{_z(start)}"), ("occurred_at", f"lt.{_z(end)}"), ("order", "occurred_at.asc")])
    return [dict(r, at=_ts(r["occurred_at"])) for r in rows if r.get("note")]


def _touches(types: str, start: dt.datetime, end: dt.datetime) -> dict[str, list[tuple[str, dt.datetime]]]:
    out: dict[str, list[tuple[str, dt.datetime]]] = {}
    for r in _rows("lead_touchpoints", [("select", "lead_id,touchpoint_type,occurred_at"), ("touchpoint_type", f"in.({types})"),
                                        ("occurred_at", f"gte.{_z(start)}"), ("occurred_at", f"lt.{_z(end)}")]):
        out.setdefault(r["lead_id"], []).append((r["touchpoint_type"], _ts(r["occurred_at"])))
    return out


def _locks(start: dt.datetime, end: dt.datetime) -> list[dict]:
    rows = _rows("orders", [("select", "id,order_no,customer_name,customer_phone,event_start,guest_adult_count,guest_child_count,created_at,quoted_total_cents,balance_due_cents,lead_id:source_metadata->>lead_id"),
                            ("deposit_status", "eq.paid_verified"), ("created_at", f"gte.{_z(start)}"), ("created_at", f"lt.{_z(end)}"), ("order", "created_at.asc")])
    for o in rows:
        o["at"] = _ts(o["created_at"])
        o["phone"] = _digits(o.get("customer_phone"))
        o["total"] = (o.get("quoted_total_cents") or o.get("balance_due_cents") or 0) / 100  # invoice total; a finished party owes $0
        # A lock whose invoice was never saved has invoice_data {"total_cost": 0} and no total yet
        # (Hardeep 10-09: locked at 22:09, menu to come) - show it as pending, not as $0.
        o["money"] = f"${o['total']:,.2f}" if o["total"] else "总价待算（发票还没生成）"
        o["when"] = (o.get("event_start") or "")[:16].replace("T", " ") or "日期待定"
    return rows


# ---------------------------------------------------------------- math ----
def _pct(values: list[float], q: float) -> float | None:
    if not values:
        return None
    v = sorted(values)
    pos = (len(v) - 1) * q
    lo, hi = int(pos), min(int(pos) + 1, len(v) - 1)
    return v[lo] + (v[hi] - v[lo]) * (pos - lo)


def _m(x: float | None) -> str:
    return "-" if x is None else f"{x:.1f}"


def _wilson(k: int, n: int, z: float = 1.96) -> tuple[float, float] | None:
    if n == 0:
        return None
    p, d = k / n, 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * ((p * (1 - p) / n + z * z / (4 * n * n)) ** 0.5) / d
    return max(0.0, c - h), min(1.0, c + h)


def _rate(k: int, n: int) -> str:
    return f"{k}" if n == 0 else f"{k}（{k / n:.0%}）"


def _waits(inbound: list[dict], texts: Texts, until: dt.datetime) -> tuple[list[tuple[dict, float]], list[dict]]:
    """Each wait -> minutes to our next text to that number; and the waits never answered. Texts a
    customer sends in a row before we answer are one wait, timed from the first of them (Delia's
    three texts at 17:14 on 10-09 were one 19-minute wait, not three)."""
    waited, open_ = [], []
    answer_of: dict[str, object] = {}
    for m in inbound:
        o = texts.first(m["phone"], m["at"], until, "out", _ours)
        key = o["at"] if o else None
        if m["phone"] in answer_of and answer_of[m["phone"]] == key:
            continue  # same burst: already counted from its first text
        answer_of[m["phone"]] = key
        if o:
            waited.append((m, (o["at"] - m["at"]).total_seconds() / 60))
        else:
            open_.append(m)
    return waited, open_


def _clip(s: str, n: int) -> str:
    s = re.sub(r"\s+", " ", s or "").strip()
    return s if len(s) <= n else s[: n - 1] + "…"


def _tagged(notes: list[dict], every: dict[str, dict]) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {k: [] for k in TAGS}
    for n in notes:
        for k in TAGS:
            if re.search(rf"\[{k}\]", n["note"]):
                who = (every.get(n["lead_id"]) or {}).get("name") or "?"
                out[k].append(f"{_mdhm(n['at'])} {who}：{_clip(n['note'], 170)}")
    return out


# ----------------------------------------------------------------- day ----
def day_report(day: dt.date) -> str:
    now = dt.datetime.now(UTC)
    start, end = _at(day), _at(day + dt.timedelta(days=1))
    look_until = min(now, _at(day + dt.timedelta(days=1), 12))
    texts = Texts(_texts(start - dt.timedelta(minutes=5), look_until))
    counted, every = _leads()
    lead_phones = {l["phone"] for l in counted if l["phone"]}
    names = {l["phone"]: l["name"] for l in counted if l["phone"]}

    # leads of the day, one per phone, and our first answer to each
    leads, seen = [], set()
    for l in counted:
        key = l["phone"] or (l.get("email") or "").lower()
        if start <= l["at"] < end and key not in seen:
            seen.add(key)
            leads.append(l)
    sources: dict[str, int] = {}
    firsts, slow_first = [], []
    for l in leads:
        sources[l["channel"]] = sources.get(l["channel"], 0) + 1
        if not l["phone"]:
            continue
        o = texts.first(l["phone"], l["at"] - dt.timedelta(seconds=5), look_until, "out", _ours)
        if o:
            mins = (o["at"] - l["at"]).total_seconds() / 60
            firsts.append(mins)
            if mins > 10:
                slow_first.append(f"{_hm(l['at'])} {l['name']}：{mins:.0f} 分钟")
        else:
            slow_first.append(f"{_hm(l['at'])} {l['name']}：还没回")

    # customer texts of the day and our replies
    inbound = [m for p, ms in texts.by_phone.items() if p in lead_phones for m in ms if m["dir"] == "in" and start <= m["at"] < end]
    inbound.sort(key=lambda m: m["at"])
    real = [m for m in inbound if _content(m)]
    waited, open_ = _waits(real, texts, look_until)
    waits = [w for _, w in waited]
    calls = sum(1 for v in _touches("call_inbound", start, end).values() for _ in v)

    notes = _notes(start, end)
    sop: dict[str, int] = {}
    for n in notes:
        m = re.match(r"^\[SOP:([a-z_0-9]+)\]", n["note"])
        if m:
            sop[m.group(1)] = sop.get(m.group(1), 0) + 1
    tagged = _tagged(notes, every)
    locks = _locks(start, end)
    lock_total = sum(o["total"] for o in locks)
    pending = sum(1 for o in locks if not o["total"])

    lines = [
        f"## 1. 今天的数（desk report day {day.isoformat()}，短信以 Twilio 为准）",
        "",
        "| 项 | 数 |",
        "|---|---|",
        f"| 新线索 | {len(leads)} 条：" + ("、".join(f"{CHANNEL_LABELS.get(k, k)} {v}" for k, v in sorted(sources.items(), key=lambda kv: -kv[1])) or "-") + " |",
        f"| 首响（不算系统回执） | {len(firsts)}/{len(leads)}，中位 {_m(_pct(firsts, .5))} 分钟，p90 {_m(_pct(firsts, .9))} 分钟 |",
        f"| 客人短信 | {len(inbound)} 条，有内容的 {len(real)} 条，连发的算一次共 {len(waits) + len(open_)} 次等待；回了 {len(waits)} 次，中位 {_m(_pct(waits, .5))} 分钟，p90 {_m(_pct(waits, .9))} 分钟，"
        f"超 15 分钟 {sum(1 for w in waits if w > 15)} 条，没回 {len(open_)} 条 |",
        f"| 来电 | {calls} 通 |",
        "| 带标签的外发 | " + ("、".join(f"{k} {v}" for k, v in sorted(sop.items(), key=lambda kv: -kv[1])) or "0") + " |",
        f"| 锁单 | {len(locks)} 单，发票总额 ${lock_total:,.2f}" + (f"，另 {pending} 单总价待算" if pending else "") + "（菜单、租赁、路费没定的按当前数） |",
        f"| 流失 | {len(tagged['lost'])} 条（按当天 [lost] 备注） |",
        "| 判断标签 | " + " · ".join(f"{k} {len(tagged[k])}" for k in ("owner", "default30", "concession", "tipped", "miss")) + " |",
        "",
    ]
    slow = [(m, w) for m, w in waited if w > 15]
    if slow or open_ or slow_first:
        lines += ["**慢的和没回的**（写进第 5 节前先看是不是本来就不用回）", ""]
        lines += [f"- 首响 {x}" for x in slow_first]
        lines += [f"- {_hm(m['at'])} {names.get(m['phone'], m['phone'])} 等了 {w:.0f} 分钟：{_clip(m['body'] or '[图片]', 60)}" for m, w in slow]
        lines += [f"- {_hm(m['at'])} {names.get(m['phone'], m['phone'])} 没回：{_clip(m['body'] or '[图片]', 60)}" for m in open_]
        lines.append("")
    if locks:
        lines += ["**锁单**", ""]
        for o in locks:
            lines.append(f"- {o['order_no']} · {o.get('customer_name') or '-'} · 派对 {o['when']} · "
                         f"{o.get('guest_adult_count') or 0} 大 {o.get('guest_child_count') or 0} 小 · {o['money']} · {_hm(o['at'])} 锁")
        lines.append("")
    for k, title in (("lost", "流失"), ("miss", "失误"), ("tipped", "成交那一下"), ("concession", "让价"), ("owner", "老板拍板"), ("default30", "半小时默认执行")):
        if tagged[k]:
            lines += [f"**{title}（[{k}]）**", ""] + [f"- {x}" for x in tagged[k]] + [""]
    return "\n".join(lines)


# ---------------------------------------------------------------- week ----
def last_full_week(today: dt.date) -> dt.date:
    """Sunday of the last Sunday-Saturday week that has ended."""
    this_sunday = today - dt.timedelta(days=(today.weekday() + 1) % 7)
    return this_sunday - dt.timedelta(days=7)


def _decisions_due(hi: dt.date, today: dt.date) -> list[tuple[dt.date, str, str]]:
    """Rows of the decision log's §2 queue (待验证队列) whose check date is on or before `hi`. Rows leave
    the queue once checked (log rule 6), so a row still there with a past date is overdue."""
    path = ROOT.parent / "docs" / "决策日志.md"
    if not path.exists():
        return [(today, f"（没找到 {path}）", "")]
    out, inside = [], False
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        if line.startswith("## "):
            inside = line.startswith("## 2.")
            continue
        if not inside or not line.startswith("| D-"):
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) < 4:
            continue
        m = re.search(r"(20\d\d)-(\d{1,2})-(\d{1,2})", cells[2])
        if not m:
            continue
        try:
            when = dt.date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        except ValueError:
            continue
        if when > hi:
            continue
        late = (today - when).days
        state = f"过期 {late} 天" if late > 0 else ("今天" if late == 0 else f"{-late} 天后")
        out.append((when, f"{cells[0]}（{when.strftime('%m-%d')}，{state}）：{_clip(re.sub(r'[*`]', '', cells[1]), 90)} · 判定：{_clip(re.sub(r'[*`]', '', cells[3]), 90)}", cells[0]))
    return sorted(out)


def week_report(week_start: dt.date) -> str:
    now = dt.datetime.now(UTC)
    weeks = [week_start - dt.timedelta(weeks=k) for k in (4, 3, 2, 1, 0)]
    span_start = _at(weeks[0])
    w0, w1 = _at(week_start), _at(week_start + dt.timedelta(days=7))
    horizon = min(now, w1 + dt.timedelta(days=14))
    texts = Texts(_texts(span_start - dt.timedelta(minutes=5), horizon))
    counted, every = _leads()
    lead_phones = {l["phone"] for l in counted if l["phone"]}
    names = {l["phone"]: l["name"] for l in counted if l["phone"]}
    locks = _locks(span_start - dt.timedelta(days=1), horizon)
    touch = _touches("call_inbound,email_inbound,email_outbound", span_start, horizon)
    notes = [n for n in _notes(span_start, horizon) if w0 <= n["at"] < w1]

    def lock_for(lead: dict, after: dt.datetime, until: dt.datetime) -> dict | None:
        return next((o for o in locks if (o.get("lead_id") == lead["id"] or (lead["phone"] and o["phone"] == lead["phone"])) and after <= o["at"] <= until), None)

    # cohorts: a lead counts once (its first appearance in the five weeks), in the week it came in
    cohorts: dict[dt.date, list[dict]] = {w: [] for w in weeks}
    seen = set()
    for l in counted:
        if not (span_start <= l["at"] < w1):
            continue
        key = l["phone"] or (l.get("email") or "").lower() or l["id"]
        if key in seen:
            continue
        seen.add(key)
        idx = (_local(l["at"]).date() - weeks[0]).days // 7
        if 0 <= idx < len(weeks):
            cohorts[weeks[idx]].append(l)

    def stages(l: dict) -> dict:
        t0 = l["at"]
        t14 = min(t0 + dt.timedelta(days=14), horizon)
        ph, tl = l["phone"], touch.get(l["id"], [])
        resp = None
        if ph:
            o = texts.first(ph, t0 - dt.timedelta(seconds=5), t14, "out", _ours)
            resp = o["at"] if o else None
        mails = sorted(at for k, at in tl if k == "email_outbound" and t0 <= at <= t14)
        if mails and (resp is None or mails[0] < resp):
            resp = mails[0]
        engaged = bool(ph and texts.first(ph, t0 - dt.timedelta(minutes=2), t14, "in", _content)) or \
            any(k in ("call_inbound", "email_inbound") and t0 - dt.timedelta(minutes=2) <= at <= t14 for k, at in tl)
        quoted = bool(ph and texts.first(ph, t0 - dt.timedelta(seconds=5), t14, "out", lambda m: bool(QUOTE.search(m["body"]))))
        return {"resp": resp, "engaged": engaged, "quoted": quoted, "lock": lock_for(l, t0 - dt.timedelta(hours=1), t14)}

    st = {l["id"]: stages(l) for w in weeks for l in cohorts[w]}

    lines = [f"# 周报数字 · {week_start.isoformat()}（日）– {(week_start + dt.timedelta(days=6)).isoformat()}（六）",
             "", f"> `desk report week` 生成于 {_mdhm(now)} PT，只读。短信以 Twilio 为准；线索口径 = lead_attribution.counts_as_lead，去掉员工和 555 测试号，一个号码只算一次。"
             "第 9、10 节手写。", ""]

    # 1. funnel
    lines += ["## 1. 漏斗（按线索进来的那周分组，每条看 14 天）", "",
              "| 线索周 | 线索 | 首响 | 客人回话 | 报价 | 锁单 | 锁单率 95% 区间 |", "|---|---|---|---|---|---|---|"]
    for w in weeks:
        ls = cohorts[w]
        n = len(ls)
        r = sum(1 for l in ls if st[l["id"]]["resp"])
        e = sum(1 for l in ls if st[l["id"]]["engaged"])
        q = sum(1 for l in ls if st[l["id"]]["quoted"])
        k = sum(1 for l in ls if st[l["id"]]["lock"])
        ci = _wilson(k, n)
        mature = horizon >= _at(w + dt.timedelta(days=7)) + dt.timedelta(days=14)
        label = (w.strftime("%m-%d") + ("" if mature else "（未满 14 天）") + ("（09-13 前，线索表是补录的，不可比）" if w < dt.date(2026, 9, 13) else "")
                 + (" ← 本周" if w == week_start else ""))
        lines.append(f"| {label} | {n} | {_rate(r, n)} | {_rate(e, n)} | {_rate(q, n)} | {_rate(k, n)} | "
                     + (f"{ci[0]:.0%}–{ci[1]:.0%}" if ci else "-") + " |")
    lines += ["", "单周的锁单率在区间里上下跳是正常的；连续两周落在前几周区间的同一侧才查（复盘与止损框架）。", ""]

    # 2. speed
    target = cohorts[week_start]
    firsts = [(st[l["id"]]["resp"] - l["at"]).total_seconds() / 60 for l in target if st[l["id"]]["resp"]]
    inbound = sorted((m for p, ms in texts.by_phone.items() if p in lead_phones for m in ms if m["dir"] == "in" and w0 <= m["at"] < w1 and _content(m)),
                     key=lambda m: m["at"])
    waited, open_ = _waits(inbound, texts, horizon)
    buckets = (("早 7–12", 7, 12), ("午 12–17", 12, 17), ("晚 17–21", 17, 21), ("夜 21–24", 21, 24), ("凌晨 0–7", 0, 7))
    lines += ["## 2. 速度", "",
              f"- 首响（不算系统回执）：{len(firsts)}/{len(target)}，中位 {_m(_pct(firsts, .5))} 分钟，p90 {_m(_pct(firsts, .9))} 分钟，"
              f"超 10 分钟 {sum(1 for x in firsts if x > 10)} 条，超 3 小时 {sum(1 for x in firsts if x > 180)} 条",
              f"- 回客人：有内容的客人短信 {len(inbound)} 条，连发的算一次共 {len(waited) + len(open_)} 次等待，回了 {len(waited)} 次，中位 {_m(_pct([w for _, w in waited], .5))} 分钟，"
              f"p90 {_m(_pct([w for _, w in waited], .9))} 分钟，超 15 分钟 {sum(1 for _, w in waited if w > 15)} 条，"
              f"超 3 小时 {sum(1 for _, w in waited if w > 180)} 条，没回 {len(open_)} 条", "",
              "| 时段（客人发来的时间） | 条数 | 中位（分钟） | p90 | 超 15 分钟 |", "|---|---|---|---|---|"]
    for label, a, b in buckets:
        ws = [w for m, w in waited if a <= _local(m["at"]).hour < b]
        lines.append(f"| {label} | {len(ws)} | {_m(_pct(ws, .5))} | {_m(_pct(ws, .9))} | {sum(1 for w in ws if w > 15)} |")
    worst = sorted(waited, key=lambda x: -x[1])[:8]
    if worst:
        lines += ["", "最慢的几条："] + [f"- {_mdhm(m['at'])} {names.get(m['phone'], m['phone'])} 等了 {w:.0f} 分钟：{_clip(m['body'] or '[图片]', 60)}" for m, w in worst]
    if open_:
        lines += ["", "没回的（先看是不是本来就不用回）："] + [f"- {_mdhm(m['at'])} {names.get(m['phone'], m['phone'])}：{_clip(m['body'] or '[图片]', 60)}" for m in open_]
    lines.append("")

    # 3. what each kind of text did
    agg: dict[str, list[int]] = {}
    for n in notes:
        m = re.match(r"^\[SOP:([a-z_0-9]+)\]", n["note"])
        l = every.get(n["lead_id"])
        if not m or not l or not l["phone"]:
            continue
        a = agg.setdefault(m.group(1), [0, 0, 0, 0, 0])
        a[0] += 1
        until48 = min(n["at"] + dt.timedelta(hours=48), horizon)
        if n["at"] + dt.timedelta(hours=48) > horizon:
            a[4] += 1
        if texts.first(l["phone"], n["at"], until48, "in", _content):
            a[1] += 1
        if lock_for(l, n["at"], min(n["at"] + dt.timedelta(days=14), horizon)):
            a[2] += 1
        if texts.first(l["phone"], n["at"], until48, "in", lambda x: bool(OPT_OUT.match(x["body"]))):
            a[3] += 1
    lines += ["## 3. 每类消息的效果（按 [SOP:类型] 备注）", "", "| 类型 | 条数 | 48 小时内回了 | 14 天内锁单 | STOP/取消 |", "|---|---|---|---|---|"]
    for k, (c, rep, lk, stop, young) in sorted(agg.items(), key=lambda kv: -kv[1][0]):
        lines.append(f"| {k} | {c}" + (f"（{young} 条不满 48 小时）" if young else "") + f" | {_rate(rep, c)} | {_rate(lk, c)} | {stop} |")
    if not agg:
        lines.append("| - | 0 | - | - | - |")
    lines += ["", "一类攒够 30 条再下结论（lead-scan §8）。", ""]

    tagged = _tagged(notes, every)

    # 4. concessions
    lines += ["## 4. 让价（[concession]）", ""]
    for n in notes:
        if "[concession]" in n["note"]:
            l = every.get(n["lead_id"]) or {"id": n["lead_id"], "phone": "", "name": "?"}
            got = lock_for(l, n["at"] - dt.timedelta(days=2), horizon)
            lines.append(f"- {_mdhm(n['at'])} {l['name']}：{_clip(n['note'], 200)} → " + (f"锁了（{got['order_no']}）" if got else "没锁"))
    if not tagged["concession"]:
        lines.append("- 本周没有")
    lines.append("")

    # 5. why we lost: [lost] notes, and [why] notes of leads that were lost ([why] also records why people buy)
    gone = re.compile(r"lost|passed|pass on|declin|not interested|other plans|found someone|booked (with|another)|cancel", re.I)
    by_lead: dict[str, list[dict]] = {}
    for n in notes:
        l = every.get(n["lead_id"]) or {}
        if "[lost]" in n["note"] or ("[why]" in n["note"] and (l.get("status") == "lost" or gone.search(n["note"]))):
            by_lead.setdefault(n["lead_id"], []).append(n)
    kinds: dict[str, int] = {}
    for ns in by_lead.values():
        text = " ".join(n["note"] for n in ns)
        kind = next((name for name, rx in LOST_KINDS if rx.search(text)), "其他")
        kinds[kind] = kinds.get(kind, 0) + 1
    lines += [f"## 5. 丢单原因（{len(by_lead)} 位客人；[lost]，加上丢了的客人的 [why]；按关键词粗分，归类以人看为准）", "",
              ("、".join(f"{k} {v}" for k, v in sorted(kinds.items(), key=lambda kv: -kv[1])) or "本周没有"), ""]
    for lid, ns in by_lead.items():
        lines.append(f"- {(every.get(lid) or {}).get('name', '?')}：" + " / ".join(f"{_mdhm(n['at'])} {_clip(n['note'], 150)}" for n in ns))
    lines.append("")

    # 6. sources
    by_ch: dict[str, list[int]] = {}
    for l in target:
        a = by_ch.setdefault(l["channel"], [0, 0, 0])
        a[0] += 1
        a[1] += 1 if st[l["id"]]["engaged"] else 0
        a[2] += 1 if st[l["id"]]["lock"] else 0
    week_locks = [o for o in locks if w0 <= o["at"] < w1]
    lines += ["## 6. 来源（本周进来的线索）", "", "| 渠道 | 线索 | 客人回话 | 锁单 |", "|---|---|---|---|"]
    for ch, (n, e, k) in sorted(by_ch.items(), key=lambda kv: -kv[1][0]):
        lines.append(f"| {CHANNEL_LABELS.get(ch, ch)} | {n} | {_rate(e, n)} | {_rate(k, n)} |")
    total = sum(o["total"] for o in week_locks)
    pending = sum(1 for o in week_locks if not o["total"])
    lines += ["", f"本周锁单（按锁单时间，不管线索哪周来的）：{len(week_locks)} 单，发票总额 ${total:,.2f}" + (f"，另 {pending} 单总价待算" if pending else "") + "。The Knot / Zola 的询价不进线索表，手动补。", ""]
    for o in week_locks:
        lead = every.get(o.get("lead_id") or "") or next((l for l in counted if o["phone"] and l["phone"] == o["phone"]), None)
        lines.append(f"- {_mdhm(o['at'])} {o['order_no']} · {o.get('customer_name') or '-'} · 派对 {o['when'][:10]} · "
                     f"{o['money']} · {CHANNEL_LABELS.get(lead['channel'], lead['channel']) if lead else '找不到线索'}")
    lines.append("")

    # 7. decisions to check
    due = _decisions_due(week_start + dt.timedelta(days=13), _local(now).date())
    now_due = [line for when, line, _ in due if when >= week_start]
    stale = [ident for when, _, ident in due if when < week_start]
    lines += ["## 7. 到期的决策验证（决策日志 §2 待验证队列；验证完回填结论并移出队列，规则 6）", ""] + ([f"- {x}" for x in now_due] or ["- 本周和下周没有到期的"])
    if stale:
        lines += ["", f"更早就过期、还在队列里的 {len(stale)} 条（回填结论或改验证日期，队列要清理）：" + "、".join(stale)]
    lines.append("")

    # 8. misses
    lines += [f"## 8. 本周失误（[miss] {len(tagged['miss'])} 条；不挂客人的失误在各天日报第 5 节）", ""] + ([f"- {x}" for x in tagged["miss"]] or ["- 没有"]) + [""]
    lines += ["## 9. 下周试什么（手写：1–3 件，每件只动一个变量，写验证日期）", "", "## 10. 这套日志哪里不好用（手写）", ""]
    return "\n".join(lines)
