// 盘点的语音 / AI（老板 2026-11-26「最好能够支持语音输入和 AI 交互盘点」）。
// 师傅对着手机说「CK 三盘整的，还有一盘散的两磅半；毛豆 12 盎司的四包」→ 转文字 → 模型拆成每样东西的几行
// （和手点出来的同一个 CountLine）→ 填进页面，师傅看一眼再提交。AI 只填，不替人提交；拿不准就问一句。
// 这个文件是纯函数（提示词 + 校验模型的回答），网络调用在 /api/tools/stock/voice。

import {
  RESTOCK_CHECK,
  STOCK_ITEMS,
  baseUnitOf,
  describeTotal,
  itemDef,
  lineText,
  totalBase,
  type AmountUnit,
  type CountLine,
  type CustomSpec,
  type RestockLevel,
  type StockItemDef,
} from "@/lib/stocktake"

/** 转写时给模型的词表：缩写、品名、单位，免得 "CK" 听成 "see k"。 */
export const TRANSCRIBE_PROMPT =
  "盘点冰箱。CK 鸡肉, ST 牛肉 steak, FM 菲力 filet, 沙拉 salad, 西葫芦 zucchini, 西兰花 broccoli, 虾 shrimp, 三文鱼 salmon, 龙虾 lobster, 扇贝 scallop, 饺子 gyoza, 春卷 spring roll, 毛豆 edamame, 鸡蛋, 洋葱, 胡萝卜, 豆腐, 面。整盘, 散的, 一包, 一袋, 一盒, 磅 lb, 盎司 oz, 只, 条, 个, 根。"

export type ChatTurn = { who: "chef" | "ai"; text: string }

function catalogText(specs: CustomSpec[]): string {
  const lines = STOCK_ITEMS.map((d) => {
    const all = [...d.specs.map((s) => ({ id: s.id, label: s.label, amount: s.amount, unit: s.unit })), ...specs.filter((s) => s.item_key === d.key)]
    const specText = all.map((s) => `${s.id}=「${s.label}」每包${s.amount}${s.unit === "piece" ? (d.piece?.noun ?? "个") : s.unit}`).join("；") || "（没有固定规格）"
    const loose = [d.ozPerBase ? "lb/oz 称重" : null, d.piece ? `按${d.piece.noun}数（piece）` : null].filter(Boolean).join("、")
    return `- ${d.key}：${d.label}（叫法：${d.codes.join("/")}）；散的可以 ${loose || "—"}；规格：${specText}`
  })
  const restock = RESTOCK_CHECK.map((r) => `- ${r.key}：${r.label}（${r.codes.join("/")}）`)
  return `要数数量的东西：\n${lines.join("\n")}\n\n补货型（只说够 ok / 快没了 low / 没了 out）：\n${restock.join("\n")}`
}

function draftText(draft: Record<string, CountLine[]>): string {
  const rows = Object.entries(draft)
    .map(([k, lines]) => {
      const d = itemDef(k)
      if (!d) return null
      return `- ${k}：${lines.length ? lines.map((l) => lineText(d, l)).join(" + ") : "没有（0）"}`
    })
    .filter(Boolean)
  return rows.length ? rows.join("\n") : "（还没填）"
}

export function stockAiMessages(input: { specs: CustomSpec[]; draft: Record<string, CountLine[]>; levels: Record<string, RestockLevel>; history: ChatTurn[]; said: string }) {
  const system = `你是 Real Hibachi 的盘点助手。师傅站在冰箱前，用中文、英文或者混着说他数到的东西，你把它变成结构化的盘点记录。

${catalogText(input.specs)}

规则：
1. 只记师傅说出来的东西；没说的不要编。数量听不清、规格对不上、或者一包多重不知道，就不要猜，在 questions 里问一句。
2. 整包用规格：lines 里写 {"kind":"pack","spec_id":"上面的 id","packs":几包}。师傅说的包装上面没有（比如「毛豆 16 盎司一包」而没有 16oz 规格），用 {"kind":"pack_new","amount":16,"unit":"oz","label":"16 oz/包","packs":4}；unit 只能是 oz / lb / piece。
3. 拆开的、散的用 {"kind":"loose","amount":数,"unit":"lb|oz|piece"}。「两磅半」= 2.5 lb；「半盘」这种对得上规格的写 pack 加小数 packs:0.5。
4. 一样东西说「没有了 / 没了 / 零」：zero:true，lines 留空。
5. mode：师傅是在报这样东西的总数就用 "replace"（默认）；明确说「再加」「还有」补充之前报过的才用 "add"。
6. 补货型只写进 restock：够 ok、快没了 low、没了 out。
7. say：给师傅的一两句中文，先复述你记下了什么（简短，比如「鸡肉 3 盘 + 散 2.5 磅，毛豆 12oz × 4」），有问题再问；不要客套。
8. 只回 JSON：{"items":[{"item_key":"","mode":"replace","zero":false,"lines":[...]}],"restock":[{"item_key":"","level":"ok"}],"questions":[""],"say":""}`

  const context = `目前页面上已经填了：\n${draftText(input.draft)}${Object.keys(input.levels).length ? `\n补货型：${Object.entries(input.levels).map(([k, v]) => `${k}=${v}`).join("，")}` : ""}`
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [{ role: "system", content: system }]
  for (const t of input.history.slice(-6)) messages.push({ role: t.who === "chef" ? "user" : "assistant", content: t.text.slice(0, 1500) })
  messages.push({ role: "user", content: `${context}\n\n师傅刚说：${input.said.slice(0, 2000)}` })
  return messages
}

/** 模型的回答校验后的样子。newSpecs = 要先建的规格（建好之后把 pending 换成真 id）。 */
export type AiItem = { key: string; mode: "replace" | "add"; lines: Array<CountLine | PendingPack> }
export type PendingPack = { kind: "pending"; amount: number; unit: AmountUnit; label: string; packs: number }
export type AiResult = { items: AiItem[]; restock: Array<{ key: string; level: RestockLevel }>; questions: string[]; say: string }

const UNITS = new Set(["oz", "lb", "piece"])
const num = (v: unknown) => {
  const n = typeof v === "string" ? Number(v.trim()) : Number(v)
  return Number.isFinite(n) ? n : NaN
}

/** 把模型吐出来的 JSON 洗干净：认不出的东西、对不上的规格、离谱的数一律丢掉（或变成一个问题）。 */
export function normalizeAi(raw: unknown, specs: CustomSpec[]): AiResult {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
  const questions = (Array.isArray(o.questions) ? o.questions : []).map((q) => String(q ?? "").trim()).filter(Boolean).slice(0, 4)
  const items: AiItem[] = []
  for (const it of Array.isArray(o.items) ? o.items : []) {
    const r = (it && typeof it === "object" ? it : {}) as Record<string, unknown>
    const def = itemDef(String(r.item_key ?? ""))
    if (!def || items.some((x) => x.key === def.key)) continue
    const mode = r.mode === "add" ? "add" : "replace"
    if (r.zero === true) {
      items.push({ key: def.key, mode: "replace", lines: [] })
      continue
    }
    const lines: Array<CountLine | PendingPack> = []
    for (const l of Array.isArray(r.lines) ? r.lines : []) {
      const x = cleanAiLine(def, l, specs)
      if (x === "bad") questions.push(`${def.label}有一句没听懂，再说一遍数量？`)
      else if (x) lines.push(x)
    }
    if (lines.length) items.push({ key: def.key, mode, lines })
  }
  const restock: AiResult["restock"] = []
  for (const it of Array.isArray(o.restock) ? o.restock : []) {
    const r = (it && typeof it === "object" ? it : {}) as Record<string, unknown>
    const key = String(r.item_key ?? "")
    if (!RESTOCK_CHECK.some((x) => x.key === key)) continue
    if (r.level === "ok" || r.level === "low" || r.level === "out") restock.push({ key, level: r.level })
  }
  return { items, restock, questions: [...new Set(questions)].slice(0, 4), say: String(o.say ?? "").trim().slice(0, 400) }
}

function cleanAiLine(def: StockItemDef, raw: unknown, specs: CustomSpec[]): CountLine | PendingPack | "bad" | null {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
  if (r.kind === "pack") {
    const packs = num(r.packs)
    const all = [...def.specs, ...specs.filter((s) => s.item_key === def.key)]
    const s = all.find((x) => x.id === r.spec_id)
    if (!s || !(packs >= 0) || packs > 1000) return "bad"
    return { kind: "pack", specId: s.id, specLabel: s.label, amount: s.amount, unit: s.unit, packs }
  }
  if (r.kind === "pack_new") {
    const amount = num(r.amount)
    const packs = num(r.packs)
    const unit = String(r.unit ?? "")
    if (!UNITS.has(unit) || !(amount > 0) || amount > 1000 || !(packs >= 0) || packs > 1000) return "bad"
    if (unit === "piece" && !def.piece) return "bad"
    if (unit !== "piece" && !def.ozPerBase) return "bad"
    // 其实已经有这个规格（同量同单位）就直接用，不重复建
    const same = [...def.specs, ...specs.filter((s) => s.item_key === def.key)].find((x) => x.unit === unit && Math.abs(x.amount - amount) < 1e-6)
    if (same) return { kind: "pack", specId: same.id, specLabel: same.label, amount: same.amount, unit: same.unit, packs }
    const label = String(r.label ?? "").trim().slice(0, 40) || `${amount} ${unit === "piece" ? (def.piece?.noun ?? "个") : unit}/包`
    return { kind: "pending", amount, unit: unit as AmountUnit, label, packs }
  }
  if (r.kind === "loose") {
    const amount = num(r.amount)
    const unit = String(r.unit ?? "")
    if (!UNITS.has(unit) || !(amount >= 0) || amount > 10000) return "bad"
    if (unit === "piece" && !def.piece) return "bad"
    if (unit !== "piece" && !def.ozPerBase) return "bad"
    return { kind: "loose", amount, unit: unit as AmountUnit }
  }
  return null
}

/** 填好之后给师傅看的一行一样："毛豆：12 oz/包 × 4 → 4 份"。 */
export function filledSummary(items: Array<{ key: string; lines: CountLine[] }>): string[] {
  return items.map(({ key, lines }) => {
    const d = itemDef(key)
    if (!d) return key
    return lines.length ? `${d.label}：${lines.map((l) => lineText(d, l)).join(" + ")} → ${describeTotal(d, totalBase(d, lines))}` : `${d.label}：没有了（0 ${baseUnitOf(key)}）`
  })
}
