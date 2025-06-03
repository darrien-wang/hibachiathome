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
import { TermsCheckbox } from "@/components/booking/booking-form"
import { TermsModal } from "@/components/booking/terms-modal"
import Step1PartySize from "@/components/estimation/Step1PartySize"
import Step2Appetizers from "@/components/estimation/Step2Appetizers"
import Step3PremiumMains from "@/components/estimation/Step3PremiumMains"
import Step4Sides from "@/components/estimation/Step4Sides"
import Step5Estimate from "@/components/estimation/Step5Estimate"
import Step6BookingForm from "@/components/estimation/Step6BookingForm"
import Step7Deposit from "@/components/estimation/Step7Deposit"

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
    const extraProteinPrice = 10
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

  // 为每个数字输入框添加独立的 editingValue 局部 state
  const [editingAdults, setEditingAdults] = useState<string>(String(formData.adults))
  const [editingKids, setEditingKids] = useState<string>(String(formData.kids))
  const [editingGyoza, setEditingGyoza] = useState<string>(String(formData.gyoza))
  const [editingEdamame, setEditingEdamame] = useState<string>(String(formData.edamame))
  const [editingFiletMignon, setEditingFiletMignon] = useState<string>(String(formData.filetMignon))
  const [editingLobsterTail, setEditingLobsterTail] = useState<string>(String(formData.lobsterTail))
  const [editingExtraProteins, setEditingExtraProteins] = useState<string>(String(formData.extraProteins))
  const [editingNoodles, setEditingNoodles] = useState<string>(String(formData.noodles))

  // 同步 formData 变化时也同步 editingValue
  useEffect(() => { setEditingAdults(String(formData.adults)) }, [formData.adults])
  useEffect(() => { setEditingKids(String(formData.kids)) }, [formData.kids])
  useEffect(() => { setEditingGyoza(String(formData.gyoza)) }, [formData.gyoza])
  useEffect(() => { setEditingEdamame(String(formData.edamame)) }, [formData.edamame])
  useEffect(() => { setEditingFiletMignon(String(formData.filetMignon)) }, [formData.filetMignon])
  useEffect(() => { setEditingLobsterTail(String(formData.lobsterTail)) }, [formData.lobsterTail])
  useEffect(() => { setEditingExtraProteins(String(formData.extraProteins)) }, [formData.extraProteins])
  useEffect(() => { setEditingNoodles(String(formData.noodles)) }, [formData.noodles])

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
  const [hasStayedLongEnoughOnStep5, setHasStayedLongEnoughOnStep5] = useState(false)
  const [step5DurationTimerRef, setStep5DurationTimerRef] = useState<NodeJS.Timeout | null>(null)

  // Add after the other state declarations in EstimationContent function
  const [currentStep, setCurrentStep] = useState(1)
  const totalSteps = 7

  // 添加 after the other state declarations in EstimationContent function
  const [showTerms, setShowTerms] = useState(false)

  // 监听用户行为以显示退出意图弹窗
  useEffect(() => {
    const mouseLeaveHandler = (e: MouseEvent) => {
      if (
        e.clientY <= 0 && // Mouse leaves towards the top of the viewport
        currentStep === 5 && // Ensure still on step 5
        !hasStayedLongEnoughOnStep5
      ) {
        setHasStayedLongEnoughOnStep5(true)
      }
    }

    if (currentStep === 5 && !hasStayedLongEnoughOnStep5) {
      // If on step 5 and popup hasn't been shown yet:
      // Start the 2-minute timer if it's not already running and the duration hasn't been met
      if (!step5DurationTimerRef && !hasStayedLongEnoughOnStep5) {
        const timer = setTimeout(() => {
          // After 2 minutes, if still on step 5 and popup not shown, mark as stayed long enough
          if (currentStep === 5 && !hasStayedLongEnoughOnStep5) {
            setHasStayedLongEnoughOnStep5(true)
          }
        }, 120000) // 2 minutes = 120,000 milliseconds
        setStep5DurationTimerRef(timer)
      }

      // Add mouseleave listener to detect exit intent
      document.addEventListener("mouseleave", mouseLeaveHandler)
    } else {
      // Cleanup if not on step 5 or if popup has already been shown
      if (step5DurationTimerRef) {
        clearTimeout(step5DurationTimerRef)
        setStep5DurationTimerRef(null)
      }
      setHasStayedLongEnoughOnStep5(false) // Reset the flag
      document.removeEventListener("mouseleave", mouseLeaveHandler) // Clean up listener
    }

    // Cleanup function for when the component unmounts or dependencies change
    return () => {
      if (step5DurationTimerRef) {
        clearTimeout(step5DurationTimerRef)
      }
      document.removeEventListener("mouseleave", mouseLeaveHandler)
    }
  }, [currentStep, hasStayedLongEnoughOnStep5, setHasStayedLongEnoughOnStep5])

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
    const nextStep = Math.min(currentStep + 1, totalSteps)

    // 当进入第6步时，清空zipcode状态
    if (nextStep === 6) {
      dispatch({ type: "UPDATE_FIELD", field: "zipcode", value: "" })
    }

    setCurrentStep(nextStep)

    // 优化滚动逻辑：让表单距离顶部有 15% 的空白
    setTimeout(() => {
      const formElement = document.getElementById("estimation-form")
      if (formElement) {
        const offset = Math.max(formElement.offsetTop - window.innerHeight * 0.15, 0)
        window.scrollTo({
          top: offset,
          behavior: "smooth",
        })
      }
    }, 100)
  }, [currentStep])

  const goToPreviousStep = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 1))
    // 返回上一步时，确保表单完全可见
    setTimeout(() => {
      const formElement = document.getElementById("estimation-form")
      if (formElement) {
        const offset = Math.max(formElement.offsetTop - window.innerHeight * 0.15, 0)
        window.scrollTo({
          top: offset,
          behavior: "smooth",
        })
      }
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

  // 修改 handleNumberChange 只处理字符串，不再直接 dispatch
  const handleNumberChange = useCallback((field: keyof FormData, value: string) => {
    let sanitized = value.replace(/[^\d]/g, "");
    sanitized = sanitized.replace(/^0+(\d+)$/, "$1");
    if (field === "adults") setEditingAdults(sanitized);
    if (field === "kids") setEditingKids(sanitized);
    if (field === "gyoza") setEditingGyoza(sanitized);
    if (field === "edamame") setEditingEdamame(sanitized);
    if (field === "filetMignon") setEditingFiletMignon(sanitized);
    if (field === "lobsterTail") setEditingLobsterTail(sanitized);
    if (field === "extraProteins") setEditingExtraProteins(sanitized);
    if (field === "noodles") setEditingNoodles(sanitized);
    // 新增：同步到 formData
    const numValue = sanitized === "" ? 0 : Math.max(0, Number.parseInt(sanitized, 10));
    dispatch({ type: "UPDATE_FIELD", field, value: numValue });
  }, []);

  // 新增 handleNumberBlur
  const handleNumberBlur = useCallback((field: keyof FormData, value: string) => {
    if (value === "") {
      dispatch({ type: "UPDATE_FIELD", field, value: 0 });
      // 失焦后显示0
      if (field === "adults") setEditingAdults("0");
      if (field === "kids") setEditingKids("0");
      if (field === "gyoza") setEditingGyoza("0");
      if (field === "edamame") setEditingEdamame("0");
      if (field === "filetMignon") setEditingFiletMignon("0");
      if (field === "lobsterTail") setEditingLobsterTail("0");
      if (field === "extraProteins") setEditingExtraProteins("0");
      if (field === "noodles") setEditingNoodles("0");
      return;
    }
    // 失焦时同步到 formData
    const numValue = Math.max(0, Number.parseInt(value, 10) || 0);
    dispatch({ type: "UPDATE_FIELD", field, value: numValue });
  }, []);

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

      // 所有操作成功完成后，进入第7步而不是直接设置 isSubmitted
      setOrderData({
        id: result.data?.id || "",
        full_name: result.data?.full_name || "",
        event_date: result.data?.event_date || "",
        event_time: result.data?.event_time || "",
        address: result.data?.address || "",
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
  const totalGuests = Math.max(1, formData.adults + formData.kids)

  // 修改复选框处理函数
  const handleCheckboxChange = (checked: boolean) => {
    dispatch({ type: "UPDATE_FIELD", field: "agreeToTerms", value: checked })
  }

  // 计算实际餐费
  const actualMealCost =
    costs.adultsCost +
    costs.kidsCost +
    costs.filetMignonCost +
    costs.lobsterTailCost +
    costs.extraProteinsCost +
    costs.noodlesCost +
    costs.gyozaCost +
    costs.edamameCost;
  const minimumSpending = pricing.packages.basic.minimum;
  const usedMinimum = actualMealCost < minimumSpending;

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
          className="bg-white text-[#111827] rounded-xl shadow-md p-6 mb-4 border border-gray-200 min-h-[600px] relative overflow-hidden"
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

          {/* Step 1: Party size & user info */}
          {currentStep === 1 && (
            <Step1PartySize
              name={formData.name}
              email={formData.email}
              phone={formData.phone}
              zipcode={formData.zipcode}
              adults={editingAdults}
              kids={editingKids}
              onInputChange={(field, value) => dispatch({ type: "UPDATE_FIELD", field: field as keyof FormData, value })}
              onNumberChange={(field, value) => handleNumberChange(field as keyof FormData, value)}
              onNumberBlur={(field, value) => handleNumberBlur(field as keyof FormData, value)}
              onDecrement={(field) => handleDecrement(field as keyof FormData)}
              onIncrement={(field) => handleIncrement(field as keyof FormData)}
              onNext={goToNextStep}
              disableNext={
                !formData.name || !formData.email || !formData.phone || !formData.zipcode ||
                (formData.adults === 0 && formData.kids === 0) || formData.zipcode.length !== 5
              }
            />
          )}

          {/* Step 2: Optional appetizers */}
          {currentStep === 2 && (
            <Step2Appetizers
              gyoza={editingGyoza}
              edamame={editingEdamame}
              onNumberChange={(field, value) => handleNumberChange(field as keyof FormData, value)}
              onNumberBlur={(field, value) => handleNumberBlur(field as keyof FormData, value)}
              onDecrement={(field) => handleDecrement(field as keyof FormData)}
              onIncrement={(field) => handleIncrement(field as keyof FormData)}
              onNext={goToNextStep}
              onPrev={goToPreviousStep}
              onSkip={() => {
                handleNumberChange("gyoza", "0");
                handleNumberChange("edamame", "0");
                goToNextStep();
              }}
            />
          )}

          {/* Step 3: Optional premium main dishes */}
          {currentStep === 3 && (
            <Step3PremiumMains
              filetMignon={editingFiletMignon}
              lobsterTail={editingLobsterTail}
              onNumberChange={(field, value) => handleNumberChange(field as keyof FormData, value)}
              onNumberBlur={(field, value) => handleNumberBlur(field as keyof FormData, value)}
              onDecrement={(field) => handleDecrement(field as keyof FormData)}
              onIncrement={(field) => handleIncrement(field as keyof FormData)}
              onNext={goToNextStep}
              onPrev={goToPreviousStep}
              onSkip={() => {
                handleNumberChange("filetMignon", "0");
                handleNumberChange("lobsterTail", "0");
                goToNextStep();
              }}
            />
          )}

          {/* Step 4: Optional side dishes */}
          {currentStep === 4 && (
            <Step4Sides
              extraProteins={editingExtraProteins}
              noodles={editingNoodles}
              onNumberChange={(field, value) => handleNumberChange(field as keyof FormData, value)}
              onNumberBlur={(field, value) => handleNumberBlur(field as keyof FormData, value)}
              onDecrement={(field) => handleDecrement(field as keyof FormData)}
              onIncrement={(field) => handleIncrement(field as keyof FormData)}
              onNext={goToNextStep}
              onPrev={goToPreviousStep}
              onSkip={() => {
                handleNumberChange("extraProteins", "0");
                handleNumberChange("noodles", "0");
                goToNextStep();
              }}
            />
          )}

          {/* Step 5: Enter ZIP code for pricing */}
          {currentStep === 5 && (
            <Step5Estimate
              zipcode={formData.zipcode}
              adults={formData.adults}
              kids={formData.kids}
              filetMignon={formData.filetMignon}
              lobsterTail={formData.lobsterTail}
              extraProteins={formData.extraProteins}
              noodles={formData.noodles}
              gyoza={formData.gyoza}
              edamame={formData.edamame}
              travelFee={costs.travelFee}
              subtotal={costs.subtotal}
              total={costs.total}
              minimumSpending={pricing.packages.basic.minimum}
              usedMinimum={usedMinimum}
              onNext={goToNextStep}
              onPrev={goToPreviousStep}
              isEstimationValid={Boolean(isEstimationValid)}
              adultsUnit={pricing.packages.basic.perPerson}
              adultsCost={costs.adultsCost}
              kidsUnit={pricing.children.basic}
              kidsCost={costs.kidsCost}
              filetMignonUnit={5}
              filetMignonCost={costs.filetMignonCost}
              lobsterTailUnit={10}
              lobsterTailCost={costs.lobsterTailCost}
              extraProteinsUnit={10}
              extraProteinsCost={costs.extraProteinsCost}
              noodlesUnit={5}
              noodlesCost={costs.noodlesCost}
              gyozaUnit={10}
              gyozaCost={costs.gyozaCost}
              edamameUnit={8}
              edamameCost={costs.edamameCost}
            />
          )}

          {/* Step 6: Booking Form */}
          {currentStep === 6 && (
            <Step6BookingForm
              formData={formData}
              totalGuests={totalGuests}
              costs={costs}
              selectedDateTime={{
                date: selectedDateTime.date ? (typeof selectedDateTime.date === 'string' ? new Date(selectedDateTime.date) : selectedDateTime.date) : undefined,
                time: selectedDateTime.time,
                price: selectedDateTime.price,
                originalPrice: selectedDateTime.originalPrice,
              }}
              showTerms={Boolean(showTerms)}
              isOrderFormValid={isOrderFormValid}
              isSubmitting={isSubmitting}
              orderError={orderError}
              onInputChange={(field: string, value: string) => handleInputChange(field as keyof FormData, value)}
              onCheckboxChange={handleCheckboxChange}
              onShowTerms={() => setShowTerms(true)}
              onCloseTerms={() => setShowTerms(false)}
              onDateTimeSelect={handleDateTimeSelect}
              onSubmit={handleSubmit}
              onPrev={goToPreviousStep}
            />
          )}

          {/* Step 7: Deposit Payment */}
          {currentStep === 7 && (
            <Step7Deposit
              orderData={orderData}
              totalGuests={totalGuests}
              costs={costs}
              formData={formData}
              goToPreviousStep={goToPreviousStep}
            />
          )}
        </div>
      </Suspense>
    </>
  )
}
