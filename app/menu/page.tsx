// @ts-nocheck
"use client"
import { useState } from "react"
import { packageOptions, getPackageById, calculatePackagePrice } from "@/config/menu-items"
import { pricing } from "@/config/pricing"

// Import our new components
import Testimonials from "@/components/menu/testimonials"
import PricingBanner from "@/components/menu/pricing-banner"
import ServiceNotes from "@/components/menu/service-notes"
import PackageSelection from "@/components/menu/package-selection"

export default function MenuPage() {
  const [headcount, setHeadcount] = useState(10)
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null)
  const [showSpecialRequests, setShowSpecialRequests] = useState(false)
  const [selectedTab, setSelectedTab] = useState<string>("overview")
  const [isComparisonTableExpanded, setIsComparisonTableExpanded] = useState(false)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1)

  // 客户评价
  const testimonials = []
  // 应用预设套餐
  const applyPackage = (packageId: string) => {
    const selectedPkg = getPackageById(packageId)
    if (selectedPkg) {
      setHeadcount(selectedPkg.headcount)
      setSelectedPackage(packageId)
    }
  }

  return (
    <>
      <div className="container max-w-4xl mx-auto px-4 py-12 relative">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold mb-4">Our Menu</h1>
          <p className="text-xl text-gray-600 mx-auto">
            Premium hibachi cuisine prepared fresh at your location. All packages include a chef performance,
            appetizers, main course, and sides.
          </p>
        </div>

        {/* Use our extracted Testimonials component */}
        <Testimonials testimonials={testimonials} />

        {/* Use our extracted PricingBanner component with pricing from config */}
        <PricingBanner
          adultPrice={pricing.pricingBanner.adultPrice}
          childPrice={pricing.pricingBanner.childPrice}
          minimumTotal={pricing.pricingBanner.minimumTotal}
        />

        {/* Use our extracted ServiceNotes component */}
        <ServiceNotes />

        {/* Rest of the page content remains the same */}
        {/* ... */}
        {/* 预设套餐选项 */}

        <PackageSelection
          packages={packageOptions}
          selectedPackage={selectedPackage}
          selectedTab={selectedTab}
          setSelectedTab={setSelectedTab}
          applyPackage={applyPackage}
          currentStep={currentStep}
          setCurrentStep={setCurrentStep}
          isComparisonTableExpanded={isComparisonTableExpanded}
          setIsComparisonTableExpanded={setIsComparisonTableExpanded}
          calculatePackagePrice={calculatePackagePrice}
          pricing={pricing}
        />
      </div>
    </>
  )
}
