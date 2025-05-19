"use client"

import { useState, useEffect } from "react"

export default function SocialProofCounter() {
  const [customerCount, setCustomerCount] = useState(1200) // 初始值
  const [animationComplete, setAnimationComplete] = useState(false)

  useEffect(() => {
    let animationFrameId: number

    const animateCounter = () => {
      setCustomerCount((prevCount) => {
        const increment = Math.ceil(2400 / 200) // 每次增加的值
        const nextCount = prevCount + increment
        if (nextCount >= 2400) {
          // 达到目标值
          setAnimationComplete(true)
          return 2400 // 确保最终值为目标值
        }
        return nextCount
      })

      if (customerCount < 2400) {
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
    <div className="bg-primary text-white py-8">
      <div className="container mx-auto text-center">
        <p className="text-2xl font-bold">
          <span className="text-4xl">{customerCount}</span>+ Happy Customers Served
        </p>
        <p className="text-lg mt-2">Bringing joy to homes across New York</p>
      </div>
    </div>
  )
}
