"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { InfoIcon, MinusCircle, PlusCircle } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { pricing } from "@/config/pricing"
import { useEffect, useState } from "react"

// 添加价格动画组件
const AnimatedPrice = ({ value }: { value: number }) => {
  const [prevValue, setPrevValue] = useState(value)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    if (value !== prevValue) {
      setIsAnimating(true)
      const timer = setTimeout(() => {
        setIsAnimating(false)
        setPrevValue(value)
      }, 600) // 动画持续时间
      return () => clearTimeout(timer)
    }
  }, [value, prevValue])

  return (
    <span className={`inline-block tabular-nums ${isAnimating ? "animate-price-change" : ""}`}>
      ${value.toFixed(2)}
    </span>
  )
}

interface CostCalculatorProps {
  formData: {
    adults: number
    kids: number
    filetMignon: number
    lobsterTail: number
    extraProteins: number
    noodles: number
    zipcode: string
    gyoza: number
    edamame: number
  }
  costs: {
    adultsCost: number
    kidsCost: number
    filetMignonCost: number
    lobsterTailCost: number
    extraProteinsCost: number
    noodlesCost: number
    travelFee: number
    subtotal: number
    suggestedTip: number
    total: number
    gyozaCost: number
    edamameCost: number
  }
  onProceedToOrder: () => void
  isEstimationValid: boolean
  onInputChange: (field: string, value: string) => void
  onNumberChange: (field: string, value: string) => void
  onIncrement: (field: string) => void
  onDecrement: (field: string) => void
}

export default function CostCalculator({
  formData,
  costs,
  onProceedToOrder,
  isEstimationValid,
  onInputChange,
  onNumberChange,
  onIncrement,
  onDecrement,
}: CostCalculatorProps) {
  // 添加CSS动画样式
  useEffect(() => {
    // 添加动画样式到document head
    const style = document.createElement("style")
    style.innerHTML = `
      @keyframes price-change {
        0% { transform: scale(1); color: inherit; }
        50% { transform: scale(1.2); color: #f59e0b; }
        100% { transform: scale(1); color: inherit; }
      }
      
      .animate-price-change {
        animation: price-change 0.6s ease-in-out;
      }
    `
    document.head.appendChild(style)

    return () => {
      document.head.removeChild(style)
    }
  }, [])

  return (
    <Card variant="calculator" className="mb-8">
      <CardHeader className="bg-amber-50 border-b border-amber-100 p-6">
        <CardTitle className="text-2xl">Hibachi Party Cost Calculator</CardTitle>
      </CardHeader>
      <CardContent spacing="none">
        <div className="p-6">
          <div className="space-y-6">
            {/* Guest Count Section */}
            <div>
              <h3 className="text-lg font-medium mb-4">Guest Count</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label htmlFor="adults">Adults (13+)</Label>
                    <span className="text-sm text-gray-500">${pricing.packages.basic.perPerson}/person</span>
                  </div>
                  <div className="flex items-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      onClick={() => onDecrement("adults")}
                    >
                      <MinusCircle className="h-4 w-4" />
                    </Button>
                    <Input
                      id="adults"
                      type="number"
                      min="0"
                      className="mx-2 text-center"
                      value={formData.adults}
                      onChange={(e) => onNumberChange("adults", e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      onClick={() => onIncrement("adults")}
                    >
                      <PlusCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label htmlFor="kids">Kids (12 and under)</Label>
                    <span className="text-sm text-gray-500">${pricing.children.basic}/person</span>
                  </div>
                  <div className="flex items-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      onClick={() => onDecrement("kids")}
                    >
                      <MinusCircle className="h-4 w-4" />
                    </Button>
                    <Input
                      id="kids"
                      type="number"
                      min="0"
                      className="mx-2 text-center"
                      value={formData.kids}
                      onChange={(e) => onNumberChange("kids", e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      onClick={() => onIncrement("kids")}
                    >
                      <PlusCircle className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500">Children 3 and under are free</p>
                </div>
              </div>
            </div>

            {/* Appetizers Section */}
            <div>
              <h3 className="text-lg font-medium mb-4">Appetizers</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center">
                      <Label htmlFor="gyoza">Gyoza</Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <InfoIcon className="h-4 w-4 ml-1 text-gray-400" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Japanese dumplings (8 pieces)</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <span className="text-sm text-gray-500">$10 per order</span>
                  </div>
                  <div className="flex items-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      onClick={() => onDecrement("gyoza")}
                    >
                      <MinusCircle className="h-4 w-4" />
                    </Button>
                    <Input
                      id="gyoza"
                      type="number"
                      min="0"
                      className="mx-2 text-center"
                      value={formData.gyoza}
                      onChange={(e) => onNumberChange("gyoza", e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      onClick={() => onIncrement("gyoza")}
                    >
                      <PlusCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center">
                      <Label htmlFor="edamame">Edamame</Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <InfoIcon className="h-4 w-4 ml-1 text-gray-400" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Steamed soybeans with sea salt</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <span className="text-sm text-gray-500">$8 per order</span>
                  </div>
                  <div className="flex items-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      onClick={() => onDecrement("edamame")}
                    >
                      <MinusCircle className="h-4 w-4" />
                    </Button>
                    <Input
                      id="edamame"
                      type="number"
                      min="0"
                      className="mx-2 text-center"
                      value={formData.edamame}
                      onChange={(e) => onNumberChange("edamame", e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      onClick={() => onIncrement("edamame")}
                    >
                      <PlusCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Premium Proteins Section */}
            <div>
              <h3 className="text-lg font-medium mb-4">Premium Proteins</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center">
                      <Label htmlFor="filetMignon">Filet Mignon</Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <InfoIcon className="h-4 w-4 ml-1 text-gray-400" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>$5 upcharge per order</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <span className="text-sm text-gray-500">+$5 each</span>
                  </div>
                  <div className="flex items-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      onClick={() => onDecrement("filetMignon")}
                    >
                      <MinusCircle className="h-4 w-4" />
                    </Button>
                    <Input
                      id="filetMignon"
                      type="number"
                      min="0"
                      className="mx-2 text-center"
                      value={formData.filetMignon}
                      onChange={(e) => onNumberChange("filetMignon", e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      onClick={() => onIncrement("filetMignon")}
                    >
                      <PlusCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center">
                      <Label htmlFor="lobsterTail">Lobster Tail</Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <InfoIcon className="h-4 w-4 ml-1 text-gray-400" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>$10 upcharge per order</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <span className="text-sm text-gray-500">+$10 each</span>
                  </div>
                  <div className="flex items-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      onClick={() => onDecrement("lobsterTail")}
                    >
                      <MinusCircle className="h-4 w-4" />
                    </Button>
                    <Input
                      id="lobsterTail"
                      type="number"
                      min="0"
                      className="mx-2 text-center"
                      value={formData.lobsterTail}
                      onChange={(e) => onNumberChange("lobsterTail", e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      onClick={() => onIncrement("lobsterTail")}
                    >
                      <PlusCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Add-ons Section */}
            <div>
              <h3 className="text-lg font-medium mb-4">Add-ons</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center">
                      <Label htmlFor="extraProteins">Extra Proteins</Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <InfoIcon className="h-4 w-4 ml-1 text-gray-400" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Additional protein portions beyond the included 2 per person</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <span className="text-sm text-gray-500">$15 each</span>
                  </div>
                  <div className="flex items-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      onClick={() => onDecrement("extraProteins")}
                    >
                      <MinusCircle className="h-4 w-4" />
                    </Button>
                    <Input
                      id="extraProteins"
                      type="number"
                      min="0"
                      className="mx-2 text-center"
                      value={formData.extraProteins}
                      onChange={(e) => onNumberChange("extraProteins", e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      onClick={() => onIncrement("extraProteins")}
                    >
                      <PlusCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center">
                      <Label htmlFor="noodles">Noodles</Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <InfoIcon className="h-4 w-4 ml-1 text-gray-400" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Add stir-fried noodles to your meal</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <span className="text-sm text-gray-500">$5 per order</span>
                  </div>
                  <div className="flex items-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      onClick={() => onDecrement("noodles")}
                    >
                      <MinusCircle className="h-4 w-4" />
                    </Button>
                    <Input
                      id="noodles"
                      type="number"
                      min="0"
                      className="mx-2 text-center"
                      value={formData.noodles}
                      onChange={(e) => onNumberChange("noodles", e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      onClick={() => onIncrement("noodles")}
                    >
                      <PlusCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Location Section */}
            <div>
              <h3 className="text-lg font-medium mb-4">Location</h3>
              <div className="space-y-2">
                <Label htmlFor="zipcode">Enter your ZIP code</Label>
                <Input
                  id="zipcode"
                  value={formData.zipcode || ""}
                  onChange={(e) => onInputChange("zipcode", e.target.value)}
                  placeholder="e.g. 90210"
                  maxLength={5}
                  className="font-mono"
                />
                <p className="text-xs text-gray-500">Enter the ZIP code where your party will be held</p>
              </div>
            </div>

            {/* Cost Summary Section */}
            <div className="bg-amber-50 p-4 rounded-lg border border-amber-100">
              <h3 className="text-lg font-medium mb-4">Cost Summary</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>
                    Adults ({formData.adults} × ${pricing.packages.basic.perPerson})
                  </span>
                  <AnimatedPrice value={costs.adultsCost} />
                </div>
                <div className="flex justify-between text-sm">
                  <span>
                    Kids ({formData.kids} × ${pricing.children.basic})
                  </span>
                  <AnimatedPrice value={costs.kidsCost} />
                </div>
                {formData.filetMignon > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Filet Mignon Upcharge ({formData.filetMignon} × $5)</span>
                    <AnimatedPrice value={costs.filetMignonCost} />
                  </div>
                )}
                {formData.lobsterTail > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Lobster Tail Upcharge ({formData.lobsterTail} × $10)</span>
                    <AnimatedPrice value={costs.lobsterTailCost} />
                  </div>
                )}
                {formData.gyoza > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Gyoza ({formData.gyoza} × $10)</span>
                    <AnimatedPrice value={costs.gyozaCost || 0} />
                  </div>
                )}
                {formData.edamame > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Edamame ({formData.edamame} × $8)</span>
                    <AnimatedPrice value={costs.edamameCost || 0} />
                  </div>
                )}
                {formData.extraProteins > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Extra Proteins ({formData.extraProteins} × $15)</span>
                    <AnimatedPrice value={costs.extraProteinsCost} />
                  </div>
                )}
                {formData.noodles > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Noodles ({formData.noodles} × $5)</span>
                    <AnimatedPrice value={costs.noodlesCost} />
                  </div>
                )}

                <Separator className="my-2" />

                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <AnimatedPrice value={costs.subtotal} />
                </div>
                <div className="flex justify-between text-sm">
                  <span>Travel Fee</span>
                  <AnimatedPrice value={costs.travelFee} />
                </div>

                <Separator className="my-2" />

                <div className="flex justify-between font-medium">
                  <span>Total Cash for Meal</span>
                  <AnimatedPrice value={costs.total} />
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>20% Tip Suggestion</span>
                  <AnimatedPrice value={costs.suggestedTip} />
                </div>
              </div>
            </div>

            <div className="bg-amber-50/50 p-6 rounded-lg border border-amber-100 text-center">
              <h3 className="text-xl font-medium mb-3">Ready to book your hibachi experience?</h3>
              <p className="text-gray-600 mb-4">
                You can proceed with this estimate to book your private hibachi party. Our chef will contact you to
                confirm all details.
              </p>
              <Button
                type="button"
                onClick={onProceedToOrder}
                disabled={!isEstimationValid}
                className="bg-primary hover:bg-primary/90 rounded-full px-8 py-4 text-lg"
              >
                Continue to Booking
              </Button>
            </div>
          </div>
        </div>

        {/* Information Section */}
        <div className="bg-gray-50 p-6 border-t">
          <h3 className="text-lg font-medium mb-4">Important Information</h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li>
              • Each person gets two regular proteins with no upcharge (chicken, steak, salmon, shrimp, scallops, tofu)
            </li>
            <li>• Premium proteins: Filet Mignon +$5, Lobster +$10</li>
            <li>• Appetizers: $10 Gyoza (8), $8 Edamame</li>
            <li>• Extra proteins: $15 per order (Extra Lobster: $20, Extra Filet Mignon: $15)</li>
            <li>• Minimum spending for a hibachi event is ${pricing.packages.basic.minimum} plus the traveling fees</li>
            <li>• If you have questions regarding the estimation, please do not hesitate to contact us</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
