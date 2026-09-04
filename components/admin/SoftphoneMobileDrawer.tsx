"use client"

// 手机端客服电话：底部抽屉。
//
// 桌面端的右侧抽屉在手机上会退化成一条很长的滚动列表——上线、来电、速记、
// 字幕、拨号、麦克风同时在场，按钮 32px 上下。这里保留完全相同的功能和
// 同一套 useSoftphone() 状态，只把它按状态拆成六屏：
//
//   未上线 / 待机 / 来电响铃 / 通话中 / 通话已结束待保存 / 外呼拨号（+短信草稿）
//
// 规则：每屏只放当下要做的事；主操作固定在底栏拇指区，最小 56px、主按钮
// 68px、接听 84px；下线、麦克风、输入音量、Ctrl+Enter 提示常驻但不占主视觉；
// 每屏最多一个红色主按钮。

import { useEffect, useMemo, useRef, useState } from "react"
import { prettyNumber, useSoftphone } from "./SoftphoneProvider"

/* 视觉常量。要换成站点现有的灰/红（#111827 / #dc2626 / radius 8）只改这里。 */
const INK = "#201e1d"
const GROUND = "#f3f2f2"
const RED = "#ec3013"
const RED_DEEP = "#ae1800"
const MUTED = "#605d5d"
const FAINT = "#7d7979"
const LINE = "rgba(32,30,29,0.25)"
const RULE = `2px solid ${INK}`
const FONT = '"Archivo", system-ui, -apple-system, "Noto Sans SC", sans-serif'

export function useIsMobile(query = "(max-width: 640px)"): boolean {
  const [is, setIs] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const sync = () => setIs(mq.matches)
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [query])
  return is
}

type Screen = "auto" | "dial" | "sms"

export function SoftphoneMobileDrawer() {
  const {
    status, identity, canDialOut, message, live, muted, seconds,
    inputDevices, selectedInputId, inputLevel, setInputDevice,
    drawerOpen, setDrawerOpen, stickyOffline,
    goOnline, goOffline, dial, toggleMute, hangUp, accept, reject,
    dialDraft, setDialDraft, smsDraft, setSmsDraft,
    captions, captionsOn, captionStatus, toggleCaptions, lastCall, dismissLastCall,
  } = useSoftphone()

  const isMobile = useIsMobile()
  const [screen, setScreen] = useState<Screen>("auto")
  const [note, setNote] = useState("")
  const [noteState, setNoteState] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle")
  const noteRef = useRef<HTMLTextAreaElement | null>(null)

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`
  const ringing = live.kind === "incoming"
  const active = live.kind === "active"
  const peerNumber = ringing ? live.from : active ? live.peer : (lastCall?.peer ?? "")

  // 响铃和通话中不允许停在拨号/短信屏：这两个状态必须自己占满抽屉。
  useEffect(() => {
    if (ringing || active) setScreen("auto")
  }, [ringing, active])

  const phase = useMemo(() => {
    if (screen === "dial") return "dial" as const
    if (screen === "sms") return "sms" as const
    if (ringing) return "ringing" as const
    if (active) return "active" as const
    if (lastCall) return "wrapup" as const
    if (status === "ready") return "standby" as const
    return "offline" as const
  }, [screen, ringing, active, lastCall, status])

  const patchLead = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/admin/leads", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-admin-key": window.localStorage.getItem("rh_admin_key") ?? "",
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(String(res.status))
  }

  const saveNote = async () => {
    const text = note.trim()
    if (!text || !peerNumber) return
    setNoteState("saving")
    try {
      await patchLead({ action: "call_note", phone: peerNumber, note: text })
      setNote("")
      setNoteState("saved")
      setTimeout(() => setNoteState("idle"), 2500)
    } catch {
      setNoteState("error")
    }
  }

  // 待保存屏的主操作：速记和通话记录一次都存进去，不用按两个按钮。
  const saveEverything = async () => {
    if (!peerNumber) return
    const text = note.trim()
    const transcript = captions
      .filter((l) => l.final)
      .map((l) => {
        const who = l.speaker === "them" ? "客户" : "我"
        return l.translation ? `${who}: ${l.text}\n     (${l.translation})` : `${who}: ${l.text}`
      })
      .join("\n")
    if (!text && !transcript.trim()) return
    setSaveState("saving")
    try {
      if (text) await patchLead({ action: "call_note", phone: peerNumber, note: text })
      if (transcript.trim()) {
        await patchLead({ action: "call_note", phone: peerNumber, note: `【通话记录】\n${transcript}` })
      }
      setNote("")
      setSaveState("saved")
    } catch {
      setSaveState("idle")
      setNoteState("error")
    }
  }

  const appendChip = (label: string) => {
    setNote((prev) => (prev ? `${prev.replace(/\s*$/, "")}\n${label}：` : `${label}：`))
    noteRef.current?.focus()
  }

  if (!isMobile) return null

  const dotColor = status === "ready" ? RED : status === "connecting" ? FAINT : "#bab6b6"
  const headerRed = ringing || active
  const sheetHeight = ringing ? "94vh" : active ? "92vh" : "88vh"

  return (
    <>
      {/* 折叠时的常驻状态条：电话永远离当前页面一步之远，也是状态灯。 */}
      <button
        onClick={() => setDrawerOpen(true)}
        style={{
          position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 210,
          height: 60, display: drawerOpen ? "none" : "flex", alignItems: "center", gap: 10,
          padding: "0 16px", paddingBottom: "env(safe-area-inset-bottom)",
          background: headerRed ? RED : INK, color: GROUND,
          border: 0, borderRadius: 0, cursor: "pointer", font: `800 16px ${FONT}`, textAlign: "left",
        }}
      >
        <span style={{ width: 10, height: 10, background: GROUND, flex: "none" }} />
        <span style={{ flex: 1 }}>
          {ringing ? "来电 · 点开接听" : active ? `通话中 · ${mmss}` : lastCall ? "通话已结束 · 待保存" : status === "ready" ? "客服电话 · 已上线" : "客服电话 · 未上线"}
        </span>
        <Chevron up color={GROUND} />
      </button>

      {drawerOpen ? (
        <div
          onClick={() => { if (!ringing) setDrawerOpen(false) }}
          style={{ position: "fixed", inset: 0, zIndex: 205, background: "rgba(32,30,29,0.55)" }}
        />
      ) : null}

      <aside
        aria-hidden={!drawerOpen}
        style={{
          position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 206,
          height: sheetHeight, maxHeight: "94vh",
          transform: drawerOpen ? "translateY(0)" : "translateY(101%)",
          transition: "transform 200ms ease",
          background: GROUND, color: INK, borderTop: RULE, borderRadius: 0,
          display: "flex", flexDirection: "column", fontFamily: FONT, overflow: "hidden",
        }}
      >
        {/* 顶栏：响铃/通话中整条转红，余光就能判断状态 */}
        {headerRed ? (
          <div style={{ flex: "none", height: 52, background: RED, color: GROUND, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 10, height: 10, background: GROUND }} />
              <strong style={{ fontSize: 17 }}>{ringing ? "来电" : "通话中"}</strong>
            </span>
            {active ? (
              <span style={{ fontSize: 20, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{mmss}</span>
            ) : null}
          </div>
        ) : (
          <>
            <button
              onClick={() => setDrawerOpen(false)}
              aria-label="收起"
              style={{ flex: "none", height: 24, border: 0, background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            >
              <span style={{ width: 56, height: 4, background: "rgba(32,30,29,0.4)" }} />
            </button>
            <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 10, padding: "0 16px 12px", borderBottom: RULE }}>
              {phase === "dial" || phase === "sms" ? (
                <>
                  <button onClick={() => setScreen("auto")} aria-label="返回" style={iconBtn}>
                    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={2}><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                  </button>
                  <strong style={{ fontSize: 17, flex: 1 }}>{phase === "dial" ? "拨打电话" : "短信草稿"}</strong>
                </>
              ) : (
                <>
                  <span style={{ width: 10, height: 10, background: dotColor, flex: "none" }} />
                  <strong style={{ fontSize: 17, whiteSpace: "nowrap" }}>
                    {phase === "wrapup" ? "通话已结束" : status === "ready" ? "已上线" : status === "connecting" ? "连接中…" : "未上线"}
                  </strong>
                  {phase === "wrapup" ? (
                    <span style={{ marginLeft: "auto", fontSize: 17, fontWeight: 800, color: MUTED, fontVariantNumeric: "tabular-nums" }}>
                      {String(Math.floor(lastCall!.seconds / 60)).padStart(2, "0")}:{String(lastCall!.seconds % 60).padStart(2, "0")}
                    </span>
                  ) : (
                    <>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: FAINT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{identity}</span>
                      {status === "ready" ? (
                        <button onClick={goOffline} style={{ ...outlineBtn, height: 44, flex: "none" }}>下线</button>
                      ) : null}
                    </>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {message ? (
          <p style={{ flex: "none", margin: 0, padding: "10px 16px", borderBottom: `1px solid ${LINE}`, background: "#ffe0d9", color: RED_DEEP, fontSize: 14, lineHeight: 1.5 }}>
            {message}
          </p>
        ) : null}

        {/* ——— 内容区 ——— */}
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflowY: "auto" }}>
          {phase === "offline" ? (
            <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
              <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" }}>上线后才会响铃</div>
              {stickyOffline ? (
                <div style={{ borderLeft: `2px solid ${RED}`, padding: "4px 0 4px 12px", fontSize: 15, lineHeight: 1.6, color: "#444141" }}>
                  你手动下线过，所以不会自动上线。点一次「上线接听」就恢复默认。
                </div>
              ) : null}
              <div style={{ marginTop: "auto" }}><MicRow {...{ inputDevices, selectedInputId, setInputDevice, inputLevel }} expanded /></div>
            </div>
          ) : null}

          {phase === "standby" ? (
            <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
              <div style={{ padding: "18px 16px 14px" }}>
                <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" }}>等待来电</div>
                {!canDialOut ? (
                  <div style={{ marginTop: 6, fontSize: 14, color: RED_DEEP, lineHeight: 1.55 }}>
                    还没配置 TWILIO_TWIML_APP_SID，目前只能接听、不能外拨。
                  </div>
                ) : null}
              </div>
              {smsDraft.to || smsDraft.body ? (
                <div style={{ padding: "0 16px 14px" }}>
                  <button onClick={() => setScreen("sms")} style={{ ...outlineBtn, height: 56, width: "100%", gap: 10 }}>
                    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={2} style={{ flex: "none" }}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                    <span style={{ flex: 1, textAlign: "left" }}>短信草稿</span>
                    <span style={{ fontSize: 13, fontWeight: 400, color: FAINT }}>1 条未发</span>
                    <Chevron color={MUTED} />
                  </button>
                </div>
              ) : null}
              <div style={{ padding: "0 16px 10px", fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: FAINT }}>上一通</div>
              <div style={{ borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}`, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 17, fontWeight: 700 }}>{dialDraft ? prettyNumber(dialDraft) : "没有记录"}</div>
                  <div style={{ fontSize: 14, color: MUTED }}>{dialDraft ? "点右侧直接回拨" : "从线索列表点号码带进来"}</div>
                </div>
                {dialDraft ? (
                  <button onClick={() => void dial(dialDraft)} aria-label="回拨" style={{ ...outlineBtn, width: 52, height: 52, padding: 0, justifyContent: "center", flex: "none" }}>
                    <PhoneIcon color={INK} />
                  </button>
                ) : null}
              </div>
              <div style={{ marginTop: "auto" }}><MicRow {...{ inputDevices, selectedInputId, setInputDevice, inputLevel }} /></div>
            </div>
          ) : null}

          {phase === "ringing" ? (
            <div style={{ padding: "26px 16px 0", display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", lineHeight: 1.15 }}>
                {prettyNumber(peerNumber)}
              </div>
              <div style={{ marginTop: 22, borderLeft: `2px solid ${INK}`, padding: "4px 0 4px 12px", fontSize: 15, lineHeight: 1.6, color: "#444141" }}>
                拒接只挂掉你这一路，备用手机仍会继续响——客户不会被直接掐断。
              </div>
            </div>
          ) : null}

          {phase === "active" || phase === "wrapup" ? (
            <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
              <div style={{ flex: "none", padding: "14px 16px", borderBottom: RULE }}>
                <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{prettyNumber(peerNumber)}</div>
                <div style={{ fontSize: 14, color: MUTED }}>
                  {phase === "active" ? (live.kind === "active" && live.direction === "in" ? "来电" : "去电") : "刚刚结束"}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "12px 16px 8px" }}>
                <span style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: FAINT }}>通话速记</span>
                <span style={{ fontSize: 12, color: noteState === "error" ? RED_DEEP : FAINT }}>
                  {noteState === "saved" ? "已存入时间线" : noteState === "error" ? "保存失败，内容还在框里" : "Ctrl+Enter 存到线索"}
                </span>
              </div>
              <textarea
                ref={noteRef}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void saveNote() }}
                placeholder="边听边记：日期、人数、地址、忌口…"
                style={{
                  flex: phase === "active" ? 1 : "none", minHeight: phase === "active" ? 140 : 110,
                  margin: "0 16px", padding: 14, border: RULE, borderRadius: 0, background: "#fff",
                  fontFamily: FONT, fontSize: 17, lineHeight: 1.6, resize: "none", boxSizing: "border-box",
                }}
              />
              <div style={{ display: "flex", gap: 8, padding: "10px 16px 0", overflowX: "auto" }}>
                {["日期", "人数", "地址", "忌口"].map((label) => (
                  <button key={label} onClick={() => appendChip(label)} style={chipBtn}>{label}</button>
                ))}
              </div>

              {phase === "active" ? (
                <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "16px 0 0", padding: "12px 16px", borderTop: `1px solid ${LINE}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>实时字幕</div>
                    <div style={{ fontSize: 12, color: FAINT }}>按分钟计费，听不清再开</div>
                  </div>
                  <button
                    onClick={() => void toggleCaptions()}
                    role="switch"
                    aria-checked={captionsOn}
                    style={{ width: 64, height: 40, flex: "none", border: RULE, borderRadius: 0, background: "transparent", display: "flex", alignItems: "center", justifyContent: captionsOn ? "flex-end" : "flex-start", padding: 3, cursor: "pointer" }}
                  >
                    <span style={{ width: 28, height: 28, background: captionsOn ? RED : INK, display: "block" }} />
                  </button>
                </div>
              ) : null}

              {captionsOn || captions.length > 0 ? (
                <div style={{ padding: "10px 16px 0" }}>
                  <div style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: FAINT, marginBottom: 8 }}>
                    {phase === "active" ? "实时字幕" : "通话记录"}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 240, overflowY: "auto" }}>
                    {captions.length === 0 ? (
                      <span style={{ fontSize: 14, color: FAINT }}>{captionStatus || "等待说话…"}</span>
                    ) : null}
                    {captions.map((line) => (
                      <div key={line.id} style={{ display: "flex", gap: 10, opacity: line.final ? 1 : 0.6 }}>
                        <strong style={{ width: 34, flex: "none", fontSize: 13, color: line.speaker === "them" ? INK : FAINT, paddingTop: 2 }}>
                          {line.speaker === "them" ? "客户" : "你"}
                        </strong>
                        <span style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                          <span style={{ fontSize: 15, lineHeight: 1.55 }}>{line.text}</span>
                          {line.translation ? (
                            <span style={{ fontSize: 15, lineHeight: 1.55, color: RED_DEEP }}>{line.translation}</span>
                          ) : null}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {phase === "active" ? (
                <div style={{ marginTop: "auto" }}><MicRow {...{ inputDevices, selectedInputId, setInputDevice, inputLevel }} /></div>
              ) : null}
            </div>
          ) : null}

          {phase === "dial" ? (
            <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
              <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 12, padding: "20px 16px 16px", borderBottom: RULE }}>
                <input
                  value={dialDraft}
                  onChange={(e) => setDialDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && live.kind === "none") void dial(dialDraft) }}
                  placeholder="562-713-4832"
                  inputMode="tel"
                  style={{ flex: 1, minWidth: 0, border: 0, background: "transparent", fontFamily: FONT, fontSize: 32, fontWeight: 800, letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums", padding: 0, outline: "none" }}
                />
                <button onClick={() => setDialDraft(dialDraft.slice(0, -1))} aria-label="删除" style={{ ...iconBtn, flex: "none" }}>
                  <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={2}><path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" /><path d="m18 9-6 6M12 9l6 6" /></svg>
                </button>
              </div>
              <div style={{ flex: 1, minHeight: 300, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 2, background: LINE, padding: "2px 0 0" }}>
                {[["1", ""], ["2", "ABC"], ["3", "DEF"], ["4", "GHI"], ["5", "JKL"], ["6", "MNO"], ["7", "PQRS"], ["8", "TUV"], ["9", "WXYZ"], ["*", ""], ["0", "+"], ["#", ""]].map(([digit, letters]) => (
                  <button
                    key={digit}
                    onClick={() => setDialDraft(dialDraft + digit)}
                    style={{ background: GROUND, border: 0, borderRadius: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, cursor: "pointer", fontFamily: FONT }}
                  >
                    <span style={{ fontSize: 30, fontWeight: 700 }}>{digit}</span>
                    <span style={{ fontSize: 10, letterSpacing: "0.14em", color: FAINT, minHeight: 12 }}>{letters}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {phase === "sms" ? (
            <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>发给 {prettyNumber(smsDraft.to)}</div>
              <textarea
                value={smsDraft.body}
                onChange={(e) => setSmsDraft({ to: smsDraft.to, body: e.target.value })}
                placeholder="先把要说的写好，等 A2P 注册通过就能直接发"
                style={{ flex: 1, minHeight: 160, padding: 14, border: RULE, borderRadius: 0, background: "#fff", fontFamily: FONT, fontSize: 17, lineHeight: 1.6, resize: "none", boxSizing: "border-box" }}
              />
              <div style={{ fontSize: 14, lineHeight: 1.6, color: RED_DEEP }}>
                A2P 10DLC 注册通过前发不出去，运营商会直接拦截。先写好、复制出去用手机发。
              </div>
            </div>
          ) : null}
        </div>

        {/* ——— 底栏：主操作永远在拇指区，位置固定 ——— */}
        <div style={{ flex: "none", borderTop: RULE, padding: "14px 16px calc(22px + env(safe-area-inset-bottom))", display: "flex", flexDirection: "column", gap: 10 }}>
          {phase === "offline" ? (
            <button onClick={() => void goOnline()} disabled={status === "connecting"} style={primaryBtn}>
              <PhoneIcon color={GROUND} />
              {status === "connecting" ? "连接中…" : "上线接听"}
            </button>
          ) : null}

          {phase === "standby" ? (
            <button onClick={() => setScreen("dial")} style={primaryBtn}>
              <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={GROUND} strokeWidth={2}><rect x="3" y="3" width="18" height="18" /><path d="M9 3v18M15 3v18M3 9h18M3 15h18" /></svg>
              拨打电话
            </button>
          ) : null}

          {phase === "ringing" ? (
            <>
              <button onClick={accept} style={{ ...primaryBtn, height: 84, fontSize: 24, gap: 14 }}>
                <PhoneIcon color={GROUND} size={26} />
                接听
              </button>
              <button onClick={reject} style={{ ...outlineBtn, height: 56, width: "100%", borderColor: "rgba(32,30,29,0.4)", color: "#444141" }}>拒接</button>
            </>
          ) : null}

          {phase === "active" ? (
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={toggleMute} style={{ ...outlineBtn, width: 104, height: 68, flex: "none", flexDirection: "column", alignItems: "flex-start", justifyContent: "center", gap: 2, borderColor: muted ? RED : INK, color: muted ? RED_DEEP : INK }}>
                <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={muted ? RED_DEEP : INK} strokeWidth={2}>
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  {muted ? <path d="m2 2 20 20" /> : null}
                </svg>
                <span style={{ fontSize: 14, fontWeight: 800 }}>{muted ? "已静音" : "静音"}</span>
              </button>
              <button onClick={hangUp} style={{ ...primaryBtn, flex: 1, background: INK }}>
                <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={GROUND} strokeWidth={2}><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67" /><path d="M5 5.11A2 2 0 0 1 7.11 3h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11l-1.27 1.27" /><path d="m2 2 20 20" /></svg>
                挂断
              </button>
            </div>
          ) : null}

          {phase === "wrapup" ? (
            <>
              <div style={{ fontSize: 14, color: MUTED }}>速记和通话记录都还在，存完再关。</div>
              <button onClick={() => void saveEverything()} disabled={saveState === "saving"} style={primaryBtn}>
                <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={GROUND} strokeWidth={2}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><path d="M17 21v-8H7v8M7 3v5h8" /></svg>
                {saveState === "saving" ? "保存中…" : saveState === "saved" ? "✓ 已存进线索" : "存进线索"}
              </button>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => noteRef.current?.focus()} style={{ ...outlineBtn, flex: 1, height: 56 }}>继续编辑</button>
                <button onClick={() => { dismissLastCall(); setNote(""); setSaveState("idle") }} style={{ ...outlineBtn, flex: 1, height: 56, borderColor: "rgba(32,30,29,0.4)", color: "#444141" }}>关闭</button>
              </div>
            </>
          ) : null}

          {phase === "dial" ? (
            <button onClick={() => void dial(dialDraft)} disabled={!dialDraft.trim() || live.kind !== "none"} style={primaryBtn}>
              <PhoneIcon color={GROUND} />
              呼叫
            </button>
          ) : null}

          {phase === "sms" ? (
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => { void navigator.clipboard?.writeText(smsDraft.body) }}
                disabled={!smsDraft.body.trim()}
                style={{ ...primaryBtn, flex: 1 }}
              >
                复制
              </button>
              <button onClick={() => setSmsDraft({ to: "", body: "" })} style={{ ...outlineBtn, flex: 1, height: 68, borderColor: "rgba(32,30,29,0.4)", color: "#444141" }}>清空</button>
            </div>
          ) : null}
        </div>
      </aside>
    </>
  )
}

/* ——— 常驻的麦克风 + 输入音量。平铺一行，不藏进设置。 ——— */
function MicRow({
  inputDevices, selectedInputId, setInputDevice, inputLevel, expanded = false,
}: {
  inputDevices: { id: string; label: string }[]
  selectedInputId: string
  setInputDevice: (id: string) => Promise<void>
  inputLevel: number
  expanded?: boolean
}) {
  const bar = (
    <div style={{ width: expanded ? "100%" : 88, height: 8, background: "#d7d3d3", flex: expanded ? 1 : "none" }}>
      <div style={{ width: `${Math.min(100, Math.round(inputLevel * 100))}%`, height: "100%", background: inputLevel > 0.02 ? RED : "#bab6b6", transition: "width 90ms linear" }} />
    </div>
  )

  if (expanded) {
    return (
      <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: FAINT }}>设备</div>
        <select
          value={selectedInputId}
          onChange={(e) => void setInputDevice(e.target.value)}
          style={{ height: 56, border: "2px solid rgba(32,30,29,0.4)", borderRadius: 0, background: "#fff", fontFamily: FONT, fontSize: 16, padding: "0 12px", color: INK }}
        >
          {inputDevices.length === 0 ? <option value="">默认麦克风</option> : null}
          {inputDevices.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
        </select>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, color: FAINT, whiteSpace: "nowrap" }}>输入音量</span>
          {bar}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px" }}>
      <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth={2} style={{ flex: "none" }}>
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      </svg>
      <select
        value={selectedInputId}
        onChange={(e) => void setInputDevice(e.target.value)}
        style={{ flex: 1, minWidth: 0, height: 44, border: 0, background: "transparent", fontFamily: FONT, fontSize: 14, color: "#444141" }}
      >
        {inputDevices.length === 0 ? <option value="">默认麦克风</option> : null}
        {inputDevices.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
      </select>
      {bar}
    </div>
  )
}

function PhoneIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}

function Chevron({ up = false, color = INK }: { up?: boolean; color?: string }) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} style={{ flex: "none" }}>
      <path d={up ? "M18 15l-6-6-6 6" : "M9 18l6-6-6-6"} />
    </svg>
  )
}

const primaryBtn: React.CSSProperties = {
  height: 68, width: "100%", background: RED, color: GROUND, border: 0, borderRadius: 0,
  display: "flex", alignItems: "center", gap: 12, padding: "0 18px",
  font: `800 19px ${FONT}`, cursor: "pointer", textAlign: "left",
}

const outlineBtn: React.CSSProperties = {
  border: RULE, background: "transparent", borderRadius: 0, color: INK,
  display: "flex", alignItems: "center", padding: "0 14px",
  font: `800 16px ${FONT}`, cursor: "pointer", textAlign: "left",
}

const chipBtn: React.CSSProperties = {
  height: 44, flex: "none", border: "1px solid rgba(32,30,29,0.4)", borderRadius: 0,
  background: "transparent", padding: "0 14px", font: `500 15px ${FONT}`, color: INK,
  whiteSpace: "nowrap", cursor: "pointer",
}

const iconBtn: React.CSSProperties = {
  width: 52, height: 52, border: 0, background: "transparent", borderRadius: 0,
  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
}
