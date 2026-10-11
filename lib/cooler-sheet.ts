import { aggregatePrep, splitVeg, type PrepItem } from "@/lib/prep-bom"

// 后勤备货单（装保温箱）：给后勤阿姨打印出来照着装的那张纸。
// 老板 2026-10-11：只列要放进保温箱的东西，不带客户信息、不带价格；全中文、
// 字要大、越简单越好（后勤年纪偏大）。数量来自同一套配比（lib/prep-bom.ts），
// 称重的东西写到盎司（往上取整），旁边小字给参照（约几磅 / 几根 / 几盒）；按个数的照个数。
// 不进保温箱的（油、酱油、桌椅餐具）不出现在这张纸上。

/** fill = 留给后勤手写的空（"实际 ____ 根"），老板拿回来校准配比。 */
export type CoolerLine = { id: string; label: string; amount: string; note?: string; fill?: string }
export type CoolerSection = { title: string; lines: CoolerLine[] }
export type CoolerParty = {
  /** "下午 5:00" */
  time: string
  chef: string | null
  adults: number
  kids: number
  menuKnown: boolean
  sections: CoolerSection[]
}

const r1 = (n: number) => Math.round(n * 10) / 10
const up = (n: number) => Math.max(1, Math.ceil(n - 1e-9))
// 称重的东西一律写到盎司（老板 2026-10-11："备料需要放到 oz 级别"），往上取整；
// 旁边小字给一个顺手的参照："约 x 磅 / 约 x 根 / 约 x 盒"。
const oz = (q: number) => `${up(q)} 盎司`
const aboutLb = (q: number) => `约 ${r1(q / 16)} 磅`
const servings = (q: number, per: number) => `${up(q / per)} 人份`

type Rule = { section: 0 | 1 | 2 | 3 | 4; label: string; amount: (qty: number) => string; note?: (qty: number) => string; fill?: string }
// 蔬菜写的是没处理的重量（去皮、去头尾之前），标题上说清楚。
const SECTION_TITLES = ["肉和海鲜", "蔬菜（没去皮、没切之前的重量）", "饭、面、鸡蛋", "酱料和黄油", "前菜（冷冻）"]

// 一根西葫芦 ≈ 11 盎司、一个洋葱 ≈ 12 盎司、胡萝卜 12 盎司一袋（和 prep-bom 的采购换算一致）。
// 酱料、黄油、青豆胡萝卜粒在清单上按汤匙记：2 汤匙 = 1 盎司。
const RULES: Record<string, Rule> = {
  chicken: { section: 0, label: "鸡胸肉", amount: oz, note: (q) => `${aboutLb(q)} · ${servings(q, 5)}` },
  steak: { section: 0, label: "牛排", amount: oz, note: (q) => `${aboutLb(q)} · ${servings(q, 4.5)}` },
  ribeye: { section: 0, label: "肋眼牛排", amount: oz, note: (q) => `${aboutLb(q)} · ${servings(q, 4.5)}` },
  filet_mignon: { section: 0, label: "菲力牛排", amount: oz, note: (q) => `${aboutLb(q)} · ${servings(q, 4.5)}` },
  shrimp: { section: 0, label: "虾", amount: (q) => `${up(q)} 只`, note: (q) => servings(q, 5) },
  salmon: { section: 0, label: "三文鱼", amount: oz, note: (q) => `${aboutLb(q)} · ${servings(q, 4)}` },
  scallops: { section: 0, label: "带子", amount: oz, note: (q) => `约 ${up(q)} 个 · ${servings(q, 4)}` },
  lobster_tail: { section: 0, label: "龙虾尾", amount: (q) => `${up(q / 6)} 只` },
  tofu: { section: 0, label: "豆腐", amount: oz, note: (q) => `约 ${up(q / 15)} 盒 · ${servings(q, 5)}` },
  // 根数是估的（一根按 11 盎司）：请她把实际用了几根写在纸上，慢慢对出真实的数（老板 2026-10-11）。
  zucchini: { section: 1, label: "西葫芦", amount: oz, note: (q) => `约 ${r1(q / 11)} 根`, fill: "实际用了 ______ 根" },
  broccoli: { section: 1, label: "西兰花", amount: oz, note: aboutLb },
  onion: { section: 1, label: "洋葱", amount: oz, note: (q) => `约 ${r1(q / 12)} 个`, fill: "实际用了 ______ 个" },
  carrots: { section: 1, label: "胡萝卜", amount: oz, note: (q) => `约 ${up(q / 12)} 袋（12 盎司一袋）` },
  salad: { section: 1, label: "沙拉菜", amount: (q) => `${up(q)} 人份` },
  lime: { section: 1, label: "青柠", amount: (q) => `${up(q)} 个` },
  fried_rice: { section: 2, label: "熟米饭", amount: oz, note: aboutLb },
  // 清单上记的是干面重量（熟面 ÷ 3）；装箱的是煮好的面。
  noodles: { section: 2, label: "面条（煮好的）", amount: (q) => oz(q * 3), note: (q) => aboutLb(q * 3) },
  eggs: { section: 2, label: "鸡蛋", amount: (q) => `${up(q)} 个` },
  fried_rice_seasoning: { section: 2, label: "青豆胡萝卜粒（冷冻）", amount: (q) => oz(q / 2), note: (q) => `约 ${up(q / 24)} 包（12 盎司一包）` },
  ginger_sauce: { section: 3, label: "Yum Yum 白酱", amount: (q) => oz(q / 2), note: (q) => `约 ${up(q / 32)} 盒（16 盎司一盒）` },
  ginger_dressing: { section: 3, label: "姜汁沙拉酱", amount: (q) => oz(q / 2), note: (q) => `约 ${up(q / 32)} 盒（16 盎司一盒）` },
  garlic_butter: { section: 3, label: "蒜香黄油", amount: (q) => oz(q / 2), note: (q) => `约 ${up(q / 16)} 根（8 盎司一根）` },
  gyoza: { section: 4, label: "煎饺", amount: (q) => `${up(q)} 个` },
  spring_rolls: { section: 4, label: "春卷", amount: (q) => `${up(q)} 个` },
  edamame: { section: 4, label: "毛豆", amount: (q) => `${up(q)} 袋` },
}

/** 一单的用料行 → 保温箱里的东西，按五类分好。菜单没定时不出肉（由页面提示）。 */
export function coolerSections(items: PrepItem[], menuKnown: boolean): CoolerSection[] {
  const merged = aggregatePrep(items.filter((i) => i.group !== "setup")).flatMap((i) => (i.id === "mixed_vege" ? splitVeg(i) : [i]))
  // 加的鸡蛋并进鸡蛋一行。
  const qty = new Map<string, number>()
  for (const i of merged) {
    const id = i.id === "extra_egg" ? "eggs" : i.id
    qty.set(id, (qty.get(id) ?? 0) + i.qty)
  }
  const sections: CoolerSection[] = SECTION_TITLES.map((title) => ({ title, lines: [] }))
  for (const [id, rule] of Object.entries(RULES)) {
    const q = qty.get(id) ?? 0
    if (q <= 0) continue
    if (rule.section === 0 && !menuKnown) continue
    sections[rule.section].lines.push({ id, label: rule.label, amount: rule.amount(q), note: rule.note?.(q), fill: rule.fill })
  }
  return sections.filter((s) => s.lines.length > 0)
}

const WEEKDAYS = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"]
export function zhDate(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`)
  return `${d.getUTCMonth() + 1} 月 ${d.getUTCDate()} 日 ${WEEKDAYS[d.getUTCDay()]}`
}
/** event_start 是墙上时间按 UTC 存的，直接读 UTC 的时分。 */
export function zhTime(eventStart: string): string {
  const d = new Date(eventStart)
  const h = d.getUTCHours()
  const m = d.getUTCMinutes()
  const part = h < 12 ? "上午" : h < 18 ? "下午" : "晚上"
  return `${part} ${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")}`
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string)

/** 整份可打印的页面：每单另起一页（东西多的单会占两页）。 */
export function coolerSheetHtml(ymd: string, parties: CoolerParty[]): string {
  const pages = parties
    .map((p, i) => {
      const people = `${p.adults} 位大人${p.kids ? `、${p.kids} 位小孩` : ""}`
      const body = p.sections
        .map(
          (s) => `<h2>${esc(s.title)}</h2><table>${s.lines
            .map((l) => `<tr><td class="box"><span></span></td><td class="name">${esc(l.label)}${l.note ? `<small>${esc(l.note)}</small>` : ""}${l.fill ? `<small class="fill">${esc(l.fill)}</small>` : ""}</td><td class="amt">${esc(l.amount)}</td></tr>`)
            .join("")}</table>`,
        )
        .join("")
      return `<section class="page">
<header>
  <div class="no">第 ${i + 1} 箱<small>共 ${parties.length} 箱</small></div>
  <div class="meta"><div class="day">${esc(zhDate(ymd))}</div><div>${esc(p.time)} 开席${p.chef ? ` · 厨师 ${esc(p.chef)}` : ""}</div><div>${esc(people)}</div></div>
</header>
${p.menuKnown ? "" : `<div class="warn">这一单的菜还没定，肉和海鲜先不要备，等通知。</div>`}
${body}
<footer>装好一样，打一个勾 ✓</footer>
</section>`
    })
    .join("")
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>备货单 ${esc(zhDate(ymd))}</title>
<style>
*{box-sizing:border-box}
body{margin:0;background:#fff;color:#000;font-family:"Microsoft YaHei","PingFang SC","Noto Sans SC","Heiti SC",sans-serif;font-size:24px;line-height:1.35}
.bar{padding:14px 20px;background:#f2f2f2;display:flex;gap:14px;align-items:center;font-size:18px}
.bar button{font:inherit;font-size:22px;font-weight:700;padding:10px 26px;border:3px solid #000;background:#000;color:#fff;border-radius:8px;cursor:pointer}
.page{max-width:820px;margin:0 auto;padding:26px 30px 20px;page-break-after:always;break-after:page}
.page:last-child{page-break-after:auto;break-after:auto}
header{display:flex;gap:22px;align-items:center;border-bottom:5px solid #000;padding-bottom:14px;margin-bottom:6px}
.no{font-size:54px;font-weight:900;line-height:1;white-space:nowrap;border:5px solid #000;padding:12px 18px;border-radius:10px;text-align:center}
.no small{display:block;font-size:18px;font-weight:600;margin-top:6px}
.meta{font-size:26px;font-weight:600}
.meta .day{font-size:34px;font-weight:900}
.warn{margin:14px 0 0;padding:12px 16px;border:4px dashed #000;font-size:26px;font-weight:800}
h2{font-size:26px;font-weight:900;margin:20px 0 4px;padding:4px 10px;background:#000;color:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
table{width:100%;border-collapse:collapse}
td{padding:11px 6px;border-bottom:2px solid #999;vertical-align:middle}
td.box{width:54px}
td.box span{display:block;width:38px;height:38px;border:4px solid #000;border-radius:5px}
td.name{font-size:32px;font-weight:700}
td.name small{display:block;font-size:19px;font-weight:500;color:#333}
td.name small.fill{font-size:24px;font-weight:700;color:#000;margin-top:6px}
td.amt{font-size:38px;font-weight:900;text-align:right;white-space:nowrap}
footer{margin-top:18px;font-size:22px;font-weight:600;text-align:center}
@media print{.bar{display:none}.page{padding:0;max-width:none}@page{margin:14mm}}
</style></head><body>
<div class="bar"><button onclick="window.print()">打印</button><span>${esc(zhDate(ymd))} · 共 ${parties.length} 箱 · 每箱另起一页</span></div>
${pages || `<section class="page"><div class="warn">这一天没有要备的单。</div></section>`}
</body></html>`
}
