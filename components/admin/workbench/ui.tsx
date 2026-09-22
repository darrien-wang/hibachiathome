"use client"

import type { CSSProperties, ReactNode } from "react"
import { useEffect, useRef } from "react"

// Small presentational pieces shared by every tab and dialog. They only
// know the classes in app/admin/workbench.css.

export function Chip({
  active,
  onClick,
  children,
  small,
  disabled,
  title,
  style,
}: {
  active?: boolean
  onClick?: () => void
  children: ReactNode
  small?: boolean
  disabled?: boolean
  title?: string
  style?: CSSProperties
}) {
  return (
    <button
      type="button"
      className={`wb-chip${small ? " wb-chip-sm" : ""}`}
      aria-pressed={active ? "true" : "false"}
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={style}
    >
      {children}
    </button>
  )
}

export function Tag({ cls, children, style }: { cls: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <span className={`tag ${cls}`} style={style}>
      {children}
    </span>
  )
}

export function Kicker({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <h6 style={{ margin: "0 0 8px", ...style }}>{children}</h6>
  )
}

export function Cell({
  label,
  value,
  sub,
  color,
  bg,
  onClick,
}: {
  label: ReactNode
  value: ReactNode
  sub?: ReactNode
  color?: string
  bg?: string
  onClick?: () => void
}) {
  return (
    <div className="wb-cell" style={{ background: bg, cursor: onClick ? "pointer" : undefined }} onClick={onClick} role={onClick ? "button" : undefined}>
      <div className="kicker">{label}</div>
      <div className="big" style={{ color }}>
        {value}
      </div>
      {sub ? <div style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>{sub}</div> : null}
    </div>
  )
}

export function Field({ label, children, style }: { label: ReactNode; children: ReactNode; style?: CSSProperties }) {
  return (
    <label className="field" style={style}>
      <span className="label">{label}</span>
      {children}
    </label>
  )
}

export function Notice({ children, accent, style }: { children: ReactNode; accent?: boolean; style?: CSSProperties }) {
  return (
    <div className={`notice${accent ? " notice-accent" : ""}`} style={style}>
      {children}
    </div>
  )
}

/** Backdrop + frame. Esc closes; clicks inside stay inside. */
export function Dialog({ onClose, width, children }: { onClose: () => void; width?: number; children: ReactNode }) {
  // Only a real click on the backdrop closes the dialog. Two things used to
  // count as one and made dialogs "close themselves" (2026-09-21, the chef
  // dialog on Windows): the backdrop's own scrollbar, which lives inside the
  // element, and a drag that starts inside the dialog (selecting text) and
  // ends outside it.
  const downOnBackdrop = useRef(false)
  const onBackdropDown = (e: React.MouseEvent<HTMLDivElement>) => {
    downOnBackdrop.current = e.target === e.currentTarget
  }
  const onBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    if (e.target !== el || !downOnBackdrop.current) return
    if (e.clientX >= el.clientWidth || e.clientY >= el.clientHeight) return
    onClose()
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.isComposing) onClose()
    }
    window.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])
  return (
    <div className="dialog-backdrop" onMouseDown={onBackdropDown} onClick={onBackdropClick}>
      <div className="dialog" style={width ? { width: `min(${width}px, 100%)` } : undefined} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        {children}
      </div>
    </div>
  )
}

export function DialogHead({
  title,
  tags,
  lines,
  actions,
  onClose,
}: {
  title: ReactNode
  tags?: ReactNode
  lines?: ReactNode[]
  actions?: ReactNode
  onClose: () => void
}) {
  return (
    <div className="dialog-head">
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span className="dialog-title">{title}</span>
          {tags}
        </div>
        {(lines ?? []).map((l, i) => (
          <div key={i} style={{ fontSize: i === 0 ? 14 : 13, color: "var(--color-neutral-700)", marginTop: i === 0 ? 2 : 0 }}>
            {l}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, flex: "none" }}>
        {actions}
        <button type="button" className="btn btn-secondary btn-icon" onClick={onClose} aria-label="关闭">
          ×
        </button>
      </div>
    </div>
  )
}

/** A left-aligned key/value list with 2px top rule (dialog "核对金额" style). */
export function Lines({ rows, total }: { rows: Array<{ label: ReactNode; value: ReactNode; strong?: boolean; muted?: boolean }>; total?: { label: ReactNode; value: ReactNode; color?: string } }) {
  return (
    <div style={{ fontSize: 13, borderTop: "2px solid var(--color-divider)" }}>
      {rows.map((r, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", borderBottom: "1px solid var(--color-line)", fontWeight: r.strong ? 800 : 400, color: r.muted ? "var(--color-neutral-600)" : undefined }}>
          <span>{r.label}</span>
          <span style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{r.value}</span>
        </div>
      ))}
      {total ? (
        <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 0", fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 20 }}>
          <span>{total.label}</span>
          <span style={{ color: total.color }}>{total.value}</span>
        </div>
      ) : null}
    </div>
  )
}

export function Spinner({ label = "读取中…" }: { label?: string }) {
  return <div className="empty">{label}</div>
}

export const PhoneIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
)

export const SearchIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
)
