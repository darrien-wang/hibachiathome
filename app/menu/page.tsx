"use client"
import { useState } from "react"
import {
  packageOptions,
  getPackageById,
  calculatePackagePrice,
  regularProteins,
  premiumProteins,
  sides,
} from "@/config/menu-items"
import { pricing } from "@/config/pricing"
import { getMenuImageById } from "@/config/images"
import MenuItemCard from "@/components/menu/menu-item-card"
import PricingBanner from "@/components/menu/pricing-banner"
import ServiceNotes from "@/components/menu/service-notes"
import PackageSelection from "@/components/menu/package-selection"
import MenuDetails from "@/components/menu/menu-details"

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

  // Menu items with dynamic pricing from config
  const menuItems = [
    {
      id: "chicken-steak",
      title: "Chicken + NY Strip",
      price: pricing.packages.basic.perPerson,
      image: getMenuImageById("chicken-steak"),
      description:
        "Tender chicken breast and USDA Choice NY Strip steak, served with hibachi vegetables and fried rice",
    },
    {
      id: "steak-shrimp",
      title: "NY Strip + Shrimp",
      price: pricing.packages.basic.perPerson,
      image: getMenuImageById("steak-shrimp"),
      description: "USDA Choice NY Strip steak and large shrimp, served with hibachi vegetables and fried rice",
    },
    {
      id: "filet-chicken-shrimp",
      title: "Filet + Chicken + Shrimp",
      price: pricing.packages.basic.perPerson + 5,
      image: getMenuImageById("filet-chicken-shrimp"),
      description:
        "Premium filet mignon, tender chicken breast, and large shrimp, served with hibachi vegetables and fried rice",
    },
    {
      id: "filet-lobster",
      title: "Filet + Lobster",
      price: pricing.packages.basic.perPerson + 10,
      image: getMenuImageById("filet-lobster"),
      description: "Premium filet mignon and Maine lobster tail, served with hibachi vegetables and fried rice",
    },
    {
      id: "chicken-shrimp",
      title: "Chicken + Shrimp",
      price: pricing.packages.basic.perPerson,
      image: getMenuImageById("chicken-steak"), // Reusing an image
      description: "Tender chicken breast and large shrimp, served with hibachi vegetables and fried rice",
    },
    {
      id: "chicken-scallop",
      title: "Chicken + Scallops",
      price: pricing.packages.basic.perPerson,
      image: getMenuImageById("chicken-scallop"),
      description: "Tender chicken breast and fresh sea scallops, served with hibachi vegetables and fried rice",
    },
  ]

  // Rename the basic package
  if (packageOptions.find((pkg) => pkg.id === "basic")) {
    packageOptions.find((pkg) => pkg.id === "basic").name = "Chef's Selection"
  }

  return (
    <>
      <div className="container max-w-6xl mx-auto px-4 pt-24 pb-12 relative mt-16">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold mb-4">Our Menu</h1>
          <p className="text-xl text-gray-600 mx-auto">
            Premium hibachi cuisine prepared fresh at your location. All packages include a chef performance,
            appetizers, main course, and sides.
          </p>
        </div>

        {/* Featured Menu Items with Images */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-8">Featured Combinations</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {menuItems.map((item) => (
              <MenuItemCard
                key={item.id}
                id={item.id}
                title={item.title}
                price={item.price}
                image={item.image}
                description={item.description}
              />
            ))}
          </div>
        </div>

        {/* Menu Details Component */}
        <MenuDetails proteins={regularProteins} premiumProteins={premiumProteins} sides={sides} />

        {/* Use our extracted PricingBanner component with pricing from config */}
        <PricingBanner
          adultPrice={pricing.pricingBanner.adultPrice}
          childPrice={pricing.pricingBanner.childPrice}
          minimumTotal={pricing.pricingBanner.minimumTotal}
        />

        {/* Use our extracted ServiceNotes component */}
        <ServiceNotes />

        {/* Package Selection Component */}
        <PackageSelection
          packages={[
            packageOptions.find((pkg) => pkg.id === "buffet"),
            packageOptions.find((pkg) => pkg.id === "basic"),
          ].filter(Boolean)}
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
