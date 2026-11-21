# -*- coding: utf-8 -*-
"""派对当天核对 (owner 2026-11-12, D-1112-01) - `desk order check <date>`, and the two blocking gaps
`desk order show` prints in its 缺项 block.

The chefs work from two things only: the prep list (备货清单: proteins, extras, setup - counted from the
invoice - and the 备货备注 = orders.prep_note) and the order (the chef link prints, under 派对前必看, the
notes the customer can see, every guest's allergy and the party-page notes). 「只要没列在这个上面的…
师傅都会忘」「短信他可能也不会完全注意到」. So for each party this prints what those two carry, then every
requirement of the customer's found anywhere else that they do not:
  (a) the order's internal notes
  (b) the lead's notes tagged [data] [deal] [承诺] [promised] [occasion] [owner] [policy], and 来电小结
  (c) what the customer wrote on the party page (invoice_update_requests, before "Submitted from the
      party planner")
  (d) the customer's texts (what they asked for; from our side only what we promised)
  (e) what we told the chef: the note sent with his sheet, our texts to his number about this party (its order number,
      prep-sheet link, the customer's name or its day - never the city alone: _mentions_party)
  (f) the deal (customDeal free items / rates) and the setup picked on /rentals (setup_selection)

Blocking (!!), as the owner set them:
  - setup that was promised - setup_selection, the deal's free items or rates for tables/chairs or
    utensils, a note promising tables, chairs, linens or place settings - while the invoice has none of
    it: the prep list counts setup from the invoice, so nothing is loaded (Andrea 11-12, Kande 12/05).
    A host who provides their own ("provided by the host", "customer providing", "自备") is no promise.
  - an allergy, or "cook X last / separately", in the internal notes or the lead's notes that the chef
    cannot see: not in the customer-visible notes, a guest's allergy or the 备货备注 (George 11-13).
Warnings (!): arrival time, gate / call on arrival, the occasion, spectators who do not eat, "double X"
for a guest whose row has X once (the prep list counts the row), bring-items (extra rice, sriracha, a
speaker...) that are not on the prep list or the 备货备注, site notes (flat ground, stairs), dietary
instructions (no butter, kosher), an allergy that only a text or the party page mentions; and the dispatch
plan against the order: a stations note that seats the guests at tables or in U shapes while the order
loads no table (the sheet prints the note word for word), more cooks on the order than the plan has chefs.

Matching is by keywords, English and Chinese, kept narrow: tuned on the 11-11/11-12 cases (selfcheck has
them). A requirement taken back later ("不需要 kosher 肉了") is dropped. Nothing here writes anything.

An outsourced party (外包, owner 2026-11-18, lib/outsourced.ts) is run by a partner company: no chef of ours and no
prep sheet, so neither is flagged on it (sheet_lines), and its crew line names the partner's invoice link (plan_lines).
Every other check stays - the customer's requirements still have to reach whoever cooks.
"""
from __future__ import annotations

import datetime as _dt
import functools
import math
import pathlib
import re
from zoneinfo import ZoneInfo

PACIFIC = ZoneInfo("America/Los_Angeles")

# ---------------------------------------------------------------- vocabulary --
# Food families: what an allergy or a dietary instruction is about. A carrier mentioning the same family
# (or a related one: a shrimp allergy is carried by "cook all seafood last") carries it.
FAMILIES: dict[str, str] = {
    "seafood": r"seafood|shell ?fish|海鲜|贝类",
    "shrimp": r"shrimp|prawn|(?<!龙)虾",
    "lobster": r"lobster|龙虾",
    "scallop": r"scallop|扇贝|带子",
    "fish": r"\bfish\b|salmon|三文鱼",
    "nut": r"peanut|tree ?nut|\bnuts?\b|花生|坚果",
    "gluten": r"gluten|wheat|celiac|麸质|小麦",
    "soy": r"\bsoy\b|soybean|大豆|黄豆",
    "dairy": r"dairy|lactose|\bmilk\b|butter|cheese|乳制品|牛奶|奶制品|黄油",
    "egg": r"\beggs?\b|鸡蛋",
    "sesame": r"sesame|芝麻",
    "mushroom": r"mushroom|蘑菇",
    "onion": r"onion|洋葱",
    "garlic": r"garlic|大蒜|蒜",
    "msg": r"\bmsg\b|味精",
    "pork": r"\bpork\b|猪肉",
    "beef": r"\bbeef\b|牛肉",
    "kosher": r"kosher|犹太|洁食",
    "halal": r"halal|清真",
    "vegan": r"vegan|vegetarian|纯素|素食|吃素|skip(?:s|ping)? meat|\bno meat\b|don'?t eat meat|meatless|不吃肉",
}
RELATED = {"shrimp": {"seafood"}, "lobster": {"seafood"}, "scallop": {"seafood"}, "fish": {"seafood"},
           "seafood": {"shrimp", "lobster", "scallop", "fish"}}

ALLERGY = r"allerg|过敏|intoleran|celiac|anaphyla|epi-?pen|can'?t eat|cannot eat|can not eat|不能吃"
ALLERGY_NEG = (r"no (?:known |food )?allerg|not allergic|no ?one (?:is )?allergic|nobody (?:is )?allergic|none reported"
               r"|没有?(?:人)?(?:什么)?(?:食物)?过敏|无过敏|不过敏|过敏[:：]?\s*(?:无|没有)")
COOK = (r"cook(?:ed)? (?:[\w'-]+ ){0,4}(?:last|first|separately|on (?:a )?separate)|(?:last|first|separately) on the grill"
        r"|clean (?:grill|griddle|surface|spatula)|cross[- ]?contam"
        r"|最后(?:做|煎|炒|烤|上)|(?:先|单独|分开|另外)(?:做|煎|炒|烤)")
AVOID = ALLERGY + r"|avoid|without|\bno\b|-free|不吃|不要|不放|别放|忌口|last|first|separate|最后|先做|单独|分开"

ARRIVAL = (r"arriv|get there|be there|show up|come (?:at|by|around|early)|set ?up (?:at|by|from|around)"
           r"|到场|到达|几点到|(?:\d|点|半)\s*到(?:场|达|门口)?|提前.{0,4}到|早.{0,3}到|到了?摆|摆台")
# A range ("7:00-7:30 PM") gives both ends; dates are stamped out first (LOGSTAMP) and never carry a colon.
TIME = re.compile(r"(?<![\d:/])(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)|(?<![\d:/])(\d{1,2}):(\d{2})(?!\d)|(?<!\d)(\d{1,2})\s*点\s*(半|\d{1,2})?", re.I)
# Log stamps in notes ("11-11 19:28", "19:3x", "2026-11-12 18:30") are when something was written, not a time asked for.
LOGSTAMP = re.compile(r"\b\d{4}-\d{2}-\d{2}[ T]\d{1,2}:\d{2}(?::\d{2})?|\b\d{1,2}[-/]\d{1,2}\s+\d{1,2}:\d{1,2}x?\b|\b\d{1,2}:\d?x\b", re.I)

GATE = (r"\bgate\b|\bgated\b|call ?box|intercom|\bbuzz|door code|gate code|门禁|大门|对讲|门口.{0,8}(?:打|呼|按|call)"
        r"|到了.{0,4}(?:打电话|call)|call (?:me|us|her|him|[a-z]+) (?:when|once|upon|on arrival|to (?:get|let) (?:in|you in))"
        r"|text (?:me|us) when (?:you )?(?:arrive|get here|are here)|call (?:on arrival|when (?:you )?(?:arrive|get here))")

OCCASIONS: dict[str, tuple[str, str]] = {
    "birthday": ("生日", r"birthday|\bb-?day\b|birth day|生日|寿宴|过寿"),
    "wedding": ("婚礼", r"wedding|after[- ]?party|reception|婚礼|婚宴|结婚"),
    "graduation": ("毕业", r"graduat|grad party|毕业"),
    "anniversary": ("周年", r"anniversary|周年"),
    "shower": ("shower", r"baby shower|bridal shower|gender reveal"),
    "bachelor": ("单身派对", r"bachelor|单身派对|hen party"),
    "retirement": ("退休", r"retire|退休"),
    "engagement": ("订婚", r"engagement party|engaged|订婚"),
    "quince": ("quince", r"quince|sweet (?:16|sixteen)"),
}

SPECT = r"spectator|just (?:to )?watch|(?:stop|come) by to watch|to watch|只看不吃|只看|观看|旁观|不用餐"
NOT_EATING = r"(?:won'?t|will not|not going to|don'?t|do not|aren'?t going to) (?:be )?eat|not eating|不吃饭|不吃东西"
PEOPLE = r"people|friends|guests|persons|\btwo\b|\bthree\b|\b\d+\b|位|个人|朋友|两个|几个"

PROTEINS: dict[str, tuple[str, str]] = {  # id -> (english, chinese)
    "salmon": ("salmon", "三文鱼"),
    "steak": ("steak", "牛排"),
    "chicken": ("chicken", "鸡"),
    "shrimp": ("shrimp", "虾"),
    "filet_mignon": ("filet(?: mignon)?", "菲力"),
    "lobster_tail": ("lobster(?: tails?)?", "龙虾"),
    "scallops": ("scallops?", "扇贝"),
    "tofu": ("tofu", "豆腐"),
}
DOUBLE = re.compile(r"double\s+(?P<en>" + "|".join(v[0] for v in PROTEINS.values()) + r")\b|(?:两份|双份)(?P<zh>" + "|".join(v[1] for v in PROTEINS.values()) + ")", re.I)

BRING: dict[str, tuple[str, str]] = {  # key -> (label, pattern)
    "rice": ("多带炒饭", r"extra (?:fried )?rice|more (?:fried )?rice|(?:多带|多做|多加|加)(?:点|些)?炒饭|炒饭(?:多带|多做|加量)"),
    "sriracha": ("sriracha", r"sriracha|是拉差"),
    "hot_sauce": ("辣椒酱", r"hot sauce|辣椒酱|辣酱"),
    "sauce": ("多带酱", r"extra (?:yum ?yum|sauce|ginger sauce)|yum ?yum sauce|(?:多带|多做)(?:点|些)?酱"),
    "speaker": ("音箱", r"speaker|音箱|蓝牙"),
    "chopsticks": ("筷子", r"chopsticks|筷子"),
    "togo": ("打包盒", r"to-?go (?:boxes|containers)|take ?out (?:boxes|containers)|打包盒|外卖盒"),
}
BRING_NEG = r"没有|不带|不能带|带不了|can'?t bring|cannot bring|don'?t have|do not have|not bring"

SITES: dict[str, tuple[str, str]] = {
    "flat": ("平地", r"flat ground|level ground|flat surface|flat area|平地|平的地"),
    "stairs": ("楼梯", r"stairs|upstairs|楼梯|楼上|上楼"),
}
# Our standard answer about the space (a grill needs a king-size bed's worth of flat ground) is not this party's.
SITE_BOILERPLATE = r"king|床大|床那么大|大床"

DIETS: dict[str, tuple[str, str]] = {
    "butter": ("不用黄油", r"no butter|without butter|butter-?free|不用黄油|不要黄油|不放黄油|别放黄油|用油不用"),
    "kosher": ("kosher", r"kosher|洁食"),
    "halal": ("清真", r"halal|清真"),
    "vegan": ("素食", r"\bvegan\b|vegetarian|纯素|素食|吃素"),
    "gluten": ("无麸质", r"gluten[- ]free|无麸质"),
    "avoid": ("忌口", r"\bno (?:garlic|onions?|msg|pork|beef|mushrooms?|sesame|spice|spicy)\b|不(?:吃|要|放)(?:蒜|洋葱|味精|猪肉|牛肉|蘑菇|辣|芝麻)|别放(?:蒜|洋葱|味精|蘑菇|辣|芝麻)"),
}

RETRACT = (r"不需要|不要了|不用了|取消了|不来了|没有了|no longer|(?:don'?t|do not|doesn'?t|does not|won'?t) need|not needed"
           r"|never ?mind|scratch that|changed (?:her|his|their) mind")
# Planning and questions ("先弄清是什么空间（有没有阳台…）", "Do you guys provide tables?", "asked arrival time"):
# what we still have to find out is not what the customer asked for - unless the note says we said yes
# ("问'只看行不行' → 回：可以看").
ASKING = (r"\?|？|有没有|是不是|要不要|能不能|可不可以|行不行|弄清|问|\bask(?:ed|s|ing)?\b|\bwhether\b|\bwondering\b|\bif (?:you|they|she|he)\b"
          r"|^\s*(?:and\s+|so\s+|also\s+)?(?:what|which|how|do|does|did|can|could|would|will|is|are)\b")
ACCEPT = r"→.{0,20}(?:可以|没问题|答应|行的|好的|\bok\b|\byes\b|\bsure\b)"


def asking(text: str) -> bool:
    return has(ASKING, text) and not has(ACCEPT, text)

# Setup: three kinds the prep list loads (lib/prep-bom.ts setupCountsOf).
SETUP_KINDS = ("tables", "linens", "utensils")
SETUP_LABEL = {"tables": "桌椅", "linens": "桌布", "utensils": "餐具"}
SETUP_WORDS = {
    "tables": r"\btables?\b|\bchairs?\b|seating|桌椅|桌子|椅子|折叠桌|长桌|圆桌",
    "linens": r"linens?|table ?cloths?|桌布",
    "utensils": r"utensils?|place ?settings?|silverware|flatware|tableware|cutlery|dinnerware|餐具|刀叉|盘具",
}
# What a deal / an extra id is (customDeal freeExtraIds, extraRates; partyExtras).
SETUP_IDS = {"tables_chairs": ("tables", "linens"), "folding_chairs": ("tables",), "folding_tables": ("tables",),
             "utensils": ("utensils",), "white_linen": ("linens",), "white_tablecloth": ("linens",)}
PROMISE = (r"(?<![-\w])free\b|on us|no charge|at no (?:extra )?(?:charge|cost)|\bincluded\b|complimentary|\bcomp(?:ed)?\b"
           r"|we(?:'ll| will)? bring|bring (?:the|our|\d)|送|免费|免掉|免了|餐具免|桌椅免|不收|包含|答应|带")
HOST = (r"provided by (?:the )?(?:host|customer|client|venue|couple)|by the host|(?:customer|host|client|they|the couple)\s+(?:is |are )?(?:provid|has |have |bring|declin)"
        r"|their own|own (?:tables|chairs|plates|utensils|setup)|uses? (?:their |her |his )?own|自备|自带|自己(?:准备|有|带|布置)|(?:主人|客人|新人|场地)(?:自己)?(?:有|自备|准备)"
        r"|declin|don'?t need|do not need|no need|not ordered|\bno (?:plates|silverware|tables|chairs|utensils|tableware|setup|rentals)\b"
        r"|不要|不用|不需要|没订|不订|venue'?s|场地的|用场地")
OPTIONAL = r"backup|back-up|备用|just in case|以防万一|if needed|需要的话|另收费|另外收费|收费|/人|每人|per (?:guest|person|head)|a guest\b|\$\d+(?:\.\d+)?\s*(?:a|per|/)\s*(?:guest|person|head)|charged|extra charge"
# Things in a clause that are not the party's setup.
NOT_SETUP = re.compile(r"high ?chairs?|wheel ?chairs?|booster|高脚椅|轮椅|儿童椅", re.I)

LEAD_TAGS = {"data", "deal", "承诺", "promised", "occasion", "owner", "policy"}
CALL_SUMMARY = "【来电小结】"
PLANNER_MARK = "Submitted from the party planner"
LOCK_NOTE = re.compile(r"^\s*⏰ WITHIN 48H OF EVENT[^\n]*(?:\n+|$)")
CHEF_AUTO = re.compile(r"^Real Hibachi prep sheet|回\s*1\s*确认|回复\s*1")


def rx(pattern: str) -> re.Pattern:
    return re.compile(pattern, re.I)


_RX: dict[str, re.Pattern] = {}


def has(pattern: str, text: str) -> bool:
    r = _RX.get(pattern)
    if r is None:
        r = _RX[pattern] = rx(pattern)
    return bool(r.search(text or ""))


# ---------------------------------------------------------------- text pieces --

def clauses(text: str) -> list[str]:
    """Sentences and their ；-parts, the units a requirement is read from. "**", tags and list marks go."""
    text = re.sub(r"\*\*", "", str(text or "")).replace("⏎", "\n")
    parts = re.split(r"[。！？!?；;\n]+|\.\s+(?=[A-Z0-9\u4e00-\u9fff(（\[\"'])|\s+\|\s+", text)
    return [p.strip(" ·-•\t") for p in parts if p and p.strip(" ·-•\t")]


def families_in(text: str) -> set[str]:
    return {k for k, p in FAMILIES.items() if has(p, text)}


def _related(fams: set[str]) -> set[str]:
    out = set(fams)
    for f in fams:
        out |= RELATED.get(f, set())
    return out


def times_in(text: str) -> set[str]:
    """'7:00', '5:30' - hours on a 12-hour clock, minutes kept; log stamps left out."""
    out = set()
    for m in TIME.finditer(LOGSTAMP.sub(" ", text or "")):
        if m.group(1):
            h, mm = int(m.group(1)), m.group(2) or "00"
        elif m.group(4):
            h, mm = int(m.group(4)), m.group(5)
        else:
            h = int(m.group(6))
            tail = m.group(7) or ""
            mm = "30" if tail == "半" else (f"{int(tail):02d}" if tail.isdigit() else "00")
        if 0 <= h <= 24 and 0 <= int(mm) < 60:
            out.add(f"{(h - 1) % 12 + 1}:{mm}")
    return out


def page_words(message: str | None) -> str:
    """What the customer wrote on the party page: the 48-hour lock line off the front, the planner summary off the back."""
    text = LOCK_NOTE.sub("", str(message or "").replace("\r\n", "\n"))
    at = text.rfind(PLANNER_MARK)
    return re.sub(r"\s+", " ", text if at < 0 else text[:at]).strip()


def lead_segments(note: str) -> list[str]:
    """The parts of a lead note under the tags the check reads; a 来电小结 note whole."""
    note = str(note or "")
    if note.lstrip().startswith(CALL_SUMMARY):
        return [note.replace(CALL_SUMMARY, "", 1)]
    out, tag, last = [], None, 0
    for m in re.finditer(r"\[([^\]\n]{1,24})\]", note):
        if tag in LEAD_TAGS:
            out.append(note[last:m.start()])
        tag, last = m.group(1).strip().lower(), m.end()
    if tag in LEAD_TAGS:
        out.append(note[last:])
    return [s.strip() for s in out if s.strip()]


def _short(text: str, n: int = 90) -> str:
    t = re.sub(r"\s+", " ", str(text or "")).strip()
    return t if len(t) <= n else t[: n - 1] + "…"


def _pt(iso: str | None) -> _dt.datetime | None:
    """A stored instant ('2026-11-12T08:17:01.001+00:00', '...Z') on the Pacific clock; None when there is none."""
    try:
        at = _dt.datetime.fromisoformat(re.sub(r"(\.\d+)", "", str(iso or "").strip()).replace("Z", "+00:00"))
    except ValueError:
        return None
    return (at if at.tzinfo else at.replace(tzinfo=_dt.timezone.utc)).astimezone(PACIFIC)


def _md(iso: str | None) -> str:
    """'11-07' from a stored timestamp, on the Pacific clock."""
    at = _pt(iso)
    return f"{at.month:02d}-{at.day:02d}" if at else ""


def _mdhm(iso: str | None) -> str:
    """'11-12 00:17' on the Pacific clock."""
    at = _pt(iso)
    return f"{at.month:02d}-{at.day:02d} {at.hour:02d}:{at.minute:02d}" if at else ""


# ---------------------------------------------------------------- the party --

def invoice_of(order: dict) -> dict:
    inv = order.get("invoice_data")
    return inv if isinstance(inv, dict) else {}


def prep_line(party: dict) -> str:
    """答应多带饭菜 (owner 2026-11-20, invoice_data.prepGuests): the prep list's 「备餐按 20 人（订单 15 人）」 - its own line
    (app/api/admin/prep prepLine), else worked out from the invoice the way lib/prep-bom.ts does. "" when there is none."""
    prep = party.get("prep") or {}
    if prep.get("prepLine"):
        return str(prep["prepLine"])
    inv = invoice_of(party.get("order") or {})
    n = inv.get("prepGuests")
    booked = int(inv.get("adultCount") or 0) + int(inv.get("childCount") or 0)
    if isinstance(n, int) and not isinstance(n, bool) and booked < n <= 500:
        return f"备餐按 {n} 人（订单 {booked} 人）"
    return ""


def setup_units(inv: dict) -> dict[str, int]:
    """Setup the prep list will load, from the invoice - lib/prep-bom.ts setupCountsOf."""
    extras = inv.get("partyExtras") if isinstance(inv.get("partyExtras"), list) else []
    line = lambda i: sum(max(0, float(e.get("qty") or 0)) for e in extras if isinstance(e, dict) and e.get("id") == i)
    tc, ut = line("tables_chairs"), line("utensils")
    if inv.get("mode") == "detailed":
        for g in inv.get("guests") or []:
            if isinstance(g, dict):
                tc += 1 if g.get("tablesChairs") else 0
                ut += 1 if g.get("utensils") else 0
    return {"tables": int(tc + line("folding_chairs") + line("folding_tables")),
            "linens": int(tc + line("white_linen") + line("white_tablecloth")),
            "utensils": int(ut)}


def loads_tables(inv: dict) -> bool:
    """The prep list loads a table (lib/prep-bom.ts orderPrep): the package's (tables_chairs, a guest row ticked for
    tables and chairs) or a bare one rented on its own (folding_tables). Chairs on their own bring no table."""
    extras = inv.get("partyExtras") if isinstance(inv.get("partyExtras"), list) else []
    line = lambda i: sum(max(0, float(e.get("qty") or 0)) for e in extras if isinstance(e, dict) and e.get("id") == i)
    rows = sum(1 for g in inv.get("guests") or [] if isinstance(g, dict) and g.get("tablesChairs")) if inv.get("mode") == "detailed" else 0
    return line("tables_chairs") + rows + line("folding_tables") > 0


# ---------------------------------------------------------------- the dispatch plan --
# orders.dispatch_plan (lib/dispatch-plan.ts, mirrored in the invoice repo): how many chefs and grills, where
# they stand, what the customer was promised. The chef sheet prints it at the top - the crew line, with the
# stations note word for word (invoice components/chef/prep-sheet.tsx, from lib/chef-sheet.ts effectivePlan) -
# and loads one grill, mat and sake per planned grill.

PLAN_SOURCES = {"rule": "按人头规则", "owner": "老板定的", "promise": "答应过客人"}
MAX_CHEFS = 6  # lib/dispatch-plan.ts
PRICING_RULES = pathlib.Path(__file__).resolve().parents[2] / "config" / "pricing-rules.ts"


@functools.lru_cache(maxsize=None)
def guests_per_chef() -> int | None:
    """GUESTS_PER_CHEF from config/pricing-rules.ts: one chef and grill per this many paid heads. None when the file
    does not say - the rule's count then prints as unknown, never guessed."""
    try:
        m = re.search(r"export const GUESTS_PER_CHEF = (\d+)", PRICING_RULES.read_text(encoding="utf-8"))
    except OSError:
        return None
    return int(m.group(1)) if m and int(m.group(1)) > 0 else None


def _count(v) -> int | None:
    """lib/dispatch-plan.ts clampCount: a whole number of chefs or grills, 1 to MAX_CHEFS; else None."""
    try:
        n = math.floor(float(v) + 0.5)
    except (TypeError, ValueError, OverflowError):
        return None
    return n if 1 <= n <= MAX_CHEFS else None


def _text(v, limit: int) -> str | None:
    return v.strip()[:limit] if isinstance(v, str) and v.strip() else None


def stored_plan(order: dict) -> dict | None:
    """orders.dispatch_plan as lib/dispatch-plan.ts normalizeDispatchPlan reads it: chefs, grills, stations_note,
    source, promise. None when the column is empty or garbage: the sheet then goes by the headcount rule."""
    raw = order.get("dispatch_plan")
    chefs = _count(raw.get("chefs")) if isinstance(raw, dict) else None
    if not chefs:
        return None
    p = raw.get("promise") if isinstance(raw.get("promise"), dict) else {}
    p_chefs = _count(p.get("chefs"))
    promise = {"chefs": p_chefs, "grills": _count(p.get("grills")) or p_chefs, "text": _text(p.get("text"), 400) or "",
               "at": _text(p.get("at"), 40), "via": p.get("via") if p.get("via") in ("sms", "email") else None} if p_chefs else None
    return {"chefs": chefs, "grills": _count(raw.get("grills")) or chefs, "stations_note": _text(raw.get("stations_note"), 200),
            "source": raw.get("source") if raw.get("source") in ("owner", "promise") else "rule", "promise": promise}


def _num(v) -> float:
    try:
        return float(v or 0)
    except (TypeError, ValueError):
        return 0.0


def sheet_heads(inv: dict) -> float:
    """Paid heads as the chef sheet counts them for the plan (invoice lib/chef-sheet.ts buildChefSheet, paidHeads):
    an adult 1, a kid 5-12 half, a free 3-4 nothing. The guest rows when there are any, else the counts less the
    little kids on the 'Little kids … ×N' line."""
    guests = [g for g in inv.get("guests") or [] if isinstance(g, dict)]
    if inv.get("mode") == "detailed" and guests:
        adults = sum(1 for g in guests if not g.get("isChild"))
        kids = sum(1 for g in guests if g.get("isChild") and not g.get("isLittle"))
    else:
        little = next((p for p in inv.get("promotions") or [] if isinstance(p, dict) and re.match(r"little kids", str(p.get("label") or ""), re.I)), None)
        m = re.search(r"×(\d+)", str((little or {}).get("label") or ""))
        adults = _num(inv.get("adultCount"))
        kids = max(0.0, _num(inv.get("childCount")) - (int(m.group(1)) if m else 0))
    return max(0.0, adults) + 0.5 * max(0.0, kids)


def rule_chefs(heads: float) -> int | None:
    """lib/dispatch-plan.ts ruleChefs: one chef and grill per GUESTS_PER_CHEF paid heads, at least one, at most
    MAX_CHEFS. None when GUESTS_PER_CHEF could not be read."""
    per = guests_per_chef()
    if not per:
        return None
    return 1 if heads <= 0 else max(1, min(MAX_CHEFS, math.ceil(heads / per)))


def effective_plan(order: dict) -> dict:
    """The plan the chef sheet prints (lib/dispatch-plan.ts effectivePlan): an owner's or a promise plan as written; a
    rule plan, or none, follows the headcount as it stands (rule_chefs) and keeps the stored stations note and
    promise. chefs / grills None: the rule could not be read. stored: the order has a plan of its own; heads / per:
    what the rule counted."""
    stored = stored_plan(order)
    if stored and stored["source"] != "rule":
        return {**stored, "stored": True, "heads": None, "per": None}
    heads = sheet_heads(invoice_of(order))
    chefs = rule_chefs(heads)
    return {"chefs": chefs, "grills": chefs, "source": "rule", "stations_note": (stored or {}).get("stations_note"),
            "promise": (stored or {}).get("promise"), "stored": bool(stored), "heads": heads, "per": guests_per_chef()}


# ---------------------------------------------------------------- outsourced --
# 外包 (owner 2026-11-18, lib/outsourced.ts): a party sold to a partner company that runs it. Marked on
# orders.dispatch_plan.outsourced = {at, by, invoice_token, note?}. We send no chef and no prep sheet, so "no chef" and
# "no sheet" are not gaps on it; every other check stays. The partner gets the invoice, not the sheet: a link that
# never expires and always opens the order as it stands (www.realhibachi.com/p/invoice/<token>).

PARTNER_INVOICE_BASE = "https://www.realhibachi.com/p/invoice"  # lib/outsourced.ts PARTNER_INVOICE_BASE
_INVOICE_TOKEN = re.compile(r"[A-Za-z0-9_-]{32}")


def outsourced_mark(order: dict) -> dict | None:
    """The outsourced mark as lib/outsourced.ts outsourcedMark reads it: {at, by, invoice_token, note}; None = ours (直营)."""
    raw = order.get("dispatch_plan") if isinstance(order, dict) else None
    mark = raw.get("outsourced") if isinstance(raw, dict) else None
    if mark is True:
        return {"at": None, "by": None, "invoice_token": None, "note": None}
    if not isinstance(mark, dict):
        return None
    token = mark.get("invoice_token")
    return {"at": _text(mark.get("at"), 40), "by": _text(mark.get("by"), 80),
            "invoice_token": token if isinstance(token, str) and _INVOICE_TOKEN.fullmatch(token) else None, "note": _text(mark.get("note"), 200)}


def partner_invoice_url(order: dict) -> str | None:
    """The partner's invoice link of an outsourced order; None when it is ours or the mark has no token yet."""
    mark = outsourced_mark(order)
    return f"{PARTNER_INVOICE_BASE}/{mark['invoice_token']}" if mark and mark["invoice_token"] else None


def first_name(name: str | None) -> str:
    n = str(name or "").strip()
    return "" if not n or re.search(r"\d{3}", n) else n.split()[0]


def city_of(address: str | None) -> str:
    """'Palm Springs' from '1 Test Way, Palm Springs, CA 92262' - and from '..., Los Angeles CA 90049'."""
    parts = [p.strip() for p in str(address or "").split(",") if p.strip()]
    if len(parts) >= 2 and re.fullmatch(r"(?i)usa?|united states", parts[-1]):
        parts.pop()
    if len(parts) >= 2 and re.match(r"[A-Z]{2}\b", parts[-1]):
        return parts[-2]
    last = parts[-1] if parts else ""
    m = re.match(r"^(.+?)\s+[A-Z]{2}\s*\d{5}(?:-\d{4})?$", last)
    return m.group(1) if m else last


def carriers(party: dict) -> list[dict]:
    """What the chef has in front of him: the order's notes (customer-visible), the party-page notes printed on his
    link, each guest's allergy and note, the 备货备注. kind 'allergy' = a guest's allergy field."""
    order = party["order"]
    inv = invoice_of(order)
    c = inv.get("contactInfo") if isinstance(inv.get("contactInfo"), dict) else {}
    out = []
    for piece in str(c.get("specialNotes") or "").split(" | "):
        if piece.strip():
            out.append({"kind": "notes", "text": piece.strip()})
    for n in inv.get("customerNotes") or []:
        text = n.get("text") if isinstance(n, dict) else n if isinstance(n, str) else ""
        if str(text or "").strip():
            out.append({"kind": "page", "text": str(text).strip()})
    for g in inv.get("guests") or []:
        if not isinstance(g, dict):
            continue
        if str(g.get("foodAllergy") or "").strip():
            out.append({"kind": "allergy", "text": f"{g.get('name') or ''}: {g['foodAllergy']}".strip()})
        if str(g.get("note") or "").strip():
            out.append({"kind": "guest", "text": f"{g.get('name') or ''}: {g['note']}".strip()})
    note = str(order.get("prep_note") or "").strip()
    if note:
        out.append({"kind": "prep_note", "text": note})
    return out


def sources(party: dict) -> list[dict]:
    """Everywhere else a requirement can sit, one entry per clause: {src, label, at, text, out?}."""
    order = party["order"]
    out: list[dict] = []

    def add(src: str, label: str, at: str | None, text: str, **extra) -> None:
        for cl in clauses(text):
            out.append({"src": src, "label": label, "at": at, "text": cl, **extra})

    add("internal", "内部备注", None, order.get("internal_notes") or "")
    for n in party.get("lead_notes") or []:
        note = n.get("note") or ""
        kind = "来电小结" if str(note).lstrip().startswith(CALL_SUMMARY) else "线索备注"
        for seg in lead_segments(note):
            add("lead", f"{kind} {_md(n.get('at'))}".strip(), n.get("at"), seg)
    for r in party.get("requests") or []:
        add("page", f"派对页留言 {_md(r.get('at'))}".strip(), r.get("at"), page_words(r.get("message")))
    for m in party.get("customer_sms") or []:
        inbound = m.get("direction") == "inbound"
        add("sms_in" if inbound else "sms_out", f"{'客人短信' if inbound else '我们发给客人'} {_md(m.get('at'))}".strip(), m.get("at"), m.get("body") or "")
    for n in party.get("sheet_notes") or []:
        add("chef", f"发备料单附言 {_md(n.get('at'))}{(' · ' + n['chef']) if n.get('chef') else ''}", n.get("at"), n.get("note") or "")
    for m in party.get("chef_sms") or []:
        if m.get("auto"):
            continue  # the system's own sheet texts repeat the sheet: not a requirement found elsewhere
        add("chef", f"发给师傅的短信 {_md(m.get('at'))}{(' · ' + m['chef']) if m.get('chef') else ''}", m.get("at"), m.get("body") or "")
    deal = invoice_of(order).get("customDeal")
    if isinstance(deal, dict) and str(deal.get("note") or "").strip():
        add("deal", "优惠约定备注", None, str(deal["note"]))
    return out


# ---------------------------------------------------------------- the check --

def _carried_family(fams: set[str], carr: list[dict]) -> bool:
    """A carrier names this food with an avoid / allergy / cook-order word - or is a guest's allergy field."""
    want = _related(fams)
    for c in carr:
        got = families_in(c["text"])
        if not (got & want):
            continue
        if c["kind"] == "allergy" or has(AVOID, c["text"]):
            return True
    return False


def _retracted(keys: list[str], everything: list[dict], own: str) -> bool:
    """Taken back somewhere: a clause naming the same thing with 不需要 / no longer / never mind."""
    for s in everything:
        if s["text"] == own or not has(RETRACT, s["text"]):
            continue
        if any(has(k, s["text"]) for k in keys):
            return True
    return False


def _gap(sev: str, kind: str, title: str, fix: str, evidence: list[dict]) -> dict:
    seen, ev = set(), []
    for e in evidence:
        key = (e["label"], e["text"])
        if key not in seen:
            seen.add(key)
            ev.append(e)
    return {"severity": sev, "kind": kind, "title": title, "fix": fix, "evidence": ev}


def setup_gaps(party: dict, srcs: list[dict], carr: list[dict]) -> list[dict]:
    """Setup that was promised and is not on the invoice (blocking)."""
    order = party["order"]
    inv = invoice_of(order)
    units = setup_units(inv)
    promised: dict[str, list[dict]] = {k: [] for k in SETUP_KINDS}
    host: set[str] = set()
    sel = order.get("setup_selection")
    if isinstance(sel, dict) and int(sel.get("guests") or 0) > 0:
        kinds = ("tables", "linens", "utensils") if sel.get("pkg") == "full" else ("tables", "linens")
        bits = ["全套" if sel.get("pkg") == "full" else "只要桌椅", str(sel.get("cloth") or ""), f"{sel.get('guests')} 位"]
        for k in kinds:
            promised[k].append({"label": f"租赁页选了 {_md(sel.get('chosenAt'))}".strip(), "text": " · ".join(b for b in bits if b)})
    deal = inv.get("customDeal") if isinstance(inv.get("customDeal"), dict) else {}
    for field, word in (("freeExtraIds", "送"), ("extraRates", "约定价")):
        raw = deal.get(field)
        ids = list(raw) if isinstance(raw, list) else list(raw.keys()) if isinstance(raw, dict) else []
        for i in ids:
            for k in SETUP_IDS.get(str(i), ()):
                promised[k].append({"label": "优惠约定", "text": f"{word} {i}"})
    named = {"notes": "订单备注", "prep_note": "备货备注", "page": "派对页留言"}
    for s in [*srcs, *({"src": "carrier", "label": named[c["kind"]], "at": None, "text": cl} for c in carr if c["kind"] in named for cl in clauses(c["text"]))]:
        text = NOT_SETUP.sub(" ", s["text"])
        kinds = [k for k in SETUP_KINDS if has(SETUP_WORDS[k], text)]
        if not kinds:
            continue
        if has(HOST, text):
            host.update(kinds)
            continue
        if s["src"] in ("sms_in",) or has(OPTIONAL, text) or not has(PROMISE, text):
            continue
        if s["src"] == "sms_out" and not has(r"\bfree\b|on us|no charge|included|complimentary|we(?:'ll| will) bring", text):
            continue
        for k in kinds:
            promised[k].append(s)
    missing = [k for k in SETUP_KINDS if promised[k] and k not in host and units[k] <= 0]
    if not missing:
        return []
    words = "、".join(SETUP_LABEL[k] for k in missing)
    ev = [e for k in missing for e in promised[k]]
    return [_gap("block", "setup", f"答应的{words}，发票上一件都没有：备货清单不装车",
                 "写成订单行，备货清单才装车：送的用 --deal-free tables_chairs,utensils，收钱的用 --add-extra；"
                 "逐人名单的单要每位客人勾上桌椅、餐具（--guests-file）", ev)]


def allergy_gaps(srcs: list[dict], carr: list[dict], everything: list[dict]) -> list[dict]:
    """An allergy or a cook-it-last instruction the chef cannot see. Blocking from the internal notes and the
    lead's notes (the owner's rule); from a text, the party page or what we told the chef, a warning."""
    block, warn = [], []
    for s in srcs:
        text = s["text"]
        if s["src"] == "sms_out" or has(ALLERGY_NEG, text) or has(RETRACT, text):
            continue
        allergy, cook = has(ALLERGY, text), has(COOK, text)
        if not (allergy or cook):
            continue
        fams = families_in(text)
        keys = [FAMILIES[f] for f in fams] or [ALLERGY]
        if _retracted(keys, everything, text):
            continue
        if fams:
            if _carried_family(fams, carr):
                continue
        elif any(c["kind"] == "allergy" or has(ALLERGY + "|" + COOK, c["text"]) for c in carr):
            continue
        (block if s["src"] in ("internal", "lead") else warn).append(s)
    out = []
    if block:
        out.append(_gap("block", "allergy", "过敏 / 先做后做的交代，师傅看不到",
                        "写进订单备注（desk order set --notes-file F，师傅链接「派对前必看」印出来）或那位客人的过敏栏", block))
    if warn:
        out.append(_gap("warn", "allergy", "过敏只在短信 / 派对页 / 发给师傅的话里",
                        "问清楚是谁、对什么过敏，写进那位客人的过敏栏或订单备注", warn))
    return out


def _reads(s: dict) -> bool:
    """A clause that can state a customer's requirement: not our own sales texts (only promises count there)."""
    return s["src"] != "sms_out"


def warn_gaps(party: dict, srcs: list[dict], carr: list[dict], everything: list[dict]) -> list[dict]:
    order = party["order"]
    carrier_text = "\n".join(c["text"] for c in carr)
    prep = party.get("prep") or {}
    prep_text = carrier_text + "\n" + str(prep.get("proteinLine") or "") + "\n" + str(prep.get("extrasLine") or "")
    gaps: list[dict] = []

    # arrival time: the order says when the chef gets there, or it does not
    guests_only = lambda t: has(r"客人|宾客|\bguests?\b|everyone|\bpeople\b", t) and not has(r"师傅|厨师|\bchefs?\b|\bteam\b|\bcooks?\b|\bwe\b|我们", t)
    if not any(has(ARRIVAL, cl) and times_in(cl) for c in carr for cl in clauses(c["text"])):
        hits = [s for s in srcs if _reads(s) and has(ARRIVAL, s["text"]) and times_in(s["text"]) and not guests_only(s["text"]) and not asking(s["text"])]
        if hits:
            gaps.append(_gap("warn", "arrival", "几点到场：订单备注里没有", "写进订单备注（几点到、几点开始）", hits))

    # gate / call on arrival
    if not any(has(GATE, c["text"]) for c in carr):
        hits = [s for s in srcs if _reads(s) and has(GATE, s["text"]) and not asking(s["text"])]
        if hits:
            gaps.append(_gap("warn", "gate", "门禁 / 到了打电话：订单备注里没有", "写进订单备注（谁的电话、怎么进门）", hits))

    # the occasion
    for key, (label, pat) in OCCASIONS.items():
        if has(pat, carrier_text):
            continue
        hits = [s for s in srcs if _reads(s) and has(pat, s["text"]) and not asking(s["text"]) and not has(RETRACT + r"|写错|更正|correction", s["text"])]
        if hits:
            gaps.append(_gap("warn", f"occasion:{key}", f"场合（{label}）：订单备注里没有", "写进订单备注（惊喜的别写客人看得到的地方，写备货备注）", hits))

    # spectators who do not eat
    spect = lambda t: has(SPECT, t) or (has(NOT_EATING, t) and has(PEOPLE, t))
    if not any(spect(c["text"]) for c in carr):
        hits = [s for s in srcs if _reads(s) and spect(s["text"]) and not has(RETRACT, s["text"]) and not asking(s["text"])]
        if hits:
            gaps.append(_gap("warn", "spectators", "有人只看不吃：订单备注里没有", "写进订单备注（几位、坐哪），人数照订单", hits))

    # "double X" for a guest whose row has X once: the prep list counts the row. The guest is the name
    # written just before "double" in the same sentence ("Alon: double salmon", "Alon 两份三文鱼").
    guests = [g for g in invoice_of(order).get("guests") or [] if isinstance(g, dict) and len(str(g.get("name") or "").strip()) >= 2]
    flagged: set[str] = set()
    carrier_clauses = [{"src": "carrier", "label": "订单备注" if c["kind"] == "notes" else "备货备注" if c["kind"] == "prep_note" else "派对页留言",
                        "at": None, "text": cl} for c in carr if c["kind"] in ("notes", "prep_note", "page", "guest") for cl in clauses(c["text"])]
    for s in [*carrier_clauses, *srcs]:
        if not _reads(s):
            continue
        for m in DOUBLE.finditer(s["text"]):
            word = (m.group("en") or m.group("zh") or "").lower()
            pid = next((k for k, (en, zh) in PROTEINS.items() if re.fullmatch(en, word, re.I) or word == zh), None)
            if not pid:
                continue
            before = s["text"][: m.start()]
            named = []
            for g in guests:
                name = str(g["name"]).strip()
                hits = [h.end() for h in re.finditer(r"(?<![A-Za-z])" + re.escape(name) + r"(?![A-Za-z])", before, re.I)]
                if hits and m.start() - hits[-1] <= 40:
                    named.append((hits[-1], g))
            if not named:
                continue
            g = max(named, key=lambda x: x[0])[1]
            name = str(g["name"]).strip()
            picks = [str(p) for p in g.get("proteins") or []]
            if picks.count(pid) == 1 and f"{name}:{pid}" not in flagged:
                flagged.add(f"{name}:{pid}")
                gaps.append(_gap("warn", "double", f"{name} 要双份 {pid}，名单上他那行只有 1 份：备货清单少算 1 份",
                                 f"把 {name} 那行改成两份 {pid}（desk order plan 看派对页，--guests-file 改）", [s]))

    # bring-items we promised
    for key, (label, pat) in BRING.items():
        if has(pat, prep_text):
            continue
        # Extra rice is on the order as a number since 2026-11-20 (--prep-guests): the prep list sizes the rice for it.
        if key == "rice" and prep_line(party):
            continue
        hits = [s for s in srcs if s["src"] not in ("sms_in", "sms_out") and has(pat, s["text"]) and not has(BRING_NEG, s["text"]) and not asking(s["text"])]
        if hits:
            gaps.append(_gap("warn", f"bring:{key}", f"答应带的（{label}）：备货清单和备货备注里没有", "写进备货备注（desk order set --prep-note-file F）", hits))

    # site notes: one line for the place, whatever it says (flat ground, grass, stairs...)
    labels, site_hits = [], []
    for key, (label, pat) in SITES.items():
        if has(pat, carrier_text):
            continue
        hits = [s for s in srcs if _reads(s) and has(pat, s["text"]) and not asking(s["text"]) and not has(SITE_BOILERPLATE, s["text"])]
        if hits:
            labels.append(label)
            site_hits += hits
    if site_hits:
        gaps.append(_gap("warn", "site", f"场地（{'、'.join(labels)}）：订单备注里没有", "写进订单备注（灶放哪、地面、上下楼）", site_hits))

    # dietary instructions
    for key, (label, pat) in DIETS.items():
        hits = []
        for s in srcs:
            if not _reads(s) or not has(pat, s["text"]) or has(RETRACT, s["text"]) or asking(s["text"]):
                continue
            fams = families_in(s["text"]) or ({"dairy"} if key == "butter" else {key} if key in FAMILIES else set())
            if fams and _carried_family(fams, carr):
                continue
            if not fams and has(pat, carrier_text):
                continue
            if _retracted([pat] + [FAMILIES[f] for f in fams if f in FAMILIES], everything, s["text"]):
                continue
            hits.append(s)
        if hits:
            gaps.append(_gap("warn", f"diet:{key}", f"忌口 / 做法（{label}）：订单备注里没有", "写进订单备注或那位客人的过敏栏", hits))
    return gaps


# A stations note that puts the guests at tables or in U shapes ("10 six-foot tables ... set up as two U shapes").
STATION_TABLES = r"\btables?\b|\bu[\s-]?shaped?s?\b|桌|U\s*(?:形|型|字)"


def crew_gaps(party: dict) -> list[dict]:
    """The dispatch plan against the order (warnings). A stations note that seats the guests at tables or in U shapes
    while the order loads no table: the sheet prints the note word for word (Whitney RH-20261007-9434, 11-14: "10
    six-foot tables ... two U shapes" captured from an 11-04 email, then the order went to 30 chairs and no tables).
    More cooks on the order than the plan has chefs: the sheet loads the plan's grills, and lib/dispatch-plan.ts
    lintStaffing only flags too few."""
    order = party["order"]
    plan = effective_plan(order)
    no = order.get("order_no") or "<单号>"
    out = []
    note = plan["stations_note"] or ""
    if note and has(STATION_TABLES, note) and not has(HOST, note) and not loads_tables(invoice_of(order)):
        out.append(_gap("warn", "stations", "派工站位写着桌子 / U 形，订单上没有桌子：备料单最上面会照印这句",
                        f"站位改成现在的摆法（desk order set {no} --stations \"…\"，--stations \"\" 清掉）；真要带桌子，加订单行（--add-extra folding_tables=N 或桌椅套餐）",
                        [{"src": "plan", "label": "派工站位", "at": None, "text": note}]))
    cooks = [str(t.get("name") or "?") for t in party.get("team") or [] if t.get("role") != "assistant_chef"]
    if plan["chefs"] and len(cooks) > plan["chefs"]:
        out.append(_gap("warn", "crew", f"派了 {len(cooks)} 位主厨，派工计划只有 {plan['chefs']} 位师傅 / {plan['grills']} 台灶：备料单只装 {plan['grills']} 台灶",
                        f"都要上灶就改计划（desk order set {no} --chefs {len(cooks)} --grills {len(cooks)}）；只是来帮忙的，在工作台派工里改成帮手",
                        [{"src": "plan", "label": "派工", "at": None,
                          "text": f"主厨 {'、'.join(cooks)}；计划 {plan['chefs']} 位师傅 / {plan['grills']} 台灶（{PLAN_SOURCES.get(plan['source'], plan['source'])}）"}]))
    return out


def gaps_of(party: dict, *, blocking_only: bool = False) -> list[dict]:
    """Every gap for one party, blocking first. blocking_only: the two the owner made blocking, from the order's
    own notes, the lead's and the deal (what `desk order show` reads)."""
    carr = carriers(party)
    srcs = sources(party)
    everything = srcs + [{"src": "carrier", "label": "", "at": None, "text": cl} for c in carr for cl in clauses(c["text"])]
    out = setup_gaps(party, srcs, carr) + allergy_gaps(srcs, carr, everything)
    if blocking_only:
        return [g for g in out if g["severity"] == "block"]
    out += warn_gaps(party, srcs, carr, everything) + crew_gaps(party)
    return sorted(out, key=lambda g: 0 if g["severity"] == "block" else 1)


# ---------------------------------------------------------------- the sheet --

def opened_since_sent(link: dict) -> bool:
    """He opened this link since it last went to him: his newest open (last_opened_at, else first_opened_at) at
    or after sent_at. Since 2026-11-13 a chef keeps one link per party, updated in place and texted again with
    sent_at moved on, so first_opened_at is his first open ever; a row with no sent_at counts any open."""
    opened = _pt(link.get("last_opened_at") or link.get("first_opened_at"))
    if not opened:
        return False
    sent = _pt(link.get("sent_at"))
    return sent is None or opened >= sent


def sheet_lines(party: dict, today: str | None = None) -> list[tuple[str, str]]:
    """Per chef on the party: what he holds and whether he confirmed the last change. (mark, line).
    `today` = the Pacific date the check runs on: before the party day a sheet not sent yet is the day-before
    send's to do (·); on the day it is !!. A helper's line is never !!: he works from the lead's sheet.
    A chef has one link per party since 2026-11-13 and it always opens the order as it stands: stale = the
    order changed and he has not been told yet (the change is on top of his page, the text follows) - a !
    to watch, not a sheet he is missing. Until then a stale link was void."""
    out = []
    links = party.get("links") or []
    notices = party.get("notices") or []
    if outsourced_mark(party["order"]):
        # 外包: nobody of ours goes and no sheet is due - not "还没派师傅". What is left to watch: a sheet that went out
        # before the party was outsourced (the day map's 通知改动 tells him he does not have to go), and a name still on it.
        on = {t.get("id") for t in party.get("team") or []}
        held = {l.get("staff_member_id") for l in links if l.get("staff_member_id") and l.get("staff_member_id") not in on and not l.get("revoked_at")
                and (l.get("sent_via") in ("twilio", "manual") or l.get("first_opened_at"))}
        link = partner_invoice_url(party["order"])
        out.append(("· ", "外包（合作公司做）：我们不派师傅、不发备料单" + (f"；给合作方的 invoice {link}" if link else "")))
        if held:
            out.append(("! ", f"外包前发出去的备料单还有 {len(held)} 份没作废：日地图「通知改动」里告诉他不用去"))
        if party.get("team"):
            out.append(("! ", f"标了外包，名单上还有 {'、'.join(str(t.get('name') or '?') for t in party['team'])}：工作台里把人拿掉，或者改回直营"))
        return out
    today = today or _dt.datetime.now(PACIFIC).date().isoformat()
    party_day = str(party["order"].get("event_start") or "")[:10]
    early = bool(party_day) and party_day > today
    for chef in party.get("team") or []:
        sid = chef["id"]
        live = [l for l in links if l.get("staff_member_id") == sid and not l.get("revoked_at")]
        is_helper = chef.get("role") == "assistant_chef"
        helper = " (帮手)" if is_helper else ""
        bad = "· " if is_helper else "!!"
        warn = "· " if is_helper else "! "
        reached = [l for l in live if l.get("sent_via") in ("twilio", "manual") or l.get("first_opened_at")]
        last = next((n for n in notices if n.get("staff_member_id") == sid), None)
        if not live:
            out.append(("· " if early else bad, f"{chef['name']}{helper}：" + ("还没发备料单（前一天统一发）" if early else "手里没有备料单")))
            continue
        if not reached:
            out.append((bad, f"{chef['name']}{helper}：备料单短信没发到，他手里没有能打开的"))
            continue
        link = reached[0]
        bits, mark = [], "✓"
        if link.get("stale"):
            mark = warn
            bits.append("订单改过，还没通知到他（链接不变，改动在最上面）" + (f"（{_mdhm(link['change_pending_since'])} 起在等）" if link.get("change_pending_since") else ""))
        else:
            bits.append("最新版")
            if link.get("change_pending_since"):
                mark = warn
                bits.append("刚有改动，10 分钟后系统核对，要通知的会发短信（链接不变）")
        bits.append("已打开" if opened_since_sent(link) else "还没打开")
        if last:
            when = _mdhm(last.get("sent_at"))
            if not str(last.get("sms_sid") or "").strip():
                mark = bad
                bits.append(f"改单短信 {when} 没发出去")
            elif last.get("acked_at"):
                bits.append(f"改单通知 {when} 已回 1")
            else:
                mark = mark if mark.strip() in ("!!", "·") else "! "
                bits.append(f"改单通知 {when} 还没回 1")
        out.append((mark, f"{chef['name']}{helper}：" + "，".join(bits)))
    if not party.get("team"):
        out.append(("· " if early else "!!", "还没派师傅"))
    return out


# ---------------------------------------------------------------- printing --

def plan_lines(order: dict, cooks: list[str] | None, helpers: list[str] | None = None) -> list[str]:
    """The crew line at the top of the chef sheet as desk prints it (`desk order show`, the reviewer's 【二】): chefs /
    grills and why, who cooks and who helps, the stations note the sheet prints word for word, the promise the plan
    carries. cooks / helpers: the names on the order; None = the assignments were not read.
    An outsourced party (外包): who runs it and the partner's invoice link instead of chefs and grills; what the customer
    was promised (stations note, the promise) still prints - the partner has to keep it."""
    plan = effective_plan(order)
    mark = outsourced_mark(order)
    if mark:
        link = partner_invoice_url(order)
        out = ["   派工: 外包（合作公司做，我们不派师傅）" + (f" · {mark['note']}" if mark.get("note") else "")
               + (f" · 名单上还有 {' + '.join([*(cooks or []), *(helpers or [])])}" if cooks or helpers else ""),
               f"         给合作方的 invoice（派对后两周内能打开，打开就是订单现在的样子）: {link or '还没有链接（在日地图上改回直营、再标一次外包会生成）'}"]
        if plan["stations_note"]:
            out.append(f"         站位（答应过客人的摆法）: {plan['stations_note']}")
        pr = plan["promise"]
        if pr:
            via = {"sms": " 短信", "email": " 邮件"}.get(pr["via"] or "", "")
            said = re.sub(r"\s+", " ", pr["text"]).strip()
            out.append(f"         答应过: {pr['chefs']} 厨 / {pr['grills']} 灶 · {_mdhm(pr['at']) or '?'}{via} \"{said}\"")
        return out
    shown = lambda v: "?" if v is None else v
    why = PLAN_SOURCES.get(plan["source"], plan["source"])
    if plan["source"] == "rule":
        rule = f"付费 {plan['heads']:g} 人，{plan['per']} 人一位" if plan["per"] else "读不到 config/pricing-rules.ts 的 GUESTS_PER_CHEF"
        why += f"（{rule}{'' if plan['stored'] else '；没有单独的计划'}）"
    head = f"   派工: {shown(plan['chefs'])} 位师傅 / {shown(plan['grills'])} 台灶 · {why}"
    if cooks is not None:
        head += f" · 已派 {' + '.join(cooks) if cooks else '还没派'}" + (f" · 帮手 {', '.join(helpers)}" if helpers else "")
    out = [head]
    if plan["stations_note"]:
        out.append(f"         站位（备料单原样印出）: {plan['stations_note']}")
    pr = plan["promise"]
    if pr:
        via = {"sms": " 短信", "email": " 邮件"}.get(pr["via"] or "", "")
        said = re.sub(r"\s+", " ", pr["text"]).strip()
        out.append(f"         答应过: {pr['chefs']} 厨 / {pr['grills']} 灶 · {_mdhm(pr['at']) or '?'}{via} \"{said}\"")
    if cooks is not None and plan["chefs"]:
        if 0 < len(cooks) < plan["chefs"]:
            out.append(f"         ! 计划 {plan['chefs']} 位师傅，只派了 {len(cooks)} 位")
        elif len(cooks) > plan["chefs"]:
            out.append(f"         ! 派了 {len(cooks)} 位主厨，计划只有 {plan['chefs']} 位师傅 / {plan['grills']} 台灶：备料单只装 {plan['grills']} 台灶")
    return out


def render(party: dict, gaps: list[dict], today: str | None = None) -> list[str]:
    order = party["order"]
    inv = invoice_of(order)
    c = inv.get("contactInfo") if isinstance(inv.get("contactInfo"), dict) else {}
    prep = party.get("prep") or {}
    when = prep.get("timeLabel") or str(order.get("event_start") or "")[11:16]  # wall time stored as UTC - never convert
    out_mark = outsourced_mark(order)
    chefs = "、".join(t["name"] for t in party.get("team") or [] if t.get("role") != "assistant_chef") or ("外包（合作公司做）" if out_mark else "未派")
    adults = prep.get("adults", inv.get("adultCount", "?"))
    kids = prep.get("kids", inv.get("childCount") or 0)
    heads = f"{adults} 大" + (f" {kids} 小" if kids else "")
    lines = ["━" * 78,
             f"{order.get('order_no')} · {when or '时间未定'} · {city_of(order.get('event_address')) or '-'} · {first_name(order.get('customer_name')) or '-'} · {heads} · 师傅 {chefs}"]
    if out_mark:
        lines.append("   备货：外包 · 不备货（合作公司做）")
    else:
        protein = prep.get("proteinLine") if prep.get("menuKnown") else "菜单未定"
        lines.append(f"   备货：{protein or '-'}" + (f" | {prep['extrasLine']}" if prep.get("extrasLine") else ""))
        if prep_line(party):
            lines.append(f"   {prep_line(party)}：炒饭、蔬菜、沙拉按这个人数备")
    cooler = prep.get("cooler") if isinstance(prep.get("cooler"), dict) else {}
    lines.append(f"   备货备注：{(cooler.get('note') if cooler else None) or order.get('prep_note') or '(空)'}")
    lines.append(f"   订单备注（客人看得到）：{str(c.get('specialNotes') or '').strip() or '(空)'}")
    for n in inv.get("customerNotes") or []:
        text = n.get("text") if isinstance(n, dict) else n
        if str(text or "").strip():
            lines.append(f"   派对页留言：{_short(text, 140)}")
    allergies = [f"{g.get('name') or '-'}: {g['foodAllergy']}" for g in inv.get("guests") or [] if isinstance(g, dict) and str(g.get("foodAllergy") or "").strip()]
    lines.append(f"   过敏：{'；'.join(allergies) if allergies else '无'}")
    for mark, line in sheet_lines(party, today):
        lines.append(f"   备料单 {mark} {line}")
    block = sum(1 for g in gaps if g["severity"] == "block")
    if not gaps:
        lines.append("   ✓ 缺项：无")
        return lines
    lines.append(f"   ⚠ 缺项 {len(gaps)}" + (f"（{block} 项要先补）" if block else "") + "：")
    for g in gaps:
        lines.append(f"     {'!!' if g['severity'] == 'block' else '! '} {g['title']}")
        for e in g["evidence"][:3]:
            lines.append(f"        {e['label']}：{_short(e['text'])}")
        if len(g["evidence"]) > 3:
            lines.append(f"        …另有 {len(g['evidence']) - 3} 处")
        lines.append(f"        改法：{g['fix']}")
    return lines


# ---------------------------------------------------------------- loading --
# Read-only: GET /api/admin/prep and /api/admin/sms-thread?phone= (no lead id, so nothing is synced), and
# direct database reads. `site_get(path, params)` and `db_get(path)` are desk's.

ORDER_COLUMNS = "id,order_no,customer_name,customer_phone,event_start,event_address,order_status,internal_notes,prep_note,setup_selection,source_metadata,invoice_data,dispatch_plan"


def _q(ids) -> str:
    return ",".join(sorted({str(i) for i in ids if i}))


def _safe(fn, default):
    try:
        out = fn()
        return out if isinstance(out, type(default)) else default
    except Exception:  # noqa: BLE001 - a source that cannot be read is skipped, the rest still print
        return default


# Which of our texts to a chef are about a party: only what that party alone has (owner 2026-11-16). The city used to be
# enough, so every text Steven got in the five days before Jacob Park's lunch in Corona (Tue 11/17, RH-20261029-0692) that
# said "Corona" was read as Jacob's - George's prep sheet, change notice and evening reminder for his 40 in Corona on Fri
# 11/13 (RH-20261004-3574) - and the review raised George's shrimp allergy on Jacob's party.
ORDER_NO = re.compile(r"RH-\d{8}-\d{4}")
CHEF_LINK = re.compile(r"/chef/([A-Za-z0-9_-]{8,})")  # invoice.realhibachi.com/chef/<token>: every prep sheet and change text
MONTHS = ("January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December")
WEEKDAY = re.compile(r"(?:周|星期|礼拜)([一二三四五六日天])|\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b", re.I)
WEEKDAY_NO = {"一": 0, "二": 1, "三": 2, "四": 3, "五": 4, "六": 5, "日": 6, "天": 6, "monday": 0, "tuesday": 1, "wednesday": 2,
              "thursday": 3, "friday": 4, "saturday": 5, "sunday": 6}
# Today / tonight, tomorrow: counted from the day the text went out. Not 后天: "5 点前后天就黑了" (Gary 11-10, Long Beach)
# is "dark around 5", and it read as Verlener's party two days later.
DAYS_AHEAD = (r"今天|今晚|今早|今日|\btoday\b|\btonight\b|\bthis (?:morning|afternoon|evening)\b",
              r"明天|明晚|明早|明日|\btomorrow\b")
ARRIVE_BEFORE_MIN = 150  # a time up to 2.5 hours before the start is when the chefs get there: it fits the party


def _written(name: str, text: str) -> bool:
    """A name as a text writes it: whole and capitalized - 'Will' or 'WILL', not the 'will' of 'Blu will bring'."""
    return len(name) >= 2 and bool(re.search(r"(?<![A-Za-z])" + re.escape(name[0].upper()) + "(?i:" + re.escape(name[1:]) + r")(?![A-Za-z])", text))


def _names_date(text: str, day: _dt.date) -> bool:
    """The text writes this day's date: Nov 17, November 17th, 11/17, 11月17日, 17号."""
    m, d, month = day.month, day.day, MONTHS[day.month - 1]
    return bool(re.search(rf"(?<!\d){m}月{d}(?:日|号)?(?!\d)|(?<!\d){m}/{d}(?!\d)|(?<![\d月]){d}号|\b(?:{month[:3]}|{month})\.? {d}(?:st|nd|rd|th)?\b",
                          text, re.I))


def _says_day(text: str, day: _dt.date, sent: _dt.date | None) -> bool:
    """The text says this day the way people talk, counted from the day it went out (sent, Pacific): today / tonight /
    tomorrow, or its weekday (周二, 星期二, Tuesday) in the week ahead."""
    ahead = (day - sent).days if sent else -1
    if not 0 <= ahead <= 6:
        return False
    if ahead < len(DAYS_AHEAD) and has(DAYS_AHEAD[ahead], text):
        return True
    return any(WEEKDAY_NO[(w.group(1) or w.group(2)).lower()] == day.weekday() for w in WEEKDAY.finditer(text))


def _time_fits(text: str, start: str, *, none: bool) -> bool:
    """A time the text names fits a party starting at start (the stored wall clock, '20:00'): the start itself or an
    arrival up to 2.5 hours before it, on the 12-hour clock times_in reads ('8 点', '8:00 PM', '7:30'). none: the
    answer when the text names no time."""
    times = times_in(text)
    m = re.fullmatch(r"(\d{1,2}):(\d{2})", start or "")
    if not times or not m:
        return none
    at = int(m.group(1)) % 12 * 60 + int(m.group(2))
    return any((at - int(h) % 12 * 60 - int(mm)) % 720 <= ARRIVE_BEFORE_MIN for h, mm in (t.split(":") for t in times))


def _mentions_party(body: str, order: dict, date: str, *, tokens: set[str] | None = None, sent: _dt.date | None = None,
                    chef: str | None = None) -> bool:
    """A text we sent a chef is about this party when it names what only this party has, asked in this order:
      - an order number: this order's - or only others', and then it is not
      - a prep-sheet link: one of this order's (tokens) - or only others', and then it is not; with no tokens (no link
        sent for this order, or none read) the link decides nothing
      - the customer's name as a text writes it ('George'); the first name alone not when it is the chef's own ('Steven，…')
      - this party's date written out (_names_date), unless the only times it names do not fit the party (_time_fits)
        and it does not name the city either: "11/17 6 点那场" is not the noon party that day
      - today / tonight / tomorrow or the weekday (_says_day, from the day the text went out: sent) with the city or a
        time that fits: on their own they are any party that day ("周五派对前的小提醒" went to every chef with a Friday party)
    The city alone never (Jacob Park / George, above). date: the party's day, YYYY-MM-DD."""
    text = str(body or "")
    named = set(ORDER_NO.findall(text))
    if named:
        return order.get("order_no") in named
    links = set(CHEF_LINK.findall(text))
    if links and tokens:
        return bool(links & tokens)
    name = " ".join(str(order.get("customer_name") or "").split())
    first = first_name(name)
    own = (str(chef or "").split() or [""])[0].lower()
    if first and ((first.lower() != own and _written(first, text)) or (name != first and _written(name, text))):
        return True
    try:
        day = _dt.date.fromisoformat(str(date or "")[:10])
    except ValueError:
        return False
    city = city_of(order.get("event_address"))
    at_city = len(city) >= 3 and city.lower() in text.lower()
    start = str(order.get("event_start") or "")[11:16]
    if _names_date(text, day):
        return at_city or _time_fits(text, start, none=True)
    return _says_day(text, day, sent) and (at_city or _time_fits(text, start, none=False))


def load_day(date: str, site_get, db_get) -> list[dict]:
    """Every party on that Pacific date the prep list has (it leaves out cancelled orders), with what the check reads."""
    prep = site_get("/api/admin/prep", {"date": date})
    entries = [e for e in (prep.get("orders") or []) if isinstance(e, dict) and e.get("id")]
    if not entries:
        return []
    return load_parties([e["id"] for e in entries], db_get, site_get, date, {e["id"]: e for e in entries})


def load_parties(order_ids: list[str], db_get, site_get, date: str | None, prep_by_id: dict | None = None, *, texts: bool = True,
                 chef_auto: bool = False) -> list[dict]:
    ids = _q(order_ids)
    orders = _safe(lambda: db_get(f"/rest/v1/orders?select={ORDER_COLUMNS}&id=in.({ids})&order=event_start.asc"), [])
    asg = _safe(lambda: db_get(f"/rest/v1/order_staff_assignments?select=order_id,staff_member_id,assignment_role&order_id=in.({ids})"
                               "&assignment_status=in.(tentative,confirmed,completed)"), [])
    staff_ids = _q(a.get("staff_member_id") for a in asg)
    staff = _safe(lambda: db_get(f"/rest/v1/staff_members?select=id,display_name,full_name,phone&id=in.({staff_ids})"), []) if staff_ids else []
    links = _safe(lambda: db_get("/rest/v1/chef_sheet_links?select=id,order_id,staff_member_id,token,sent_via,sent_at,first_opened_at,last_opened_at,revoked_at,stale,change_pending_since"
                                 f"&order_id=in.({ids})&order=created_at.desc"), [])
    # A link's token says which party a text carrying it is about (_mentions_party). It opens the chef's page, so it goes
    # no further: not into the party.
    tokens_of: dict[str, set[str]] = {}
    for l in links:
        if isinstance(l, dict) and l.get("token"):
            tokens_of.setdefault(str(l.get("order_id")), set()).add(str(l["token"]))
    links = [{k: v for k, v in l.items() if k != "token"} for l in links if isinstance(l, dict)]
    notices = _safe(lambda: db_get(f"/rest/v1/chef_change_notices?select=id,order_id,staff_member_id,summary,sent_at,acked_at,sms_sid&order_id=in.({ids})&order=sent_at.desc"), [])
    events = _safe(lambda: db_get(f"/rest/v1/order_events?select=order_id,action,created_at,metadata&order_id=in.({ids})"
                                  "&action=in.(lead_linked,chef_sheet_sent)&order=created_at.asc"), [])
    requests = _safe(lambda: db_get(f"/rest/v1/invoice_update_requests?select=order_id,created_at,customer_message&order_id=in.({ids})&order=created_at.asc"), [])
    leads_of: dict[str, set[str]] = {}
    for o in orders:
        lid = str(((o.get("source_metadata") or {}) if isinstance(o.get("source_metadata"), dict) else {}).get("lead_id") or "")
        if re.fullmatch(r"[0-9a-f-]{36}", lid):
            leads_of.setdefault(o["id"], set()).add(lid)
    for e in events:
        lid = str((e.get("metadata") or {}).get("lead_id") or "") if e.get("action") == "lead_linked" else ""
        if re.fullmatch(r"[0-9a-f-]{36}", lid):
            leads_of.setdefault(e["order_id"], set()).add(lid)
    all_leads = _q(l for s in leads_of.values() for l in s)
    notes = _safe(lambda: db_get(f"/rest/v1/lead_touchpoints?select=lead_id,occurred_at,note:raw_payload_json->>note&lead_id=in.({all_leads})"
                                 "&touchpoint_type=eq.agent_note&order=occurred_at.asc&limit=2000"), []) if all_leads else []
    staff_by = {s["id"]: s for s in staff}
    name_of = lambda sid: str((staff_by.get(sid) or {}).get("display_name") or (staff_by.get(sid) or {}).get("full_name") or "?").strip()
    threads: dict[str, list] = {}

    def thread(phone: str) -> list:
        if phone not in threads:
            threads[phone] = _safe(lambda: (site_get("/api/admin/sms-thread", {"phone": phone}) or {}).get("messages") or [], [])
        return threads[phone]

    parties = []
    for o in orders:
        oid = o["id"]
        day = date or str(o.get("event_start") or "")[:10]
        team = [{"id": a["staff_member_id"], "name": name_of(a["staff_member_id"]), "phone": (staff_by.get(a["staff_member_id"]) or {}).get("phone"),
                 "role": a.get("assignment_role")} for a in asg if a.get("order_id") == oid]
        party = {
            "order": o,
            "prep": (prep_by_id or {}).get(oid),
            "team": team,
            "links": [l for l in links if l.get("order_id") == oid],
            "notices": [n for n in notices if n.get("order_id") == oid],
            "lead_notes": [{"at": n.get("occurred_at"), "note": n.get("note")} for n in notes if n.get("lead_id") in leads_of.get(oid, set())],
            "requests": [{"at": r.get("created_at"), "message": r.get("customer_message")} for r in requests if r.get("order_id") == oid],
            "sheet_notes": [{"at": e.get("created_at"), "note": (e.get("metadata") or {}).get("note"), "chef": (e.get("metadata") or {}).get("staff_name")}
                            for e in events if e.get("order_id") == oid and e.get("action") == "chef_sheet_sent" and str((e.get("metadata") or {}).get("note") or "").strip()],
            "customer_sms": [],
            "chef_sms": [],
        }
        if texts:
            if o.get("customer_phone"):
                party["customer_sms"] = [m for m in thread(o["customer_phone"]) if isinstance(m, dict)]
            # What we texted his chefs about this party: the five days before it and the day itself, on the Pacific clock (a
            # text at 4 PM on the party day is the next day in UTC: George's evening reminder, 11-13), naming it.
            start = str(o.get("event_start") or "")[:10]
            lo = (_dt.date.fromisoformat(start) - _dt.timedelta(days=5)).isoformat() if start else ""
            for t in team:
                if not t.get("phone"):
                    continue
                for m in thread(t["phone"]):
                    if not isinstance(m, dict) or m.get("direction") != "outbound":
                        continue
                    # The system's own prep-sheet and change texts: left out of the 10:00 check (they carry the
                    # sheet itself), kept for the reviewer (chef_auto) - with their carrier status, since an
                    # undelivered one is a chef who never got the note (Eason 11-11, RH-20261107-5825).
                    auto = bool(CHEF_AUTO.search(str(m.get("body") or "")))
                    if auto and not chef_auto:
                        continue
                    sent = _pt(m.get("at"))
                    if lo and not (sent and lo <= sent.date().isoformat() <= start):
                        continue
                    if _mentions_party(m.get("body") or "", o, day, tokens=tokens_of.get(str(oid)), sent=sent.date() if sent else None, chef=t["name"]):
                        party["chef_sms"].append({"at": m.get("at"), "body": m.get("body"), "chef": t["name"], "status": m.get("status"),
                                                  **({"auto": True} if auto else {})})
        parties.append(party)
    return parties


def render_day(date: str, parties: list[dict], today: str | None = None) -> list[str]:
    out = []
    total = blocking = 0
    for p in parties:
        gaps = gaps_of(p)
        total += len(gaps)
        blocking += sum(1 for g in gaps if g["severity"] == "block")
        out += render(p, gaps, today)
    head = f"派对当天核对 {date} · {len(parties)} 场 · 缺项 {total}" + (f"（{blocking} 项要先补）" if blocking else "")
    if not parties:
        return [f"派对当天核对 {date} · 这天没有派对"]
    return [head, *out, "━" * 78, "补完订单，系统约 10 分钟后自动短信告诉师傅改了什么（还是原来那条链接）；备货备注用 desk order set <单号> --prep-note-file F。"]

