import { redirect } from "next/navigation"

type EstimationLegacyPageProps = {
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

export default function EstimationLegacyPage({ searchParams = {} }: EstimationLegacyPageProps) {
  const query = new URLSearchParams()

  for (const [key, rawValue] of Object.entries(searchParams)) {
    const value = firstValue(rawValue)
    if (!value) {
      continue
    }
    query.set(key, value)
  }

  const destination = query.toString() ? `/quoteA?${query.toString()}` : "/quoteA"
  redirect(destination)
}
