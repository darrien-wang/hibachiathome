import { regularProteins, premiumProteins, sides } from "@/config/menu-items"

// 初始化蛋白质选择
export function initialProteinSelections() {
  const selections: Record<string, { selected: boolean; quantity: number }> = {}
  regularProteins.forEach((protein) => {
    selections[protein.id] = { selected: false, quantity: 0 }
  })
  premiumProteins.forEach((protein) => {
    selections[protein.id] = { selected: false, quantity: 0 }
  })
  return selections
}

// 初始化配菜选择
export function initialSideSelections() {
  const selections: Record<string, { selected: boolean; quantity: number }> = {}
  sides.forEach((side) => {
    selections[side.id] = { selected: false, quantity: 0 }
  })
  return selections
}

// 套餐包含的默认选项状态
export const initialPackageInclusions = {
  proteins: 0,
  premiumProteins: 0,
  sides: 0,
}

// 额外费用状态
export const initialExtraCharges = {
  proteins: 0,
  premiumProteins: 0,
  sides: 0,
  total: 0,
}
