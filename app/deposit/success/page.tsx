import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

type DepositSuccessPageProps = {
  searchParams?: Record<string, string | string[] | undefined>
}

function firstParam(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value
  if (Array.isArray(value) && value.length > 0) return value[0]
  return null
}

export default function DepositSuccessPage({ searchParams = {} }: DepositSuccessPageProps) {
  const sessionId = firstParam(searchParams.session_id)

  return (
    <div className="page-container container mx-auto px-4 py-12">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Deposit Payment Submitted</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-700">
              Your payment is being confirmed. We will finalize the confirmation state after Stripe verification.
            </p>
            {sessionId && (
              <p className="text-xs text-gray-500 break-all">
                Checkout session: <span className="font-mono">{sessionId}</span>
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/deposit/pay">Back to Deposit</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/contact">Contact Support</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
