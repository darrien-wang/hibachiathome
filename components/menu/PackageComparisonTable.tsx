"use client"

import type React from "react"
import { Button } from "@/components/ui/button"

interface PackageComparisonTableProps {
  isExpanded: boolean
  setIsExpanded: (expanded: boolean) => void
  packageOptions: any[]
  pricing: any
}

const PackageComparisonTable: React.FC<PackageComparisonTableProps> = ({
  isExpanded,
  setIsExpanded,
  packageOptions,
  pricing,
}) => {
  return (
    <>
      <div className="mt-8 mb-4 flex justify-center">
        <Button
          variant="outline"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full max-w-md flex items-center justify-center gap-2"
        >
          {isExpanded ? "Hide Comparison Table" : "Show Package Comparison Table"}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </Button>
      </div>
      {isExpanded && (
        <div className="overflow-x-auto">
          <div className="border rounded-lg overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="py-3 px-4 text-left font-medium border-b">Package Features</th>
                  <th className="py-3 px-4 text-center font-medium border-b">Basic Package</th>
                  <th className="py-3 px-4 text-center font-medium border-b">Buffet Package</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="py-2 px-4 border-b">Price</td>
                  <td className="py-2 px-4 text-center border-b">
                    <span className="text-gray-500 text-xs line-through mr-1">
                      ${pricing.packages.basic.originalPrice}
                    </span>
                    ${pricing.packages.basic.perPerson}/person
                  </td>
                  <td className="py-2 px-4 text-center border-b">
                    <span className="text-gray-500 text-xs line-through mr-1">
                      ${pricing.packages.buffet.originalPrice}
                    </span>
                    ${pricing.packages.buffet.perPerson}/person
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-4 border-b">Protein Options</td>
                  <td className="py-2 px-4 text-center border-b">2 regular proteins</td>
                  <td className="py-2 px-4 text-center border-b">Fixed menu</td>
                </tr>
                <tr>
                  <td className="py-2 px-4 border-b">Side Dishes</td>
                  <td className="py-2 px-4 text-center border-b">Fried rice & vegetables</td>
                  <td className="py-2 px-4 text-center border-b">Fried rice & vegetables</td>
                </tr>
                <tr>
                  <td className="py-2 px-4 border-b">Appetizers</td>
                  <td className="py-2 px-4 text-center border-b">Available as add-ons</td>
                  <td className="py-2 px-4 text-center border-b">Available as add-ons</td>
                </tr>
                <tr>
                  <td className="py-2 px-4 border-b">Chef Performance</td>
                  <td className="py-2 px-4 text-center border-b">Standard performance</td>
                  <td className="py-2 px-4 text-center border-b">Standard performance</td>
                </tr>
                <tr>
                  <td className="py-2 px-4 border-b">Minimum Price</td>
                  <td className="py-2 px-4 text-center border-b">${pricing.packages.basic.minimum}</td>
                  <td className="py-2 px-4 text-center border-b">${pricing.packages.buffet.minimum}</td>
                </tr>
                <tr>
                  <td className="py-2 px-4 border-b">Service Style</td>
                  <td className="py-2 px-4 text-center border-b">Live cooking</td>
                  <td className="py-2 px-4 text-center border-b">Buffet style</td>
                </tr>
                <tr>
                  <td className="py-2 px-4">Customization</td>
                  <td className="py-2 px-4 text-center">Customizable</td>
                  <td className="py-2 px-4 text-center">Fixed menu</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}

export default PackageComparisonTable
