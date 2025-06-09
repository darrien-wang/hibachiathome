"use client"

import { useState, useEffect } from "react"

export default function SocialProofCounter() {
  const [count, setCount] = useState(0)
  const targetCount = 500

  useEffect(() => {
    const duration = 2000 // 2 seconds
    const steps = 50
    const increment = targetCount / steps
    const stepDuration = duration / steps

    let currentCount = 0
    const timer = setInterval(() => {
      currentCount += increment
      if (currentCount >= targetCount) {
        setCount(targetCount)
        clearInterval(timer)
      } else {
        setCount(Math.floor(currentCount))
      }
    }, stepDuration)

    return () => clearInterval(timer)
  }, [])

  return (
    <section className="py-16 bg-gradient-to-r from-amber-600 to-orange-600 text-white">
      <div className="container mx-auto px-4">
        <div className="text-center">
          <div className="flex items-center justify-center mb-4">
            <span className="text-6xl md:text-7xl font-bold">{count}</span>
            <span className="text-2xl font-bold">+</span>
          </div>
          <p className="text-xl font-semibold tracking-wide">Happy Customers Served</p>
          <p className="text-base opacity-90 max-w-md mx-auto">
            Bringing authentic hibachi experiences to homes across Los Angeles, Orange County, and surrounding areas.
            Also serving New York.
          </p>
        </div>
      </div>
    </section>
  )
}
