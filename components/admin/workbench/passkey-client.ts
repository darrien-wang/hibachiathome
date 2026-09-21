"use client"

import { browserSupportsWebAuthn, startAuthentication, startRegistration } from "@simplewebauthn/browser"

// Browser side of 记住设备 (passkeys). The login page and the settings page
// share these so both do exactly the same dance with /api/admin/auth/passkey.

/** localStorage flag: this browser registered a passkey once (drives the login page's default button). */
export const PASSKEY_FLAG = "rh_wb_passkey"
export const LAST_PHONE = "rh_wb_phone"

export const passkeysSupported = () => typeof window !== "undefined" && browserSupportsWebAuthn()

export function markPasskeyRegistered() {
  try {
    localStorage.setItem(PASSKEY_FLAG, "1")
  } catch {}
}

export function deviceLabel(): string {
  const ua = navigator.userAgent
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "设备"
  const browser = /CriOS|Chrome/.test(ua) && !/Edg/.test(ua) ? "Chrome" : /Edg/.test(ua) ? "Edge" : /Safari/.test(ua) ? "Safari" : /Firefox|FxiOS/.test(ua) ? "Firefox" : ""
  return [os, browser].filter(Boolean).join(" · ")
}

async function post<T = Record<string, unknown>>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch("/api/admin/auth/passkey", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), cache: "no-store" })
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok || data.ok === false) throw new Error(String(data.error ?? `HTTP ${res.status}`))
  return data as T
}

/** Turns a WebAuthn error into something a person can act on. */
export function passkeyErrorText(e: unknown): string {
  const name = e instanceof Error ? e.name : ""
  const msg = e instanceof Error ? e.message : String(e)
  if (name === "NotAllowedError" || /not allowed|cancel/i.test(msg)) return "已取消，或这台设备上没有这个站点的通行密钥"
  if (name === "InvalidStateError") return "这台设备已经记住过了"
  return msg || "失败"
}

/** Registers this device for the logged-in member. Resolves to the stored device name. */
export async function registerThisDevice(): Promise<string> {
  const { options } = await post<{ options: Parameters<typeof startRegistration>[0]["optionsJSON"] }>({ action: "register-options" })
  const response = await startRegistration({ optionsJSON: options })
  const d = await post<{ deviceName?: string }>({ action: "register", response, deviceName: deviceLabel() })
  markPasskeyRegistered()
  return d.deviceName ?? deviceLabel()
}

/** Logs in with a passkey. Phone is optional: it narrows the prompt to that member's keys. */
export async function loginWithPasskey(phone?: string): Promise<{ name: string }> {
  const { options } = await post<{ options: Parameters<typeof startAuthentication>[0]["optionsJSON"] }>({ action: "login-options", phone: phone || undefined })
  const response = await startAuthentication({ optionsJSON: options })
  const d = await post<{ viewer?: { name?: string } }>({ action: "login", response })
  markPasskeyRegistered()
  return { name: d.viewer?.name ?? "" }
}
