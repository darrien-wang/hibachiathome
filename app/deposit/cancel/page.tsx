import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

type DepositCancelPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function firstParam(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value
  if (Array.isArray(value) && value.length > 0) return value[0]
  return null
}

function buildRetryHref(bookingId: string | null): string {
  if (!bookingId) {
    return "/deposit/pay"
  }
  return `/deposit/pay?id=${encodeURIComponent(bookingId)}`
}

export default async function DepositCancelPage({ searchParams }: DepositCancelPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {}
  const bookingId = firstParam(resolvedSearchParams.booking_id)
  const retryHref = buildRetryHref(bookingId)

  return (
    <div className="page-container container mx-auto px-4 py-12">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Deposit Checkout Canceled</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-700">
              No payment was completed. You can return to deposit checkout whenever you are ready.
            </p>
            {bookingId && (
              <p className="text-xs text-gray-500 break-all">
                Booking reference: <span className="font-mono">{bookingId}</span>
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href={retryHref}>Try Again</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/contact">Need Help?</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
