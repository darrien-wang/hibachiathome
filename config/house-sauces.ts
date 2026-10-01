// 自制酱料（工作台 仓库 → 自制酱）：姜汁酱、Yum Yum（老板 2026-09-30）。
// 为了新鲜一周做一次，所以按这周的人头算做多少，再把配方按倍数换成每样料的克数，
// 每样料带单价估成本，和现在买的成品比。
//
// 每人用量和备料单同一个数（lib/prep-bom.ts MISC_PER_PERSON）：
//   姜汁酱 ginger_dressing 每人 2 tbsp = 1 oz；Yum Yum ginger_sauce 每人 4 tbsp = 2 oz。改用量两边一起改。
// 克数是配方本身（老板给的）；"估算"是给备菜的人看的大概个数/体积，跟着倍数一起缩放。
// 单价（每克，美元）：有收据用收据，没买过的用 2026-09 的 Walmart / Restaurant Depot 市价估，
// 来源写在 note 里。买了新货、换了牌子，改这里的单价就行。

export type SauceIngredient = {
  zh: string
  en: string
  /** 一锅用多少克 */
  g: number
  /** 一锅大概是多少，给备菜看的 */
  est?: { qty: number; unit: string; note?: string }
  /** 每克多少钱（美元）+ 这个价从哪来 */
  price: { perG: number; note: string }
  /** 进"冻底料"：能冻、不影响风味的那几样，提前打成泥分袋冻（老板 2026-09-30） */
  base?: boolean
}

export type SauceRecipe = {
  key: "ginger" | "yumyum"
  name: string
  /** 每位客人用几 oz（和备料单一致） */
  perGuestOz: number
  /** 装瓶的瓶子多大（oz） */
  bottleOz: number
  /** 一锅是多少，给人看的说法 */
  batchLabel: string
  /** 配方上需要提醒的事 */
  notes?: string[]
  ingredients: SauceIngredient[]
  /** 对照：现在买的成品 */
  storeBought: { label: string; perOz: number; note: string }
  /** 冻底料的说明（有 base 料的配方才有） */
  baseHowTo?: string
}

export const G_PER_OZ = 28.35
const LB = 453.6
const FL_OZ = 29.57
const QT_ML = 946.35
const GAL_ML = 3785.4
/** 美乃滋的密度（g/ml）：Yum Yum 配方"三加仑 = 10,656 g"反推出来的 */
const MAYO = 0.94
/** 美乃滋单价：Walmart Great Value 30 fl oz $2.97（RD 1 gal $15.99 按克算反而贵） */
const MAYO_PER_G = 2.97 / (30 * FL_OZ * MAYO)
const MAYO_NOTE = "Walmart 市价：Great Value 30 oz $2.97（RD 1 gal $15.99 按克算反而贵）"
const PINEAPPLE_PER_G = 4.62 / (46 * FL_OZ * 1.04)
const PINEAPPLE_NOTE = "Walmart 市价：Dole 46 oz $4.62"
const SYRUP_PER_G = 3.24 / (4 * LB) / 2
const SYRUP_NOTE = "估：自己熬 1:1 糖水，白糖 4 lb ~$3.24"

export const HOUSE_SAUCES: SauceRecipe[] = [
  {
    key: "ginger",
    name: "姜汁酱",
    perGuestOz: 1,
    bottleOz: 16,
    batchLabel: "标准一锅 48 oz（各料合计 1,350 g，配方标题写 1.36 kg 是取整）",
    ingredients: [
      { zh: "洋葱", en: "Onion", g: 130, est: { qty: 0.5, unit: "颗", note: "中等洋葱" }, price: { perG: 5.82 / (7.5 * LB), note: "收据 09-25 Walmart：7 个 7.5 lb $5.82" } , base: true },
      { zh: "胡萝卜", en: "Carrot", g: 75, est: { qty: 0.5, unit: "根", note: "中等胡萝卜" }, price: { perG: 2.26 / (2 * LB), note: "收据 09-25 Walmart：2 lb 袋 $2.26" } , base: true },
      { zh: "生姜", en: "Ginger", g: 45, est: { qty: 1, unit: "小块", note: "鸡蛋大小" }, price: { perG: 3.97 / LB, note: "Walmart 市价 $3.97/lb" } , base: true },
      { zh: "芹菜", en: "Celery", g: 30, est: { qty: 1 / 16, unit: "颗", note: "或几根茎" }, price: { perG: 1.98 / (1.5 * LB), note: "估：一把 ~$1.98 ≈ 1.5 lb" } , base: true },
      { zh: "橙子", en: "Orange", g: 130, est: { qty: 0.5, unit: "个" }, price: { perG: 5 / (4 * LB), note: "估：navel 4 lb 袋 ~$5" } , base: true },
      { zh: "柠檬", en: "Lemon", g: 65, est: { qty: 0.5, unit: "个" }, price: { perG: 3.92 / (2 * LB), note: "收据 09-25 Walmart：2 lb 袋 $3.92" } , base: true },
      { zh: "菠萝汁", en: "Pineapple Juice", g: 60, price: { perG: PINEAPPLE_PER_G, note: PINEAPPLE_NOTE } },
      { zh: "苹果酱", en: "Applesauce", g: 60, price: { perG: 2.68 / (48 * G_PER_OZ), note: "估：Great Value 48 oz ~$2.68" } },
      { zh: "白醋", en: "White Vinegar", g: 60, price: { perG: 3.94 / (GAL_ML * 1.01), note: "Walmart 市价：Great Value 白醋 1 gal $3.94（老板 09-30 确认用白醋）" } , base: true },
      { zh: "番茄酱", en: "Ketchup", g: 60, price: { perG: 2.98 / (64 * G_PER_OZ), note: "估：Great Value 64 oz ~$2.98" } },
      { zh: "酱油", en: "Soy Sauce", g: 60, price: { perG: 39.99 / (5 * 128 * FL_OZ * 1.17), note: "收据 09-18 RD：Kikkoman 5 gal $39.99" } , base: true },
      { zh: "油", en: "Oil", g: 60, price: { perG: 45.99 / (35 * LB), note: "收据 09-18 RD：大豆油 35 lb $45.99" } },
      { zh: "糖浆", en: "Sugar syrup", g: 55, price: { perG: SYRUP_PER_G, note: SYRUP_NOTE } },
      { zh: "美乃滋", en: "Mayonnaise", g: 460, price: { perG: MAYO_PER_G, note: MAYO_NOTE } },
    ],
    storeBought: { label: "Terry Ho's 姜汁酱", perOz: 4.82 / 16, note: "收据 09-22 / 09-25 Walmart：16 fl oz $4.82" },
    baseHowTo:
      "洋葱、胡萝卜、生姜、芹菜、橙子、柠檬（橙柠去皮）连同白醋、酱油一起打成泥，按每袋的克数分装冷冻，袋上写日期，一个月内用完。用的前一晚放冷藏解冻（别用微波炉），出的水一起用；美乃滋和成品酱不能冻。",
  },
  {
    key: "yumyum",
    name: "Yum Yum",
    perGuestOz: 2,
    bottleOz: 16,
    batchLabel: "一锅 19,450 g（约 686 oz，42.9 lb）",
    notes: [
      "糖浆按 1,650 g 称（约 1.4 夸脱 1:1 糖水）。原配方写“两夸脱、密度约 0.85 g/ml”——糖水比水重（约 1.25 g/ml），两夸脱应该有 ~2,400 g；按 1,650 g 做会比原来淡一些，试过味定了再改这里。",
      "Mirin 是建议新加的一样，不加就少这一项（一锅约 $5）。",
    ],
    ingredients: [
      { zh: "蛋黄酱", en: "Mayonnaise", g: 10700, est: { qty: 10700 / (GAL_ML * MAYO), unit: "加仑" }, price: { perG: MAYO_PER_G, note: MAYO_NOTE } },
      { zh: "橙汁", en: "Orange Juice", g: 2850, est: { qty: 2850 / (QT_ML * 1.045), unit: "夸脱" }, price: { perG: 5.58 / (GAL_ML * 1.045), note: "Walmart 市价：Great Value 100% 橙汁 1 gal $5.58" } },
      { zh: "菠萝汁", en: "Pineapple Juice", g: 1900, est: { qty: 1900 / (QT_ML * 1.04), unit: "夸脱" }, price: { perG: PINEAPPLE_PER_G, note: PINEAPPLE_NOTE } },
      { zh: "柠檬汁", en: "Lemon Juice", g: 950, est: { qty: 950 / (QT_ML * 1.03), unit: "夸脱" }, price: { perG: 2.34 / (32 * FL_OZ * 1.03), note: "Walmart 市价：Great Value 柠檬汁 32 oz $2.34" } },
      { zh: "糖浆", en: "Sugar syrup", g: 1650, est: { qty: 1650 / (QT_ML * 1.25), unit: "夸脱", note: "1:1 糖水" }, price: { perG: SYRUP_PER_G, note: SYRUP_NOTE } },
      { zh: "味醂", en: "Mirin", g: 750, est: { qty: 750 / (QT_ML * 1.17), unit: "夸脱" }, price: { perG: 13.89 / (60 * FL_OZ * 1.17), note: "市价：Kikkoman Aji-Mirin 60 oz $13.89（CHEF'STORE）" } },
      { zh: "黄油", en: "Butter", g: 340, est: { qty: 3, unit: "条", note: "每条约 113 g" }, price: { perG: 5.96 / (4 * 113.4), note: "收据 09-25 Walmart：GV 黄油 4 根 $5.96" } },
      { zh: "蒜粉", en: "Garlic Powder", g: 130, est: { qty: 130 / G_PER_OZ, unit: "oz" }, price: { perG: 1.08 / (3.4 * G_PER_OZ), note: "Walmart 市价：Great Value 3.4 oz $1.08" } },
      { zh: "黑胡椒粉", en: "Black Pepper", g: 50, est: { qty: 50 / G_PER_OZ, unit: "oz" }, price: { perG: 18.24 / (18 * G_PER_OZ), note: "Walmart 市价：Great Value 18 oz $18.24" } },
      { zh: "辣椒粉", en: "Paprika", g: 130, est: { qty: 130 / G_PER_OZ, unit: "oz" }, price: { perG: 1.08 / (2.5 * G_PER_OZ), note: "Walmart 市价：Great Value 2.5 oz $1.08" } },
    ],
    storeBought: { label: "Terry Ho's Yum Yum", perOz: 4.87 / 16, note: "收据 09-25 Walmart：16 fl oz ×6 瓶 $29.22" },
  },
]

/** 一锅的总重（各料相加），按这个算倍数，放大缩小后总重才对得上。 */
export const batchGrams = (r: SauceRecipe) => r.ingredients.reduce((n, i) => n + i.g, 0)
/** 一锅原料成本（美元） */
export const batchCost = (r: SauceRecipe) => r.ingredients.reduce((n, i) => n + i.g * i.price.perG, 0)
/** 每 oz（重量）原料成本 */
export const costPerOz = (r: SauceRecipe) => batchCost(r) / (batchGrams(r) / G_PER_OZ)
