"use client"

import { useCallback, useEffect, useState } from "react"
import { adminJson } from "./api"
import { askConfirm } from "./ask"
import { RESTOCK_CHECK, RESTOCK_LEVEL_LABEL, itemDef, describeTotal, lineText, cleanLine, type CountLine, type RestockLevel } from "@/lib/stocktake"

// 仓库 → 盘点（老板 2026-11-26）。师傅用自己的长期链接随时盘（/tools/stock?t=…），盘完直接写进备货的「在库」。
// 这里给老板三样：自己打开盘点页、给师傅发/收回链接、看最近谁盘了什么（和账上差了多少）。

type Staff = { id: string; name: string; role: string | null; fullTime: boolean; url: string | null }
type Hist = { id: string; countedBy: string; via: string; createdAt: string; items: Array<{ key: string; base: number | null; prev: number | null; unit: string | null; level: string | null; lines: unknown }> }
type Resp = { ok: boolean; staff: Staff[]; counts: Hist[] }

const when = (iso: string) => new Date(iso).toLocaleString("zh-CN", { timeZone: "America/Los_Angeles", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })
const MUTED = "var(--color-neutral-600)"

export default function StockCountAdmin({ adminKey }: { adminKey: string }) {
  const [d, setD] = useState<Resp | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [all, setAll] = useState(false)
  const load = useCallback(async () => {
    try {
      setD(await adminJson<Resp>(adminKey, "/api/tools/stock?view=admin"))
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "读不出来")
    }
  }, [adminKey])
  useEffect(() => void load(), [load])

  const copy = async (url: string, name: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setMsg(`${name} 的盘点链接已复制，发给他`)
    } catch {
      setMsg(url)
    }
  }
  const issue = async (s: Staff) => {
    if (s.url && !(await askConfirm({ title: `重发 ${s.name} 的盘点链接`, message: "会换一条新链接，他手上那条马上失效。", okLabel: "重发", danger: true }))) return
    const r = await adminJson<{ url: string }>(adminKey, "/api/tools/stock", { body: { action: "issue_link", staff_member_id: s.id } })
    await load()
    if (r.url) setMsg(`${s.name} 的盘点链接：${r.url}（点「复制」再发给他）`)
  }
  const revoke = async (s: Staff) => {
    if (!(await askConfirm({ title: `收回 ${s.name} 的盘点链接`, message: "他就打不开盘点页了。盘过的记录不受影响。", okLabel: "收回", danger: true }))) return
    await adminJson(adminKey, "/api/tools/stock", { body: { action: "revoke_link", staff_member_id: s.id } })
    await load()
  }

  if (!d) return <div className="empty">{msg ?? "读取中…"}</div>
  const chefs = d.staff.filter((s) => all || s.fullTime || s.url)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 900 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <a className="btn btn-primary" href="/tools/stock" target="_blank" rel="noopener">
          打开盘点页
        </a>
        <span style={{ fontSize: 13, color: MUTED }}>师傅用自己的链接随时盘；盘完备货页的「在库」就是他盘的数，旁边写着谁、几点盘的。</span>
      </div>
      {msg ? <div className="notice" style={{ wordBreak: "break-all" }}>{msg}</div> : null}

      <section>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <h3 style={{ fontSize: 16 }}>师傅的盘点链接</h3>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAll((a) => !a)}>
            {all ? "只看全职和有链接的" : "显示全部员工"}
          </button>
        </div>
        <div style={{ fontSize: 12, color: MUTED, margin: "4px 0 8px" }}>链接长期有效，收回或重发才失效。</div>
        {chefs.length === 0 ? <div className="empty">还没有全职员工，点「显示全部员工」从里面选。</div> : null}
        {chefs.map((s) => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid var(--color-line)", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 160px", fontWeight: 600 }}>
              {s.name} <span style={{ fontWeight: 400, fontSize: 12, color: MUTED }}>{s.fullTime ? "全职" : s.role === "logistics" ? "后勤" : "兼职"}</span>
            </div>
            {s.url ? (
              <>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => void copy(s.url!, s.name)}>
                  复制链接
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => void issue(s)}>
                  重发
                </button>
                <button type="button" className="btn btn-ghost btn-sm" style={{ color: MUTED }} onClick={() => void revoke(s)}>
                  收回
                </button>
              </>
            ) : (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => void issue(s)}>
                发盘点链接
              </button>
            )}
          </div>
        ))}
      </section>

      <section>
        <h3 style={{ fontSize: 16, marginBottom: 8 }}>最近的盘点</h3>
        {d.counts.length === 0 ? <div className="empty">还没有人盘过。</div> : null}
        {d.counts.map((c) => (
          <details key={c.id} style={{ borderBottom: "1px solid var(--color-line)", padding: "8px 0" }}>
            <summary style={{ cursor: "pointer", minHeight: 32 }}>
              <b>{when(c.createdAt)}</b> · {c.countedBy} · {c.items.length} 样
              {(() => {
                const flags = c.items.filter((i) => i.level === "low" || i.level === "out")
                return flags.length ? (
                  <span style={{ color: "var(--color-accent-700)" }}> · {flags.map((i) => `${RESTOCK_CHECK.find((r) => r.key === i.key)?.label ?? i.key}${RESTOCK_LEVEL_LABEL[i.level as RestockLevel]}`).join("、")}</span>
                ) : null
              })()}
            </summary>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "6px 0 4px 12px", fontSize: 13 }}>
              {c.items.map((i) => {
                const def = itemDef(i.key)
                if (!def) return (
                  <div key={i.key}>
                    {RESTOCK_CHECK.find((r) => r.key === i.key)?.label ?? i.key}：{i.level ? RESTOCK_LEVEL_LABEL[i.level as RestockLevel] : "—"}
                  </div>
                )
                const lines = (Array.isArray(i.lines) ? i.lines : []).map((x) => cleanLine(def, x)).filter((x): x is CountLine => !!x)
                const diff = i.base != null && i.prev != null ? Math.round((i.base - i.prev) * 10) / 10 : null
                return (
                  <div key={i.key}>
                    <b>{def.label}</b> {describeTotal(def, i.base ?? 0)}
                    <span style={{ color: MUTED }}>
                      {" "}
                      ← {lines.length ? lines.map((l) => lineText(def, l)).join(" + ") : "没有了"}
                      {diff ? `（账上原来 ${i.prev}，${diff > 0 ? "+" : ""}${diff}）` : ""}
                    </span>
                  </div>
                )
              })}
            </div>
          </details>
        ))}
      </section>
    </div>
  )
}
