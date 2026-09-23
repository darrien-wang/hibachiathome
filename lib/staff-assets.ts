// 发给师傅的公司资产：工服、刀具、随身装备。和 equipment_stock 不一样——
// 那张表数的是公司仓库里有多少套桌椅餐具，这里记的是"哪一件在谁手上"。
//
// 目录只是为了让同一样东西每次记成同一个 item_key（列表才合得起来）。
// 不在目录里的也能记，agent 传 label 就行。

export type AssetItem = { label: string; group: AssetGroup; defaultCostCents?: number }
export type AssetGroup = "uniform" | "tools" | "gear"

export const ASSET_GROUP_TITLES: Record<AssetGroup, string> = {
  uniform: "工服",
  tools: "刀具 / 厨具",
  gear: "随身装备",
}

export const ASSET_ITEMS: Record<string, AssetItem> = {
  cap: { label: "鸭舌帽", group: "uniform" },
  chef_coat: { label: "厨师服（白）", group: "uniform" },
  apron: { label: "围裙", group: "uniform" },
  name_tag: { label: "工牌", group: "uniform" },
  knife_set: { label: "刀具套装", group: "tools" },
  spatula_set: { label: "铲子套装", group: "tools" },
  squeeze_bottles: { label: "酱料瓶", group: "tools" },
  torch: { label: "喷枪", group: "tools" },
  griddle: { label: "铁板炉", group: "gear" },
  propane_tank: { label: "煤气罐", group: "gear" },
  cooler: { label: "保温箱", group: "gear" },
}

const ORDER = Object.keys(ASSET_ITEMS)
/** 排序权重：目录里的按目录顺序，目录外的排最后。 */
export const assetRank = (key: string) => {
  const i = ORDER.indexOf(key)
  return i < 0 ? ORDER.length : i
}

export const assetLabel = (key: string, fallback?: string) => ASSET_ITEMS[key]?.label ?? (fallback || key)
export const assetGroup = (key: string): AssetGroup => ASSET_ITEMS[key]?.group ?? "gear"

/** 一套工服 = 帽子 + 厨师服 + 围裙，发一套就是这三样。 */
export const UNIFORM_SET = ["cap", "chef_coat", "apron"] as const
