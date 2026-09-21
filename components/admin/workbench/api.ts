"use client"

import { useCallback, useEffect, useState } from "react"

// The admin key lives in localStorage under rh_admin_key (same as the
// softphone and the old pages); a ?key= in the URL is saved and scrubbed so
// a shared link never keeps the secret in the address bar or in history.
export const ADMIN_KEY_STORAGE = "rh_admin_key"

export function readAdminKey(): string {
  try {
    return localStorage.getItem(ADMIN_KEY_STORAGE) ?? ""
  } catch {
    return ""
  }
}

export function useAdminKey(): { key: string; ready: boolean; setKey: (k: string) => void; clearKey: () => void } {
  const [key, setKeyState] = useState("")
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let k = ""
    try {
      const url = new URL(window.location.href)
      const fromUrl = url.searchParams.get("key")
      if (fromUrl) {
        localStorage.setItem(ADMIN_KEY_STORAGE, fromUrl)
        url.searchParams.delete("key")
        window.history.replaceState({}, "", url.toString())
      }
      k = readAdminKey()
    } catch {}
    setKeyState(k)
    setReady(true)
  }, [])
  const setKey = useCallback((k: string) => {
    try {
      localStorage.setItem(ADMIN_KEY_STORAGE, k)
    } catch {}
    setKeyState(k)
  }, [])
  const clearKey = useCallback(() => {
    try {
      localStorage.removeItem(ADMIN_KEY_STORAGE)
    } catch {}
    setKeyState("")
  }, [])
  return { key, ready, setKey, clearKey }
}

export class AdminApiError extends Error {
  status: number
  data: Record<string, unknown>
  constructor(status: number, data: Record<string, unknown>) {
    super(String(data.error ?? `HTTP ${status}`))
    this.status = status
    this.data = data
  }
}

/** Where an unauthenticated browser goes; keeps the page it wanted. */
export function loginUrl(): string {
  return `/admin/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`
}

/**
 * JSON call against /api/admin/*. The key header is sent when this browser
 * has one; otherwise the login-session cookie (SMS / passkey login) carries
 * the identity. Throws AdminApiError on !ok; a 401 with no key means the
 * session is gone, so the browser is sent to the login page.
 */
export async function adminJson<T = Record<string, unknown>>(
  key: string,
  path: string,
  init?: { method?: string; body?: unknown; signal?: AbortSignal },
): Promise<T> {
  const res = await fetch(path, {
    method: init?.method ?? (init?.body !== undefined ? "POST" : "GET"),
    headers: { ...(key ? { "x-admin-key": key } : {}), ...(init?.body !== undefined ? { "content-type": "application/json" } : {}) },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
    credentials: "same-origin",
    signal: init?.signal,
  })
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (res.status === 401 && !key && typeof window !== "undefined" && !window.location.pathname.startsWith("/admin/login")) {
    window.location.replace(loginUrl())
  }
  if (!res.ok) throw new AdminApiError(res.status, data)
  return data as T
}
