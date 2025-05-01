"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import * as React from "react"

// Import our new components
import Testimonials from "@/components/menu/testimonials"
import PricingBanner from "@/components/menu/pricing-banner"
import ServiceNotes from "@/components/menu/service-notes"
import PackageSelection from "@/components/menu/package-selection"

export default function MenuPage() {
  const [headcount, setHeadcount] = useState(10)
  const [childCount, setChildCount] = useState(0)
  const [thirdProteinType, setThirdProteinType] = useState<string | null>(null)
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null)
  const [showUpgrades, setShowUpgrades] = useState(false)
  const [isRecommendedDefaultSelected, setIsRecommendedDefaultSelected] = useState(false)
  const [orderMode, setOrderMode] = useState<"group" | "individual">("group")
  const [selectedRice, setSelectedRice] = useState<string | null>(null)
  const [showSpecialRequests, setShowSpecialRequests] = useState(false)
  const [selectedTab, setSelectedTab] = useState<string>("overview")
  const [isComparisonTableExpanded, setIsComparisonTableExpanded] = useState(false)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1)

  const [checkoutStep, setCheckoutStep] = useState<
    "hidden" | "details" | "upgrades" | "review" | "payment" | "confirmation"
  >("hidden")
  const [customerDetails, setCustomerDetails] = useState({
    name: "",
    phone: "",
    eventDate: "",
    eventTime: "",
    address: "",
    specialRequests: "",
  })
  const [selectedUpgrades, setSelectedUpgrades] = useState({
    riceFlavor: "",
    extraProteins: [],
    beveragePackage: "",
  })

  // Track second protein selections
  const [secondProteinSelections, setSecondProteinSelections] = useState<{ [key: string]: number }>({
    chicken: 0,
    steak: 0,
    shrimp: 0,
    scallops: 0,
    salmon: 0,
    tofu: 0,
  })

  // 使用更简洁的数据结构来管理升级项
  const [upgrades, setUpgrades] = useState({
    filetMignon: 0,
    lobster: 0,
    thirdProteinChicken: 0,
    thirdProteinSteak: 0,
    thirdProteinShrimp: 0,
    thirdProteinScallops: 0,
    thirdProteinSalmon: 0,
    thirdProteinTofu: 0,
    thirdProteinFilet: 0,
    thirdProteinLobster: 0,
    gyoza: 0,
    edamame: 0,
    noodles: 0,
  })

  // 管理参与者列表的状态
  const [participants, setParticipants] = useState([
    { id: 1, name: "John Smith", status: "submitted", isSelected: true },
    { id: 2, name: "Jane Doe", status: "submitted", isSelected: false },
    { id: 3, name: "Mike Johnson", status: "in-progress", isSelected: false },
  ])

  const minHeadcount = 1 // 允许用户选择任意人数，但在计算时应用最小值
  const actualMinHeadcount = 10 // 实际最小人数要求
  const maxHeadcount = 100 // Increased from 28 to 100
  const guestsPerChef = 28 // Maximum number of guests per chef

  // Base prices
  const adultPrice = 60
  const childPrice = 30
  const minimumTotal = 500

  // 升级项价格
  const upgradesPricing = {
    filetMignon: 5,
    lobster: 10,
    thirdProteinBasic: 10, // 标准第三蛋白质
    thirdProteinFilet: 15, // 菲力作为第三蛋白质
    thirdProteinLobster: 20, // 龙虾作为第三蛋白质
    gyoza: 15, // 饺子
    edamame: 10, // 毛豆
    noodles: 5, // 面条
  }

  // Add a function to calculate the number of chefs needed
  const calculateChefsNeeded = (totalGuests: number) => {
    return Math.ceil(totalGuests / guestsPerChef)
  }

  // Add a constant for additional chef cost
  const additionalChefCost = 300 // Cost for each additional chef beyond the first one

  // 计算套餐价格的辅助函数
  const calculatePackagePrice = (headcount: number, childCount: number, upgrades: any) => {
    // 基础价格计算
    const adultTotal = adultPrice * (headcount - childCount)
    const childTotal = childPrice * childCount
    const baseTotal = adultTotal + childTotal

    // 升级价格计算
    let upgradesTotal = 0

    // 蛋白质升级
    upgradesTotal += upgrades.filetMignon * upgradesPricing.filetMignon
    upgradesTotal += upgrades.lobster * upgradesPricing.lobster

    // 第三种蛋白质
    standardProteins.forEach((protein) => {
      upgradesTotal += upgrades[protein.stateKey] * upgradesPricing.thirdProteinBasic
    })

    // 高级第三种蛋白质
    upgradesTotal += upgrades.thirdProteinFilet * upgradesPricing.thirdProteinFilet
    upgradesTotal += upgrades.thirdProteinLobster * upgradesPricing.thirdProteinLobster

    // 侧菜
    upgradesTotal += upgrades.gyoza * upgradesPricing.gyoza
    upgradesTotal += upgrades.edamame * upgradesPricing.edamame
    upgradesTotal += upgrades.noodles * upgradesPricing.noodles

    // 计算总价并应用最低消费
    const totalPrice = baseTotal + upgradesTotal
    return totalPrice < minimumTotal ? minimumTotal : totalPrice
  }

  // Modify the calculateUpgradesPrice function to include additional chef costs
  const calculateUpgradesPrice = () => {
    let total = 0

    // 蛋白质升级
    total += upgrades.filetMignon * upgradesPricing.filetMignon
    total += upgrades.lobster * upgradesPricing.lobster

    // 计算超出标准配额的蛋白质费用
    const extraProteins = Math.max(0, getTotalSecondProteinSelections() - headcount * 2)
    total += extraProteins * upgradesPricing.thirdProteinBasic

    // 侧菜
    total += upgrades.gyoza * upgradesPricing.gyoza
    total += upgrades.edamame * upgradesPricing.edamame
    total += upgrades.noodles * upgradesPricing.noodles

    return total
  }

  // 预设套餐
  const packages = [
    {
      id: "buffet",
      name: "Buffet Package",
      description: "Self-service buffet mode",
      headcount: 20,
      childCount: 0,
      flatRate: 798, // $39.9 per person for 20 people
      originalPrice: 50,
      currentPrice: 39.9,
      upgrades: {
        filetMignon: 0,
        lobster: 0,
        thirdProteinChicken: 0,
        thirdProteinSteak: 0,
        thirdProteinShrimp: 0,
        thirdProteinScallops: 0,
        thirdProteinSalmon: 0,
        thirdProteinTofu: 0,
        thirdProteinFilet: 0,
        thirdProteinLobster: 0,
        gyoza: 0,
        edamame: 0,
        noodles: 0,
      },
    },
    {
      id: "basic",
      name: "Basic Package",
      description: "Perfect for intimate gatherings",
      headcount: 10,
      childCount: 0,
      flatRate: 500, // $50 per person
      upgrades: {
        filetMignon: 0,
        lobster: 0,
        thirdProteinChicken: 0,
        thirdProteinSteak: 0,
        thirdProteinShrimp: 0,
        thirdProteinScallops: 0,
        thirdProteinSalmon: 0,
        thirdProteinTofu: 0,
        thirdProteinFilet: 0,
        thirdProteinLobster: 0,
        gyoza: 1,
        edamame: 1,
        noodles: 0,
      },
    },
    {
      id: "premium",
      name: "Premium Package",
      description: "Our most luxurious offering for special occasions",
      headcount: 20,
      childCount: 0,
      flatRate: 1600, // $80 per person
      upgrades: {
        filetMignon: 10,
        lobster: 10,
        thirdProteinChicken: 0,
        thirdProteinSteak: 0,
        thirdProteinShrimp: 0,
        thirdProteinScallops: 0,
        thirdProteinSalmon: 0,
        thirdProteinTofu: 0,
        thirdProteinFilet: 10,
        thirdProteinLobster: 10,
        gyoza: 3,
        edamame: 3,
        noodles: 10,
      },
    },
  ]

  // 应用预设套餐
  const applyPackage = (packageId: string) => {
    const selectedPkg = packages.find((pkg) => pkg.id === packageId)
    if (selectedPkg) {
      setHeadcount(selectedPkg.headcount)
      setChildCount(selectedPkg.childCount)
      setUpgrades({ ...selectedPkg.upgrades })

      // 重置蛋白质选择，确保套餐选择时清除之前的选择
      setSecondProteinSelections({
        chicken: 0,
        steak: 0,
        shrimp: 0,
        scallops: 0,
        salmon: 0,
        tofu: 0,
      })

      setSelectedPackage(packageId)
    }
  }

  // 标准蛋白质选项
  const standardProteins = [
    { id: "chicken", name: "Chicken", price: upgradesPricing.thirdProteinBasic, stateKey: "thirdProteinChicken" },
    { id: "steak", name: "Steak", price: upgradesPricing.thirdProteinBasic, stateKey: "thirdProteinSteak" },
    { id: "shrimp", name: "Shrimp", price: upgradesPricing.thirdProteinBasic, stateKey: "thirdProteinShrimp" },
    { id: "scallops", name: "Scallops", price: upgradesPricing.thirdProteinBasic, stateKey: "thirdProteinScallops" },
    { id: "salmon", name: "Salmon", price: upgradesPricing.thirdProteinBasic, stateKey: "thirdProteinSalmon" },
    { id: "tofu", name: "Tofu", price: upgradesPricing.thirdProteinBasic, stateKey: "thirdProteinTofu" },
  ]

  // 高级蛋白质选项
  const premiumProteins = [
    { id: "filet", name: "Filet Mignon", price: 20, stateKey: "filetMignon" },
    { id: "lobster", name: "Lobster", price: 20, stateKey: "lobster" },
  ]

  // 侧菜选项
  const sideItems = [
    { id: "gyoza", name: "Gyoza (12pcs)", price: upgradesPricing.gyoza, stateKey: "gyoza", unit: "order" },
    { id: "edamame", name: "Edamame", price: upgradesPricing.edamame, stateKey: "edamame", unit: "order" },
    { id: "noodles", name: "Noodles", price: upgradesPricing.noodles, stateKey: "noodles", unit: "order" },
  ]

  // 客户评价
  const testimonials = [
    {
      name: "Sarah J.",
      rating: 5,
      comment: "The chef was amazing! Everyone loved the performance and the food was delicious.",
    },
    {
      name: "Michael T.",
      rating: 5,
      comment: "Perfect for my daughter's graduation party. Worth every penny!",
    },
    {
      name: "Rebecca L.",
      rating: 5,
      comment: "Our corporate team building event was a hit thanks to Hibachi-at-Home!",
    },
  ]

  // 调整数量的辅助函数
  const adjustQuantity = (item: string, increment: number) => {
    setUpgrades((prev: any) => {
      const newValue = Math.max(0, prev[item as keyof typeof prev] + increment)
      return { ...prev, [item]: newValue }
    })
    // 当手动调整时，清除套餐选择
    setSelectedPackage(null)
  }

  // Function to handle second protein selection
  const adjustSecondProtein = (proteinId: string, increment: number | null, directValue?: number) => {
    setSecondProteinSelections((prev: any) => {
      // 如果提供了直接值，则使用它
      if (directValue !== undefined) {
        const validValue = Math.max(0, directValue)
        return { ...prev, [proteinId]: validValue }
      }
      // 否则使用增量调整
      const newValue = Math.max(0, (prev[proteinId] || 0) + (increment || 0))
      return { ...prev, [proteinId]: newValue }
    })
    setSelectedPackage(null)
  }

  // Calculate total second protein selections
  const getTotalSecondProteinSelections = () => {
    return Object.values(secondProteinSelections as Record<string, number>).reduce((sum: number, count: number) => sum + count, 0)
  }

  // 计算基础价格
  const calculateBasePrice = () => {
    const adultTotal = adultPrice * (headcount - childCount)
    const childTotal = childPrice * childCount
    return adultTotal + childTotal
  }

  // 计算总价格
  const calculateTotalPrice = () => {
    // 如果没有选择套餐，使用标准计算
    if (!selectedPackage) {
      return Math.max(calculateBasePrice() + calculateUpgradesPrice(), minimumTotal)
    }

    // 如果选择了套餐但没有修改任何选择，使用套餐价格
    const basePrice = calculateBasePrice()
    const upgradesPrice = calculateUpgradesPrice()

    return Math.max(basePrice + upgradesPrice, minimumTotal)
  }

  // 替换现有的 rawTotal 计算
  const rawTotal = calculateBasePrice() + calculateUpgradesPrice()
  const totalPrice = calculateTotalPrice()

  // 确保儿童数量不超过总人数
  useEffect(() => {
    if (childCount > headcount) {
      setChildCount(headcount)
    }
  }, [headcount, childCount])

  // 计算特定项的小计
  const calculateSubtotal = (quantity: number, price: number) => {
    return quantity * price
  }

  // 获取所有第三种蛋白质的总数
  const getThirdProteinTotal = () => {
    return (
      standardProteins.reduce((total: number, protein: any) => {
        return total + upgrades[protein.stateKey as keyof typeof upgrades]
      }, 0) +
      upgrades.filetMignon +
      upgrades.lobster
    )
  }

  // 检查是否应用了最小人数逻辑
  const isMinimumApplied = headcount < actualMinHeadcount

  // Calculate the number of chefs needed
  const chefsNeeded = calculateChefsNeeded(headcount)

  // 默认选中推荐套餐
  useEffect(() => {
    if (!selectedPackage && !isRecommendedDefaultSelected) {
      setSelectedPackage("basic")
      applyPackage("basic")
      setSelectedTab("overview")
      setIsRecommendedDefaultSelected(true)
    }
  }, [selectedPackage, isRecommendedDefaultSelected])

  // 处理添加新订单
  const handleAddOrder = () => {
    const newId = participants.length > 0 ? Math.max(...participants.map((p: any) => p.id)) + 1 : 1
    const newParticipant = {
      id: newId,
      name: `Guest ${newId}`,
      status: "in-progress",
      isSelected: false,
    }

    // 取消选择所有其他参与者
    const updatedParticipants = participants.map((p: any) => ({
      ...p,
      isSelected: false,
    }))

    // 添加新参与者并设为选中状态
    setParticipants([...updatedParticipants, { ...newParticipant, isSelected: true }])
  }

  // 处理选择参与者
  const handleSelectParticipant = (id: number) => {
    setParticipants(
      participants.map((p: any) => ({
        ...p,
        isSelected: p.id === id,
      })),
    )
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

        {/* Use our extracted PricingBanner component */}
        <PricingBanner adultPrice={adultPrice} childPrice={childPrice} minimumTotal={minimumTotal} />

        {/* Use our extracted ServiceNotes component */}
        <ServiceNotes />

        {/* Rest of the page content remains the same */}
        {/* ... */}
        {/* 预设套餐选项 */}

        <PackageSelection
          packages={packages}
          selectedPackage={selectedPackage}
          selectedTab={selectedTab}
          setSelectedTab={setSelectedTab}
          applyPackage={applyPackage}
          currentStep={currentStep}
          setCurrentStep={setCurrentStep}
          isComparisonTableExpanded={isComparisonTableExpanded}
          setIsComparisonTableExpanded={setIsComparisonTableExpanded}
          calculatePackagePrice={calculatePackagePrice}
        />

        {/* 结账流程 - 保持原有代码，但只在点击"Proceed to Payment"后显示 */}
        {checkoutStep !== "hidden" && selectedPackage && (
          <div id="checkout-section" className="mt-8 transition-all duration-300 ease-in-out">
            {/* Customer Details Form */}
            {checkoutStep === "details" && (
              <Card className="mb-6 border-primary/20 animate-in fade-in-50 duration-300">
                <CardHeader>
                  <CardTitle className="text-xl">Customer Details</CardTitle>
                  <CardDescription>Please provide your contact information and event details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="name" className="text-sm font-medium">
                        Contact Name*
                      </label>
                      <input
                        id="name"
                        type="text"
                        className="w-full p-2 border rounded-md"
                        value={customerDetails.name}
                        onChange={(e) => setCustomerDetails({ ...customerDetails, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="phone" className="text-sm font-medium">
                        Contact Phone*
                      </label>
                      <input
                        id="phone"
                        type="tel"
                        className="w-full p-2 border rounded-md"
                        value={customerDetails.phone}
                        onChange={(e) => setCustomerDetails({ ...customerDetails, phone: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  {/* Split the form into two sections */}
                  <div className="border-t pt-4 mt-4">
                    <h3 className="text-md font-medium mb-3">Event Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label htmlFor="eventDate" className="text-sm font-medium">
                          Event Date*
                        </label>
                        <input
                          id="eventDate"
                          type="date"
                          className="w-full p-2 border rounded-md"
                          value={customerDetails.eventDate}
                          onChange={(e) => setCustomerDetails({ ...customerDetails, eventDate: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="eventTime" className="text-sm font-medium">
                          Event Time*
                        </label>
                        <input
                          id="eventTime"
                          type="time"
                          className="w-full p-2 border rounded-md"
                          value={customerDetails.eventTime}
                          onChange={(e) => setCustomerDetails({ ...customerDetails, eventTime: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <label htmlFor="address" className="text-sm font-medium">
                          Service Address*
                        </label>
                        <textarea
                          id="address"
                          rows={2}
                          className="w-full p-2 border rounded-md"
                          value={customerDetails.address}
                          onChange={(e) => setCustomerDetails({ ...customerDetails, address: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Collapsible Special Requests section */}
                  <div className="mt-2">
                    <button
                      type="button"
                      className="flex items-center justify-between w-full text-left text-sm font-medium text-gray-700 hover:text-gray-900 focus:outline-none"
                      onClick={() => setShowSpecialRequests(!showSpecialRequests)}
                    >
                      <span>Special Requests (optional)</span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`h-5 w-5 transition-transform ${showSpecialRequests ? "transform rotate-180" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {showSpecialRequests && (
                      <div className="mt-2 space-y-2 animate-in fade-in-50 duration-300">
                        <p className="text-xs text-gray-500">
                          Please let us know about any dietary preferences, allergies, or other special requirements
                        </p>
                        <textarea
                          id="specialRequests"
                          rows={3}
                          className="w-full p-2 border rounded-md"
                          placeholder="Dietary preferences, allergies, or other special requirements"
                          value={customerDetails.specialRequests}
                          onChange={(e) => setCustomerDetails({ ...customerDetails, specialRequests: e.target.value })}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-3 mt-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setCheckoutStep("hidden")
                      }}
                    >
                      Back
                    </Button>
                    <Button
                      onClick={() => {
                        // Validate form
                        if (
                          !customerDetails.name ||
                          !customerDetails.phone ||
                          !customerDetails.eventDate ||
                          !customerDetails.eventTime ||
                          !customerDetails.address
                        ) {
                          alert("Please fill in all required fields")
                          return
                        }
                        setCheckoutStep("upgrades")
                      }}
                    >
                      Continue to Upgrades
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Upgrade Selection */}
            {checkoutStep === "upgrades" && (
              <Card className="mb-6 border-primary/20 animate-in fade-in-50 duration-300">
                <CardHeader>
                  <CardTitle className="text-xl">Optional Upgrades</CardTitle>
                  <CardDescription>Enhance your experience with these optional add-ons</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Rice Flavor Upgrades */}
                  <div>
                    <h3 className="text-md font-medium mb-3">Rice Flavor Upgrades</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {["Classic", "Garlic", "Spicy", "Vegetable"].map((flavor) => (
                        <div
                          key={flavor}
                          className={`border rounded-md p-3 cursor-pointer transition-all ${
                            selectedUpgrades.riceFlavor === flavor
                              ? "border-primary bg-primary/5"
                              : "hover:border-gray-400"
                          }`}
                          onClick={() => setSelectedUpgrades({ ...selectedUpgrades, riceFlavor: flavor })}
                        >
                          <div className="flex items-center justify-between">
                            <span>{flavor} Rice</span>
                            {flavor !== "Classic" && <span className="text-xs text-primary">+$5</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Extra Proteins */}
                  <div>
                    <h3 className="text-md font-medium mb-3">Extra Proteins</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {[
                        { name: "Extra Chicken", price: 10 },
                        { name: "Extra Steak", price: 12 },
                        { name: "Extra Shrimp", price: 15 },
                        { name: "Lobster Tail", price: 20 },
                        { name: "Filet Mignon", price: 18 },
                        { name: "Scallops", price: 16 },
                      ].map((protein) => (
                        <div
                          key={protein.name}
                          className={`border rounded-md p-3 cursor-pointer transition-all ${
                            selectedUpgrades.extraProteins.includes(protein.name)
                              ? "border-primary bg-primary/5"
                              : "hover:border-gray-400"
                          }`}
                          onClick={() => {
                            const newProteins = selectedUpgrades.extraProteins.includes(protein.name)
                              ? selectedUpgrades.extraProteins.filter((p) => p !== protein.name)
                              : [...selectedUpgrades.extraProteins, protein.name]
                            setSelectedUpgrades({ ...selectedUpgrades, extraProteins: newProteins })
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <span>{protein.name}</span>
                            <span className="text-xs text-primary">+${protein.price}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Beverage Packages */}
                  <div>
                    <h3 className="text-md font-medium mb-3">Beverage Packages</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {[
                        { name: "None", price: 0 },
                        {
                          name: "Soft Drinks Package",
                          price: 5,
                          desc: "Coke, Diet Coke, Sprite, Water (per person)",
                        },
                        {
                          name: "Premium Beverage Package",
                          price: 12,
                          desc: "Soft drinks, juices, and mocktails (per person)",
                        },
                      ].map((pkg) => (
                        <div
                          key={pkg.name}
                          className={`border rounded-md p-3 cursor-pointer transition-all ${
                            selectedUpgrades.beveragePackage === pkg.name
                              ? "border-primary bg-primary/5"
                              : "hover:border-gray-400"
                          }`}
                          onClick={() => setSelectedUpgrades({ ...selectedUpgrades, beveragePackage: pkg.name })}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium">{pkg.name}</span>
                            {pkg.price > 0 && <span className="text-xs text-primary">+${pkg.price}/person</span>}
                          </div>
                          {pkg.desc && <p className="text-xs text-gray-500">{pkg.desc}</p>}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 mt-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setCheckoutStep("details")
                      }}
                    >
                      Back
                    </Button>
                    <Button
                      onClick={() => {
                        setCheckoutStep("review")
                      }}
                    >
                      Review Order
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Order Review */}
            {checkoutStep === "review" && (
              <Card className="mb-6 border-primary/20 animate-in fade-in-50 duration-300">
                <CardHeader>
                  <CardTitle className="text-xl">Order Review</CardTitle>
                  <CardDescription>Please review your order details before proceeding to payment</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Package Details */}
                    <div>
                      <h3 className="text-md font-medium mb-2">Package Details</h3>
                      <div className="bg-gray-50 rounded-md p-4">
                        <div className="flex justify-between mb-2">
                          <span className="font-medium">{packages.find((p) => p.id === selectedPackage)?.name}</span>
                          <span>${packages.find((p) => p.id === selectedPackage)?.flatRate}</span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">
                          {packages.find((p) => p.id === selectedPackage)?.headcount} guests ($
                          {Math.round(
                            (packages.find((p) => p.id === selectedPackage)?.flatRate || 0) /
                              (packages.find((p) => p.id === selectedPackage)?.headcount || 1),
                          )}
                          /person)
                        </p>
                        <p className="text-sm text-gray-600">
                          Includes:{" "}
                          {packages.find((p) => p.id === selectedPackage)?.id === "buffet"
                            ? "Fixed menu (no customization)"
                            : packages.find((p) => p.id === selectedPackage)?.id === "standard"
                              ? "2 proteins, vegetables & side salad, fried rice, gyoza, edamame"
                              : "Premium proteins, vegetables & side salad, specialty fried rice, gyoza, edamame, noodles"}
                        </p>
                      </div>
                    </div>

                    {/* Selected Upgrades */}
                    <div>
                      <h3 className="text-md font-medium mb-2">Selected Upgrades</h3>
                      <div className="bg-gray-50 rounded-md p-4">
                        {selectedUpgrades.riceFlavor && selectedUpgrades.riceFlavor !== "Classic" && (
                          <div className="flex justify-between mb-2">
                            <span>{selectedUpgrades.riceFlavor} Rice Upgrade</span>
                            <span>+$5</span>
                          </div>
                        )}

                        {selectedUpgrades.extraProteins.length > 0 && (
                          <>
                            {selectedUpgrades.extraProteins.map((protein) => {
                              const price =
                                {
                                  "Extra Chicken": 10,
                                  "Extra Steak": 12,
                                  "Extra Shrimp": 15,
                                  "Lobster Tail": 20,
                                  "Filet Mignon": 18,
                                  Scallops: 16,
                                }[protein] || 0

                              return (
                                <div key={protein} className="flex justify-between mb-2">
                                  <span>{protein}</span>
                                  <span>+${price}</span>
                                </div>
                              )
                            })}
                          </>
                        )}

                        {selectedUpgrades.beveragePackage && selectedUpgrades.beveragePackage !== "None" && (
                          <div className="flex justify-between mb-2">
                            <span>{selectedUpgrades.beveragePackage}</span>
                            <span>
                              +${selectedUpgrades.beveragePackage === "Soft Drinks Package" ? 5 : 12} ×&nbsp;
                              {packages.find((p) => p.id === selectedPackage)?.headcount || 0} guests
                            </span>
                          </div>
                        )}

                        {!selectedUpgrades.riceFlavor &&
                          selectedUpgrades.extraProteins.length === 0 &&
                          (!selectedUpgrades.beveragePackage || selectedUpgrades.beveragePackage === "None") && (
                            <p className="text-sm text-gray-500">No upgrades selected</p>
                          )}
                      </div>
                    </div>

                    {/* Customer Details */}
                    <div>
                      <h3 className="text-md font-medium mb-2">Customer Details</h3>
                      <div className="bg-gray-50 rounded-md p-4 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="font-medium">Name:</span> {customerDetails.name}
                        </div>
                        <div>
                          <span className="font-medium">Phone:</span> {customerDetails.phone}
                        </div>
                        <div>
                          <span className="font-medium">Event Date:</span> {customerDetails.eventDate}
                        </div>
                        <div>
                          <span className="font-medium">Event Time:</span> {customerDetails.eventTime}
                        </div>
                        <div className="md:col-span-2">
                          <span className="font-medium">Address:</span> {customerDetails.address}
                        </div>
                        {customerDetails.specialRequests && (
                          <div className="md:col-span-2">
                            <span className="font-medium">Special Requests:</span> {customerDetails.specialRequests}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Service Information */}
                    <div>
                      <h3 className="text-md font-medium mb-2">Service Information</h3>
                      <div className="bg-gray-50 rounded-md p-4 space-y-2 text-sm">
                        <p>
                          <span className="font-medium">Estimated Service Duration:</span> 2-3 hours
                        </p>
                        <p>
                          <span className="font-medium">Chef Arrival Time:</span> 30-45 minutes before scheduled event
                          time
                        </p>
                        <p>
                          <span className="font-medium">Minimum Consumption:</span> ${minimumTotal} (minimum of{" "}
                          {actualMinHeadcount} guests)
                        </p>
                      </div>
                    </div>

                    {/* Order Total */}
                    <div>
                      <h3 className="text-md font-medium mb-2">Order Total</h3>
                      <div className="bg-gray-50 rounded-md p-4">
                        <div className="flex justify-between mb-2">
                          <span>Package Base Price</span>
                          <span>${packages.find((p) => p.id === selectedPackage)?.flatRate}</span>
                        </div>

                        {/* Calculate upgrades total */}
                        {(() => {
                          let upgradesTotal = 0

                          // Rice upgrade
                          if (selectedUpgrades.riceFlavor && selectedUpgrades.riceFlavor !== "Classic") {
                            upgradesTotal += 5
                          }

                          // Extra proteins
                          selectedUpgrades.extraProteins.forEach((protein) => {
                            upgradesTotal +=
                              {
                                "Extra Chicken": 10,
                                "Extra Steak": 12,
                                "Extra Shrimp": 15,
                                "Lobster Tail": 20,
                                "Filet Mignon": 18,
                                Scallops: 16,
                              }[protein] || 0
                          })

                          // Beverage package
                          if (selectedUpgrades.beveragePackage === "Soft Drinks Package") {
                            upgradesTotal += 5 * (packages.find((p) => p.id === selectedPackage)?.headcount || 0)
                          } else if (selectedUpgrades.beveragePackage === "Premium Beverage Package") {
                            upgradesTotal += 12 * (packages.find((p) => p.id === selectedPackage)?.headcount || 0)
                          }

                          // Only show upgrades if there are any
                          if (upgradesTotal > 0) {
                            return (
                              <div className="flex justify-between mb-2">
                                <span>Upgrades Total</span>
                                <span>+${upgradesTotal}</span>
                              </div>
                            )
                          }

                          return null
                        })()}

                        <div className="border-t pt-2 mt-2 font-medium flex justify-between">
                          <span>Total</span>
                          <span>
                            ${(() => {
                              let total = packages.find((p) => p.id === selectedPackage)?.flatRate || 0

                              // Rice upgrade
                              if (selectedUpgrades.riceFlavor && selectedUpgrades.riceFlavor !== "Classic") {
                                total += 5
                              }

                              // Extra proteins
                              selectedUpgrades.extraProteins.forEach((protein) => {
                                total +=
                                  {
                                    "Extra Chicken": 10,
                                    "Extra Steak": 12,
                                    "Extra Shrimp": 15,
                                    "Lobster Tail": 20,
                                    "Filet Mignon": 18,
                                    Scallops: 16,
                                  }[protein] || 0
                              })

                              // Beverage package
                              if (selectedUpgrades.beveragePackage === "Soft Drinks Package") {
                                total += 5 * (packages.find((p) => p.id === selectedPackage)?.headcount || 0)
                              } else if (selectedUpgrades.beveragePackage === "Premium Beverage Package") {
                                total += 12 * (packages.find((p) => p.id === selectedPackage)?.headcount || 0)
                              }

                              return total
                            })()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-4">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setCheckoutStep("upgrades")
                        }}
                      >
                        Back
                      </Button>
                      <Button
                        onClick={() => {
                          setCheckoutStep("payment")
                        }}
                      >
                        Proceed to Payment
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Payment & Confirmation */}
            {checkoutStep === "payment" && (
              <Card className="mb-6 border-primary/20 animate-in fade-in-50 duration-300">
                <CardHeader>
                  <CardTitle className="text-xl">Payment Method</CardTitle>
                  <CardDescription>Choose your preferred payment method</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="border rounded-md p-4 cursor-pointer hover:border-primary hover:bg-primary/5 transition-all">
                        <div className="flex items-center mb-2">
                          <div className="w-6 h-6 rounded-full border border-gray-300 mr-3 flex items-center justify-center">
                            <div className="w-3 h-3 rounded-full bg-primary"></div>
                          </div>
                          <span className="font-medium">Credit Card</span>
                        </div>
                        <p className="text-xs text-gray-500 ml-9">Visa, Mastercard, American Express</p>
                      </div>

                      <div className="border rounded-md p-4 cursor-pointer hover:border-primary hover:bg-primary/5 transition-all">
                        <div className="flex items-center mb-2">
                          <div className="w-6 h-6 rounded-full border border-gray-300 mr-3 flex items-center justify-center">
                            <div className="w-3 h-3 rounded-full"></div>
                          </div>
                          <span className="font-medium">Apple Pay</span>
                        </div>
                        <p className="text-xs text-gray-500 ml-9">Fast and secure payment</p>
                      </div>

                      <div className="border rounded-md p-4 cursor-pointer hover:border-primary hover:bg-primary/5 transition-all">
                        <div className="flex items-center mb-2">
                          <div className="w-6 h-6 rounded-full border border-gray-300 mr-3 flex items-center justify-center">
                            <div className="w-3 h-3 rounded-full"></div>
                          </div>
                          <span className="font-medium">WeChat Pay</span>
                        </div>
                        <p className="text-xs text-gray-500 ml-9">Scan QR code to pay</p>
                      </div>
                    </div>

                    {/* Credit Card Form (placeholder) */}
                    <div className="border rounded-md p-4 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label htmlFor="cardName" className="text-sm font-medium">
                            Name on Card
                          </label>
                          <input id="cardName" type="text" className="w-full p-2 border rounded-md" />
                        </div>
                        <div className="space-y-2">
                          <label htmlFor="cardNumber" className="text-sm font-medium">
                            Card Number
                          </label>
                          <input
                            id="cardNumber"
                            type="text"
                            className="w-full p-2 border rounded-md"
                            placeholder="•••• •••• •••• ••••"
                          />
                        </div>
                        <div className="space-y-2">
                          <label htmlFor="expiry" className="text-sm font-medium">
                            Expiry Date
                          </label>
                          <input id="expiry" type="text" className="w-full p-2 border rounded-md" placeholder="MM/YY" />
                        </div>
                        <div className="space-y-2">
                          <label htmlFor="cvv" className="text-sm font-medium">
                            CVV
                          </label>
                          <input id="cvv" type="text" className="w-full p-2 border rounded-md" placeholder="•••" />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-4">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setCheckoutStep("review")
                        }}
                      >
                        Back
                      </Button>
                      <Button
                        onClick={() => {
                          // Simulate payment processing
                          setCheckoutStep("confirmation")
                        }}
                      >
                        Complete Payment
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Confirmation */}
            {checkoutStep === "confirmation" && (
              <Card className="mb-6 border-green-200 bg-green-50 animate-in fade-in-50 duration-300">
                <CardHeader>
                  <div className="flex items-center justify-center mb-4">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-8 w-8 text-green-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                  <CardTitle className="text-xl text-center">Booking Confirmed!</CardTitle>
                  <CardDescription className="text-center">
                    Your hibachi experience has been booked successfully
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="bg-white rounded-md p-4 text-center">
                      <p className="text-sm text-gray-500 mb-1">Order Number</p>
                      <p className="text-xl font-bold font-mono">HBH-{Math.floor(100000 + Math.random() * 900000)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </>
  )
}
