"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Clock } from "lucide-react"
import { format, addMonths, subMonths, isBefore, startOfMonth } from "date-fns"
import { cn } from "@/lib/utils"

interface DynamicPricingCalendarProps {
  onSelectDateTime: (
    dateString: string | undefined,
    time: string | undefined,
    price: number,
    originalPrice: number,
  ) => void
  packageType: string
  headcount: number
  zipcode: string
  basePrice: number
  selectedDateTime?: {
    dateString: string | undefined
    time: string | undefined
    price: number
    originalPrice: number
  }
}

interface TimeSlot {
  time: string
  price: number
  available: boolean
}

function getMonthDates(year: number, month: number, today: Date) {
  const days: Date[] = []
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth()
  const startDay = isCurrentMonth ? today.getDate() : 1
  const lastDay = new Date(year, month + 1, 0).getDate()
  for (let d = startDay; d <= lastDay; d++) {
    // 创建本地时区的日期，设置为当天中午，避免夏令时问题
    const localDate = new Date(year, month, d, 12, 0, 0, 0)
    days.push(localDate)
  }
  return days
}

export default function DynamicPricingCalendar({
  onSelectDateTime,
  packageType,
  headcount,
  zipcode,
  basePrice,
  selectedDateTime,
}: DynamicPricingCalendarProps) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [selectedDate, setSelectedDate] = useState<Date>()
  const [selectedDateString, setSelectedDateString] = useState<string>()
  const [selectedTime, setSelectedTime] = useState<string>()
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [loadingTimes, setLoadingTimes] = useState(false)
  const [dateConfirmed, setDateConfirmed] = useState(false)
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())

  // 当外部传入选中的日期时间时，恢复状态
  useEffect(() => {
    if (selectedDateTime?.dateString && selectedDateTime?.time) {
      // 解析日期字符串并设置选中的日期
      const dateObj = new Date(selectedDateTime.dateString + 'T12:00:00')
      setSelectedDate(dateObj)
      setSelectedDateString(selectedDateTime.dateString)
      setSelectedTime(selectedDateTime.time)
      setDateConfirmed(true)
      
      // 设置日历显示到正确的月份
      setCurrentYear(dateObj.getFullYear())
      setCurrentMonth(dateObj.getMonth())
      
      console.log("🔄 Calendar: Restored selected date:", selectedDateTime.dateString, "time:", selectedDateTime.time)
    }
  }, [selectedDateTime])

  // 格式化日期为字符串
  const formatDateString = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
  }

  // 获取时间段和价格信息（新版）
  useEffect(() => {
    // ✅ 在使用 selectedDate 之前都加判断
    if (!selectedDate || !selectedDateString) return

    // 只有在从外部恢复状态时才不清空时间，正常选择新日期时才清空
    if (!selectedDateTime?.dateString || selectedDateTime.dateString !== selectedDateString) {
      /* 3-1）换日期时先清空旧 Time，防止"旧时间+新日期" */
      setSelectedTime(undefined)
      /* 3-3）让父组件立即知道选了什么日期（时间先留空） */
      console.log("🔵 Calendar: Selected date string:", selectedDateString)
      onSelectDateTime(selectedDateString, undefined, basePrice, basePrice)
    }

    /* 3-4）拉取当天可用时间段（加入 AbortController，避免竞态） */
    const controller = new AbortController()
    const fetchSlots = async () => {
      setLoadingTimes(true)
      try {
        // 用本地时区格式化，避免时区-1 天
        const dateStr =
          selectedDate.getFullYear() +
          "-" +
          String(selectedDate.getMonth() + 1).padStart(2, "0") +
          "-" +
          String(selectedDate.getDate()).padStart(2, "0")
        console.log("🔵 Calendar: Fetching slots for date string:", dateStr)
        const res = await fetch(`/api/calendar/manual?date=${dateStr}&address=${zipcode}&basePrice=${basePrice}`, {
          signal: controller.signal,
        })
        const data = await res.json()
        // 把返回值转成你组件的 TimeSlot 结构
        const slots =
          data?.slots?.map((s: any) => ({
            time: s.time,
            price: s.price,
            available: true,
          })) ?? []
        setTimeSlots(slots)
      } catch (err: any) {
        // 如果是用户快速切换日期触发的中断，不必报错
        if (err.name !== "AbortError") {
          console.error("Error fetching time slots:", err)
          setTimeSlots([])
        }
      } finally {
        setLoadingTimes(false)
      }
    }

    fetchSlots()

    /* 3-5）依赖变动或组件卸载时，中断旧请求 */
    return () => controller.abort()
  }, [selectedDate, selectedDateString, zipcode, basePrice, onSelectDateTime])

  // 确认按钮逻辑
  const handleConfirm = () => {
    setDateConfirmed(true)
    if (selectedDateString && selectedTime) {
      // 找到选中时间对应的价格
      const selectedSlot = timeSlots.find(slot => slot.time === selectedTime)
      const price = selectedSlot?.price || basePrice
      console.log("🟣 Calendar: Confirming selection - Date:", selectedDateString, "Time:", selectedTime, "Price:", price)
      onSelectDateTime(selectedDateString, selectedTime, price, basePrice)
    }
  }

  // 生成当前月的未来日期
  const monthDates = getMonthDates(currentYear, currentMonth, today)
  // 按每行7个分组
  const rows: Date[][] = []
  for (let i = 0; i < monthDates.length; i += 7) {
    rows.push(monthDates.slice(i, i + 7))
  }

  // 上一个月和下一个月的 Date
  const thisMonthDate = new Date(currentYear, currentMonth, 1)
  const prevMonthDate = subMonths(thisMonthDate, 1)
  const nextMonthDate = addMonths(thisMonthDate, 1)
  // 判断上一个月是否为今天所在月之前
  const canGoPrev = !isBefore(startOfMonth(prevMonthDate), startOfMonth(today))

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 shadow-md p-6 bg-white max-w-xs mx-auto">
        <label className="block text-sm font-medium mb-2">Select Date</label>
        {/* 月份导航栏：按钮-标题-按钮 同一行 */}
        <div className="flex items-center mb-2">
          {/* 左侧按钮：如果上一个月是今天所在月之前则隐藏 */}
          {canGoPrev ? (
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center px-3 py-1 text-base font-semibold"
              onClick={() => {
                if (canGoPrev) {
                  if (currentMonth === 0) {
                    setCurrentYear(currentYear - 1)
                    setCurrentMonth(11)
                  } else {
                    setCurrentMonth(currentMonth - 1)
                  }
                }
              }}
              aria-label="Previous month"
            >
              <span className="mr-1">←</span>
              {format(prevMonthDate, "MMMM")}
            </Button>
          ) : (
            <div className="w-[90px]" />
          )}
          {/* 月份标题 居中 */}
          <span className="flex-1 text-center text-lg font-bold">{format(thisMonthDate, "MMMM yyyy")}</span>
          {/* 右侧按钮 */}
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center px-3 py-1 text-base font-semibold"
            onClick={() => {
              if (currentMonth === 11) {
                setCurrentYear(currentYear + 1)
                setCurrentMonth(0)
              } else {
                setCurrentMonth(currentMonth + 1)
              }
            }}
            aria-label="Next month"
          >
            {format(nextMonthDate, "MMMM")}
            <span className="ml-1">→</span>
          </Button>
        </div>
        {/* 日期网格 */}
        <div className="space-y-2">
          {rows.map((row, rowIdx) => (
            <div key={rowIdx} className="flex gap-2 justify-center">
              {row.map((date) => {
                const dateString = formatDateString(date)
                const isSelected = selectedDateString === dateString
                return (
                  <button
                    key={date.toISOString()}
                    type="button"
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center font-medium transition-all border",
                      isSelected
                        ? "bg-green-600 text-white border-green-700 shadow-lg ring-2 ring-green-700"
                        : "bg-green-50 text-green-900 border-green-200 hover:bg-green-100 hover:ring-2 hover:ring-green-400",
                    )}
                    style={{ fontWeight: isSelected ? 700 : 500 }}
                    onClick={() => {
                      const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0)
                      const formattedDateString = formatDateString(localDate)
                      console.log("🔵 Calendar: Creating date string:", formattedDateString)
                      setSelectedDate(localDate)
                      setSelectedDateString(formattedDateString)
                    }}
                  >
                    {date.getDate()}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
        {/* 已选择日期显示 */}
        <div className="text-center my-2 text-lg font-semibold text-green-700 min-h-[32px]">
          {selectedDateString ? (
            <span key={selectedDateString} className={`inline-block animate-bounceOnce`}>
              Selected: {selectedDateString}
            </span>
          ) : (
            <span className="inline-block">Select a date</span>
          )}
        </div>
      </div>
      {/* 时间卡片渐入动画 */}
      <div
        className={`transition-all duration-500 min-h-[120px] ${selectedDate ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-4 pointer-events-none"}`}
      >
        <div>
          <label className="block text-sm font-medium mb-2">Select Time</label>
          <p className="text-sm text-gray-600 mb-3">
            Please choose when you'd like your party to start and be seated. We'll arrive 20-40 minutes early to set up
            everything for you.
          </p>
          {!loadingTimes && timeSlots.length > 0 && timeSlots.every((slot) => slot.price === basePrice) ? (
            <select
              className="w-full border rounded-lg p-3 text-lg"
              value={selectedTime || ""}
              onChange={(e) => {
                const selectedTimeValue = e.target.value
                setSelectedTime(selectedTimeValue)
                if (selectedDateString && selectedTimeValue) {
                  // 找到对应的时间槽价格
                  const selectedSlot = timeSlots.find(slot => slot.time === selectedTimeValue)
                  const price = selectedSlot?.price || basePrice
                  console.log("🟡 Calendar: Dropdown time selected, passing date string:", selectedDateString)
                  console.log("🟡 Calendar: Time selected:", selectedTimeValue, "Price:", price)
                  onSelectDateTime(selectedDateString, selectedTimeValue, price, basePrice)
                }
              }}
            >
              <option value="" disabled>
                Select a time
              </option>
              {timeSlots.map((slot) => (
                <option key={slot.time} value={slot.time}>
                  {slot.time}
                </option>
              ))}
            </select>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {loadingTimes && (
                <div className="col-span-3 text-center py-4 text-muted-foreground">Loading time slots…</div>
              )}
              {!loadingTimes && timeSlots.length === 0 && (
                <div className="col-span-3 text-center py-4 text-muted-foreground">
                  {selectedDate ? "No available time slots for this date" : "Please select a date first"}
                </div>
              )}
              {timeSlots.map((slot) => {
                const isDiscount = slot.price < basePrice
                const discountAmount = Math.round(basePrice - slot.price)
                return (
                  <button
                    key={slot.time}
                    type="button"
                    className={cn(
                      "border rounded-lg p-4 flex flex-col items-center transition-all shadow-sm",
                      selectedTime === slot.time
                        ? "border-green-600 bg-green-50 shadow-lg ring-2 ring-green-500"
                        : "border-gray-200 bg-white hover:border-green-400 hover:shadow-md",
                    )}
                    style={{ fontWeight: selectedTime === slot.time ? 700 : 500, fontSize: 18 }}
                    onClick={() => {
                      setSelectedTime(slot.time)
                      if (selectedDateString) {
                        console.log("🟢 Calendar: Time selected, passing date string:", selectedDateString)
                        console.log("🟢 Calendar: Time selected:", slot.time, "Price:", slot.price)
                        onSelectDateTime(selectedDateString, slot.time, slot.price, basePrice)
                      }
                    }}
                  >
                    <span className="flex items-center gap-1 text-lg font-medium mb-1">
                      <Clock className="w-4 h-4" /> {slot.time}
                    </span>
                    {isDiscount ? (
                      <>
                        <span className="text-2xl font-bold text-green-600">${slot.price}</span>
                        <span className="text-xs text-gray-400 line-through mt-1">${basePrice}</span>
                        <span
                          className="mt-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold"
                          style={{
                            fontFamily: "SF Pro Display, Helvetica Neue, Arial, sans-serif",
                            letterSpacing: 0.2,
                          }}
                        >
                          Save ${discountAmount}
                        </span>
                      </>
                    ) : (
                      <span className="text-2xl font-bold text-gray-900">${slot.price}</span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
