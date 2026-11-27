"use client"

import { useEffect, useRef, useState } from "react"
import { filledSummary, type ChatTurn } from "@/lib/stocktake-ai"
import type { CountLine, CustomSpec, RestockLevel } from "@/lib/stocktake"

// 盘点页顶上的助手（老板 2026-11-26）：点一下说话、再点一下说完；或者直接打字。
// 说的东西变成每样的几行填进下面的卡片，问题在这里问；什么都不会自动提交。

type Reply = {
  ok: boolean
  error?: string
  heard?: string
  say?: string
  questions?: string[]
  items?: Array<{ key: string; mode: "replace" | "add"; lines: CountLine[] }>
  restock?: Array<{ key: string; level: RestockLevel }>
  specs?: CustomSpec[]
}

export function VoiceAssist({
  url,
  draft,
  levels,
  onApply,
}: {
  url: string
  draft: Record<string, CountLine[]>
  levels: Record<string, RestockLevel>
  onApply: (r: { items: NonNullable<Reply["items"]>; restock: NonNullable<Reply["restock"]>; specs: CustomSpec[] }) => void
}) {
  const [turns, setTurns] = useState<Array<ChatTurn & { filled?: string[] }>>([])
  const [phase, setPhase] = useState<"idle" | "rec" | "busy">("idle")
  const [secs, setSecs] = useState(0)
  const [text, setText] = useState("")
  const [err, setErr] = useState<string | null>(null)
  const rec = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const canRecord = typeof window !== "undefined" && typeof window.MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current)
    rec.current?.stream.getTracks().forEach((t) => t.stop())
  }, [])

  const send = async (audio: Blob | null, typed: string) => {
    setPhase("busy")
    setErr(null)
    try {
      const fd = new FormData()
      if (audio) fd.append("audio", audio, audio.type.includes("mp4") ? "speech.mp4" : "speech.webm")
      if (typed) fd.append("text", typed)
      fd.append("state", JSON.stringify({ draft, levels, history: turns.map(({ who, text }) => ({ who, text })) }))
      const r = await fetch(url, { method: "POST", body: fd })
      const j = (await r.json().catch(() => ({}))) as Reply
      if (j.heard) setTurns((t) => [...t, { who: "chef", text: j.heard! }])
      if (!r.ok || !j.ok) throw new Error(j.error ?? `HTTP ${r.status}`)
      const items = j.items ?? []
      onApply({ items, restock: j.restock ?? [], specs: j.specs ?? [] })
      const say = [j.say, ...(j.questions ?? [])].filter(Boolean).join("\n")
      setTurns((t) => [...t, { who: "ai", text: say || (items.length ? "填好了，看一下对不对。" : "没听出要记什么，再说一遍？"), filled: filledSummary(items) }])
      setText("")
    } catch (e) {
      setErr(e instanceof Error ? e.message : "没成")
    } finally {
      setPhase("idle")
    }
  }

  const start = async () => {
    setErr(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const type = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : ""
      const r = type ? new MediaRecorder(stream, { mimeType: type }) : new MediaRecorder(stream)
      chunks.current = []
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data)
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        if (timer.current) clearInterval(timer.current)
        const blob = new Blob(chunks.current, { type: r.mimeType || type || "audio/webm" })
        if (blob.size > 0) void send(blob, "")
        else setPhase("idle")
      }
      r.start()
      rec.current = r
      setSecs(0)
      timer.current = setInterval(() => setSecs((s) => (s >= 120 ? (r.state === "recording" && r.stop(), s) : s + 1)), 1000)
      setPhase("rec")
    } catch {
      setErr("用不了麦克风：浏览器问的时候点「允许」；不行就打字")
    }
  }
  const stop = () => {
    if (rec.current?.state === "recording") rec.current.stop()
    setPhase("busy")
  }

  return (
    <div className="card" style={{ gap: 10, padding: 12, background: "var(--color-neutral-100)" }}>
      <div style={{ fontWeight: 800 }}>说给助手听</div>
      <div style={{ fontSize: 12.5, color: "var(--color-neutral-700)", lineHeight: 1.5 }}>
        比如「CK 三盘整的，还有一盘散的两磅半；毛豆 12 盎司的四包，16 盎司的两包；酱油快没了」。它帮你填进下面，你看一眼再提交。
      </div>
      {turns.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto" }}>
          {turns.map((t, i) => (
            <div key={i} style={{ alignSelf: t.who === "chef" ? "flex-end" : "flex-start", maxWidth: "88%", background: t.who === "chef" ? "var(--color-text)" : "var(--color-bg)", color: t.who === "chef" ? "var(--color-bg)" : "var(--color-text)", padding: "8px 10px", fontSize: 14, lineHeight: 1.45, whiteSpace: "pre-line" }}>
              {t.text}
              {t.filled?.length ? <div style={{ marginTop: 6, fontSize: 12.5, color: "var(--color-neutral-700)" }}>{t.filled.map((f) => `✓ ${f}`).join("\n")}</div> : null}
            </div>
          ))}
        </div>
      ) : null}
      {err ? <div style={{ fontSize: 13, color: "var(--color-accent-700)" }}>{err}</div> : null}
      <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
        {canRecord ? (
          <button
            type="button"
            className={phase === "rec" ? "btn btn-primary" : "btn btn-secondary"}
            style={{ minHeight: 52, flex: "0 0 auto", padding: "0 16px", fontSize: 15 }}
            disabled={phase === "busy"}
            onClick={() => (phase === "rec" ? stop() : void start())}
          >
            {phase === "rec" ? `● 说完了（${secs}s）` : phase === "busy" ? "在听…" : "🎤 点一下说"}
          </button>
        ) : null}
        <input
          className="input"
          value={text}
          placeholder="或者打字…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229 && text.trim() && phase === "idle") void send(null, text.trim())
          }}
          style={{ minHeight: 52, fontSize: 16, flex: 1, minWidth: 0 }}
        />
        <button type="button" className="btn btn-secondary" style={{ minHeight: 52 }} disabled={!text.trim() || phase !== "idle"} onClick={() => void send(null, text.trim())}>
          发
        </button>
      </div>
    </div>
  )
}
