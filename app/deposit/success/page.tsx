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
  const email = firstParam(resolvedSearchParams.email)
  const phone = firstParam(resolvedSearchParams.phone)
  const source = firstParam(resolvedSearchParams.source)
  const customerName = firstParam(resolvedSearchParams.customer_name)
  const customerEmail = firstParam(resolvedSearchParams.customer_email)
  const eventDate = firstParam(resolvedSearchParams.event_date)
  const eventTime = firstParam(resolvedSearchParams.event_time)
  const location = firstParam(resolvedSearchParams.location)
  const adults = firstParam(resolvedSearchParams.adults)
  const kids = firstParam(resolvedSearchParams.kids)

  return (
    <DepositSuccessClient
      sessionId={sessionId}
      initialBookingId={bookingId}
      initialEmail={email ?? customerEmail}
      initialPhone={phone}
      initialSource={source}
      initialCustomerName={customerName}
      initialEventDate={eventDate}
      initialEventTime={eventTime}
      initialLocation={location}
      initialAdults={adults}
      initialKids={kids}
    />
  )
}
