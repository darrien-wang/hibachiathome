"use client"

import { useCallback, useEffect, useState } from "react"
import { adminJson } from "./api"
import { Kicker } from "./ui"
import { askConfirm } from "./ask"
import { stamp } from "./helpers"
import { passkeyErrorText, passkeysSupported, registerThisDevice } from "./passkey-client"
import type { PublicActor } from "@/lib/workbench-perms"

// 记住的设备 (设置页). Lists the member's passkeys, adds this device, removes one.

type Passkey = { id: string; device_name: string | null; created_at: string; last_used_at: string | null }

export function PasskeySection({ adminKey, viewer }: { adminKey: string; viewer: PublicActor | null }) {
  const [keys, setKeys] = useState<Passkey[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [supported, setSupported] = useState(false)
  const session = viewer?.via === "session"

  const load = useCallback(async () => {
    if (!session) return
    try {
      const d = await adminJson<{ passkeys: Passkey[] }>(adminKey, "/api/admin/auth/me")
      setKeys(d.passkeys ?? [])
    } catch {
      setKeys([])
    }
  }, [adminKey, session])
  useEffect(() => {
    setSupported(passkeysSupported())
    void load()
  }, [load])

  const add = async () => {
    setBusy("add")
    setMsg(null)
    try {
      const name = await registerThisDevice()
      setMsg(`已记住：${name}`)
      await load()
    } catch (e) {
      setMsg(passkeyErrorText(e))
    } finally {
      setBusy(null)
    }
  }
  const remove = async (k: Passkey) => {
    if (!(await askConfirm({ title: "删除通行密钥", message: `删掉「${k.device_name ?? "这台设备"}」的通行密钥？那台设备下次要重新收短信登录。`, okLabel: "删除", danger: true }))) return
    setBusy(k.id)
    try {
      await adminJson(adminKey, "/api/admin/members", { body: { action: "delete_passkey", passkey_id: k.id } })
      await load()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "失败")
    } finally {
      setBusy(null)
    }
  }

  return (
    <section style={{ borderTop: "2px solid var(--color-divider)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
      <h4 style={{ margin: 0 }}>记住的设备（通行密钥）</h4>
      {!session ? (
        <div style={{ fontSize: 13, color: "var(--color-neutral-600)" }}>你现在是用密钥进来的。用手机号在 /admin/login 登录后，才能把设备记成通行密钥。</div>
      ) : (
        <>
          <div style={{ fontSize: 13, color: "var(--color-neutral-600)" }}>记住后，这台设备用面容、指纹或 PIN 直接登录，不用再收短信。每台设备记一次。</div>
          <div style={{ display: "flex", flexDirection: "column", borderTop: "1px solid var(--color-line)" }}>
            {keys === null ? <div style={{ padding: "8px 0", fontSize: 13 }}>读取中…</div> : null}
            {keys?.length === 0 ? <div style={{ padding: "8px 0", fontSize: 13, color: "var(--color-neutral-600)" }}>还没有记住任何设备。</div> : null}
            {(keys ?? []).map((k) => (
              <div key={k.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--color-line)", fontSize: 13 }}>
                <strong>{k.device_name ?? "设备"}</strong>
                <span style={{ color: "var(--color-neutral-600)", fontSize: 12 }}>
                  记于 {stamp(k.created_at)}
                  {k.last_used_at ? ` · 最近用 ${stamp(k.last_used_at)}` : ""}
                </span>
                <button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }} disabled={!!busy} onClick={() => void remove(k)}>
                  删
                </button>
              </div>
            ))}
          </div>
          <div>
            <button type="button" className="btn btn-secondary btn-sm" disabled={!!busy || !supported} onClick={() => void add()}>
              {busy === "add" ? "等设备确认…" : "记住这台设备"}
            </button>
            {!supported ? <span style={{ fontSize: 12, color: "var(--color-neutral-600)", marginLeft: 8 }}>这个浏览器不支持通行密钥。</span> : null}
          </div>
        </>
      )}
      {msg ? <div style={{ fontSize: 12, color: "var(--color-accent-700)" }}>{msg}</div> : null}
      <Kicker>说明</Kicker>
      <div style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>通行密钥只认 realhibachi.com 这个站点，钓鱼网站拿不到。手机丢了就在这里删掉它，或者让管理员把你从所有设备退出。</div>
    </section>
  )
}
