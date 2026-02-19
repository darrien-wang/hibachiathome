"use client"

import { Phone, MessageCircle, Mail, Copy, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { usePathname } from "next/navigation"
import { trackEvent } from "@/lib/tracking"

export function FloatingContactButtons() {
  const phoneNumber = "2137707788"
  const smsNumber = "2137707788"
  const emailAddress = "realhibachiathome@gmail.com"

  const [expandedButton, setExpandedButton] = useState<string | null>(null)
  const [isMainExpanded, setIsMainExpanded] = useState(false)
  const pathname = usePathname()

  // Hide the floating button on book and estimation pages
  if (pathname === "/book" || pathname.startsWith("/estimation")) {
    return null
  }

  const toggleExpand = (buttonType: string) => {
    if (expandedButton === buttonType) {
      setExpandedButton(null)
    } else {
      setExpandedButton(buttonType)
    }
  }

  const handleCall = () => {
    trackEvent("phone_click", {
      contact_surface: "floating_contact_buttons",
    })

    if ((window as any).__REALHIBACHI_DISABLE_NAVIGATION__) {
      return
    }

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
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-[#F5E3CB] to-white backdrop-blur-sm border-t border-[#F5E3CB]/30 shadow-2xl">
      {!isMainExpanded ? (
        // Collapsed state - full width bottom bar
        <div className="px-4 py-3">
          <Button
            onClick={() => setIsMainExpanded(true)}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white rounded-lg py-4 shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-2 text-lg font-semibold"
            size="lg"
          >
            <MessageCircle className="h-5 w-5" />
            <span>Book Now</span>
          </Button>
        </div>
      ) : (
        // Expanded state - optimized for desktop and mobile
        <div className="px-4 py-4 space-y-3">
          {/* Close button */}
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-semibold text-gray-800">Book Now</h3>
            <Button
              onClick={() => {
                setIsMainExpanded(false)
                setExpandedButton(null)
              }}
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Contact options - responsive grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-4xl mx-auto">
            {/* Phone - Mobile: expandable, Desktop: always shown */}
            <div className="md:bg-white/50 md:backdrop-blur-sm md:rounded-lg md:p-4 md:border md:border-white/40">
              {/* Mobile expandable version */}
              <div className="md:hidden">
                {expandedButton === "phone" ? (
                  <div
                    className="bg-white/50 backdrop-blur-sm rounded-lg p-4 border border-white/40"
                    onClick={() => setExpandedButton(null)}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-semibold flex items-center gap-2">
                        <Phone className="h-4 w-4" /> Phone
                      </h4>
                    </div>
                    <p className="select-all text-base mb-3">{formatPhoneNumber(phoneNumber)}</p>
                    <div className="flex flex-row gap-2">
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white flex-[3]"
                        onClick={handleCall}
                      >
                        Call Now
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 bg-transparent"
                        onClick={() => copyToClipboard(phoneNumber)}
                      >
                        <Copy className="h-3 w-3 mr-1" /> Copy
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    onClick={() => toggleExpand("phone")}
                    variant="outline"
                    className="w-full justify-center py-4 text-center bg-white/30 hover:bg-white/50 border-white/40"
                    size="lg"
                  >
                    <Phone className="h-4 w-4 mr-3" />
                    <span>Call Us</span>
                  </Button>
                )}
              </div>

              {/* Desktop always visible version */}
              <div className="hidden md:block">
                <h4 className="font-semibold flex items-center gap-2 mb-2">
                  <Phone className="h-4 w-4" /> Phone
                </h4>
                <p className="select-all text-base mb-3">{formatPhoneNumber(phoneNumber)}</p>
                <Button size="sm" variant="outline" onClick={() => copyToClipboard(phoneNumber)} className="w-full">
                  <Copy className="h-3 w-3 mr-1" /> Copy
                </Button>
              </div>
            </div>

            {/* SMS - Mobile: expandable, Desktop: always shown */}
            <div className="md:bg-white/50 md:backdrop-blur-sm md:rounded-lg md:p-4 md:border md:border-white/40">
              {/* Mobile expandable version */}
              <div className="md:hidden">
                {expandedButton === "sms" ? (
                  <div
                    className="bg-white/50 backdrop-blur-sm rounded-lg p-4 border border-white/40"
                    onClick={() => setExpandedButton(null)}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-semibold flex items-center gap-2">
                        <MessageCircle className="h-4 w-4" /> SMS
                      </h4>
                    </div>
                    <p className="select-all text-base mb-3">{formatPhoneNumber(smsNumber)}</p>
                    <div className="flex flex-row gap-2">
                      <Button
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white flex-[3]"
                        onClick={handleSMS}
                      >
                        Send SMS
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 bg-transparent"
                        onClick={() => copyToClipboard(smsNumber)}
                      >
                        <Copy className="h-3 w-3 mr-1" /> Copy
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    onClick={() => toggleExpand("sms")}
                    variant="outline"
                    className="w-full justify-center py-4 text-center bg-white/30 hover:bg-white/50 border-white/40"
                    size="lg"
                  >
                    <MessageCircle className="h-4 w-4 mr-3" />
                    <span>Send Text</span>
                  </Button>
                )}
              </div>

              {/* Desktop always visible version */}
              <div className="hidden md:block">
                <h4 className="font-semibold flex items-center gap-2 mb-2">
                  <MessageCircle className="h-4 w-4" /> SMS
                </h4>
                <p className="select-all text-base mb-3">{formatPhoneNumber(smsNumber)}</p>
                <Button size="sm" variant="outline" onClick={() => copyToClipboard(smsNumber)} className="w-full">
                  <Copy className="h-3 w-3 mr-1" /> Copy
                </Button>
              </div>
            </div>

            {/* Email - Mobile: expandable, Desktop: always shown */}
            <div className="md:bg-white/50 md:backdrop-blur-sm md:rounded-lg md:p-4 md:border md:border-white/40">
              {/* Mobile expandable version */}
              <div className="md:hidden">
                {expandedButton === "email" ? (
                  <div
                    className="bg-white/50 backdrop-blur-sm rounded-lg p-4 border border-white/40"
                    onClick={() => setExpandedButton(null)}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-semibold flex items-center gap-2">
                        <Mail className="h-4 w-4" /> Email
                      </h4>
                    </div>
                    <p className="select-all text-base break-all mb-3">{emailAddress}</p>
                    <div className="flex flex-row gap-2">
                      <Button
                        size="sm"
                        className="bg-amber-600 hover:bg-amber-700 text-white flex-[3]"
                        onClick={handleEmail}
                      >
                        Send Email
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 bg-transparent"
                        onClick={() => copyToClipboard(emailAddress)}
                      >
                        <Copy className="h-3 w-3 mr-1" /> Copy
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    onClick={() => toggleExpand("email")}
                    variant="outline"
                    className="w-full justify-center py-4 text-center bg-white/30 hover:bg-white/50 border-white/40"
                    size="lg"
                  >
                    <Mail className="h-4 w-4 mr-3" />
                    <span>Send Email</span>
                  </Button>
                )}
              </div>

              {/* Desktop always visible version */}
              <div className="hidden md:block">
                <h4 className="font-semibold flex items-center gap-2 mb-2">
                  <Mail className="h-4 w-4" /> Email
                </h4>
                <p className="select-all text-base break-all mb-3">{emailAddress}</p>
                <Button size="sm" variant="outline" onClick={() => copyToClipboard(emailAddress)} className="w-full">
                  <Copy className="h-3 w-3 mr-1" /> Copy
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
