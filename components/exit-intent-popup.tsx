"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { X } from "lucide-react"

interface ExitIntentPopupProps {
  zipcode: string
  isVisible: boolean
  onClose: () => void
  onSubmit: (name: string, phone: string) => Promise<void>
}

export default function ExitIntentPopup({ zipcode, isVisible, onClose, onSubmit }: ExitIntentPopupProps) {
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const popupRef = useRef<HTMLDivElement>(null)

  // Handle click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    if (isVisible) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isVisible, onClose])

  // Format phone number as user types
  const formatPhoneNumber = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, "")

    // Format the phone number as (XXX) XXX-XXXX
    if (digits.length <= 3) {
      return digits
    } else if (digits.length <= 6) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
    } else {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`
    }
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhoneNumber(e.target.value))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !phone) return

    try {
      setIsSubmitting(true)
      await onSubmit(name, phone)
      setIsSubmitted(true)
    } catch (error) {
      console.error("Error submitting quote request:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div ref={popupRef} className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative animate-fadeIn">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
          aria-label="Close popup"
        >
          <X size={20} />
        </button>

        {!isSubmitted ? (
          <>
            <h3 className="text-xl font-bold text-[#E4572E] mb-2">🚨 Not ready to book?</h3>
            <p className="text-gray-700 mb-4">Let us send your custom quote directly to your phone — no pressure!</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">📍 ZIP Code</label>
                <input
                  type="text"
                  value={zipcode}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                />
              </div>

              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  👤 Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#E4572E]"
                  required
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                  📞 Phone
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={handlePhoneChange}
                  placeholder="(123) 456-7890"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#E4572E]"
                  required
                />
              </div>

              <p className="text-xs text-gray-500 italic">
                We'll text you the estimate and hold the offer for 24 hours.
              </p>

              <button
                type="submit"
                disabled={isSubmitting || !name || !phone}
                className="w-full py-3 bg-[#E4572E] text-white rounded-md hover:bg-[#D64545] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? "Sending..." : "Send me my quote"}
              </button>
            </form>
          </>
        ) : (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">✅ Quote sent!</h3>
            <p className="text-gray-600">Our chef team may reach out to help you book.</p>
            <button
              onClick={onClose}
              className="mt-6 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
