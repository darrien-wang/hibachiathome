# -*- coding: utf-8 -*-
"""口径体检（self-test 第 2 层，2026-10-06）：对客文案里不该再出现的话，按面扫一遍。

    python scripts/selftest/lint-copy.py            # 两个仓库都扫，列出命中，有命中退出码 1
    python scripts/selftest/lint-copy.py --json     # 机器可读
    python scripts/selftest/lint-copy.py --rule 19.90   # 只跑一条规则

规则来自决策日志 D-1005-01 / D-1006-04 / D-1006-05 / D-1006-07 和 leads skill §5：
押金前一个字不提税和付款方式；锁日期 = 留卡不收钱、48h/$99；没有 4% 手续费、
没有 all-inclusive、没有 cash discount、没有 "no fees"；$19.90 押金和 72 小时退款
是 10-05 之前的世界。每条规则有自己的范围（哪些文件是对客面）和放行条件
（v1 分支、注释、历史说明）。命中不等于一定错，但每一条都要有人看过。

发票仓库按同级目录 ../v0-real-hibachi-invoice-generator 找；不存在就只扫本仓库。
"""
from __future__ import annotations

import argparse
import fnmatch
import io
import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
INVOICE = ROOT.parent / "v0-real-hibachi-invoice-generator"

# 对客面：客人、师傅、AI 代理会读到的文件。内部工作台 / 结算 / 文档不在此列。
CUSTOMER_MKT = [
    "app/**/*.tsx", "app/**/*.ts", "components/**/*.tsx", "components/**/*.ts",
    "config/*.ts", "lib/ai-facts.ts", "lib/workbench-settings-shared.ts",
    "public/chef-handbook.html", "scripts/desk/desk.py",
]
CUSTOMER_INV = [
    "app/order/**/*.tsx", "app/api/invoice/schema/route.ts", "app/api-docs/page.tsx",
    "lib/invoice-html.ts", "lib/invoice-mailer.ts", "lib/customer-notifications.ts", "lib/pricing-copy.ts",
    "components/invoice/**/*.tsx", "components/chef/**/*.tsx", "lib/chef-sheet.ts",
]
EXCLUDE = ["**/node_modules/**", "**/.next/**", "**/admin/**", "**/api/admin/**", "**/*.test.ts", "**/tests/**", "**/e2e/**"]

# 一行里出现这些，说明是在讲老口径或注释，放行。
V1_HINTS = re.compile(r"\bv1\b|v1_tax_included|legacy|historic|through 2026-10-05|10-05 及之前|老单|旧口径|D-0913|2026-09-|2026-10-0[1-5]\b", re.I)
COMMENT = re.compile(r"^\s*(//|#|/\*|\*|<!--)")

# 软规则：只报不算失败（老口径的 v1 文案本来就该留着，看一眼即可）。
SOFT = {"4pct-v2"}

RULES = [
    # name, pattern, scope (mkt globs, inv globs), allow-if-regex, why
    ("19.90", r"\$\s?19\.90|\b19\.9\b", (CUSTOMER_MKT, CUSTOMER_INV), re.compile(V1_HINTS.pattern + r"|DEPOSIT_AMOUNT", re.I), "押金已改留卡 $0（D-1006-04）；$19.90 只能出现在 v1 历史说明里"),
    ("refundable-deposit", r"refundable deposit|deposit is refundable|full refund|refund(ed)? (the )?deposit|reembols|devolvemos el dep", (CUSTOMER_MKT, CUSTOMER_INV), V1_HINTS, "没有押金就没有退押金；取消政策是 48h 免费 / 48h 内 $99"),
    ("72h", r"\b72\+?\s?(h|hours|hrs|horas)\b|72-hour|72\+ hours", (CUSTOMER_MKT, CUSTOMER_INV), V1_HINTS, "改期/取消窗口是 48 小时（D-1006-04）"),
    ("all-inclusive", r"all[- ]inclusive", (CUSTOMER_MKT, CUSTOMER_INV), None, "刷卡要加税和手续费，不能说全包（10-06 广告也下架了）"),
    ("cash-discount", r"cash discount|现金折扣", (CUSTOMER_MKT, CUSTOMER_INV), re.compile(r"底线|floor|让价|concession", re.I), "D-1006-05 起不说 cash discount；现金价 = 标价含税"),
    ("no-fees", r"\bno (hidden )?fees?\b|no processing fee|no surcharge|zero fees", (CUSTOMER_MKT, CUSTOMER_INV), re.compile(V1_HINTS.pattern + r"|add more grills|\+4%|cash has no fee|cash to your chef at the end is easiest", re.I), "刷卡列 Stripe 手续费，不能承诺 no fees（desk v1 分支那句除外）"),
    ("x1.10", r"[×x]\s?1\.10\b|\* ?1\.1\b|1\.10 ?[×x]", (CUSTOMER_MKT, CUSTOMER_INV), None, "×1.10 的刷卡价是 10-06 上午的旧 v2，已被 D-1006-05 取代"),
    ("4pct-v2", r"\b4%|0\.04\b|1\.04\b", (CUSTOMER_MKT, CUSTOMER_INV), re.compile(r"\bv1\b|v1_tax_included|CARD_SURCHARGE|CARD_FEE_RATE|legacy|through 2026-10-05|老单|ZELLE_VENMO|zelleVenmo|Zelle|Venmo|给师傅|to your chef|1\.04", re.I), "4% 手续费只属于 v1；v2 刷卡是 2.9%+30¢，Zelle/Venmo ×1.04 另有规则"),
    ("tax-before-commit", r"sales tax|\btax(es)?\b", ([
        "app/quote/**/*.tsx", "components/city/**/*.tsx", "components/menu/**/*.tsx", "components/occasion/**/*.tsx",
        "app/api/landing-quote/route.ts", "app/api/admin/lead-watch/route.ts", "app/api/planner-unlock/route.ts",
        "app/api/booking-request/route.ts", "components/admin/workbench/quote-tool.ts", "lib/workbench-settings-shared.ts",
        "config/faq.ts", "config/faq-es.ts", "config/city-pages.ts", "config/occasion-pages.ts", "config/blog-posts.ts", "lib/ai-facts.ts",
    ], []), re.compile(r"^\s*(//|#|/\*|\*)|seller|permit|税务|季报|CDTFA|restaurant|dine|eat out|dining|tip|gratuity", re.I), "定下来之前（报价/跟进/公开页）一个字不提税（D-1005-01 补充、D-1006-05）"),
    ("deposit-public", r"\bdeposit\b|\bdepósito\b", ([
        "config/blog-posts.ts", "config/faq.ts", "config/faq-es.ts", "config/city-pages.ts", "config/occasion-pages.ts",
        "app/page.tsx", "app/hibachi-at-home/**/*.tsx", "app/hibachi-catering/**/*.tsx", "app/party/**/*.tsx",
        "components/city/**/*.tsx", "components/hero-section.tsx", "app/es/**/*.tsx",
    ], []), re.compile(r"^\s*(//|#|/\*|\*)|data-|analytics|event_name|landing_deposit|track", re.I), "公开页不提押金，也不把 no deposit 当卖点（D-0913-01、D-1006-04）"),
]


def iter_files(root: Path, globs: list[str]):
    seen = set()
    for g in globs:
        for p in root.glob(g):
            if not p.is_file():
                continue
            rel = p.relative_to(root).as_posix()
            if any(fnmatch.fnmatch(rel, e) or fnmatch.fnmatch("/" + rel, e) for e in EXCLUDE):
                continue
            if rel in seen:
                continue
            seen.add(rel)
            yield rel, p


def scan(only: str | None):
    hits = []
    repos = [("marketing", ROOT, 0)] + ([("invoice", INVOICE, 1)] if INVOICE.exists() else [])
    for name, pat, scope, allow, why in RULES:
        if only and only != name:
            continue
        rx = re.compile(pat, re.I)
        for repo, root, idx in repos:
            for rel, p in iter_files(root, scope[idx]):
                try:
                    lines = io.open(p, encoding="utf-8", errors="replace").read().splitlines()
                except OSError:
                    continue
                for n, line in enumerate(lines, 1):
                    if not rx.search(line):
                        continue
                    if COMMENT.match(line) and name not in ("x1.10",):
                        continue
                    if allow is not None and allow.search(line):
                        continue
                    hits.append({"rule": name, "repo": repo, "file": rel, "line": n, "text": line.strip()[:160], "why": why})
    return hits


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--rule")
    a = ap.parse_args()
    hits = scan(a.rule)
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # the console is GBK on the desk
    if a.json:
        print(json.dumps(hits, ensure_ascii=False, indent=1))
    else:
        by_rule: dict[str, list[dict]] = {}
        for h in hits:
            by_rule.setdefault(h["rule"], []).append(h)
        for name, _, _, _, why in RULES:
            if a.rule and a.rule != name:
                continue
            rows = by_rule.get(name, [])
            print(f"[{name}]{' (软，只报不算)' if name in SOFT else ''} {len(rows)} 处 — {why}")
            for h in rows:
                print(f"   {h['repo']}:{h['file']}:{h['line']}  {h['text']}")
        hard = [h for h in hits if h["rule"] not in SOFT]
        print(f"\n共 {len(hits)} 处命中（硬规则 {len(hard)} 处），{len(by_rule)} 条规则有命中。")
    hard = [h for h in hits if h["rule"] not in SOFT]
    sys.exit(1 if hard else 0)


if __name__ == "__main__":
    main()
