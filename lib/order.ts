import type React from "react"

// 订单相关操作函数迁移自 package-selection.tsx

export function handleInputChange({
  e,
  setCustomerInfo,
}: {
  e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  setCustomerInfo: (fn: (prev: any) => any) => void
}) {
  const { id, value } = e.target
  setCustomerInfo((prev: any) => ({
    ...prev,
    [id]: value,
  }))
}

export async function handleSubmitOrder({
  selectedPackage,
  customerInfo,
  setIsSubmitting,
  setSubmitResult,
  packages,
  participants,
  createBookingWithOrder,
  setCustomerInfo,
}: {
  selectedPackage: string | null
  customerInfo: any
  setIsSubmitting: (b: boolean) => void
  setSubmitResult: (r: any) => void
  packages: any[]
  participants: any[]
  createBookingWithOrder: Function
  setCustomerInfo: (info: any) => void
}) {
  if (!selectedPackage) {
    alert("Please select a package first")
    return
  }
  if (
    !customerInfo.name ||
    !customerInfo.phone ||
    !customerInfo.eventDate ||
    !customerInfo.eventTime ||
    !customerInfo.address
  ) {
    alert("Please fill in all required fields")
    return
  }
  setIsSubmitting(true)
  setSubmitResult(null)
  try {
    const selectedPkg = packages.find((pkg: any) => pkg.id === selectedPackage)
    const reservationData = {
      name: customerInfo.name,
      email: customerInfo.email || undefined,
      phone: customerInfo.phone,
      headcount: selectedPkg.headcount,
      event_date: customerInfo.eventDate,
      event_time: customerInfo.eventTime,
      address: customerInfo.address,
      special_requests: customerInfo.specialRequests || undefined,
      status: "pending",
    }
    const orderData = {
      package_id: selectedPackage,
      total_price: selectedPkg.flatRate,
      items: [
        {
          item_type: "package",
          item_id: selectedPackage,
          quantity: 1,
          price: selectedPkg.flatRate,
        },
      ],
      participants: participants.map((participant: any) => ({
        name: participant.name,
        is_host: participant.id === participants.find((p: any) => p.isSelected)?.id,
        selections: [],
      })),
    }
    const result = await createBookingWithOrder(reservationData, orderData)
    if (result.success && result.data) {
      setSubmitResult({
        success: true,
        message: "Your order has been successfully submitted! We'll contact you shortly to confirm details.",
        reservationId: result.data.reservation.id,
      })
      setCustomerInfo({
        name: "",
        email: "",
        phone: "",
        eventDate: "",
        eventTime: "",
        address: "",
        specialRequests: "",
      })
    } else {
      setSubmitResult({
        success: false,
        message: result.error || "There was an error submitting your order. Please try again.",
      })
    }
  } catch (error: any) {
    setSubmitResult({
      success: false,
      message: error.message || "There was an error submitting your order. Please try again.",
    })
  } finally {
    setIsSubmitting(false)
  }
}
