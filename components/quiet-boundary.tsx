"use client"

import { Component, type ReactNode } from "react"
import { reportClientError } from "@/lib/report-client-error"

// Whatever sits in the root layout has no error boundary above it except
// global-error, which throws the whole document away. Google rendered that
// screen as the homepage on 2026-10-27 and showed its apology as our search
// snippet for days. A tracker or the banner failing should cost that one piece,
// not the page, so each one sits behind this and simply disappears.
export class QuietBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    reportClientError(error, "quiet_boundary")
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}
