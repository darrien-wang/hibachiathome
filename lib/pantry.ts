// 食材库存的口径：库存单位必须和备料清单（lib/prep-bom.ts）算出来的单位
// 一致，否则"在库 vs 需求"没法比。收据入库时把 Walmart / Instacart 的包装
// 换算成这里的基准单位。

/** 库存基准单位：和 prep-bom 的 BOM 行单位一一对应。 */
export const STOCK_UNITS: Record<string, string> = {
  // 蛋白（按 oz；虾按只，和 16/20 规格一致）
  chicken: "oz",
  steak: "oz",
  shrimp: "pcs",
  salmon: "oz",
  tofu: "oz",
  scallops: "oz",
  filet_mignon: "oz",
  lobster_tail: "oz",
  // 蔬菜：四样分开记，比需求时合成一个"蔬菜合计"
  zucchini: "oz",
  broccoli: "oz",
  onion: "oz",
  carrots: "oz",
  // 主食 / 前菜 / 面
  fried_rice: "oz",
  noodles: "oz",
  gyoza: "pcs",
  spring_rolls: "pcs",
  edamame: "份",
  salad: "份",
  // 蛋、调料
  eggs: "个",
  lime: "pcs",
  oil: "tbsp",
  garlic_butter: "tbsp",
  soy_sauce: "tbsp",
  ginger_sauce: "tbsp",
  fried_rice_seasoning: "tbsp",
  ginger_dressing: "tbsp",
  garlic: "oz",
  sake: "L",
  teriyaki: "tbsp",
}

export const STOCK_LABELS: Record<string, string> = {
  chicken: "鸡胸",
  steak: "牛排",
  shrimp: "虾 (16/20)",
  salmon: "三文鱼",
  tofu: "豆腐",
  scallops: "带子",
  filet_mignon: "菲力",
  lobster_tail: "龙虾尾",
  zucchini: "西葫芦",
  broccoli: "西兰花",
  onion: "洋葱",
  carrots: "胡萝卜",
  fried_rice: "米（熟饭当量）",
  noodles: "面",
  gyoza: "煎饺",
  spring_rolls: "春卷",
  edamame: "毛豆",
  salad: "沙拉菜",
  eggs: "鸡蛋",
  lime: "青柠",
  oil: "油",
  garlic_butter: "黄油",
  soy_sauce: "酱油",
  ginger_sauce: "Yum Yum 酱",
  fried_rice_seasoning: "炒饭料（冻青豆胡萝卜）",
  ginger_dressing: "姜汁沙拉酱",
  garlic: "蒜蓉",
  sake: "清酒",
  teriyaki: "照烧汁",
}

/**
 * 补货型：米、油、酱油、各种酱、蒜、清酒这些没有固定标准，用户 09-22 定的
 * 口径是"没有就补"——前期不追求精确库存，等样本够了再按平均值备。所以它们
 * 不参与"还差多少"的计算，清单里只显示在库量。
 */
export const RESTOCK_ITEMS = new Set([
  "fried_rice",
  "oil",
  "soy_sauce",
  "ginger_sauce",
  "ginger_dressing",
  "garlic_butter",
  "fried_rice_seasoning",
  "teriyaki",
  "garlic",
  "sake",
  "lime",
])
export const isRestockItem = (key: string) => RESTOCK_ITEMS.has(key)

/** 备料清单把这四样合成一行"蔬菜合计"，所以库存也要合起来比。 */
export const VEG_IDS = ["zucchini", "broccoli", "onion", "carrots"] as const

export const isStockItem = (key: string) => key in STOCK_UNITS
export const stockUnit = (key: string) => STOCK_UNITS[key] ?? "件"
export const stockLabel = (key: string) => STOCK_LABELS[key] ?? key

/** 采购包装 → 基准单位的常用换算，录收据时给我自己对照用。 */
export const PACK_NOTES = [
  "1 lb = 16 oz；1 fl oz 酱料 ≈ 2 tbsp",
  "沙拉菜 1 份 = 1 oz；现在走 RD 3 lb 袋 = 48 份（09-24 定，Walmart 16oz 盒只应急）",
  "虾 16/20：1 袋 = 43 只（09-24 实数，别再按 18 只/lb 估）；龙虾尾 1 盒 = 2 只；带子 1 个 ≈ 1 oz，每人 4 个；RD 5 lb/袋 ≈ 20 人份（一次采购 2 袋 = 40 人份，09-24 实数）；鸡蛋 combo 装 2 盒一提 = 36 个（一起买，09-24 定）",
  "西兰花 32oz 袋；胡萝卜 12oz 袋；三文鱼 Marketside 2lb 袋 = 5 块（只能整袋买，入库 1 袋 = 32 oz）；豆腐 16oz 盒 ≈ 3 人份（09-24 定）；炒面用 pasta，RD 10 lb/箱（09-24 定）",
  "黄油每人 0.5 oz；1 根 = 8 oz = 16 tbsp（最小携带单位），1 盒 = 2 根 = 32 tbsp（30 人场 ≈ 1 盒，用户 09-24 定）→ 记进 garlic_butter",
  "Tai Pei 煎饺 46.5oz 袋 ≈ 40 个、蔬菜春卷 24.5oz 盒 ≈ 8 个、毛豆 12oz 袋 = 1 份，1 份喂 3 人（用户 09-24 定：份=袋，客户点几份带几袋）（都按保守估，宁可显示不够也别显示够）",
  "按价推重量：金额 ÷ 单价（如鸡胸 $2.57/lb、西冷 $11.94/lb）；鸡胸盘平均 4.5 lb/盒（用户 09-24 定，没小票时用）；西冷按盒买（Walmart Top Sirloin Family Pack，**平均 1.6 lb/盒**，4-6 块，老板经验 1 盒 ≈ 4 人；盒数 = 选牛排人数 ÷ 4），入库仍按小票实重记 oz",
  "清酒按升记：1 箱 = 18 L（09-18 进 3 箱 = 54 L，$55/箱 ≈ $3.06/L）",
  "1 gal 酱汁 = 256 tbsp（酱油 5 gal = 1280、照烧 1 gal = 256）；Yum Yum 16oz 瓶 = 32 tbsp = 8 人份（每人 2 oz）；姜汁酱 16oz 瓶 = 32 tbsp = 16 人份（每人 1 oz，09-24 定）",
  "大豆油 35 lb ≈ 4.6 gal ≈ 1170 tbsp（保守）；炒饭料 = 冻青豆胡萝卜，RD 12 oz 包 ≈ 30 人份（入库 1 包 = 24 tbsp，09-24 定）；炒饭还配洋葱碎——洋葱双用途（蔬菜盘+炒饭），能储存，多买不怕消耗不掉",
  "生米 → 熟饭：1 lb 生 ≈ 3 lb 熟（50 lb 袋 ≈ 2400 oz 熟饭 ≈ 300 份）",
]
