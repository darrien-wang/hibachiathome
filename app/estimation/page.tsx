"use client"

import type React from "react"

import { useState, useEffect, useCallback, useReducer, useMemo, Suspense } from "react"
import { pricing } from "@/config/pricing"
import { format } from "date-fns"
import dynamic from "next/dynamic"
import { useSearchParams } from "next/navigation"
import { createBooking } from "@/app/actions/booking"
import type { BookingFormData } from "@/types/booking"

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

// 预加载关键组件
const preloadComponents = () => {
  // 预加载表单组件
  const bookingFormPromise = import("@/components/booking/booking-form")
  // 预加载计算器组件
  const costCalculatorPromise = import("@/components/booking/cost-calculator")

  return Promise.all([bookingFormPromise, costCalculatorPromise])
}

type FormData = {
  adults: number
  kids: number
  filetMignon: number
  lobsterTail: number
  extraProteins: number
  noodles: number
  gyoza: number
  edamame: number
  zipcode: string
  name: string
  email: string
  phone: string
  address: string
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
    const adultsCost = formData.adults * adultPrice
    const kidsCost = formData.kids * kidPrice
    const filetMignonCost = formData.filetMignon * filetUpcharge
    const lobsterTailCost = formData.lobsterTail * lobsterUpcharge
    const extraProteinsCost = formData.extraProteins * extraProteinPrice
    const noodlesCost = formData.noodles * noodlePrice
    const gyozaCost = formData.gyoza * gyozaPrice
    const edamameCost = formData.edamame * edamamePrice

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
    <div className="container mx-auto px-4 py-12 pt-24 mt-16">
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

  // 优化事件处理函数
  const handleInputChange = useCallback((field: keyof FormData, value: FormData[keyof FormData]) => {
    dispatch({ type: "UPDATE_FIELD", field, value })
  }, [])

  const handleNumberChange = useCallback((field: keyof FormData, value: string) => {
    const numValue = Number.parseInt(value) || 0
    const validValue = Math.max(0, numValue)
    dispatch({ type: "UPDATE_FIELD", field, value: validValue })
  }, [])

  const handleIncrement = useCallback(
    (field: keyof FormData) => {
      dispatch({
        type: "UPDATE_FIELD",
        field,
        value: (formData[field] as number) + 1,
      })
    },
    [formData],
  )

  const handleDecrement = useCallback(
    (field: keyof FormData) => {
      if ((formData[field] as number) > 0) {
        dispatch({
          type: "UPDATE_FIELD",
          field,
          value: (formData[field] as number) - 1,
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
    () => (formData.adults > 0 || formData.kids > 0) && formData.zipcode && formData.zipcode.length === 5,
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
      // 移除函数调用
      setShowOrderForm(true)
      setTimeout(() => {
        document.getElementById("order-form")?.scrollIntoView({ behavior: "smooth" })
      }, 100)
    }
  }, [isEstimationValid])

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
        adults: formData.adults,
        kids: formData.kids,
        filetMignon: formData.filetMignon,
        lobsterTail: formData.lobsterTail,
        extraProteins: formData.extraProteins,
        noodles: formData.noodles,
        gyoza: formData.gyoza,
        edamame: formData.edamame,
        message: formData.message,
        agreeToTerms: formData.agreeToTerms,
      }

      console.log("Creating booking with data:", bookingFormData)

      const result = await createBooking(bookingFormData)

      if (!result.success) {
        setOrderError(result.error || "Failed to create booking")
        return
      }

      // 所有操作成功完成
      setIsSubmitted(true)
      window.scrollTo({ top: 0, behavior: "smooth" })
      setOrderData({
        id: result.data?.id || "",
        full_name: result.data?.full_name || "",
        event_date: result.data?.event_date || "",
        event_time: result.data?.event_time || "",
        total_amount: costs.total,
      })
    } catch (error: any) {
      console.error("Error submitting booking:", error)
      setOrderError("An unexpected error occurred. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  // 计算总人数，确保至少为1
  const totalGuests = Math.max(1, formData.adults + formData.kids)

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
        <CostCalculator
          formData={formData}
          costs={costs}
          onProceedToOrder={handleProceedToOrder}
          isEstimationValid={isEstimationValid}
          onInputChange={handleInputChange}
          onNumberChange={handleNumberChange}
          onIncrement={handleIncrement}
          onDecrement={handleDecrement}
        />
      </Suspense>

      {showOrderForm && (
        <Suspense fallback={<div className="animate-pulse bg-gray-100 h-[600px] rounded-lg" />}>
          <BookingForm
            formData={formData}
            costs={costs}
            selectedDateTime={selectedDateTime}
            isSubmitting={isSubmitting}
            orderError={orderError}
            isOrderFormValid={isOrderFormValid}
            onSubmit={handleSubmit}
            onInputChange={handleInputChange}
            onCheckboxChange={handleCheckboxChange}
            onDateTimeSelect={handleDateTimeSelect}
            totalGuests={totalGuests}
          />
        </Suspense>
      )}
    </>
  )
}
