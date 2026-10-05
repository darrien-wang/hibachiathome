"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Chip, Tag } from "@/components/admin/workbench/ui"
import { addDays, type ChefStanding, dollars, weekLabel, weekStart } from "@/lib/review-board"
import { photoFull, photoThumb } from "@/lib/review-photos"

// 好评榜（老板 2026-10-02）
//
// 为什么做：评价里没点名字的，统计不出来归谁 —— 师傅一样干了活，钱算不到他头上。
// 所以没人认领的那些摆出来，师傅自己点"这场是我的"，老板一键确认。
//
// 页面三层：
//   1. 奖台 —— 前三名，看得见的那种。奖池 = 已入账 + 待确认。
//   2. 全员榜 —— 每个人拿了多少、还欠他多少，最少的那位也标出来（激励两头）。
//   3. 评价清单 —— 可按周切，按"待认领 / 已归属 / 带图 / 我认领的"筛。
//      客人传的照片（2026-10-04 老板要的）：清单上方一排、每条下面缩略图，点开看大图。
//
// 认领不等于拿到钱：认领只是排队等老板确认，页面上写清楚，别让人误会。
// 语言默认英文，和备料单 /chef/<token> 同一个 localStorage key。

type Lang = "en" | "zh"
type ReviewRow = {
  id: string
  platform: string
  reviewer: string | null
  rating: number | null
  date: string | null
  body: string | null
  url: string | null
  hasPhoto: boolean
  /** 平台图床的照片地址（不带尺寸，见 lib/review-photos.ts） */
  photos?: string[]
  state: "credited" | "contested" | "pending" | "open"
  settled: boolean
  creditedTo: string | null
  namedChef: string | null
  claimedBy: string[]
  minedByMe: boolean
}
type Resp = {
  ok: boolean
  today: string
  week: string
  range: "week" | "all"
  weeks: string[]
  chefs: Array<{ id: string; name: string }>
  me: { id: string; name: string } | null
  /** 工作台登录态认出的老板 —— 多一排"替师傅点"的按钮 */
  owner: boolean
  standings: ChefStanding[]
  lifetime: ChefStanding[]
  summary: { total: number; credited: number; openCount: number; openCents: number; contestedCount: number; contestedCents: number }
  reviews: ReviewRow[]
}

const LANG_KEY = "rh-chef-lang"
const PLATFORM_LABEL: Record<string, string> = { google: "Google", yelp: "Yelp", other: "Other" }
const MEDALS = ["🥇", "🥈", "🥉"]

const T = {
  en: {
    title: "Review Board",
    sub: "Every 5-star review is worth $2 — $3 with a photo.",
    hi: (n: string) => `Signed in as ${n}`,
    guest: "View only — ask the boss for your personal link to claim.",
    thisWeek: "This week",
    lastWeek: "Last week",
    all: "All time",
    pool: "Prize pool",
    banked: "Banked",
    inDispute: "In dispute",
    owed: "Not paid out yet",
    paid: "Paid out",
    nobody: "No reviews in this week yet.",
    standings: "Standings",
    lifetimeNote: "All-time pool",
    summary: (total: number, open: number, cents: number) => `${total} review${total === 1 ? "" : "s"} · ${open} still unclaimed (${dollars(cents)} on the table)`,
    fAll: "All",
    fOpen: "Unclaimed",
    fCredited: "Credited",
    fContested: "Disputed",
    fMine: "Mine",
    fPhoto: "With photos",
    photoWall: (n: number) => `Photos guests posted · ${n}`,
    close: "Close",
    claim: "This one was mine",
    yours: "Yours",
    giveUp: "Not mine — give it up",
    undo: "Undo",
    creditedTo: (n: string) => `Credited to ${n}`,
    bothClaim: (names: string) => `${names} both say this one is theirs`,
    disputeHelp: "Nobody gets paid for this one until one of you backs off. Talk to each other — whoever gives it up, the other one gets it automatically.",
    named: (n: string) => `Mentions ${n}`,
    photo: "Photo",
    open: "Read on Google",
    noText: "(rating only, no text)",
    claimHelp: "If nobody else claims it, it's yours right away — no waiting.",
    least: "Fewest so far",
    err: "Something went wrong",
    assignTo: "Credit to",
    clearIt: "Clear",
    markPhoto: "Has a photo ($3)",
    unmarkPhoto: "No photo ($2)",
    ownerNote: "You're signed in as the owner — tap a name to credit it straight away.",
    sync: "Sync from Google",
    syncing: "Syncing…",
    syncDone: (added: number) => (added ? `${added} new review${added === 1 ? "" : "s"} came in.` : "Nothing new this time."),
    syncCount: (total: number, have: number) => `Google shows ${total}, the board has ${have}.`,
    syncGap: "Google only hands out its 5 \"most relevant\" reviews per sync, so some new ones (and all photos) need a full pull — ask Claude.",
  },
  zh: {
    title: "好评榜",
    sub: "一条五星 $2，带图 $3。",
    hi: (n: string) => `你好，${n}`,
    guest: "只能看 —— 要认领找老板要你自己的链接。",
    thisWeek: "本周",
    lastWeek: "上周",
    all: "全部",
    pool: "奖池",
    banked: "已入账",
    inDispute: "抢中",
    owed: "还没结",
    paid: "已结清",
    nobody: "这周还没有评价。",
    standings: "全员榜",
    lifetimeNote: "累计奖池",
    summary: (total: number, open: number, cents: number) => `${total} 条 · ${open} 条还没人认领（${dollars(cents)} 在桌上）`,
    fAll: "全部",
    fOpen: "待认领",
    fCredited: "已归属",
    fContested: "抢中",
    fMine: "我的",
    fPhoto: "带图",
    photoWall: (n: number) => `客人拍的照片 · ${n} 张`,
    close: "关闭",
    claim: "这条是我的",
    yours: "你的",
    giveUp: "不是我的 · 让给他",
    undo: "撤回",
    creditedTo: (n: string) => `已归 ${n}`,
    bothClaim: (names: string) => `${names} 都说是自己的`,
    disputeHelp: "这条谁都拿不到，也结不了算。你们自己说清楚 —— 谁放手，另一个人马上就拿到。",
    named: (n: string) => `正文提到 ${n}`,
    photo: "带图",
    open: "看原文",
    noText: "（只打了星，没写字）",
    claimHelp: "没人跟你抢的话，点完立刻就是你的，不用等。",
    least: "目前最少",
    err: "出错了",
    assignTo: "记给",
    clearIt: "取消",
    markPhoto: "标带图（$3）",
    unmarkPhoto: "改回无图（$2）",
    ownerNote: "工作台登录态，认出你是老板 —— 知道是谁的直接点名字，立刻入账。",
    sync: "从 Google 同步",
    syncing: "同步中…",
    syncDone: (added: number) => (added ? `新进 ${added} 条。` : "这次没有新的。"),
    syncCount: (total: number, have: number) => `Google 上 ${total} 条，榜上 ${have} 条。`,
    syncGap: "Google 每次只给 5 条“最相关”的，差的那几条和所有照片要全量拉一次（找 Claude）。",
  },
} as const

export function ReviewBoard() {
  const sp = useSearchParams()
  const token = (sp.get("t") ?? "").trim()
  const [lang, setLang] = useState<Lang>("en")
  const [d, setD] = useState<Resp | null>(null)
  const [week, setWeek] = useState<string | null>(null)
  const [allTime, setAllTime] = useState(false)
  const [filter, setFilter] = useState<"all" | "open" | "credited" | "contested" | "photo" | "mine">("all")
  // 看大图：同一组照片里左右翻（清单上方那排 = 本周全部；某条下面的 = 这一条的）
  const [viewer, setViewer] = useState<{ list: Array<{ src: string; review: ReviewRow }>; i: number } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  // 老板手动同步（2026-10-05 老板："好评页面上能够手动发起同步吗"）。和工作台
  // 「好评」页签的"手动刷新"是同一个接口，靠工作台登录 cookie 认人。
  const [sync, setSync] = useState<{ busy: boolean; added?: number; total?: number; have?: number; error?: string } | null>(null)
  const t = T[lang]

  useEffect(() => {
    try {
      const l = localStorage.getItem(LANG_KEY)
      if (l === "zh" || l === "en") setLang(l)
    } catch {
      /* 隐私模式读不到就算了 */
    }
  }, [])
  const changeLang = (l: Lang) => {
    setLang(l)
    try {
      localStorage.setItem(LANG_KEY, l)
    } catch {
      /* 同上 */
    }
  }

  const load = useCallback(async () => {
    const q = new URLSearchParams()
    if (token) q.set("t", token)
    if (allTime) q.set("range", "all")
    else if (week) q.set("week", week)
    try {
      const r = await fetch(`/api/tools/reviews?${q}`, { cache: "no-store" })
      const j = (await r.json()) as Resp & { error?: string }
      if (!j.ok) throw new Error(j.error ?? T.en.err)
      setD(j)
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : T.en.err)
    }
  }, [token, week, allTime])
  useEffect(() => {
    void load()
  }, [load])

  const act = useCallback(
    async (action: "claim" | "unclaim" | "assign" | "unassign" | "set_photo", reviewId: string, staffId?: string, hasPhoto?: boolean) => {
      // claim/unclaim 要师傅自己的 token；assign/unassign 靠工作台登录 cookie
      if (!token && (action === "claim" || action === "unclaim")) return
      setBusy(reviewId)
      setErr(null)
      try {
        const r = await fetch(`/api/tools/reviews${token ? `?t=${encodeURIComponent(token)}` : ""}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action, review_id: reviewId, ...(staffId ? { staff_member_id: staffId } : {}), ...(hasPhoto === undefined ? {} : { has_photo: hasPhoto }) }),
        })
        const j = (await r.json()) as { ok?: boolean; error?: string }
        if (!j.ok) throw new Error(j.error ?? T.en.err)
        await load()
      } catch (e) {
        setErr(e instanceof Error ? e.message : T.en.err)
      } finally {
        setBusy(null)
      }
    },
    [token, load],
  )

  const syncGoogle = useCallback(async () => {
    setSync({ busy: true })
    try {
      const r = await fetch("/api/admin/reviews", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "refresh" }) })
      const j = (await r.json().catch(() => null)) as { providers?: { google?: { ok?: boolean; added?: number; total?: number; have?: number; reason?: string } }; error?: string } | null
      const g = j?.providers?.google
      if (!r.ok || !g?.ok) throw new Error(g?.reason ?? j?.error ?? T.en.err)
      setSync({ busy: false, added: g.added ?? 0, total: g.total, have: g.have })
      await load()
    } catch (e) {
      setSync({ busy: false, error: e instanceof Error ? e.message : T.en.err })
    }
  }, [load])

  const nameOf = useCallback((id: string | null) => (id ? (d?.chefs.find((c) => c.id === id)?.name ?? "—") : "—"), [d])

  const top3 = useMemo(() => (d?.standings ?? []).filter((s) => s.poolCents > 0).slice(0, 3), [d])
  // 奖台的经典排法：第二名在左，第一名居中最高，第三名在右
  const podium = useMemo(() => [top3[1], top3[0], top3[2]].filter(Boolean) as ChefStanding[], [top3])
  const maxPool = Math.max(1, ...top3.map((s) => s.poolCents))
  // "目前最少"只在确实只有一个人垫底时才标 —— 四个人并列 0 的时候挂在谁头上都是冤枉
  const leastId = useMemo(() => {
    const rows = d?.standings ?? []
    if (rows.length < 2) return null
    const last = rows[rows.length - 1]
    const tied = rows.filter((r) => r.poolCents === last.poolCents).length
    return tied === 1 ? last.id : null
  }, [d])

  const shown = useMemo(() => {
    const rows = d?.reviews ?? []
    if (filter === "photo") return rows.filter((r) => r.hasPhoto || (r.photos?.length ?? 0) > 0)
    if (filter === "open") return rows.filter((r) => r.state === "open")
    if (filter === "credited") return rows.filter((r) => r.state === "credited")
    if (filter === "contested") return rows.filter((r) => r.state === "contested" || r.state === "pending")
    if (filter === "mine") return rows.filter((r) => r.minedByMe || (d?.me && r.creditedTo === d.me.id))
    return rows
  }, [d, filter])

  // 这一周（或全部）客人拍的照片，按评价顺序平铺
  const wall = useMemo(() => (d?.reviews ?? []).flatMap((r) => (r.photos ?? []).map((src) => ({ src, review: r }))), [d])
  const photoReviews = useMemo(() => (d?.reviews ?? []).filter((r) => r.hasPhoto || (r.photos?.length ?? 0) > 0).length, [d])

  useEffect(() => {
    if (!viewer) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setViewer(null)
      if (e.key === "ArrowRight") setViewer((v) => (v ? { ...v, i: (v.i + 1) % v.list.length } : v))
      if (e.key === "ArrowLeft") setViewer((v) => (v ? { ...v, i: (v.i - 1 + v.list.length) % v.list.length } : v))
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [viewer])

  if (!d) {
    return (
      <div className="wb-section" style={{ padding: 16 }}>
        <p style={{ color: "var(--color-neutral-600)" }}>{err ?? "…"}</p>
      </div>
    )
  }

  const weeks = d.weeks
  const current = allTime ? null : (week ?? d.week)
  const thisWeekStart = weekStart(d.today)
  const lastWeekStart = addDays(thisWeekStart, -7)

  return (
    <div className="wb-section" style={{ padding: "16px 12px 40px", maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
      {/* ---------- 头 ---------- */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" }}>{t.title}</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--color-neutral-700)" }}>{t.sub}</p>
        </div>
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          <Chip small active={lang === "en"} onClick={() => changeLang("en")}>
            EN
          </Chip>
          <Chip small active={lang === "zh"} onClick={() => changeLang("zh")}>
            中
          </Chip>
        </div>
      </div>
      <p style={{ margin: 0, fontSize: 12, color: d.me || d.owner ? "var(--color-accent-700)" : "var(--color-neutral-600)", fontWeight: d.me || d.owner ? 700 : 400 }}>
        {d.owner ? t.ownerNote : d.me ? t.hi(d.me.name) : t.guest}
      </p>

      {d.owner && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div>
            <button type="button" className="wb-chip wb-chip-sm" disabled={sync?.busy} onClick={() => void syncGoogle()}>
              {sync?.busy ? t.syncing : t.sync}
            </button>
          </div>
          {sync && !sync.busy && (
            <p style={{ margin: 0, fontSize: 12, lineHeight: 1.45, color: sync.error ? "var(--color-accent-700)" : "var(--color-neutral-700)" }}>
              {sync.error
                ? sync.error
                : [
                    t.syncDone(sync.added ?? 0),
                    sync.total != null && sync.have != null ? t.syncCount(sync.total, sync.have) : "",
                    sync.total != null && sync.have != null && sync.have < sync.total ? t.syncGap : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
            </p>
          )}
        </div>
      )}

      {/* ---------- 周切换 ---------- */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {weeks.slice(0, 6).map((w) => (
          <Chip
            key={w}
            small
            active={!allTime && current === w}
            onClick={() => {
              setAllTime(false)
              setWeek(w)
            }}
          >
            {/* 按日期本身判"本周/上周"，不能按在列表里的位置 —— 中间那周没评价时会错位 */}
            {w === thisWeekStart ? t.thisWeek : w === lastWeekStart ? t.lastWeek : weekLabel(w)}
          </Chip>
        ))}
        <Chip small active={allTime} onClick={() => setAllTime(true)}>
          {t.all}
        </Chip>
      </div>

      {/* ---------- 奖台 ---------- */}
      {podium.length > 0 && (
        <div className="card" style={{ padding: "20px 12px 12px", background: "var(--color-surface)" }}>
          <h6 style={{ margin: "0 0 16px" }}>{t.pool}</h6>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 10, minHeight: 170 }}>
            {podium.map((s) => {
              const rank = top3.findIndex((x) => x.id === s.id)
              const h = 54 + Math.round((s.poolCents / maxPool) * 76)
              return (
                <div key={s.id} style={{ flex: "1 1 0", maxWidth: 150, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <div style={{ fontSize: 22, lineHeight: 1 }}>{MEDALS[rank]}</div>
                  <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: "-0.02em" }}>{dollars(s.poolCents)}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, textAlign: "center", wordBreak: "break-word" }}>{s.name}</div>
                  <div
                    style={{
                      width: "100%",
                      height: h,
                      borderRadius: "4px 4px 0 0",
                      background: rank === 0 ? "var(--color-accent)" : rank === 1 ? "var(--color-accent-400)" : "var(--color-accent-300)",
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "center",
                      paddingTop: 6,
                      color: rank === 0 ? "#fff" : "var(--color-neutral-900)",
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {s.creditedCount}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ---------- 全员榜 ---------- */}
      <div className="wb-section">
        <h6 style={{ margin: 0 }}>{t.standings}</h6>
        <div style={{ display: "flex", flexDirection: "column", gap: 1, background: "var(--color-line)" }}>
          {d.standings.map((s, i) => {
            const life = d.lifetime.find((l) => l.id === s.id)
            return (
              <div key={s.id} style={{ background: "var(--color-bg)", padding: "10px 12px", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 20, fontSize: 12, fontWeight: 800, color: "var(--color-neutral-600)" }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    {s.name}
                    {leastId === s.id && <Tag cls="tag-ink">{t.least}</Tag>}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--color-neutral-600)", marginTop: 2 }}>
                    {t.banked} {dollars(s.creditedCents)} ({s.creditedCount})
                    {s.unsettledCents > 0 ? ` · ${t.owed} ${dollars(s.unsettledCents)}` : ""}
                    {s.contestedCount > 0 ? (
                      <span style={{ color: "var(--color-accent-700)" }}>
                        {" "}
                        · {t.inDispute} {dollars(s.contestedCents)} ({s.contestedCount})
                      </span>
                    ) : null}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>{dollars(s.poolCents)}</div>
                  {life && life.poolCents !== s.poolCents && (
                    <div style={{ fontSize: 10, color: "var(--color-neutral-600)" }}>
                      {t.lifetimeNote} {dollars(life.poolCents)}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ---------- 评价清单 ---------- */}
      <div className="wb-section">
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <h6 style={{ margin: 0 }}>{allTime ? t.all : weekLabel(current ?? d.week)}</h6>
          <span style={{ fontSize: 11, color: "var(--color-neutral-600)" }}>{t.summary(d.summary.total, d.summary.openCount, d.summary.openCents)}</span>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Chip small active={filter === "all"} onClick={() => setFilter("all")}>
            {t.fAll} {d.summary.total}
          </Chip>
          <Chip small active={filter === "open"} onClick={() => setFilter("open")}>
            {t.fOpen} {d.summary.openCount}
          </Chip>
          <Chip small active={filter === "credited"} onClick={() => setFilter("credited")}>
            {t.fCredited} {d.summary.credited}
          </Chip>
          {photoReviews > 0 && (
            <Chip small active={filter === "photo"} onClick={() => setFilter("photo")}>
              {t.fPhoto} {photoReviews}
            </Chip>
          )}
          {d.summary.contestedCount > 0 && (
            <Chip small active={filter === "contested"} onClick={() => setFilter("contested")}>
              {t.fContested} {d.summary.contestedCount}
            </Chip>
          )}
          {d.me && (
            <Chip small active={filter === "mine"} onClick={() => setFilter("mine")}>
              {t.fMine}
            </Chip>
          )}
        </div>

        {d.me && d.summary.openCount > 0 && <p style={{ margin: 0, fontSize: 11, color: "var(--color-neutral-600)" }}>{t.claimHelp}</p>}
        {err && <p style={{ margin: 0, fontSize: 12, color: "var(--color-accent-700)", fontWeight: 700 }}>{err}</p>}

        {wall.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--color-neutral-700)" }}>{t.photoWall(wall.length)}</span>
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
              {wall.map((ph, i) => (
                <Thumb key={`${ph.src}-${i}`} src={ph.src} size={96} label={ph.review.reviewer ?? ""} onOpen={() => setViewer({ list: wall, i })} />
              ))}
            </div>
          </div>
        )}

        {shown.length === 0 && <p style={{ margin: "8px 0", fontSize: 13, color: "var(--color-neutral-600)" }}>{t.nobody}</p>}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {shown.map((r) => (
            <div key={r.id} className="card" style={{ gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontSize: 11 }}>
                <Tag cls={r.platform === "yelp" ? "tag-accent" : "tag-ink"}>{PLATFORM_LABEL[r.platform] ?? r.platform}</Tag>
                <strong style={{ fontSize: 13 }}>{r.reviewer ?? "—"}</strong>
                {r.rating ? <span style={{ color: "var(--color-accent)" }}>{"★".repeat(Math.min(5, r.rating))}</span> : null}
                <span style={{ color: "var(--color-neutral-600)" }}>{r.date ?? ""}</span>
                {r.hasPhoto && <Tag cls="tag-accent">{t.photo}</Tag>}
                <span style={{ marginLeft: "auto", fontWeight: 800 }}>{dollars(r.hasPhoto ? 300 : 200)}</span>
              </div>

              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45, color: r.body ? "var(--color-text)" : "var(--color-neutral-500)" }}>{r.body || t.noText}</p>

              {(r.photos?.length ?? 0) > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(r.photos ?? []).map((src, i) => (
                    <Thumb
                      key={src}
                      src={src}
                      size={72}
                      label={r.reviewer ?? ""}
                      onOpen={() => setViewer({ list: (r.photos ?? []).map((x) => ({ src: x, review: r })), i })}
                    />
                  ))}
                </div>
              )}

              {/* 有人抢：名字互相亮出来，自己谈。谁放手，另一个人马上拿到。 */}
              {(r.state === "contested" || (r.state === "pending" && r.claimedBy.length > 1)) && (
                <div style={{ border: "1px solid var(--color-accent)", background: "var(--color-accent-100)", padding: "7px 9px", display: "flex", flexDirection: "column", gap: 4 }}>
                  <strong style={{ fontSize: 12, color: "var(--color-accent-700)" }}>{t.bothClaim(r.claimedBy.map((id) => nameOf(id)).join(" · "))}</strong>
                  <span style={{ fontSize: 11, color: "var(--color-neutral-700)", lineHeight: 1.4 }}>{t.disputeHelp}</span>
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 11 }}>
                {r.state === "credited" && (
                  <>
                    <Tag cls="tag-accent">{d.me && r.creditedTo === d.me.id ? t.yours : t.creditedTo(nameOf(r.creditedTo))}</Tag>
                    <Tag cls="tag-ink">{r.settled ? t.paid : t.owed}</Tag>
                  </>
                )}
                {r.state === "open" && r.namedChef && <Tag cls="tag-ink">{t.named(nameOf(r.namedChef))}</Tag>}
                {r.url && (
                  <a href={r.url} target="_blank" rel="noreferrer" style={{ color: "var(--color-neutral-700)", textDecoration: "underline" }}>
                    {t.open}
                  </a>
                )}
                {d.me && r.state === "open" && (
                  <button type="button" className="wb-chip wb-chip-sm" style={{ marginLeft: "auto" }} disabled={busy === r.id} onClick={() => void act("claim", r.id)}>
                    {t.claim}
                  </button>
                )}
                {/* 只有我自己认领来的才给撤回：抢中的是"让给他"，已经归我的是"撤回"。
                    老板手动指给我的没有认领记录，不给按钮（点了也没用）。 */}
                {d.me && r.minedByMe && !r.settled && (
                  <button type="button" className="wb-chip wb-chip-sm" style={{ marginLeft: "auto" }} disabled={busy === r.id} onClick={() => void act("unclaim", r.id)}>
                    {r.claimedBy.length > 1 ? t.giveUp : t.undo}
                  </button>
                )}
              </div>

              {/* 老板：知道是谁的，直接点名字，一下入账（和工作台 link_chef 同一条路）。
                  已结算的不给按钮——那种要先撤对账单。 */}
              {d.owner && !r.settled && (
                <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", borderTop: "1px dashed var(--color-line)", paddingTop: 6 }}>
                  <span style={{ fontSize: 10, color: "var(--color-neutral-600)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>{t.assignTo}</span>
                  {d.chefs.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="wb-chip wb-chip-sm"
                      aria-pressed={r.creditedTo === c.id ? "true" : "false"}
                      disabled={busy === r.id || r.creditedTo === c.id}
                      onClick={() => void act("assign", r.id, c.id)}
                    >
                      {c.name}
                    </button>
                  ))}
                  {r.creditedTo && (
                    <button type="button" className="wb-chip wb-chip-sm" disabled={busy === r.id} onClick={() => void act("unassign", r.id)}>
                      {t.clearIt}
                    </button>
                  )}
                  {/* 带图只能人眼标 —— 平台不给这个信息。已入账的也能改，
                      金额跟着 $2 ⇄ $3 走，不用先取消归属。 */}
                  <button
                    type="button"
                    className="wb-chip wb-chip-sm"
                    style={{ marginLeft: "auto" }}
                    disabled={busy === r.id}
                    onClick={() => void act("set_photo", r.id, undefined, !r.hasPhoto)}
                  >
                    {r.hasPhoto ? t.unmarkPhoto : t.markPhoto}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {viewer && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={viewer.list[viewer.i].review.reviewer ?? t.photo}
          onClick={() => setViewer(null)}
          style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,.86)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: 16 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- 平台图床的地址，不过 next/image */}
          <img
            src={photoFull(viewer.list[viewer.i].src)}
            alt={viewer.list[viewer.i].review.reviewer ?? ""}
            referrerPolicy="no-referrer"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "100%", maxHeight: "78vh", objectFit: "contain", background: "#111" }}
          />
          <div onClick={(e) => e.stopPropagation()} style={{ color: "#fff", fontSize: 13, textAlign: "center", maxWidth: 560, lineHeight: 1.45 }}>
            <strong>{viewer.list[viewer.i].review.reviewer ?? "—"}</strong>
            {viewer.list[viewer.i].review.date ? ` · ${viewer.list[viewer.i].review.date}` : ""}
            {viewer.list.length > 1 ? ` · ${viewer.i + 1}/${viewer.list.length}` : ""}
          </div>
          <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", gap: 8 }}>
            {viewer.list.length > 1 && (
              <button type="button" className="wb-chip wb-chip-sm" style={{ background: "#fff" }} onClick={() => setViewer({ ...viewer, i: (viewer.i - 1 + viewer.list.length) % viewer.list.length })}>
                ‹
              </button>
            )}
            <button type="button" className="wb-chip wb-chip-sm" style={{ background: "#fff" }} onClick={() => setViewer(null)}>
              {t.close}
            </button>
            {viewer.list.length > 1 && (
              <button type="button" className="wb-chip wb-chip-sm" style={{ background: "#fff" }} onClick={() => setViewer({ ...viewer, i: (viewer.i + 1) % viewer.list.length })}>
                ›
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/** 一张缩略图：方形裁切，加载失败（客人删了图）就整个不显示。 */
function Thumb({ src, size, label, onOpen }: { src: string; size: number; label: string; onOpen: () => void }) {
  const [gone, setGone] = useState(false)
  if (gone) return null
  return (
    <button type="button" onClick={onOpen} aria-label={label} style={{ flex: "none", width: size, height: size, padding: 0, border: "1px solid var(--color-line)", background: "var(--color-surface)", cursor: "zoom-in", overflow: "hidden" }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- 平台图床的地址，不过 next/image */}
      <img src={photoThumb(src, size * 2)} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setGone(true)} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
    </button>
  )
}
