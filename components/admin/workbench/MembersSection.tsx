"use client"

import { useCallback, useEffect, useState } from "react"
import { adminJson } from "./api"
import { Field, Kicker } from "./ui"
import { prettyPhone, stamp } from "./helpers"
import { PERM_KEYS, PERM_LABELS, ROLE_LABELS, type MemberRole, type Perms } from "@/lib/workbench-perms"

// 成员与权限 (设置页, 管理员可见). Members log in at /admin/login with an SMS
// code; admins see everything, agents get the toggles below. Every change
// goes through /api/admin/members, which also drops the member's cached
// session so the new perms apply on their next request.

type Member = {
  id: string
  name: string
  phone: string
  role: MemberRole
  perms: Perms
  active: boolean
  created_at: string
  last_login_at: string | null
  passkeys: number
  sessions: number
}

const EMPTY_FORM = { name: "", phone: "", role: "agent" as MemberRole, perms: { board: false, chef_sensitive: false, sms: true } as Perms }

export function MembersSection({ adminKey, selfId }: { adminKey: string; selfId: string | null }) {
  const [members, setMembers] = useState<Member[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    try {
      const d = await adminJson<{ members: Member[] }>(adminKey, "/api/admin/members")
      setMembers(d.members ?? [])
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "读取失败")
    }
  }, [adminKey])
  useEffect(() => {
    void load()
  }, [load])

  const post = async (key: string, body: Record<string, unknown>, done?: string) => {
    setBusy(key)
    setMsg(null)
    try {
      const d = await adminJson<{ members: Member[] }>(adminKey, "/api/admin/members", { body })
      if (d.members) setMembers(d.members)
      if (done) setMsg(done)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "失败")
    } finally {
      setBusy(null)
    }
  }

  const togglePerm = (m: Member, k: keyof Perms) => post(`perm:${m.id}:${k}`, { action: "update", id: m.id, perms: { ...m.perms, [k]: !m.perms[k] } })
  const setRole = (m: Member, role: MemberRole) => post(`role:${m.id}`, { action: "update", id: m.id, role, perms: m.perms })

  return (
    <section style={{ borderTop: "2px solid var(--color-divider)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h4 style={{ margin: 0 }}>成员与权限</h4>
        <span style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>成员用手机号在 /admin/login 收验证码登录，登录后可以把自己的手机或电脑记成通行密钥。管理员什么都能看；坐席默认看不到看板和厨师的工价证件。</span>
        <button type="button" className="btn btn-secondary btn-sm" style={{ marginLeft: "auto" }} onClick={() => setAdding((v) => !v)}>
          {adding ? "收起" : "添加成员"}
        </button>
      </div>

      {adding ? (
        <form
          className="notice"
          style={{ display: "flex", flexDirection: "column", gap: 10 }}
          onSubmit={(e) => {
            e.preventDefault()
            void post("create", { action: "create", ...form }, "已添加，让他用这个手机号登录").then(() => {
              setForm(EMPTY_FORM)
              setAdding(false)
            })
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 140px", gap: 8 }}>
            <Field label="名字">
              <input className="input" value={form.name} required onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="手机（收验证码）">
              <input className="input" value={form.phone} required inputMode="tel" placeholder="(562) 713-4832" onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="角色">
              <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as MemberRole })}>
                <option value="agent">坐席</option>
                <option value="admin">管理员</option>
              </select>
            </Field>
          </div>
          {form.role === "agent" ? (
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 13 }}>
              {PERM_KEYS.map((k) => (
                <label key={k} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="checkbox" checked={form.perms[k]} onChange={(e) => setForm({ ...form, perms: { ...form.perms, [k]: e.target.checked } })} />
                  {PERM_LABELS[k]}
                </label>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>管理员拥有全部权限，包括这个成员列表。</div>
          )}
          <div>
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy === "create"}>
              {busy === "create" ? "添加中…" : "添加"}
            </button>
          </div>
        </form>
      ) : null}

      {members === null ? (
        <div className="empty">读取中…</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", borderTop: "2px solid var(--color-divider)" }}>
          {members.map((m) => {
            const self = m.id === selfId
            return (
              <div key={m.id} style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 0", borderBottom: "1px solid var(--color-line)", opacity: m.active ? 1 : 0.55 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <strong>{m.name}</strong>
                  <span className="mono" style={{ fontSize: 12 }}>{prettyPhone(m.phone)}</span>
                  <select className="input" style={{ width: "auto", padding: "2px 6px", fontSize: 12 }} value={m.role} disabled={self || !!busy} onChange={(e) => void setRole(m, e.target.value as MemberRole)}>
                    <option value="admin">{ROLE_LABELS.admin}</option>
                    <option value="agent">{ROLE_LABELS.agent}</option>
                  </select>
                  {self ? <span className="tag tag-ink">你自己</span> : null}
                  {!m.active ? <span className="tag tag-faint">已停用</span> : null}
                  <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--color-neutral-600)", whiteSpace: "nowrap" }}>
                    {m.last_login_at ? `最近登录 ${stamp(m.last_login_at)}` : "还没登录过"} · 通行密钥 {m.passkeys} · 在线设备 {m.sessions}
                  </span>
                </div>
                {m.role === "agent" ? (
                  <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 13 }}>
                    {PERM_KEYS.map((k) => (
                      <label key={k} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <input type="checkbox" checked={m.perms[k]} disabled={!!busy} onChange={() => void togglePerm(m, k)} />
                        {PERM_LABELS[k]}
                      </label>
                    ))}
                  </div>
                ) : null}
                {!self ? (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy || m.sessions === 0} onClick={() => window.confirm(`把 ${m.name} 从所有设备上退出登录？`) && void post(`kick:${m.id}`, { action: "revoke_sessions", id: m.id }, "已退出他的所有设备")}>
                      退出所有设备
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => (m.active ? window.confirm(`停用 ${m.name}？他会立刻登不上。`) && void post(`off:${m.id}`, { action: "update", id: m.id, active: false }, "已停用") : void post(`on:${m.id}`, { action: "update", id: m.id, active: true }, "已启用"))}>
                      {m.active ? "停用" : "启用"}
                    </button>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
      {msg ? <div style={{ fontSize: 12, color: "var(--color-accent-700)" }}>{msg}</div> : null}
      <Kicker>提醒</Kicker>
      <div style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>改了角色或权限后，对方下一次请求就生效；停用会立刻退出他的所有设备。密钥登录（ADMIN_DASH_KEY / AGENT_DASH_KEYS）仍然有效，给脚本用。</div>
    </section>
  )
}
