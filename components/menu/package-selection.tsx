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

  // 根据套餐类型设置默认选择
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
    <div className="relative">
      {/* Fire background overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-orange-900/20 via-red-900/10 to-yellow-900/20 pointer-events-none"></div>

      <Card className="mb-10 border-none bg-gradient-to-br from-gray-900 via-black to-gray-800 relative overflow-hidden">
        {/* Fire glow effect */}
        <div className="absolute inset-0 bg-gradient-to-t from-orange-500/5 via-transparent to-yellow-500/5 pointer-events-none"></div>

        <CardHeader className="border-b border-orange-500/20 pb-6 relative z-10">
          <CardTitle className="text-3xl md:text-4xl font-energy font-bold text-center fire-text-gradient mb-2">
            Our Popular Packages
          </CardTitle>
          <CardDescription className="text-gray-300 text-center text-lg max-w-2xl mx-auto leading-relaxed">
            Choose from our carefully crafted packages designed to provide the perfect hibachi experience for any
            occasion.
          </CardDescription>
        </CardHeader>

        <div className="p-8 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            {packageOptions
              .filter((pkg) => pkg.id !== "premium")
              .map((pkg) => (
                <div key={pkg.id} className="relative group">
                  {/* Package card with fire theme */}
                  <div className="bg-gradient-to-br from-amber-900/40 via-orange-900/30 to-red-900/40 backdrop-blur-sm border border-orange-500/30 rounded-2xl overflow-hidden transition-all duration-500 hover:border-orange-400/50 hover:shadow-2xl hover:shadow-orange-500/20 relative">
                    {/* Fire glow on hover */}
                    <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 via-transparent to-yellow-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                    {/* Most Popular Badge */}
                    {pkg.id === "basic" && (
                      <div className="absolute top-4 right-4 z-20">
                        <Badge className="bg-gradient-to-r from-yellow-400 to-orange-400 text-black font-bold px-4 py-2 text-sm tracking-wide shadow-lg">
                          MOST POPULAR
                        </Badge>
                      </div>
                    )}

                    {/* Buffet Badge */}
                    {pkg.id === "buffet" && (
                      <div className="absolute top-4 right-4 z-20">
                        <Badge className="bg-gradient-to-r from-blue-400 to-cyan-400 text-black font-bold px-4 py-2 text-sm tracking-wide shadow-lg">
                          SELF-SERVICE
                        </Badge>
                      </div>
                    )}

                    {/* Package image with fire overlay */}
                    <div className="relative h-48 overflow-hidden">
                      <Image
                        src={getPackageImageById(pkg.id) || "/placeholder.svg"}
                        alt={pkg.name}
                        fill
                        className="object-cover group-hover:scale-110 transition-transform duration-700"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      />
                      {/* Fire gradient overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-orange-900/20 to-transparent"></div>
                    </div>

                    <div className="p-6 relative z-10">
                      {/* Package title */}
                      <h3 className="text-2xl font-energy font-bold mb-4 fire-text-gradient">
                        {pkg.id === "basic" ? "Basic Package" : pkg.id === "buffet" ? "Buffet Package" : pkg.name}
                      </h3>

                      {/* Pricing */}
                      <div className="mb-6">
                        <div className="flex items-baseline gap-2 mb-1">
                          {pkg.id && (
                            <>
                              <span className="text-gray-400 text-lg line-through">
                                ${pricing.packages[pkg.id].originalPrice}
                              </span>
                              <span className="text-3xl font-bold fire-text-gradient">
                                ${pricing.packages[pkg.id].perPerson}
                              </span>
                              <span className="text-gray-300 text-lg">/person</span>
                            </>
                          )}
                        </div>
                        <p className="text-yellow-400 text-sm font-medium">
                          {pkg.id && `Only $${pricing.packages[pkg.id].minimum} minimum!`}
                        </p>
                      </div>

                      {/* Features list */}
                      <ul className="space-y-3 mb-8 text-gray-200">
                        {pkg.id === "buffet" ? (
                          <>
                            <li className="flex items-start gap-3">
                              <span className="text-yellow-400 text-lg mt-0.5">✓</span>
                              <span>Self-service buffet style</span>
                            </li>
                            <li className="flex items-start gap-3">
                              <span className="text-yellow-400 text-lg mt-0.5">✓</span>
                              <span>Fixed menu (chicken, shrimp, beef)</span>
                            </li>
                            <li className="flex items-start gap-3">
                              <span className="text-yellow-400 text-lg mt-0.5">✓</span>
                              <span>Fried rice & vegetables</span>
                            </li>
                            <li className="flex items-start gap-3">
                              <span className="text-yellow-400 text-lg mt-0.5">✓</span>
                              <span>Chef performance included</span>
                            </li>
                          </>
                        ) : (
                          <>
                            <li className="flex items-start gap-3">
                              <span className="text-yellow-400 text-lg mt-0.5">✓</span>
                              <span>2 proteins of your choice</span>
                            </li>
                            <li className="flex items-start gap-3">
                              <span className="text-yellow-400 text-lg mt-0.5">✓</span>
                              <span>Fried rice & vegetables</span>
                            </li>
                            <li className="flex items-start gap-3">
                              <span className="text-yellow-400 text-lg mt-0.5">✓</span>
                              <span>Chef performance included</span>
                            </li>
                            <li className="flex items-start gap-3">
                              <span className="text-yellow-400 text-lg mt-0.5">✓</span>
                              <span>Perfect for intimate gatherings</span>
                            </li>
                          </>
                        )}
                      </ul>

                      {/* CTA Button */}
                      <Button
                        className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 text-white font-bold py-4 text-lg rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-orange-500/30 hover:scale-105 border-none"
                        asChild
                      >
                        <Link href="/book">BOOK NOW</Link>
                      </Button>
                    </div>
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
          <div className="mt-12 text-center">
            <Button
              asChild
              size="lg"
              className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 text-white font-bold px-12 py-6 text-xl rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-orange-500/30 hover:scale-105 border-none"
            >
              <Link href="/book">Book Your Hibachi Experience Now</Link>
            </Button>
            <p className="mt-4 text-gray-400">
              Have questions?{" "}
              <Link href="/contact" className="text-orange-400 hover:text-orange-300 hover:underline transition-colors">
                Contact us
              </Link>{" "}
              or check our{" "}
              <Link href="/faq" className="text-orange-400 hover:text-orange-300 hover:underline transition-colors">
                FAQ
              </Link>
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
