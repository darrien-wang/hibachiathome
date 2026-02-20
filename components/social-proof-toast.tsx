"use client"

import { useEffect, useMemo, useState } from "react"
import { X } from "lucide-react"

type BookingExample = {
  guestCount: number
  city: string
  minutesAgo: number
}

const SESSION_DISMISS_KEY = "realhibachi_social_proof_toast_dismissed"

const RECENT_BOOKINGS: BookingExample[] = [
  { guestCount: 12, city: "Irvine", minutesAgo: 18 },
  { guestCount: 16, city: "Long Beach", minutesAgo: 33 },
  { guestCount: 10, city: "Pasadena", minutesAgo: 26 },
  { guestCount: 20, city: "Anaheim", minutesAgo: 41 },
  { guestCount: 14, city: "Santa Monica", minutesAgo: 22 },
]

function nextRotationDelayMs() {
  const minSeconds = 20
  const maxSeconds = 40
  const seconds = Math.floor(Math.random() * (maxSeconds - minSeconds + 1)) + minSeconds
  return seconds * 1000
}

export function SocialProofToast() {
  const [dismissed, setDismissed] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [isReady, setIsReady] = useState(false)
  const bookingCount = RECENT_BOOKINGS.length

  useEffect(() => {
    const value = window.sessionStorage.getItem(SESSION_DISMISS_KEY)
    setDismissed(value === "1")
    setIsReady(true)
  }, [])

  useEffect(() => {
    if (!isReady || dismissed || bookingCount < 2) return

    let timer: ReturnType<typeof setTimeout> | undefined

    const schedule = () => {
      timer = window.setTimeout(() => {
        setActiveIndex((current) => (current + 1) % bookingCount)
        schedule()
      }, nextRotationDelayMs())
    }

    schedule()

    return () => {
      if (timer) {
        window.clearTimeout(timer)
      }
    }
  }, [dismissed, isReady, bookingCount])

  const booking = useMemo(() => RECENT_BOOKINGS[activeIndex], [activeIndex])

  const onDismiss = () => {
    window.sessionStorage.setItem(SESSION_DISMISS_KEY, "1")
    setDismissed(true)
  }

  if (!isReady || dismissed) {
    return null
  }

  return (
    <div className="pointer-events-none fixed bottom-24 right-3 z-40 w-[min(22rem,calc(100vw-1.5rem))] md:bottom-6 md:right-6">
      <div className="pointer-events-auto rounded-xl border border-orange-200 bg-white/95 p-4 shadow-xl backdrop-blur">
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss recent booking notice"
          className="absolute right-2 top-2 rounded p-1 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
        >
          <X className="h-4 w-4" />
        </button>
        <p className="pr-6 text-xs font-semibold uppercase tracking-wide text-orange-700">Recent Booking</p>
        <p className="mt-1 text-sm font-semibold text-gray-900">
          {booking.guestCount} guests in {booking.city}
        </p>
        <p className="mt-1 text-sm text-gray-700">Booked {booking.minutesAgo} minutes ago.</p>
      </div>
    </div>
  )
}
