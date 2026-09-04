"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import type { Call, Device } from "@twilio/voice-sdk"
import { startLiveCaptions, type CaptionHandle, type CaptionLine } from "@/lib/live-captions"
import { SoftphoneMobileDrawer, useIsMobile } from "./SoftphoneMobileDrawer"

export type SoftphoneStatus = "idle" | "connecting" | "ready" | "error"

export type SoftphoneLive =
  | { kind: "none" }
  | { kind: "incoming"; call: Call; from: string }
  | { kind: "active"; call: Call; peer: string; direction: "in" | "out" }

type SoftphoneContextValue = {
  status: SoftphoneStatus
  identity: string
  canDialOut: boolean
  message: string
  live: SoftphoneLive
  muted: boolean
  seconds: number
  inputDevices: { id: string; label: string }[]
  selectedInputId: string
  inputLevel: number
  drawerOpen: boolean
  setDrawerOpen: (open: boolean) => void
  stickyOffline: boolean
  dialDraft: string
  setDialDraft: (value: string) => void
  smsDraft: { to: string; body: string }
  setSmsDraft: (draft: { to: string; body: string }) => void
  prefill: (number: string, mode?: "call" | "sms") => void
  captions: CaptionLine[]
  captionsOn: boolean
  captionStatus: string
  toggleCaptions: () => Promise<void>
  lastCall: { peer: string; direction: "in" | "out"; seconds: number } | null
  dismissLastCall: () => void
  setInputDevice: (deviceId: string) => Promise<void>
  goOnline: () => Promise<void>
  goOffline: () => void
  dial: (rawNumber: string) => Promise<void>
  toggleMute: () => void
  hangUp: () => void
  accept: () => void
  reject: () => void
}

const SoftphoneContext = createContext<SoftphoneContextValue | null>(null)

export function useSoftphone(): SoftphoneContextValue {
  const ctx = useContext(SoftphoneContext)
  if (!ctx) throw new Error("useSoftphone must be used inside <SoftphoneProvider>")
  return ctx
}

// Remembers a deliberate "go offline", so auto-online never overrides someone
// who switched the phone off on purpose.
const OFFLINE_KEY = "rh_phone_offline"

export function prettyNumber(raw: string): string {
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(raw)
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : raw || "未知号码"
}

// Accepts "2137707788", "213-770-7788" or "+12137707788" -> "+12137707788".
export function toE164(input: string): string | null {
  const trimmed = input.trim()
  if (/^\+[1-9]\d{7,14}$/.test(trimmed)) return trimmed
  const digits = trimmed.replace(/\D/g, "")
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`
  return null
}

// A denied mic can mean two very different things, and telling them apart is
// the difference between a fixable click and an unfixable one: the browser
// refuses silently either way, with no prompt.
async function describeMicFailure(error: unknown): Promise<string> {
  const msg = error instanceof Error ? error.message : String(error)
  const name = error instanceof Error ? error.name : ""

  if (name === "NotFoundError" || msg.includes("Requested device not found")) {
    return "没有找到麦克风设备，请检查耳机或麦克风是否插好"
  }
  if (name !== "NotAllowedError" && !msg.includes("Permission denied") && !msg.includes("NotAllowed")) {
    return msg
  }

  // Permissions-Policy denies the mic at the page level: no site setting can
  // override it, so say that instead of sending someone into Chrome settings.
  let state = ""
  try {
    state = (await navigator.permissions.query({ name: "microphone" as PermissionName })).state
  } catch {
    // Permissions API unavailable (Safari); fall through to the generic hint.
  }
  if (state === "denied") {
    return "麦克风被浏览器拒绝且不会弹窗。若站点设置里已允许仍然如此，说明是页面的 Permissions-Policy 头禁用了麦克风，需要改服务端配置——把这条信息发给技术同事。"
  }
  return "浏览器没有麦克风权限。点地址栏左侧图标 → Reset permissions，刷新页面后再点上线，这次会弹出授权提示。"
}

export function SoftphoneProvider({ children }: { children: ReactNode }) {
  const [adminKey, setAdminKey] = useState("")
  const [status, setStatus] = useState<SoftphoneStatus>("idle")
  const [message, setMessage] = useState("")
  const [identity, setIdentity] = useState("")
  const [canDialOut, setCanDialOut] = useState(false)
  const [live, setLive] = useState<SoftphoneLive>({ kind: "none" })
  const [muted, setMuted] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [inputDevices, setInputDevices] = useState<{ id: string; label: string }[]>([])
  const [selectedInputId, setSelectedInputId] = useState("")
  const [inputLevel, setInputLevel] = useState(0)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [stickyOffline, setStickyOffline] = useState(false)
  const [dialDraft, setDialDraft] = useState("")
  const [smsDraft, setSmsDraft] = useState({ to: "", body: "" })
  const [captions, setCaptions] = useState<CaptionLine[]>([])
  const [captionsOn, setCaptionsOn] = useState(false)
  const [captionStatus, setCaptionStatus] = useState("")

  const [lastCall, setLastCall] = useState<
    { peer: string; direction: "in" | "out"; seconds: number } | null
  >(null)

  const deviceRef = useRef<Device | null>(null)
  const captionHandles = useRef<CaptionHandle[]>([])
  // clearCall runs from SDK callbacks that closed over an older render, so the
  // details of the call that just ended have to be read from refs.
  const liveRef = useRef<SoftphoneLive>({ kind: "none" })
  const secondsRef = useRef(0)
  const captionsRef = useRef<CaptionLine[]>([])

  // Same sign-in scheme as the leads workbench: ?key=... once, then localStorage.
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("key")
    if (fromUrl) {
      window.localStorage.setItem("rh_admin_key", fromUrl)
      setAdminKey(fromUrl)
      return
    }
    setAdminKey(window.localStorage.getItem("rh_admin_key") ?? "")
  }, [])

  useEffect(() => {
    liveRef.current = live
  }, [live])
  useEffect(() => {
    secondsRef.current = seconds
  }, [seconds])
  useEffect(() => {
    captionsRef.current = captions
  }, [captions])

  const fetchToken = useCallback(async (key: string) => {
    const res = await fetch("/api/twilio/token", { headers: { "x-admin-key": key } })
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(body.error ?? `令牌获取失败 (${res.status})`)
    }
    return (await res.json()) as { token: string; identity: string; canDialOut: boolean }
  }, [])

  useEffect(() => {
    if (live.kind !== "active") {
      setSeconds(0)
      return
    }
    const t = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [live.kind])

  const stopCaptions = useCallback(() => {
    captionHandles.current.forEach((h) => h.stop())
    captionHandles.current = []
    setCaptionsOn(false)
    setCaptionStatus("")
  }, [])

  const clearCall = useCallback(() => {
    // The moment a call ends is when the notes matter most: the address and
    // headcount were said seconds ago and are not written down yet. Keep the
    // note box, the transcript and who it was about on screen until they are
    // dismissed, instead of clearing the panel out from under whoever is
    // still typing. Only the billed connection stops immediately.
    const ended = liveRef.current
    if (ended.kind === "active") {
      setLastCall({ peer: ended.peer, direction: ended.direction, seconds: secondsRef.current })
    }
    setLive({ kind: "none" })
    setMuted(false)
    // Captions bill by the minute, so the connection must never outlive the
    // call — but the lines already transcribed stay on screen.
    stopCaptions()
  }, [stopCaptions])

  const dismissLastCall = useCallback(() => {
    setLastCall(null)
    setCaptions([])
  }, [])

  const wireCall = useCallback(
    (call: Call, peer: string, direction: "in" | "out") => {
      call.on("accept", () => setLive({ kind: "active", call, peer, direction }))
      call.on("disconnect", clearCall)
      call.on("cancel", clearCall)
      call.on("reject", clearCall)
      call.on("error", (e: { message?: string }) => {
        setMessage(`通话出错：${e?.message ?? "未知错误"}`)
        clearCall()
      })
    },
    [clearCall]
  )

  const goOnline = useCallback(async () => {
    if (deviceRef.current) return
    if (!adminKey) {
      setMessage("需要先登录：在网址后面加 ?key=你的管理密钥")
      setStatus("error")
      return
    }
    setStatus("connecting")
    setMessage("")
    try {
      try {
        window.localStorage.removeItem(OFFLINE_KEY)
        setStickyOffline(false)
      } catch {
        // Same as above: not being able to remember is not a reason to fail.
      }
      // Ask for the mic up front so the browser prompt is not a surprise mid-call,
      // then release it immediately: leaving these tracks live keeps the device
      // open, and on drivers that capture exclusively the SDK's own stream then
      // comes up silent — you hear the caller, the caller does not hear you.
      const probe = await navigator.mediaDevices.getUserMedia({ audio: true })
      probe.getTracks().forEach((track) => track.stop())

      const { token, identity: id, canDialOut: dialOutAllowed } = await fetchToken(adminKey)
      const { Device: TwilioDevice } = await import("@twilio/voice-sdk")

      const device = new TwilioDevice(token, {
        codecPreferences: ["opus", "pcmu"] as never,
        logLevel: "error",
      })

      device.on("registered", () => {
        setStatus("ready")
        setMessage("")
      })
      device.on("error", (e: { message?: string }) =>
        setMessage(`设备错误：${e?.message ?? "未知错误"}`)
      )
      device.on("incoming", (call: Call) => {
        const from = call.parameters.From ?? ""
        wireCall(call, from, "in")
        setLastCall(null)
        setCaptions([])
        setLive({ kind: "incoming", call, from })
        // A ringing customer is the one thing that must never sit behind a
        // closed panel, whatever page you happen to be working on.
        setDrawerOpen(true)
      })
      // Tokens live 1h; refresh before expiry so a long shift does not drop.
      device.on("tokenWillExpire", async () => {
        try {
          const fresh = await fetchToken(adminKey)
          device.updateToken(fresh.token)
        } catch {
          setMessage("令牌续期失败，请重新上线")
        }
      })

      await device.register()

      // inputVolume reports the level of the stream the SDK is actually sending,
      // so a flat meter while you speak means the far end hears nothing either.
      const audio = device.audio
      if (audio) {
        const refreshDevices = () => {
          const list: { id: string; label: string }[] = []
          audio.availableInputDevices?.forEach((info: MediaDeviceInfo, id: string) => {
            list.push({ id, label: info.label || "未命名麦克风" })
          })
          setInputDevices(list)
        }
        refreshDevices()
        audio.on("deviceChange", refreshDevices)
        audio.on("inputVolume", (volume: number) => setInputLevel(volume))
        setSelectedInputId(audio.inputDevice?.deviceId ?? "")
      }

      deviceRef.current = device
      setIdentity(id)
      setCanDialOut(dialOutAllowed)
    } catch (error) {
      setStatus("error")
      setMessage(await describeMicFailure(error))
    }
  }, [adminKey, fetchToken, wireCall])

  // The phone should be on by default: a customer service line that needs a
  // click every morning is a line that is silently down whenever someone
  // forgets. It only auto-connects when the mic was already granted — asking
  // for it on page load would pop a prompt nobody asked for, and browsers
  // reject the request anyway when it comes out of nowhere. An explicit
  // "下线" is remembered and always wins.
  useEffect(() => {
    if (!adminKey || deviceRef.current || status !== "idle") return

    let cancelled = false
    void (async () => {
      try {
        if (window.localStorage.getItem(OFFLINE_KEY) === "1") {
          setStickyOffline(true)
          return
        }
        const permission = await navigator.permissions.query({
          name: "microphone" as PermissionName,
        })
        if (permission.state !== "granted" || cancelled) return
        await goOnline()
      } catch {
        // No Permissions API (Safari) — leave it to the button rather than
        // gambling on a prompt the user did not ask for.
      }
    })()

    return () => {
      cancelled = true
    }
  }, [adminKey, status, goOnline])

  const setInputDevice = useCallback(async (deviceId: string) => {
    const audio = deviceRef.current?.audio
    if (!audio) return
    try {
      await audio.setInputDevice(deviceId)
      setSelectedInputId(deviceId)
      setMessage("")
    } catch (error) {
      setMessage(`切换麦克风失败：${error instanceof Error ? error.message : String(error)}`)
    }
  }, [])

  const goOffline = useCallback(() => {
    try {
      window.localStorage.setItem(OFFLINE_KEY, "1")
      setStickyOffline(true)
    } catch {
      // Private mode: the phone still goes offline, it just will not be remembered.
    }
    deviceRef.current?.destroy()
    deviceRef.current = null
    setStatus("idle")
    setLive({ kind: "none" })
    setIdentity("")
    setInputLevel(0)
  }, [])

  useEffect(() => () => deviceRef.current?.destroy(), [])

  // Dialing from anywhere in the workbench: bring the device online on demand so
  // a click on a lead does not need a separate "go online" step first.
  const dial = useCallback(
    async (rawNumber: string) => {
      const to = toE164(rawNumber)
      setDrawerOpen(true)
      if (!to) {
        setMessage(`号码格式无法识别：${rawNumber}`)
        return
      }
      if (!deviceRef.current) {
        await goOnline()
      }
      const device = deviceRef.current
      if (!device) return
      setMessage("")
      try {
        const call = await device.connect({ params: { To: to } })
        setLastCall(null)
        setCaptions([])
        wireCall(call, to, "out")
        setLive({ kind: "active", call, peer: to, direction: "out" })
      } catch (error) {
        setMessage(`拨号失败：${error instanceof Error ? error.message : String(error)}`)
      }
    },
    [goOnline, wireCall]
  )

  // Clicking a customer's number should load it into the panel, not fire a call
  // and not hand the browser a tel: link (which on Windows pops the "choose an
  // app" dialog and goes nowhere useful). Dialling stays an explicit second click.
  const prefill = useCallback((number: string, mode: "call" | "sms" = "call") => {
    const normalized = toE164(number) ?? number.trim()
    if (mode === "sms") {
      setSmsDraft((draft) => ({ to: normalized, body: draft.body }))
    } else {
      setDialDraft(normalized)
    }
    setDrawerOpen(true)
  }, [])

  const toggleCaptions = useCallback(async () => {
    if (captionsOn) {
      stopCaptions()
      return
    }
    if (live.kind !== "active") return

    const adminKey = window.localStorage.getItem("rh_admin_key") ?? ""
    const remote = live.call.getRemoteStream()?.getAudioTracks()[0]
    const local = live.call.getLocalStream()?.getAudioTracks()[0]
    if (!remote) {
      setMessage("拿不到对方的音频轨，无法开字幕")
      return
    }

    const push = (line: CaptionLine) =>
      setCaptions((prev) => {
        const next = prev.filter((l) => l.id !== line.id)
        next.push(line)
        // A long call would otherwise grow without bound in memory.
        return next.slice(-60)
      })

    try {
      setCaptionsOn(true)
      const handles: CaptionHandle[] = []
      handles.push(
        await startLiveCaptions({
          track: remote, speaker: "them", adminKey, onLine: push,
          onError: setMessage, onStatus: setCaptionStatus,
        })
      )
      // Your own side is transcribed too: without it the transcript reads as
      // half a conversation and the customer's answers lose their question.
      if (local) {
        handles.push(
          await startLiveCaptions({
            track: local, speaker: "you", adminKey, onLine: push,
            onError: setMessage, onStatus: setCaptionStatus,
          })
        )
      }
      captionHandles.current = handles
    } catch (error) {
      stopCaptions()
      setMessage(`字幕启动失败：${error instanceof Error ? error.message : String(error)}`)
    }
  }, [captionsOn, live, stopCaptions])

  const toggleMute = useCallback(() => {
    if (live.kind !== "active") return
    const next = !muted
    live.call.mute(next)
    setMuted(next)
  }, [live, muted])

  // Both of these clear local state themselves instead of waiting for the SDK
  // event: the "reject"/"disconnect" callbacks do not always fire (a leg that
  // another <Dial> target answers first is simply torn down), which left the
  // ringing card on screen after the button had already done its job.
  const hangUp = useCallback(() => {
    if (live.kind === "active") live.call.disconnect()
    clearCall()
  }, [live, clearCall])

  const accept = useCallback(() => {
    if (live.kind === "incoming") live.call.accept()
  }, [live])

  const reject = useCallback(() => {
    if (live.kind === "incoming") live.call.reject()
    clearCall()
  }, [live, clearCall])

  const value = useMemo(
    () => ({
      status, identity, canDialOut, message, live, muted, seconds,
      inputDevices, selectedInputId, inputLevel, setInputDevice,
      drawerOpen, setDrawerOpen, stickyOffline,
      dialDraft, setDialDraft, smsDraft, setSmsDraft, prefill,
      captions, captionsOn, captionStatus, toggleCaptions, lastCall, dismissLastCall,
      goOnline, goOffline, dial, toggleMute, hangUp, accept, reject,
    }),
    [status, identity, canDialOut, message, live, muted, seconds,
     inputDevices, selectedInputId, inputLevel, setInputDevice,
     drawerOpen, stickyOffline, dialDraft, smsDraft, prefill,
     captions, captionsOn, captionStatus, toggleCaptions, lastCall, dismissLastCall,
     goOnline, goOffline, dial, toggleMute, hangUp, accept, reject]
  )

  return (
    <SoftphoneContext.Provider value={value}>
      {children}
      <SoftphoneDrawer />
      <SoftphoneMobileDrawer />
    </SoftphoneContext.Provider>
  )
}

const DRAWER_WIDTH = 320

function SoftphoneDrawer() {
  const {
    status, identity, canDialOut, message, live, muted, seconds,
    inputDevices, selectedInputId, inputLevel, setInputDevice,
    drawerOpen, setDrawerOpen, stickyOffline, goOnline, goOffline, dial, toggleMute, hangUp, accept, reject,
    dialDraft, setDialDraft, smsDraft, setSmsDraft,
    captions, captionsOn, captionStatus, toggleCaptions, lastCall, dismissLastCall,
  } = useSoftphone()

  const [note, setNote] = useState("")
  const [noteState, setNoteState] = useState<"idle" | "saving" | "saved" | "error">("idle")

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`
  const ringing = live.kind === "incoming"
  const busy = live.kind !== "none"
  const peerNumber =
    live.kind === "incoming" ? live.from : live.kind === "active" ? live.peer : (lastCall?.peer ?? "")
  // "There is a call in front of me" — true while connected and after it ends,
  // because the note and the transcript are still on screen and unsaved.
  const hasContext = live.kind !== "none" || Boolean(lastCall)

  const [transcriptState, setTranscriptState] = useState<"idle" | "saving" | "saved">("idle")

  const saveTranscript = async () => {
    if (!peerNumber || captions.length === 0) return
    // Only finalised lines: partials are mid-word and would read as stutter.
    const body = captions
      .filter((l) => l.final)
      .map((l) => {
        const who = l.speaker === "them" ? "客户" : "我"
        return l.translation ? `${who}: ${l.text}\n     (${l.translation})` : `${who}: ${l.text}`
      })
      .join("\n")
    if (!body.trim()) return
    setTranscriptState("saving")
    try {
      const res = await fetch("/api/admin/leads", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-admin-key": window.localStorage.getItem("rh_admin_key") ?? "",
        },
        body: JSON.stringify({
          action: "call_note",
          phone: peerNumber,
          note: `【通话记录】\n${body}`,
        }),
      })
      if (!res.ok) throw new Error(String(res.status))
      setTranscriptState("saved")
    } catch {
      setTranscriptState("idle")
    }
  }

  const saveNote = async () => {
    const text = note.trim()
    if (!text || !peerNumber) return
    setNoteState("saving")
    try {
      const res = await fetch("/api/admin/leads", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-admin-key": window.localStorage.getItem("rh_admin_key") ?? "",
        },
        body: JSON.stringify({ action: "call_note", phone: peerNumber, note: text }),
      })
      if (!res.ok) throw new Error(String(res.status))
      setNote("")
      setNoteState("saved")
      setTimeout(() => setNoteState("idle"), 2500)
    } catch {
      setNoteState("error")
    }
  }
  const dotColor = status === "ready" ? "#16a34a" : status === "connecting" ? "#d97706" : "#9ca3af"

  // Phones get SoftphoneMobileDrawer instead. This has to sit after every hook
  // above: an early return placed higher would change hook order between the
  // desktop and mobile renders.
  const isMobile = useIsMobile()
  if (isMobile) return null

  return (
    <>
      {/* Always-visible edge handle: the phone has to be one click away from
          whatever page you are on, and it doubles as the status light. */}
      <button
        onClick={() => setDrawerOpen(!drawerOpen)}
        title={drawerOpen ? "收起电话" : "打开电话"}
        style={{
          position: "fixed",
          top: "50%",
          right: drawerOpen ? DRAWER_WIDTH : 0,
          transform: "translateY(-50%)",
          zIndex: 210,
          background: ringing ? "#dc2626" : "#111827",
          color: "#fff",
          border: "none",
          borderRadius: "10px 0 0 10px",
          padding: "14px 8px",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          boxShadow: "-3px 0 12px rgba(0,0,0,.18)",
          transition: "right 180ms ease",
        }}
      >
        <span
          style={{ width: 9, height: 9, borderRadius: "50%", background: ringing ? "#fff" : dotColor }}
        />
        <span style={{ writingMode: "vertical-rl", fontSize: 12.5, fontWeight: 600, letterSpacing: 1 }}>
          {ringing ? "来电" : live.kind === "active" ? mmss : "电话"}
        </span>
      </button>

      <aside
        aria-hidden={!drawerOpen}
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: DRAWER_WIDTH,
          zIndex: 205,
          background: "#fff",
          borderLeft: "1px solid #e5e7eb",
          boxShadow: drawerOpen ? "-8px 0 28px rgba(0,0,0,.12)" : "none",
          transform: drawerOpen ? "translateX(0)" : `translateX(${DRAWER_WIDTH}px)`,
          transition: "transform 180ms ease",
          display: "flex",
          flexDirection: "column",
          fontFamily: "system-ui, sans-serif",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "14px 16px",
            borderBottom: "1px solid #e5e7eb",
            position: "sticky",
            top: 0,
            background: "#fff",
          }}
        >
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: dotColor }} />
          <strong style={{ fontSize: 14, flex: 1 }}>
            {status === "ready" ? "客服电话 · 已上线" : status === "connecting" ? "连接中…" : "客服电话 · 未上线"}
          </strong>
          <button
            onClick={() => setDrawerOpen(false)}
            style={{ background: "none", border: "none", fontSize: 20, lineHeight: 1, color: "#9ca3af", cursor: "pointer" }}
            title="收起"
          >
            ×
          </button>
        </div>

        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          {status === "ready" ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: "#6b7280", flex: 1 }}>{identity}</span>
              <button onClick={goOffline} style={btn("#6b7280", false, true)}>下线</button>
            </div>
          ) : (
            <div>
              <button
                onClick={() => void goOnline()}
                disabled={status === "connecting"}
                style={{ ...btn("#dc2626", status === "connecting"), width: "100%", padding: "11px" }}
              >
                上线接听
              </button>
              {stickyOffline ? (
                <p style={{ fontSize: 11.5, color: "#92400e", margin: "8px 0 0", lineHeight: 1.5 }}>
                  你手动下线过，所以不会自动上线。点一次「上线接听」就恢复默认。
                </p>
              ) : null}
            </div>
          )}

          {message ? (
            <p
              style={{
                background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b",
                borderRadius: 8, padding: "9px 11px", fontSize: 12.5, margin: 0, lineHeight: 1.5,
              }}
            >
              {message}
            </p>
          ) : null}

          {ringing ? (
            <div style={{ border: "2px solid #dc2626", borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, color: "#6b7280" }}>来电</div>
              <div style={{ fontSize: 19, fontWeight: 700, margin: "3px 0 10px" }}>
                {prettyNumber(live.from)}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={accept} style={{ ...btn("#16a34a"), flex: 1, padding: "10px" }}>接听</button>
                <button onClick={reject} style={{ ...btn("#6b7280"), flex: 1, padding: "10px" }}>拒接</button>
              </div>
              <p style={{ fontSize: 11, color: "#6b7280", margin: "8px 0 0", lineHeight: 1.5 }}>
                拒接只挂掉你这一路，备用手机仍会继续响——客户不会被直接掐断。
              </p>
            </div>
          ) : null}

          {live.kind === "active" ? (
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                {live.direction === "in" ? "通话中" : "去电中"} · {mmss}
              </div>
              <div style={{ fontSize: 19, fontWeight: 700, margin: "3px 0 10px" }}>
                {prettyNumber(live.peer)}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={toggleMute} style={{ ...btn(muted ? "#d97706" : "#6b7280"), flex: 1, padding: "10px" }}>
                  {muted ? "取消静音" : "静音"}
                </button>
                <button onClick={hangUp} style={{ ...btn("#dc2626"), flex: 1, padding: "10px" }}>挂断</button>
              </div>
            </div>
          ) : null}

          {live.kind === "none" && lastCall ? (
            <div
              style={{
                border: "1px solid #e5e7eb", borderRadius: 10, padding: 12,
                background: "#f9fafb",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    通话已结束 · {String(Math.floor(lastCall.seconds / 60)).padStart(2, "0")}:
                    {String(lastCall.seconds % 60).padStart(2, "0")}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>
                    {prettyNumber(lastCall.peer)}
                  </div>
                </div>
                <button onClick={dismissLastCall} style={btn("#9ca3af", false, true)}>关闭</button>
              </div>
              {captions.length > 0 ? (
                <button
                  onClick={() => void saveTranscript()}
                  disabled={transcriptState === "saving"}
                  style={{ ...btn("#111827", transcriptState === "saving", true), marginTop: 10 }}
                >
                  {transcriptState === "saving"
                    ? "保存中…"
                    : transcriptState === "saved"
                      ? "✓ 已存入线索"
                      : "把通话记录存进线索"}
                </button>
              ) : null}
              <p style={{ fontSize: 11.5, color: "#6b7280", margin: "8px 0 0", lineHeight: 1.5 }}>
                速记和通话记录都还在，存完再关。
              </p>
            </div>
          ) : null}

          {hasContext && peerNumber ? (
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600, display: "block", marginBottom: 6 }}>
                通话速记
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => {
                  // Ctrl/Cmd+Enter saves without reaching for the mouse mid-call.
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void saveNote()
                }}
                placeholder="边听边记：日期、人数、地址、忌口…"
                rows={4}
                style={{
                  width: "100%", padding: "9px 10px", border: "1px solid #d1d5db",
                  borderRadius: 8, fontSize: 13, resize: "vertical", fontFamily: "inherit",
                  boxSizing: "border-box",
                }}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                <button
                  onClick={() => void saveNote()}
                  disabled={!note.trim() || noteState === "saving"}
                  style={btn("#111827", !note.trim() || noteState === "saving", true)}
                >
                  {noteState === "saving" ? "保存中…" : "存到线索"}
                </button>
                <span style={{ fontSize: 11.5, color: noteState === "error" ? "#991b1b" : "#6b7280" }}>
                  {noteState === "saved"
                    ? "已存入时间线"
                    : noteState === "error"
                      ? "保存失败，内容还在框里"
                      : "Ctrl+Enter 保存"}
                </span>
              </div>
            </div>
          ) : null}

          {live.kind === "active" || captions.length > 0 ? (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <label style={{ fontSize: 12.5, fontWeight: 600, flex: 1 }}>
                  {live.kind === "active" ? "实时字幕" : "通话记录"}
                </label>
                {live.kind === "active" ? (
                  <button
                    onClick={() => void toggleCaptions()}
                    style={btn(captionsOn ? "#d97706" : "#2563eb", false, true)}
                  >
                    {captionsOn ? "停止" : "开字幕"}
                  </button>
                ) : null}
              </div>
              {captionsOn || captions.length > 0 ? (
                <div
                  style={{
                    maxHeight: 220, overflowY: "auto", border: "1px solid #e5e7eb",
                    borderRadius: 8, padding: 10, background: "#fafafa",
                    display: "flex", flexDirection: "column", gap: 8,
                  }}
                >
                  {captions.length === 0 ? (
                    <span style={{ fontSize: 12, color: "#9ca3af" }}>
                      {captionStatus || "等待说话…"}
                    </span>
                  ) : null}
                  {captions.map((line) => (
                    <div key={line.id}>
                      <div
                        style={{
                          fontSize: 12.5,
                          color: line.speaker === "them" ? "#111827" : "#6b7280",
                          opacity: line.final ? 1 : 0.6,
                          lineHeight: 1.5,
                        }}
                      >
                        <strong style={{ fontSize: 11 }}>
                          {line.speaker === "them" ? "客户" : "你"}
                        </strong>{" "}
                        {line.text}
                      </div>
                      {line.translation ? (
                        <div style={{ fontSize: 12.5, color: "#2563eb", lineHeight: 1.5, marginTop: 2 }}>
                          {line.translation}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 11.5, color: "#6b7280", margin: 0, lineHeight: 1.5 }}>
                  按分钟计费，只在听不清时开。开启后客户和你的话都会转写，蓝色是中文翻译。
                </p>
              )}
            </div>
          ) : null}

          {status === "ready" ? (
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600, display: "block", marginBottom: 6 }}>
                拨打电话
              </label>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  value={dialDraft}
                  onChange={(e) => setDialDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !busy) void dial(dialDraft)
                  }}
                  placeholder="562-713-4832"
                  inputMode="tel"
                  style={{
                    flex: 1, padding: "9px 10px", border: "1px solid #d1d5db",
                    borderRadius: 8, fontSize: 15, minWidth: 0,
                  }}
                />
                <button
                  onClick={() => void dial(dialDraft)}
                  disabled={busy || !dialDraft.trim()}
                  style={btn("#16a34a", busy || !dialDraft.trim())}
                >
                  拨号
                </button>
              </div>
              {!canDialOut ? (
                <p style={{ color: "#92400e", fontSize: 11.5, margin: "8px 0 0" }}>
                  还没配置 TWILIO_TWIML_APP_SID，目前只能接听、不能外拨。
                </p>
              ) : null}
            </div>
          ) : null}

          {smsDraft.to ? (
            <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 14 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, display: "block", marginBottom: 6 }}>
                短信草稿 · {prettyNumber(smsDraft.to)}
              </label>
              <textarea
                value={smsDraft.body}
                onChange={(e) => setSmsDraft({ to: smsDraft.to, body: e.target.value })}
                placeholder="先把要说的写好，等 A2P 注册通过就能直接发"
                rows={3}
                style={{
                  width: "100%", padding: "9px 10px", border: "1px solid #d1d5db",
                  borderRadius: 8, fontSize: 13, resize: "vertical", fontFamily: "inherit",
                  boxSizing: "border-box",
                }}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                <button
                  onClick={() => {
                    void navigator.clipboard?.writeText(smsDraft.body)
                  }}
                  disabled={!smsDraft.body.trim()}
                  style={btn("#6b7280", !smsDraft.body.trim(), true)}
                >
                  复制
                </button>
                <button
                  onClick={() => setSmsDraft({ to: "", body: "" })}
                  style={btn("#9ca3af", false, true)}
                >
                  清空
                </button>
              </div>
              {/* Outbound SMS stays disabled until the A2P 10DLC campaign is
                  approved: an unregistered send is blocked by the carriers
                  (error 30034), so a send button here would only ever fail. */}
              <p style={{ fontSize: 11.5, color: "#92400e", margin: "8px 0 0", lineHeight: 1.5 }}>
                A2P 10DLC 注册通过前发不出去，运营商会直接拦截。先写好、复制出去用手机发。
              </p>
            </div>
          ) : null}

          {status === "ready" ? (
            <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 14 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, display: "block", marginBottom: 6 }}>
                麦克风
              </label>
              <select
                value={selectedInputId}
                onChange={(e) => void setInputDevice(e.target.value)}
                style={{
                  width: "100%", padding: "8px 9px", border: "1px solid #d1d5db",
                  borderRadius: 8, fontSize: 13, background: "#fff",
                }}
              >
                {inputDevices.length === 0 ? <option value="">（读取设备中…）</option> : null}
                {inputDevices.map((d) => (
                  <option key={d.id} value={d.id}>{d.label}</option>
                ))}
              </select>
              {/* Level of the stream the SDK is actually sending, so a flat bar
                  while you talk means the far end hears nothing either. */}
              <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11.5, color: "#6b7280", whiteSpace: "nowrap" }}>输入音量</span>
                <div style={{ flex: 1, height: 8, borderRadius: 999, background: "#f3f4f6", overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${Math.min(100, Math.round(inputLevel * 100))}%`,
                      height: "100%",
                      background: inputLevel > 0.02 ? "#16a34a" : "#d1d5db",
                      transition: "width 90ms linear",
                    }}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </aside>
    </>
  )
}

function btn(bg: string, disabled = false, small = false): React.CSSProperties {
  return {
    background: disabled ? "#d1d5db" : bg,
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: small ? "6px 12px" : "9px 14px",
    fontSize: small ? 12.5 : 13.5,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    whiteSpace: "nowrap",
  }
}
