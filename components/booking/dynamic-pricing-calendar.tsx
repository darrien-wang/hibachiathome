"use client"

import { useState, useEffect } from "react"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { CalendarIcon, Clock } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

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

export default function DynamicPricingCalendar({
  onSelectDateTime,
  packageType,
  headcount,
  zipcode,
  basePrice,
}: DynamicPricingCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date>()
  const [selectedTime, setSelectedTime] = useState<string>()
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [loadingTimes, setLoadingTimes] = useState(false)

  // 获取时间段和价格信息
  useEffect(() => {
    if (!selectedDate) {
      setTimeSlots([])
      return
    }
    setLoadingTimes(true)
    const dateStr = selectedDate.toISOString().slice(0, 10)
    
    // 只使用 calendar API 获取时间段和价格
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

  // 日历自定义内容组件
  function DayContent(props: any) {
    const { date } = props
    return (
      <div className="flex flex-col items-center justify-center w-12 h-12 rounded-md bg-green-50 text-green-900 font-medium cursor-pointer">
        <span>{date.getDate()}</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Select Date</label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn("w-full justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {selectedDate ? format(selectedDate, "PPP") : "Select a date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={date => {
                setSelectedDate(date)
                setSelectedTime(undefined)
                if (date) onSelectDateTime(date, undefined, 0, 0)
              }}
              disabled={day => {
                // 禁用过去的日期和当天
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                const checkDay = new Date(day)
                checkDay.setHours(0, 0, 0, 0)
                return checkDay <= today // 今天及以前都禁用
              }}
              components={{ DayContent }}
            />
          </PopoverContent>
        </Popover>
      </div>

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
                      "border rounded-lg p-4 flex flex-col items-center transition-all",
                      selectedTime === slot.time ? "border-green-500 bg-green-50" : "border-gray-200 bg-white hover:border-green-400"
                    )}
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
  )
}
