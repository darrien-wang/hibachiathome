"use client"

import type React from "react"

import { useState, useEffect, useCallback, useReducer, useMemo, Suspense, useRef } from "react"
import { pricing } from "@/config/pricing"
import { format } from "date-fns"
import dynamic from "next/dynamic"
import { useSearchParams } from "next/navigation"
import { createBooking } from "@/app/actions/booking"
import type { BookingFormData } from "@/types/booking"
import { paymentConfig } from "@/config/ui"
import { createClientSupabaseClient } from "@/lib/supabase"

// 动态导入大型组件，添加预加载提示
const DynamicPricingCalendar = dynamic(() => import("@/components/booking/dynamic-pricing-calendar"), {
  loading: () => <div className="animate-pulse bg-gray-100 h-[400px] rounded-lg" />,
  ssr: false,
})

// 动态导入表单组件
const BookingForm = dynamic(() => import("@/components/booking/booking-form"), {
  loading: () => <div className="animate-pulse bg-gray-100 h-[600px] rounded-lg" />,
  ssr: false,
})

// 动态导入计算器组件
const CostCalculator = dynamic(() => import("@/components/booking/cost-calculator"), {
  loading: () => <div className="animate-pulse bg-gray-100 h-[400px] rounded-lg" />,
  ssr: false,
})

// 动态导入成功页面组件
const BookingSuccess = dynamic(() => import("@/components/booking/booking-success"), {
  loading: () => <div className="animate-pulse bg-gray-100 h-[300px] rounded-lg" />,
  ssr: false,
})

// 动态导入Google地址自动完成组件
const GooglePlacesAutocomplete = dynamic(() => import("@/components/google-places-autocomplete"), {
  loading: () => <div className="animate-pulse bg-gray-100 h-[42px] rounded-md" />,
  ssr: false,
})

// 动态导入退出意图弹窗组件
const ExitIntentPopup = dynamic(() => import("@/components/exit-intent-popup"), {
  loading: () => null,
  ssr: false,
})

// 预加载关键组件
const preloadComponents = () => {
  // 预加载表单组件
  const bookingFormPromise = import("@/components/booking/booking-form")
  // 预加载计算器组件
  const costCalculatorPromise = import("@/components/booking/cost-calculator")
  // 预加载Google地址自动完成组件
  const googlePlacesPromise = import("@/components/google-places-autocomplete")

  return Promise.all([bookingFormPromise, costCalculatorPromise, googlePlacesPromise])
}

type FormData = {
  adults: number | string
  kids: number | string
  filetMignon: number | string
  lobsterTail: number | string
  extraProteins: number | string
  noodles: number | string
  gyoza: number | string
  edamame: number | string
  zipcode: string
  name: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  eventDate: string
  eventTime: string
  message: string
  agreeToTerms: boolean
}

type DateTimeSelection = {
  date: string | undefined
  time: string | undefined
  price: number
  originalPrice: number
}

// 修改类型定义
type PremiumProtein = {
  name: string
  name: string
  quantity: number
  unit_price: number
}

type AddOn = {
  name: string
  quantity: number
  unit_price: number
}

type BookingData = {
  full_name: string
  email: string
  phone: string
  address: string
  zip_code: string
  event_date: string
  event_time: string
  guest_adults: number
  guest_kids: number
  price_adult: number
  price_kid: number
  travel_fee: number
  premium_proteins?: PremiumProtein[]
  add_ons?: AddOn[]
  special_requests?: string
  deposit?: number
}

// 修改 orderData 的类型定义
type OrderData = {
  id: string
  full_name: string
  event_date: string
  event_time: string
  total_amount: number
}

// 添加数据库返回数据的类型定义
type BookingResponse = {
  id: string
  full_name: string
  email: string
  phone: string
  address: string
  zip_code: string
  event_date: string
  event_time: string
  guest_adults: number
  guest_kids: number
  price_adult: number
  price_kid: number
  travel_fee: number
  premium_proteins?: PremiumProtein[]
  add_ons?: AddOn[]
  special_requests?: string
  created_at: string
  updated_at: string
  deposit?: number
}

// 将表单状态合并到一个 reducer
type FormAction =
  | { type: "UPDATE_FIELD"; field: keyof FormData; value: any }
  | { type: "RESET_FORM" }
  | { type: "SET_DATE_TIME"; date: string; time: string }

function formReducer(state: FormData, action: FormAction): FormData {
  switch (action.type) {
    case "UPDATE_FIELD":
      return { ...state, [action.field]: action.value }
    case "RESET_FORM":
      return initialState
    case "SET_DATE_TIME":
      return { ...state, eventDate: action.date, eventTime: action.time }
    default:
      return state
  }
}

// 初始状态
const initialState: FormData = {
  adults: 0,
  kids: 0,
  filetMignon: 0,
  lobsterTail: 0,
  extraProteins: 0,
  noodles: 0,
  gyoza: 0,
  edamame: 0,
  zipcode: "",
  name: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  eventDate: "",
  eventTime: "",
  message: "",
  agreeToTerms: false,
}

// 将成本计算逻辑抽离到自定义 hook
function useCostCalculation(formData: FormData) {
  return useMemo(() => {
    const adultPrice = pricing.packages.basic.perPerson
    const kidPrice = pricing.children.basic
    const filetUpcharge = 5
    const lobsterUpcharge = 10
    const extraProteinPrice = 15
    const noodlePrice = 5
    const gyozaPrice = 10
    const edamamePrice = 8

    const travelFee = calculateTravelFee(formData.zipcode)
    const adultsCost = (Number(formData.adults) || 0) * adultPrice
    const kidsCost = (Number(formData.kids) || 0) * kidPrice
    const filetMignonCost = (Number(formData.filetMignon) || 0) * filetUpcharge
    const lobsterTailCost = (Number(formData.lobsterTail) || 0) * lobsterUpcharge
    const extraProteinsCost = (Number(formData.extraProteins) || 0) * extraProteinPrice
    const noodlesCost = (Number(formData.noodles) || 0) * noodlePrice
    const gyozaCost = (Number(formData.gyoza) || 0) * gyozaPrice
    const edamameCost = (Number(formData.edamame) || 0) * edamamePrice

    const mealCost =
      adultsCost +
      kidsCost +
      filetMignonCost +
      lobsterTailCost +
      extraProteinsCost +
      noodlesCost +
      gyozaCost +
      edamameCost
    const minimumSpending = pricing.packages.basic.minimum
    const finalMealCost = Math.max(mealCost, minimumSpending)
    const subtotal = finalMealCost
    const total = subtotal + travelFee
    const suggestedTip = total * 0.2

    return {
      adultsCost: Number(adultsCost.toFixed(2)),
      kidsCost: Number(kidsCost.toFixed(2)),
      filetMignonCost: Number(filetMignonCost.toFixed(2)),
      lobsterTailCost: Number(lobsterTailCost.toFixed(2)),
      extraProteinsCost: Number(extraProteinsCost.toFixed(2)),
      noodlesCost: Number(noodlesCost.toFixed(2)),
      gyozaCost: Number(gyozaCost.toFixed(2)),
      edamameCost: Number(edamameCost.toFixed(2)),
      travelFee: Number(travelFee.toFixed(2)),
      subtotal: Number(subtotal.toFixed(2)),
      suggestedTip: Number(suggestedTip.toFixed(2)),
      total: Number(total.toFixed(2)),
    }
  }, [
    formData.adults,
    formData.kids,
    formData.filetMignon,
    formData.lobsterTail,
    formData.extraProteins,
    formData.noodles,
    formData.gyoza,
    formData.edamame,
    formData.zipcode,
  ])
}

// 将旅行费用计算函数移到组件外部
const calculateTravelFee = (zipcode: string): number => {
  if (!zipcode || zipcode.length < 5) return 0

  const zipPrefix = zipcode.substring(0, 3)
  const regions: Record<string, number> = {
    // TX (Austin, Dallas, Houston, San Antonio)
    "737": 50,
    "750": 50,
    "751": 50,
    "752": 50,
    "770": 50,
    "771": 50,
    "772": 50,
    "782": 50,
    // NY, NJ, PA, DE
    "100": 50,
    "101": 50,
    "102": 50,
    "070": 50,
    "071": 50,
    "190": 50,
    "191": 50,
    "197": 50,
    // AZ (Phoenix Metropolitan)
    "850": 50,
    "851": 50,
    "852": 50,
    "853": 50,
    // VA, MD, Washington DC
    "200": 50,
    "201": 50,
    "220": 50,
    "221": 50,
    "208": 50,
    "209": 50,
    // FL (Miami, Orlando)
    "331": 50,
    "332": 50,
    "328": 50,
    "329": 50,
  }

  return regions[zipPrefix] || 75
}

// 添加一个辅助函数，确保表单在视图中完全可见
const ensureFormVisible = () => {
  const formElement = document.getElementById("estimation-form")
  if (!formElement) return

  // 获取表单元素的位置信息
  const formRect = formElement.getBoundingClientRect()

  // 如果表单顶部不在视图中，滚动到能够看到整个表单的位置
  if (formRect.top < 0 || formRect.top > window.innerHeight * 0.1) {
    // 计算理想的滚动位置：表单顶部距离视口顶部有一定的间距
    const targetPosition = window.scrollY + formRect.top - window.innerHeight * 0.1

    // 平滑滚动到目标位置
    window.scrollTo({
      top: targetPosition,
      behavior: "smooth",
    })
  }
}

export default function EstimationPage() {
  const searchParams = useSearchParams()
  const source = searchParams.get("source")
  const isFromBooking = source === "booking"
  const pageTitle = isFromBooking ? "Online Booking" : "Private Hibachi Party Cost Estimation"
  const pageDescription = isFromBooking
    ? "Complete your booking details below to reserve your private hibachi experience"
    : "Use our calculator to get an instant estimate and book your private hibachi experience"

  // 在组件挂载时预加载其他组件
  useEffect(() => {
    preloadComponents()
  }, [])

  return (
    <div className="container mx-auto px-4 py-12 pt-24 mt-16 min-h-[800px]">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold mb-4">{pageTitle}</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">{pageDescription}</p>
        </div>

        <Suspense fallback={<div className="animate-pulse bg-gray-100 h-[800px] rounded-lg" />}>
          <EstimationContent />
        </Suspense>
      </div>
    </div>
  )
}

// 将主要内容拆分为单独的组件
function EstimationContent() {
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [showOrderForm, setShowOrderForm] = useState(false)
  const [orderData, setOrderData] = useState<OrderData | null>(null)

  // 使用 reducer 管理表单状态
  const [formData, dispatch] = useReducer(formReducer, initialState)

  // 使用自定义 hook 计算成本
  const costs = useCostCalculation(formData)

  // 其他状态
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [orderError, setOrderError] = useState("")
  const [selectedDateTime, setSelectedDateTime] = useState<DateTimeSelection>({
    date: undefined,
    time: undefined,
    price: 0,
    originalPrice: 0,
  })

  // Add after the other state declarations in EstimationContent function
  const [currentStep, setCurrentStep] = useState(1)
  const totalSteps = 7

  // 退出意图弹窗状态
  const [showExitPopup, setShowExitPopup] = useState(false)
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null)
  const zipCodeChangesRef = useRef(0)
  const hasInteractedRef = useRef(false)
  const hasShownPopupRef = useRef(false)

  // 监听用户行为以显示退出意图弹窗
  useEffect(() => {
    // 只在步骤5（ZIP码页面）监听
    if (currentStep !== 5 || hasShownPopupRef.current) return

    // 设置15秒的空闲计时器
    const startIdleTimer = () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current)
      }

      idleTimerRef.current = setTimeout(() => {
        if (!hasShownPopupRef.current && formData.zipcode && formData.zipcode.length === 5) {
          setShowExitPopup(true)
          hasShownPopupRef.current = true
        }
      }, 15000) // 15秒
    }

    // 监听鼠标离开页面
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && !hasShownPopupRef.current && formData.zipcode && formData.zipcode.length === 5) {
        setShowExitPopup(true)
        hasShownPopupRef.current = true
      }
    }

    // 监听滚动事件
    const handleScroll = () => {
      hasInteractedRef.current = true
      startIdleTimer()

      // 检查是否向上滚动超过80%
      const scrollTop = window.scrollY
      const scrollHeight = document.documentElement.scrollHeight
      const clientHeight = document.documentElement.clientHeight

      const scrollPercentage = scrollTop / (scrollHeight - clientHeight)

      if (scrollPercentage < 0.2 && !hasShownPopupRef.current && formData.zipcode && formData.zipcode.length === 5) {
        setShowExitPopup(true)
        hasShownPopupRef.current = true
      }
    }

    // 监听用户交互
    const handleUserInteraction = () => {
      hasInteractedRef.current = true
      startIdleTimer()
    }

    // 添加事件监听器
    document.addEventListener("mouseleave", handleMouseLeave)
    window.addEventListener("scroll", handleScroll)
    document.addEventListener("mousedown", handleUserInteraction)
    document.addEventListener("keydown", handleUserInteraction)

    // 启动初始计时器
    startIdleTimer()

    // 清理函数
    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current)
      }
      document.removeEventListener("mouseleave", handleMouseLeave)
      window.removeEventListener("scroll", handleScroll)
      document.removeEventListener("mousedown", handleUserInteraction)
      document.removeEventListener("keydown", handleUserInteraction)
    }
  }, [currentStep, formData.zipcode])

  // 监听ZIP码变化
  useEffect(() => {
    if (currentStep === 5 && formData.zipcode && formData.zipcode.length === 5) {
      zipCodeChangesRef.current += 1

      // 如果用户修改了多次ZIP码但没有继续
      if (zipCodeChangesRef.current >= 3 && !hasShownPopupRef.current) {
        setShowExitPopup(true)
        hasShownPopupRef.current = true
      }
    }
  }, [currentStep, formData.zipcode])

  // 处理报价请求提交
  const handleQuoteRequest = async (name: string, phone: string) => {
    // 这里可以添加发送报价到用户手机的逻辑
    // 例如调用API发送短信
    console.log("Sending quote to:", name, phone, "for zipcode:", formData.zipcode)

    // 模拟API调用
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // 成功后可以记录到分析系统或CRM
  }

  const goToNextStep = useCallback(() => {
    setCurrentStep((prev) => Math.min(prev + 1, totalSteps))

    // 重置退出意图状态
    if (currentStep === 5) {
      hasShownPopupRef.current = false
    }

    // 确保滚动到固定位置（向下70px）
    setTimeout(() => {
      window.scrollTo({
        top: 140,
        behavior: "smooth",
      })
    }, 100)
  }, [currentStep, totalSteps])

  const goToPreviousStep = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 1))
    // 返回上一步时，确保表单完全可见
    setTimeout(() => {
      ensureFormVisible()
    }, 100)
  }, [])

  const skipToStep = useCallback((step: number) => {
    setCurrentStep(Math.min(Math.max(step, 1), totalSteps))
    // 跳转到特定步骤时，确保表单完全可见
    setTimeout(() => {
      ensureFormVisible()
    }, 100)
  }, [])

  // 优化事件处理函数
  const handleInputChange = useCallback((field: keyof FormData, value: FormData[keyof FormData]) => {
    dispatch({ type: "UPDATE_FIELD", field, value })
  }, [])

  const handleNumberChange = useCallback((field: keyof FormData, value: string) => {
    if (value === "") {
      dispatch({ type: "UPDATE_FIELD", field, value: "" })
    } else {
      const numValue = Number.parseInt(value) || 0
      const validValue = Math.max(0, numValue)
      dispatch({ type: "UPDATE_FIELD", field, value: validValue })
    }
  }, [])

  const handleBlur = useCallback(
    (field: keyof FormData) => {
      const value = formData[field]
      if (value === "") {
        dispatch({ type: "UPDATE_FIELD", field, value: 0 })
      }
    },
    [formData],
  )

  const handleIncrement = useCallback(
    (field: keyof FormData) => {
      dispatch({
        type: "UPDATE_FIELD",
        field,
        value: (Number(formData[field]) || 0) + 1,
      })
    },
    [formData],
  )

  const handleDecrement = useCallback(
    (field: keyof FormData) => {
      if ((Number(formData[field]) || 0) > 0) {
        dispatch({
          type: "UPDATE_FIELD",
          field,
          value: (Number(formData[field]) || 0) - 1,
        })
      }
    },
    [formData],
  )

  // 修改 handleDateTimeSelect 函数
  const handleDateTimeSelect = useCallback(
    (date: Date | undefined, time: string | undefined, price: number, originalPrice: number) => {
      if (!date || !time) {
        setSelectedDateTime({
          date: undefined,
          time: undefined,
          price: 0,
          originalPrice: 0,
        })
        return
      }

      const formattedDate = format(date, "yyyy-MM-dd")
      dispatch({ type: "SET_DATE_TIME", date: formattedDate, time })

      setSelectedDateTime({
        date: formattedDate,
        time,
        price,
        originalPrice,
      })
    },
    [],
  )

  // 修复表单验证函数
  const isEstimationValid = useMemo(
    () =>
      ((Number(formData.adults) || 0) > 0 || (Number(formData.kids) || 0) > 0) &&
      formData.zipcode &&
      formData.zipcode.length === 5,
    [formData.adults, formData.kids, formData.zipcode],
  )

  const isOrderFormValid = useMemo(
    () =>
      Boolean(
        formData.name &&
          formData.email &&
          formData.phone &&
          formData.address &&
          selectedDateTime.date &&
          selectedDateTime.time &&
          formData.agreeToTerms,
      ),
    [
      formData.name,
      formData.email,
      formData.phone,
      formData.address,
      formData.agreeToTerms,
      selectedDateTime.date,
      selectedDateTime.time,
    ],
  )

  // 修复事件处理函数
  const handleProceedToOrder = useCallback(() => {
    if (isEstimationValid) {
      goToNextStep()
    }
  }, [isEstimationValid, goToNextStep])

  // 修改表单提交逻辑
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    e.stopPropagation()

    // 验证是否是通过按钮点击触发的提交
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement
    if (!submitter || submitter.type !== "submit" || submitter.id !== "submit-button") {
      return
    }

    // 添加额外的验证
    if (!formData.agreeToTerms) {
      return
    }

    try {
      setIsSubmitting(true)
      setOrderError("")

      // 准备表单数据
      const bookingFormData: BookingFormData = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        zipcode: formData.zipcode,
        eventDate: formData.eventDate,
        eventTime: formData.eventTime,
        adults: Number(formData.adults) || 0,
        kids: Number(formData.kids) || 0,
        filetMignon: Number(formData.filetMignon) || 0,
        lobsterTail: Number(formData.lobsterTail) || 0,
        extraProteins: Number(formData.extraProteins) || 0,
        noodles: Number(formData.noodles) || 0,
        gyoza: Number(formData.gyoza) || 0,
        edamame: Number(formData.edamame) || 0,
        message: formData.message,
        agreeToTerms: formData.agreeToTerms,
      }

      console.log("Creating booking with data:", bookingFormData)

      const result = await createBooking(bookingFormData)

      if (!result.success) {
        setOrderError(result.error || "Failed to create booking")
        return
      }

      // 所有操作成功完成后，进入第7步而不是直接设置 isSubmitted
      setOrderData({
        id: result.data?.id || "",
        full_name: result.data?.full_name || "",
        event_date: result.data?.event_date || "",
        event_time: result.data?.event_time || "",
        total_amount: costs.total,
      })

      // 先进入下一步
      goToNextStep()

      // 然后确保滚动到表单顶部
      setTimeout(() => {
        const formElement = document.getElementById("estimation-form")
        if (formElement) {
          // 滚动到表单顶部
          window.scrollTo({
            top: formElement.offsetTop - 20,
            behavior: "smooth",
          })
        }
      }, 100)
    } catch (error: any) {
      console.error("Error submitting booking:", error)
      setOrderError("An unexpected error occurred. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  // 计算总人数，确保至少为1
  const totalGuests = Math.max(1, (Number(formData.adults) || 0) + (Number(formData.kids) || 0))

  // 修改复选框处理函数
  const handleCheckboxChange = (checked: boolean) => {
    dispatch({ type: "UPDATE_FIELD", field: "agreeToTerms", value: checked })
  }

  if (isSubmitted) {
    return (
      <Suspense fallback={<div className="animate-pulse bg-gray-100 h-[300px] rounded-lg" />}>
        <BookingSuccess orderData={orderData} totalGuests={totalGuests} />
      </Suspense>
    )
  }

  return (
    <>
      <Suspense fallback={<div className="animate-pulse bg-gray-100 h-[400px] rounded-lg" />}>
        <div
          id="estimation-form"
          className="bg-white text-[#111827] rounded-xl shadow-md p-6 mb-8 border border-gray-200 min-h-[600px] relative overflow-hidden"
        >
          {/* Progress indicator */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-[#4B5563]">
                Step {currentStep} / {totalSteps}
              </span>
              <span className="text-sm font-medium text-[#4B5563]">
                {Math.round((currentStep / totalSteps) * 100)}% Complete
              </span>
            </div>
            <div className="w-full bg-[#E5E7EB] rounded-full h-1.5">
              <div
                className="bg-[#E4572E] h-1.5 rounded-full transition-all duration-300 ease-in-out"
                style={{ width: `${(currentStep / totalSteps) * 100}%` }}
              ></div>
            </div>
          </div>

          {/* Step 1: Choose number of adults and kids */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-center mb-6">Select Party Size</h2>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-lg font-medium">👤 How many adults? (13 years and older)</label>
                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={() => handleDecrement("adults")}
                      className="px-4 py-2 bg-[#4B5563] rounded-l-md hover:bg-[#374151] text-white"
                      aria-label="Decrease adult count"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      value={formData.adults}
                      onChange={(e) => handleNumberChange("adults", e.target.value)}
                      onBlur={() => handleBlur("adults")}
                      className="w-16 text-center py-2 border-y border-gray-300 bg-[#F9FAFB] text-[#111827] font-medium"
                      min="0"
                    />
                    <button
                      type="button"
                      onClick={() => handleIncrement("adults")}
                      className="px-4 py-2 bg-[#4B5563] rounded-r-md hover:bg-[#374151] text-white"
                      aria-label="Increase adult count"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-lg font-medium">👶 How many children? (12 years and under)</label>
                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={() => handleDecrement("kids")}
                      className="px-4 py-2 bg-[#4B5563] rounded-l-md hover:bg-[#374151] text-white"
                      aria-label="Decrease children count"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      value={formData.kids}
                      onChange={(e) => handleNumberChange("kids", e.target.value)}
                      onBlur={() => handleBlur("kids")}
                      className="w-16 text-center py-2 border-y border-gray-300 bg-[#F9FAFB] text-[#111827] font-medium"
                      min="0"
                    />
                    <button
                      type="button"
                      onClick={() => handleIncrement("kids")}
                      className="px-4 py-2 bg-[#4B5563] rounded-r-md hover:bg-[#374151] text-white"
                      aria-label="Increase children count"
                    >
                      +
                    </button>
                  </div>
                  <p className="text-sm text-[#4B5563]">(Note: Children under 3 are free, no need to include)</p>
                </div>
              </div>

              <div className="pt-4">
                <button
                  onClick={goToNextStep}
                  disabled={(Number(formData.adults) || 0) === 0 && (Number(formData.kids) || 0) === 0}
                  className="w-full py-3 bg-[#E4572E] text-white rounded-md hover:bg-[#D64545] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  Next Step
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Optional appetizers */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-center mb-6">Would You Like Appetizers?</h2>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-lg font-medium">🥟 Gyoza (Japanese Dumplings)</label>
                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={() => handleDecrement("gyoza")}
                      className="px-4 py-2 bg-[#4B5563] rounded-l-md hover:bg-[#374151] text-white"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      value={formData.gyoza}
                      onChange={(e) => handleNumberChange("gyoza", e.target.value)}
                      onBlur={() => handleBlur("gyoza")}
                      className="w-16 text-center py-2 border-y border-gray-300 bg-[#F9FAFB] text-[#111827] font-medium"
                      min="0"
                    />
                    <button
                      type="button"
                      onClick={() => handleIncrement("gyoza")}
                      className="px-4 py-2 bg-[#4B5563] rounded-r-md hover:bg-[#374151] text-white"
                    >
                      +
                    </button>
                    <span className="ml-3 text-[#6B7280]">$10 per order</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-lg font-medium">🫛 Edamame (Soybeans)</label>
                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={() => handleDecrement("edamame")}
                      className="px-4 py-2 bg-[#4B5563] rounded-l-md hover:bg-[#374151] text-white"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      value={formData.edamame}
                      onChange={(e) => handleNumberChange("edamame", e.target.value)}
                      onBlur={() => handleBlur("edamame")}
                      className="w-16 text-center py-2 border-y border-gray-300 bg-[#F9FAFB] text-[#111827] font-medium"
                      min="0"
                    />
                    <button
                      type="button"
                      onClick={() => handleIncrement("edamame")}
                      className="px-4 py-2 bg-[#4B5563] rounded-r-md hover:bg-[#374151] text-white"
                    >
                      +
                    </button>
                    <span className="ml-3 text-[#6B7280]">$8 per order</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex flex-col space-y-3">
                <button
                  onClick={goToNextStep}
                  className="w-full py-3 bg-[#E4572E] text-white rounded-md hover:bg-[#D64545] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  Next Step
                </button>
                <button
                  onClick={() => {
                    handleNumberChange("gyoza", "0")
                    handleNumberChange("edamame", "0")
                    goToNextStep()
                  }}
                  className="w-full py-2 border border-gray-300 text-[#4B5563] font-medium rounded-md hover:bg-gray-50 transition-colors"
                >
                  I don't need appetizers, skip
                </button>
              </div>

              <div className="pt-2 text-center">
                <button onClick={goToPreviousStep} className="text-[#4B5563] hover:text-[#E4572E] text-sm font-medium">
                  Back to previous step
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Optional premium main dishes */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-center mb-6">Upgrade Your Main Course?</h2>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-lg font-medium">🥩 Filet Mignon</label>
                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={() => handleDecrement("filetMignon")}
                      className="px-4 py-2 bg-[#4B5563] rounded-l-md hover:bg-[#374151] text-white"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      value={formData.filetMignon}
                      onChange={(e) => handleNumberChange("filetMignon", e.target.value)}
                      onBlur={() => handleBlur("filetMignon")}
                      className="w-16 text-center py-2 border-y border-gray-300 bg-[#F9FAFB] text-[#111827] font-medium"
                      min="0"
                    />
                    <button
                      type="button"
                      onClick={() => handleIncrement("filetMignon")}
                      className="px-4 py-2 bg-[#4B5563] rounded-r-md hover:bg-[#374151] text-white"
                    >
                      +
                    </button>
                    <span className="ml-3 text-[#6B7280]">+$5 per person</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-lg font-medium">🦞 Lobster Tail</label>
                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={() => handleDecrement("lobsterTail")}
                      className="px-4 py-2 bg-[#4B5563] rounded-l-md hover:bg-[#374151] text-white"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      value={formData.lobsterTail}
                      onChange={(e) => handleNumberChange("lobsterTail", e.target.value)}
                      onBlur={() => handleBlur("lobsterTail")}
                      className="w-16 text-center py-2 border-y border-gray-300 bg-[#F9FAFB] text-[#111827] font-medium"
                      min="0"
                    />
                    <button
                      type="button"
                      onClick={() => handleIncrement("lobsterTail")}
                      className="px-4 py-2 bg-[#4B5563] rounded-r-md hover:bg-[#374151] text-white"
                    >
                      +
                    </button>
                    <span className="ml-3 text-[#6B7280]">+$10 per person</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex flex-col space-y-3">
                <button
                  onClick={goToNextStep}
                  className="w-full py-3 bg-[#E4572E] text-white rounded-md hover:bg-[#D64545] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  Next Step
                </button>
                <button
                  onClick={() => {
                    handleNumberChange("filetMignon", "0")
                    handleNumberChange("lobsterTail", "0")
                    goToNextStep()
                  }}
                  className="w-full py-2 border border-gray-300 text-[#4B5563] font-medium rounded-md hover:bg-gray-50 transition-colors"
                >
                  No upgrades needed, skip
                </button>
              </div>

              <div className="pt-2 text-center">
                <button onClick={goToPreviousStep} className="text-[#4B5563] hover:text-[#E4572E] text-sm font-medium">
                  Back to previous step
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Optional side dishes */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-center mb-6">Add Side Dishes or Extra Proteins?</h2>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-lg font-medium">🥩 Extra Proteins</label>
                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={() => handleDecrement("extraProteins")}
                      className="px-4 py-2 bg-[#4B5563] rounded-l-md hover:bg-[#374151] text-white"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      value={formData.extraProteins}
                      onChange={(e) => handleNumberChange("extraProteins", e.target.value)}
                      onBlur={() => handleBlur("extraProteins")}
                      className="w-16 text-center py-2 border-y border-gray-300 bg-[#F9FAFB] text-[#111827] font-medium"
                      min="0"
                    />
                    <button
                      type="button"
                      onClick={() => handleIncrement("extraProteins")}
                      className="px-4 py-2 bg-[#4B5563] rounded-r-md hover:bg-[#374151] text-white"
                    >
                      +
                    </button>
                    <span className="ml-3 text-[#6B7280]">$15 per order</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-lg font-medium">🍜 Noodles</label>
                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={() => handleDecrement("noodles")}
                      className="px-4 py-2 bg-[#4B5563] rounded-l-md hover:bg-[#374151] text-white"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      value={formData.noodles}
                      onChange={(e) => handleNumberChange("noodles", e.target.value)}
                      onBlur={() => handleBlur("noodles")}
                      className="w-16 text-center py-2 border-y border-gray-300 bg-[#F9FAFB] text-[#111827] font-medium"
                      min="0"
                    />
                    <button
                      type="button"
                      onClick={() => handleIncrement("noodles")}
                      className="px-4 py-2 bg-[#4B5563] rounded-r-md hover:bg-[#374151] text-white"
                    >
                      +
                    </button>
                    <span className="ml-3 text-[#6B7280]">$5 per order</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex flex-col space-y-3">
                <button
                  onClick={goToNextStep}
                  className="w-full py-3 bg-[#E4572E] text-white rounded-md hover:bg-[#D64545] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  Next Step
                </button>
                <button
                  onClick={() => {
                    handleNumberChange("extraProteins", "0")
                    handleNumberChange("noodles", "0")
                    goToNextStep()
                  }}
                  className="w-full py-2 border border-gray-300 text-[#4B5563] font-medium rounded-md hover:bg-gray-50 transition-colors"
                >
                  No thanks, skip
                </button>
              </div>

              <div className="pt-2 text-center">
                <button onClick={goToPreviousStep} className="text-[#4B5563] hover:text-[#E4572E] text-sm font-medium">
                  Back to previous step
                </button>
              </div>
            </div>
          )}

          {/* Step 5: Enter ZIP code for pricing */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-center mb-6">Enter Your ZIP Code for Pricing</h2>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-lg font-medium">📍 ZIP Code</label>
                  <input
                    type="text"
                    value={formData.zipcode}
                    onChange={(e) => handleInputChange("zipcode", e.target.value)}
                    placeholder="Example: 10001"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#E4572E] bg-white"
                    maxLength={5}
                  />
                  <p className="text-sm text-[#4B5563]">We need your ZIP code to calculate service fees</p>
                </div>

                {formData.zipcode && formData.zipcode.length === 5 && (
                  <div className="mt-6 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                    <h3 className="text-xl font-bold mb-3">Your Estimated Price</h3>

                    {((Number(formData.adults) || 0) > 0 || (Number(formData.kids) || 0) > 0) && (
                      <div className="space-y-2">
                        {(Number(formData.adults) || 0) > 0 && (
                          <div className="flex justify-between">
                            <span>
                              Adults ({Number(formData.adults) || 0} x ${pricing.packages.basic.perPerson})
                            </span>
                            <span>${costs.adultsCost}</span>
                          </div>
                        )}

                        {(Number(formData.kids) || 0) > 0 && (
                          <div className="flex justify-between">
                            <span>
                              Children ({Number(formData.kids) || 0} x ${pricing.children.basic})
                            </span>
                            <span>${costs.kidsCost}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {((Number(formData.filetMignon) || 0) > 0 || (Number(formData.lobsterTail) || 0) > 0) && (
                      <div className="mt-2 pt-2 border-t border-gray-700 space-y-2">
                        <h4 className="font-medium">Premium Upgrades</h4>
                        {(Number(formData.filetMignon) || 0) > 0 && (
                          <div className="flex justify-between">
                            <span>Filet Mignon ({Number(formData.filetMignon) || 0} x $5)</span>
                            <span>${costs.filetMignonCost}</span>
                          </div>
                        )}

                        {(Number(formData.lobsterTail) || 0) > 0 && (
                          <div className="flex justify-between">
                            <span>Lobster Tail ({Number(formData.lobsterTail) || 0} x $10)</span>
                            <span>${costs.lobsterTailCost}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {((Number(formData.extraProteins) || 0) > 0 || (Number(formData.noodles) || 0) > 0) && (
                      <div className="mt-2 pt-2 border-t border-gray-700 space-y-2">
                        <h4 className="font-medium">Side Dishes</h4>
                        {(Number(formData.extraProteins) || 0) > 0 && (
                          <div className="flex justify-between">
                            <span>Extra Proteins ({Number(formData.extraProteins) || 0} x $15)</span>
                            <span>${costs.extraProteinsCost}</span>
                          </div>
                        )}

                        {(Number(formData.noodles) || 0) > 0 && (
                          <div className="flex justify-between">
                            <span>Noodles ({Number(formData.noodles) || 0} x $5)</span>
                            <span>${costs.noodlesCost}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {((Number(formData.gyoza) || 0) > 0 || (Number(formData.edamame) || 0) > 0) && (
                      <div className="mt-2 pt-2 border-t border-gray-700 space-y-2">
                        <h4 className="font-medium">Appetizers</h4>
                        {(Number(formData.gyoza) || 0) > 0 && (
                          <div className="flex justify-between">
                            <span>Gyoza ({Number(formData.gyoza) || 0} x $10)</span>
                            <span>${costs.gyozaCost}</span>
                          </div>
                        )}

                        {(Number(formData.edamame) || 0) > 0 && (
                          <div className="flex justify-between">
                            <span>Edamame ({Number(formData.edamame) || 0} x $8)</span>
                            <span>${costs.edamameCost}</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="mt-2 pt-2 border-t border-gray-700">
                      <div className="flex justify-between">
                        <span>Travel Fee</span>
                        <span>${costs.travelFee}</span>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t-2 border-amber-700 font-bold">
                      <div className="flex justify-between text-lg">
                        <span>Total</span>
                        <span>${costs.total}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 space-y-3">
                <button
                  onClick={handleProceedToOrder}
                  disabled={!isEstimationValid}
                  className="w-full py-3 bg-[#E4572E] text-white rounded-md hover:bg-[#D64545] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  Yes, I want to book this!
                </button>
                <button
                  onClick={() => setShowExitPopup(true)}
                  className="w-full py-2.5 border border-gray-300 bg-white text-[#4B5563] font-medium rounded-md hover:bg-gray-50 transition-colors"
                >
                  No, thank you
                </button>
                {!isEstimationValid && (
                  <p className="text-sm text-amber-400 mt-2 text-center">
                    Please select at least one guest and enter a valid ZIP code
                  </p>
                )}
              </div>

              <div className="pt-2 text-center">
                <button onClick={goToPreviousStep} className="text-[#4B5563] hover:text-[#E4572E] text-sm font-medium">
                  Back to previous step
                </button>
              </div>
            </div>
          )}

          {/* Step 6: Booking Form */}
          {currentStep === 6 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-center mb-6">Complete Your Booking</h2>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-lg font-medium">Full Name*</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                      placeholder="Your full name"
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#E4572E] bg-white"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-lg font-medium">Email Address*</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      placeholder="your.email@example.com"
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#E4572E] bg-white"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-lg font-medium">Phone Number*</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleInputChange("phone", e.target.value)}
                      placeholder="(123) 456-7890"
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#E4572E] bg-white"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-lg font-medium">Full Address*</label>
                    <div className="space-y-3">
                      {/* 街道地址输入框，集成Google Places自动完成 */}
                      <div id="street-address-container">
                        <GooglePlacesAutocomplete
                          value={formData.address}
                          onChange={(value, placeDetails) => {
                            // 如果有地点详情，解析并填充各个字段
                            if (placeDetails && placeDetails.address_components) {
                              let streetNumber = ""
                              let streetName = ""
                              let city = ""
                              let state = ""
                              let zipcode = ""

                              // 解析地址组件
                              placeDetails.address_components.forEach((component: any) => {
                                const types = component.types

                                // 获取街道号码
                                if (types.includes("street_number")) {
                                  streetNumber = component.long_name
                                }

                                // 获取街道名称
                                if (types.includes("route")) {
                                  streetName = component.long_name
                                }

                                // 获取城市
                                if (
                                  types.includes("locality") ||
                                  types.includes("sublocality") ||
                                  types.includes("administrative_area_level_3")
                                ) {
                                  city = component.long_name
                                }

                                // 获取州/省
                                if (types.includes("administrative_area_level_1")) {
                                  state = component.short_name
                                }

                                // 获取邮政编码
                                if (types.includes("postal_code")) {
                                  zipcode = component.long_name
                                }
                              })

                              // 构建街道地址（只包含街道号码和街道名称）
                              const streetAddress = `${streetNumber} ${streetName}`.trim()

                              // 更新街道地址
                              handleInputChange("address", streetAddress)

                              // 更新城市和州字段的显示值
                              const cityInput = document.getElementById("city-input") as HTMLInputElement
                              const stateInput = document.getElementById("state-input") as HTMLInputElement
                              if (cityInput && city) cityInput.value = city
                              if (stateInput && state) stateInput.value = state

                              // 更新邮政编码
                              if (zipcode) {
                                handleInputChange("zipcode", zipcode)
                              }
                            } else {
                              // 如果没有地点详情，直接使用输入值
                              handleInputChange("address", value)
                            }
                          }}
                          placeholder="Enter your street address"
                          className="address-input"
                          required
                        />
                      </div>

                      {/* 城市、州和邮编字段 */}
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          id="city-input"
                          type="text"
                          placeholder="City"
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#E4572E] bg-white"
                          autoComplete="address-level2"
                          onChange={(e) => {
                            // 当用户手动修改城市时，可以更新这个值
                            // 但不需要更新完整地址，因为完整地址已经由Google Places提供
                          }}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            id="state-input"
                            type="text"
                            placeholder="State"
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#E4572E] bg-white"
                            autoComplete="address-level1"
                            onChange={(e) => {
                              // 当用户手动修改州时，可以更新这个值
                              // 但不需要更新完整地址，因为完整地址已经由Google Places提供
                            }}
                          />
                          <input
                            type="text"
                            value={formData.zipcode}
                            onChange={(e) => handleInputChange("zipcode", e.target.value)}
                            placeholder="ZIP"
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#E4572E] bg-white"
                            autoComplete="postal-code"
                            maxLength={5}
                          />
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">
                      Start typing your street address, then select a complete address from the dropdown to auto-fill
                      all fields
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-lg font-medium">Special Requests or Notes</label>
                  <textarea
                    value={formData.message}
                    onChange={(e) => handleInputChange("message", e.target.value)}
                    placeholder="Dietary restrictions, special occasions, or other requests"
                    className="w-full min-h-[100px] px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#E4572E] bg-white"
                  />
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Select Date & Time</h3>
                  <p className="text-sm text-[#4B5563] mb-4">
                    Choose from available dates and times. Green dates indicate special pricing!
                  </p>
                  {formData.zipcode && formData.zipcode.length === 5 && (
                    <DynamicPricingCalendar
                      key={`calendar-${formData.zipcode}-${totalGuests}`}
                      onSelectDateTime={handleDateTimeSelect}
                      packageType="basic"
                      headcount={totalGuests}
                      zipcode={formData.zipcode}
                      basePrice={costs.subtotal}
                    />
                  )}
                </div>

                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                  <h3 className="text-lg font-medium mb-2">Order Summary</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Total Guests:</span>
                      <span>{totalGuests} people</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Food & Add-ons:</span>
                      <span>${costs.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Travel Fee:</span>
                      <span>${costs.travelFee.toFixed(2)}</span>
                    </div>

                    {selectedDateTime.date && selectedDateTime.time && (
                      <>
                        <div className="flex justify-between">
                          <span>Selected Date & Time:</span>
                          <span>
                            {format(selectedDateTime.date, "MMM d, yyyy")} at {selectedDateTime.time}
                          </span>
                        </div>
                        {selectedDateTime.originalPrice > selectedDateTime.price && (
                          <div className="flex justify-between text-green-600">
                            <span>Special Discount:</span>
                            <span>-${(selectedDateTime.originalPrice - selectedDateTime.price).toFixed(2)}</span>
                          </div>
                        )}
                      </>
                    )}

                    <div className="flex justify-between font-bold">
                      <span>Total Amount:</span>
                      <span>
                        $
                        {(selectedDateTime.date && selectedDateTime.time
                          ? selectedDateTime.price + costs.travelFee
                          : costs.total
                        ).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-start space-x-2">
                  <input
                    type="checkbox"
                    id="agreeToTerms"
                    checked={formData.agreeToTerms}
                    onChange={(e) => handleCheckboxChange(e.target.checked)}
                    className="mt-1"
                    required
                  />
                  <div>
                    <label htmlFor="agreeToTerms" className="text-sm font-medium">
                      I agree to the terms and conditions
                    </label>
                    <p className="text-sm text-[#4B5563]">
                      By submitting this form, you agree to be contacted about your hibachi experience.
                    </p>
                  </div>
                </div>

                {orderError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md">{orderError}</div>
                )}
              </div>

              <div className="pt-4">
                <form onSubmit={handleSubmit}>
                  <button
                    id="submit-button"
                    type="submit"
                    disabled={isSubmitting || !isOrderFormValid}
                    className="w-full py-3 bg-[#E4572E] text-white rounded-md hover:bg-[#D64545] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-sm"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center justify-center">
                        <svg
                          className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Processing...
                      </span>
                    ) : (
                      "Book My Hibachi Party"
                    )}
                  </button>
                </form>
              </div>

              <div className="pt-2 text-center">
                <button onClick={goToPreviousStep} className="text-[#4B5563] hover:text-[#E4572E] text-sm font-medium">
                  Back to previous step
                </button>
              </div>
            </div>
          )}
          {/* Step 7: Deposit Payment */}
          {currentStep === 7 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-center mb-6">Secure Your Hibachi Party with a Deposit</h2>

              {/* 顶部确认区 */}
              <div className="bg-green-50 p-5 rounded-lg border border-green-100">
                <h3 className="text-xl font-bold text-center text-green-800 mb-3">🎉 You're almost done!</h3>
                <p className="text-center mb-4">Here's a summary of your booking request:</p>

                <div className="grid grid-cols-2 gap-2 max-w-md mx-auto text-[#111827]">
                  <div className="font-medium">📅 Date:</div>
                  <div>
                    {orderData?.event_date ? format(new Date(orderData.event_date), "MMMM d, yyyy") : "Not selected"}
                  </div>

                  <div className="font-medium">🕒 Time:</div>
                  <div>{orderData?.event_time || "Not selected"}</div>

                  <div className="font-medium">👥 Guests:</div>
                  <div>{totalGuests} people</div>

                  <div className="font-medium">💵 Estimated Total:</div>
                  <div>${orderData?.total_amount?.toFixed(2) || costs.total.toFixed(2)}</div>

                  <div className="font-medium">💰 Deposit Required:</div>
                  <div className="font-bold text-[#E4572E]">$100.00</div>
                </div>
              </div>

              {/* 安心提示区 */}
              <div className="bg-blue-50 p-5 rounded-lg border border-blue-100">
                <h3 className="text-lg font-bold text-center text-blue-800 mb-3">🔒 Why do we ask for a deposit?</h3>

                <ul className="space-y-2 max-w-md mx-auto">
                  <li className="flex items-start">
                    <span className="text-green-600 mr-2">✅</span>
                    <span>This secures your chef and blocks your date</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-600 mr-2">✅</span>
                    <span>Fully refundable up to 72 hours before the event</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-600 mr-2">✅</span>
                    <span>We'll reach out within 24 hours to confirm everything</span>
                  </li>
                </ul>

                <p className="text-center mt-3 text-blue-700">
                  Need to make changes later? No problem — we're flexible!
                </p>
              </div>

              {/* 支付按钮区 */}
              <div className="pt-4">
                <button
                  onClick={() => {
                    try {
                      // 确保 Supabase 环境变量存在
                      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
                        console.error("Supabase environment variables are missing")
                        alert("Payment system is temporarily unavailable. Please try again later or contact support.")
                        return
                      }

                      // 尝试创建 Supabase 客户端以验证连接
                      createClientSupabaseClient()

                      // 如果成功，则跳转到支付链接
                      window.location.href = paymentConfig.stripePaymentLink
                    } catch (error) {
                      console.error("Error initializing payment:", error)
                      alert("Unable to process payment at this time. Please try again later or contact support.")
                    }
                  }}
                  className="w-full py-4 bg-[#E4572E] text-white rounded-md hover:bg-[#D64545] font-bold text-lg transition-colors shadow-md"
                >
                  🟧 Confirm and Pay $100 Deposit
                </button>
                <p className="text-center text-sm text-gray-500 mt-2">💳 Powered by Stripe • Secure & Encrypted</p>
              </div>

              {/* 小字说明区 */}
              <div className="text-xs text-gray-500 text-center space-y-1">
                <p>By paying the deposit, you are confirming your request for this event.</p>
                <p>
                  If for any reason you need to cancel, you will receive a full refund if cancelled at least 72 hours
                  before your event.
                </p>
                <p>
                  <a href="/faq" className="text-[#E4572E] hover:underline">
                    View our full refund policy
                  </a>
                </p>
              </div>

              {/* 可选备选路径 */}
              <div className="mt-8 pt-6 border-t border-gray-200">
                <h3 className="text-lg font-medium text-center mb-3">❓ Not ready to pay now?</h3>
                <p className="text-center text-sm text-gray-600 mb-4">
                  We can hold your quote for 24 hours. Leave your name and number below and we'll follow up.
                </p>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="Your Name"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#E4572E]"
                  />
                  <input
                    type="tel"
                    placeholder="Phone Number"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#E4572E]"
                  />
                  <button className="px-4 py-2 bg-gray-100 text-gray-800 border border-gray-300 rounded-md hover:bg-gray-200 transition-colors">
                    📩 Hold My Spot
                  </button>
                </div>
              </div>

              <div className="pt-2 text-center">
                <button onClick={goToPreviousStep} className="text-[#4B5563] hover:text-[#E4572E] text-sm font-medium">
                  Back to previous step
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Exit Intent Popup */}
        <ExitIntentPopup
          zipcode={formData.zipcode}
          isVisible={showExitPopup}
          onClose={() => setShowExitPopup(false)}
          onSubmit={handleQuoteRequest}
        />
      </Suspense>
    </>
  )
}
