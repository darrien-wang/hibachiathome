/**
 * 订单另加（自定义项，老板 2026-11-21：「那就订单这里加个自定义项，以后可能还有很多新的需求，到时候就从
 * 这个地方走」）：菜单上没有的东西按单记在 invoice_data.customItems——英文名（账单上客人看的）、中文名、
 * 数量、单位、单价（0 = 送的，账单上写 On us）、备注（给备货和师傅看，"生米每份约 3 oz"）。第一个是
 * Ashley（RH-20261117-3312）一位客人要的白米饭，送的（「白米饭不收钱」）。备货清单上一项一行，中文名在前，
 * 备注写在提示里；不进师傅的桌椅钱（setupCountsOf 不数它）。工作台订单弹窗「订单另加」和
 * `desk order set <单号> --custom-item "Plain rice|白米饭|2|serving|0|生米每份约 3 oz"` 改它。
 * 镜像发票仓库 lib/pricing.ts 的 sanitizeCustomItems / customItemRowId / customUnitZh（同一天改）。
 *
 * 账单、价格、师傅备料单、改单通知都在发票仓库；这边是镜像（备货清单）和编辑入口
 * （app/api/admin/orders/custom-items：按订单 id 读发票应用的那份发票，换上这些项，走 save-invoice 存，
 * 和 desk、发票工具同一条路，所以改单通知和审查指纹照常）。
 */
export type CustomItemLite = { name: string; nameZh?: string; qty: number; unit: string; price: number; note?: string }
export const CUSTOM_ITEMS_MAX = 20
export const CUSTOM_ITEM_LIMITS = { name: 60, nameZh: 30, unit: 20, note: 120, qty: 999, price: 5000 } as const

const oneLine = (value: unknown, max: number): string =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max).trim() : ""
const roundCents = (n: number) => Math.round(n * 100) / 100

/** 一项的「钥匙」：名字，不分大小写和空格。同一单里同名的只算第一项。 */
export function customItemKey(name: unknown): string {
  return oneLine(name, CUSTOM_ITEM_LIMITS.name).toLowerCase()
}

/** 存着的自定义项，清理过的：要有名字、数量大于 0、单价不是负数，否则这一项不算（不备、不收钱）。 */
export function sanitizeCustomItems(value: unknown): CustomItemLite[] | undefined {
  if (!Array.isArray(value)) return undefined
  const out: CustomItemLite[] = []
  const seen = new Set<string>()
  for (const raw of value) {
    if (out.length >= CUSTOM_ITEMS_MAX) break
    if (!raw || typeof raw !== "object") continue
    const r = raw as Record<string, unknown>
    const name = oneLine(r.name, CUSTOM_ITEM_LIMITS.name)
    const key = name.toLowerCase()
    const qty = typeof r.qty === "number" && Number.isFinite(r.qty) ? roundCents(r.qty) : 0
    const price = typeof r.price === "number" && Number.isFinite(r.price) ? roundCents(r.price) : -1
    if (!name || seen.has(key) || qty <= 0 || qty > CUSTOM_ITEM_LIMITS.qty || price < 0 || price > CUSTOM_ITEM_LIMITS.price) continue
    seen.add(key)
    const nameZh = oneLine(r.nameZh, CUSTOM_ITEM_LIMITS.nameZh)
    const note = oneLine(r.note, CUSTOM_ITEM_LIMITS.note)
    out.push({
      name,
      ...(nameZh ? { nameZh } : {}),
      qty,
      unit: oneLine(r.unit, CUSTOM_ITEM_LIMITS.unit) || "each",
      price: price === 0 ? 0 : price,
      ...(note ? { note } : {}),
    })
  }
  return out.length > 0 ? out : undefined
}

/** 一张订单的自定义项（清理过的）；没有就是 []。 */
export function customItemsOf(inv: { customItems?: unknown } | null | undefined): CustomItemLite[] {
  return sanitizeCustomItems(inv?.customItems) ?? []
}

/** 一项在备货清单和师傅备料单上的行 id：按名字来，每次保存都一样（和发票仓库同一个算法）。 */
export function customItemRowId(name: unknown): string {
  const key = customItemKey(name)
  let h = 0x811c9dc5
  for (const ch of key) h = Math.imul(h ^ (ch.codePointAt(0) ?? 0), 0x01000193) >>> 0
  return `custom_${h.toString(36)}`
}

const CUSTOM_UNIT_ZH: Record<string, string> = {
  serving: "份", servings: "份", order: "份", orders: "份", portion: "份", portions: "份",
  each: "个", piece: "个", pieces: "个", pc: "个", pcs: "个",
  bag: "袋", bags: "袋", box: "盒", boxes: "盒", tray: "盘", trays: "盘", bottle: "瓶", bottles: "瓶",
  pack: "包", packs: "包", set: "套", sets: "套", lb: "磅", lbs: "磅",
}

/** 单位的中文说法（serving → 份）；没对上的照写。 */
export function customUnitZh(unit: string): string {
  return CUSTOM_UNIT_ZH[unit.trim().toLowerCase()] ?? unit
}

/** 给客人看的数量（英文）："2 servings"、"1 bag"、"3 boxes"；两个字母的单位（oz、lb）照写，each 只写数。 */
export function customQtyText(qty: number, unit: string): string {
  const u = unit.trim()
  if (!u || u.toLowerCase() === "each") return `${qty}`
  if (qty === 1 || u.length <= 2 || !/^[a-z]+$/i.test(u) || /s$/i.test(u)) return `${qty} ${u}`
  if (/(x|z|ch|sh)$/i.test(u)) return `${qty} ${u}es`
  if (/[^aeiou]y$/i.test(u)) return `${qty} ${u.slice(0, -1)}ies`
  return `${qty} ${u}s`
}

/** 一项在备货清单上怎么叫：中文名在前、英文名在后；没中文名就写英文。 */
export function customItemLabel(item: Pick<CustomItemLite, "name" | "nameZh">): string {
  return item.nameZh ? `${item.nameZh} ${item.name}` : item.name
}

/**
 * 工作台订单弹窗交上来的一整份（要存成的样子）：每一项都要过得了上面的清理，不悄悄丢——丢一项就是少备、
 * 少收钱，所以有问题的整份退回，说清楚第几项哪里不对。空的一份 = 全部去掉。
 */
export function parseCustomItemsInput(raw: unknown): { items: CustomItemLite[]; errors: string[] } {
  if (!Array.isArray(raw)) return { items: [], errors: ["items 要是一个列表"] }
  if (raw.length > CUSTOM_ITEMS_MAX) return { items: [], errors: [`一单最多 ${CUSTOM_ITEMS_MAX} 项`] }
  const errors: string[] = []
  const seen = new Set<string>()
  raw.forEach((x, i) => {
    const r = (x && typeof x === "object" ? x : {}) as Record<string, unknown>
    const at = `第 ${i + 1} 项`
    const name = oneLine(r.name, 1000)
    if (!name) errors.push(`${at}：要有英文名（账单上客人看的）`)
    else if (name.length > CUSTOM_ITEM_LIMITS.name) errors.push(`${at}：英文名最多 ${CUSTOM_ITEM_LIMITS.name} 个字`)
    else if (seen.has(name.toLowerCase())) errors.push(`${at}：「${name}」重复了`)
    seen.add(name.toLowerCase())
    if (oneLine(r.nameZh, 1000).length > CUSTOM_ITEM_LIMITS.nameZh) errors.push(`${at}：中文名最多 ${CUSTOM_ITEM_LIMITS.nameZh} 个字`)
    if (oneLine(r.unit, 1000).length > CUSTOM_ITEM_LIMITS.unit) errors.push(`${at}：单位最多 ${CUSTOM_ITEM_LIMITS.unit} 个字`)
    if (oneLine(r.note, 1000).length > CUSTOM_ITEM_LIMITS.note) errors.push(`${at}：备注最多 ${CUSTOM_ITEM_LIMITS.note} 个字`)
    if (typeof r.qty !== "number" || !Number.isFinite(r.qty) || roundCents(r.qty) <= 0 || r.qty > CUSTOM_ITEM_LIMITS.qty) errors.push(`${at}：数量要大于 0（最多 ${CUSTOM_ITEM_LIMITS.qty}）`)
    if (typeof r.price !== "number" || !Number.isFinite(r.price) || r.price < 0 || r.price > CUSTOM_ITEM_LIMITS.price) errors.push(`${at}：单价是美元数，0 = 送的（最多 ${CUSTOM_ITEM_LIMITS.price}）`)
    for (const [field, label] of [["name", "英文名"], ["nameZh", "中文名"], ["unit", "单位"], ["note", "备注"]] as const) {
      if (typeof r[field] === "string" && (r[field] as string).includes("\uFFFD")) errors.push(`${at}：${label}里有乱码（编码坏了），重新打一遍`)
    }
  })
  if (errors.length) return { items: [], errors }
  return { items: sanitizeCustomItems(raw) ?? [], errors: [] }
}

/** 两份是不是一样（顺序也算）：一样就不用存。 */
export function sameCustomItems(a: unknown, b: unknown): boolean {
  return JSON.stringify(sanitizeCustomItems(a) ?? []) === JSON.stringify(sanitizeCustomItems(b) ?? [])
}

/** 一项一句（中文，给工作台和事件记录）："白米饭 Plain rice ×2 serving · 送的 · 生米每份约 3 oz"。 */
export function customItemLine(it: CustomItemLite): string {
  return `${customItemLabel(it)} ×${it.qty} ${it.unit} · ${it.price > 0 ? `$${it.price.toFixed(2)}/${it.unit === "each" ? "个" : it.unit}` : "送的（On us）"}${it.note ? ` · ${it.note}` : ""}`
}
