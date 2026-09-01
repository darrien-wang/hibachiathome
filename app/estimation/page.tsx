import { redirect } from "next/navigation"

type EstimationLegacyPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
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

export default async function EstimationLegacyPage({ searchParams }: EstimationLegacyPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {}
  const query = new URLSearchParams()

  for (const [key, rawValue] of Object.entries(resolvedSearchParams)) {
    const value = firstValue(rawValue)
    if (!value) {
      continue
    }
    query.set(key, value)
  }

  const destination = query.toString() ? `/quote?${query.toString()}` : "/quote"
  redirect(destination)
}
