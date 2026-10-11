import { aggregatePrep, VEGE_NET_PER_RAW, type PrepItem } from "@/lib/prep-bom"

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
  /** 这一单谁负责备货（后勤，在员工→结算页勾给谁就是谁）。没定就留空给人手写。 */
  owner?: string | null
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
const SECTION_TITLES = ["肉和海鲜", "蔬菜", "饭、面、鸡蛋", "酱料和黄油", "前菜（冷冻）"]

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
  // 四样蔬菜合成一栏，写切好后的净重：平均每人 5 盎司上下，不用分开称（老板 2026-10-11）。
  // 清单上的 mixed_vege 是毛重（含去皮去头尾的损耗），这里折回净重。西葫芦买多少根还在
  // 校准，所以留一个空请她写实际用了几根。
  mixed_vege: {
    section: 1,
    label: "蔬菜混合（切好的）",
    amount: (q) => oz(q * VEGE_NET_PER_RAW),
    note: () => "西葫芦、西兰花、洋葱、胡萝卜 · 平均每人 5 盎司，上下一点没关系",
    fill: "西葫芦实际用了 ______ 根",
  },
  salad: { section: 1, label: "沙拉菜", amount: (q) => `${up(q)} 人份` },
  lime: { section: 1, label: "青柠", amount: (q) => `${up(q)} 个` },
  fried_rice: { section: 2, label: "熟米饭", amount: oz, note: aboutLb },
  // 清单上记的是干面重量（熟面 ÷ 3）；装箱的是煮好的面。
  noodles: { section: 2, label: "面条（煮好的）", amount: (q) => oz(q * 3), note: (q) => aboutLb(q * 3) },
  // 鸡蛋不用数得一个不差（老板 2026-10-11）：写"多少个上下"。
  eggs: { section: 2, label: "鸡蛋", amount: (q) => `${up(q)} 个上下` },
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
  const merged = aggregatePrep(items.filter((i) => i.group !== "setup"))
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
    // 洋葱火山：切好叠成火山的洋葱圈，不在用料清单里（它是表演不是配料），每单都要带。
    // 不是整个洋葱——要事先切好（老板 2026-10-11）。
    if (id === "mixed_vege") sections[1].lines.push({ id: "onion_volcano", label: "洋葱火山（切好的）", amount: "1 份", note: "两位厨师的单带 2 份" })
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

/** 整份可打印的页面：一单一页，东西多的单整页等比缩小，不拆页。 */
export function coolerSheetHtml(ymd: string, parties: CoolerParty[]): string {
  const pages = parties
    .map((p, i) => {
      const people = `${p.adults} 位大人${p.kids ? `、${p.kids} 位小孩` : ""}`
      const body = p.sections
        .map(
          (s) => `<div class="sec"><h2>${esc(s.title)}</h2><table>${s.lines
            .map((l) => `<tr><td class="box"><span></span></td><td class="name">${esc(l.label)}${l.note ? `<small>${esc(l.note)}</small>` : ""}${l.fill ? `<small class="fill">${esc(l.fill)}</small>` : ""}</td><td class="amt">${esc(l.amount)}</td></tr>`)
            .join("")}</table></div>`,
        )
        .join("")
      return `<section class="page">
<header>
  <div class="no">第 ${i + 1} 箱<small>共 ${parties.length} 箱</small></div>
  <div class="meta"><div class="day">${esc(zhDate(ymd))}</div><div>${esc(p.time)} 开席${p.chef ? ` · 厨师 ${esc(p.chef)}` : ""}</div><div>${esc(people)}</div></div>
  <div class="owner"><small>备货负责人</small>${p.owner ? esc(p.owner) : `<span class="blank"></span>`}</div>
</header>
${p.menuKnown ? "" : `<div class="warn">这一单的菜还没定，肉和海鲜先不要备，等通知。</div>`}
<div class="cols">${body}</div>
<footer>装好一样，打一个勾 ✓</footer>
</section>`
    })
    .join("")
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>备货单 ${esc(zhDate(ymd))}</title>
<style>
*{box-sizing:border-box}
body{margin:0;background:#fff;color:#000;font-family:"Microsoft YaHei","PingFang SC","Noto Sans SC","Heiti SC",sans-serif;font-size:22px;line-height:1.25}
.bar{padding:14px 20px;background:#f2f2f2;display:flex;gap:14px;align-items:center;font-size:18px}
.bar button{font:inherit;font-size:22px;font-weight:700;padding:10px 26px;border:3px solid #000;background:#000;color:#fff;border-radius:8px;cursor:pointer}
/* 一单一页，绝不拆成两页（老板 2026-10-11）：版面按信纸可打印区定宽，东西多的单由
   页尾脚本整体缩小到一页高。 */
.page{width:720px;margin:0 auto;padding:18px 0 10px;page-break-after:always;break-after:page;page-break-inside:avoid;break-inside:avoid}
.page:last-child{page-break-after:auto;break-after:auto}
header{display:flex;gap:18px;align-items:center;border-bottom:4px solid #000;padding-bottom:8px;margin-bottom:2px}
.no{font-size:40px;font-weight:900;line-height:1;white-space:nowrap;border:4px solid #000;padding:8px 14px;border-radius:8px;text-align:center}
.no small{display:block;font-size:15px;font-weight:600;margin-top:4px}
.meta{font-size:21px;font-weight:600}
.meta .day{font-size:28px;font-weight:900}
.owner{margin-left:auto;text-align:center;font-size:30px;font-weight:900;border:4px solid #000;border-radius:8px;padding:6px 14px;min-width:150px}
.owner small{display:block;font-size:15px;font-weight:600}
.owner .blank{display:block;height:36px}
.warn{margin:10px 0 0;padding:8px 12px;border:4px dashed #000;font-size:24px;font-weight:800}
h2{font-size:21px;font-weight:900;margin:10px 0 0;padding:2px 10px;background:#000;color:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
table{width:100%;border-collapse:collapse}
td{padding:5px 6px;border-bottom:2px solid #999;vertical-align:middle}
td.box{width:44px}
td.box span{display:block;width:30px;height:30px;border:3px solid #000;border-radius:4px}
td.name{font-size:28px;font-weight:700}
td.name small{font-size:16px;font-weight:500;color:#333;margin-left:10px}
td.name small.fill{display:block;font-size:20px;font-weight:700;color:#000;margin:2px 0 0}
td.amt{font-size:32px;font-weight:900;text-align:right;white-space:nowrap}
/* 东西多的单：先排成两栏、字略小，还放不下再整页缩小。 */
.sec{break-inside:avoid;page-break-inside:avoid}
.dense .cols{column-count:2;column-gap:26px}
.dense td.box{width:36px}
.dense td.box span{width:26px;height:26px}
.dense td.name{font-size:24px}
.dense td.name small{display:block;margin-left:0;font-size:14px}
.dense td.name small.fill{font-size:17px}
.dense td.amt{font-size:27px}
.dense h2{margin-top:8px}
.dense .sec:first-child h2{margin-top:10px}
footer{margin-top:8px;font-size:18px;font-weight:600;text-align:center}
@media print{.bar{display:none}.page{padding:0}@page{margin:10mm}}
</style></head><body>
<div class="bar"><button onclick="window.print()">打印</button><span>${esc(zhDate(ymd))} · 共 ${parties.length} 箱 · 一箱一页</span></div>
${pages || `<section class="page"><div class="warn">这一天没有要备的单。</div></section>`}
<script>
// 信纸（最短的常用纸）去掉页边距后约 259mm ≈ 979px 高；留一点余量。超过就整页等比缩小。
(function(){var MAX=950;function fit(){var ps=document.querySelectorAll(".page");for(var i=0;i<ps.length;i++){var p=ps[i];p.style.zoom="1";p.classList.remove("dense");var h=p.scrollHeight;if(h>MAX){p.classList.add("dense");h=p.scrollHeight}if(h>MAX)p.style.zoom=String(Math.floor(MAX/h*1000)/1000)}}
fit();window.addEventListener("load",fit);window.addEventListener("beforeprint",fit)})();
</script>
</body></html>`
}
