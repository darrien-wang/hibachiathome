import { Card, CardContent } from "@/components/ui/card"

export default function AfterDepositLoading() {
  return (
    <div className="container mx-auto px-4 py-12 pt-24 mt-16">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <div className="h-10 w-64 bg-gray-200 animate-pulse rounded mx-auto mb-4"></div>
          <div className="h-6 w-96 bg-gray-200 animate-pulse rounded mx-auto"></div>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
