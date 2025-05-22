"use client"

import type React from "react"

import { useState } from "react"
import { X } from "lucide-react"

interface ExitIntentPopupProps {
  isVisible: boolean
  onClose: () => void
  onSubmit: (name: string, phone: string) => Promise<void>
  zipcode: string
}

const ExitIntentPopup: React.FC<ExitIntentPopupProps> = ({ isVisible, onClose, onSubmit, zipcode }) => {
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  if (!isVisible) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !phone) return

    setIsSubmitting(true)
    try {
      await onSubmit(name, phone)
      setIsSubmitted(true)
    } catch (error) {
      console.error("Error submitting form:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="relative w-full max-w-md p-6 bg-white rounded-lg shadow-xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        {isSubmitted ? (
          <div className="text-center py-8">
            <h3 className="text-2xl font-bold text-green-600 mb-4">Thank You!</h3>
            <p className="mb-6">
              We'll send your custom quote to your phone shortly. Feel free to contact us if you have any questions!
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-[#E4572E] text-white rounded-md hover:bg-[#D64545] transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <h3 className="text-2xl font-bold mb-2">Wait! Don't miss your special offer!</h3>
            <p className="mb-4 text-gray-600">
              Get an instant quote for your ZIP code {zipcode} sent directly to your phone.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Your Name
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#E4572E]"
                  required
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#E4572E]"
                  required
                />
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2 bg-[#E4572E] text-white rounded-md hover:bg-[#D64545] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? "Sending..." : "Send Me a Quote"}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                >
                  No Thanks
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

export default ExitIntentPopup
