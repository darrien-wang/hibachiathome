"use client"

import { useEffect } from "react"

// ChatGPT Ads measurement pixel (oaiq). Docs:
// https://developers.openai.com/ads/measurement-pixel
//
// The command stub is installed synchronously so events queued by
// lib/tracking.ts before the SDK arrives are not lost; the SDK itself is
// fetched only after the page is idle (or 2.5 s), the same courtesy the site
// extends to GTM after the 09-08 INP work. The pixel reads `oppref` off the
// landing URL itself and keeps it in a first-party cookie, so ChatGPT-side
// attribution needs nothing from us beyond loading it.
//
// Pixel ID is public (it ships in every page), so a default lives here;
// NEXT_PUBLIC_CHATGPT_PIXEL_ID overrides it for previews/tests.
export const CHATGPT_PIXEL_ID = process.env.NEXT_PUBLIC_CHATGPT_PIXEL_ID || "S5xiVpByZjY3XVfQsSFMoC"

const SDK_URL = "https://bzrcdn.openai.com/sdk/oaiq.min.js"

type Oaiq = ((...args: unknown[]) => void) & { q?: unknown[][] }

declare global {
  interface Window {
    oaiq?: Oaiq
  }
}

export function installOaiqStub(): Oaiq | null {
  if (typeof window === "undefined") return null
  if (window.oaiq) return window.oaiq
  const q: Oaiq = function (...args: unknown[]) {
    q.q?.push(args)
  }
  q.q = []
  window.oaiq = q
  return q
}

export function ChatgptPixel() {
  useEffect(() => {
    if (!CHATGPT_PIXEL_ID) return
    const oaiq = installOaiqStub()
    if (!oaiq) return
    oaiq("init", { pixelId: CHATGPT_PIXEL_ID })

    let loaded = false
    const load = () => {
      if (loaded || document.querySelector(`script[src="${SDK_URL}"]`)) return
      loaded = true
      const js = document.createElement("script")
      js.async = true
      js.src = SDK_URL
      document.head.appendChild(js)
    }
    const w = window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }
    const timer = window.setTimeout(load, 2500)
    if (typeof w.requestIdleCallback === "function") w.requestIdleCallback(load, { timeout: 4000 })
    return () => window.clearTimeout(timer)
  }, [])
  return null
}
