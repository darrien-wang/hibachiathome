export type DepositRule =
  | {
      mode: "fixed"
      amount: number
    }
  | {
      mode: "percentage"
      percentage: number
      minimumAmount?: number
      maximumAmount?: number
    }

export const depositRule: DepositRule = {
  mode: "fixed",
  amount: 19.9,
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100
}

function clamp(value: number, minimum?: number, maximum?: number): number {
  let result = value
  if (typeof minimum === "number") {
    result = Math.max(result, minimum)
  }
  if (typeof maximum === "number") {
    result = Math.min(result, maximum)
  }
  return result
}

export function getDepositAmount(totalAmount?: number | null): number {
  if (depositRule.mode === "fixed") {
    return roundCurrency(Math.max(0, depositRule.amount))
  }

  const base = typeof totalAmount === "number" && Number.isFinite(totalAmount) ? Math.max(0, totalAmount) : 0
  const computed = clamp(base * depositRule.percentage, depositRule.minimumAmount, depositRule.maximumAmount)
  return roundCurrency(Math.max(0, computed))
}
