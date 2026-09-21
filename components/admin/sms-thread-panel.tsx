"use client"

import { useCallback, useEffect, useRef, useState } from "react"

// ============================================================
// The SMS conversation with one customer, anywhere in the admin.
// ============================================================
// Reads the thread from /api/admin/sms-thread (which reads Twilio, the only
// complete record of what was said) and sends replies through the same
// route, so a reply typed here is written to the lead's timeline exactly
// like one typed on the lead page. Built 2026-09-18 for the order drawer;
// 2026-09-21 restyled for the workbench (modernist tokens) and given quick
// replies, an insert slot for generated links, and an onSent hook so the
// lead dialog can mark the first response. Pass leadId when you have one:
// the thread then also covers a second number merged into that lead, and
// the reply is logged against it.

type SmsMessage = {
  sid: string
  direction: "inbound" | "outbound"
  body: string
  at: string
  status: string
  media: number
  peer: string
}

export type QuickReplyChip = { id: string; label: string; body: string }

const PT = "America/Los_Angeles"

function stamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { timeZone: PT, month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })
}

// One MMS attachment. Twilio keeps them behind basic auth, so the bytes come
// through /api/admin/sms-media with the admin key in a header and are handed
// to the tag as a blob URL. Videos get a player, images a thumbnail that
// opens full size.
function Attachment({ adminKey, sid, index }: { adminKey: string; sid: string; index: number }) {
  const [url, setUrl] = useState<string | null>(null)
  const [type, setType] = useState<string>("")
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let revoked: string | null = null
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/admin/sms-media?sid=${encodeURIComponent(sid)}&i=${index}`, {
          headers: { "x-admin-key": adminKey },
        })
        if (!res.ok) throw new Error(String(res.status))
        const blob = await res.blob()
        if (cancelled) return
        revoked = URL.createObjectURL(blob)
        setType(blob.type)
        setUrl(revoked)
      } catch {
        if (!cancelled) setFailed(true)
      }
    })()
    return () => {
      cancelled = true
      if (revoked) URL.revokeObjectURL(revoked)
    }
  }, [adminKey, sid, index])

  if (failed) return <div style={{ fontSize: 12, opacity: 0.7 }}>附件打不开</div>
  if (!url) return <div style={{ fontSize: 12, opacity: 0.6 }}>附件加载中…</div>
  // Carriers transcode MMS video to 3GPP (H.263/AMR), which no browser can
  // decode - a <video> tag there is just a black box. Offer the file instead;
  // it plays on a phone, and the same file is emailed to the inbox.
  if (type.startsWith("video/") || type.startsWith("audio/")) {
    const playable = /^(video\/(mp4|webm|ogg)|audio\/(mpeg|mp4|ogg|wav))$/.test(type)
    if (playable) {
      return <video src={url} controls playsInline style={{ maxWidth: 240, display: "block", marginTop: 6 }} />
    }
    return (
      <a href={url} download={`mms-${sid}-${index + 1}.3gp`} style={{ display: "inline-block", marginTop: 6, fontSize: 12, textDecoration: "underline" }}>
        下载视频（{type.replace("video/", "")}，浏览器放不了，手机可以）
      </a>
    )
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: "block", marginTop: 6 }}>
      <img src={url} alt="客户发来的附件" style={{ maxWidth: 240, display: "block", filter: "grayscale(1) contrast(1.08)" }} />
    </a>
  )
}

export function SmsThreadPanel({
  adminKey,
  phone,
  leadId,
  peerLabel,
  compact = false,
  quickReplies,
  fillTemplate,
  insert,
  onSent,
  header,
}: {
  adminKey: string
  phone: string | null | undefined
  leadId?: string | null
  peerLabel?: string | null
  /** Shorter bubbles and a smaller box, for a drawer. */
  compact?: boolean
  /** Chips above the composer; clicking one puts its text in the box. */
  quickReplies?: QuickReplyChip[]
  /** Replaces {placeholders} in a chip's text (may fetch, e.g. a deposit link). */
  fillTemplate?: (body: string) => Promise<string> | string
  /** Text pushed into the composer from outside (a generated pay link etc.). */
  insert?: { text: string; nonce: number } | null
  /** Fired after a successful send, with the sent text. */
  onSent?: (body: string) => void
  /** Optional strip above the thread (e.g. "客人在等回复"). */
  header?: React.ReactNode
}) {
  const [messages, setMessages] = useState<SmsMessage[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [filling, setFilling] = useState<string | null>(null)
  const boxRef = useRef<HTMLDivElement | null>(null)
  const textRef = useRef<HTMLTextAreaElement | null>(null)

  const load = useCallback(async () => {
    if (!phone && !leadId) {
      setMessages([])
      return
    }
    setError(null)
    try {
      const qs = new URLSearchParams()
      if (leadId) qs.set("leadId", leadId)
      if (phone) qs.set("phone", phone)
      const res = await fetch(`/api/admin/sms-thread?${qs.toString()}`, { headers: { "x-admin-key": adminKey }, cache: "no-store" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(String(data.error ?? res.status))
        setMessages([])
        return
      }
      setMessages(Array.isArray(data.messages) ? data.messages : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "load failed")
      setMessages([])
    }
  }, [adminKey, phone, leadId])

  useEffect(() => {
    setMessages(null)
    setDraft("")
    void load()
  }, [load])

  // Keep the newest message in view.
  useEffect(() => {
    const el = boxRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  useEffect(() => {
    if (!insert || !insert.text) return
    setDraft((d) => (d.trim() ? `${d.trimEnd()}\n${insert.text}` : insert.text))
    textRef.current?.focus()
  }, [insert])

  const send = useCallback(async () => {
    const body = draft.trim()
    if (!phone || !body || sending) return
    setSending(true)
    try {
      const post = (force: boolean) =>
        fetch("/api/admin/sms-thread", {
          method: "POST",
          headers: { "content-type": "application/json", "x-admin-key": adminKey },
          body: JSON.stringify({ phone, body, leadId: leadId ?? undefined, force }),
        })
      let res = await post(false)
      let data = await res.json().catch(() => ({}))
      // A brake is a rule, not an error: show why and let the owner overrule it.
      if (res.status === 409 && data.brake && window.confirm(`${data.error}。\n\n仍然发送？`)) {
        res = await post(true)
        data = await res.json().catch(() => ({}))
      }
      if (!res.ok) {
        if (res.status !== 409) window.alert(`发送失败：${data.error ?? res.status}`)
        return
      }
      setDraft("")
      await load()
      onSent?.(body)
    } finally {
      setSending(false)
    }
  }, [adminKey, phone, leadId, draft, sending, load, onSent])

  const pick = useCallback(
    async (chip: QuickReplyChip) => {
      setFilling(chip.id)
      try {
        const text = fillTemplate ? await fillTemplate(chip.body) : chip.body
        setDraft(text)
        textRef.current?.focus()
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "模板填不上")
      } finally {
        setFilling(null)
      }
    },
    [fillTemplate],
  )

  const label = peerLabel && peerLabel.trim() ? peerLabel.trim() : "客户"
  const canSend = !!phone && !sending && !!draft.trim()

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
      {header}
      <div
        ref={boxRef}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: compact ? "10px 0" : "14px 0",
          flex: 1,
          overflowY: "auto",
          minHeight: compact ? 160 : 220,
          maxHeight: compact ? 300 : 400,
        }}
      >
        {messages === null && <p className="empty">读取短信中…</p>}
        {messages !== null && messages.length === 0 && (
          <p className="empty">{error ? `读不到短信：${error}` : phone ? "还没有短信往来" : "没有手机号"}</p>
        )}
        {(messages ?? []).map((m) => {
          const mine = m.direction === "outbound"
          return (
            <div key={m.sid} className={mine ? "wb-bubble-us" : "wb-bubble-them"}>
              <div>{m.body}</div>
              {m.media > 0 && Array.from({ length: m.media }).map((_, i) => <Attachment key={`${m.sid}-${i}`} adminKey={adminKey} sid={m.sid} index={i} />)}
              <div className="wb-bubble-meta" style={{ textAlign: mine ? "right" : "left" }}>
                {mine ? "我们 · 213" : label} · {stamp(m.at)}
                {mine && m.status && m.status !== "delivered" ? ` · ${m.status}` : ""}
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ paddingTop: 10, borderTop: "2px solid var(--color-divider)", display: "flex", flexDirection: "column", gap: 8 }}>
        {quickReplies && quickReplies.length > 0 ? (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {quickReplies.map((c) => (
              <button key={c.id} type="button" className="wb-chip wb-chip-sm" disabled={!!filling || !phone} onClick={() => void pick(c)} title={c.body}>
                {filling === c.id ? "…" : c.label}
              </button>
            ))}
          </div>
        ) : null}
        <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
          <textarea
            ref={textRef}
            className="input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={phone ? "回复客人…（Ctrl/⌘+Enter 发送，从 213 线发出，自动记进线索时间线）" : "没有手机号，无法发短信"}
            disabled={!phone || sending}
            rows={compact ? 2 : 3}
            style={{ flex: 1, minHeight: 44 }}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void send()
            }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <button type="button" className="btn btn-primary" onClick={() => void send()} disabled={!canSend}>
              {sending ? "发送中…" : "发送"}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => void load()} title="重新读取">
              刷新
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
