"use client"

import type React from "react"

import { useState, useEffect, useCallback, useReducer, useMemo, Suspense } from "react"
import { pricing } from "@/config/pricing"
import dynamic from "next/dynamic"
import { useSearchParams } from "next/navigation"
import Step1PartySize from "@/components/estimation/Step1PartySize"
import Step2Appetizers from "@/components/estimation/Step2Appetizers"
import Step3PremiumMains from "@/components/estimation/Step3PremiumMains"
import Step4Sides from "@/components/estimation/Step4Sides"
import Step5Estimate from "@/components/estimation/Step5Estimate"
import Step6BookingForm from "@/components/estimation/Step6BookingForm"
import Step7Deposit from "@/components/estimation/Step7Deposit"
import { Button } from "@/components/ui/button"

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

// Keep the original FormData type
type FormData = {
  adults: number
  kids: number
  filetMignon: number
  lobsterTail: number
  premiumScallops: number
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
  estimatedGuests: string
  agreeToTerms: boolean
}

// Rename the new type to avoid conflicts
type BookingFormInputFields = {
  customerName: string
  customerEmail: string
  customerPhone: string
  customerAddress: string
  customerCity: string
  customerState: string
  customerZipcode: string
  customerEventDate: string
  customerEventTime: string
  customerMessage: string
  customerAgreeToTerms: boolean
  customerGyoza: number
  customerEdamame: number
}

type DateTimeSelection = {
  dateString: string | undefined
  time: string | undefined
  price: number
  originalPrice: number
}

// Fix duplicate name field in PremiumProtein type
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

// Update BookingData type to include all fields
type BookingData = {
  full_name: string
  email: string
  phone: string
  address: string
  zip_code: string
  city: string
  state: string
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
  gyoza?: number
  edamame?: number
}

// Update OrderData type to match the expected structure
type OrderData = {
  id: string
  full_name: string
  event_date: string
  event_time: string
  total_amount: number
  email: string
  phone: string
  estimatedGuests: string
  address: string
  city: string
  state: string
  zipcode: string
  message: string
  agreeToTerms: boolean
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
  premiumScallops: 0,
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
  estimatedGuests: "",
  agreeToTerms: false,
}

// 将成本计算逻辑抽离到自定义 hook
function useCostCalculation(formData: FormData) {
  return useMemo(() => {
    const adultPrice = pricing.packages.basic.perPerson
    const kidPrice = pricing.children.basic
    const filetUpcharge = 8
    const lobsterUpcharge = 12
    const scallopUpcharge = 6
    const extraProteinPrice = 10
    const noodlePrice = 5
    const gyozaPrice = 15
    const edamamePrice = 10

    const travelFee = calculateTravelFee(formData.zipcode)
    const adultsCost = formData.adults * adultPrice
    const kidsCost = formData.kids * kidPrice
    const filetMignonCost = formData.filetMignon * filetUpcharge
    const lobsterTailCost = formData.lobsterTail * lobsterUpcharge
    const premiumScallopsCost = formData.premiumScallops * scallopUpcharge
    const extraProteinsCost = formData.extraProteins * extraProteinPrice
    const noodlesCost = formData.noodles * noodlePrice
    const gyozaCost = formData.gyoza * gyozaPrice
    const edamameCost = formData.edamame * edamamePrice

    const mealCost =
      adultsCost +
      kidsCost +
      filetMignonCost +
      lobsterTailCost +
      premiumScallopsCost +
      extraProteinsCost +
      noodlesCost +
      gyozaCost +
      edamameCost
    const minimumSpending = pricing.packages.basic.minimum
    const meetsMinimum = mealCost >= minimumSpending
    const finalMealCost = Math.max(mealCost, minimumSpending)
    const applicableTravelFee = meetsMinimum ? travelFee : 0
    const subtotal = finalMealCost
    const total = subtotal + applicableTravelFee
    const suggestedTip = total * 0.2

    return {
      adultsCost: Number(adultsCost.toFixed(2)),
      kidsCost: Number(kidsCost.toFixed(2)),
      filetMignonCost: Number(filetMignonCost.toFixed(2)),
      lobsterTailCost: Number(lobsterTailCost.toFixed(2)),
      premiumScallopsCost: Number(premiumScallopsCost.toFixed(2)),
      extraProteinsCost: Number(extraProteinsCost.toFixed(2)),
      noodlesCost: Number(noodlesCost.toFixed(2)),
      gyozaCost: Number(gyozaCost.toFixed(2)),
      edamameCost: Number(edamameCost.toFixed(2)),
      travelFee: Number(applicableTravelFee.toFixed(2)),
      subtotal: Number(subtotal.toFixed(2)),
      suggestedTip: Number(suggestedTip.toFixed(2)),
      total: Number(total.toFixed(2)),
    }
  }, [
    formData.adults,
    formData.kids,
    formData.filetMignon,
    formData.lobsterTail,
    formData.premiumScallops,
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

  return regions[zipPrefix] || 50
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

// Add localStorage key constant
const STORAGE_KEY = "hibachi_estimation_form_data"

// Add type for saved form data
type SavedFormData = {
  formData: FormData
  timestamp: number
  currentStep: number
}

const ORDER_DATA_KEY = "hibachi_estimation_order_data"

export default function EstimationPage() {
  const searchParams = useSearchParams()
  const source = searchParams.get("source")
  const isFromBooking = source === "booking"
  const pageTitle = "Private Hibachi Party Cost Estimation"
  const pageDescription = "Use our calculator to get an instant estimate for your private hibachi experience"

  // 添加状态来控制弹窗的显示
  const [showPopup, setShowPopup] = useState(true)

  // 在组件挂载时预加载其他组件
  useEffect(() => {
    preloadComponents()
  }, [])

  return (
    <div className="container mx-auto px-4 py-12 pt-24 mt-16 min-h-[800px]">
      {/* 弹窗组件 */}
      {showPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Important Information</h3>
            <p className="text-gray-600 mb-6">
              Estimate only. Final pricing will be confirmed by our team. We'll reach out shortly with your official
              quote.
            </p>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setShowPopup(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

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
  const [orderData, setOrderDataState] = useState<OrderData | null>(null)
  const [showRestorePrompt, setShowRestorePrompt] = useState(false)
  const [savedData, setSavedData] = useState<SavedFormData | null>(null)

  // 使用 reducer 管理表单状态
  const [formData, dispatch] = useReducer(formReducer, initialState)

  // 为每个数字输入框添加独立的 editingValue 局部 state
  const [editingAdults, setEditingAdults] = useState<string>(String(formData.adults))
  const [editingKids, setEditingKids] = useState<string>(String(formData.kids))
  const [editingGyoza, setEditingGyoza] = useState<string>(String(formData.gyoza))
  const [editingEdamame, setEditingEdamame] = useState<string>(String(formData.edamame))
  const [editingFiletMignon, setEditingFiletMignon] = useState<string>(String(formData.filetMignon))
  const [editingLobsterTail, setEditingLobsterTail] = useState<string>(String(formData.lobsterTail))
  const [editingPremiumScallops, setEditingPremiumScallops] = useState<string>(String(formData.premiumScallops))
  const [editingExtraProteins, setEditingExtraProteins] = useState<string>(String(formData.extraProteins))
  const [editingNoodles, setEditingNoodles] = useState<string>(String(formData.noodles))

  // 同步 formData 变化时也同步 editingValue
  useEffect(() => {
    setEditingAdults(String(formData.adults))
  }, [formData.adults])
  useEffect(() => {
    setEditingKids(String(formData.kids))
  }, [formData.kids])
  useEffect(() => {
    setEditingGyoza(String(formData.gyoza))
  }, [formData.gyoza])
  useEffect(() => {
    setEditingEdamame(String(formData.edamame))
  }, [formData.edamame])
  useEffect(() => {
    setEditingFiletMignon(String(formData.filetMignon))
  }, [formData.filetMignon])
  useEffect(() => {
    setEditingLobsterTail(String(formData.lobsterTail))
  }, [formData.lobsterTail])
  useEffect(() => {
    setEditingPremiumScallops(String(formData.premiumScallops))
  }, [formData.premiumScallops])
  useEffect(() => {
    setEditingExtraProteins(String(formData.extraProteins))
  }, [formData.extraProteins])
  useEffect(() => {
    setEditingNoodles(String(formData.noodles))
  }, [formData.noodles])

  // 使用自定义 hook 计算成本
  const costs = useCostCalculation(formData)

  // 其他状态
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [orderError, setOrderError] = useState("")
  const [selectedDateTime, setSelectedDateTime] = useState<DateTimeSelection>({
    dateString: undefined,
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

  // Add effect to check for saved data on mount
  useEffect(() => {
    const savedFormData = localStorage.getItem(STORAGE_KEY)
    if (savedFormData) {
      try {
        const parsed = JSON.parse(savedFormData) as SavedFormData
        // Only show restore prompt if the saved data is less than 24 hours old
        if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
          setSavedData(parsed)
          setShowRestorePrompt(true)
        } else {
          // Clear expired data
          localStorage.removeItem(STORAGE_KEY)
        }
      } catch (e) {
        console.error("Error parsing saved form data:", e)
        localStorage.removeItem(STORAGE_KEY)
      }
    }
  }, [])

  // Add effect to save form data when it changes
  useEffect(() => {
    // Only save if we have some meaningful data (at least zipcode or guests)
    if (formData.zipcode || formData.adults > 0 || formData.kids > 0) {
      const dataToSave: SavedFormData = {
        formData,
        timestamp: Date.now(),
        currentStep,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave))
    }
  }, [formData, currentStep])

  // Update handleRestoreData to properly restore date and time with price information
  const handleRestoreData = useCallback(() => {
    if (savedData) {
      // 直接使用保存的完整表单数据
      const savedFormData = savedData.formData

      // 确保所有字段都被正确恢复
      const fieldsToRestore: (keyof FormData)[] = [
        "adults",
        "kids",
        "filetMignon",
        "lobsterTail",
        "extraProteins",
        "noodles",
        "gyoza",
        "edamame",
        "zipcode",
        "name",
        "email",
        "phone",
        "address",
        "city",
        "state",
        "eventDate",
        "eventTime",
        "message",
        "agreeToTerms",
      ]

      // 逐个恢复每个字段
      fieldsToRestore.forEach((field) => {
        if (savedFormData[field] !== undefined) {
          dispatch({
            type: "UPDATE_FIELD",
            field,
            value: savedFormData[field],
          })
        }
      })

      // 恢复步骤
      setCurrentStep(savedData.currentStep)

      // 同步编辑状态的值
      setEditingAdults(String(savedFormData.adults))
      setEditingKids(String(savedFormData.kids))
      setEditingGyoza(String(savedFormData.gyoza))
      setEditingEdamame(String(savedFormData.edamame))
      setEditingFiletMignon(String(savedFormData.filetMignon))
      setEditingLobsterTail(String(savedFormData.lobsterTail))
      setEditingExtraProteins(String(savedFormData.extraProteins))
      setEditingNoodles(String(savedFormData.noodles))

      // 如果有日期时间数据，重新获取价格信息
      if (savedFormData.eventDate && savedFormData.eventTime && savedFormData.zipcode) {
        // 获取价格信息
        fetch(
          `/api/calendar/manual?date=${savedFormData.eventDate}&address=${savedFormData.zipcode}&basePrice=${costs.subtotal}`,
        )
          .then((res) => res.json())
          .then((data) => {
            if (data.slots) {
              // 找到对应时间段的slot
              const slot = data.slots.find((s: any) => s.time === savedFormData.eventTime)
              if (slot) {
                // 使用找到的价格信息更新selectedDateTime
                setSelectedDateTime({
                  dateString: savedFormData.eventDate,
                  time: savedFormData.eventTime,
                  price: slot.price,
                  originalPrice: costs.subtotal,
                })
              } else {
                // 如果找不到对应的slot，使用基础价格
                setSelectedDateTime({
                  dateString: savedFormData.eventDate,
                  time: savedFormData.eventTime,
                  price: costs.subtotal,
                  originalPrice: costs.subtotal,
                })
              }
            }
          })
          .catch((error) => {
            // 如果获取价格失败，使用基础价格
            setSelectedDateTime({
              dateString: savedFormData.eventDate,
              time: savedFormData.eventTime,
              price: costs.subtotal,
              originalPrice: costs.subtotal,
            })
          })
      }

      // 清除保存的数据
      localStorage.removeItem(STORAGE_KEY)
      setSavedData(null)
      setShowRestorePrompt(false)
    }
  }, [savedData, costs.subtotal])

  // Add function to clear saved data
  const handleClearSavedData = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setSavedData(null)
    setShowRestorePrompt(false)
  }, [])

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
    // 如果当前在第7步，且 orderData 存在，返回上一步时清空 orderData 并跳转到第6步
    if (currentStep === 7 && orderData) {
      setOrderData(null)
      setCurrentStep(6)
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
      return
    }
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
  }, [currentStep, orderData])

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
    let sanitized = value.replace(/[^\d]/g, "")
    sanitized = sanitized.replace(/^0+(\d+)$/, "$1")
    // 限制最大值为99
    const numValue = sanitized === "" ? 0 : Math.max(0, Math.min(99, Number.parseInt(sanitized, 10)))
    if (field === "adults") setEditingAdults(sanitized)
    if (field === "kids") setEditingKids(sanitized)
    if (field === "gyoza") setEditingGyoza(sanitized)
    if (field === "edamame") setEditingEdamame(sanitized)
    if (field === "filetMignon") setEditingFiletMignon(sanitized)
    if (field === "lobsterTail") setEditingLobsterTail(sanitized)
    if (field === "extraProteins") setEditingExtraProteins(sanitized)
    if (field === "noodles") setEditingNoodles(sanitized)
    dispatch({ type: "UPDATE_FIELD", field, value: numValue })
  }, [])

  // 新增 handleNumberBlur
  const handleNumberBlur = useCallback((field: keyof FormData, value: string) => {
    const numValue = Math.max(0, Math.min(99, Number.parseInt(value, 10) || 0))
    if (value === "") {
      dispatch({ type: "UPDATE_FIELD", field, value: 0 })
      // 失焦后显示0
      if (field === "adults") setEditingAdults("0")
      if (field === "kids") setEditingKids("0")
      if (field === "gyoza") setEditingGyoza("0")
      if (field === "edamame") setEditingEdamame("0")
      if (field === "filetMignon") setEditingFiletMignon("0")
      if (field === "lobsterTail") setEditingLobsterTail("0")
      if (field === "extraProteins") setEditingExtraProteins("0")
      if (field === "noodles") setEditingNoodles("0")
      return
    }
    // 失焦时同步到 formData，最大99
    dispatch({ type: "UPDATE_FIELD", field, value: numValue })
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

  // 修改 handleDateTimeSelect 函数，接收日期字符串
  const handleDateTimeSelect = useCallback(
    (dateString: string | undefined, time: string | undefined, price: number, originalPrice: number) => {
      console.log("🟠 Parent: handleDateTimeSelect called with:", { dateString, time, price, originalPrice })

      if (!dateString || !time) {
        setSelectedDateTime({
          dateString: dateString,
          time: time,
          price: 0,
          originalPrice: 0,
        })
        return
      }

      // 更新 formData 中的日期和时间
      dispatch({ type: "SET_DATE_TIME", date: dateString, time })

      setSelectedDateTime({
        dateString,
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
          formData.estimatedGuests &&
          selectedDateTime.dateString &&
          selectedDateTime.time &&
          formData.agreeToTerms,
      ),
    [
      formData.name,
      formData.email,
      formData.phone,
      formData.estimatedGuests,
      formData.address,
      formData.agreeToTerms,
      selectedDateTime.dateString,
      selectedDateTime.time,
    ],
  )

  // 添加详细的验证错误信息
  const getValidationErrors = useMemo(() => {
    const errors: string[] = []
    
    if (!formData.name) errors.push("Full Name is required")
    if (!formData.email) errors.push("Email Address is required")
    if (!formData.phone) errors.push("Phone Number is required")
    if (!formData.address) errors.push("Full Address is required")
    if (!formData.estimatedGuests) errors.push("Estimated Guest Count is required")
    if (!selectedDateTime.dateString) errors.push("Event Date is required")
    if (!selectedDateTime.time) errors.push("Event Time is required")
    if (!formData.agreeToTerms) errors.push("You must agree to Terms & Conditions")
    
    return errors
  }, [
    formData.name,
    formData.email,
    formData.phone,
    formData.address,
    formData.estimatedGuests,
    selectedDateTime.dateString,
    selectedDateTime.time,
    formData.agreeToTerms,
  ])

  /**
   * 100 % 前端版 handleSubmit
   * — 不再调用 createBooking / booking API —
   * 返回 { success, orderId?, error? } 供调用方处理
   */
  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>,
  ): Promise<{ success: boolean; orderId?: string; error?: string }> => {
    e.preventDefault()
    setIsSubmitting(true)
    setOrderError("")

    /* ---------- 1. 表单校验 ---------- */
    const numericFields = [
      formData.adults,
      formData.kids,
      formData.filetMignon,
      formData.lobsterTail,
      formData.extraProteins,
      formData.noodles,
      formData.gyoza,
      formData.edamame,
    ]
    if (numericFields.some((v) => v > 99)) {
      const msg = "所有数字输入不能超过99"
      setOrderError(msg)
      setIsSubmitting(false)
      return { success: false, error: msg }
    }

    try {
      /* ---------- 2. 生成订单 ID & 结构化数据 ---------- */
      const newOrderId = crypto.randomUUID()

      const orderAnalytics = {
        metadata: {
          source: "realhibachi",
          platform: "web",
          timestamp: new Date().toISOString(),
          version: "1.0",
          event_type: "order_confirmation",
        },
        customer: {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          estimatedGuests: formData.estimatedGuests,
          address: {
            street: formData.address,
            city: formData.city,
            state: formData.state,
            zipcode: formData.zipcode,
          },
          message: formData.message,
        },
        order: {
          order_id: newOrderId,
          guests: {
            adults: formData.adults,
            kids: formData.kids,
            total: totalGuests,
          },
          items: {
            appetizers: {
              gyoza: {
                quantity: formData.gyoza,
                unit_price: 10,
                total: costs.gyozaCost,
              },
              edamame: {
                quantity: formData.edamame,
                unit_price: 8,
                total: costs.edamameCost,
              },
            },
            premium_mains: {
              filet_mignon: {
                quantity: formData.filetMignon,
                unit_price: 8,
                total: costs.filetMignonCost,
              },
              lobster_tail: {
                quantity: formData.lobsterTail,
                unit_price: 12,
                total: costs.lobsterTailCost,
              },
              premium_scallops: {
                quantity: formData.premiumScallops,
                unit_price: 6,
                total: costs.premiumScallopsCost,
              },
            },
            sides: {
              extra_proteins: {
                quantity: formData.extraProteins,
                unit_price: 10,
                total: costs.extraProteinsCost,
              },
              noodles: {
                quantity: formData.noodles,
                unit_price: 5,
                total: costs.noodlesCost,
              },
            },
          },
          pricing: {
            base_costs: {
              adults: {
                unit_price: pricing.packages.basic.perPerson,
                quantity: formData.adults,
                total: costs.adultsCost,
              },
              kids: {
                unit_price: pricing.children.basic,
                quantity: formData.kids,
                total: costs.kidsCost,
              },
            },
            fees: {
              travel_fee: costs.travelFee,
            },
            subtotal: costs.subtotal,
            total: costs.total,
          },
          scheduling: {
            selected_date: selectedDateTime.dateString,
            selected_time: selectedDateTime.time,
            original_price: selectedDateTime.originalPrice,
            final_price: selectedDateTime.price,
            discount: selectedDateTime.originalPrice - selectedDateTime.price,
          },
          notes: formData.message || "",
          terms_accepted: formData.agreeToTerms,
          status: {
            stage: "deposit_pending",
            timestamp: new Date().toISOString(),
          },
        },
      }

      /* ---------- 3. （可选）发送订单确认邮件 ---------- */
      await fetch("/api/notify-lead", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-RealHibachi-Tag": "order_confirmation",
        },
        body: JSON.stringify(orderAnalytics),
      })

      /* ---------- 4. 更新本地状态 ---------- */
      setOrderData({
        id: newOrderId,
        full_name: formData.name,
        email: formData.email,
        phone: formData.phone,
        estimatedGuests: formData.estimatedGuests,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        zipcode: formData.zipcode,
        event_date: selectedDateTime.dateString || formData.eventDate,
        event_time: selectedDateTime.time || formData.eventTime,
        total_amount: costs.total,
        message: formData.message,
        agreeToTerms: formData.agreeToTerms,
      })

      if (selectedDateTime.dateString && selectedDateTime.time) {
        dispatch({
          type: "SET_DATE_TIME",
          date: selectedDateTime.dateString,
          time: selectedDateTime.time,
        })
      }

      /* ---------- 5. 成功返回 ---------- */
      return { success: true, orderId: newOrderId }
    } catch (err) {
      console.error("Error submitting order:", err)
      const msg = "提交订单时发生错误，请重试"
      setOrderError(msg)
      return { success: false, error: msg }
    } finally {
      setIsSubmitting(false)
    }
  }

  // 新增：orderData 变化时自动进入第7步
  useEffect(() => {
    if (orderData && currentStep !== 7) {
      setCurrentStep(7)
    }
  }, [orderData, currentStep])

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
    costs.premiumScallopsCost +
    costs.extraProteinsCost +
    costs.noodlesCost +
    costs.gyozaCost +
    costs.edamameCost
  const minimumSpending = pricing.packages.basic.minimum
  const usedMinimum = actualMealCost < minimumSpending

  // 页面初始化时恢复 orderData
  useEffect(() => {
    const savedOrderData = localStorage.getItem(ORDER_DATA_KEY)
    if (savedOrderData) {
      try {
        setOrderDataState(JSON.parse(savedOrderData))
      } catch (e) {
        localStorage.removeItem(ORDER_DATA_KEY)
      }
    }
  }, [])

  // 封装 setOrderData，每次都同步到 localStorage
  const setOrderData = (data: OrderData | null) => {
    setOrderDataState(data)
    if (data) {
      localStorage.setItem(ORDER_DATA_KEY, JSON.stringify(data))
    } else {
      localStorage.removeItem(ORDER_DATA_KEY)
    }
  }

  // 新增：重置所有状态的方法
  const handleStartNew = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(ORDER_DATA_KEY)
    dispatch({ type: "RESET_FORM" })
    setOrderData(null)
    setCurrentStep(1)
    setSelectedDateTime({
      dateString: undefined,
      time: undefined,
      price: 0,
      originalPrice: 0,
    })
    setEditingAdults("0")
    setEditingKids("0")
    setEditingGyoza("0")
    setEditingEdamame("0")
    setEditingFiletMignon("0")
    setEditingLobsterTail("0")
    setEditingExtraProteins("0")
    setEditingNoodles("0")
    setOrderError("")
    setIsSubmitting(false)
    setShowRestorePrompt(false)
  }, [])

  // 新增：currentStep 变为 7 时自动滚动到表单顶部
  useEffect(() => {
    if (currentStep === 7) {
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
    }
  }, [currentStep])

  // 新增：Step1 下一步时先发邮件
  const handleStep1Next = async () => {
    await fetch("/api/notify-lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        zipcode: formData.zipcode,
        adults: formData.adults,
        kids: formData.kids,
      }),
    })
    goToNextStep()
  }

  // 新增：Step4 下一步时发邮件，包含所有用户选择
  const handleStep4Next = async () => {
    // 构建结构化的订单数据
    const orderAnalytics = {
      // 元数据
      metadata: {
        source: "realhibachi",
        platform: "web",
        timestamp: new Date().toISOString(),
        version: "1.0",
        event_type: "quote_request",
      },
      // 客户信息
      customer: {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        address: {
          street: formData.address,
          city: formData.city,
          state: formData.state,
          zipcode: formData.zipcode,
        },
      },
      // 订单详情
      order: {
        // 人数信息
        guests: {
          adults: formData.adults,
          kids: formData.kids,
          total: totalGuests,
        },
        // 菜品选择
        items: {
          appetizers: {
            gyoza: {
              quantity: formData.gyoza,
              unit_price: 10,
              total: costs.gyozaCost,
            },
            edamame: {
              quantity: formData.edamame,
              unit_price: 8,
              total: costs.edamameCost,
            },
          },
          premium_mains: {
            filet_mignon: {
              quantity: formData.filetMignon,
              unit_price: 8,
              total: costs.filetMignonCost,
            },
            lobster_tail: {
              quantity: formData.lobsterTail,
              unit_price: 12,
              total: costs.lobsterTailCost,
            },
            premium_scallops: {
              quantity: formData.premiumScallops,
              unit_price: 6,
              total: costs.premiumScallopsCost,
            },
          },
          sides: {
            extra_proteins: {
              quantity: formData.extraProteins,
              unit_price: 10,
              total: costs.extraProteinsCost,
            },
            noodles: {
              quantity: formData.noodles,
              unit_price: 5,
              total: costs.noodlesCost,
            },
          },
        },
        // 价格信息
        pricing: {
          base_costs: {
            adults: {
              unit_price: pricing.packages.basic.perPerson,
              quantity: formData.adults,
              total: costs.adultsCost,
            },
            kids: {
              unit_price: pricing.children.basic,
              quantity: formData.kids,
              total: costs.kidsCost,
            },
          },
          fees: {
            travel_fee: costs.travelFee,
          },
          subtotal: costs.subtotal,
          total: costs.total,
        },
        // 时间选择
        scheduling: {
          selected_date: selectedDateTime.dateString,
          selected_time: selectedDateTime.time,
          original_price: selectedDateTime.originalPrice,
          final_price: selectedDateTime.price,
          discount: selectedDateTime.originalPrice - selectedDateTime.price,
        },
        // 其他信息
        notes: formData.message || "",
        terms_accepted: formData.agreeToTerms,
      },
    }

    await fetch("/api/notify-lead", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-RealHibachi-Tag": "quote_request", // 添加标签头
      },
      body: JSON.stringify(orderAnalytics),
    })
    goToNextStep()
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Add restore prompt dialog */}
      {showRestorePrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Continue Your Estimation?</h3>
            <p className="text-gray-600 mb-6">
              We found your previous estimation that wasn't completed. Would you like to continue where you left off?
            </p>
            <div className="flex justify-end space-x-4">
              <Button variant="outline" onClick={handleStartNew}>
                Start New
              </Button>
              <Button onClick={handleRestoreData}>Continue Previous</Button>
            </div>
          </div>
        </div>
      )}

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
              onInputChange={(field, value) =>
                dispatch({ type: "UPDATE_FIELD", field: field as keyof FormData, value })
              }
              onNumberChange={(field, value) => handleNumberChange(field as keyof FormData, value)}
              onNumberBlur={(field, value) => handleNumberBlur(field as keyof FormData, value)}
              onDecrement={(field) => handleDecrement(field as keyof FormData)}
              onIncrement={(field) => handleIncrement(field as keyof FormData)}
              onNext={goToNextStep}
              disableNext={
                !formData.name ||
                !formData.email ||
                !formData.phone ||
                !formData.zipcode ||
                (formData.adults === 0 && formData.kids === 0) ||
                formData.zipcode.length !== 5
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
                handleNumberChange("gyoza", "0")
                handleNumberChange("edamame", "0")
                goToNextStep()
              }}
            />
          )}

          {/* Step 3: Optional premium main dishes */}
          {currentStep === 3 && (
            <Step3PremiumMains
              filetMignon={editingFiletMignon}
              lobsterTail={editingLobsterTail}
              premiumScallops={editingPremiumScallops}
              onNumberChange={(field, value) => handleNumberChange(field as keyof FormData, value)}
              onNumberBlur={(field, value) => handleNumberBlur(field as keyof FormData, value)}
              onDecrement={(field) => handleDecrement(field as keyof FormData)}
              onIncrement={(field) => handleIncrement(field as keyof FormData)}
              onNext={goToNextStep}
              onPrev={goToPreviousStep}
              onSkip={() => {
                handleNumberChange("filetMignon", "0")
                handleNumberChange("premiumScallops", "0")
                handleNumberChange("lobsterTail", "0")
                goToNextStep()
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
              onNext={handleStep4Next}
              onPrev={goToPreviousStep}
              onSkip={() => {
                handleNumberChange("extraProteins", "0")
                handleNumberChange("noodles", "0")
                handleStep4Next()
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
              premiumScallops={formData.premiumScallops}
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
              filetMignonUnit={8}
              filetMignonCost={costs.filetMignonCost}
              lobsterTailUnit={12}
              lobsterTailCost={costs.lobsterTailCost}
              premiumScallopsUnit={6}
              premiumScallopsCost={costs.premiumScallopsCost}
              extraProteinsUnit={10}
              extraProteinsCost={costs.extraProteinsCost}
              noodlesUnit={5}
              noodlesCost={costs.noodlesCost}
              gyozaUnit={15}
              gyozaCost={costs.gyozaCost}
              edamameUnit={10}
              edamameCost={costs.edamameCost}
            />
          )}

          {/* Step 6: Booking Form */}
          {currentStep === 6 && (
            <Step6BookingForm
              formData={{
                ...formData,
                adults: formData.adults,
                kids: formData.kids,
                filetMignon: formData.filetMignon,
                lobsterTail: formData.lobsterTail,
                premiumScallops: formData.premiumScallops,
                extraProteins: formData.extraProteins,
                noodles: formData.noodles,
                gyoza: formData.gyoza,
                edamame: formData.edamame,
              }}
              totalGuests={totalGuests}
              costs={costs}
              selectedDateTime={selectedDateTime}
              showTerms={Boolean(showTerms)}
              isOrderFormValid={isOrderFormValid}
              validationErrors={getValidationErrors}
              isSubmitting={isSubmitting}
              orderError={orderError}
              onInputChange={(field: string, value: string) => handleInputChange(field as keyof FormData, value)}
              onCheckboxChange={handleCheckboxChange}
              onShowTerms={() => setShowTerms(true)}
              onCloseTerms={() => setShowTerms(false)}
              onDateTimeSelect={handleDateTimeSelect}
              onSubmit={handleSubmit}
              onPrev={goToPreviousStep}
              onNext={goToNextStep}
            />
          )}

          {/* Step 7: Deposit Payment */}
          {currentStep === 7 && !orderData && (
            <div className="text-center py-12 text-lg text-gray-500">Loading your booking summary...</div>
          )}
          {currentStep === 7 && orderData && (
            <Step7Deposit
              orderData={orderData}
              totalGuests={totalGuests}
              costs={costs}
              formData={formData}
              goToPreviousStep={goToPreviousStep}
              onStartNew={handleStartNew}
            />
          )}
        </div>
      </Suspense>
    </div>
  )
}
