"use client"

import { useEffect, useState } from "react"
import { ADMIN_KEY_STORAGE } from "@/components/admin/workbench/api"
import { LAST_PHONE, PASSKEY_FLAG, loginWithPasskey, passkeyErrorText, passkeysSupported, registerThisDevice } from "@/components/admin/workbench/passkey-client"

// 工作台登录. Phone → SMS code → session cookie; then, once, an offer to
// remember this device as a passkey so the next login is Face ID / 指纹 /
// PIN. The old key still works (folded away at the bottom) for scripts and
// for whoever is not a member yet.

type Step = "phone" | "code" | "remember"

function nextUrl(): string {
  try {
    const n = new URLSearchParams(window.location.search).get("next") ?? "/admin"
    return n.startsWith("/admin") && !n.startsWith("/admin/login") ? n : "/admin"
  } catch {
    return "/admin"
  }
}

async function post<T = Record<string, unknown>>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), cache: "no-store" })
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok || data.ok === false) throw new Error(String(data.error ?? `HTTP ${res.status}`))
  return data as T
}

export default function AdminLoginPage() {
  const [step, setStep] = useState<Step>("phone")
  const [phone, setPhone] = useState("")
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [canPasskey, setCanPasskey] = useState(false)
  const [hasPasskey, setHasPasskey] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [keyVal, setKeyVal] = useState("")

  useEffect(() => {
    setCanPasskey(passkeysSupported())
    try {
      setHasPasskey(localStorage.getItem(PASSKEY_FLAG) === "1")
      const last = localStorage.getItem(LAST_PHONE)
      if (last) setPhone(last)
    } catch {}
  }, [])

  const finish = () => window.location.replace(nextUrl())

  const sendCode = async () => {
    setBusy("send")
    setErr(null)
    setInfo(null)
    try {
      const d = await post<{ name?: string; sent?: boolean; devCode?: string }>("/api/admin/auth/send-code", { phone })
      setName(d.name ?? "")
      try {
        localStorage.setItem(LAST_PHONE, phone)
      } catch {}
      setInfo(d.devCode ? `本地开发：验证码 ${d.devCode}` : `验证码已发到你的手机，10 分钟内有效`)
      setStep("code")
    } catch (e) {
      setErr(e instanceof Error ? e.message : "失败")
    } finally {
      setBusy(null)
    }
  }

  const verify = async () => {
    setBusy("verify")
    setErr(null)
    try {
      const d = await post<{ viewer?: { name?: string } }>("/api/admin/auth/verify", { phone, code })
      setName(d.viewer?.name ?? name)
      if (canPasskey && !hasPasskey) setStep("remember")
      else finish()
    } catch (e) {
      setErr(e instanceof Error ? e.message : "失败")
    } finally {
      setBusy(null)
    }
  }

  const remember = async () => {
    setBusy("remember")
    setErr(null)
    try {
      await registerThisDevice()
      finish()
    } catch (e) {
      setErr(passkeyErrorText(e))
    } finally {
      setBusy(null)
    }
  }

  const passkeyLogin = async () => {
    setBusy("passkey")
    setErr(null)
    try {
      await loginWithPasskey(phone)
      finish()
    } catch (e) {
      setErr(passkeyErrorText(e))
    } finally {
      setBusy(null)
    }
  }

  const useKey = () => {
    const k = keyVal.trim()
    if (!k) return
    try {
      localStorage.setItem(ADMIN_KEY_STORAGE, k)
    } catch {}
    finish()
  }

  const label: React.CSSProperties = { fontSize: 12, color: "var(--color-neutral-600)", marginBottom: 4 }

  return (
    <div className="wb" style={{ alignItems: "center", justifyContent: "center", padding: 24, minHeight: "100dvh" }}>
      <div className="card" style={{ width: "min(380px, 100%)", padding: 22, gap: 14 }}>
        <div>
          <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 22 }}>Real Hibachi · 工作台</div>
          <div style={{ fontSize: 13, color: "var(--color-neutral-700)", marginTop: 4 }}>
            {step === "phone" ? "用登记过的手机号登录。" : step === "code" ? `${name ? `${name}，` : ""}输入短信里的 6 位验证码。` : `${name ? `${name}，` : ""}已登录。`}
          </div>
        </div>

        {step === "phone" ? (
          <>
            {canPasskey && hasPasskey ? (
              <button type="button" className="btn btn-primary btn-block" style={{ margin: 0 }} disabled={!!busy} onClick={() => void passkeyLogin()}>
                {busy === "passkey" ? "验证中…" : "用这台设备登录（面容 / 指纹 / PIN）"}
              </button>
            ) : null}
            <form
              style={{ display: "flex", flexDirection: "column", gap: 10 }}
              onSubmit={(e) => {
                e.preventDefault()
                void sendCode()
              }}
            >
              <div>
                <div style={label}>手机号</div>
                <input className="input" type="tel" inputMode="tel" autoComplete="tel" value={phone} placeholder="(562) 713-4832" onChange={(e) => setPhone(e.target.value)} autoFocus={!hasPasskey} />
              </div>
              <button type="submit" className={`btn ${canPasskey && hasPasskey ? "btn-secondary" : "btn-primary"} btn-block`} style={{ margin: 0 }} disabled={!!busy || phone.replace(/\D/g, "").length < 10}>
                {busy === "send" ? "发送中…" : "发验证码"}
              </button>
            </form>
            {canPasskey && !hasPasskey ? (
              <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} disabled={!!busy} onClick={() => void passkeyLogin()}>
                这台设备记住过？用通行密钥登录
              </button>
            ) : null}
          </>
        ) : null}

        {step === "code" ? (
          <form
            style={{ display: "flex", flexDirection: "column", gap: 10 }}
            onSubmit={(e) => {
              e.preventDefault()
              void verify()
            }}
          >
            <div>
              <div style={label}>验证码</div>
              <input className="input" type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="one-time-code" maxLength={6} value={code} placeholder="6 位数字" onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} autoFocus style={{ fontSize: 22, letterSpacing: "0.3em", textAlign: "center" }} />
            </div>
            <button type="submit" className="btn btn-primary btn-block" style={{ margin: 0 }} disabled={!!busy || code.length !== 6}>
              {busy === "verify" ? "登录中…" : "登录"}
            </button>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => setStep("phone")}>
                换个号码
              </button>
              <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => void sendCode()}>
                重发验证码
              </button>
            </div>
          </form>
        ) : null}

        {step === "remember" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 14 }}>要不要记住这台设备？下次直接用面容、指纹或设备 PIN 登录，不用再收短信。</div>
            <button type="button" className="btn btn-primary btn-block" style={{ margin: 0 }} disabled={!!busy} onClick={() => void remember()}>
              {busy === "remember" ? "等设备确认…" : "记住这台设备"}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} disabled={!!busy} onClick={finish}>
              先不了，进工作台
            </button>
          </div>
        ) : null}

        {info ? <div style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>{info}</div> : null}
        {err ? <div className="notice danger" style={{ fontSize: 13 }}>{err}</div> : null}

        <div style={{ borderTop: "1px solid var(--color-line)", paddingTop: 10 }}>
          <button type="button" className="btn btn-ghost btn-sm" style={{ padding: 0, fontSize: 12, color: "var(--color-neutral-600)" }} onClick={() => setShowKey((v) => !v)}>
            {showKey ? "收起" : "用密钥登录（脚本 / 老链接）"}
          </button>
          {showKey ? (
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <input className="input" type="password" value={keyVal} placeholder="密钥" onChange={(e) => setKeyVal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && useKey()} />
              <button type="button" className="btn btn-secondary" disabled={!keyVal.trim()} onClick={useKey}>
                进入
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
