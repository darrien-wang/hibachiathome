"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { Dialog } from "./ui"

// 确认 / 输入 / 提示 — the workbench's own replacement for window.confirm,
// window.prompt and window.alert (2026-09-21: those showed up as the browser's
// unstyled boxes). Call sites await askConfirm / askPrompt / tell; <AskHost />
// is mounted once by the workbench and shows one box at a time. With no host
// mounted (a page outside the workbench) the calls fall back to the browser.

type Base = {
  title?: string
  message?: ReactNode
  okLabel?: string
  cancelLabel?: string
  /** The confirm is destructive: the primary button reads as such. */
  danger?: boolean
}
type PromptOpts = Base & { placeholder?: string; defaultValue?: string; inputMode?: "text" | "decimal" }
type Req =
  | (Base & { id: number; kind: "confirm"; resolve: (ok: boolean) => void })
  | (PromptOpts & { id: number; kind: "prompt"; resolve: (value: string | null) => void })
  | (Base & { id: number; kind: "alert"; resolve: () => void })

let push: ((r: Req) => void) | null = null
let seq = 0
const plain = (m: ReactNode | undefined) => (typeof m === "string" ? m : "")

export function askConfirm(o: Base & { message: ReactNode }): Promise<boolean> {
  if (!push) return Promise.resolve(window.confirm(`${o.title ? `${o.title}\n` : ""}${plain(o.message)}`))
  const p = push
  return new Promise((resolve) => p({ ...o, id: ++seq, kind: "confirm", resolve }))
}

export function askPrompt(o: PromptOpts): Promise<string | null> {
  if (!push) return Promise.resolve(window.prompt(plain(o.message) || o.title || "", o.defaultValue ?? ""))
  const p = push
  return new Promise((resolve) => p({ ...o, id: ++seq, kind: "prompt", resolve }))
}

export function tell(o: Base & { message: ReactNode }): Promise<void> {
  if (!push) {
    window.alert(`${o.title ? `${o.title}\n` : ""}${plain(o.message)}`)
    return Promise.resolve()
  }
  const p = push
  return new Promise((resolve) => p({ ...o, id: ++seq, kind: "alert", resolve }))
}

export function AskHost() {
  const [queue, setQueue] = useState<Req[]>([])
  useEffect(() => {
    push = (r) => setQueue((q) => [...q, r])
    return () => {
      push = null
    }
  }, [])
  const current = queue[0]
  if (!current) return null
  return <AskDialog key={current.id} req={current} onDone={() => setQueue((q) => q.slice(1))} />
}

function AskDialog({ req, onDone }: { req: Req; onDone: () => void }) {
  const [value, setValue] = useState(req.kind === "prompt" ? (req.defaultValue ?? "") : "")
  const inputRef = useRef<HTMLInputElement | null>(null)
  const okRef = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    // Enter confirms straight away: the input for a prompt, the primary button otherwise.
    if (req.kind === "prompt") {
      inputRef.current?.focus()
      inputRef.current?.select()
    } else okRef.current?.focus()
  }, [req.kind])

  const settle = (ok: boolean) => {
    if (req.kind === "confirm") req.resolve(ok)
    else if (req.kind === "prompt") req.resolve(ok ? value : null)
    else req.resolve()
    onDone()
  }
  const title = req.title ?? (req.kind === "alert" ? "提示" : "请确认")
  const okLabel = req.okLabel ?? (req.kind === "alert" ? "好" : "确定")

  return (
    <Dialog onClose={() => settle(false)} width={440}>
      <div className="dialog-col" style={{ gap: 14, padding: "20px 22px 18px" }}>
        <div className="dialog-title" style={{ fontSize: 20 }}>{title}</div>
        {req.message ? (
          <div style={{ fontSize: 14, lineHeight: 1.65, whiteSpace: "pre-wrap", wordBreak: "break-word", color: "var(--color-neutral-800)" }}>{req.message}</div>
        ) : null}
        {req.kind === "prompt" ? (
          <input
            ref={inputRef}
            className="input"
            value={value}
            placeholder={req.placeholder}
            inputMode={req.inputMode === "decimal" ? "decimal" : undefined}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) settle(true)
            }}
          />
        ) : null}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
          {req.kind !== "alert" ? (
            <button type="button" className="btn btn-secondary" onClick={() => settle(false)}>
              {req.cancelLabel ?? "取消"}
            </button>
          ) : null}
          <button ref={okRef} type="button" className="btn btn-primary" style={req.danger ? { background: "var(--color-accent-700)" } : undefined} onClick={() => settle(true)}>
            {okLabel}
          </button>
        </div>
      </div>
    </Dialog>
  )
}
