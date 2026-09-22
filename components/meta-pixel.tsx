"use client"

import { useEffect } from "react"

// Meta (Facebook / Instagram) Pixel for the 2026-09 Meta video test.
//
// Same shape as components/chatgpt-pixel.tsx: the fbq command stub is
// installed synchronously so events lib/tracking.ts fires before the SDK
// arrives are queued, and fbevents.js itself is fetched only once the page is
// idle (or after 2.5 s) - the INP courtesy every third-party tag gets here
// since 2026-09-08. `init` is issued from ensureMetaPixel() so it always
// precedes the first queued track call no matter which effect runs first.
//
// Events are mirrored from lib/tracking.ts (PageView, Lead, InitiateCheckout,
// Purchase); nothing here fires on its own. No pixel id = nothing loads,
// which is how previews and the site before the test behave.
//
// Owner traffic never reaches Meta: the rh_internal cookie (lib/internal-traffic)
// and localhost are skipped, and the workbench never mounts this component.
export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || ""

const SDK_URL = "https://connect.facebook.net/en_US/fbevents.js"

type Fbq = ((...args: unknown[]) => void) & {
  queue?: unknown[][]
  loaded?: boolean
  version?: string
  push?: Fbq
  callMethod?: (...args: unknown[]) => void
}

declare global {
  interface Window {
    fbq?: Fbq
    _fbq?: Fbq
    __realHibachiMetaPixelInit?: boolean
  }
}

function isOwnerTraffic(): boolean {
  if (typeof window === "undefined") return true
  if (window.location.hostname === "localhost") return true
  if (window.location.pathname.startsWith("/admin")) return true
  return /(?:^|;\s*)rh_internal=1(?:;|$)/.test(document.cookie)
}

/** Stub + init, idempotent. Returns null when the pixel must stay silent. */
export function ensureMetaPixel(): Fbq | null {
  if (!META_PIXEL_ID || isOwnerTraffic()) return null
  let fbq = window.fbq
  if (!fbq) {
    const n: Fbq = function (...args: unknown[]) {
      if (n.callMethod) n.callMethod.apply(n, args)
      else n.queue?.push(args)
    }
    n.push = n
    n.loaded = true
    n.version = "2.0"
    n.queue = []
    window.fbq = n
    if (!window._fbq) window._fbq = n
    fbq = n
  }
  if (!window.__realHibachiMetaPixelInit) {
    window.__realHibachiMetaPixelInit = true
    fbq("init", META_PIXEL_ID)
  }
  return fbq
}

export function MetaPixel() {
  useEffect(() => {
    if (!ensureMetaPixel()) return
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
