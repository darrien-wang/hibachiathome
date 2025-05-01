"use client"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type React from "react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useState, useEffect } from "react"
import { createBookingWithOrder } from "@/app/actions/booking"
import type { Reservation } from "@/types/booking"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CheckCircle, AlertCircle } from "lucide-react"
import { regularProteins, premiumProteins, sides, packageOptions, getPackageById } from "@/config/menu-items"
import PackageComparisonTable from "./PackageComparisonTable"

// 拆分：将初始化蛋白质和配菜选择的函数提到组件外部
function initialProteinSelections() {
  const selections: Record<string, { selected: boolean; quantity: number }> = {}
  regularProteins.forEach((protein) => {
    selections[protein.id] = { selected: false, quantity: 0 }
  })
  premiumProteins.forEach((protein) => {
    selections[protein.id] = { selected: false, quantity: 0 }
  })
  return selections
}

function initialSideSelections() {
  const selections: Record<string, { selected: boolean; quantity: number }> = {}
  sides.forEach((side) => {
    selections[side.id] = { selected: false, quantity: 0 }
  })
  return selections
}

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
}

// 拆分：将套餐包含的默认选项状态和额外费用状态的初始值对象提到组件外部
const initialPackageInclusions = {
  proteins: 0,
  premiumProteins: 0,
  sides: 0,
}

const initialExtraCharges = {
  proteins: 0,
  premiumProteins: 0,
  sides: 0,
  total: 0,
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

  // 修改handleAddOrder函数
  const handleAddOrder = () => {
    setShowAddForm(true)
    setNewParticipantName("")
  }

  // 添加handleAddParticipant函数
  const handleAddParticipant = () => {
    if (newParticipantName.trim()) {
      const newId = participants.length > 0 ? Math.max(...participants.map((p) => p.id)) + 1 : 1
      const newParticipant = {
        id: newId,
        name: newParticipantName.trim(),
        status: "in-progress",
        isSelected: false,
        proteinSelections: initialProteinSelections(),
        sideSelections: initialSideSelections(),
      }

      // 取消选择所有其他参与者
      const updatedParticipants = participants.map((p) => ({
        ...p,
        isSelected: false,
      }))

      // 添加新参与者并设为选中状态
      setParticipants([...updatedParticipants, { ...newParticipant, isSelected: true }])
      setShowAddForm(false)

      // 更新当前选择状态为新参与者的状态
      setProteinSelections(initialProteinSelections())
      setSideSelections(initialSideSelections())
    }
  }

  // 添加handleSelectParticipant函数
  const handleSelectParticipant = (id: number) => {
    const selectedParticipant = participants.find((p) => p.id === id)

    if (selectedParticipant) {
      // 更新当前选择状态为所选参与者的状态
      setProteinSelections(selectedParticipant.proteinSelections || initialProteinSelections())
      setSideSelections(selectedParticipant.sideSelections || initialSideSelections())
    }

    setParticipants(
      participants.map((p) => ({
        ...p,
        isSelected: p.id === id,
      })),
    )
  }

  // 添加处理表单输入变化的函数
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target
    setCustomerInfo((prev) => ({
      ...prev,
      [id]: value,
    }))
  }

  // 添加提交订单的函数
  const handleSubmitOrder = async () => {
    if (!selectedPackage) {
      alert("Please select a package first")
      return
    }

    // 验证必填字段
    if (
      !customerInfo.name ||
      !customerInfo.phone ||
      !customerInfo.eventDate ||
      !customerInfo.eventTime ||
      !customerInfo.address
    ) {
      alert("Please fill in all required fields")
      return
    }

    setIsSubmitting(true)
    setSubmitResult(null)

    try {
      const selectedPkg = packages.find((pkg) => pkg.id === selectedPackage)

      // 准备预订数据
      const reservationData: Reservation = {
        name: customerInfo.name,
        email: customerInfo.email || undefined,
        phone: customerInfo.phone,
        headcount: selectedPkg.headcount,
        event_date: customerInfo.eventDate,
        event_time: customerInfo.eventTime,
        address: customerInfo.address,
        special_requests: customerInfo.specialRequests || undefined,
        status: "pending",
      }

      // 准备订单数据
      const orderData = {
        package_id: selectedPackage,
        total_price: selectedPkg.flatRate,
        items: [
          {
            item_type: "package",
            item_id: selectedPackage,
            quantity: 1,
            price: selectedPkg.flatRate,
          },
        ],
        participants: participants.map((participant) => ({
          name: participant.name,
          is_host: participant.id === participants.find((p) => p.isSelected)?.id,
          selections: [],
        })),
      }

      // 调用服务器操作创建预订和订单
      const result = await createBookingWithOrder(reservationData, orderData)

      if (result.success && result.data) {
        setSubmitResult({
          success: true,
          message: "Your order has been successfully submitted! We'll contact you shortly to confirm details.",
          reservationId: result.data.reservation.id,
        })

        // 重置表单
        setCustomerInfo({
          name: "",
          email: "",
          phone: "",
          eventDate: "",
          eventTime: "",
          address: "",
          specialRequests: "",
        })
      } else {
        setSubmitResult({
          success: false,
          message: result.error || "There was an error submitting your order. Please try again.",
        })
      }
    } catch (error: any) {
      console.error("Error submitting order:", error)
      setSubmitResult({
        success: false,
        message: error.message || "There was an error submitting your order. Please try again.",
      })
    } finally {
      setIsSubmitting(false)
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

  // 处理蛋白质选择变化
  const handleProteinChange = (protein, isChecked) => {
    const newProteinSelections = {
      ...proteinSelections,
      [protein]: { ...proteinSelections[protein], selected: isChecked, quantity: isChecked ? 1 : 0 },
    }

    setProteinSelections(newProteinSelections)

    // 自动保存到当前选中的参与者
    const selectedParticipant = participants.find((p) => p.isSelected)
    if (selectedParticipant) {
      setParticipants(
        participants.map((p) => {
          if (p.id === selectedParticipant.id) {
            return {
              ...p,
              status: "submitted",
              proteinSelections: newProteinSelections,
              sideSelections: sideSelections,
            }
          }
          return p
        }),
      )
    }
  }

  // 处理蛋白质数量变化
  const handleProteinQuantityChange = (protein, delta) => {
    const newQuantity = Math.max(0, proteinSelections[protein].quantity + delta)
    const newProteinSelections = {
      ...proteinSelections,
      [protein]: {
        ...proteinSelections[protein],
        selected: newQuantity > 0,
        quantity: newQuantity,
      },
    }

    setProteinSelections(newProteinSelections)

    // 自动保存到当前选中的参与者
    const selectedParticipant = participants.find((p) => p.isSelected)
    if (selectedParticipant) {
      setParticipants(
        participants.map((p) => {
          if (p.id === selectedParticipant.id) {
            return {
              ...p,
              status: "submitted",
              proteinSelections: newProteinSelections,
              sideSelections: sideSelections,
            }
          }
          return p
        }),
      )
    }
  }

  // 处理配菜选择变化
  const handleSideChange = (side, isChecked) => {
    const newSideSelections = {
      ...sideSelections,
      [side]: { ...sideSelections[side], selected: isChecked, quantity: isChecked ? 1 : 0 },
    }

    setSideSelections(newSideSelections)

    // 自动保存到当前选中的参与者
    const selectedParticipant = participants.find((p) => p.isSelected)
    if (selectedParticipant) {
      setParticipants(
        participants.map((p) => {
          if (p.id === selectedParticipant.id) {
            return {
              ...p,
              status: "submitted",
              proteinSelections: proteinSelections,
              sideSelections: newSideSelections,
            }
          }
          return p
        }),
      )
    }
  }

  // 处理配菜数量变化
  const handleSideQuantityChange = (side, delta) => {
    const newQuantity = Math.max(0, sideSelections[side].quantity + delta)
    const newSideSelections = {
      ...sideSelections,
      [side]: {
        ...sideSelections[side],
        selected: newQuantity > 0,
        quantity: newQuantity,
      },
    }

    setSideSelections(newSideSelections)

    // 自动保存到当前选中的参与者
    const selectedParticipant = participants.find((p) => p.isSelected)
    if (selectedParticipant) {
      setParticipants(
        participants.map((p) => {
          if (p.id === selectedParticipant.id) {
            return {
              ...p,
              status: "submitted",
              proteinSelections: proteinSelections,
              sideSelections: newSideSelections,
            }
          }
          return p
        }),
      )
    }
  }

  // 处理开始编辑参与者名称
  const handleStartEditName = (id: number, name: string, e: React.MouseEvent) => {
    e.stopPropagation()
    handleSelectParticipant(id) // 确保选中当前行

    // 确保所有菜单都关闭
    const menus = document.querySelectorAll('[id^="menu-"]')
    menus.forEach((menu) => {
      menu.classList.add("hidden")
    })

    setEditingParticipantId(id)
    setEditingName(name)
  }

  // 处理保存编辑后的名称
  const handleSaveName = (id: number, e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation()
    if (editingName.trim()) {
      setParticipants(
        participants.map((p) => {
          if (p.id === id) {
            return { ...p, name: editingName.trim() }
          }
          return p
        }),
      )
    }
    setEditingParticipantId(null)
  }

  // 处理取消编辑
  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingParticipantId(null)
  }

  // useEffect to update protein and side selections when the selected participant changes
  useEffect(() => {
    const selectedParticipant = participants.find((p) => p.isSelected)
    if (selectedParticipant) {
      setProteinSelections(selectedParticipant.proteinSelections || initialProteinSelections())
      setSideSelections(selectedParticipant.sideSelections || initialSideSelections())
    }
  }, [participants])

  // 添加点击外部关闭菜单的事件处理
  useEffect(() => {
    const handleClickOutside = (event) => {
      const menus = document.querySelectorAll('[id^="menu-"]')
      menus.forEach((menu) => {
        if (!menu.contains(event.target) && !event.target.closest('button[id^="menu-button-"]')) {
          menu.classList.add("hidden")
        }
      })
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  return (
    <Card className="mb-10 border-amber-100 bg-gradient-to-b from-white to-amber-50/30">
      <CardHeader className="border-b border-amber-100 pb-4">
        <CardTitle className="text-2xl text-amber-800">Choose a Package</CardTitle>
        <CardDescription className="text-amber-700/80">
          Select one of our popular packages or customize your own experience below
        </CardDescription>
      </CardHeader>

      {/* 步骤条 */}
      <div className="mb-6 p-6 pb-0">
        <div className="flex items-center justify-between w-full max-w-3xl mx-auto mb-4">
          {/* 步骤1 */}
          <div className="flex flex-col items-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium mb-2 ${
                currentStep >= 1 ? "bg-amber-500" : "bg-gray-300"
              }`}
              onClick={() => currentStep > 1 && setCurrentStep(1)}
            >
              1
            </div>
            <span className={`text-xs ${currentStep === 1 ? "font-medium text-amber-700" : "text-gray-500"}`}>
              Select Package
            </span>
          </div>

          {/* 连接线1 */}
          <div className="flex-1 h-0.5 mx-2 bg-gray-200 relative">
            <div
              className="absolute top-0 left-0 h-full bg-amber-500 transition-all duration-300"
              style={{ width: currentStep > 1 ? "100%" : "0%" }}
            ></div>
          </div>

          {/* 步骤2 */}
          <div className="flex flex-col items-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium mb-2 ${
                currentStep >= 2 ? "bg-amber-500" : "bg-gray-300"
              }`}
              onClick={() => currentStep > 2 && setCurrentStep(2)}
            >
              2
            </div>
            <span className={`text-xs ${currentStep === 2 ? "font-medium text-amber-700" : "text-gray-500"}`}>
              Customize Meal
            </span>
          </div>

          {/* 连接线2 */}
          <div className="flex-1 h-0.5 mx-2 bg-gray-200 relative">
            <div
              className="absolute top-0 left-0 h-full bg-amber-500 transition-all duration-300"
              style={{ width: currentStep > 2 ? "100%" : "0%" }}
            ></div>
          </div>

          {/* 步骤3 */}
          <div className="flex flex-col items-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium mb-2 ${
                currentStep === 3 ? "bg-amber-500" : "bg-gray-300"
              }`}
            >
              3
            </div>
            <span className={`text-xs ${currentStep === 3 ? "font-medium text-amber-700" : "text-gray-500"}`}>
              Review & Pay
            </span>
          </div>
        </div>
        <p className="text-center text-xs text-gray-500 mt-2">
          {currentStep === 1
            ? "Choose a package that suits your needs"
            : currentStep === 2
              ? "Customize your meal according to your preferences"
              : "Review your order and complete payment"}
        </p>
      </div>

      {/* 步骤内容区域 */}
      {currentStep === 1 && (
        <div className="p-6 pt-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {packageOptions.map((pkg) => {
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
              const hasFreeRiceUpgrade = pkg.headcount >= 15
              const hasPremiumRiceUpgrade = pkg.headcount >= 20

              return (
                <div
                  key={pkg.id}
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
                      <Badge variant="outline" className="bg-gray-50 px-3 py-1 shadow-sm">
                        Luxury Upgrade
                      </Badge>
                    )}

                    {/* Buffet tag */}
                    {pkg.id === "buffet" && (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 px-3 py-1 shadow-sm">
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
                            <span className="text-gray-500 text-sm line-through mr-2">${pkg.originalPrice}</span>$
                            {pkg.currentPrice}
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
                              e.stopPropagation() // Prevent card selection when clicking tab
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
                          setCurrentStep(2) // 点击后进入第2步
                        }
                      }}
                    >
                      {selectedPackage === pkg.id ? "Continue to Customize ▶" : "Select Package ▶"}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* 添加对比表格按钮和表格 */}
          <PackageComparisonTable
            isExpanded={isComparisonTableExpanded}
            setIsExpanded={setIsComparisonTableExpanded}
            packageOptions={packageOptions}
          />
        </div>
      )}

      {/* 步骤2: 定制餐品 */}
      {currentStep === 2 && (
        <div className="p-6 pt-0">
          {selectedPackage === "buffet" ? (
            // Buffet 套餐简化界面 - 只需确认人数
            <div className="mb-6">
              <h3 className="text-xl font-bold mb-4">Buffet Package Confirmation</h3>
              <p className="text-sm text-gray-600 mb-6">
                The buffet package includes a fixed menu with chicken, premium steak, and shrimp. No customization is
                needed.
              </p>

              <div className="border rounded-lg p-6 bg-amber-50/50 mb-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                  <div>
                    <h4 className="font-medium mb-1">Number of Guests</h4>
                    <p className="text-sm text-gray-600">Minimum 20 guests required</p>
                  </div>
                  <div className="flex items-center">
                    <button
                      className="w-10 h-10 rounded-full border border-amber-300 flex items-center justify-center text-amber-700"
                      onClick={() => {
                        const pkg = getPackageById("buffet")
                        if (pkg && pkg.headcount > 20) {
                          pkg.headcount -= 1
                        }
                      }}
                    >
                      -
                    </button>
                    <span className="mx-4 w-12 text-center text-lg font-medium">
                      {getPackageById("buffet")?.headcount || 20}
                    </span>
                    <button
                      className="w-10 h-10 rounded-full border border-amber-300 flex items-center justify-center text-amber-700"
                      onClick={() => {
                        const pkg = getPackageById("buffet")
                        if (pkg) {
                          pkg.headcount += 1
                        }
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="border-t border-amber-100 pt-4 mt-2">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">Total Price:</p>
                      <p className="text-sm text-gray-600">$39.9 per person</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-amber-600">
                        ${(getPackageById("buffet")?.headcount || 20) * 39.9}
                      </p>
                      <p className="text-xs text-gray-500">($798 minimum)</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between mt-8">
                <Button variant="outline" onClick={() => setCurrentStep(1)}>
                  ◀ Back
                </Button>
                <Button className="bg-amber-500 hover:bg-amber-600" onClick={() => setCurrentStep(3)}>
                  Continue to Checkout ▶
                </Button>
              </div>
            </div>
          ) : (
            // 原有的定制餐品界面 - 对于非 buffet 套餐
            <div className="mb-6">
              <h3 className="text-xl font-bold mb-2">
                {selectedPackage === "basic" ? "Basic Package" : "Premium Package"} Customization
              </h3>
              <p className="text-sm text-gray-600">Customize your meal according to your preferences</p>
            </div>
          )}

          {selectedPackage !== "buffet" && (
            <>
              {/* Group Order Management Section */}
              <div className="border rounded-lg mb-6">
                {/* Order Info Header */}
                <div className="p-4 border-b">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center">
                      <span className="text-sm font-medium mr-1">Event Name:</span>
                      <input
                        type="text"
                        className="border-b border-dashed border-gray-300 bg-transparent px-1 text-sm focus:outline-none focus:border-primary"
                        defaultValue="Weekend Gathering"
                        placeholder="Enter event name"
                      />
                    </div>
                    <div className="text-sm text-gray-600 hidden sm:block">•</div>
                    <div className="flex items-center">
                      <span className="text-sm font-medium mr-1">Party Size:</span>
                      <input
                        type="number"
                        className="border-b border-dashed border-gray-300 bg-transparent w-12 px-1 text-sm focus:outline-none focus:border-primary"
                        defaultValue={getPackageById(selectedPackage || "")?.headcount || 0}
                        min="1"
                        placeholder="Guests"
                      />
                    </div>
                  </div>
                </div>

                {/* Share Link Section */}
                <div className="p-4 border-b bg-gray-50">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center flex-1">
                      <span className="text-sm font-medium mr-2">Share Link:</span>
                      <div className="relative flex-1 max-w-lg">
                        <input
                          type="text"
                          className="w-full border rounded-md py-1 px-3 text-sm pr-24 bg-white"
                          value={`https://yoursite.com/group/${Math.random().toString(36).substring(2, 8).toUpperCase()}`}
                          readOnly
                        />
                        <button className="absolute right-1 top-1/2 -translate-y-1/2 bg-gray-100 hover:bg-gray-200 text-xs py-0.5 px-2 rounded border transition-colors">
                          Copy Link
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <span className="text-sm mr-2">
                        Orders Received: <strong>3</strong> / {getPackageById(selectedPackage || "")?.headcount || 0}
                      </span>
                      <button className="text-xs py-1 px-2 border rounded hover:bg-gray-100 transition-colors">
                        Refresh
                      </button>
                    </div>
                  </div>
                </div>

                {/* Two-column Layout */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
                  {/* Left Column: Participants List */}
                  <div className="border-r">
                    <div className="p-4">
                      <h4 className="font-medium mb-3">Participants ({participants.length})</h4>
                      {showAddForm ? (
                        <div className="mb-4 border rounded-md p-3">
                          <h5 className="text-sm font-medium mb-2">Add New Participant</h5>
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="text"
                              className="flex-1 p-2 border rounded-md text-sm min-w-[200px]"
                              placeholder="Enter participant name"
                              value={newParticipantName}
                              onChange={(e) => setNewParticipantName(e.target.value)}
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  handleAddParticipant()
                                } else if (e.key === "Escape") {
                                  setShowAddForm(false)
                                }
                              }}
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={handleAddParticipant}
                                className="py-2 px-3 bg-primary text-white rounded-md text-sm hover:bg-primary/90"
                              >
                                Add
                              </button>
                              <button
                                onClick={() => setShowAddForm(false)}
                                className="py-2 px-3 border rounded-md text-sm hover:bg-gray-50 bg-white"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={handleAddOrder}
                          className="w-full py-2 px-3 border border-dashed rounded-md text-sm flex items-center justify-center hover:bg-gray-50 mb-4 cursor-pointer active:bg-gray-100"
                        >
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
                            className="mr-1"
                          >
                            <path d="M12 5v14M5 12h14" />
                          </svg>
                          Add Order
                        </button>
                      )}

                      {/* Participants List */}
                      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 relative">
                        {participants.map((participant) => (
                          <div
                            key={participant.id}
                            className={`border rounded-md p-3 transition-all duration-200 ${
                              participant.isSelected
                                ? "bg-primary/10 border-primary shadow-sm"
                                : "hover:border-gray-400 hover:bg-gray-50"
                            } cursor-pointer`}
                            onClick={() => handleSelectParticipant(participant.id)}
                          >
                            <div className="flex justify-between items-center">
                              <div className="flex items-center min-w-0 flex-grow">
                                {editingParticipantId === participant.id ? (
                                  <div className="flex items-center gap-1 mr-2 w-full">
                                    <input
                                      type="text"
                                      className="border rounded px-1 py-0.5 text-sm flex-grow"
                                      value={editingName}
                                      onChange={(e) => setEditingName(e.target.value)}
                                      onClick={(e) => e.stopPropagation()}
                                      autoFocus
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          handleSaveName(participant.id, e)
                                        } else if (e.key === "Escape") {
                                          handleCancelEdit(e as any)
                                        }
                                      }}
                                    />
                                    <button
                                      className="text-xs py-0.5 px-1 border rounded bg-green-50 hover:bg-green-100"
                                      onClick={(e) => handleSaveName(participant.id, e)}
                                    >
                                      ✓
                                    </button>
                                    <button
                                      className="text-xs py-0.5 px-1 border rounded bg-gray-50 hover:bg-gray-100"
                                      onClick={handleCancelEdit}
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <span className="font-medium truncate mr-2">{participant.name}</span>
                                    <span
                                      className={`flex-shrink-0 text-xs whitespace-nowrap ${
                                        participant.status === "submitted"
                                          ? "bg-green-100 text-green-800"
                                          : "bg-yellow-100 text-yellow-800"
                                      } py-0.5 px-1.5 rounded-full`}
                                    >
                                      {participant.status === "submitted" ? "Submitted" : "In Progress"}
                                    </span>
                                  </>
                                )}
                              </div>
                              {editingParticipantId === participant.id ? (
                                // 编辑模式下不显示其他按钮
                                <div></div>
                              ) : (
                                // 非编辑模式下显示操作按钮
                                <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                                  <button
                                    className="text-xs py-0.5 px-1.5 border rounded hover:bg-gray-100 hidden sm:block"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleSelectParticipant(participant.id)
                                      handleStartEditName(participant.id, participant.name, e)
                                    }}
                                  >
                                    Edit
                                  </button>
                                  <div className="relative inline-block">
                                    <button
                                      className="text-xs py-0.5 px-1 border rounded hover:bg-gray-100 flex items-center"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleSelectParticipant(participant.id)
                                        const menu = document.getElementById(`menu-${participant.id}`)
                                        if (menu) {
                                          menu.classList.toggle("hidden")
                                        }
                                      }}
                                    >
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="12"
                                        height="12"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      >
                                        <circle cx="12" cy="12" r="1"></circle>
                                        <circle cx="12" cy="5" r="1"></circle>
                                        <circle cx="12" cy="19" r="1"></circle>
                                      </svg>
                                      <span className="sm:hidden ml-1">Edit</span>
                                    </button>
                                    <div
                                      id={`menu-${participant.id}`}
                                      className="absolute right-0 mt-1 w-32 bg-white border rounded-md shadow-lg z-10 hidden"
                                      style={{ maxHeight: "150px", overflowY: "auto" }}
                                    >
                                      <button
                                        className="w-full text-left text-xs py-1.5 px-2 hover:bg-gray-100 block sm:hidden"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleSelectParticipant(participant.id)
                                          handleStartEditName(participant.id, participant.name, e)
                                          document.getElementById(`menu-${participant.id}`).classList.add("hidden")
                                        }}
                                      >
                                        Edit
                                      </button>
                                      <button
                                        className="w-full text-left text-xs py-1.5 px-2 hover:bg-gray-100"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleSelectParticipant(participant.id)
                                          // 复制当前参与者的选择到新参与者
                                          const selectedParticipant = participants.find((p) => p.id === participant.id)
                                          if (selectedParticipant) {
                                            const newId =
                                              participants.length > 0
                                                ? Math.max(...participants.map((p) => p.id)) + 1
                                                : 1
                                            const newParticipant = {
                                              id: newId,
                                              name: `${selectedParticipant.name} (Copy)`,
                                              status: "in-progress",
                                              isSelected: false,
                                              proteinSelections: { ...selectedParticipant.proteinSelections },
                                              sideSelections: { ...selectedParticipant.sideSelections },
                                            }
                                            setParticipants([...participants, newParticipant])
                                            // 复制后立即开始编辑新参与者的名称
                                            setTimeout(() => {
                                              setEditingParticipantId(newId)
                                              setEditingName(newParticipant.name)
                                            }, 100)
                                          }
                                          document.getElementById(`menu-${participant.id}`).classList.add("hidden")
                                        }}
                                      >
                                        Copy
                                      </button>
                                      <button
                                        className="w-full text-left text-xs py-1.5 px-2 hover:bg-gray-100 text-red-600"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          // 删除当前参与者
                                          setParticipants(participants.filter((p) => p.id !== participant.id))
                                          document.getElementById(`menu-${participant.id}`).classList.add("hidden")
                                        }}
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Current Order Panel */}
                  <div>
                    <div className="p-4">
                      {/* 显示当前套餐 */}
                      <div className="mb-3 p-2 bg-gray-50 rounded-md border">
                        <h5 className="text-sm font-medium">
                          Selected Package:{" "}
                          <span className="text-[#C33]">
                            {selectedPackage === "buffet"
                              ? "Buffet Package"
                              : selectedPackage === "basic"
                                ? "Basic Package"
                                : "Premium Package"}
                          </span>
                        </h5>
                        <p className="text-xs text-gray-600 mt-1">
                          {selectedPackage === "basic"
                            ? "Includes 2 regular proteins ($20 credit)"
                            : selectedPackage === "premium"
                              ? "Includes 3 premium proteins ($70 credit)"
                              : "Fixed menu with chicken, premium steak, and shrimp"}
                        </p>
                      </div>

                      <div className="flex justify-between items-center mb-3">
                        <h4 className="font-medium">
                          Current Order:{" "}
                          <span className="text-primary">
                            {participants.find((p) => p.isSelected)?.name || "No selection"}
                          </span>
                        </h4>
                        <span className="text-xs bg-green-100 text-green-800 py-0.5 px-1.5 rounded-full">
                          {participants.find((p) => p.isSelected)?.status === "submitted" ? "Submitted" : "In Progress"}
                        </span>
                      </div>

                      {/* Regular Proteins Selection - 仅在非Premium套餐时显示 */}
                      {selectedPackage !== "premium" && (
                        <div className="mb-4">
                          <h5 className="text-sm font-medium mb-2">
                            Regular Proteins <span className="text-xs text-gray-500">($10 each)</span>
                          </h5>
                          <div className="space-y-2">
                            {regularProteins.map((protein) => (
                              <div key={protein.id} className="flex items-center justify-between">
                                <div className="flex items-center">
                                  <input
                                    type="checkbox"
                                    id={`protein-${protein.id}`}
                                    className="mr-2"
                                    checked={proteinSelections[protein.id]?.selected || false}
                                    onChange={(e) => handleProteinChange(protein.id, e.target.checked)}
                                  />
                                  <label htmlFor={`protein-${protein.id}`} className="flex items-center">
                                    <span>{protein.name}</span>
                                    <span className="text-xs text-gray-500 ml-1">${protein.price}</span>
                                    {protein.allergens && protein.allergens.some((a) => a !== "none") && (
                                      <span
                                        className="ml-1 text-xs text-amber-600"
                                        title={`Contains: ${protein.allergens.filter((a) => a !== "none").join(", ")}`}
                                      >
                                        ⚠️
                                      </span>
                                    )}
                                  </label>
                                </div>
                                <div className="flex items-center">
                                  <button
                                    className="w-6 h-6 rounded-full border flex items-center justify-center text-gray-500"
                                    onClick={() => handleProteinQuantityChange(protein.id, -1)}
                                    disabled={!proteinSelections[protein.id]?.quantity}
                                  >
                                    -
                                  </button>
                                  <span className="mx-2 w-6 text-center">
                                    {proteinSelections[protein.id]?.quantity || 0}
                                  </span>
                                  <button
                                    className="w-6 h-6 rounded-full border flex items-center justify-center text-gray-500"
                                    onClick={() => handleProteinQuantityChange(protein.id, 1)}
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Premium Proteins */}
                      <div className="mb-4">
                        <h5 className="text-sm font-medium mb-2">
                          Premium Proteins <span className="text-xs text-gray-500">($20 each)</span>
                        </h5>
                        <div className="space-y-2">
                          {premiumProteins.map((protein) => (
                            <div key={protein.id} className="flex items-center justify-between">
                              <div className="flex items-center">
                                <input
                                  type="checkbox"
                                  id={`premium-${protein.id}`}
                                  className="mr-2"
                                  checked={proteinSelections[protein.id]?.selected || false}
                                  onChange={(e) => handleProteinChange(protein.id, e.target.checked)}
                                />
                                <label htmlFor={`premium-${protein.id}`} className="flex items-center">
                                  <span>{protein.name}</span>
                                  <span className="text-xs text-gray-500 ml-1">${protein.price}</span>
                                  {protein.allergens && protein.allergens.some((a) => a !== "none") && (
                                    <span
                                      className="ml-1 text-xs text-amber-600"
                                      title={`Contains: ${protein.allergens.filter((a) => a !== "none").join(", ")}`}
                                    >
                                      ⚠️
                                    </span>
                                  )}
                                </label>
                              </div>
                              <div className="flex items-center">
                                <button
                                  className="w-6 h-6 rounded-full border flex items-center justify-center text-gray-500"
                                  onClick={() => handleProteinQuantityChange(protein.id, -1)}
                                  disabled={!proteinSelections[protein.id]?.quantity}
                                >
                                  -
                                </button>
                                <span className="mx-2 w-6 text-center">
                                  {proteinSelections[protein.id]?.quantity || 0}
                                </span>
                                <button
                                  className="w-6 h-6 rounded-full border flex items-center justify-center text-gray-500"
                                  onClick={() => handleProteinQuantityChange(protein.id, 1)}
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Sides Selection */}
                      <div className="mb-4">
                        <h5 className="text-sm font-medium mb-2">
                          Sides <span className="text-xs text-gray-500">($5 each)</span>
                        </h5>
                        <div className="space-y-2">
                          {sides.map((side) => (
                            <div key={side.id} className="flex items-center justify-between">
                              <div className="flex items-center">
                                <input
                                  type="checkbox"
                                  id={`side-${side.id}`}
                                  className="mr-2"
                                  checked={sideSelections[side.id]?.selected || false}
                                  onChange={(e) => handleSideChange(side.id, e.target.checked)}
                                />
                                <label htmlFor={`side-${side.id}`} className="flex items-center">
                                  <span>{side.name}</span>
                                  <span className="text-xs text-gray-500 ml-1">${side.price}</span>
                                  {side.allergens && side.allergens.some((a) => a !== "none") && (
                                    <span
                                      className="ml-1 text-xs text-amber-600"
                                      title={`Contains: ${side.allergens.filter((a) => a !== "none").join(", ")}`}
                                    >
                                      ⚠️
                                    </span>
                                  )}
                                </label>
                              </div>
                              <div className="flex items-center">
                                <button
                                  className="w-6 h-6 rounded-full border flex items-center justify-center text-gray-500"
                                  onClick={() => handleSideQuantityChange(side.id, -1)}
                                  disabled={!sideSelections[side.id]?.quantity}
                                >
                                  -
                                </button>
                                <span className="mx-2 w-6 text-center">{sideSelections[side.id]?.quantity || 0}</span>
                                <button
                                  className="w-6 h-6 rounded-full border flex items-center justify-center text-gray-500"
                                  onClick={() => handleSideQuantityChange(side.id, 1)}
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 套餐限制提示 */}
                      <div className="mt-4 text-xs text-gray-500">
                        {selectedPackage === "basic" ? (
                          <p>
                            Basic Package includes 2 regular proteins ($20 credit). Additional items will be charged at
                            their individual prices.
                          </p>
                        ) : selectedPackage === "premium" ? (
                          <div className="space-y-2">
                            <details className="group">
                              <summary className="flex cursor-pointer items-center justify-between text-xs font-medium">
                                Premium Package Details
                                <span className="text-xs text-gray-500 group-open:rotate-180 transition-transform">
                                  ▼
                                </span>
                              </summary>
                              <div className="pt-2 pl-2 text-xs">
                                <p className="font-medium">Premium Package includes:</p>
                                <ul className="ml-2 space-y-1 mt-1">
                                  <li className="flex items-start">
                                    <span className="text-primary mr-2">•</span>
                                    <span>3× Premium proteins ($70)</span>
                                  </li>
                                  <li className="flex items-start">
                                    <span className="text-primary mr-2">•</span>
                                    <span>Total package credit: $70</span>
                                  </li>
                                </ul>

                                <p className="font-medium mt-2">Pricing logic:</p>
                                <ul className="ml-2 space-y-1 mt-1">
                                  <li className="flex items-start">
                                    <span className="text-[#C33] mr-2">•</span>
                                    <span>Add up all selected items at their individual prices</span>
                                  </li>
                                  <li className="flex items-start">
                                    <span className="text-[#C33] mr-2">•</span>
                                    <span>Subtract the package credit ($70)</span>
                                  </li>
                                  <li className="flex items-start">
                                    <span className="text-[#C33] mr-2">•</span>
                                    <span>The difference is your extra charge</span>
                                  </li>
                                </ul>
                              </div>
                            </details>
                          </div>
                        ) : (
                          <p>
                            Buffet Package includes fixed menu items (chicken, premium steak, shrimp). Customization
                            available for additional charges.
                          </p>
                        )}
                      </div>

                      {/* 显示价格计算 */}
                      <div className="mt-4 mb-2 border-t pt-3">
                        <h5 className="text-sm font-medium mb-2">Price Calculation</h5>
                        <div className="space-y-1 text-xs">
                          {/* 计算所有选中的常规蛋白质价格 */}
                          {(() => {
                            if (!selectedPackage) return null

                            const pkg = getPackageById(selectedPackage)
                            if (!pkg) return null

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

                            return (
                              <>
                                <div className="flex justify-between">
                                  <span>Regular Proteins:</span>
                                  <span>${regularProteinsTotal}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Premium Proteins:</span>
                                  <span>${premiumProteinsTotal}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Sides:</span>
                                  <span>${sidesTotal}</span>
                                </div>
                                <div className="flex justify-between font-medium">
                                  <span>Subtotal:</span>
                                  <span>${subtotal}</span>
                                </div>
                                <div className="flex justify-between text-green-600">
                                  <span>Package Credit:</span>
                                  <span>-${packageCredit}</span>
                                </div>
                                <div className="flex justify-between font-medium text-sm text-[#C33] border-t pt-1 mt-1">
                                  <span>Extra Charge:</span>
                                  <span>${extraCharge}</span>
                                </div>
                              </>
                            )
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Action Button */}
                <div className="p-4 border-t bg-gray-50 flex justify-center">
                  <Button onClick={() => setCurrentStep(3)} className="px-8 bg-amber-500 hover:bg-amber-600">
                    Continue to Checkout ▶
                  </Button>
                </div>
              </div>

              {/* Bottom Navigation */}
              <div className="flex justify-between mt-6">
                <Button variant="outline" onClick={() => setCurrentStep(1)}>
                  ◀ Back
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* 步骤3: 确认 & 支付 */}
      {currentStep === 3 && (
        <div className="p-6 pt-0">
          <div className="mb-6">
            <h3 className="text-xl font-bold mb-2">Review & Checkout</h3>
            <p className="text-sm text-gray-600">Review your order and provide contact information</p>
          </div>

          {submitResult && (
            <Alert
              className={`mb-6 ${submitResult.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}
            >
              {submitResult.success ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-600" />
              )}
              <AlertTitle>{submitResult.success ? "Success!" : "Error"}</AlertTitle>
              <AlertDescription>{submitResult.message}</AlertDescription>
              {submitResult.success && submitResult.reservationId && (
                <p className="mt-2 text-sm">Reservation ID: {submitResult.reservationId}</p>
              )}
            </Alert>
          )}

          {/* 订单摘要 */}
          <div className="border rounded-lg p-4 mb-6">
            <h4 className="font-medium mb-3">Order Summary</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h5 className="text-sm font-medium mb-2">Package Details</h5>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Package:</span>
                    <span>
                      {selectedPackage === "buffet"
                        ? "Buffet Package"
                        : selectedPackage === "basic"
                          ? "Basic Package"
                          : "Premium Package"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Guests:</span>
                    <span>
                      {getPackageById(selectedPackage || "")?.headcount || 0}{" "}
                      {getPackageById(selectedPackage || "")?.headcount !== 1 ? "people" : "person"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Base Price:</span>
                    <span>${getPackageById(selectedPackage || "")?.flatRate || 0}</span>
                  </div>
                </div>
              </div>

              <div>
                <h5 className="text-sm font-medium mb-2">Selected Items</h5>
                <div className="space-y-1 text-sm">
                  {Object.entries(proteinSelections)
                    .filter(([_, value]) => value.selected && value.quantity > 0)
                    .map(([key, value]) => {
                      const protein = [...regularProteins, ...premiumProteins].find((p) => p.id === key)
                      return protein ? (
                        <div key={key} className="flex justify-between">
                          <span>{protein.name}:</span>
                          <span>× {value.quantity}</span>
                        </div>
                      ) : null
                    })}

                  {Object.entries(sideSelections)
                    .filter(([_, value]) => value.selected && value.quantity > 0)
                    .map(([key, value]) => {
                      const side = sides.find((s) => s.id === key)
                      return side ? (
                        <div key={key} className="flex justify-between">
                          <span>{side.name}:</span>
                          <span>× {value.quantity}</span>
                        </div>
                      ) : null
                    })}
                </div>
              </div>
            </div>

            <div className="border-t mt-4 pt-3">
              <div className="flex justify-between font-medium">
                <span>Total:</span>
                <span className="text-[#C33]">
                  ${selectedPackage ? (getPackageById(selectedPackage)?.flatRate || 0) + extraCharges.total : 0}
                </span>
              </div>
            </div>
          </div>

          {/* 联系信息表单 */}
          <div className="border rounded-lg p-4 mb-6">
            <h4 className="font-medium mb-3">Contact Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium">
                  Full Name*
                </Label>
                <Input
                  id="name"
                  type="text"
                  className="w-full p-2 border rounded-md"
                  required
                  value={customerInfo.name}
                  onChange={handleInputChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-medium">
                  Phone Number*
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  className="w-full p-2 border rounded-md"
                  required
                  value={customerInfo.phone}
                  onChange={handleInputChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  className="w-full p-2 border rounded-md"
                  value={customerInfo.email}
                  onChange={handleInputChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eventDate" className="text-sm font-medium">
                  Event Date*
                </Label>
                <Input
                  id="eventDate"
                  type="date"
                  className="w-full p-2 border rounded-md"
                  required
                  value={customerInfo.eventDate}
                  onChange={handleInputChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eventTime" className="text-sm font-medium">
                  Event Time*
                </Label>
                <Input
                  id="eventTime"
                  type="time"
                  className="w-full p-2 border rounded-md"
                  required
                  value={customerInfo.eventTime}
                  onChange={handleInputChange}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="address" className="text-sm font-medium">
                  Service Address*
                </Label>
                <Textarea
                  id="address"
                  rows={2}
                  className="w-full p-2 border rounded-md"
                  required
                  value={customerInfo.address}
                  onChange={handleInputChange}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="specialRequests" className="text-sm font-medium">
                  Special Requests (Optional)
                </Label>
                <Textarea
                  id="specialRequests"
                  rows={3}
                  className="w-full p-2 border rounded-md"
                  placeholder="Any dietary restrictions, allergies, or special requests"
                  value={customerInfo.specialRequests}
                  onChange={handleInputChange}
                />
              </div>
            </div>
          </div>

          {/* 底部按钮 */}
          <div className="flex justify-between mt-6">
            <Button variant="outline" onClick={() => setCurrentStep(2)}>
              ◀ Back
            </Button>
            <Button onClick={handleSubmitOrder} disabled={isSubmitting}>
              {isSubmitting ? "Processing..." : "Submit Order"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
