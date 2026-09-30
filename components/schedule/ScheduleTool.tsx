"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Tag } from "@/components/admin/workbench/ui"
import { TileMap } from "@/components/schedule/TileMap"
import { formatClock, MAX_STOPS, parseScheduleText, type ParsedLine } from "@/lib/schedule-parse"
import { planTiers, type Grade, type TierKey, type TierPlan } from "@/lib/dispatch"

// 分享出去的排班计算器（老板 2026-09-29）：对方粘一天的「时间 + 地址」，算最少几个
// 师傅、谁接谁。算法和老板日历上那个弹窗是同一个（lib/dispatch.ts），只是在浏览器里跑：
// 服务器只负责查地址和车程（免费的 OpenStreetMap），改参数秒出、不占次数。
//
// 对方粘进来的地址只用来这一次计算，服务器不存。浏览器里留一份草稿（localStorage），
// 那是对方自己的设备，刷新页面不用重粘。

type Lang = "zh" | "en"
type Resolved = { lat: number | null; lng: number | null; approx: boolean; found: boolean }
type RunResult = { lines: ParsedLine[]; stops: Resolved[]; minutes: Array<Array<number | null>>; miles: Array<Array<number | null>>; matrixOk: boolean }
type LinkInfo = { name: string; dailyLimit: number; usedToday: number; maxStops: number }

const DRAFT_KEY = "rh-schedule-draft"
const PARAMS_KEY = "rh-schedule-params"
const DEFAULT_PARAMS = { busyMin: 90, busyMax: 120, early: 10, lateOk: 30, lateLimit: 60 }

const whenZh = (late: number) => (late <= 0 ? `早到 ${-late} 分` : `迟到 ${late} 分`)
const whenEn = (late: number) => (late <= 0 ? `${-late} min early` : `${late} min late`)

const T = {
  zh: {
    title: "排班计算器",
    sharedBy: (n: string) => `Real Hibachi 分享给 ${n}`,
    intro: "粘一天的场次进来，一行一场：开场时间 + 地址（中间可以带名字）。算出最少要几个师傅、谁接谁。",
    placeholder: "5:00 PM  100 Universal City Plaza, Universal City, CA 91608\n17:30 | Tony | 200 Santa Monica Pier, Santa Monica, CA 90401\n晚上7点  4MMM+HQ Joshua Tree, California",
    formats: "认得：5pm · 5:30 PM · 17:00 · 下午5点半。名字和地址之间用 | 或 Tab 隔开最稳。从 Google 表格直接复制也行。",
    preview: "解析结果",
    cTime: "时间",
    cName: "名字",
    cAddr: "地址",
    noTime: "没认出时间",
    run: (n: number) => `算这 ${n} 场`,
    running: (s: number) => `正在查地址和车程，大约 ${s} 秒…`,
    left: (n: number) => `今天还能算 ${n} 次 · 改下面的参数不占次数`,
    none: "今天的次数用完了，明天再来。",
    bad: "这个链接无效或已经收回了，找分享给你的人要个新的。",
    stale: "上面的内容改过了，下面还是上一次的结果——再点一次「算」。",
    chefs: (n: number) => `最少 ${n} 个师傅`,
    tier: (p: TierPlan) => (p.key === "safe" ? `稳妥 · ${p.chefs} 个师傅` : p.key === "late_ok" ? `肯迟到 ${p.tolerance} 分内 · ${p.chefs} 个` : `迟到到 ${p.tolerance} 分 · ${p.chefs} 个`),
    chef: (i: number) => `师傅 ${i}`,
    worstNone: "（拖满也不迟到）",
    worstMax: (m: number) => `（拖满的话最多迟到 ${m} 分）`,
    drive: (m: number, mi: number | null) => `路上 ${m} 分${mi !== null ? `（${mi} mi）` : ""}`,
    when: whenZh,
    sep: "，",
    both: (best: number, worst: number) => `顺利的话${whenZh(best)}，拖满的话${whenZh(worst)}`,
    worstOnly: (worst: number) => `拖满的话${whenZh(worst)}`,
    fix: (to: string, t: string, from: string | null, e: string | null) => `想稳：${to} 推到 ${t}${from && e ? `，或者 ${from} 提前到 ${e} 开` : ""}`,
    grade: { solid: "稳", ontime: "踩点", late_ok: "可能迟到", late_limit: "可能迟到很多" } as Record<Grade, string>,
    approx: "只到城市",
    approxHelp: "有的地址 OpenStreetMap 里没有这条街，图钉只能放在城市中心，车程会偏。想准一点：在 Google 地图上右键那个点，复制 Plus Code（像 4MMM+HQ Joshua Tree），替换那一行的地址，再算一次。",
    notFound: "定位不到",
    params: "参数",
    busy: "开场到装车出发",
    to: "到",
    early: "下一场提前到",
    lateOk: "迟到还能接受",
    lateLimit: "迟到极限",
    min: "分",
    copy: "复制成文字",
    copied: "已复制",
    rule: (a: number, b: number, c: number) => `算法：每个师傅的第一台准时开 → 开场到装车出发 ${a}–${b} 分 → 路上 → 下一场提前 ${c} 分到。迟到会顺着一个师傅的场次往下传。`,
    footer: "地图 © OpenStreetMap contributors · 车程由 OSRM 估算，不含堵车 · 你粘的地址只用于这次计算，服务器不保存",
    tooMany: `一次最多 ${MAX_STOPS} 场`,
    matrixFail: "车程没算出来（路线服务没响应），稍后再试。",
    lang: "EN",
  },
  en: {
    title: "Scheduler",
    sharedBy: (n: string) => `Shared by Real Hibachi with ${n}`,
    intro: "Paste one day of jobs, one per line: start time + address (a name in between is fine). Get the fewest chefs you need and who covers what.",
    placeholder: "5:00 PM  100 Universal City Plaza, Universal City, CA 91608\n17:30 | Tony | 200 Santa Monica Pier, Santa Monica, CA 90401\n7pm  4MMM+HQ Joshua Tree, California",
    formats: "Reads 5pm · 5:30 PM · 17:00. Separate name and address with | or a Tab for best results. Copying straight from Google Sheets works.",
    preview: "What I read",
    cTime: "Time",
    cName: "Name",
    cAddr: "Address",
    noTime: "No start time found",
    run: (n: number) => `Schedule these ${n}`,
    running: (s: number) => `Looking up addresses and drive times, about ${s}s…`,
    left: (n: number) => `${n} runs left today · changing the settings below is free`,
    none: "No runs left today. Try again tomorrow.",
    bad: "This link is invalid or has been revoked. Ask whoever shared it for a new one.",
    stale: "The list above changed; the result below is from the last run. Run it again.",
    chefs: (n: number) => `At least ${n} chef${n === 1 ? "" : "s"}`,
    tier: (p: TierPlan) => (p.key === "safe" ? `Safe · ${p.chefs} chefs` : p.key === "late_ok" ? `Up to ${p.tolerance} min late · ${p.chefs}` : `Up to ${p.tolerance} min late · ${p.chefs}`),
    chef: (i: number) => `Chef ${i}`,
    worstNone: "(on time even if parties run long)",
    worstMax: (m: number) => `(up to ${m} min late if parties run long)`,
    drive: (m: number, mi: number | null) => `${m} min drive${mi !== null ? ` (${mi} mi)` : ""}`,
    when: whenEn,
    sep: ", ",
    both: (best: number, worst: number) => `${whenEn(best)} if it goes smoothly, ${whenEn(worst)} if it runs long`,
    worstOnly: (worst: number) => `${whenEn(worst)} if it runs long`,
    fix: (to: string, t: string, from: string | null, e: string | null) => `To make it safe: move ${to} to ${t}${from && e ? `, or start ${from} at ${e}` : ""}`,
    grade: { solid: "safe", ontime: "on the dot", late_ok: "may be late", late_limit: "may be quite late" } as Record<Grade, string>,
    approx: "city only",
    approxHelp: "OpenStreetMap doesn't know some streets, so the pin sits at the city center and drive times are rough. For better accuracy, right-click the spot in Google Maps, copy its Plus Code (like 4MMM+HQ Joshua Tree), paste it in place of that address and run again.",
    notFound: "not found",
    params: "Settings",
    busy: "Start to packed up",
    to: "to",
    early: "Arrive before next start",
    lateOk: "Acceptable lateness",
    lateLimit: "Lateness limit",
    min: "min",
    copy: "Copy as text",
    copied: "Copied",
    rule: (a: number, b: number, c: number) => `Rule: each chef's first job starts on time → ${a}–${b} min from start to packed up → drive → arrive ${c} min before the next start. Lateness carries down a chef's day.`,
    footer: "Map © OpenStreetMap contributors · Drive times from OSRM, no traffic · Addresses you paste are used for this calculation only and are not stored",
    tooMany: `Up to ${MAX_STOPS} jobs at a time`,
    matrixFail: "Couldn't get drive times (routing service didn't respond). Try again shortly.",
    lang: "中文",
  },
}

const label = (l: ParsedLine) => l.name || l.address.split(",")[0].trim()

export function ScheduleTool() {
  const sp = useSearchParams()
  const token = (sp.get("t") ?? "").trim()

  const [lang, setLang] = useState<Lang>("zh")
  const t = T[lang]
  useEffect(() => {
    try {
      if (!navigator.language.toLowerCase().startsWith("zh")) setLang("en")
    } catch {}
  }, [])

  const [info, setInfo] = useState<LinkInfo | null>(null)
  const [bad, setBad] = useState(false)
  useEffect(() => {
    if (!token) {
      setBad(true)
      return
    }
    fetch(`/api/tools/schedule?t=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => (j?.ok ? setInfo(j as LinkInfo) : setBad(true)))
      .catch(() => setBad(true))
  }, [token])

  const [text, setText] = useState("")
  useEffect(() => {
    try {
      const d = localStorage.getItem(DRAFT_KEY)
      if (d) setText(d)
    } catch {}
  }, [])
  // 草稿只在对方打字时存：放 effect 里存，挂载那一下会先把空串写回去，刷新时可能把草稿冲掉
  const editText = (v: string) => {
    setText(v)
    try {
      localStorage.setItem(DRAFT_KEY, v)
    } catch {}
  }

  const parsed = useMemo(() => parseScheduleText(text), [text])
  // 按开场时间排好：图钉编号、师傅的场次都按时间走
  const okLines = useMemo(() => parsed.lines.filter((l) => !l.error).sort((a, b) => (a.startMin ?? 0) - (b.startMin ?? 0)), [parsed])

  // 参数是对方自己的排班习惯，记在他这台设备上，下次打开不用重填
  const [params, setParams] = useState(DEFAULT_PARAMS)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PARAMS_KEY) ?? "null") as Partial<Record<keyof typeof DEFAULT_PARAMS, unknown>> | null
      if (!saved || typeof saved !== "object") return
      setParams((d) => {
        const out = { ...d }
        for (const k of Object.keys(d) as Array<keyof typeof d>) {
          const v = saved[k]
          if (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 600) out[k] = v
        }
        return out
      })
    } catch {}
  }, [])
  // 只在对方动手改的时候存（放 effect 里存，挂载那一下会先把默认值写回去）
  const patchParams = (patch: Partial<typeof DEFAULT_PARAMS>) =>
    setParams((p) => {
      const next = { ...p, ...patch }
      try {
        localStorage.setItem(PARAMS_KEY, JSON.stringify(next))
      } catch {}
      return next
    })
  const [result, setResult] = useState<RunResult | null>(null)
  const [known, setKnown] = useState<Record<string, Resolved>>({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [tier, setTier] = useState<TierKey>("safe")
  const [open, setOpen] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)

  const sig = (ls: ParsedLine[]) => ls.map((l) => `${l.startMin}|${l.address}|${l.name ?? ""}`).join("\n")
  const stale = !!result && sig(result.lines) !== sig(okLines)
  const needLookup = okLines.filter((l) => !known[l.address]).length
  const runsLeft = info ? Math.max(0, info.dailyLimit - info.usedToday) : 0

  const run = async () => {
    if (busy || okLines.length === 0 || okLines.length > MAX_STOPS) return
    setBusy(true)
    setErr(null)
    try {
      const res = await fetch("/api/tools/schedule", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // 没改过的地址把上次查到的坐标带回去，服务器就不再查
        body: JSON.stringify({ t: token, stops: okLines.map((l) => ({ address: l.address, ...(known[l.address]?.found ? known[l.address] : {}) })) }),
      })
      const j = await res.json()
      if (!res.ok || !j.ok) {
        setErr(j?.error ?? `HTTP ${res.status}`)
        if (res.status === 404) setBad(true)
        return
      }
      const stops = j.stops as Resolved[]
      setKnown((k) => {
        const next = { ...k }
        okLines.forEach((l, i) => {
          if (stops[i]?.found) next[l.address] = stops[i]
        })
        return next
      })
      setResult({ lines: okLines, stops, minutes: j.minutes, miles: j.miles, matrixOk: j.matrixOk })
      setInfo((i) => (i ? { ...i, usedToday: j.usedToday, dailyLimit: j.dailyLimit } : i))
      setOpen(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : "network error")
    } finally {
      setBusy(false)
    }
  }

  // 排班在浏览器里算：参数一改立刻重排，不再联网
  const plans = useMemo(() => {
    if (!result) return []
    return planTiers(
      result.lines.map((l) => l.startMin ?? 0),
      result.minutes,
      { busyMinMinutes: params.busyMin, busyMaxMinutes: Math.max(params.busyMin, params.busyMax), arriveEarlyMinutes: params.early },
      params.lateOk,
      Math.max(params.lateOk, params.lateLimit),
    )
  }, [result, params])
  const plan = plans.find((p) => p.key === tier) ?? plans[0] ?? null

  // 地图宽度跟着容器走（手机上别被裁掉一半）
  const mapBox = useRef<HTMLDivElement | null>(null)
  const [mapW, setMapW] = useState(640)
  useEffect(() => {
    const el = mapBox.current
    if (!el) return
    const fit = () => setMapW(Math.min(720, Math.max(280, Math.floor(el.clientWidth))))
    // 先量一次，别等 ResizeObserver 的第一次回调（页面在后台时它根本不来）
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [result])

  const placedIdx = result ? result.stops.map((s, i) => (s.lat !== null && s.lng !== null ? i : -1)).filter((i) => i >= 0) : []
  const num = (i: number) => placedIdx.indexOf(i) + 1

  const copyText = async () => {
    if (!result || !plan) return
    const L = result.lines
    const worstLate = Math.max(0, ...plan.links.map((l) => l.worstLate))
    const out = [`${t.chefs(plan.chefs)} ${worstLate > 0 ? t.worstMax(worstLate) : t.worstNone}`]
    plan.chains.forEach((c, ci) => {
      const parts = c.map((i, k) => {
        const link = k > 0 ? plan.links.find((l) => l.from === c[k - 1] && l.to === i) : null
        return `${link ? `→ ${t.drive(link.driveMinutes, result.miles[link.from]?.[i] ?? null)}${t.sep}${t.worstOnly(link.worstLate)} → ` : ""}${formatClock(L[i].startMin ?? 0)} ${label(L[i])}`
      })
      out.push(`${t.chef(ci + 1)}：${parts.join(" ")}`)
    })
    out.push(t.rule(params.busyMin, params.busyMax, params.early))
    try {
      await navigator.clipboard.writeText(out.join("\n"))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  const num5 = (v: number, set: (n: number) => void) => (
    <input className="input" inputMode="numeric" style={{ width: 64, textAlign: "center" }} value={v} onChange={(e) => set(Math.max(0, Math.min(600, Number(e.target.value.replace(/\D/g, "")) || 0)))} />
  )

  return (
    // .wb 是纵向 flex，margin:auto 会让这层按内容定宽——地图一画 640 就把手机屏撑破；
    // 写死 width:100% 才能让它跟着屏幕缩，地图再按缩下来的宽度重画
    <div style={{ width: "100%", maxWidth: 820, boxSizing: "border-box", margin: "0 auto", padding: "28px 16px 64px", display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: "var(--font-heading, Archivo)", fontWeight: 800, fontSize: 30 }}>{t.title}</div>
          {info ? <div style={{ fontSize: 13, color: "var(--color-neutral-600)", marginTop: 2 }}>{t.sharedBy(info.name)}</div> : null}
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setLang(lang === "zh" ? "en" : "zh")}>
          {t.lang}
        </button>
      </div>

      {bad ? (
        <div className="notice">{t.bad}</div>
      ) : (
        <>
          <div style={{ fontSize: 14, lineHeight: 1.6 }}>{t.intro}</div>

          <textarea className="input" rows={8} value={text} onChange={(e) => editText(e.target.value)} placeholder={t.placeholder} style={{ fontFamily: "ui-monospace, Menlo, Consolas, monospace", fontSize: 13, lineHeight: 1.6 }} />
          <div style={{ fontSize: 12, color: "var(--color-neutral-600)", marginTop: -10 }}>{t.formats}</div>

          {parsed.lines.length > 0 ? (
            <div>
              <div className="kicker" style={{ marginBottom: 4 }}>{t.preview}</div>
              <table className="table" style={{ width: "100%", fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", width: 80 }}>{t.cTime}</th>
                    <th style={{ textAlign: "left", width: 110 }}>{t.cName}</th>
                    <th style={{ textAlign: "left" }}>{t.cAddr}</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.lines.map((l) => (
                    <tr key={l.lineNo} style={{ color: l.error ? "var(--color-accent-700, #b8240d)" : undefined }}>
                      <td style={{ whiteSpace: "nowrap", fontWeight: 700 }}>{l.timeLabel ?? "—"}</td>
                      <td>{l.name ?? ""}</td>
                      <td>{l.error ? `${t.noTime} · ${l.raw.trim()}` : l.address}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsed.warnings.map((w) => (
                <div key={w} className="notice" style={{ marginTop: 8 }}>{w}</div>
              ))}
            </div>
          ) : null}

          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <button type="button" className="btn btn-primary" disabled={busy || okLines.length === 0 || okLines.length > MAX_STOPS || !info || runsLeft <= 0} onClick={() => void run()}>
              {busy ? t.running(Math.max(2, Math.ceil(needLookup * 1.3) + 1)) : okLines.length > MAX_STOPS ? t.tooMany : t.run(okLines.length)}
            </button>
            {info ? <span style={{ fontSize: 12.5, color: "var(--color-neutral-600)" }}>{runsLeft > 0 ? t.left(runsLeft) : t.none}</span> : null}
          </div>
          {err ? <div className="notice danger">{err}</div> : null}

          {result ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {stale ? <div className="notice">{t.stale}</div> : null}
              {!result.matrixOk ? <div className="notice danger">{t.matrixFail}</div> : null}

              {plans.length > 1 ? (
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {plans.map((p) => (
                    <button key={p.key} type="button" className="wb-chip wb-chip-sm" aria-pressed={plan?.key === p.key} onClick={() => setTier(p.key)}>
                      {t.tier(p)}
                    </button>
                  ))}
                </div>
              ) : null}

              <div ref={mapBox} style={{ width: "100%", minWidth: 0, overflow: "hidden" }}>
                {placedIdx.length ? (
                  <TileMap
                    width={mapW}
                    height={Math.round(mapW * 0.62)}
                    pins={placedIdx.map((i) => ({
                      id: String(i),
                      lat: result.stops[i].lat as number,
                      lng: result.stops[i].lng as number,
                      label: String(num(i)),
                      title: `${formatClock(result.lines[i].startMin ?? 0)} ${label(result.lines[i])}`,
                      active: open === i,
                      muted: result.stops[i].approx,
                    }))}
                    lines={(plan?.links ?? []).map((l) => ({ fromId: String(l.from), toId: String(l.to), dashed: l.worstLate > 0, text: `${t.drive(l.driveMinutes, null)} · ${t.when(l.worstLate)}` }))}
                    onPick={(id) => setOpen(open === Number(id) ? null : Number(id))}
                  />
                ) : null}
              </div>

              {open !== null && result.lines[open] ? (
                <div style={{ border: "2px solid var(--color-text)", padding: 12 }}>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>
                    {num(open)}. {formatClock(result.lines[open].startMin ?? 0)} {label(result.lines[open])}
                    {result.stops[open].approx ? <Tag cls="tag-faint" style={{ marginLeft: 8 }}>{t.approx}</Tag> : null}
                  </div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>{result.lines[open].address}</div>
                  <a className="btn btn-secondary btn-sm" style={{ marginTop: 8, display: "inline-flex" }} href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(result.lines[open].address)}`} target="_blank" rel="noopener noreferrer">
                    Google Maps
                  </a>
                </div>
              ) : null}

              {plan ? (
                <div>
                  <div style={{ borderBottom: "2px solid var(--color-text)", paddingBottom: 6, fontFamily: "var(--font-heading, Archivo)", fontWeight: 800, fontSize: 18, display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                    <span>
                      {t.chefs(plan.chefs)}{" "}
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-neutral-600)" }}>
                        {plan.links.some((l) => l.worstLate > 0) ? t.worstMax(Math.max(...plan.links.map((l) => l.worstLate))) : t.worstNone}
                      </span>
                    </span>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => void copyText()}>
                      {copied ? t.copied : t.copy}
                    </button>
                  </div>
                  {plan.chains.map((chain, ci) => (
                    <div key={ci} style={{ padding: "9px 0", borderBottom: "1px solid var(--color-divider)", display: "flex", gap: 10, alignItems: "baseline" }}>
                      <span className="kicker" style={{ width: 56, flex: "none" }}>{t.chef(ci + 1)}</span>
                      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4, fontSize: 14 }}>
                        {chain.map((i, k) => {
                          const L = result.lines[i]
                          const s = result.stops[i]
                          const link = k > 0 ? plan.links.find((l) => l.from === chain[k - 1] && l.to === i) : null
                          const risky = !!link && link.worstLate > 0
                          return (
                            <div key={i}>
                              {link ? (
                                <div style={{ fontSize: 12.5, lineHeight: 1.6, padding: "1px 0 3px 10px", marginLeft: 4, borderLeft: `2px ${risky ? "dashed" : "solid"} var(--color-accent)`, color: risky ? "var(--color-accent-700, #b8240d)" : "var(--color-neutral-600)", fontWeight: risky ? 700 : 400 }}>
                                  {t.drive(link.driveMinutes, result.miles[link.from]?.[i] ?? null)} · <Tag cls={risky ? "tag-accent" : "tag-faint"}>{t.grade[link.grade]}</Tag>
                                  <br />
                                  {t.both(link.bestLate, link.worstLate)}
                                  {link.fix ? (
                                    <>
                                      <br />
                                      {t.fix(label(L), formatClock(link.fix.laterStartMin), link.fix.earlierStartMin !== null ? label(result.lines[link.from]) : null, link.fix.earlierStartMin !== null ? formatClock(link.fix.earlierStartMin) : null)}
                                    </>
                                  ) : null}
                                </div>
                              ) : null}
                              <button type="button" className="btn btn-ghost" style={{ padding: 0, minHeight: 0, fontWeight: 700, fontSize: 14 }} onClick={() => (s.lat !== null ? setOpen(open === i ? null : i) : undefined)}>
                                {s.lat !== null ? `${num(i)}. ` : ""}
                                {formatClock(L.startMin ?? 0)} {label(L)}
                              </button>
                              {!s.found ? <span style={{ color: "var(--color-accent-700, #b8240d)" }}> · {t.notFound}</span> : s.approx ? <span style={{ color: "var(--color-neutral-600)" }}> · {t.approx}</span> : null}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                  {result.stops.some((s) => s.approx || !s.found) ? <div className="notice" style={{ marginTop: 10, fontSize: 12.5, lineHeight: 1.6 }}>{t.approxHelp}</div> : null}
                </div>
              ) : null}

              <div style={{ border: "1px solid var(--color-line)", padding: 12 }}>
                <div className="kicker" style={{ marginBottom: 8 }}>{t.params}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 18px", alignItems: "center", fontSize: 13 }}>
                  <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                    {t.busy} {num5(params.busyMin, (n) => patchParams({ busyMin: n }))} {t.to} {num5(params.busyMax, (n) => patchParams({ busyMax: n }))} {t.min}
                  </span>
                  <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                    {t.early} {num5(params.early, (n) => patchParams({ early: n }))} {t.min}
                  </span>
                  <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                    {t.lateOk} {num5(params.lateOk, (n) => patchParams({ lateOk: n }))} {t.min}
                  </span>
                  <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                    {t.lateLimit} {num5(params.lateLimit, (n) => patchParams({ lateLimit: n }))} {t.min}
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--color-neutral-600)", marginTop: 8, lineHeight: 1.6 }}>{t.rule(params.busyMin, params.busyMax, params.early)}</div>
              </div>
            </div>
          ) : null}

          <div style={{ fontSize: 11, color: "var(--color-neutral-500)", lineHeight: 1.6 }}>{t.footer}</div>
        </>
      )}
    </div>
  )
}
