import { Card, CardContent } from "@/components/ui/card"
import { Check } from "lucide-react"

export default function ServiceNotes() {
  return (
    <Card className="mb-10 border-secondary/30 bg-secondary/5">
      <CardContent className="pt-6">
        <div className="flex flex-col md:flex-row gap-6 items-start">
          <div className="flex-1">
            <h3 className="text-lg font-bold mb-2">Service Notes</h3>
            <ul className="space-y-2">
              <li className="flex items-start">
                <Check className="h-5 w-5 text-secondary mr-2 mt-0.5 flex-shrink-0" />
                <span>We cook outside only</span>
              </li>
              <li className="flex items-start">
                <Check className="h-5 w-5 text-secondary mr-2 mt-0.5 flex-shrink-0" />
                <span>
                  We provide services rain or shine, as long as there is a dry area for the chef to cook under
                </span>
              </li>
            </ul>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold mb-2">What's Included</h3>
            <ul className="space-y-2">
              <li className="flex items-start">
                <Check className="h-5 w-5 text-secondary mr-2 mt-0.5 flex-shrink-0" />
                <span>2 Protein choices per person</span>
              </li>
              <li className="flex items-start">
                <Check className="h-5 w-5 text-secondary mr-2 mt-0.5 flex-shrink-0" />
                <span>Fresh salad with ginger dressing</span>
              </li>
              <li className="flex items-start">
                <Check className="h-5 w-5 text-secondary mr-2 mt-0.5 flex-shrink-0" />
                <span>Hibachi fried rice</span>
              </li>
              <li className="flex items-start">
                <Check className="h-5 w-5 text-secondary mr-2 mt-0.5 flex-shrink-0" />
                <span>Grilled seasonal vegetables</span>
              </li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
