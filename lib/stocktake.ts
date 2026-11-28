// 师傅盘点（老板 2026-11-26）。有了全职师傅，冰箱里的实数由师傅随时盘、直接进备货系统：
// 盘完写 pantry_stock（和备货页「对货」同一个口子，set 绝对值 + counted_at），备货页的「在库」就是这次盘的数。
// 浏览器和服务器都用这份，不 import node 模块。
//
// 顺序按保质期，短保在前（老板原话的顺序）：
//   肉 鸡肉 CK / 牛肉 ST / 菲力 FM → 菜 沙拉 / 西葫芦 / 西兰花 → 冷冻 虾 / 三文鱼 / 龙虾 / 扇贝 → 前菜 饺子 / 春卷 / 毛豆
// 再往后是顺手看一眼的（鸡蛋、洋葱、胡萝卜、豆腐、面）和补货型（米油酱，只报够不够）。
//
// 一样东西可以记好几行：
//   整包：选一个规格 × 几包（毛豆 12oz/包 × 4 + 16oz/包 × 2）。规格分系统自带的和师傅自己加的（stock_specs，加了就能用）。
//   散的：拆开了的，称重（lb / oz）或者数个数（虾几只、龙虾几条）。
// 每行最后都换算成库存基准单位（lib/pantry.ts STOCK_UNITS：肉菜按 oz、虾按只、带子和前菜按个、沙拉毛豆按份）。

import { STOCK_UNITS } from "@/lib/pantry"

export type StockGroup = "meat" | "veg" | "frozen" | "app" | "other" | "restock"

export const STOCK_GROUPS: Array<{ id: StockGroup; title: string; hint: string; everyDays: number }> = [
  { id: "meat", title: "肉 · 短保", hint: "每次都盘", everyDays: 1 },
  { id: "veg", title: "菜 · 短保", hint: "每次都盘", everyDays: 1 },
  { id: "frozen", title: "冷冻 · 中长保", hint: "一周盘一次", everyDays: 7 },
  { id: "app", title: "前菜 · 冷冻", hint: "一周盘一次", everyDays: 7 },
  { id: "other", title: "其他 · 顺手看一眼", hint: "一周一次", everyDays: 7 },
  { id: "restock", title: "补货型 · 米油酱", hint: "不用数，只说够不够；一个月看一次，快没了随时报", everyDays: 30 },
]

/** 输入单位：oz / lb 是称重；piece 是数个数（名词在 piece.noun）；pack 只出现在规格里。 */
export type AmountUnit = "oz" | "lb" | "piece" | "base"

export type BuiltinSpec = { id: string; label: string; amount: number; unit: AmountUnit }

export type StockItemDef = {
  key: string
  /** 师傅嘴里的缩写，语音和搜索都认。 */
  codes: string[]
  label: string
  en: string
  group: StockGroup
  /** 1 个库存基准单位有多重（oz）。称重换算用；null = 不能称（只能数/按规格）。 */
  ozPerBase: number | null
  /** 散的按个数：1 个（只/条/根）= 多少基准单位。 */
  piece?: { noun: string; base: number }
  /** 散的默认怎么记：称重还是数个数。 */
  looseBy: "weight" | "piece"
  /** 每位客人用多少基准单位：卡片上给"≈ N 人份"。 */
  perGuest?: number
  specs: BuiltinSpec[]
}

// 规格的数字全来自 lib/prep-bom.ts BUY_UNITS / PACK_NOTES 里老板给过的实物（不猜）；不对的话师傅在页面上加一个自己的规格就行。
export const STOCK_ITEMS: StockItemDef[] = [
  // —— 肉 ——
  { key: "chicken", codes: ["ck", "chicken", "鸡", "鸡肉", "鸡胸"], label: "鸡肉", en: "Chicken", group: "meat", ozPerBase: 1, looseBy: "weight", perGuest: 5, specs: [{ id: "b:chicken:tray", label: "一盘 ≈4.5 lb", amount: 4.5, unit: "lb" }] },
  { key: "steak", codes: ["st", "steak", "牛", "牛肉", "牛排", "西冷"], label: "牛肉", en: "Steak", group: "meat", ozPerBase: 1, looseBy: "weight", perGuest: 4.5, specs: [{ id: "b:steak:costco", label: "Costco 一盒 ≈3.2 lb", amount: 3.2, unit: "lb" }] },
  { key: "filet_mignon", codes: ["fm", "filet", "菲力"], label: "菲力", en: "Filet Mignon", group: "meat", ozPerBase: 1, looseBy: "weight", perGuest: 4.5, specs: [{ id: "b:filet:costco", label: "Costco 一盒 ≈2.3 lb", amount: 2.3, unit: "lb" }] },
  // —— 菜 ——
  { key: "salad", codes: ["salad", "沙拉", "沙拉菜"], label: "沙拉", en: "Salad", group: "veg", ozPerBase: 1, looseBy: "weight", perGuest: 1, specs: [{ id: "b:salad:3lb", label: "RD 一袋 3 lb", amount: 3, unit: "lb" }] },
  { key: "zucchini", codes: ["zucchini", "zuc", "西葫芦"], label: "西葫芦", en: "Zucchini", group: "veg", ozPerBase: 1, piece: { noun: "根", base: 11 }, looseBy: "piece", specs: [] },
  { key: "broccoli", codes: ["broccoli", "bro", "西兰花"], label: "西兰花", en: "Broccoli", group: "veg", ozPerBase: 1, looseBy: "weight", specs: [{ id: "b:broccoli:32", label: "一袋 32 oz", amount: 32, unit: "oz" }] },
  // —— 冷冻 ——
  { key: "shrimp", codes: ["shrimp", "虾"], label: "虾", en: "Shrimp 16/20", group: "frozen", ozPerBase: 16 / 18, piece: { noun: "只", base: 1 }, looseBy: "piece", perGuest: 5, specs: [{ id: "b:shrimp:bag", label: "一袋 ≈32 只", amount: 32, unit: "piece" }] },
  { key: "salmon", codes: ["salmon", "三文鱼"], label: "三文鱼", en: "Salmon", group: "frozen", ozPerBase: 1, piece: { noun: "块", base: 8 }, looseBy: "piece", perGuest: 4, specs: [{ id: "b:salmon:piece", label: "分装 1 块 = 8 oz", amount: 1, unit: "piece" }] },
  { key: "lobster_tail", codes: ["lobster", "龙虾", "龙虾尾"], label: "龙虾", en: "Lobster Tail", group: "frozen", ozPerBase: 1, piece: { noun: "条", base: 6 }, looseBy: "piece", perGuest: 6, specs: [{ id: "b:lobster:box", label: "一盒 2 条", amount: 2, unit: "piece" }] },
  // 带子 2026-11-28 起按个（老板：每份 6 个，10/20 规格），库存记个数，默认数个数。称重还能用，按 09-24 的 1 个 ≈ 1 oz 折
  // （10/20 是一磅 10–20 个，一个 0.8–1.6 oz，称出来的个数是估的）。原来的整袋规格「RD 一袋 5 lb」拿掉了：一袋多少个老板没给。
  { key: "scallops", codes: ["scallop", "scallops", "扇贝", "带子"], label: "扇贝", en: "Scallops 10/20", group: "frozen", ozPerBase: 1, piece: { noun: "个", base: 1 }, looseBy: "piece", perGuest: 6, specs: [] },
  // —— 前菜 ——
  { key: "gyoza", codes: ["gyoza", "饺子", "煎饺"], label: "饺子", en: "Gyoza", group: "app", ozPerBase: 46.5 / 40, piece: { noun: "个", base: 1 }, looseBy: "piece", specs: [{ id: "b:gyoza:bag", label: "一袋 ≈40 个", amount: 40, unit: "piece" }] },
  { key: "spring_rolls", codes: ["spring roll", "springroll", "春卷"], label: "春卷", en: "Spring Roll", group: "app", ozPerBase: 24.5 / 8, piece: { noun: "个", base: 1 }, looseBy: "piece", specs: [{ id: "b:spring:box", label: "一盒 ≈8 个", amount: 8, unit: "piece" }] },
  { key: "edamame", codes: ["edamame", "毛豆"], label: "毛豆", en: "Edamame", group: "app", ozPerBase: 12, looseBy: "weight", specs: [{ id: "b:edamame:12", label: "12 oz/包", amount: 12, unit: "oz" }, { id: "b:edamame:16", label: "16 oz/包", amount: 16, unit: "oz" }] },
  // —— 其他 ——
  { key: "eggs", codes: ["egg", "eggs", "鸡蛋", "蛋"], label: "鸡蛋", en: "Eggs", group: "other", ozPerBase: null, piece: { noun: "个", base: 1 }, looseBy: "piece", perGuest: 1, specs: [{ id: "b:eggs:36", label: "一提 36 个", amount: 36, unit: "piece" }, { id: "b:eggs:18", label: "一盒 18 个", amount: 18, unit: "piece" }] },
  { key: "onion", codes: ["onion", "洋葱"], label: "洋葱", en: "Onion", group: "other", ozPerBase: 1, piece: { noun: "个", base: 12 }, looseBy: "piece", specs: [] },
  { key: "carrots", codes: ["carrot", "carrots", "胡萝卜"], label: "胡萝卜", en: "Carrots", group: "other", ozPerBase: 1, looseBy: "weight", specs: [{ id: "b:carrots:2lb", label: "一袋 2 lb", amount: 2, unit: "lb" }] },
  { key: "tofu", codes: ["tofu", "豆腐"], label: "豆腐", en: "Tofu", group: "other", ozPerBase: 1, looseBy: "piece", piece: { noun: "盒", base: 16 }, perGuest: 5, specs: [] },
  { key: "noodles", codes: ["noodle", "noodles", "面", "面条"], label: "面（干面）", en: "Noodles", group: "other", ozPerBase: 1, looseBy: "weight", specs: [{ id: "b:noodles:10lb", label: "一箱 10 lb", amount: 10, unit: "lb" }] },
]

/** 补货型：不数量，只报 够 / 快没了 / 没了（lib/pantry.ts RESTOCK_ITEMS 那一类）。 */
export const RESTOCK_CHECK: Array<{ key: string; label: string; codes: string[] }> = [
  { key: "fried_rice", label: "米", codes: ["rice", "米", "大米"] },
  { key: "oil", label: "油", codes: ["oil", "油"] },
  { key: "soy_sauce", label: "酱油", codes: ["soy", "酱油"] },
  { key: "teriyaki", label: "照烧汁", codes: ["teriyaki", "照烧"] },
  { key: "ginger_sauce", label: "Yum Yum 酱", codes: ["yum yum", "yumyum"] },
  { key: "ginger_dressing", label: "姜汁沙拉酱", codes: ["ginger", "姜汁"] },
  { key: "garlic_butter", label: "黄油", codes: ["butter", "黄油"] },
  { key: "garlic", label: "蒜蓉", codes: ["garlic", "蒜"] },
  { key: "fried_rice_seasoning", label: "炒饭料（冻青豆胡萝卜）", codes: ["peas", "青豆", "炒饭料"] },
  { key: "lime", label: "青柠", codes: ["lime", "青柠"] },
  { key: "sake", label: "清酒", codes: ["sake", "清酒"] },
]

export type RestockLevel = "ok" | "low" | "out"
export const RESTOCK_LEVEL_LABEL: Record<RestockLevel, string> = { ok: "够", low: "快没了", out: "没了" }

export const itemDef = (key: string) => STOCK_ITEMS.find((i) => i.key === key)
export const baseUnitOf = (key: string) => STOCK_UNITS[key] ?? "oz"

/** 自定义规格（stock_specs 一行）。 */
export type CustomSpec = { id: string; item_key: string; label: string; amount: number; unit: AmountUnit; created_by: string | null }

/** 一条盘点记录（一样东西可以有好几条）。 */
export type CountLine =
  | { kind: "pack"; specId: string; specLabel: string; amount: number; unit: AmountUnit; packs: number }
  | { kind: "loose"; amount: number; unit: AmountUnit }

const r2 = (n: number) => Math.round(n * 100) / 100

/** amount + unit → 库存基准单位。称不了的（鸡蛋按重量）返回 null。 */
export function toBase(def: StockItemDef, amount: number, unit: AmountUnit): number | null {
  if (!Number.isFinite(amount) || amount < 0) return null
  if (unit === "base") return amount
  if (unit === "piece") return def.piece ? amount * def.piece.base : null
  const oz = unit === "lb" ? amount * 16 : amount
  return def.ozPerBase ? oz / def.ozPerBase : null
}

/** 一条记录合计多少基准单位。 */
export function lineBase(def: StockItemDef, line: CountLine): number | null {
  const one = toBase(def, line.amount, line.unit)
  if (one == null) return null
  return line.kind === "pack" ? one * Math.max(0, line.packs) : one
}

export function totalBase(def: StockItemDef, lines: CountLine[]): number {
  return r2(lines.reduce((a, l) => a + (lineBase(def, l) ?? 0), 0))
}

const fmt = (n: number) => String(Math.round(n * 10) / 10)

/** "76 oz ≈ 4.8 lb · ≈ 15 人份" —— 卡片底部给师傅自己核对。 */
export function describeTotal(def: StockItemDef, base: number): string {
  const unit = baseUnitOf(def.key)
  const parts = [`${fmt(base)} ${unit === "pcs" ? (def.piece?.noun ?? "个") : unit}`]
  if (unit === "oz" && base >= 16) parts[0] += `（${fmt(base / 16)} lb）`
  if (def.perGuest && base > 0) parts.push(`≈ ${Math.floor(base / def.perGuest)} 人份`)
  return parts.join(" · ")
}

/** 一条记录写成人话："12 oz/包 × 4" / "散的 2.5 lb" / "散的 12 只"。 */
export function lineText(def: StockItemDef, line: CountLine): string {
  if (line.kind === "pack") return `${line.specLabel} × ${fmt(line.packs)}`
  const u = line.unit === "piece" ? (def.piece?.noun ?? "个") : line.unit === "base" ? baseUnitOf(def.key) : line.unit
  return `散的 ${fmt(line.amount)} ${u}`
}

/** 规格的说明："每包 12 oz" / "每包 32 只"。 */
export function specAmountText(def: StockItemDef, amount: number, unit: AmountUnit): string {
  const u = unit === "piece" ? (def.piece?.noun ?? "个") : unit === "base" ? baseUnitOf(def.key) : unit
  return `${fmt(amount)} ${u}`
}

/** 该盘了没有：短保今天（PT）没盘过就该盘；其余超过 everyDays 天。 */
export function isDue(group: StockGroup, countedAt: string | null, now = Date.now()): boolean {
  if (!countedAt) return true
  const g = STOCK_GROUPS.find((x) => x.id === group)
  const days = g?.everyDays ?? 7
  const t = Date.parse(countedAt)
  if (!Number.isFinite(t)) return true
  if (days <= 1) return ptDay(t) !== ptDay(now)
  return now - t > days * 86400_000
}

const ptDay = (t: number) => new Date(t).toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" })

/** 输入单位能选哪些（散的）：能称就给 lb/oz，能数就给个数。 */
export function looseUnits(def: StockItemDef): AmountUnit[] {
  const out: AmountUnit[] = []
  if (def.looseBy === "piece" && def.piece) out.push("piece")
  if (def.ozPerBase) out.push("lb", "oz")
  if (def.looseBy !== "piece" && def.piece) out.push("piece")
  return out
}

export const unitLabel = (def: StockItemDef, unit: AmountUnit) => (unit === "piece" ? (def.piece?.noun ?? "个") : unit === "base" ? baseUnitOf(def.key) : unit)

/** 服务器校验一条记录。 */
export function cleanLine(def: StockItemDef, raw: unknown): CountLine | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const unit = o.unit === "oz" || o.unit === "lb" || o.unit === "piece" || o.unit === "base" ? (o.unit as AmountUnit) : null
  const amount = Number(o.amount)
  if (!unit || !Number.isFinite(amount) || amount < 0 || amount > 100000) return null
  if (toBase(def, amount, unit) == null) return null
  if (o.kind === "pack") {
    const packs = Number(o.packs)
    if (!Number.isFinite(packs) || packs < 0 || packs > 10000) return null
    return { kind: "pack", specId: String(o.specId ?? "").slice(0, 60), specLabel: String(o.specLabel ?? "").slice(0, 60), amount, unit, packs }
  }
  if (o.kind === "loose") return { kind: "loose", amount, unit }
  return null
}

/** 打字过程中的样子（"2."、"0.") 原样留着，能读成数才往上报；中文键盘的「。」「，」也当小数点（2026-11-26 老板：没法输小数点）。 */
export function normalizeDecimal(raw: string): string {
  const t = raw.replace(/[。．，,]/g, ".").replace(/[^\d.]/g, "")
  const i = t.indexOf(".")
  return i < 0 ? t : t.slice(0, i + 1) + t.slice(i + 1).replace(/\./g, "")
}
