"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import { InfoIcon, CheckCircle, MinusCircle, PlusCircle } from "lucide-react"
import Link from "next/link"
import { pricing } from "@/config/pricing"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

// Define the states with travel fees
const stateOptions = [
  { value: "tx", label: "TX (Austin, Dallas, Houston, San Antonio)", fee: 50 },
  { value: "ny_nj_pa_de", label: "NY, NJ, PA, DE", fee: 50 },
  { value: "az", label: "AZ (Phoenix Metropolitan)", fee: 50 },
  { value: "va_md_dc", label: "VA, MD, Washington DC", fee: 50 },
  { value: "fl", label: "FL (Miami, Orlando)", fee: 50 },
  { value: "other", label: "Other", fee: 75 },
]

export default function EstimationPage() {
  // State for the estimation form
  const [formData, setFormData] = useState({
    adults: 0,
    kids: 0,
    filetMignon: 0,
    lobsterTail: 0,
    extraProteins: 0,
    noodles: 0,
    state: "",
    name: "",
    email: "",
    phone: "",
    message: "",
    agreeToTerms: false,
  })

  // State for the cost calculation
  const [costs, setCosts] = useState({
    adultsCost: 0,
    kidsCost: 0,
    filetMignonCost: 0,
    lobsterTailCost: 0,
    extraProteinsCost: 0,
    noodlesCost: 0,
    travelFee: 0,
    subtotal: 0,
    suggestedTip: 0,
    total: 0,
  })

  // State for form submission
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  // Handle input changes
  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  // Handle number input changes with min/max validation
  const handleNumberChange = (field, value) => {
    const numValue = Number.parseInt(value) || 0
    const validValue = Math.max(0, numValue) // Ensure non-negative
    setFormData((prev) => ({
      ...prev,
      [field]: validValue,
    }))
  }

  // Handle increment/decrement
  const handleIncrement = (field) => {
    setFormData((prev) => ({
      ...prev,
      [field]: prev[field] + 1,
    }))
  }

  const handleDecrement = (field) => {
    if (formData[field] > 0) {
      setFormData((prev) => ({
        ...prev,
        [field]: prev[field] - 1,
      }))
    }
  }

  // Calculate costs whenever form data changes
  useEffect(() => {
    const adultPrice = pricing.packages.basic.perPerson
    const kidPrice = pricing.children.basic
    const filetUpcharge = 5
    const lobsterUpcharge = 10
    const extraProteinPrice = 15
    const noodlePrice = 5

    // Get travel fee based on selected state
    const selectedState = stateOptions.find((state) => state.value === formData.state)
    const travelFee = selectedState ? selectedState.fee : 0

    // Calculate costs
    const adultsCost = formData.adults * adultPrice
    const kidsCost = formData.kids * kidPrice
    const filetMignonCost = formData.filetMignon * filetUpcharge
    const lobsterTailCost = formData.lobsterTail * lobsterUpcharge
    const extraProteinsCost = formData.extraProteins * extraProteinPrice
    const noodlesCost = formData.noodles * noodlePrice

    // Calculate subtotal
    const mealCost = adultsCost + kidsCost + filetMignonCost + lobsterTailCost + extraProteinsCost + noodlesCost

    // Apply minimum spending requirement
    const minimumSpending = pricing.packages.basic.minimum
    const finalMealCost = Math.max(mealCost, minimumSpending)

    // Calculate total with travel fee
    const subtotal = finalMealCost
    const total = subtotal + travelFee
    const suggestedTip = total * 0.2

    setCosts({
      adultsCost,
      kidsCost,
      filetMignonCost,
      lobsterTailCost,
      extraProteinsCost,
      noodlesCost,
      travelFee,
      subtotal,
      suggestedTip,
      total,
    })
  }, [formData])

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)

    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false)
      setIsSubmitted(true)
    }, 1500)
  }

  return (
    <div className="container mx-auto px-4 py-12 pt-24 mt-16">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold mb-4">Private Hibachi Party Cost Estimation</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Use our calculator to get an instant estimate for your private hibachi experience
          </p>
        </div>

        {isSubmitted ? (
          <Card className="border-green-100 bg-green-50/30">
            <CardContent className="pt-6 pb-6 text-center" spacing="default">
              <div className="mb-6 flex justify-center">
                <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
              </div>
              <h2 className="text-2xl font-bold mb-4">Thank You for Your Request!</h2>
              <p className="text-lg mb-6">
                We've received your estimate request and will get back to you within 24 hours to confirm details.
              </p>
              <Button asChild className="bg-primary hover:bg-primary/90 rounded-full px-8">
                <Link href="/">Return to Home</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card variant="calculator">
            <CardHeader className="bg-amber-50 border-b border-amber-100 p-6">
              <CardTitle className="text-2xl">Hibachi Party Cost Calculator</CardTitle>
            </CardHeader>
            <CardContent spacing="none">
              <form onSubmit={handleSubmit}>
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
                              onClick={() => handleDecrement("adults")}
                            >
                              <MinusCircle className="h-4 w-4" />
                            </Button>
                            <Input
                              id="adults"
                              type="number"
                              min="0"
                              className="mx-2 text-center"
                              value={formData.adults}
                              onChange={(e) => handleNumberChange("adults", e.target.value)}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 rounded-full"
                              onClick={() => handleIncrement("adults")}
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
                              onClick={() => handleDecrement("kids")}
                            >
                              <MinusCircle className="h-4 w-4" />
                            </Button>
                            <Input
                              id="kids"
                              type="number"
                              min="0"
                              className="mx-2 text-center"
                              value={formData.kids}
                              onChange={(e) => handleNumberChange("kids", e.target.value)}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 rounded-full"
                              onClick={() => handleIncrement("kids")}
                            >
                              <PlusCircle className="h-4 w-4" />
                            </Button>
                          </div>
                          <p className="text-xs text-gray-500">Children 3 and under are free</p>
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
                              onClick={() => handleDecrement("filetMignon")}
                            >
                              <MinusCircle className="h-4 w-4" />
                            </Button>
                            <Input
                              id="filetMignon"
                              type="number"
                              min="0"
                              className="mx-2 text-center"
                              value={formData.filetMignon}
                              onChange={(e) => handleNumberChange("filetMignon", e.target.value)}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 rounded-full"
                              onClick={() => handleIncrement("filetMignon")}
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
                              onClick={() => handleDecrement("lobsterTail")}
                            >
                              <MinusCircle className="h-4 w-4" />
                            </Button>
                            <Input
                              id="lobsterTail"
                              type="number"
                              min="0"
                              className="mx-2 text-center"
                              value={formData.lobsterTail}
                              onChange={(e) => handleNumberChange("lobsterTail", e.target.value)}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 rounded-full"
                              onClick={() => handleIncrement("lobsterTail")}
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
                              onClick={() => handleDecrement("extraProteins")}
                            >
                              <MinusCircle className="h-4 w-4" />
                            </Button>
                            <Input
                              id="extraProteins"
                              type="number"
                              min="0"
                              className="mx-2 text-center"
                              value={formData.extraProteins}
                              onChange={(e) => handleNumberChange("extraProteins", e.target.value)}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 rounded-full"
                              onClick={() => handleIncrement("extraProteins")}
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
                              onClick={() => handleDecrement("noodles")}
                            >
                              <MinusCircle className="h-4 w-4" />
                            </Button>
                            <Input
                              id="noodles"
                              type="number"
                              min="0"
                              className="mx-2 text-center"
                              value={formData.noodles}
                              onChange={(e) => handleNumberChange("noodles", e.target.value)}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 rounded-full"
                              onClick={() => handleIncrement("noodles")}
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
                        <Label htmlFor="state">What state are you in?</Label>
                        <Select value={formData.state} onValueChange={(value) => handleInputChange("state", value)}>
                          <SelectTrigger id="state">
                            <SelectValue placeholder="Select your state" />
                          </SelectTrigger>
                          <SelectContent>
                            {stateOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label} (${option.fee} travel fee)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                          <span>${costs.adultsCost.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>
                            Kids ({formData.kids} × ${pricing.children.basic})
                          </span>
                          <span>${costs.kidsCost.toFixed(2)}</span>
                        </div>
                        {formData.filetMignon > 0 && (
                          <div className="flex justify-between text-sm">
                            <span>Filet Mignon Upcharge ({formData.filetMignon} × $5)</span>
                            <span>${costs.filetMignonCost.toFixed(2)}</span>
                          </div>
                        )}
                        {formData.lobsterTail > 0 && (
                          <div className="flex justify-between text-sm">
                            <span>Lobster Tail Upcharge ({formData.lobsterTail} × $10)</span>
                            <span>${costs.lobsterTailCost.toFixed(2)}</span>
                          </div>
                        )}
                        {formData.extraProteins > 0 && (
                          <div className="flex justify-between text-sm">
                            <span>Extra Proteins ({formData.extraProteins} × $15)</span>
                            <span>${costs.extraProteinsCost.toFixed(2)}</span>
                          </div>
                        )}
                        {formData.noodles > 0 && (
                          <div className="flex justify-between text-sm">
                            <span>Noodles ({formData.noodles} × $5)</span>
                            <span>${costs.noodlesCost.toFixed(2)}</span>
                          </div>
                        )}

                        <Separator className="my-2" />

                        <div className="flex justify-between text-sm">
                          <span>Subtotal</span>
                          <span>${costs.subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Travel Fee</span>
                          <span>${costs.travelFee.toFixed(2)}</span>
                        </div>

                        <Separator className="my-2" />

                        <div className="flex justify-between font-medium">
                          <span>Total Cash for Meal</span>
                          <span>${costs.total.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-gray-600">
                          <span>20% Tip Suggestion</span>
                          <span>${costs.suggestedTip.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Contact Information Section */}
                    <div>
                      <h3 className="text-lg font-medium mb-4">Your Information</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">Full Name*</Label>
                          <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => handleInputChange("name", e.target.value)}
                            required
                            placeholder="Your full name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">Email Address*</Label>
                          <Input
                            id="email"
                            type="email"
                            value={formData.email}
                            onChange={(e) => handleInputChange("email", e.target.value)}
                            required
                            placeholder="your.email@example.com"
                          />
                        </div>
                      </div>
                      <div className="space-y-2 mt-4">
                        <Label htmlFor="phone">Phone Number*</Label>
                        <Input
                          id="phone"
                          value={formData.phone}
                          onChange={(e) => handleInputChange("phone", e.target.value)}
                          required
                          placeholder="(123) 456-7890"
                        />
                      </div>
                      <div className="space-y-2 mt-4">
                        <Label htmlFor="message">Additional Information (Optional)</Label>
                        <textarea
                          id="message"
                          className="w-full min-h-[100px] p-2 border rounded-md"
                          value={formData.message}
                          onChange={(e) => handleInputChange("message", e.target.value)}
                          placeholder="Event date, special requests, questions, etc."
                        />
                      </div>
                    </div>

                    {/* Terms and Submit */}
                    <div className="space-y-4">
                      <div className="flex items-start space-x-2">
                        <Checkbox
                          id="agreeToTerms"
                          checked={formData.agreeToTerms}
                          onCheckedChange={(checked) => handleInputChange("agreeToTerms", checked === true)}
                          required
                        />
                        <div className="grid gap-1.5 leading-none">
                          <label
                            htmlFor="agreeToTerms"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            I agree to the terms and conditions
                          </label>
                          <p className="text-sm text-gray-500">
                            By submitting this form, you agree to be contacted about your hibachi experience.
                          </p>
                        </div>
                      </div>

                      <Button
                        type="submit"
                        disabled={
                          isSubmitting ||
                          !formData.agreeToTerms ||
                          !formData.state ||
                          !formData.name ||
                          !formData.email ||
                          !formData.phone
                        }
                        className="w-full bg-primary hover:bg-primary/90 rounded-full px-8 py-6 text-lg"
                      >
                        {isSubmitting ? "Submitting..." : "Get Your Estimate"}
                      </Button>
                    </div>
                  </div>
                </div>
              </form>

              {/* Information Section */}
              <div className="bg-gray-50 p-6 border-t">
                <h3 className="text-lg font-medium mb-4">Important Information</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>
                    • Each person gets two regular proteins with no upcharge (chicken, steak, salmon, shrimp, scallops,
                    tofu)
                  </li>
                  <li>• Premium proteins: Filet Mignon +$5, Lobster +$10</li>
                  <li>• Appetizers: $10 Gyoza (8), $6 Edamame</li>
                  <li>• Extra proteins: $15 per order</li>
                  <li>
                    • Minimum spending for a hibachi event is ${pricing.packages.basic.minimum} plus the traveling fees
                  </li>
                  <li>• If you have questions regarding the estimation, please do not hesitate to contact us</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
