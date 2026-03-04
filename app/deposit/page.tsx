import { redirect } from "next/navigation"

type LegacyDepositPageProps = {
  searchParams?: Record<string, string | string[] | undefined>
}

function firstValue(value: string | string[] | undefined): string | null {
  if (typeof value === "string") {
    return value
  }
  if (Array.isArray(value) && value.length > 0) {
    return value[0]
  }
  return null
}

export default function LegacyDepositPage({ searchParams = {} }: LegacyDepositPageProps) {
  const forwardedParams = new URLSearchParams()

  for (const [key, rawValue] of Object.entries(searchParams)) {
    const value = firstValue(rawValue)
    if (!value) {
      continue
    }
    forwardedParams.set(key, value)
  }

  const legacyOrder = forwardedParams.get("order")
  if (!forwardedParams.get("id") && legacyOrder) {
    forwardedParams.set("id", legacyOrder)
  }
  forwardedParams.delete("order")

  const destination = forwardedParams.toString()
    ? `/deposit/pay?${forwardedParams.toString()}`
    : "/deposit/pay"

  redirect(destination)
}
