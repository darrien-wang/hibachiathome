# -*- coding: utf-8 -*-
"""师傅派单：两周账 + 派单建议 + 写入（老板 2026-10-30，规则见 .claude/skills/dispatch/SKILL.md）。

  python scripts/desk/dispatch.py ledger [--week 2026-11-09]    两周账、撞单、未派的单（只读）
  python scripts/desk/dispatch.py suggest [--week 2026-11-09]   给未派的单出建议，存成 plan 文件（只读）
  python scripts/desk/dispatch.py apply <plan.json>             老板说"派"之后才跑，走工作台 assign

人数口径和工作台份额页一样（lib/chef-share.ts）：大人 1、小孩 0.5，多位师傅平分，帮手不算。
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import pathlib
import re
import sys
from zoneinfo import ZoneInfo

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from _api import site_get, site_post  # noqa: E402

LEADS = ["Blu", "Gary", "John"]  # 每周 30–40，超过 15 人的桌只给他们
JUNIOR = "Eason"  # 只炒每人 15 以下，一周 1–2 单就行，量大时多接
HELPER = "易非"  # 不独立出台，不进轮转；超过 28 人的单有空才带
RANK = LEADS + [JUNIOR]
TARGET_MIN, TARGET_MAX = 30, 40
JUNIOR_MAX_HEADS = 15
HELPER_OVER = 28
WINDOW_DAYS = 14  # 近两个月约 69% 的人数是开场前 14 天内才订的，太早派后面就不均了
MIN_GAP_MIN = 180  # 同一位师傅同一天两场，开场至少隔这么久才不算撞

# 圣地亚哥附近：John 不去。919–921 是圣地亚哥县，另加 Temecula/Murrieta。
SD_ZIP = re.compile(r"\b(919\d\d|920\d\d|921\d\d|9259[0-2]|9256[23])\b")
SD_CITY = re.compile(r"\b(san diego|carlsbad|fallbrook|temecula|murrieta|oceanside|escondido|vista|encinitas|la jolla|chula vista|del mar)\b", re.I)


def near_sd(address: str | None) -> bool:
    a = address or ""
    return bool(SD_ZIP.search(a) or SD_CITY.search(a))


def monday_of(day: dt.date) -> dt.date:
    return day - dt.timedelta(days=day.weekday())


def today_pt() -> dt.date:
    return dt.datetime.now(ZoneInfo("America/Los_Angeles")).date()


def heads_of(adults, kids) -> float:
    return (adults or 0) + 0.5 * (kids or 0)


def fmt(n: float) -> str:
    return str(int(n)) if float(n).is_integer() else f"{n:.1f}"


def load(week: dt.date):
    """整理出 from(上周一)…to(本周日) 的派单。event_start 存的是墙上时间，直接切字符串。"""
    start, end = week - dt.timedelta(days=7), week + dt.timedelta(days=6)
    chefs = site_get("/api/admin/chefs").get("chefs") or []
    orders = site_get("/api/admin/orders").get("orders") or []
    ids = {c["name"]: c["id"] for c in chefs}
    parties: dict[str, dict] = {}
    for c in chefs:
        if c.get("role") == "logistics":
            continue
        for s in c.get("shifts") or []:
            day = s.get("date") or ""
            if s.get("orderStatus") == "cancelled" or not (str(start) <= day <= str(end)):
                continue
            p = parties.setdefault(s["orderId"], {"id": s["orderId"], "day": day, "at": s.get("eventStart") or day, "who": s.get("customer"), "addr": s.get("address"), "heads": heads_of(s["counts"]["adults"], s["counts"]["kids"]), "chefs": []})
            p["chefs"].append(c["name"])
    open_orders = []
    for o in orders:
        day = (o.get("event_start") or "")[:10]
        if not day or o.get("order_status") == "cancelled" or o["id"] in parties or not (str(week) <= day <= str(end)):
            continue
        open_orders.append({"id": o["id"], "day": day, "at": o["event_start"], "who": o.get("customer_name"), "addr": o.get("event_address"), "heads": heads_of(o.get("guest_adult_count"), o.get("guest_child_count")), "need": o.get("required_staff_count") or 1, "chefs": []})
    open_orders.sort(key=lambda x: x["at"])
    return ids, list(parties.values()), open_orders


def book(parties, week: dt.date):
    """每人上周、本周各多少人。"""
    last = {n: 0.0 for n in RANK}
    this = {n: 0.0 for n in RANK}
    for p in parties:
        share = p["heads"] / max(1, len(p["chefs"]))
        side = this if p["day"] >= str(week) else last
        for n in p["chefs"]:
            side[n] = side.get(n, 0.0) + share
    return last, this


def minutes(at: str) -> int:
    return int(at[11:13]) * 60 + int(at[14:16])


def clash(busy: dict, name: str, p: dict) -> bool:
    return any(q["day"] == p["day"] and abs(minutes(q["at"]) - minutes(p["at"])) < MIN_GAP_MIN for q in busy.get(name, []))


def can_go(busy, name, p, share) -> bool:
    if clash(busy, name, p):
        return False
    if name == "John" and near_sd(p["addr"]):
        return False
    return not (name == JUNIOR and share > JUNIOR_MAX_HEADS)


def rows(parties, week):
    busy: dict[str, list] = {}
    for p in parties:
        if p["day"] >= str(week):
            for n in p["chefs"]:
                busy.setdefault(n, []).append(p)
    return busy


def show_ledger(last, this):
    print(f"{'师傅':<8}{'上周':>7}{'本周':>7}{'两周':>7}  说明")
    for n in sorted(set(last) | set(this), key=lambda x: RANK.index(x) if x in RANK else 99):
        both = last.get(n, 0) + this.get(n, 0)
        note = ""
        if n in LEADS:
            floor, roof = TARGET_MIN * 2, TARGET_MAX * 2
            note = f"差 {fmt(floor - both)} 到 {floor}，优先补" if both < floor else (f"超过 {roof}" if both > roof else f"在 {floor}–{roof}")
        print(f"{n:<8}{fmt(last.get(n, 0)):>7}{fmt(this.get(n, 0)):>7}{fmt(both):>7}  {note}")


def cmd_ledger(week):
    _, parties, open_orders = load(week)
    last, this = book(parties, week)
    print(f"两周账 {week - dt.timedelta(days=7)} – {week + dt.timedelta(days=6)}")
    show_ledger(last, this)
    busy = rows(parties, week)
    hits = []
    for n, ps in busy.items():
        ps = sorted(ps, key=lambda x: x["at"])
        hits += [f"{n} {a['day']} {a['who']} {a['at'][11:16]} / {b['who']} {b['at'][11:16]}" for a, b in zip(ps, ps[1:]) if a["day"] == b["day"] and minutes(b["at"]) - minutes(a["at"]) < MIN_GAP_MIN]
    print("\n撞单（同一天开场隔不到 3 小时）：" + ("无" if not hits else ""))
    for h in hits:
        print("  " + h)
    print(f"\n本周未派 {len(open_orders)} 单：")
    for p in open_orders:
        print(f"  {p['day']} {p['at'][11:16]} {p['who']} {fmt(p['heads'])} 人 需 {p['need']} 位 · {p['addr']}")


def cmd_suggest(week, include_far=False):
    ids, parties, open_orders = load(week)
    last, this = book(parties, week)
    busy = rows(parties, week)
    today = today_pt()
    plan, stuck, far = [], [], []
    junior_count = sum(1 for p in parties if JUNIOR in p["chefs"] and p["day"] >= str(week))

    def two_week(n):
        return last.get(n, 0) + this.get(n, 0)

    def take(p, n, share):
        this[n] = this.get(n, 0) + share
        busy.setdefault(n, []).append(p)

    # 大桌先派：只有主力能做，先占位，小桌再补。
    big_first = sorted(open_orders, key=lambda x: (x["heads"] / x["need"] <= JUNIOR_MAX_HEADS, -x["heads"]))
    for p in big_first:
        if not include_far and (dt.date.fromisoformat(p["day"]) - today).days > WINDOW_DAYS and p["need"] < 2:
            far.append(p)
            continue
        share = p["heads"] / p["need"]
        team = []
        for _ in range(p["need"]):
            pool = [n for n in LEADS if n not in team and can_go(busy, n, p, share)]
            small = share <= JUNIOR_MAX_HEADS
            junior_ok = small and JUNIOR not in team and can_go(busy, JUNIOR, p, share)
            owed = [n for n in pool if this.get(n, 0) < TARGET_MIN]
            if junior_ok and (junior_count == 0 or not owed):
                who = JUNIOR
                junior_count += 1
            elif pool:
                # 两周累计最少的先拿：上周少的这周自然排在前面，这就是补偿。
                who = min(owed or pool, key=lambda n: (two_week(n), RANK.index(n)))
            else:
                who = None
            if who is None:
                break
            team.append(who)
            take(p, who, share)
        if len(team) < p["need"]:
            stuck.append((p, team))
        plan.append({"orderId": p["id"], "who": p["who"], "day": p["day"], "at": p["at"][11:16], "heads": p["heads"], "team": team, "teamIds": [ids[n] for n in team], "helper": HELPER if p["heads"] > HELPER_OVER else None})
    plan.sort(key=lambda x: (x["day"], x["at"]))
    print(f"{week} 这周的建议（还没写入）：")
    for r in plan:
        print(f"  {r['day']} {r['at']} {r['who']} {fmt(r['heads'])} 人 → {' + '.join(r['team']) or '排不开'}" + (f"（{HELPER} 有空可带）" if r["helper"] else ""))
    print("\n建议写入后的两周账：")
    show_ledger(last, this)
    for p, team in stuck:
        print(f"\n排不开：{p['day']} {p['who']} 需 {p['need']} 位，只排到 {team}——找兼职或连台，先问老板。")
    if far:
        print(f"\n超过 {WINDOW_DAYS} 天没派 {len(far)} 单：" + "、".join(f"{p['day']} {p['who']}" for p in far))
    out = pathlib.Path(__file__).resolve().parent / "cache" / f"dispatch-plan-{week}.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps([r for r in plan if r["team"]], ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\nplan 文件：{out}")


def cmd_apply(path):
    plan = json.loads(pathlib.Path(path).read_text(encoding="utf-8"))
    for r in plan:
        res = site_post("/api/admin/chefs", {"action": "assign", "order_id": r["orderId"], "staff_member_ids": r["teamIds"]})
        print(r["day"], r["who"], "→", " + ".join(r["team"]), "ok" if res.get("ok") else res)


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["ledger", "suggest", "apply"])
    ap.add_argument("plan", nargs="?")
    ap.add_argument("--week", help="这一周里的任意一天，默认今天")
    ap.add_argument("--all", action="store_true", help="超过 14 天的单也出建议")
    a = ap.parse_args()
    if a.cmd == "apply":
        if not a.plan:
            raise SystemExit("apply 要给 plan 文件")
        cmd_apply(a.plan)
        return
    week = monday_of(dt.date.fromisoformat(a.week) if a.week else today_pt())
    if a.cmd == "ledger":
        cmd_ledger(week)
    else:
        cmd_suggest(week, a.all)


if __name__ == "__main__":
    main()
