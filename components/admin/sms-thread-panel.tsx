"use client"

import { useCallback, useEffect, useState } from "react"

// ============================================================
// The SMS conversation with one customer, anywhere in the admin.
// ============================================================
// Reads the thread from /api/admin/sms-thread (which reads Twilio, the only
// complete record of what was said) and sends replies through the same
// route, so a reply typed here is written to the lead's timeline exactly
// like one typed on the lead page. Built 2026-09-18 so the order drawer can
// show the conversation instead of sending the owner to the lead page for
// it. Pass leadId when you have one: the thread then also covers a second
// number merged into that lead, and the reply is logged against it.

type SmsMessage = {
  sid: string
  direction: "inbound" | "outbound"
  body: string
  at: string
  status: string
  media: number
  peer: string
}

const PT = "America/Los_Angeles"

function stamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { timeZone: PT, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
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

  if (failed) return <div style={{ fontSize: 12, color: "#b91c1c" }}>附件打不开</div>
  if (!url) return <div style={{ fontSize: 12, color: "#9ca3af" }}>附件加载中…</div>
  // Carriers transcode MMS video to 3GPP (H.263/AMR), which no browser can
  // decode - a <video> tag there is just a black box. Offer the file instead;
  // it plays on a phone, and the same file is emailed to the inbox.
  if (type.startsWith("video/") || type.startsWith("audio/")) {
    const playable = /^(video\/(mp4|webm|ogg)|audio\/(mpeg|mp4|ogg|wav))$/.test(type)
    if (playable) {
      return <video src={url} controls playsInline style={{ maxWidth: 240, borderRadius: 10, display: "block", marginTop: 6 }} />
    }
    return (
      <a
        href={url}
        download={`mms-${sid}-${index + 1}.3gp`}
        style={{ display: "inline-block", marginTop: 6, fontSize: 12, color: "#1d4ed8", textDecoration: "underline" }}
      >
        下载视频（{type.replace("video/", "")}，浏览器放不了，手机可以）
      </a>
    )
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: "block", marginTop: 6 }}>
      <img src={url} alt="客户发来的附件" style={{ maxWidth: 240, borderRadius: 10, display: "block" }} />
    </a>
  )
}

export function SmsThreadPanel({
  adminKey,
  phone,
  leadId,
  peerLabel,
  compact = false,
}: {
  adminKey: string
  phone: string | null | undefined
  leadId?: string | null
  peerLabel?: string | null
  /** Shorter bubbles and a smaller box, for a drawer. */
  compact?: boolean
}) {
  const [messages, setMessages] = useState<SmsMessage[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)

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
    } finally {
      setSending(false)
    }
  }, [adminKey, phone, leadId, draft, sending, load])

  const label = peerLabel && peerLabel.trim() ? peerLabel.trim() : "客户"

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          maxHeight: compact ? 320 : 480,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          padding: 10,
          background: "#f9fafb",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
        }}
      >
        {messages === null && <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>读取短信中…</p>}
        {messages !== null && messages.length === 0 && (
          <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>{error ? `读不到短信：${error}` : phone ? "还没有短信往来" : "没有手机号"}</p>
        )}
        {(messages ?? []).map((m) => {
          const mine = m.direction === "outbound"
          return (
            <div key={m.sid} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
              <div
                style={{
                  maxWidth: "82%",
                  padding: "7px 11px",
                  borderRadius: 14,
                  fontSize: compact ? 13 : 14,
                  lineHeight: 1.45,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  background: mine ? "#fdeee2" : "#ffffff",
                  border: `1px solid ${mine ? "#fbd7bd" : "#e5e7eb"}`,
                  color: "#1f2937",
                }}
              >
                {m.body}
                {m.media > 0 &&
                  Array.from({ length: m.media }).map((_, i) => (
                    <Attachment key={`${m.sid}-${i}`} adminKey={adminKey} sid={m.sid} index={i} />
                  ))}
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 3, textAlign: mine ? "right" : "left" }}>
                  {mine ? "我们（213）" : label} · {stamp(m.at)}
                  {mine && m.status && m.status !== "delivered" ? ` · ${m.status}` : ""}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={phone ? "回短信（从 213 线发出，自动记进线索时间线）" : "没有手机号，无法发短信"}
          disabled={!phone || sending}
          rows={2}
          style={{ flex: 1, padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 10, fontSize: 13, resize: "vertical", fontFamily: "inherit" }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void send()
          }}
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={!phone || sending || !draft.trim()}
          style={{
            padding: "8px 14px",
            borderRadius: 10,
            border: "none",
            background: !phone || sending || !draft.trim() ? "#e5e7eb" : "#ea580c",
            color: !phone || sending || !draft.trim() ? "#9ca3af" : "#fff",
            fontWeight: 600,
            fontSize: 13,
            cursor: !phone || sending || !draft.trim() ? "default" : "pointer",
          }}
        >
          {sending ? "发送中…" : "发送"}
        </button>
        <button
          type="button"
          onClick={() => void load()}
          title="重新读取"
          style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #d1d5db", background: "#fff", fontSize: 13, cursor: "pointer" }}
        >
          刷新
        </button>
      </div>
    </div>
  )
}
