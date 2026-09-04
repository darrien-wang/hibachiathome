"use client"

// Until the LazyVideo crash of 2026-09-03, a client-side exception on this site
// left no trace anywhere: no error boundary, no reporting, just Next.js's blank
// "Application error: a client-side exception has occurred" screen. That bug
// killed the quote page for every auto-translated ad visitor for five days and
// was only found by watching Clarity tapes frame by frame.
//
// This module is the missing trace. Every crash now lands in three places:
// GA4 via the dataLayer (so it shows up next to the funnel it broke), a Clarity
// custom tag (so the session tape is searchable by error message), and the
// server log via /api/client-error (so the stack is readable in Vercel).

export type ClientErrorSource =
  | "error_boundary"
  | "global_error_boundary"
  | "window_onerror"
  | "unhandled_rejection"

// One broken render can fire the same error every frame. Report each distinct
// error once, and never let a crash loop turn into a request flood.
const MAX_REPORTS_PER_PAGE = 5
const reported = new Set<string>()
let reportCount = 0

type ClarityWindow = Window & {
  clarity?: (command: string, ...args: unknown[]) => void
  dataLayer?: Record<string, unknown>[]
}

function describe(error: unknown): { message: string; stack: string; digest?: string } {
  if (error instanceof Error) {
    return {
      message: `${error.name}: ${error.message}`,
      stack: error.stack ?? "",
      digest: (error as Error & { digest?: string }).digest,
    }
  }
  return { message: String(error), stack: "" }
}

export function reportClientError(error: unknown, source: ClientErrorSource): void {
  if (typeof window === "undefined") return

  try {
    const { message, stack, digest } = describe(error)
    if (!message) return

    const key = `${source}|${message}|${stack.split("\n")[1] ?? ""}`
    if (reported.has(key)) return
    if (reportCount >= MAX_REPORTS_PER_PAGE) return
    reported.add(key)
    reportCount += 1

    const payload = {
      message: message.slice(0, 500),
      stack: stack.slice(0, 4000),
      digest,
      source,
      url: window.location.href.slice(0, 500),
      referrer: document.referrer.slice(0, 300) || undefined,
      userAgent: navigator.userAgent.slice(0, 300),
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      // Browser translation re-parents every text node and is the confirmed
      // cause of at least one production crash, so record whether this session
      // was translated — it is the first thing to check on a NotFoundError.
      translated: document.documentElement.classList.contains("translated-ltr") ||
        document.documentElement.classList.contains("translated-rtl") ||
        !!document.querySelector("font[style*='vertical-align']"),
      language: navigator.language,
    }

    const scope = window as ClarityWindow

    if (!Array.isArray(scope.dataLayer)) scope.dataLayer = []
    scope.dataLayer.push({
      event: "client_exception",
      error_message: payload.message,
      error_source: source,
      error_digest: digest,
      error_translated: payload.translated,
      page_path: window.location.pathname,
    })

    // Clarity tags make the recording of *this* session findable by message —
    // the tape is what turns a stack trace into a reproduction.
    scope.clarity?.("set", "client_exception", payload.message.slice(0, 255))
    scope.clarity?.("event", "client_exception")

    // keepalive: the page is usually being torn down as this fires.
    void fetch("/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {
      // Reporting must never be the thing that breaks the error screen.
    })
  } catch {
    // Same: swallow everything. A failed report is invisible; a throwing
    // reporter would replace the error boundary with a blank page again.
  }
}

// React error boundaries only catch errors thrown during render. Everything
// else — a rejected promise, a listener that throws, a third-party script —
// stays invisible unless we listen for it. Installed once by TrackingBootstrap.
export function installGlobalErrorReporting(): () => void {
  if (typeof window === "undefined") return () => {}

  const onError = (event: ErrorEvent) => {
    reportClientError(event.error ?? event.message, "window_onerror")
  }
  const onRejection = (event: PromiseRejectionEvent) => {
    reportClientError(event.reason, "unhandled_rejection")
  }

  window.addEventListener("error", onError)
  window.addEventListener("unhandledrejection", onRejection)

  return () => {
    window.removeEventListener("error", onError)
    window.removeEventListener("unhandledrejection", onRejection)
  }
}
