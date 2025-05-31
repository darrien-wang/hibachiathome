"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { CalendarIcon, Clock, ChevronRight } from "lucide-react"
import { format, addMonths, subMonths, isSameMonth, isBefore, startOfMonth } from "date-fns"
import { cn } from "@/lib/utils"

interface DynamicPricingCalendarProps {
  onSelectDateTime: (date: Date | undefined, time: string | undefined, price: number, originalPrice: number) => void
  packageType: string
  headcount: number
  zipcode: string
  basePrice: number
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
    days.push(new Date(year, month, d))
  }
  return days
}

export default function DynamicPricingCalendar({
  onSelectDateTime,
  packageType,
  headcount,
  zipcode,
  basePrice,
}: DynamicPricingCalendarProps) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [selectedDate, setSelectedDate] = useState<Date>()
  const [selectedTime, setSelectedTime] = useState<string>()
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [loadingTimes, setLoadingTimes] = useState(false)
  const [dateConfirmed, setDateConfirmed] = useState(false)
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())

  // 获取时间段和价格信息
  useEffect(() => {
    if (!selectedDate) {
      setTimeSlots([])
      return
    }
    setLoadingTimes(true)
    const dateStr = selectedDate.toISOString().slice(0, 10)
    fetch(`/api/calendar/manual?date=${dateStr}&address=${zipcode}&basePrice=${basePrice}`)
      .then(res => res.json())
      .then(data => {
        if (data.slots) {
          setTimeSlots(data.slots.map((slot: any) => ({
            time: slot.time,
            price: slot.price,
            available: true
          })))
        }
      })
      .catch(error => {
        console.error('Error fetching time slots:', error)
        setTimeSlots([])
      })
      .finally(() => setLoadingTimes(false))
  }, [selectedDate, zipcode, basePrice])

  // 确认按钮逻辑
  const handleConfirm = () => {
    setDateConfirmed(true)
    if (selectedDate) onSelectDateTime(selectedDate, selectedTime, 0, 0)
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
          <span className="flex-1 text-center text-lg font-bold">
            {format(thisMonthDate, "MMMM yyyy")}
          </span>
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
            {format(nextMonthDate, "MMMM")}<span className="ml-1">→</span>
          </Button>
        </div>
        {/* 日期网格 */}
        <div className="space-y-2">
          {rows.map((row, rowIdx) => (
            <div key={rowIdx} className="flex gap-2 justify-center">
              {row.map(date => {
                const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString()
                return (
                  <button
                    key={date.toISOString()}
                    type="button"
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center font-medium transition-all border",
                      isSelected
                        ? "bg-green-600 text-white border-green-700 shadow-lg ring-2 ring-green-700"
                        : "bg-green-50 text-green-900 border-green-200 hover:bg-green-100 hover:ring-2 hover:ring-green-400"
                    )}
                    style={{ fontWeight: isSelected ? 700 : 500 }}
                    onClick={() => setSelectedDate(date)}
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
          {selectedDate ? (
            <span
              key={selectedDate.toISOString()}
              className={`inline-block animate-bounceOnce`}
            >
              Selected: {format(selectedDate, "yyyy-MM-dd")}
            </span>
          ) : (
            <span className="inline-block">Select a date</span>
          )}
        </div>
      </div>
      {/* 时间卡片渐入动画 */}
      <div className={`transition-all duration-500 min-h-[120px] ${selectedDate ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
        <div>
          <label className="block text-sm font-medium mb-2">Select Time</label>
          {
            !loadingTimes && timeSlots.length > 0 && timeSlots.every(slot => slot.price === basePrice) ? (
              <select
                className="w-full border rounded-lg p-3 text-lg"
                value={selectedTime || ''}
                onChange={e => {
                  setSelectedTime(e.target.value)
                  if (selectedDate) onSelectDateTime(selectedDate, e.target.value, basePrice, basePrice)
                }}
              >
                <option value="" disabled>Select a time</option>
                {timeSlots.map(slot => (
                  <option key={slot.time} value={slot.time}>{slot.time}</option>
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
                {timeSlots.map(slot => {
                  const isDiscount = slot.price < basePrice
                  const discountAmount = Math.round(basePrice - slot.price)
                  return (
                    <button
                      key={slot.time}
                      type="button"
                      className={cn(
                        "border rounded-lg p-4 flex flex-col items-center transition-all shadow-sm",
                        selectedTime === slot.time ? "border-green-600 bg-green-50 shadow-lg ring-2 ring-green-500" : "border-gray-200 bg-white hover:border-green-400 hover:shadow-md"
                      )}
                      style={{ fontWeight: selectedTime === slot.time ? 700 : 500, fontSize: 18 }}
                      onClick={() => {
                        setSelectedTime(slot.time)
                        if (selectedDate) onSelectDateTime(selectedDate, slot.time, slot.price, basePrice)
                      }}
                    >
                      <span className="flex items-center gap-1 text-lg font-medium mb-1">
                        <Clock className="w-4 h-4" /> {slot.time}
                      </span>
                      {isDiscount ? (
                        <>
                          <span className="text-2xl font-bold text-green-600">${slot.price}</span>
                          <span className="text-xs text-gray-400 line-through mt-1">${basePrice}</span>
                          <span className="mt-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold" style={{fontFamily: 'SF Pro Display, Helvetica Neue, Arial, sans-serif', letterSpacing: 0.2}}>
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
            )
          }
        </div>
      </div>
    </div>
  )
}
