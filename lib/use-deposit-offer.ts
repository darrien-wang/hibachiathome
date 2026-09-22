"use client"

import { useEffect, useState } from "react"
import { DEPOSIT_AMOUNT } from "@/config/pricing-rules"
import { findDepositOffer, getLiveOfferByCode, toOfferView, type DepositOfferView } from "@/config/deposit-offers"
import { getStoredAttribution } from "@/lib/tracking"

// The deposit amount a page should print. Starts from this device's
// attribution cookie (what a same-device visitor will be charged), then asks
// the server, which also knows the lead a texted link names. Until the server
// answers, a link's ?offer= code is shown optimistically; the server's answer
// replaces it either way.
export function useDepositOffer(params: { leadId?: string; offerCode?: string } = {}): {
  offer: DepositOfferView | null
  amount: number
  resolved: boolean
} {
  const { leadId, offerCode } = params
  const [offer, setOffer] = useState<DepositOfferView | null>(null)
  const [resolved, setResolved] = useState(false)

  useEffect(() => {
    let cancelled = false
    const local = findDepositOffer(getStoredAttribution()) ?? getLiveOfferByCode(offerCode)
    if (local) setOffer(toOfferView(local))
    const query = new URLSearchParams()
    if (leadId) query.set("lead_id", leadId)
    fetch(`/api/deposit/offer?${query.toString()}`, { cache: "no-store" })
      .then((response) => (response.ok ? (response.json() as Promise<{ offer: DepositOfferView | null }>) : null))
      .then((payload) => {
        if (cancelled || !payload) return
        setOffer(payload.offer ?? null)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setResolved(true)
      })
    return () => {
      cancelled = true
    }
  }, [leadId, offerCode])

  return { offer, amount: offer ? offer.amount : DEPOSIT_AMOUNT, resolved }
}
