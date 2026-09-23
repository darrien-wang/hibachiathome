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
  fried_rice_seasoning: "炒饭调味",
  ginger_dressing: "姜汁沙拉酱",
  garlic: "蒜蓉",
}

/** 备料清单把这四样合成一行"蔬菜合计"，所以库存也要合起来比。 */
export const VEG_IDS = ["zucchini", "broccoli", "onion", "carrots"] as const

export const isStockItem = (key: string) => key in STOCK_UNITS
export const stockUnit = (key: string) => STOCK_UNITS[key] ?? "件"
export const stockLabel = (key: string) => STOCK_LABELS[key] ?? key

/** 采购包装 → 基准单位的常用换算，录收据时给我自己对照用。 */
export const PACK_NOTES = [
  "1 lb = 16 oz；1 fl oz 酱料 ≈ 2 tbsp",
  "沙拉菜 1 份 = 1 oz（用户 09-22 定：11oz 袋 = 11 份，16oz 盒 = 16 份）",
  "虾 16/20 ≈ 18 只/lb；鸡蛋 36/盒",
  "西兰花 32oz 袋；胡萝卜 12oz 袋",
  "黄油 1 条 = 4 oz = 8 tbsp（16oz 双包 = 32 tbsp）→ 记进 garlic_butter",
  "Tai Pei 煎饺 46.5oz 袋 ≈ 40 个、蔬菜春卷 24.5oz 盒 ≈ 8 个、毛豆 12oz 袋 = 1 份（都按保守估，宁可显示不够也别显示够）",
  "按价推重量：金额 ÷ 单价（如鸡胸 $2.57/lb、西冷 $11.94/lb）",
]
