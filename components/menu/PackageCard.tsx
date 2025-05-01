// @ts-nocheck
import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface PackageCardProps {
  pkg: any
  selectedPackage: string | null
  selectedTab: string
  setSelectedTab: (tab: string) => void
  applyPackage: (packageId: string) => void
  setCurrentStep: (step: 1 | 2 | 3) => void
}

const PackageCard: React.FC<PackageCardProps> = function PackageCard({
  pkg,
  selectedPackage,
  selectedTab,
  setSelectedTab,
  applyPackage,
  setCurrentStep,
}: PackageCardProps) {
  // Calculate prices
  const pricePerPerson =
    pkg.id === "buffet"
      ? pkg.currentPrice
      : pkg.id === "basic"
        ? 50
        : pkg.id === "premium"
          ? 80
          : Math.round(pkg.flatRate / pkg.headcount)

  // Determine package status
  const isRecommended = pkg.id === "basic"
  const isAvailable = true

  return (
    <div
      className={`border rounded-lg overflow-hidden transition-all relative ${
        selectedPackage === pkg.id
          ? "border-amber-500 bg-amber-50 shadow-md"
          : isRecommended
            ? "border-amber-300/50 hover:border-amber-300 hover:shadow-md"
            : "hover:border-gray-400 hover:shadow-md"
      }`}
      style={{
        boxShadow:
          selectedPackage === pkg.id ? "0 4px 12px rgba(245, 158, 11, 0.15)" : "0 2px 8px rgba(0,0,0,0.1)",
      }}
      onClick={() => {
        if (isAvailable) {
          applyPackage(pkg.id)
        }
      }}
    >
      {/* All badges moved to the top-right corner */}
      <div className="absolute top-2 right-2 z-10 flex flex-col gap-2 items-end">
        {/* Popularity tag */}
        {isRecommended && (
          <Badge variant="secondary" className="px-3 py-1 shadow-sm">
            Most Popular
          </Badge>
        )}

        {/* Luxury upgrade tag */}
        {pkg.id === "premium" && (
          <Badge variant="outline" className="bg-gray-50 px-3 py-1 shadow-sm border border-gray-200 text-gray-700">
            Luxury Upgrade
          </Badge>
        )}

        {/* Buffet tag */}
        {pkg.id === "buffet" && (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 px-3 py-1 shadow-sm border">
            Self-Service
          </Badge>
        )}
      </div>

      {/* Package card content */}
      <div
        className="p-6 flex flex-col h-full"
        style={{
          borderColor: selectedPackage === pkg.id ? "#C33" : pkg.id === "basic" ? "#C33" : "",
          borderWidth: selectedPackage === pkg.id ? "2px" : "1px",
        }}
      >
        {/* Package name */}
        <h3 className="text-xl font-bold mb-2">
          {pkg.id === "basic"
            ? "Basic Package"
            : pkg.id === "premium"
              ? "Premium Package"
              : pkg.id === "buffet"
                ? "Buffet Package"
                : pkg.name}
        </h3>

        {/* Price and capacity */}
        <div className="mb-4">
          <p className="text-lg font-semibold text-amber-600">
            {pkg.id === "buffet" ? (
              <>
                <span className="text-gray-500 text-sm line-through mr-2">${pkg.originalPrice}</span>${pkg.currentPrice}
                <span className="text-sm font-normal"> per person</span>
              </>
            ) : (
              <>
                ${pricePerPerson}
                <span className="text-sm font-normal"> per person</span>
              </>
            )}
          </p>
          <p className="text-xs text-gray-600">
            {pkg.id === "buffet" ? "$798 minimum" : `($${pkg.flatRate} minimum)`}
          </p>
        </div>

        {/* Tabbed content section */}
        <div className="mb-4">
          {/* Tab navigation */}
          <div className="flex border-b mb-3">
            {["Overview", "Proteins", "Sides", "Extras"].map((tab) => (
              <button
                key={tab}
                className={`text-xs px-3 py-2 font-medium ${
                  selectedTab === tab.toLowerCase()
                    ? "border-b-2 border-primary text-primary"
                    : "text-gray-500 hover:text-gray-700"
                }`}
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedTab(tab.toLowerCase())
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab content - 保持原有内容不变 */}
          <div className="text-sm">
            {/* Overview Tab */}
            {selectedTab === "overview" && (
              <ul className="space-y-1">
                {pkg.id === "buffet" ? (
                  <>
                    <li className="flex items-start">
                      <span className="text-amber-500 mr-2">•</span>
                      <span>Self-service buffet style</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-amber-500 mr-2">•</span>
                      <span>Fixed menu (no customization)</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-amber-500 mr-2">•</span>
                      <span>Chicken, shrimp, beef</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-amber-500 mr-2">•</span>
                      <span>Fried rice & vegetables</span>
                    </li>
                    <li className="flex items-start ">
                      <span className="mr-2">•</span>
                      <span>Chef performance</span>
                    </li>
                  </>
                ) : pkg.id === "basic" ? (
                  <>
                    <li className="flex items-start">
                      <span className="text-amber-500 mr-2">•</span>
                      <span>2 proteins of your choice</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-amber-500 mr-2">•</span>
                      <span>Fried rice & vegetables</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-amber-500 mr-2">•</span>
                      <span>Gyoza & edamame included</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-amber-500 mr-2">•</span>
                      <span>Chef performance included</span>
                    </li>
                  </>
                ) : (
                  <>
                    <li className="flex items-start">
                      <span className="text-amber-500 mr-2">•</span>
                      <span>3 proteins of your choice</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-amber-500 mr-2">•</span>
                      <span>Miso soup, gyoza, edamame</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-amber-500 mr-2">•</span>
                      <span>Premium fried rice with upgrade options</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-amber-500 mr-2">•</span>
                      <span>Premium Chef performance</span>
                    </li>
                  </>
                )}
              </ul>
            )}

            {/* Proteins Tab */}
            {selectedTab === "proteins" && (
              <ul className="space-y-1">
                {pkg.id === "buffet" ? (
                  <>
                    <li className="flex items-start">
                      <span className="text-amber-500 mr-2">•</span>
                      <span>Fixed proteins only:</span>
                    </li>
                    <li className="flex items-start ml-4">
                      <span>- Chicken</span>
                    </li>
                    <li className="flex items-start ml-4">
                      <span>- Shrimp</span>
                    </li>
                    <li className="flex items-start ml-4">
                      <span>- Premium Steak</span>
                    </li>
                    <li className="flex items-start text-gray-400">
                      <span className="mr-2">•</span>
                      <span>No customization available</span>
                    </li>
                  </>
                ) : pkg.id === "basic" ? (
                  <>
                    <li className="flex items-start">
                      <span className="text-amber-500 mr-2">•</span>
                      <span>Choose 2 basic proteins:</span>
                    </li>
                    <li className="flex items-start ml-4">
                      <span>- Chicken, Steak, Shrimp</span>
                    </li>
                    <li className="flex items-start ml-4">
                      <span>- Salmon, Scallops, Tofu</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-amber-500 mr-2">•</span>
                      <span>Premium upgrades available:</span>
                    </li>
                    <li className="flex items-start ml-4">
                      <span>- Filet Mignon (+$15)</span>
                    </li>
                    <li className="flex items-start ml-4">
                      <span>- Lobster (+$20)</span>
                    </li>
                  </>
                ) : (
                  <>
                    <li className="flex items-start">
                      <span className="text-amber-500 mr-2">•</span>
                      <span>Choose 2 premium proteins only:</span>
                    </li>
                    <li className="flex items-start ml-4">
                      <span>- Premium Steak, Premium Chicken</span>
                    </li>
                    <li className="flex items-start ml-4">
                      <span>- Filet Mignon, Lobster</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-amber-500 mr-2">•</span>
                      <span>Premium quality proteins only</span>
                    </li>
                    <li className="flex items-start ml-4">
                      <span>- Double the quality of basic package</span>
                    </li>
                  </>
                )}
              </ul>
            )}

            {/* Sides Tab */}
            {selectedTab === "sides" && (
              <ul className="space-y-1">
                {pkg.id === "buffet" ? (
                  <>
                    <li className="flex items-start">
                      <span className="text-amber-500 mr-2">•</span>
                      <span>Fried rice</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-amber-500 mr-2">•</span>
                      <span>Mixed vegetables</span>
                    </li>
                    <li className="flex items-start text-gray-400">
                      <span className="text-amber-500 mr-2">•</span>
                      <span>Gyoza (available as add-on)</span>
                    </li>
                    <li className="flex items-start text-gray-400">
                      <span className="text-amber-500 mr-2">•</span>
                      <span>Edamame (available as add-on)</span>
                    </li>
                    <li className="flex items-start text-gray-400">
                      <span className="mr-2">•</span>
                      <span>Miso soup (available as add-on)</span>
                    </li>
                  </>
                ) : pkg.id === "basic" ? (
                  <>
                    <li className="flex items-start">
                      <span className="text-amber-500 mr-2">•</span>
                      <span>Fried rice</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-amber-500 mr-2">•</span>
                      <span>Mixed vegetables</span>
                    </li>
                    <li className="flex items-start text-gray-400">
                      <span className="text-amber-500 mr-2">•</span>
                      <span>Gyoza (available as add-on)</span>
                    </li>
                    <li className="flex items-start text-gray-400">
                      <span className="text-amber-500 mr-2">•</span>
                      <span>Edamame (available as add-on)</span>
                    </li>
                    <li className="flex items-start text-gray-400">
                      <span className="mr-2">•</span>
                      <span>Miso soup (available as add-on)</span>
                    </li>
                  </>
                ) : (
                  <>
                    <li className="flex items-start">
                      <span className="text-amber-500 mr-2">•</span>
                      <span>Premium fried rice with upgrades available:</span>
                    </li>
                    <li className="flex items-start ml-4">
                      <span>- Wagyu beef (+$15)</span>
                    </li>
                    <li className="flex items-start ml-4">
                      <span>- Dried scallops (+$12)</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-amber-500 mr-2">•</span>
                      <span>Mixed vegetables</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-amber-500 mr-2">•</span>
                      <span>Gyoza</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-amber-500 mr-2">•</span>
                      <span>Edamame</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-amber-500 mr-2">•</span>
                      <span>Miso soup</span>
                    </li>
                    <li className="flex items-start text-gray-400">
                      <span className="mr-2">•</span>
                      <span>Noodles (available as add-on)</span>
                    </li>
                  </>
                )}
              </ul>
            )}

            {/* Extras Tab */}
            {selectedTab === "extras" && (
              <ul className="space-y-1">
                {pkg.id === "buffet" ? (
                  <>
                    <li className="flex items-start">
                      <span className="text-amber-500 mr-2">•</span>
                      <span>Chef performance</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-amber-500 mr-2">•</span>
                      <span>Serving equipment</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-amber-500 mr-2">•</span>
                      <span>Setup & cleanup</span>
                    </li>
                  </>
                ) : pkg.id === "basic" ? (
                  <>
                    <li className="flex items-start">
                      <span className="text-amber-500 mr-2">•</span>
                      <span>Chef performance</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-amber-500 mr-2">•</span>
                      <span>Serving equipment</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-amber-500 mr-2">•</span>
                      <span>Setup & cleanup</span>
                    </li>
                  </>
                ) : (
                  <>
                    <li className="flex items-start">
                      <span className="text-amber-500 mr-2">•</span>
                      <span>Premium Chef performance</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-amber-500 mr-2">•</span>
                      <span>Serving equipment</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-amber-500 mr-2">•</span>
                      <span>Setup & cleanup</span>
                    </li>
                  </>
                )}
              </ul>
            )}
          </div>
        </div>

        {/* Spacer to push button to bottom */}
        <div className="flex-grow"></div>

        {/* CTA button - 修改按钮行为，点击后进入下一步 */}
        <Button
          className={`w-full ${
            selectedPackage === pkg.id
              ? "bg-green-600 hover:bg-green-700"
              : "bg-amber-500 hover:bg-amber-600"
          }`}
          onClick={(e) => {
            e.stopPropagation()
            if (isAvailable) {
              applyPackage(pkg.id)
              setCurrentStep(2)
            }
          }}
        >
          {selectedPackage === pkg.id ? "Continue to Customize ▶" : "Select Package ▶"}
        </Button>
      </div>
    </div>
  )
}

export default PackageCard 