import { aggregatePrep, FRIED_RICE, VEGE_NET_PER_RAW, type PrepItem } from "@/lib/prep-bom"

// 后勤备货单：给后勤阿姨打印出来照着做的那张纸。
// 老板 2026-10-11：不带客户信息、不带价格；全中文、字要大、越简单越好（后勤年纪偏大）。
// 老板 2026-10-22 改成合并：后勤只做要提前处理的几样——切鸡肉、切牛肉、切蔬菜、
// 切豆腐、煮饭——按整天（或按负责人）合成一个大概的总数；每一场分多少由师傅
// 自己去抓（抓码），后勤不再一场一场称。海鲜、酱料、鸡蛋、前菜这些不用加工的，
// 师傅自己拿，不上这张纸。

/** 一场要提前处理的量，原始单位：肉和豆腐、蔬菜毛重、熟饭都是盎司。 */
export type CoolerWork = {
  chicken: number
  steak: number
  ribeye: number
  filet_mignon: number
  tofu: number
  /** 蔬菜混合的毛重（清单口径，含去皮去头尾的损耗）；纸上折成净重。 */
  mixed_vege: number
  /** 熟饭 */
  fried_rice: number
}
const WORK_IDS = ["chicken", "steak", "ribeye", "filet_mignon", "tofu", "mixed_vege", "fried_rice"] as const
const MEAT_IDS = new Set(["chicken", "steak", "ribeye", "filet_mignon", "tofu"])

export type CoolerParty = {
  /** "下午 5:00" */
  time: string
  chef: string | null
  /** 这一单谁负责备货（后勤，订单弹窗"备货负责人"）。 */
  owner?: string | null
  /** 订单弹窗里的备货备注。合并后的纸上不印（老板 2026-10-22），留着给工作台看。 */
  note?: string | null
  adults: number
  kids: number
  menuKnown: boolean
  work: CoolerWork
}

/** 一单的用料行 → 要提前处理的量。菜单没定时肉和豆腐不算（纸上会提示）。 */
export function coolerWork(items: PrepItem[], menuKnown: boolean): CoolerWork {
  const merged = aggregatePrep(items.filter((i) => i.group !== "setup"))
  const w = Object.fromEntries(WORK_IDS.map((id) => [id, 0])) as CoolerWork
  for (const i of merged) {
    if (!(WORK_IDS as readonly string[]).includes(i.id)) continue
    if (MEAT_IDS.has(i.id) && !menuKnown) continue
    w[i.id as keyof CoolerWork] += i.qty
  }
  return w
}

const r1 = (n: number) => Math.round(n * 10) / 10
const up = (n: number) => Math.max(1, Math.ceil(n - 1e-9))
const lb = (oz: number) => `约 ${r1(oz / 16)} 磅`

// 切好的蔬菜每样写净重（老板 2026-10-22）：净重的四样比例和厨师备料单一致
// （发票仓库 lib/pricing.ts VEGE_MIX：西葫芦/西兰花/洋葱各 30%、胡萝卜 10%，合计每人 5 盎司）。
const VEGE_NET_SPLIT: Array<{ label: string; ratio: number }> = [
  { label: "西葫芦", ratio: 0.3 },
  { label: "西兰花", ratio: 0.3 },
  { label: "洋葱", ratio: 0.3 },
  { label: "胡萝卜", ratio: 0.1 },
]
// 熟饭 ≈ 生米 × 3（50 磅一袋生米 ≈ 2400 盎司熟饭）；美式量杯 1 杯生米约 7 盎司。
// 第一次照这个煮，让后勤说一下实际用了几杯，再校准。
const RICE_COOKED_PER_RAW = 3
const RICE_CUP_OZ = 7

type Line = { label: string; amount: string; note?: string }

/** 合并后的几行：切多少、煮多少。 */
export function workLines(parties: CoolerParty[]): { meat: Line[]; vege: Line[]; vegeNet: number; rice: Line[] } {
  const sum = Object.fromEntries(WORK_IDS.map((id) => [id, 0])) as CoolerWork
  for (const p of parties) for (const id of WORK_IDS) sum[id] += p.work?.[id] ?? 0
  const meat: Line[] = []
  const cut = (id: keyof CoolerWork, label: string) => {
    if (sum[id] > 0) meat.push({ label, amount: `${up(sum[id])} 盎司`, note: lb(sum[id]) })
  }
  cut("chicken", "鸡胸肉 切块")
  cut("steak", "牛排 切块")
  cut("ribeye", "肋眼牛排 切块")
  cut("filet_mignon", "菲力 切块")
  if (sum.tofu > 0) meat.push({ label: "豆腐 切块", amount: `${up(sum.tofu / 15)} 盒`, note: `${up(sum.tofu)} 盎司` })

  const vege: Line[] = []
  const vegeNet = sum.mixed_vege * VEGE_NET_PER_RAW
  if (vegeNet > 0) {
    for (const v of VEGE_NET_SPLIT) vege.push({ label: `${v.label} 切好`, amount: `${up(vegeNet * v.ratio)} 盎司`, note: lb(vegeNet * v.ratio) })
    const volcanoes = parties.filter((p) => (p.work?.mixed_vege ?? 0) > 0).length
    vege.push({ label: "洋葱火山 切好", amount: `${volcanoes} 个`, note: "一场一个" })
  }

  const rice: Line[] = []
  if (sum.fried_rice > 0) {
    const rawOz = sum.fried_rice / RICE_COOKED_PER_RAW
    // 写煮好的熟饭（老板 2026-10-22），带上每人多少；生米几杯只是顺手给个参照。
    rice.push({
      label: "熟米饭",
      amount: `${up(sum.fried_rice)} 盎司`,
      note: `每人 ${FRIED_RICE.adult} 盎司（小孩 ${FRIED_RICE.child}）· ${lb(sum.fried_rice)} · 大概要煮 ${up(rawOz / RICE_CUP_OZ)} 杯生米（美式量杯）`,
    })
  }
  return { meat, vege, vegeNet, rice }
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

/**
 * 整份可打印的页面：传进来的几场合成一张（一天的全部，或某位负责人的那几场）。
 * who = 这张是谁的（按负责人打印时），不传就是"全部"。
 */
export function coolerSheetHtml(ymd: string, parties: CoolerParty[], who?: string | null): string {
  const { meat, vege, vegeNet, rice } = workLines(parties)
  const adults = parties.reduce((n, p) => n + p.adults, 0)
  const kids = parties.reduce((n, p) => n + p.kids, 0)
  const unknown = parties.filter((p) => !p.menuKnown)
  const sec = (title: string, lines: Line[]) =>
    lines.length
      ? `<div class="sec"><h2>${esc(title)}</h2><table>${lines
          .map((l) => `<tr><td class="box"><span></span></td><td class="name">${esc(l.label)}${l.note ? `<small>${esc(l.note)}</small>` : ""}</td><td class="amt">${esc(l.amount)}</td></tr>`)
          .join("")}</table></div>`
      : ""
  // 老板 2026-10-22：不列是哪几场、不印备注——这张纸只管切多少、煮多少。
  const body = sec("肉和豆腐", meat) + sec(`蔬菜（切好后的净重，合计 ${up(vegeNet)} 盎司）`, vege) + sec("米饭", rice)
  const page = parties.length
    ? `<section class="page">
<header>
  <div class="meta"><div class="day">${esc(zhDate(ymd))}</div><div>共 ${parties.length} 场 · ${adults} 位大人${kids ? `、${kids} 位小孩` : ""}</div></div>
  <div class="owner"><small>备货负责人</small>${who ? esc(who) : `<span class="blank"></span>`}</div>
</header>
${unknown.length ? `<div class="warn">有 ${unknown.length} 场菜还没定，那几场的肉和豆腐没算进去，等通知。</div>` : ""}
${body || `<div class="warn">这几场没有要提前切、要煮的东西。</div>`}
<footer>做好一样，打一个勾 ✓<div class="hint">数量是大概的，多一点没关系。每一场分多少，师傅自己来拿。</div></footer>
</section>`
    : `<section class="page"><div class="warn">这一天没有要备的单。</div></section>`
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>备货单 ${esc(zhDate(ymd))}</title>
<style>
*{box-sizing:border-box}
body{margin:0;background:#fff;color:#000;font-family:"Microsoft YaHei","PingFang SC","Noto Sans SC","Heiti SC",sans-serif;font-size:22px;line-height:1.25}
.bar{padding:14px 20px;background:#f2f2f2;display:flex;gap:14px;align-items:center;font-size:18px}
.bar button{font:inherit;font-size:22px;font-weight:700;padding:10px 26px;border:3px solid #000;background:#000;color:#fff;border-radius:8px;cursor:pointer}
.page{width:720px;margin:0 auto;padding:18px 0 10px;page-break-inside:avoid;break-inside:avoid}
header{display:flex;gap:18px;align-items:center;border-bottom:4px solid #000;padding-bottom:8px;margin-bottom:2px}
.meta{font-size:22px;font-weight:600}
.meta .day{font-size:32px;font-weight:900}
.owner{margin-left:auto;text-align:center;font-size:30px;font-weight:900;border:4px solid #000;border-radius:8px;padding:6px 14px;min-width:150px}
.owner small{display:block;font-size:15px;font-weight:600}
.owner .blank{display:block;height:36px}
.warn{margin:10px 0 0;padding:8px 12px;border:4px dashed #000;font-size:24px;font-weight:800}
h2{font-size:22px;font-weight:900;margin:12px 0 0;padding:2px 10px;background:#000;color:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
table{width:100%;border-collapse:collapse}
td{padding:7px 6px;border-bottom:2px solid #999;vertical-align:middle}
td.box{width:48px}
td.box span{display:block;width:32px;height:32px;border:3px solid #000;border-radius:4px}
td.name{font-size:30px;font-weight:800}
td.name small{display:block;font-size:17px;font-weight:500;color:#333;margin-top:2px}
td.amt{font-size:36px;font-weight:900;text-align:right;white-space:nowrap}
.sec{break-inside:avoid;page-break-inside:avoid}
footer{margin-top:10px;font-size:18px;font-weight:600;text-align:center}
footer .hint{font-weight:500;margin-top:4px}
@media print{.bar{display:none}.page{padding:0}@page{margin:10mm}}
</style></head><body>
<div class="bar"><button onclick="window.print()">打印</button><span>${esc(zhDate(ymd))}${who ? ` · ${esc(who)}` : ""} · ${parties.length} 场合成一张</span></div>
${page}
<script>
// 一张纸放得下：信纸去掉页边距约 950px 高，超过就整页等比缩小。
(function(){var MAX=950;function fit(){var p=document.querySelector(".page");if(!p)return;p.style.zoom="1";var h=p.scrollHeight;if(h>MAX)p.style.zoom=String(Math.floor(MAX/h*1000)/1000)}
fit();window.addEventListener("load",fit);window.addEventListener("beforeprint",fit)})();
</script>
</body></html>`
}
