"use client"

import { useState, useEffect } from "react"

export default function SocialProofCounter() {
  const [customerCount, setCustomerCount] = useState(100) // 初始值
  const [animationComplete, setAnimationComplete] = useState(false)

  useEffect(() => {
    let animationFrameId: number

    const animateCounter = () => {
      setCustomerCount((prevCount) => {
        const increment = Math.ceil(500 / 200) // 每次增加的值
        const nextCount = prevCount + increment
        if (nextCount >= 500) {
          // 达到目标值
          setAnimationComplete(true)
          return 500 // 确保最终值为目标值
        }
        return nextCount
      })

      if (customerCount < 500) {
        animationFrameId = requestAnimationFrame(animateCounter)
      }
    }

    if (!animationComplete) {
      animationFrameId = requestAnimationFrame(animateCounter)
    }

    return () => {
      cancelAnimationFrame(animationFrameId)
    }
  }, [animationComplete])

  return (
    <div className="bg-gradient-to-r from-primary via-primary/90 to-primary text-white py-12">
      <div className="container mx-auto text-center">
        <div className="flex flex-col items-center space-y-3">
          <div className="flex items-baseline space-x-2">
            <span className="text-5xl font-extrabold bg-gradient-to-r from-yellow-300 to-orange-300 bg-clip-text text-transparent">
              {customerCount}
            </span>
            <span className="text-2xl font-bold">+</span>
          </div>
          <p className="text-xl font-semibold tracking-wide">Happy Customers Served</p>
          <p className="text-base opacity-90 max-w-md mx-auto">
            Bringing authentic hibachi experiences to homes across New York
          </p>
        </div>
      </div>
    </div>
  )
}
