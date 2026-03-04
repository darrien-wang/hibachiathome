import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function DepositCancelPage() {
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
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/deposit/pay">Try Again</Link>
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
