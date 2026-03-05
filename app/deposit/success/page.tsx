import DepositSuccessClient from "./DepositSuccessClient"

type DepositSuccessPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function firstParam(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value
  if (Array.isArray(value) && value.length > 0) return value[0]
  return null
}

export default async function DepositSuccessPage({ searchParams }: DepositSuccessPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {}
  const sessionId = firstParam(resolvedSearchParams.session_id)
  const bookingId = firstParam(resolvedSearchParams.booking_id)
  const source = firstParam(resolvedSearchParams.source)

  return <DepositSuccessClient sessionId={sessionId} initialBookingId={bookingId} initialSource={source} />
}
