"use client"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type React from "react"

import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"
import { regularProteins, premiumProteins, sides, packageOptions, getPackageById } from "@/config/menu-items"
import PackageComparisonTable from "./PackageComparisonTable"
import {
  initialProteinSelections,
  initialSideSelections,
  initialPackageInclusions,
  initialExtraCharges,
} from "@/lib/menuSelections"
import {
  handleProteinChange,
  handleProteinQuantityChange,
  handleSideChange,
  handleSideQuantityChange,
} from "@/lib/mealSelections"
import { handleInputChange, handleSubmitOrder } from "@/lib/order"
import PackageCard from "./PackageCard"
import ParticipantsList from "./ParticipantsList"
import Step3ReviewCheckout from "./Step3ReviewCheckout"

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

  // 处理 buffet 人数输入变化
  // const handleBuffetHeadcountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  //   const value = Number.parseInt(e.target.value)
  //   if (!isNaN(value) && value >= 20) {
  //     setBuffetHeadcount(value)
  //     // 同时更新 package 对象
  //     const pkg = getPackageById("buffet")
  //     if (pkg) {
  //       pkg.headcount = value
  //     }
  //   } else if (!isNaN(value) && value < 20) {
  //     setBuffetHeadcount(20)
  //     // 同时更新 package 对象
  //     const pkg = getPackageById("buffet")
  //     if (pkg) {
  //       pkg.headcount = 20
  //     }
  //   }
  // }

  // 添加handleAddOrder函数
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
            {packageOptions.map((pkg) => (
              <PackageCard
                key={pkg.id}
                pkg={pkg}
                selectedPackage={selectedPackage}
                selectedTab={selectedTab}
                setSelectedTab={setSelectedTab}
                applyPackage={applyPackage}
                setCurrentStep={setCurrentStep}
              />
            ))}
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
                        if (pkg && buffetHeadcount > 20) {
                          const newValue = buffetHeadcount - 1
                          pkg.headcount = newValue
                          setBuffetHeadcount(newValue)
                          setBuffetHeadcountInput(newValue.toString())
                        }
                      }}
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="20"
                      className="mx-4 w-16 text-center text-lg font-medium border-b border-amber-200 bg-transparent focus:outline-none focus:border-amber-500"
                      value={buffetHeadcountInput}
                      onChange={handleBuffetHeadcountChange}
                      onBlur={handleBuffetHeadcountBlur}
                      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                    />
                    <button
                      className="w-10 h-10 rounded-full border border-amber-300 flex items-center justify-center text-amber-700"
                      onClick={() => {
                        const pkg = getPackageById("buffet")
                        if (pkg) {
                          const newValue = buffetHeadcount + 1
                          pkg.headcount = newValue
                          setBuffetHeadcount(newValue)
                          setBuffetHeadcountInput(newValue.toString())
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
                      <p className="text-xl font-bold text-amber-600">${(buffetHeadcount * 39.9).toFixed(2)}</p>
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
                    <ParticipantsList
                      participants={participants}
                      setParticipants={setParticipants}
                      showAddForm={showAddForm}
                      setShowAddForm={setShowAddForm}
                      newParticipantName={newParticipantName}
                      setNewParticipantName={setNewParticipantName}
                      editingParticipantId={editingParticipantId}
                      setEditingParticipantId={setEditingParticipantId}
                      editingName={editingName}
                      setEditingName={setEditingName}
                      handleAddOrder={handleAddOrder}
                      handleAddParticipant={handleAddParticipant}
                      handleSelectParticipant={handleSelectParticipant}
                      handleStartEditName={handleStartEditName}
                      handleSaveName={handleSaveName}
                      handleCancelEdit={handleCancelEdit}
                    />
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
                                    onChange={(e) =>
                                      handleProteinChange({
                                        protein: protein.id,
                                        isChecked: e.target.checked,
                                        proteinSelections,
                                        setProteinSelections,
                                        participants,
                                        setParticipants,
                                        sideSelections,
                                      })
                                    }
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
                                    onClick={(e) =>
                                      handleProteinQuantityChange({
                                        protein: protein.id,
                                        delta: -1,
                                        proteinSelections,
                                        setProteinSelections,
                                        participants,
                                        setParticipants,
                                        sideSelections,
                                      })
                                    }
                                    disabled={!proteinSelections[protein.id]?.quantity}
                                  >
                                    -
                                  </button>
                                  <span className="mx-2 w-6 text-center">
                                    {proteinSelections[protein.id]?.quantity || 0}
                                  </span>
                                  <button
                                    className="w-6 h-6 rounded-full border flex items-center justify-center text-gray-500"
                                    onClick={(e) =>
                                      handleProteinQuantityChange({
                                        protein: protein.id,
                                        delta: 1,
                                        proteinSelections,
                                        setProteinSelections,
                                        participants,
                                        setParticipants,
                                        sideSelections,
                                      })
                                    }
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
                                  onChange={(e) =>
                                    handleProteinChange({
                                      protein: protein.id,
                                      isChecked: e.target.checked,
                                      proteinSelections,
                                      setProteinSelections,
                                      participants,
                                      setParticipants,
                                      sideSelections,
                                    })
                                  }
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
                                  onClick={(e) =>
                                    handleProteinQuantityChange({
                                      protein: protein.id,
                                      delta: -1,
                                      proteinSelections,
                                      setProteinSelections,
                                      participants,
                                      setParticipants,
                                      sideSelections,
                                    })
                                  }
                                  disabled={!proteinSelections[protein.id]?.quantity}
                                >
                                  -
                                </button>
                                <span className="mx-2 w-6 text-center">
                                  {proteinSelections[protein.id]?.quantity || 0}
                                </span>
                                <button
                                  className="w-6 h-6 rounded-full border flex items-center justify-center text-gray-500"
                                  onClick={(e) =>
                                    handleProteinQuantityChange({
                                      protein: protein.id,
                                      delta: 1,
                                      proteinSelections,
                                      setProteinSelections,
                                      participants,
                                      setParticipants,
                                      sideSelections,
                                    })
                                  }
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
                                  onChange={(e) =>
                                    handleSideChange({
                                      side: side.id,
                                      isChecked: e.target.checked,
                                      sideSelections,
                                      setSideSelections,
                                      participants,
                                      setParticipants,
                                      proteinSelections,
                                    })
                                  }
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
                                  onClick={(e) =>
                                    handleSideQuantityChange({
                                      side: side.id,
                                      delta: -1,
                                      sideSelections,
                                      setSideSelections,
                                      participants,
                                      setParticipants,
                                      proteinSelections,
                                    })
                                  }
                                  disabled={!sideSelections[side.id]?.quantity}
                                >
                                  -
                                </button>
                                <span className="mx-2 w-6 text-center">{sideSelections[side.id]?.quantity || 0}</span>
                                <button
                                  className="w-6 h-6 rounded-full border flex items-center justify-center text-gray-500"
                                  onClick={(e) =>
                                    handleSideQuantityChange({
                                      side: side.id,
                                      delta: 1,
                                      sideSelections,
                                      setSideSelections,
                                      participants,
                                      setParticipants,
                                      proteinSelections,
                                    })
                                  }
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
        <Step3ReviewCheckout
          selectedPackage={selectedPackage}
          getPackageById={getPackageById}
          buffetHeadcount={buffetHeadcount}
          proteinSelections={proteinSelections}
          sideSelections={sideSelections}
          regularProteins={regularProteins}
          premiumProteins={premiumProteins}
          sides={sides}
          extraCharges={extraCharges}
          customerInfo={customerInfo}
          setCustomerInfo={setCustomerInfo}
          isSubmitting={isSubmitting}
          setCurrentStep={setCurrentStep}
          submitResult={submitResult}
          handleInputChange={handleInputChange}
          handleSubmitOrder={handleSubmitOrder}
        />
      )}
    </Card>
  )
}
