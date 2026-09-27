"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { adminJson } from "./api"
import { Tag } from "./ui"
import { askConfirm, askPrompt } from "./ask"
import { md, money } from "./helpers"

// 好评台账（2026-09-28）——独立模块，以后长成历史看板。
// 三件事：
//   1. 存下 Google/Yelp 上关于我们的每条评价（手动刷新拉平台 API +
//      agent 人工拉全量导入），带原文链接，条条可点开核对。
//   2. 提到师傅名字的评价一键记给他（无图 $2 · 带图 $3），进他的
//      月结账本；同一条评价永远只算一次（防重在数据库层）。
//   3. 师傅 × 月 的好评汇总——以后的绩效就从这里长出来。

type ReviewRow = {
  id: string
  platform: "google" | "yelp" | "other"
  external_key: string
  reviewer: string | null
  rating: number | null
  review_date: string | null
  body: string | null
  url: string | null
  has_photo: boolean
  photo_count: number
  staff_member_id: string | null
  bonus_id: string | null
  source: string
  first_seen_at: string
  last_seen_at: string
}
type BonusRow = { id: string; staff_member_id: string; platform: string; review_date: string; cents: number; has_photo: boolean; settlement_id: string | null; review_id: string | null }
type StaffLite = { id: string; name: string }
type Resp = {
  ok: boolean
  reviews: ReviewRow[]
  staff: StaffLite[]
  bonuses: BonusRow[]
  links: { google: string; yelp: string }
  providers: { google: boolean; yelp: boolean }
}

const PLATFORM_LABEL: Record<string, string> = { google: "Google", yelp: "Yelp", other: "其它" }
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

export default function ReviewsTab({ adminKey, isMobile, viewerRole }: { adminKey: string; isMobile: boolean; viewerRole: string | null }) {
  const owner = viewerRole === "owner"
  const [d, setD] = useState<Resp | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setD(await adminJson<Resp>(adminKey, "/api/admin/reviews"))
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "加载失败")
    }
  }, [adminKey])
  useEffect(() => {
    void load()
  }, [load])

  const post = useCallback(
    async (tag: string, body: Record<string, unknown>, okMsg?: string) => {
      setBusy(tag)
      setMsg(null)
      try {
        const r = await adminJson<Record<string, unknown> & { ok?: boolean; error?: string }>(adminKey, "/api/admin/reviews", { body })
        if (r.error) throw new Error(String(r.error))
        if (okMsg) setMsg(okMsg)
        await load()
        return r
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "失败")
        return null
      } finally {
        setBusy(null)
      }
    },
    [adminKey, load],
  )

  // 手动刷新：拉已接的平台 API；没接 key 的平台把原因摆出来。
  const refresh = async () => {
    const r = await post("refresh", { action: "refresh" })
    if (!r) return
    const p = (r.providers ?? {}) as Record<string, { ok?: boolean; added?: number; seen?: number; reason?: string }>
    const part = (k: string) => {
      const v = p[k]
      if (!v) return `${PLATFORM_LABEL[k]}：—`
      return v.ok ? `${PLATFORM_LABEL[k]}：新 ${v.added ?? 0} 条（已有 ${v.seen ?? 0}）` : `${PLATFORM_LABEL[k]}：${v.reason ?? "失败"}`
    }
    setMsg(`${part("google")} · ${part("yelp")}`)
  }

  const staffById = useMemo(() => new Map((d?.staff ?? []).map((s) => [s.id, s.name])), [d])
  const bonusById = useMemo(() => new Map((d?.bonuses ?? []).map((b) => [b.id, b])), [d])

  // 提到谁：拿师傅名字在正文里整词匹配（Blu ≠ blue，大小写不论）。
  const mentionsOf = useCallback(
    (r: ReviewRow): StaffLite[] => {
      const text = `${r.body ?? ""}`
      if (!text) return []
      return (d?.staff ?? []).filter((s) => s.name.length >= 2 && new RegExp(`\\b${escapeRe(s.name)}\\b`, "i").test(text))
    },
    [d],
  )

  const monthOf = (r: ReviewRow) => (r.review_date ?? r.first_seen_at.slice(0, 10)).slice(0, 7)
  const groups = useMemo(() => {
    const g = new Map<string, ReviewRow[]>()
    for (const r of d?.reviews ?? []) (g.get(monthOf(r)) ?? g.set(monthOf(r), []).get(monthOf(r))!).push(r)
    return Array.from(g.entries()).sort((a, b) => b[0].localeCompare(a[0]))
  }, [d])

  const stats = useMemo(() => {
    const all = d?.reviews ?? []
    const rated = all.filter((r) => r.rating != null)
    const nowMonth = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" }).slice(0, 7)
    return {
      total: all.length,
      avg: rated.length ? (rated.reduce((a, r) => a + (r.rating ?? 0), 0) / rated.length).toFixed(1) : "–",
      month: all.filter((r) => monthOf(r) === nowMonth).length,
      google: all.filter((r) => r.platform === "google").length,
      yelp: all.filter((r) => r.platform === "yelp").length,
    }
  }, [d])

  // 师傅 × 月：绩效的雏形。待结/已结分开数，钱是录入时冻结的档位。
  const chefMonths = useMemo(() => {
    const map = new Map<string, Map<string, { count: number; cents: number; pending: number }>>()
    for (const b of d?.bonuses ?? []) {
      const m = b.review_date.slice(0, 7)
      const row = map.get(m) ?? map.set(m, new Map()).get(m)!
      const cell = row.get(b.staff_member_id) ?? { count: 0, cents: 0, pending: 0 }
      cell.count += 1
      cell.cents += b.cents
      if (!b.settlement_id) cell.pending += 1
      row.set(b.staff_member_id, cell)
    }
    const staffIds = Array.from(new Set((d?.bonuses ?? []).map((b) => b.staff_member_id)))
    const months = Array.from(map.keys()).sort((a, b) => b.localeCompare(a))
    return { months, staffIds, map }
  }, [d])

  const linkChef = async (r: ReviewRow, s: StaffLite) => {
    const tier = r.has_photo ? "带图 $3" : "无图 $2"
    if (!(await askConfirm({ title: `记给 ${s.name}`, message: `这条 ${PLATFORM_LABEL[r.platform]} 好评（${r.reviewer ?? "匿名"} · ${tier}）记进 ${s.name} 的月结账本？一条只算一次。`, okLabel: "记上" }))) return
    await post(`link:${r.id}`, { action: "link_chef", review_id: r.id, staff_member_id: s.id }, `已记给 ${s.name}`)
  }
  const pickChef = async (r: ReviewRow) => {
    const staff = d?.staff ?? []
    if (!staff.length) return
    const ans = await askPrompt({ title: "记给哪位师傅？", message: staff.map((s, i) => `${i + 1}. ${s.name}`).join("\n"), placeholder: "填序号", inputMode: "decimal", okLabel: "下一步" })
    if (ans === null) return
    const s = staff[Number(ans.trim()) - 1]
    if (!s) {
      setMsg("序号不对")
      return
    }
    await linkChef(r, s)
  }
  const unlink = async (r: ReviewRow) => {
    if (!(await askConfirm({ title: "取消关联", message: "把这条从师傅的待结奖励里拿掉（评价本身保留，可再记给别人）。已结算的取消不了。", okLabel: "取消关联", danger: true }))) return
    await post(`unlink:${r.id}`, { action: "unlink_chef", review_id: r.id })
  }
  const togglePhoto = (r: ReviewRow) => post(`photo:${r.id}`, { action: "set_photo", review_id: r.id, has_photo: !r.has_photo })
  const delRow = async (r: ReviewRow) => {
    if (!(await askConfirm({ title: "删掉这条记录", message: "只删台账里的这行（平台上的评价当然还在）。记过奖励的删不了。", okLabel: "删除", danger: true }))) return
    await post(`del:${r.id}`, { action: "delete_row", review_id: r.id })
  }
  // 手机上看到一条 API 拉不到的：手动补一行（走 import，同内容不会重）。
  const addManual = async () => {
    const platform = await askPrompt({ title: "补一条评价", message: "在哪个平台？填 google / yelp", defaultValue: "google", okLabel: "下一步" })
    if (platform === null) return
    const reviewer = await askPrompt({ title: "评价人", message: "显示的名字（照抄）", placeholder: "如 Maria H.", okLabel: "下一步" })
    if (reviewer === null) return
    const date = await askPrompt({ title: "评价日期", message: "YYYY-MM-DD（平台上显示几天前就倒推）", defaultValue: new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" }), okLabel: "下一步" })
    if (date === null) return
    const photoAns = await askPrompt({ title: "带图吗？", message: "带图填 y，无图填 n", defaultValue: "n", okLabel: "下一步" })
    if (photoAns === null) return
    const url = await askPrompt({ title: "评价链接", message: "能点开看原文的链接（没有可留空）", placeholder: "https://…", defaultValue: "", okLabel: "下一步" })
    if (url === null) return
    const text = await askPrompt({ title: "内容", message: "评价原文（可只贴一段；提到师傅名字这里要带上）", placeholder: "…", defaultValue: "", okLabel: "存" })
    if (text === null) return
    await post(
      "import",
      {
        action: "import",
        source: "manual",
        reviews: [
          {
            platform: platform.trim().toLowerCase() === "yelp" ? "yelp" : platform.trim().toLowerCase() === "other" ? "other" : "google",
            reviewer: reviewer.trim(),
            review_date: date.trim(),
            has_photo: /^(y|yes|是|带)/i.test(photoAns.trim()),
            url: url.trim(),
            body: text.trim(),
          },
        ],
      },
      "已入账",
    )
  }

  const cardStyle = { border: "1px solid var(--color-line)", background: "var(--color-surface)", padding: isMobile ? "10px 12px" : "12px 14px" } as const

  if (!d) return <div className="empty" style={{ margin: 24 }}>{msg ?? "加载中…"}</div>

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: isMobile ? 12 : 24, maxWidth: 980 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h5 style={{ margin: 0 }}>好评台账</h5>
        <span style={{ fontSize: 12.5, color: "var(--color-neutral-600)" }}>
          共 {stats.total} 条 · 平均 {stats.avg} ★ · 本月 {stats.month} 条 · Google {stats.google} / Yelp {stats.yelp}
        </span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>
          <a className="btn btn-ghost btn-sm" href={d.links.google} target="_blank" rel="noreferrer">
            Google 全部 ↗
          </a>
          <a className="btn btn-ghost btn-sm" href={d.links.yelp} target="_blank" rel="noreferrer">
            Yelp 全部 ↗
          </a>
          {owner ? (
            <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => void addManual()}>
              补一条
            </button>
          ) : null}
          <button type="button" className="btn btn-secondary btn-sm" disabled={!!busy} onClick={() => void refresh()}>
            {busy === "refresh" ? "刷新中…" : "手动刷新"}
          </button>
        </span>
      </div>
      {msg ? <div className="notice" style={{ fontSize: 12.5 }}>{msg}</div> : null}
      {!d.providers.google && !d.providers.yelp ? (
        <div style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>
          平台 API 还没接（Google 要 GCP 开 Places API + 计费，Yelp Fusion 免费申请 key）——接上之前"手动刷新"拉不到新评价，由 agent 打开平台页面拉全量导入。重复导入会自动合并，不会多行。
        </div>
      ) : null}

      {/* 师傅 × 月：以后的绩效看板从这里长 */}
      {chefMonths.months.length ? (
        <div style={cardStyle}>
          <div className="kicker">师傅好评 · 按月</div>
          <div style={{ overflowX: "auto", marginTop: 8 }}>
            <table style={{ borderCollapse: "collapse", fontSize: 12.5, minWidth: 320 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "4px 12px 4px 0", borderBottom: "2px solid var(--color-text)" }}>月份</th>
                  {chefMonths.staffIds.map((id) => (
                    <th key={id} style={{ textAlign: "right", padding: "4px 0 4px 16px", borderBottom: "2px solid var(--color-text)" }}>
                      {staffById.get(id) ?? "?"}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chefMonths.months.map((m) => (
                  <tr key={m}>
                    <td style={{ padding: "5px 12px 5px 0", borderBottom: "1px solid var(--color-line)", whiteSpace: "nowrap" }}>{m.replace("-", " 年 ")} 月</td>
                    {chefMonths.staffIds.map((id) => {
                      const cell = chefMonths.map.get(m)?.get(id)
                      return (
                        <td key={id} style={{ textAlign: "right", padding: "5px 0 5px 16px", borderBottom: "1px solid var(--color-line)", whiteSpace: "nowrap" }}>
                          {cell ? (
                            <>
                              {cell.count} 条 · {money(cell.cents)}
                              {cell.pending ? <span style={{ color: "var(--color-accent-700)" }}>（{cell.pending} 待结）</span> : null}
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--color-neutral-600)", marginTop: 6 }}>好评奖励每月一结（厨师页 → 结算 → 结好评）；金额录入时冻结。</div>
        </div>
      ) : null}

      {/* 一条一条，按月摆 */}
      {groups.length === 0 ? <div className="empty">还没有评价入账——点"手动刷新"，或让 agent 去 Google/Yelp 拉一遍。</div> : null}
      {groups.map(([m, rows]) => (
        <div key={m}>
          <h6 style={{ margin: "8px 0 6px" }}>
            {m.replace("-", " 年 ")} 月 · {rows.length} 条
          </h6>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rows.map((r) => {
              const linked = r.bonus_id ? bonusById.get(r.bonus_id) : null
              const linkedName = r.staff_member_id ? staffById.get(r.staff_member_id) : null
              const mentions = r.bonus_id ? [] : mentionsOf(r).filter((s) => s.id !== r.staff_member_id)
              return (
                <div key={r.id} style={cardStyle}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                    <Tag cls={r.platform === "yelp" ? "tag-accent" : "tag-ink"}>{PLATFORM_LABEL[r.platform]}</Tag>
                    <strong>{r.reviewer ?? "匿名"}</strong>
                    <span style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>
                      {r.review_date ? md(r.review_date) : "日期未知"}
                      {r.rating != null ? ` · ${"★".repeat(Math.max(0, Math.min(5, r.rating)))}` : ""}
                      {r.has_photo ? ` · 带图${r.photo_count > 1 ? ` ×${r.photo_count}` : ""}` : ""}
                    </span>
                    {r.url ? (
                      <a href={r.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, marginLeft: "auto", whiteSpace: "nowrap" }}>
                        查看原文 ↗
                      </a>
                    ) : null}
                  </div>
                  {r.body ? (
                    <div style={{ fontSize: 13, marginTop: 6, lineHeight: 1.55, color: "var(--color-neutral-800)" }}>{r.body}</div>
                  ) : (
                    <div style={{ fontSize: 12, marginTop: 6, color: "var(--color-neutral-500)" }}>（没存正文——点"查看原文"）</div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                    {linked || linkedName ? (
                      <>
                        <Tag cls="tag-ink">
                          已记给 {linkedName ?? "?"} +{money(linked?.cents ?? 0)} · {linked?.settlement_id ? "已结" : "待月结"}
                        </Tag>
                        {owner && linked && !linked.settlement_id ? (
                          <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} disabled={!!busy} onClick={() => void unlink(r)}>
                            取消关联
                          </button>
                        ) : null}
                      </>
                    ) : (
                      <>
                        {owner
                          ? mentions.map((s) => (
                              <button key={s.id} type="button" className="btn btn-secondary btn-sm" disabled={!!busy} onClick={() => void linkChef(r, s)}>
                                提到 {s.name} → 记 {r.has_photo ? "$3" : "$2"}
                              </button>
                            ))
                          : mentions.map((s) => <Tag key={s.id} cls="tag-outline">提到 {s.name}</Tag>)}
                        {owner ? (
                          <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} disabled={!!busy} onClick={() => void pickChef(r)}>
                            记给师傅…
                          </button>
                        ) : null}
                        {owner ? (
                          <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} disabled={!!busy} onClick={() => void togglePhoto(r)}>
                            {r.has_photo ? "改成无图" : "标记带图"}
                          </button>
                        ) : null}
                        {owner ? (
                          <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} disabled={!!busy} onClick={() => void delRow(r)}>
                            删
                          </button>
                        ) : null}
                      </>
                    )}
                    <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--color-neutral-500)" }}>{r.source === "api" ? "API" : r.source === "agent" ? "agent 拉取" : "手动"}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
      <div style={{ fontSize: 11.5, color: "var(--color-neutral-600)" }}>同一条评价只存一行、只算一次钱：重复刷新/导入自动合并；记过奖励的评价不能再记、不能改档，除非先取消关联。</div>
    </div>
  )
}
