"use client"

import { Phone, MessageCircle, Mail, Copy, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"

export function FloatingContactButtons() {
  const phoneNumber = "2137707788"
  const smsNumber = "5627134832"
  const emailAddress = "realhibachiathome@gmail.com"

  // Track which button is expanded
  const [expandedButton, setExpandedButton] = useState<string | null>(null)
  const [isMainExpanded, setIsMainExpanded] = useState(false)

  const toggleExpand = (buttonType: string) => {
    if (expandedButton === buttonType) {
      setExpandedButton(null)
    } else {
      setExpandedButton(buttonType)
    }
  }

  const handleCall = () => {
    window.location.href = `tel:${phoneNumber}`
  }

  const handleSMS = () => {
    window.location.href = `sms:${smsNumber}`
  }

  const handleEmail = () => {
    window.location.href = `mailto:${emailAddress}`
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        alert("Copied to clipboard!")
      })
      .catch((err) => {
        console.error("Failed to copy: ", err)
      })
  }

  const formatPhoneNumber = (number: string) => {
    return `(${number.slice(0, 3)}) ${number.slice(3, 6)}-${number.slice(6)}`
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 items-end">
      {!isMainExpanded ? (
        // Collapsed state - single contact button
        <Button
          onClick={() => setIsMainExpanded(true)}
          className="bg-orange-600 hover:bg-orange-700 text-white rounded-full px-6 py-3 shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2 text-sm font-medium"
          size="lg"
        >
          <MessageCircle className="h-4 w-4" />
          <span>Book Now</span>
        </Button>
      ) : (
        // Expanded state - show all contact options
        <>
          {/* Close button */}
          <Button
            onClick={() => {
              setIsMainExpanded(false)
              setExpandedButton(null)
            }}
            className="bg-red-600 hover:bg-red-700 text-white rounded-full px-4 py-2 shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2 text-sm font-medium"
            size="sm"
          >
            <X className="h-4 w-4" />
            <span>Close</span>
          </Button>

          {/* Phone Button */}
          {expandedButton === "phone" ? (
            <div className="bg-white text-slate-800 rounded-lg p-4 shadow-lg flex flex-col gap-2 min-w-[250px]">
              <div className="flex justify-between items-center">
                <h3 className="font-bold flex items-center gap-2">
                  <Phone className="h-4 w-4" /> Phone
                </h3>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setExpandedButton(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <p className="select-all text-base">{formatPhoneNumber(phoneNumber)}</p>
              <div className="flex gap-2 mt-2">
                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={handleCall}>
                  Call Now
                </Button>
                <Button size="sm" variant="outline" onClick={() => copyToClipboard(phoneNumber)}>
                  <Copy className="h-3 w-3 mr-1" /> Copy
                </Button>
              </div>
            </div>
          ) : (
            <Button
              onClick={() => toggleExpand("phone")}
              className="bg-slate-700 hover:bg-green-600 text-white rounded-full px-6 py-3 shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2 text-sm font-medium"
              size="lg"
            >
              <Phone className="h-4 w-4" />
              <span>Call</span>
            </Button>
          )}

          {/* SMS Button */}
          {expandedButton === "sms" ? (
            <div className="bg-white text-slate-800 rounded-lg p-4 shadow-lg flex flex-col gap-2 min-w-[250px]">
              <div className="flex justify-between items-center">
                <h3 className="font-bold flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" /> SMS
                </h3>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setExpandedButton(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <p className="select-all text-base">{formatPhoneNumber(smsNumber)}</p>
              <div className="flex gap-2 mt-2">
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleSMS}>
                  Send SMS
                </Button>
                <Button size="sm" variant="outline" onClick={() => copyToClipboard(smsNumber)}>
                  <Copy className="h-3 w-3 mr-1" /> Copy
                </Button>
              </div>
            </div>
          ) : (
            <Button
              onClick={() => toggleExpand("sms")}
              className="bg-slate-700 hover:bg-blue-600 text-white rounded-full px-6 py-3 shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2 text-sm font-medium"
              size="lg"
            >
              <MessageCircle className="h-4 w-4" />
              <span>Text</span>
            </Button>
          )}

          {/* Email Button */}
          {expandedButton === "email" ? (
            <div className="bg-white text-slate-800 rounded-lg p-4 shadow-lg flex flex-col gap-2 min-w-[250px]">
              <div className="flex justify-between items-center">
                <h3 className="font-bold flex items-center gap-2">
                  <Mail className="h-4 w-4" /> Email
                </h3>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setExpandedButton(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <p className="select-all text-base break-all">{emailAddress}</p>
              <div className="flex gap-2 mt-2">
                <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white" onClick={handleEmail}>
                  Send Email
                </Button>
                <Button size="sm" variant="outline" onClick={() => copyToClipboard(emailAddress)}>
                  <Copy className="h-3 w-3 mr-1" /> Copy
                </Button>
              </div>
            </div>
          ) : (
            <Button
              onClick={() => toggleExpand("email")}
              className="bg-slate-700 hover:bg-amber-600 text-white rounded-full px-6 py-3 shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2 text-sm font-medium"
              size="lg"
            >
              <Mail className="h-4 w-4" />
              <span>Email</span>
            </Button>
          )}
        </>
      )}
    </div>
  )
}
