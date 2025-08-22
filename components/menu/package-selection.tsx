"use client"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type React from "react"
import Link from "next/link"
import Image from "next/image"

import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"
import { regularProteins, premiumProteins, sides, packageOptions, getPackageById } from "@/config/menu-items"
import PackageComparisonTable from "./PackageComparisonTable"
import { getPackageImageById } from "@/config/images"
import {
  initialProteinSelections,
  initialSideSelections,
  initialPackageInclusions,
  initialExtraCharges,
} from "@/lib/menuSelections"

interface PackageSelectionProps {
  packages: any[]
  selectedPackage: string | null
  selectedTab: string
  setSelectedTab: (tab: string) => void
  applyPackage: (packageId: string) => void
  currentStep: 1 | 2 | 3
  setCurrentStep: (step: 1 | 2 | 3) => void
  isComparisonTableExpanded: boolean
  setIsComparisonTableExpanded: (expanded: boolean) => void
  calculatePackagePrice: (headcount: number, childCount: number, upgrades: any) => number
  pricing: any
}

export default function PackageSelection({
  packages,
  selectedPackage,
  selectedTab,
  setSelectedTab,
  applyPackage,
  currentStep,
  setCurrentStep,
  isComparisonTableExpanded,
  setIsComparisonTableExpanded,
  calculatePackagePrice,
  pricing,
}: PackageSelectionProps) {
  // 添加participants状态
  const [participants, setParticipants] = useState([])

  // 添加新的状态变量
  const [showAddForm, setShowAddForm] = useState(false)
  const [newParticipantName, setNewParticipantName] = useState("")

  // 添加订单提交相关状态
  const [customerInfo, setCustomerInfo] = useState({
    name: "",
    email: "",
    phone: "",
    eventDate: "",
    eventTime: "",
    address: "",
    specialRequests: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState<{
    success: boolean
    message: string
    reservationId?: string
  } | null>(null)

  // 添加食材选择状态
  const [proteinSelections, setProteinSelections] = useState(initialProteinSelections())
  const [sideSelections, setSideSelections] = useState(initialSideSelections())

  // 添加套餐包含的默认选项状态
  const [packageInclusions, setPackageInclusions] = useState(initialPackageInclusions)

  // 添加额外费用状态
  const [extraCharges, setExtraCharges] = useState(initialExtraCharges)

  // 添加编辑名称相关状态
  const [editingParticipantId, setEditingParticipantId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState("")

  // 添加 buffet 人数状态
  const [buffetHeadcount, setBuffetHeadcount] = useState(20)

  // 添加 buffet 人数输入状态
  const [buffetHeadcountInput, setBuffetHeadcountInput] = useState("20")

  // 处理 buffet 人数输入变化
  const handleBuffetHeadcountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // 先保存输入的字符串值
    setBuffetHeadcountInput(e.target.value)
  }

  // 处理 buffet 人数输入完成
  const handleBuffetHeadcountBlur = () => {
    const value = Number.parseInt(buffetHeadcountInput)
    if (!isNaN(value)) {
      // 确保值不小于20
      const finalValue = Math.max(20, value)
      setBuffetHeadcount(finalValue)
      setBuffetHeadcountInput(finalValue.toString())

      // 同时更新 package 对象
      const pkg = getPackageById("buffet")
      if (pkg) {
        pkg.headcount = finalValue
      }
    } else {
      // 如果输入无效，恢复为当前值
      setBuffetHeadcountInput(buffetHeadcount.toString())
    }
  }

  // ��据套餐类型设置默认选择
  useEffect(() => {
    if (selectedPackage) {
      const pkg = getPackageById(selectedPackage)
      if (!pkg) return

      // 重置所有选择
      const newProteinSelections = initialProteinSelections()
      const newSideSelections = initialSideSelections()

      // 设置默认蛋白质选择
      pkg.defaultSelections.proteins.forEach((proteinId) => {
        if (newProteinSelections[proteinId]) {
          newProteinSelections[proteinId] = { selected: true, quantity: 1 }
        }
      })

      // 设置默认配菜选择
      pkg.defaultSelections.sides.forEach((sideId) => {
        if (newSideSelections[sideId]) {
          newSideSelections[sideId] = { selected: true, quantity: 1 }
        }
      })

      // 更新状态
      setProteinSelections(newProteinSelections)
      setSideSelections(newSideSelections)

      // 设置套餐包含的选项数量
      setPackageInclusions({
        proteins: pkg.includedItems.regularProteins,
        premiumProteins: pkg.includedItems.premiumProteins,
        sides: pkg.includedItems.sides,
      })

      // 重置额外费用
      setExtraCharges({
        proteins: 0,
        premiumProteins: 0,
        sides: 0,
        total: 0,
      })
    }
  }, [selectedPackage])

  // 计算额外费用
  useEffect(() => {
    if (selectedPackage) {
      const pkg = getPackageById(selectedPackage)
      if (!pkg) return

      // 计算常规蛋白质总价
      const regularProteinsTotal = regularProteins.reduce((sum, protein) => {
        const selection = proteinSelections[protein.id]
        return sum + (selection?.selected ? selection.quantity * protein.price : 0)
      }, 0)

      // 计算高级蛋白质总价
      const premiumProteinsTotal = premiumProteins.reduce((sum, protein) => {
        const selection = proteinSelections[protein.id]
        return sum + (selection?.selected ? selection.quantity * protein.price : 0)
      }, 0)

      // 计算配菜总价
      const sidesTotal = sides.reduce((sum, side) => {
        const selection = sideSelections[side.id]
        return sum + (selection?.selected ? selection.quantity * side.price : 0)
      }, 0)

      // 计算套餐抵扣额度
      const packageCredit = pkg.packageCredit

      // 计算总价和额外费用
      const subtotal = regularProteinsTotal + premiumProteinsTotal + sidesTotal
      const extraCharge = Math.max(0, subtotal - packageCredit)

      // 更新额外费用状态
      setExtraCharges({
        proteins: regularProteinsTotal,
        premiumProteins: premiumProteinsTotal,
        sides: sidesTotal,
        total: extraCharge,
      })
    }
  }, [selectedPackage, proteinSelections, sideSelections])

  return (
    <Card className="mb-10 border-amber-100 bg-gradient-to-b from-white to-amber-50/30">
      <CardHeader className="border-b border-amber-100 pb-4">
        <CardTitle className="text-2xl text-amber-800">Choose a Package</CardTitle>
        <CardDescription className="text-amber-700/80">
          Select one of our popular packages or customize your own experience below
        </CardDescription>
      </CardHeader>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {packageOptions
            .filter((pkg) => pkg.id !== "premium")
            .map((pkg) => (
              <div
                key={pkg.id}
                className={`border rounded-lg overflow-hidden transition-all relative hover:shadow-md ${
                  pkg.id === "basic" ? "border-amber-300/50 hover:border-amber-300" : "hover:border-gray-400"
                }`}
              >
                {/* Package image */}
                <div className="relative h-48 overflow-hidden">
                  <Image
                    src={getPackageImageById(pkg.id) || "/placeholder.svg"}
                    alt={pkg.name}
                    fill
                    className="object-cover hover:scale-105 transition-transform duration-500"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  />
                </div>

                {/* Popularity tag */}
                {pkg.id === "basic" && (
                  <div className="absolute top-2 right-2 z-10">
                    <Badge variant="secondary" className="px-3 py-1 shadow-sm">
                      Most Popular
                    </Badge>
                  </div>
                )}

                {/* Luxury upgrade tag */}
                {pkg.id === "premium" && (
                  <div className="absolute top-2 right-2 z-10">
                    <Badge
                      variant="outline"
                      className="bg-gray-50 px-3 py-1 shadow-sm border border-gray-200 text-gray-700"
                    >
                      Luxury Upgrade
                    </Badge>
                  </div>
                )}

                {/* Buffet tag */}
                {pkg.id === "buffet" && (
                  <div className="absolute top-2 right-2 z-10">
                    <Badge
                      variant="outline"
                      className="bg-blue-50 text-blue-700 border-blue-200 px-3 py-1 shadow-sm border"
                    >
                      Self-Service
                    </Badge>
                  </div>
                )}

                <div className="p-6 flex flex-col h-full">
                  <h3 className="text-xl font-bold mb-2">
                    {pkg.id === "basic"
                      ? "Basic Package"
                      : pkg.id === "premium"
                        ? "Premium Package"
                        : pkg.id === "buffet"
                          ? "Buffet Package"
                          : pkg.name}
                  </h3>

                  <div className="mb-4">
                    <p className="text-lg font-semibold text-amber-600">
                      {pkg.id && (
                        <>
                          <span className="text-gray-500 text-sm line-through mr-2">
                            ${pricing.packages[pkg.id].originalPrice}
                          </span>
                          ${pricing.packages[pkg.id].perPerson}
                          <span className="text-sm font-normal"> per person</span>
                        </>
                      )}
                    </p>
                    <p className="text-xs text-gray-600">
                      {pkg.id && `($${pricing.packages[pkg.id].minimum} minimum)`}
                    </p>
                  </div>

                  <ul className="space-y-1 mb-6 text-sm">
                    {pkg.id === "buffet" ? (
                      <>
                        <li className="flex items-start">
                          <span className="text-amber-500 mr-2">•</span>
                          <span>Self-service buffet style</span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-amber-500 mr-2">•</span>
                          <span>Fixed menu (chicken, shrimp, beef)</span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-amber-500 mr-2">•</span>
                          <span>Fried rice & vegetables</span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-amber-500 mr-2">•</span>
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
                          <span>Gyoza, edamame, lobster & filet available for additional cost</span>
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
                          <span>3 premium proteins of your choice</span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-amber-500 mr-2">•</span>
                          <span>Miso soup, gyoza, edamame</span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-amber-500 mr-2">•</span>
                          <span>Premium fried rice</span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-amber-500 mr-2">•</span>
                          <span>Premium Chef performance</span>
                        </li>
                      </>
                    )}
                  </ul>

                  <div className="flex-grow"></div>

                  <Button className="w-full bg-amber-500 hover:bg-amber-600" asChild>
                    <Link href="/book">Book Now</Link>
                  </Button>
                </div>
              </div>
            ))}
        </div>

        {/* Package comparison table */}
        <PackageComparisonTable
          isExpanded={isComparisonTableExpanded}
          setIsExpanded={setIsComparisonTableExpanded}
          packageOptions={packageOptions}
          pricing={pricing}
        />

        {/* CTA Button */}
        <div className="mt-10 text-center">
          <Button asChild size="lg" className="bg-primary hover:bg-primary/90 px-8 py-6 text-lg">
            <Link href="/book">Book Your Hibachi Experience Now</Link>
          </Button>
          <p className="mt-3 text-sm text-gray-600">
            Have questions?{" "}
            <Link href="/service-area" className="text-primary hover:underline">
              Check service area
            </Link>{" "}
            or check our{" "}
            <Link href="/faq" className="text-primary hover:underline">
              FAQ
            </Link>
          </p>
        </div>
      </div>
    </Card>
  )
}
