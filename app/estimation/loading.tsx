import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function EstimationLoading() {
  return (
    <div className="page-container container mx-auto px-4 py-12">
      <div className="max-w-4xl mx-auto">
        {/* Header Skeleton */}
        <div className="text-center mb-10">
          <Skeleton className="h-10 w-96 mx-auto mb-4" />
          <Skeleton className="h-6 w-2/3 mx-auto" />
        </div>

        {/* Calculator Card Skeleton */}
        <Card className="mb-8">
          <CardHeader className="bg-amber-50 border-b border-amber-100 p-6">
            <Skeleton className="h-8 w-64" />
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-6">
              {/* Guest Count Section */}
              <div>
                <Skeleton className="h-6 w-32 mb-4" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Skeleton className="h-24" />
                  <Skeleton className="h-24" />
                </div>
              </div>

              {/* Premium Proteins Section */}
              <div>
                <Skeleton className="h-6 w-40 mb-4" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Skeleton className="h-24" />
                  <Skeleton className="h-24" />
                </div>
              </div>

              {/* Add-ons Section */}
              <div>
                <Skeleton className="h-6 w-32 mb-4" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Skeleton className="h-24" />
                  <Skeleton className="h-24" />
                </div>
              </div>

              {/* Location Section */}
              <div>
                <Skeleton className="h-6 w-32 mb-4" />
                <Skeleton className="h-10" />
              </div>

              {/* Cost Summary Section */}
              <div className="bg-amber-50 p-4 rounded-lg border border-amber-100">
                <Skeleton className="h-6 w-32 mb-4" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
