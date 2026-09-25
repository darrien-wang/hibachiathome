// 备料采购：把一天的订单折成一张按采购单位的购物清单。
//
// ⚠️ 份量表是 v0-real-hibachi-invoice-generator/lib/pricing.ts 的镜像
// （PROTEIN_PORTIONS / SIDE_PORTIONS / VEGE_* / NOODLE_PORTION / portion
// policy / MISC_*）。厨师备料单和这张采购清单必须说同一套数字：改任何
// 一边的份量，必须同一天改另一边。计算逻辑抄自那边的 calcBom，砍掉了
// 与采购无关的部分（价格、隐藏行规则）。
//
// 采购单位换算（≈）按老板的两个渠道：餐饮批发（油/酱油/米/16-20 虾整箱）
// 和 Walmart 生鲜（鸡胸盘、西冷盘、西葫芦按根、西兰花 32oz 袋、鸡蛋 36 盒、
// Tai Pei 煎饺春卷、毛豆 12oz）。换算系数是估算，帮助下单，不是精确值。

import { TABLECLOTHS, findTheme, findVariant, type SetupSelection } from "@/config/table-themes"

export type PrepItem = {
  id: string
  label: string
  qty: number
  unit: string
  /** 换算成采购单位的提示，如 "≈ 7.9 lb" / "≈ 5 根"。 */
  alt?: string
  group: PrepGroup
  /**
   * 装车清单上的图：盘具按主题分箱，光写"餐具套装"师傅装不对箱。有实拍就给
   * 路径，没有就给色块（从外到内 托盘/盘子/餐具），停车场看手机反而更好认。
   */
  art?: { photo?: string; swatch?: { charger: string; plate: string; accent: string } }
}
export type PrepGroup = "protein" | "produce" | "frozen" | "pantry" | "setup"

export const PREP_GROUP_TITLES: Record<PrepGroup, string> = {
  protein: "蛋白质（按磅买）",
  produce: "生鲜·鸡蛋",
  frozen: "冻品·前菜·面",
  pantry: "调料与大宗（没有就补，不按量算）",
  setup: "桌椅·餐具（装车）",
}

// ---- 镜像份量表（来源见文件头）---------------------------------------

const PROTEIN_PORTIONS: Record<string, { adult: number; child: number; unit: string }> = {
  chicken: { adult: 5, child: 2.5, unit: "oz" },
  steak: { adult: 4.5, child: 2.25, unit: "oz" },
  shrimp: { adult: 5, child: 3, unit: "pcs" },
  salmon: { adult: 4, child: 2, unit: "oz" },
  tofu: { adult: 5, child: 2.5, unit: "oz" },
  scallops: { adult: 4, child: 2, unit: "oz" },
  filet_mignon: { adult: 4.5, child: 2.25, unit: "oz" },
  lobster_tail: { adult: 6, child: 3, unit: "oz" },
}
const PROTEIN_LABELS: Record<string, string> = {
  chicken: "Chicken 鸡胸",
  steak: "Steak 牛排",
  shrimp: "Shrimp 虾 (16/20)",
  salmon: "Salmon 三文鱼",
  tofu: "Tofu 豆腐",
  scallops: "Scallops 带子",
  filet_mignon: "Filet Mignon 菲力",
  lobster_tail: "Lobster Tail 龙虾尾",
}
const FRIED_RICE = { adult: 8, child: 4 } // oz 熟饭
const SALAD = { adult: 1, child: 0.5 } // 份
// 蔬菜（2026-09-22 用户定）：不按固定配比，总量每人 4–5oz 左右即可，
// 西葫芦/西兰花/洋葱/胡萝卜随意搭。低值 4oz 与厨师备料单一致，高值 5oz
// 用来给"买多少"。
const VEGE_OZ_LOW = { adult: 4, child: 2 }
const VEGE_OZ_HIGH = { adult: 5, child: 2.5 }
const NOODLE_PORTION = { adult: 4, child: 2 }
const PORTION_POLICY = { gyozaPcs: 10, springRollPcs: 10, edamameFeeds: 3, diyRiceOz: 4 as number | null }
const LEGACY_PORTION_POLICY = { gyozaPcs: 12, springRollPcs: 12, edamameFeeds: 2, diyRiceOz: null as number | null }
const PORTION_POLICY_CUTOFF_MS = Date.parse("2026-09-02T00:00:00Z")
const MISC_PER_PERSON = [
  { id: "oil", label: "Cooking Oil 油", amount: 1, unit: "tbsp" },
  { id: "garlic_butter", label: "Garlic Butter 蒜香黄油", amount: 0.5, unit: "tbsp" },
  { id: "soy_sauce", label: "Soy Sauce 酱油", amount: 1, unit: "tbsp" },
  { id: "ginger_sauce", label: "Yum Yum Sauce", amount: 1.5, unit: "tbsp" },
  { id: "fried_rice_seasoning", label: "炒饭调味", amount: 0.5, unit: "tbsp" },
]
const MISC_PER_GROUP = [
  { id: "lime", label: "Lime 青柠", perNGuests: 10, unit: "pcs" },
  { id: "eggs", label: "Eggs 鸡蛋（炒饭）", perNGuests: 1, unit: "个" }, // 2026-09-22 用户定：每人 1 个，只许多不许少（正本 pricing.ts 已同步）
]
const GUESTS_PER_TABLE = 4

// ---- 采购单位换算（估算）----------------------------------------------

const OZ_PER = { zucchini: 11, onion: 12 } // 09-22 用实际收据校准：8 根 = 5.7lb、2 个 = 1.6lb（向下取整，买的件数只多不少）
const BAG_OZ = { broccoli: 32, carrots: 12 } // Walmart 袋装
// 三文鱼只能整袋买：Marketside 2 lb 真空袋 = 5 块（≈6.4oz/块，用户 09-24 定）
const SALMON_BAG_OZ = 32
const SHRIMP_PER_LB = 18 // 16/20 规格取中
const EGGS_PER_BOX = 36

/** 宁多勿少（用户 09-22 定）：建议买量 = 需求 × 1.1 再向上取整到采购颗粒度。 */
const BUFFER = 1.1

function alt(id: string, qty: number, unit: string): string | undefined {
  const r1 = (n: number) => Math.round(n * 10) / 10
  const halfLbUp = (lb: number) => Math.ceil(lb * BUFFER * 2) / 2
  if (unit === "oz" && id in OZ_PER) {
    const need = Math.ceil(qty / OZ_PER[id as keyof typeof OZ_PER])
    return `≈ ${need} ${id === "onion" ? "个" : "根"}，买 ${Math.ceil((qty * BUFFER) / OZ_PER[id as keyof typeof OZ_PER])}`
  }
  if (unit === "oz" && id in BAG_OZ) {
    const bag = BAG_OZ[id as keyof typeof BAG_OZ]
    return `买 ${Math.max(1, Math.ceil((qty * BUFFER) / bag))} 袋（${bag}oz 装）`
  }
  // 毛豆：1 份 = 1 袋（12oz，用户 09-24 定）——客户点几份就带几袋
  if (id === "edamame") return `1 份 = 1 袋（12oz），带 ${Math.ceil(qty)} 袋`
  if (id === "salmon") return `买 ${Math.max(1, Math.ceil((qty * BUFFER) / SALMON_BAG_OZ))} 袋（Marketside 2lb 真空袋 = 5 块）`
  if (id === "shrimp") return `≈ ${r1(qty / SHRIMP_PER_LB)} lb，买 ${halfLbUp(qty / SHRIMP_PER_LB)} lb`
  if (id === "eggs") return `带 ${Math.ceil(qty * BUFFER) + 1} 个（36/盒${qty * BUFFER + 1 > EGGS_PER_BOX ? `，要 ${Math.ceil((qty * BUFFER + 1) / EGGS_PER_BOX)} 盒` : ""}）`
  if (unit === "oz" && qty >= 16) return `≈ ${r1(qty / 16)} lb，买 ${halfLbUp(qty / 16)} lb`
  return undefined
}

// ---- 订单数据（orders.invoice_data 的最小形状）------------------------

type QuickItem = { itemId?: string; category?: string; qty?: number; childQty?: number }
type GuestRow = { proteins?: unknown[]; isChild?: boolean; noodles?: boolean }
type Extra = { id?: string; qty?: number }
export type InvoiceLite = {
  mode?: string
  adultCount?: number
  childCount?: number
  guests?: GuestRow[]
  quickCountItems?: QuickItem[]
  partyExtras?: Extra[]
}

export type OrderPrep = {
  adults: number
  kids: number
  /** 蛋白质选择是否已知（false = 只按人头算了主食蔬菜蛋，蛋白缺口要人工问）。 */
  menuKnown: boolean
  /** 每种蛋白的份数（人份，不是重量），给"按单"一行用。 */
  proteinServings: Array<{ id: string; label: string; servings: number }>
  items: PrepItem[]
}

const r1 = (n: number) => Math.round(n * 10) / 10

/** 一张订单 → 用料行。人数以发票为准，发票没有就用订单行上的人数兜底。 */
export function orderPrep(
  inv: InvoiceLite | null | undefined,
  createdAt: string | null,
  fallbackAdults: number,
  fallbackKids: number,
  setup?: SetupSelection | null,
): OrderPrep {
  const data = inv ?? {}
  const adults = Number.isFinite(data.adultCount) && (data.adultCount as number) > 0 ? (data.adultCount as number) : fallbackAdults
  const kids = Number.isFinite(data.childCount) ? (data.childCount as number) : fallbackKids
  const total = adults + kids
  const items: PrepItem[] = []
  const policy = createdAt && Date.parse(createdAt) < PORTION_POLICY_CUTOFF_MS ? LEGACY_PORTION_POLICY : PORTION_POLICY

  // 蛋白：明细模式数每位客人的选择，快速模式用 quickCountItems。
  const servA: Record<string, number> = {}
  const servK: Record<string, number> = {}
  const guests = Array.isArray(data.guests) ? data.guests : []
  const quick = Array.isArray(data.quickCountItems) ? data.quickCountItems : []
  if (data.mode === "detailed" && guests.length) {
    for (const g of guests) {
      for (const pid of Array.isArray(g.proteins) ? g.proteins : []) {
        if (typeof pid !== "string") continue
        if (g.isChild) servK[pid] = (servK[pid] ?? 0) + 1
        else servA[pid] = (servA[pid] ?? 0) + 1
      }
    }
  } else {
    for (const it of quick) {
      if (it.category !== "protein" || typeof it.itemId !== "string") continue
      servA[it.itemId] = (servA[it.itemId] ?? 0) + (it.qty ?? 0)
      servK[it.itemId] = (servK[it.itemId] ?? 0) + (it.childQty ?? 0)
    }
  }
  const proteinServings: OrderPrep["proteinServings"] = []
  for (const pid of new Set([...Object.keys(servA), ...Object.keys(servK)])) {
    const portion = PROTEIN_PORTIONS[pid]
    const servings = (servA[pid] ?? 0) + (servK[pid] ?? 0)
    if (!portion || servings <= 0) continue
    proteinServings.push({ id: pid, label: PROTEIN_LABELS[pid] ?? pid, servings })
    const qty = r1((servA[pid] ?? 0) * portion.adult + (servK[pid] ?? 0) * portion.child)
    items.push({ id: pid, label: PROTEIN_LABELS[pid] ?? pid, qty, unit: portion.unit, alt: alt(pid, qty, portion.unit), group: "protein" })
  }
  const menuKnown = proteinServings.length > 0

  // 主食、蔬菜、蛋：纯按人头，菜单没定也能算。
  const rice = r1(adults * FRIED_RICE.adult + kids * FRIED_RICE.child)
  if (rice > 0) items.push({ id: "fried_rice", label: "Fried Rice 熟饭", qty: rice, unit: "oz", alt: alt("fried_rice", rice, "oz"), group: "pantry" })
  const salad = r1(adults * SALAD.adult + kids * SALAD.child)
  if (salad > 0) items.push({ id: "salad", label: "Salad 沙拉菜", qty: salad, unit: "份", group: "produce" })
  const vegeLow = adults * VEGE_OZ_LOW.adult + kids * VEGE_OZ_LOW.child
  const vegeHigh = adults * VEGE_OZ_HIGH.adult + kids * VEGE_OZ_HIGH.child
  if (vegeLow > 0) {
    const lowLb = Math.round((vegeLow / 16) * 10) / 10
    const buyLb = Math.ceil(((vegeHigh * BUFFER) / 16) * 2) / 2
    items.push({
      id: "mixed_vege",
      label: "蔬菜合计（西葫芦/西兰花/洋葱/胡萝卜随意搭）",
      qty: r1(vegeLow),
      unit: "oz",
      alt: `每人 4–5oz：≈ ${lowLb} lb 起，买 ${buyLb} lb`,
      group: "produce",
    })
  }
  for (const grp of MISC_PER_GROUP) {
    const qty = Math.ceil(total / grp.perNGuests)
    if (qty > 0) items.push({ id: grp.id, label: grp.label, qty, unit: grp.unit, alt: alt(grp.id, qty, grp.unit), group: "produce" })
  }
  for (const m of MISC_PER_PERSON) {
    const qty = r1(m.amount * total)
    if (qty > 0) items.push({ id: m.id, label: m.label, qty, unit: m.unit, group: "pantry" })
  }

  // 面、前菜、DIY 加料、加蛋：跟着 partyExtras / 每位客人的勾选。
  const extras = Array.isArray(data.partyExtras) ? data.partyExtras : []
  let noodleA = 0
  let noodleK = 0
  if (data.mode === "detailed" && guests.length) {
    for (const g of guests) {
      if (!g.noodles) continue
      if (g.isChild) noodleK++
      else noodleA++
    }
  } else {
    const n = extras.find((e) => e.id === "noodles_party")
    if (n?.qty) {
      noodleA = Math.round(n.qty * (adults / Math.max(1, total)))
      noodleK = n.qty - noodleA
    }
  }
  if (noodleA + noodleK > 0) {
    const oz = r1(noodleA * NOODLE_PORTION.adult + noodleK * NOODLE_PORTION.child)
    items.push({ id: "noodles", label: "Noodles 面", qty: oz, unit: "oz", alt: alt("noodles", oz, "oz"), group: "frozen" })
  }
  for (const e of extras) {
    const qty = e.qty ?? 0
    if (qty <= 0) continue
    if (e.id === "gyoza") items.push({ id: "gyoza", label: "Gyoza 煎饺 (Tai Pei)", qty: qty * policy.gyozaPcs, unit: "pcs", group: "frozen" })
    if (e.id === "spring_rolls") items.push({ id: "spring_rolls", label: "Spring Rolls 春卷 (Tai Pei)", qty: qty * policy.springRollPcs, unit: "pcs", group: "frozen" })
    if (e.id === "edamame") items.push({ id: "edamame", label: `Edamame 毛豆（每份喂 ${policy.edamameFeeds} 人）`, qty, unit: "份", group: "frozen" })
    if ((e.id === "diy_rice_shrimp" || e.id === "diy_rice_chicken") && policy.diyRiceOz) {
      const label = e.id === "diy_rice_shrimp" ? "Shrimp（DIY 炒饭）" : "Chicken（DIY 炒饭）"
      items.push({ id: e.id, label, qty: r1(policy.diyRiceOz * qty), unit: "oz", group: "frozen" })
    }
    if (e.id === "extra_egg") items.push({ id: "extra_egg", label: "加蛋（炒饭）", qty, unit: "个", group: "produce" })
  }

  // 桌椅餐具：装车清单。
  let tcPersons = 0
  let utPersons = 0
  if (data.mode === "detailed" && guests.length) {
    for (const g of guests as Array<GuestRow & { tablesChairs?: boolean; utensils?: boolean }>) {
      if (g.tablesChairs) tcPersons++
      if (g.utensils) utPersons++
    }
  } else {
    tcPersons = extras.find((e) => e.id === "tables_chairs")?.qty ?? 0
    utPersons = extras.find((e) => e.id === "utensils")?.qty ?? 0
  }
  if (tcPersons > 0) {
    const tables = Math.ceil(tcPersons / GUESTS_PER_TABLE)
    const clothName = setup ? (TABLECLOTHS.find((c) => c.id === setup.cloth)?.name ?? "") : ""
    items.push({
      id: "tables",
      label: clothName ? `桌子 + 桌布（${clothName === "Black" ? "黑" : "白"}）` : "桌子 + 桌布",
      qty: tables,
      unit: "张",
      group: "setup",
    })
    items.push({ id: "chairs", label: "椅子", qty: tcPersons, unit: "把", group: "setup" })
  }
  if (utPersons > 0) {
    // 客户在 /rentals 选过主题就写具体哪箱，没选过还是笼统一行（存量订单不变）。
    const theme = setup?.pkg === "full" ? findTheme(setup.themeId) : undefined
    const variant = findVariant(theme, setup?.variantId)
    items.push({
      id: "utensils",
      label: variant ? `餐具套装 · ${variant.packLabel}` : "餐具套装",
      qty: utPersons,
      unit: "套",
      group: "setup",
      ...(variant ? { art: { photo: variant.photo?.src, swatch: variant.swatch } } : {}),
    })
  }

  return { adults, kids, menuKnown, proteinServings, items }
}

/** 多张订单的用料行 → 按品项合计（同 id 同单位相加）。 */
export function aggregatePrep(all: PrepItem[]): PrepItem[] {
  const by = new Map<string, PrepItem>()
  for (const it of all) {
    // 装车行按 label 分开：同一天两张单选了不同主题，盘具是两箱不同的东西，
    // 合成一行会让师傅只装一箱。食材行照旧按 id 合并。
    const key = it.group === "setup" ? `${it.id}|${it.unit}|${it.label}` : `${it.id}|${it.unit}`
    const cur = by.get(key)
    if (cur) cur.qty = r1(cur.qty + it.qty)
    else by.set(key, { ...it })
  }
  const out = [...by.values()]
  for (const it of out) {
    if (it.id === "mixed_vege") {
      const lowLb = Math.round((it.qty / 16) * 10) / 10
      const buyLb = Math.ceil(((it.qty * 1.25 * BUFFER) / 16) * 2) / 2
      it.alt = `每人 4–5oz：≈ ${lowLb} lb 起，买 ${buyLb} lb`
    } else it.alt = alt(it.id, it.qty, it.unit) ?? it.alt
  }
  const order: PrepGroup[] = ["protein", "produce", "frozen", "pantry", "setup"]
  out.sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group) || b.qty - a.qty)
  return out
}
