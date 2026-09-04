"use client"

import { useEffect } from "react"
import { reportClientError } from "@/lib/report-client-error"
import { phone, smsHref } from "@/config/site"

// Last resort: this replaces the root layout, so Header, Footer and
// globals.css are all gone by the time it renders. Everything here is inline
// styles and plain anchors on purpose — no imports that could themselves be
// the thing that failed.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    reportClientError(error, "global_error_boundary")
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          background: "#fffdf8",
          color: "#1f2937",
        }}
      >
        <div style={{ maxWidth: "28rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: "0 0 12px" }}>
            This page hit a snag
          </h1>
          <p style={{ margin: "0 0 20px", lineHeight: 1.6, color: "#4b5563" }}>
            Sorry — something broke on our end, not yours. Reloading usually fixes it, and if it
            doesn&apos;t, text us and we&apos;ll quote your party by hand in a few minutes.
          </p>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "12px",
              justifyContent: "center",
              marginBottom: "16px",
            }}
          >
            <button
              type="button"
              onClick={reset}
              style={{
                background: "#f59e0b",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                padding: "10px 20px",
                fontSize: "1rem",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <a
              href={smsHref()}
              style={{
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                padding: "10px 20px",
                fontSize: "1rem",
                fontWeight: 500,
                color: "#1f2937",
                textDecoration: "none",
              }}
            >
              Text {phone.sms.dashed}
            </a>
          </div>
          <a href="/" style={{ fontSize: "0.875rem", color: "#6b7280" }}>
            Back to the homepage
          </a>
          {error.digest ? (
            <p style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: "16px" }}>
              Reference: {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  )
}
