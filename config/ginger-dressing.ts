// 姜汁沙拉酱（Ginger Dressing）自制配方 —— 老板 2026-09-30 给的标准版，一锅 48 oz / 1.36 kg。
// 为了新鲜一周做一次，所以要按这周的人头算做多少（工作台 仓库 → 姜汁酱）。
//
// 用量：每人 1 oz，和备料单同一个数（lib/prep-bom.ts MISC_PER_PERSON 的 ginger_dressing：
// 每人 2 tbsp = 1 oz，16 oz 一瓶 = 16 人）。改用量两边一起改。
//
// 克数是配方本身；"估算"是给备菜的人看的大概个数（半颗洋葱、半个橙子……），跟着倍数一起缩放。
//
// 单价（每克，美元）用来估成本（老板 2026-09-30："帮我预估一下这个 sauce 的每 oz 成本"）。
// 来源写在 note 里：有收据的用收据，没买过的用 2026-09 的 Walmart / Restaurant Depot 市价估。
// 买了新货、换了牌子，改这里的单价就行。

export type DressingIngredient = {
  zh: string
  en: string
  /** 一锅（标准版）用多少克 */
  g: number
  /** 一锅大概是几个，给备菜看的 */
  est?: { qty: number; unit: string; note?: string }
  /** 每克多少钱（美元）+ 这个价从哪来 */
  price: { perG: number; note: string }
}

const LB = 453.6
const FL_OZ = 29.57

export const DRESSING_RECIPE: DressingIngredient[] = [
  { zh: "洋葱", en: "Onion", g: 130, est: { qty: 0.5, unit: "颗", note: "中等洋葱" }, price: { perG: 5.82 / (7.5 * LB), note: "收据 09-25 Walmart：7 个 7.5 lb $5.82" } },
  { zh: "胡萝卜", en: "Carrot", g: 75, est: { qty: 0.5, unit: "根", note: "中等胡萝卜" }, price: { perG: 2.26 / (2 * LB), note: "收据 09-25 Walmart：2 lb 袋 $2.26" } },
  { zh: "生姜", en: "Ginger", g: 45, est: { qty: 1, unit: "小块", note: "鸡蛋大小" }, price: { perG: 3.97 / LB, note: "Walmart 市价 $3.97/lb" } },
  { zh: "芹菜", en: "Celery", g: 30, est: { qty: 1 / 16, unit: "颗", note: "或几根茎" }, price: { perG: 1.98 / (1.5 * LB), note: "估：一把 ~$1.98 ≈ 1.5 lb" } },
  { zh: "橙子", en: "Orange", g: 130, est: { qty: 0.5, unit: "个" }, price: { perG: 5 / (4 * LB), note: "估：navel 4 lb 袋 ~$5" } },
  { zh: "柠檬", en: "Lemon", g: 65, est: { qty: 0.5, unit: "个" }, price: { perG: 3.92 / (2 * LB), note: "收据 09-25 Walmart：2 lb 袋 $3.92" } },
  { zh: "菠萝汁", en: "Pineapple Juice", g: 60, price: { perG: 4.62 / (46 * FL_OZ * 1.04), note: "Walmart 市价：Dole 46 oz $4.62" } },
  { zh: "苹果酱", en: "Applesauce", g: 60, price: { perG: 2.68 / (48 * 28.35), note: "估：Great Value 48 oz ~$2.68" } },
  { zh: "醋", en: "Vinegar", g: 60, price: { perG: 6.99 / (24 * FL_OZ * 1.01), note: "估：米醋 Marukan 24 oz ~$6.99；用白醋（1 gal ~$3）这一项几乎不要钱" } },
  { zh: "番茄酱", en: "Ketchup", g: 60, price: { perG: 2.98 / (64 * 28.35), note: "估：Great Value 64 oz ~$2.98" } },
  { zh: "酱油", en: "Soy Sauce", g: 60, price: { perG: 39.99 / (5 * 128 * FL_OZ * 1.17), note: "收据 09-18 RD：Kikkoman 5 gal $39.99" } },
  { zh: "油", en: "Oil", g: 60, price: { perG: 45.99 / (35 * LB), note: "收据 09-18 RD：大豆油 35 lb $45.99" } },
  { zh: "糖浆", en: "Sugar syrup", g: 55, price: { perG: 3.24 / (4 * LB) / 2, note: "估：自己熬 1:1 糖水，白糖 4 lb ~$3.24" } },
  { zh: "美乃滋", en: "Mayonnaise", g: 460, price: { perG: 2.97 / (30 * FL_OZ * 0.95), note: "Walmart 市价：Great Value 30 oz $2.97（RD 1 gal $15.99 反而略贵）" } },
]

/** 一锅的总重（各料相加 = 1,350 g；配方标题写的 1.36 kg 是取整）。按这个算倍数，放大缩小后总重才对得上。 */
export const DRESSING_BATCH_G = DRESSING_RECIPE.reduce((n, i) => n + i.g, 0)
/** 配方标的一锅 oz 数（48 oz） */
export const DRESSING_BATCH_OZ = 48
/** 每人用量（oz），和备料单一致 */
export const DRESSING_PER_GUEST_OZ = 1
/** 装瓶：16 oz 一瓶 */
export const DRESSING_BOTTLE_OZ = 16
export const G_PER_OZ = 28.35
/** 一锅原料成本（美元）和每 oz 成本（按重量 oz） */
export const DRESSING_BATCH_COST = DRESSING_RECIPE.reduce((n, i) => n + i.g * i.price.perG, 0)
export const DRESSING_COST_PER_OZ = DRESSING_BATCH_COST / (DRESSING_BATCH_G / G_PER_OZ)
/** 对照：现在买的成品（收据 09-22 / 09-25 Walmart） */
export const STORE_BOUGHT = { label: "Terry Ho's 姜汁酱", perOz: 4.82 / 16, note: "Walmart 16 fl oz $4.82" }
