"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { adminJson } from "./api"
import { Tag } from "./ui"
import { askConfirm, askPrompt } from "./ask"
import { md, money, stamp } from "./helpers"
import { matchChefs } from "@/lib/review-board"
import GbpCard, { type GbpStatus } from "./GbpCard"

// 好评台账（2026-09-28）——独立模块，以后长成历史看板。
// 三件事：
//   1. 存下 Google/Yelp 上关于我们的每条评价（手动刷新拉平台 API +
//      agent 人工拉全量导入），带原文链接，条条可点开核对。
//   2. 提到师傅名字的评价一键记给他（无图 $2 · 带图 $3），进他的
//      月结账本；同一条评价永远只算一次（防重在数据库层）。
//   3. 师傅 × 月 的好评汇总——以后的绩效就从这里长出来。
// 2026-10-09：接上 Google 商家后台（GbpCard）——全量同步 + 每条评价下面直接回复。

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
  /** 和 Google 商家后台对上了才有；有它才能在这里回复 */
  gbp_review_id: string | null
  reply_comment: string | null
  reply_updated_at: string | null
  /** Google 的审核状态：APPROVED / PENDING / REJECTED */
  reply_state: string | null
  reply_by: string | null
}
type BonusRow = { id: string; staff_member_id: string; platform: string; review_date: string; cents: number; has_photo: boolean; settlement_id: string | null; review_id: string | null }
type ClaimRow = { id: string; review_id: string; staff_member_id: string; state: string; source: string; claimed_at: string; decided_at: string | null }
type StaffLite = { id: string; name: string; aliases?: string[]; boardUrl?: string | null }
type Resp = {
  ok: boolean
  reviews: ReviewRow[]
  staff: StaffLite[]
  bonuses: BonusRow[]
  claims: ClaimRow[]
  links: { google: string; yelp: string; board: string }
  providers: { google: boolean; yelp: boolean }
  /** 只有老板拿得到；读失败时是 { error } */
  gbp: GbpStatus | { error: string } | null
}

const PLATFORM_LABEL: Record<string, string> = { google: "Google", yelp: "Yelp", other: "其它" }
const SOURCE_LABEL: Record<string, string> = { api: "API", agent: "agent 拉取", gbp: "商家后台" }
const REPLY_MAX_BYTES = 4096
const utf8Bytes = (s: string) => new TextEncoder().encode(s).length

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
  // 商家后台连上并做完第一次同步后，Google 这边是全量（gbp），否则还是 Places 那 5 条。
  const refresh = async () => {
    const r = await post("refresh", { action: "refresh" })
    if (!r) return
    const p = (r.providers ?? {}) as Record<string, { ok?: boolean; source?: string; added?: number; seen?: number; unreplied?: number; reason?: string }>
    const part = (k: string) => {
      const v = p[k]
      if (!v) return `${PLATFORM_LABEL[k]}：—`
      if (!v.ok) return `${PLATFORM_LABEL[k]}：${v.reason ?? "失败"}`
      if (v.source === "gbp") return `${PLATFORM_LABEL[k]}（商家后台全量）：新 ${v.added ?? 0} 条，共 ${v.seen ?? 0} 条，${v.unreplied ?? 0} 条没回复`
      return `${PLATFORM_LABEL[k]}：新 ${v.added ?? 0} 条（已有 ${v.seen ?? 0}）`
    }
    const gbpNote = (r.providers as Record<string, { ok?: boolean; reason?: string }> | undefined)?.gbp
    setMsg(`${part("google")} · ${part("yelp")}${gbpNote && !gbpNote.ok ? ` · 商家后台：${gbpNote.reason ?? "失败"}` : ""}`)
  }

  // ---- 回复评价（Google 商家后台，公开可见）----
  const [replyFor, setReplyFor] = useState<string | null>(null)
  const [replyDraft, setReplyDraft] = useState("")
  const [replyErr, setReplyErr] = useState<string | null>(null)
  const [onlyUnreplied, setOnlyUnreplied] = useState(false)
  const openReply = (r: ReviewRow) => {
    setReplyFor(r.id)
    setReplyDraft(r.reply_comment ?? "")
    setReplyErr(null)
  }
  const publishReply = async (r: ReviewRow) => {
    const text = replyDraft.trim()
    if (!text) return
    const ok = await askConfirm({
      title: r.reply_comment ? "改 Google 上的回复" : "发布到 Google",
      message: `发到 ${r.reviewer ?? "这位客人"} 的评价下面——所有人都看得到，客人会收到通知。${r.reply_comment ? "原来那条回复会被换掉。" : ""}\n\n${text}`,
      okLabel: "发布",
    })
    if (!ok) return
    setBusy(`reply:${r.id}`)
    setReplyErr(null)
    try {
      await adminJson(adminKey, "/api/admin/reviews", { body: { action: "gbp_reply", review_id: r.id, comment: text } })
      setReplyFor(null)
      setReplyDraft("")
      setMsg(`已回复 ${r.reviewer ?? "这位客人"}`)
      await load()
    } catch (e) {
      setReplyErr(e instanceof Error ? e.message : "发布失败")
    } finally {
      setBusy(null)
    }
  }

  const staffById = useMemo(() => new Map((d?.staff ?? []).map((s) => [s.id, s.name])), [d])
  const bonusById = useMemo(() => new Map((d?.bonuses ?? []).map((b) => [b.id, b])), [d])

  // 提到谁：整词匹配师傅的名字和别名。和服务端 auto_name、公开榜单
  // 用的是同一个函数（lib/review-board），三边不会各判各的。
  const mentionsOf = useCallback(
    (r: ReviewRow): StaffLite[] => {
      const hit = new Set(matchChefs(r.body, d?.staff ?? []))
      return (d?.staff ?? []).filter((s) => hit.has(s.id))
    },
    [d],
  )

  const monthOf = (r: ReviewRow) => (r.review_date ?? r.first_seen_at.slice(0, 10)).slice(0, 7)
  // 只有和商家后台对上的行才知道回没回过
  const unreplied = (r: ReviewRow) => r.platform === "google" && !!r.gbp_review_id && !r.reply_comment
  const groups = useMemo(() => {
    const g = new Map<string, ReviewRow[]>()
    for (const r of d?.reviews ?? []) {
      if (onlyUnreplied && !unreplied(r)) continue
      ;(g.get(monthOf(r)) ?? g.set(monthOf(r), []).get(monthOf(r))!).push(r)
    }
    return Array.from(g.entries()).sort((a, b) => b[0].localeCompare(a[0]))
  }, [d, onlyUnreplied])

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
      linked: all.filter((r) => !!r.gbp_review_id).length,
      unreplied: all.filter(unreplied).length,
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

  // ---- 认领（师傅在 /tools/reviews 上点"这条是我的"）----
  //
  // 规则是老板定的：没人抢的在公开页就自动通过了，不经过这里。所以能挂到
  // pending 的只剩一种 —— 两个人以上在抢同一条。那种双方名字在榜单上互相
  // 亮着，让他们自己谈；谈不拢才轮到老板判。
  const reviewById = useMemo(() => new Map((d?.reviews ?? []).map((r) => [r.id, r])), [d])
  const disputes = useMemo(() => {
    const byReview = new Map<string, ClaimRow[]>()
    for (const c of d?.claims ?? []) {
      if (c.state !== "pending" || !reviewById.has(c.review_id)) continue
      const list = byReview.get(c.review_id)
      if (list) list.push(c)
      else byReview.set(c.review_id, [c])
    }
    return [...byReview.entries()].sort((a, b) => (reviewById.get(b[0])?.review_date ?? "").localeCompare(reviewById.get(a[0])?.review_date ?? ""))
  }, [d, reviewById])
  // 自动归属的最近几条：钱不经过老板的手了，至少让他看得见
  const autoCredited = useMemo(() => {
    const cutoff = Date.now() - 14 * 86400000
    return (d?.claims ?? [])
      .filter((c) => c.state === "approved" && c.decided_at && Date.parse(c.decided_at) >= cutoff && reviewById.has(c.review_id))
      .sort((a, b) => String(b.decided_at).localeCompare(String(a.decided_at)))
  }, [d, reviewById])

  const awardTo = async (c: ClaimRow) => {
    const who = staffById.get(c.staff_member_id) ?? "师傅"
    if (!(await askConfirm({ title: `判给 ${who}`, message: `这条归 ${who}，同一条上其他人的认领一并作废（他们不能再认领这条）。`, okLabel: "判给他" }))) return
    await post(`claim:${c.id}`, { action: "approve_claim", claim_id: c.id }, `已判给 ${who}`)
  }
  const dropClaim = async (c: ClaimRow) => {
    const who = staffById.get(c.staff_member_id) ?? "师傅"
    if (!(await askConfirm({ title: `驳回 ${who}`, message: `${who} 这条不算。如果驳完只剩一个人，那条会自动归剩下那位。`, okLabel: "驳回", danger: true }))) return
    await post(`claim:${c.id}`, { action: "reject_claim", claim_id: c.id })
  }

  // ---- 按名字自动归类 ----
  const autoName = async () => {
    const dry = await post("auto", { action: "auto_name", dry: true })
    const hits = (dry?.hits ?? []) as Array<{ chef: string; reviewer: string | null; date: string | null; cents: number }>
    if (!hits.length) {
      setMsg("没有能自动归的——剩下的要么没提名字，要么提了不止一个人")
      return
    }
    const cents = hits.reduce((a, h) => a + h.cents, 0)
    const preview = hits.slice(0, 12).map((h) => `· ${h.chef} ← ${h.reviewer ?? "匿名"}${h.date ? ` (${h.date})` : ""}`).join("\n")
    if (!(await askConfirm({ title: `自动归类 ${hits.length} 条`, message: `正文里只提到一位师傅的，直接记到他头上，共 ${money(cents)}：\n\n${preview}${hits.length > 12 ? `\n… 还有 ${hits.length - 12} 条` : ""}`, okLabel: "归类" }))) return
    const r = await post("auto", { action: "auto_name" })
    if (r) setMsg(`已归 ${r.linked ?? 0} 条 · ${money(Number(r.cents ?? 0))}`)
  }

  // ---- 师傅的榜单链接 ----
  const issueLink = async (s: StaffLite) => {
    if (s.boardUrl && !(await askConfirm({ title: `重发 ${s.name} 的链接`, message: "重发会换一条新链接，他手上那条立刻失效。", okLabel: "重发", danger: true }))) return
    const r = await post(`link:${s.id}`, { action: "issue_link", staff_member_id: s.id })
    if (r?.url) {
      try {
        await navigator.clipboard.writeText(String(r.url))
        setMsg(`${s.name} 的链接已复制，发给他`)
      } catch {
        setMsg(String(r.url))
      }
    }
  }
  const revokeLink = async (s: StaffLite) => {
    if (!(await askConfirm({ title: `收回 ${s.name} 的链接`, message: "他就打不开榜单了，已认领的不受影响。", okLabel: "收回", danger: true }))) return
    await post(`link:${s.id}`, { action: "revoke_link", staff_member_id: s.id })
  }
  const editAliases = async (s: StaffLite) => {
    const cur = (s.aliases ?? []).join(", ")
    const ans = await askPrompt({
      title: `${s.name} 的别名`,
      message: '客人写别的叫法也要能自动归到他头上。逗号隔开，比如：Mr. Blue, Chef Blu。留空=只认 "' + s.name + '"。',
      defaultValue: cur,
      placeholder: "Mr. Blue, Chef Blu",
      okLabel: "存",
    })
    if (ans === null) return
    await post(`alias:${s.id}`, { action: "set_aliases", staff_member_id: s.id, aliases: ans.split(/[,，]/).map((v) => v.trim()).filter(Boolean) }, "别名已存")
  }
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
          {stats.linked ? ` · Google 未回复 ${stats.unreplied} 条` : ""}
        </span>
        {stats.linked ? (
          <button type="button" className={onlyUnreplied ? "btn btn-secondary btn-sm" : "btn btn-ghost btn-sm"} onClick={() => setOnlyUnreplied((v) => !v)}>
            {onlyUnreplied ? "看全部" : "只看未回复"}
          </button>
        ) : null}
        <span style={{ marginLeft: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>
          <a className="btn btn-ghost btn-sm" href={d.links.google} target="_blank" rel="noreferrer">
            Google 全部 ↗
          </a>
          <a className="btn btn-ghost btn-sm" href={d.links.yelp} target="_blank" rel="noreferrer">
            Yelp 全部 ↗
          </a>
          {owner ? (
            <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => void autoName()}>
              按名字自动归类
            </button>
          ) : null}
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
      {owner && d.gbp && "error" in d.gbp ? <div className="notice notice-accent" style={{ fontSize: 12 }}>Google 商家后台状态读不出来：{d.gbp.error}</div> : null}
      {owner && d.gbp && !("error" in d.gbp) ? <GbpCard adminKey={adminKey} status={d.gbp} onChanged={load} cardStyle={cardStyle} /> : null}
      {!d.providers.google && !d.providers.yelp ? (
        <div style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>
          平台 API 还没接（Google 要 GCP 开 Places API + 计费，Yelp Fusion 免费申请 key）——接上之前"手动刷新"拉不到新评价，由 agent 打开平台页面拉全量导入。重复导入会自动合并，不会多行。
        </div>
      ) : null}

      {/* 抢单：两个人以上说同一条是自己的。没人抢的已经在公开页自动归属了，不会到这儿。 */}
      {owner && disputes.length ? (
        <div style={{ ...cardStyle, borderColor: "var(--color-accent)" }}>
          <div className="kicker" style={{ color: "var(--color-accent-700)" }}>
            抢单待解决 · {disputes.length} 条
          </div>
          <div style={{ fontSize: 11.5, color: "var(--color-neutral-600)", margin: "4px 0 8px" }}>
            双方名字在榜单上互相亮着，先让他们自己谈——一方放手，另一方立刻拿到，不用你管。**这些条目结不了算**，一直卡着才轮到你判。
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {disputes.map(([reviewId, rivals]) => {
              const r = reviewById.get(reviewId)!
              const named = mentionsOf(r)
              return (
                <div key={reviewId} style={{ padding: "8px 0", borderTop: "1px solid var(--color-line)" }}>
                  <div style={{ fontSize: 12.5 }}>
                    <strong>{rivals.map((c) => staffById.get(c.staff_member_id) ?? "?").join(" vs ")}</strong>
                    <span style={{ color: "var(--color-neutral-600)" }}>
                      {" "}
                      · {PLATFORM_LABEL[r.platform]} · {r.reviewer ?? "匿名"} · {r.review_date ?? "—"} · {r.has_photo ? "带图 $3" : "无图 $2"}
                    </span>
                    {/* 正文点了名的话，这就是最硬的证据 */}
                    {named.length ? (
                      <Tag cls="tag-accent" style={{ marginLeft: 6 }}>
                        正文写的是 {named.map((n) => n.name).join(" / ")}
                      </Tag>
                    ) : null}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--color-neutral-700)", margin: "2px 0 6px" }}>{r.body ? (r.body.length > 120 ? `${r.body.slice(0, 120)}…` : r.body) : "（没写字）"}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    {r.url ? (
                      <a className="btn btn-ghost btn-sm" href={r.url} target="_blank" rel="noreferrer">
                        原文 ↗
                      </a>
                    ) : null}
                    {rivals.map((c) => (
                      <span key={c.id} style={{ display: "inline-flex", gap: 4 }}>
                        <button type="button" className="btn btn-secondary btn-sm" disabled={!!busy} onClick={() => void awardTo(c)}>
                          判给 {staffById.get(c.staff_member_id) ?? "?"}
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => void dropClaim(c)} title={`驳回 ${staffById.get(c.staff_member_id) ?? ""}`}>
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      {/* 自动归属的回看：钱不再经你的手，这里是能查的那本账 */}
      {owner && autoCredited.length ? (
        <div style={cardStyle}>
          <div className="kicker">最近自动归属 · 近 14 天 {autoCredited.length} 条</div>
          <div style={{ fontSize: 11.5, color: "var(--color-neutral-600)", margin: "4px 0 8px" }}>没人抢，师傅点了就直接进他账本。觉得哪条不对，在下面列表里「取消关联」——取消之后他不能再认领同一条。</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {autoCredited.slice(0, 20).map((c) => {
              const r = reviewById.get(c.review_id)!
              return (
                <div key={c.id} style={{ fontSize: 12, display: "flex", gap: 6, flexWrap: "wrap", borderTop: "1px solid var(--color-line)", padding: "4px 0" }}>
                  <strong>{staffById.get(c.staff_member_id) ?? "?"}</strong>
                  <span style={{ color: "var(--color-neutral-600)" }}>
                    {r.reviewer ?? "匿名"} · {r.review_date ?? "—"} · {money(r.has_photo ? 300 : 200)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      {/* 师傅的榜单链接 + 名字别名 */}
      {owner ? (
        <div style={cardStyle}>
          <div className="kicker">师傅榜单链接</div>
          <div style={{ fontSize: 11.5, color: "var(--color-neutral-600)", margin: "4px 0 8px" }}>
            发给师傅，他自己打开看排名、认领没点到名的评价。榜单本身谁拿到链接都能看（不收录搜索引擎），认领只认自己那条。
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(d.staff ?? []).map((s) => (
              <div key={s.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 0", borderTop: "1px solid var(--color-line)", flexWrap: "wrap" }}>
                <strong style={{ fontSize: 12.5, minWidth: 60 }}>{s.name}</strong>
                <span style={{ fontSize: 11.5, color: "var(--color-neutral-600)", flex: "1 1 160px", minWidth: 0, wordBreak: "break-all" }}>
                  {s.boardUrl ? s.boardUrl : "还没发链接"}
                  {s.aliases?.length ? <span style={{ marginLeft: 8 }}>别名：{s.aliases.join(" / ")}</span> : null}
                </span>
                <span style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => void editAliases(s)}>
                    别名
                  </button>
                  {s.boardUrl ? (
                    <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => void revokeLink(s)}>
                      收回
                    </button>
                  ) : null}
                  <button type="button" className="btn btn-secondary btn-sm" disabled={!!busy} onClick={() => void issueLink(s)}>
                    {s.boardUrl ? "重发" : "发链接"}
                  </button>
                </span>
              </div>
            ))}
          </div>
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
                  {/* Google 上我们的回复（和商家后台对上的才知道回没回过） */}
                  {r.platform === "google" && (r.reply_comment || r.gbp_review_id) ? (
                    <div style={{ marginTop: 8, borderLeft: "3px solid var(--color-line)", paddingLeft: 8 }}>
                      {r.reply_comment ? (
                        <>
                          <div style={{ fontSize: 11.5, color: "var(--color-neutral-600)", display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                            <span>
                              我们的回复{r.reply_updated_at ? ` · ${stamp(r.reply_updated_at)}` : ""}
                              {r.reply_by ? ` · ${r.reply_by} 在工作台发的` : ""}
                            </span>
                            {r.reply_state === "PENDING" ? <Tag cls="tag-outline">Google 审核中</Tag> : null}
                            {r.reply_state === "REJECTED" ? <Tag cls="tag-accent">被 Google 拒了，改一下再发</Tag> : null}
                          </div>
                          {replyFor !== r.id ? <div style={{ fontSize: 12.5, lineHeight: 1.5, whiteSpace: "pre-wrap", marginTop: 2 }}>{r.reply_comment}</div> : null}
                        </>
                      ) : (
                        <Tag cls="tag-outline">还没回复</Tag>
                      )}
                      {owner && r.gbp_review_id && replyFor !== r.id ? (
                        <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: 11, marginLeft: r.reply_comment ? 0 : 6, marginTop: r.reply_comment ? 4 : 0 }} disabled={!!busy} onClick={() => openReply(r)}>
                          {r.reply_comment ? "改回复" : "回复"}
                        </button>
                      ) : null}
                      {replyFor === r.id ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
                          <textarea className="input" rows={4} value={replyDraft} onChange={(e) => setReplyDraft(e.target.value)} placeholder="写给这位客人的回复（发出去所有人都看得到）" style={{ fontSize: 13, lineHeight: 1.5 }} autoFocus />
                          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                            <button type="button" className="btn btn-primary btn-sm" disabled={!!busy || !replyDraft.trim() || utf8Bytes(replyDraft.trim()) > REPLY_MAX_BYTES} onClick={() => void publishReply(r)}>
                              {busy === `reply:${r.id}` ? "发布中…" : "发布到 Google"}
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              disabled={!!busy}
                              onClick={() => {
                                setReplyFor(null)
                                setReplyErr(null)
                              }}
                            >
                              取消
                            </button>
                            <span style={{ fontSize: 11, color: utf8Bytes(replyDraft.trim()) > REPLY_MAX_BYTES ? "var(--color-accent-700)" : "var(--color-neutral-500)" }}>
                              {utf8Bytes(replyDraft.trim())} / {REPLY_MAX_BYTES} 字节
                            </span>
                          </div>
                          {replyErr ? <div className="notice notice-accent" style={{ fontSize: 12 }}>{replyErr}</div> : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
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
                    <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--color-neutral-500)" }}>{SOURCE_LABEL[r.source] ?? "手动"}</span>
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
