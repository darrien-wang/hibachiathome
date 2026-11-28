import { aggregatePrep, splitVeg, type PrepGroup, type PrepItem } from "@/lib/prep-bom"
import { zhDate, type CoolerParty } from "@/lib/cooler-sheet"

// 全量备货单（老板 2026-11-27）：「我这里还需要全量汇总 备货单盘点」「不是阿姨的切配，
// 而是当天应该有的所有东西」「避免当天临时少东西」。
// 和阿姨切配单（lib/cooler-sheet.ts）是两张纸：阿姨那张只管切肉切菜煮饭；这张列勾上的几场
// 一共要用的全部东西——肉海鲜、菜蛋沙拉、前菜面、饭和酱、订单另加的、桌椅装备——对着冰箱
// 和货架一样一样勾。只写要多少，不写库存（老板：「不需要管库存本身，只需要展示需要多少，
// 师傅自己会去减差额」）。数和备货页的合计同一套（aggregatePrep），蔬菜拆成四样各一行。

const SECTIONS: Array<{ group: PrepGroup; title: string }> = [
  { group: "protein", title: "肉和海鲜" },
  { group: "produce", title: "蔬菜、鸡蛋、沙拉" },
  { group: "frozen", title: "前菜和面（冷冻）" },
  { group: "pantry", title: "饭和酱料" },
  { group: "custom", title: "订单另加的" },
  { group: "setup", title: "桌椅和装备" },
]

const r1 = (n: number) => Math.round(n * 10) / 10
const up = (n: number) => Math.max(1, Math.ceil(n - 1e-9))

/** 纸上的数：重量写磅；龙虾尾、带子、豆腐、酱料按拿的东西数（只、个、盒、瓶、根、包）。 */
export function fullAmount(it: Pick<PrepItem, "id" | "qty" | "unit">): string {
  const { id, qty, unit } = it
  if (id === "lobster_tail") return `${up(qty / 6)} 只` // 一只 6 oz
  // 带子 2026-11-28 起清单上就按个数（pcs），走下面 pcs 那一行，不再从 oz 折。
  if (id === "tofu") return `${up(qty / 16)} 盒` // 16 oz 一盒
  if (unit === "tbsp") {
    if (id === "ginger_sauce" || id === "ginger_dressing") return `${up(qty / 32)} 瓶` // 16 oz 瓶 = 32 汤匙
    if (id === "garlic_butter") return `${up(qty / 16)} 根` // 8 oz 一根
    if (id === "fried_rice_seasoning") return `${up(qty / 24)} 包` // 12 oz 包
    return `${up(qty)} 汤匙`
  }
  if (unit === "oz") return `${r1(qty / 16)} 磅`
  if (unit === "pcs") return `${up(qty)} 个`
  if (unit === "份") return `${up(qty)} 份`
  return `${r1(qty)} ${unit}`
}

/** 勾上的几场合在一起的全部用料，按纸上的分区排好。 */
export function fullLines(parties: CoolerParty[]): Array<{ title: string; items: PrepItem[] }> {
  const all = aggregatePrep(parties.flatMap((p) => p.items ?? [])).flatMap((i) => (i.id === "mixed_vege" ? splitVeg(i) : [i]))
  return SECTIONS.map((s) => ({ title: s.title, items: all.filter((i) => i.group === s.group && i.qty > 0) })).filter((s) => s.items.length)
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string)

export function fullStockSheetHtml(ymd: string, parties: CoolerParty[], who?: string | null): string {
  const adults = parties.reduce((n, p) => n + p.adults, 0)
  const kids = parties.reduce((n, p) => n + p.kids, 0)
  const unknown = parties.filter((p) => !p.menuKnown)
  const body = fullLines(parties)
    .map(
      (s) =>
        `<div class="sec"><h2>${esc(s.title)}</h2><table>${s.items
          .map((i) => `<tr><td class="box"><span></span></td><td class="name">${esc(i.label)}${i.alt ? `<small>${esc(i.alt)}</small>` : ""}</td><td class="amt">${esc(fullAmount(i))}</td></tr>`)
          .join("")}</table></div>`,
    )
    .join("")
  const title = `全量备货单 ${zhDate(ymd)}${who ? ` · ${who}` : ""}`
  const page = parties.length
    ? `<section class="page">
<header>
  <div class="meta"><div class="day">全量备货单 · ${esc(zhDate(ymd))}</div><div>共 ${parties.length} 场 · ${adults} 位大人${kids ? `、${kids} 位小孩` : ""}${who ? ` · ${esc(who)}` : ""}</div></div>
</header>
<div class="warn">这几场一共要用的全部东西。对着冰箱和货架一样一样看，够了打勾，不够的马上补。</div>
${unknown.length ? `<div class="warn">有 ${unknown.length} 场菜还没定，那几场的肉和海鲜没算进去。</div>` : ""}
${body || `<div class="warn">这几场没有算出要用的东西。</div>`}
<footer>对完一样，打一个勾 ✓<div class="hint">只写要多少，冰箱里有多少自己减。阿姨切配的量另见阿姨那张。</div></footer>
</section>`
    : `<section class="page"><div class="warn">没有勾选的单。</div></section>`
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title>
<style>
*{box-sizing:border-box}
body{margin:0;background:#fff;color:#000;font-family:"Microsoft YaHei","PingFang SC","Noto Sans SC","Heiti SC",sans-serif;font-size:22px;line-height:1.25}
.bar{padding:14px 20px;background:#f2f2f2;display:flex;gap:14px;align-items:center;font-size:18px}
.bar button{font:inherit;font-size:22px;font-weight:700;padding:10px 26px;border:3px solid #000;background:#000;color:#fff;border-radius:8px;cursor:pointer}
.page{width:720px;margin:0 auto;padding:18px 0 10px}
header{display:flex;gap:18px;align-items:center;border-bottom:4px solid #000;padding-bottom:8px;margin-bottom:2px}
.meta{font-size:22px;font-weight:600}
.meta .day{font-size:32px;font-weight:900}
.warn{margin:8px 0 0;padding:6px 12px;border:4px dashed #000;font-size:21px;font-weight:800}
h2{font-size:22px;font-weight:900;margin:7px 0 0;padding:2px 10px;background:#000;color:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
table{width:100%;border-collapse:collapse}
td{padding:2px 6px;border-bottom:2px solid #999;vertical-align:middle}
td.box{width:44px}
td.box span{display:block;width:28px;height:28px;border:3px solid #000;border-radius:4px}
td.name{font-size:24px;font-weight:800}
td.name small{display:block;font-size:15px;font-weight:500;color:#333;line-height:1.15}
td.amt{font-size:28px;font-weight:900;text-align:right;white-space:nowrap;width:170px}
tr{break-inside:avoid;page-break-inside:avoid}
h2{break-after:avoid;page-break-after:avoid}
footer{margin-top:6px;font-size:18px;font-weight:600;text-align:center}
footer .hint{font-weight:500;margin-top:4px}
@media print{.bar{display:none}.page{padding:0}@page{size:letter;margin:10mm}}
</style></head><body>
<div class="bar"><button onclick="window.print()">打印</button><span>${esc(title)} · ${parties.length} 场</span></div>
${page}
</body></html>`
}
