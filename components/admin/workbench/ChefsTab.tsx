"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { adminJson } from "./api"
import { Chip, Dialog, DialogHead, Field } from "./ui"
import { addDays, dowZh, md, money, prettyPhone, ptToday } from "./helpers"
import { weekStartOf, type ChefSummary, type MediaItem } from "./chef-types"
import { BILLING_LABELS, rateLabel } from "@/lib/chef-pay"
import type { WorkbenchSettings } from "@/lib/workbench-settings-shared"

// 厨师 · 名单（按周看场次、工价、评价、结余）+ 素材库（按天看所有师傅传的照片视频）.

export type ChefTabKey = "shifts" | "profile" | "perf" | "docs" | "settle" | "files"

export function ChefsTab({
  adminKey,
  chefs,
  settings,
  isMobile,
  viewerRole,
  sensitive,
  initialView,
  onOpenChef,
  onChanged,
}: {
  adminKey: string
  chefs: ChefSummary[]
  settings: WorkbenchSettings
  isMobile: boolean
  viewerRole: "owner" | "agent" | null
  sensitive: boolean
  initialView?: "list" | "media" | null
  onOpenChef: (id: string, tab?: ChefTabKey) => void
  onChanged: () => Promise<void> | void
}) {
  const [view, setView] = useState<"list" | "media">(initialView ?? "list")
  const today = ptToday()
  const thisWeekStart = weekStartOf(today)
  const [week, setWeek] = useState(thisWeekStart)
  const [showAdd, setShowAdd] = useState(false)
  const weekEnd = addDays(week, 6)
  const weekTitle = week === thisWeekStart ? "本周" : week === addDays(thisWeekStart, -7) ? "上周" : week === addDays(thisWeekStart, 7) ? "下周" : `${md(week)} 那周`
  const weekLabel = `${md(week)} – ${md(weekEnd)}`

  const rows = useMemo(
    () =>
      chefs.map((c) => {
        const ws = c.shifts.filter((s) => s.date >= week && s.date <= weekEnd && s.orderStatus !== "cancelled")
        const net = c.openPayCents + c.openTipCents - c.openCashCents
        return { c, weekCount: ws.length, weekGuests: ws.reduce((a, s) => a + s.share, 0), net }
      }),
    [chefs, week, weekEnd],
  )
  const weekTotal = rows.reduce((a, r) => a + r.weekCount, 0)
  const alerts = useMemo(() => {
    const out: Array<{ who: string; kind: string; text: string; id: string; tab: ChefTabKey }> = []
    if (!sensitive) return out
    for (const c of chefs) {
      if (c.status !== "active") continue
      if (c.doc.level !== "ok") out.push({ who: c.name, kind: "证件", text: c.doc.label, id: c.id, tab: "docs" })
      if (c.taxMissing) out.push({ who: c.name, kind: "报税", text: "W-9 / 报税信息未填全", id: c.id, tab: "docs" })
      if (c.pendingReceipts) out.push({ who: c.name, kind: "报销", text: `${c.pendingReceipts} 张发票待报销 · ${money(c.pendingReceiptCents)}`, id: c.id, tab: "files" })
    }
    return out
  }, [chefs, sensitive])

  const balanceLabel = (net: number) => (net > 0 ? `欠他 ${money(net)}` : net < 0 ? `他欠 ${money(-net)}` : "已结清")

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ fontSize: 22 }}>厨师</h2>
        <div style={{ display: "flex" }}>
          <Chip active={view === "list"} onClick={() => setView("list")}>
            名单
          </Chip>
          <Chip active={view === "media"} onClick={() => setView("media")} style={{ marginLeft: -1 }}>
            素材库 · 按天
          </Chip>
        </div>
        {view === "list" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto", flexWrap: "wrap" }}>
            <button type="button" className="btn btn-secondary btn-icon" onClick={() => setWeek(addDays(week, -7))} aria-label="上一周">
              ‹
            </button>
            <button type="button" className="btn btn-secondary btn-icon" onClick={() => setWeek(addDays(week, 7))} aria-label="下一周">
              ›
            </button>
            <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>
              {weekTitle} <span style={{ fontWeight: 400, color: "var(--color-neutral-600)" }}>{weekLabel} · {weekTotal} 场</span>
            </span>
            {week !== thisWeekStart ? (
              <button type="button" className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => setWeek(thisWeekStart)}>
                回到本周
              </button>
            ) : null}
            {sensitive ? (
              <button type="button" className="btn btn-secondary" style={{ whiteSpace: "nowrap" }} onClick={() => setShowAdd(true)}>
                + 添加厨师
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {view === "media" ? <MediaLibrary adminKey={adminKey} isMobile={isMobile} /> : null}

      {view === "list" ? (
        <>
          {alerts.length > 0 ? (
            <div style={{ display: "flex", alignItems: "baseline", gap: "10px 16px", flexWrap: "wrap", padding: "10px 12px", border: "2px solid var(--color-divider)", fontSize: 13 }}>
              <span className="kicker" style={{ color: "var(--color-accent)", fontWeight: 800, whiteSpace: "nowrap" }}>
                待处理 {alerts.length}
              </span>
              {alerts.map((a, i) => (
                <button key={i} type="button" className="wb-row" onClick={() => onOpenChef(a.id, a.tab)} style={{ border: 0, background: "transparent", padding: 0, font: "inherit", color: "inherit", textAlign: "left", whiteSpace: "nowrap" }}>
                  <strong>{a.who}</strong> <span style={{ color: "var(--color-neutral-600)" }}>{a.kind} ·</span> {a.text} <span style={{ color: "var(--color-accent-700)" }}>→</span>
                </button>
              ))}
            </div>
          ) : null}
          {chefs.length === 0 ? <div className="empty">还没有厨师。点右上角"添加厨师"。</div> : null}
          {!isMobile ? (
            <table className="table">
              <thead>
                <tr style={{ whiteSpace: "nowrap" }}>
                  <th>厨师</th>
                  <th className="r">{weekTitle}场次</th>
                  <th>{sensitive ? "工价 · 能力" : "能力"}</th>
                  <th>评价 · 准时</th>
                  {sensitive ? <th className="r">本期结余</th> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ c, weekCount, weekGuests, net }) => (
                  <tr key={c.id} className="wb-row" onClick={() => onOpenChef(c.id, "profile")} style={{ opacity: c.status === "active" ? 1 : 0.55 }}>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <div style={{ fontWeight: 600 }}>
                        {c.name}
                        {c.status !== "active" ? <span className="tag tag-faint" style={{ marginLeft: 6 }}>停用</span> : null}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>{prettyPhone(c.phone)}</div>
                      <div style={{ fontSize: 11, color: "var(--color-neutral-600)" }}>{c.areas.join(" / ") || "区域未填"}</div>
                    </td>
                    <td
                      className="r"
                      style={{ whiteSpace: "nowrap" }}
                      onClick={(e) => {
                        e.stopPropagation()
                        onOpenChef(c.id, "shifts")
                      }}
                    >
                      <div className="num" style={{ fontSize: 18, color: weekCount ? "var(--color-text)" : "var(--color-neutral-500)" }}>
                        {weekCount}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--color-neutral-600)" }}>{weekGuests} 人</div>
                    </td>
                    <td style={{ maxWidth: 0, width: "36%", minWidth: 150 }}>
                      {sensitive && c.rate ? <div className="clamp1">{rateLabel(c.rate)}</div> : null}
                      <div className="clamp1" style={{ fontSize: 11, color: "var(--color-neutral-600)" }}>
                        {c.skills.join(" · ") || "能力未填"}
                      </div>
                    </td>
                    <td
                      style={{ whiteSpace: "nowrap", fontSize: 11 }}
                      onClick={(e) => {
                        e.stopPropagation()
                        onOpenChef(c.id, "perf")
                      }}
                    >
                      <div style={{ fontSize: 12 }}>
                        <span style={{ fontWeight: 600 }}>好 {c.good}</span> · <span style={{ fontWeight: 600, color: c.bad ? "var(--color-accent-700)" : undefined }}>差 {c.bad}</span> <span style={{ color: "var(--color-neutral-600)" }}>/ {c.perfCount}</span>
                      </div>
                      <div style={{ color: c.late ? "var(--color-accent-700)" : "var(--color-neutral-600)" }}>{c.perfCount ? (c.late ? `迟到 ${c.late} 次 · ${Math.round((100 * c.late) / c.perfCount)}%` : "从未迟到") : "还没记录"}</div>
                    </td>
                    {sensitive ? (
<td
                      className="r"
                      style={{ whiteSpace: "nowrap" }}
                      onClick={(e) => {
                        e.stopPropagation()
                        onOpenChef(c.id, "settle")
                      }}
                    >
                      <div style={{ fontWeight: 600, color: net < 0 ? "var(--color-accent-700)" : undefined }}>{balanceLabel(net)}</div>
                      <div style={{ fontSize: 11, color: "var(--color-neutral-600)" }}>
                        {BILLING_LABELS[c.billing_cycle] ?? c.billing_cycle} · 上次 {c.last_settled_at ? md(c.last_settled_at) : "—"}
                        {c.openShifts ? ` · 可结 ${c.openShifts} 场` : ""}
                        {c.awaitingMethod ? <span style={{ color: "var(--color-accent-700)" }}> · 待确认收款 {c.awaitingMethod} 场</span> : null}
                      </div>
                    </td>
) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
              {rows.map(({ c, weekCount, weekGuests, net }) => (
                <article key={c.id} className="card wb-row" onClick={() => onOpenChef(c.id, "profile")} style={{ gap: 8, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 17 }}>{c.name}</div>
                    <span style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>{c.areas.join(" / ")}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>{prettyPhone(c.phone)}</div>
                  {sensitive && c.rate ? <div style={{ fontSize: 13 }}>{rateLabel(c.rate)}</div> : null}
                  <div style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>{c.skills.join(" · ")}</div>
                  <div style={{ fontSize: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <span>
                      好 {c.good} · <span style={{ color: c.bad ? "var(--color-accent-700)" : undefined }}>差 {c.bad}</span>
                    </span>
                    <span style={{ color: c.late ? "var(--color-accent-700)" : "var(--color-neutral-600)" }}>{c.late ? `迟到 ${c.late} 次` : "准时"}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, borderTop: "1px solid var(--color-line)", paddingTop: 8 }}>
                    <span>
                      {weekTitle} <strong>{weekCount}</strong> 场 · {weekGuests} 人
                    </span>
                    {sensitive ? <span style={{ fontWeight: 600, color: net < 0 ? "var(--color-accent-700)" : undefined }}>{balanceLabel(net)}</span> : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      ) : null}

      {showAdd ? (
        <AddChefDialog
          adminKey={adminKey}
          settings={settings}
          onClose={() => setShowAdd(false)}
          onDone={async (id) => {
            setShowAdd(false)
            await onChanged()
            onOpenChef(id, "profile")
          }}
        />
      ) : null}
      {!sensitive ? <div style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>坐席可以看场次、记迟到和评价、派单；工价、证件、报税、结算和报销只有管理员（或开了权限的人）能看。</div> : viewerRole === "agent" ? <div style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>坐席可以派单、记迟到和评价；工价、证件、结算只有管理员能改。</div> : null}
    </section>
  )
}

function AddChefDialog({ adminKey, settings, onClose, onDone }: { adminKey: string; settings: WorkbenchSettings; onClose: () => void; onDone: (id: string) => void }) {
  const d = settings.chefs
  const [form, setForm] = useState({ name: "", phone: "", wechat: "", base: String(d.default_base_pay_cents / 100), headFrom: String(d.default_head_from), perHead: String(d.default_per_head_cents / 100), billing: "weekly", areas: [] as string[], skills: [] as string[] })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const toggle = (k: "areas" | "skills", v: string) => setForm((f) => ({ ...f, [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] }))
  const submit = async () => {
    if (!form.name.trim()) {
      setMsg("名字必填")
      return
    }
    setBusy(true)
    try {
      const r = await adminJson<{ ok: boolean; id?: string; error?: string }>(adminKey, "/api/admin/chefs", {
        body: { action: "create", name: form.name.trim(), phone: form.phone.trim(), wechat: form.wechat.trim(), base_pay_cents: Math.round(Number(form.base) * 100) || 0, head_from: Number(form.headFrom) || 0, per_head_cents: Math.round(Number(form.perHead) * 100) || 0, billing_cycle: form.billing, areas: form.areas, skills: form.skills },
      })
      if (r.ok && r.id) onDone(r.id)
      else setMsg(r.error ?? "添加失败")
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "添加失败")
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog onClose={onClose} width={560}>
      <DialogHead title="添加厨师" lines={["名字和电话先填，工价用默认值，之后在资料页改。"]} onClose={onClose} />
      <div className="dialog-col" style={{ gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="名字 *">
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="手机">
            <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="微信">
            <input className="input" value={form.wechat} onChange={(e) => setForm({ ...form, wechat: e.target.value })} />
          </Field>
          <Field label="结算周期">
            <select className="input" value={form.billing} onChange={(e) => setForm({ ...form, billing: e.target.value })}>
              {Object.entries(BILLING_LABELS).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="每场底价 $">
            <input className="input" type="number" value={form.base} onChange={(e) => setForm({ ...form, base: e.target.value })} />
          </Field>
          <Field label="超过多少人开始加">
            <input className="input" type="number" value={form.headFrom} onChange={(e) => setForm({ ...form, headFrom: e.target.value })} />
          </Field>
          <Field label="每加一人 $">
            <input className="input" type="number" value={form.perHead} onChange={(e) => setForm({ ...form, perHead: e.target.value })} />
          </Field>
        </div>
        <div>
          <div className="kicker" style={{ marginBottom: 6 }}>区域</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {d.area_options.map((a) => (
              <Chip key={a} small active={form.areas.includes(a)} onClick={() => toggle("areas", a)}>
                {a}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <div className="kicker" style={{ marginBottom: 6 }}>能力</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {d.skill_options.map((a) => (
              <Chip key={a} small active={form.skills.includes(a)} onClick={() => toggle("skills", a)}>
                {a}
              </Chip>
            ))}
          </div>
        </div>
        {msg ? <div className="notice danger">{msg}</div> : null}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            取消
          </button>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void submit()}>
            {busy ? "添加中…" : "添加"}
          </button>
        </div>
      </div>
    </Dialog>
  )
}

// ---------------------------------------------------------------- 素材库

function MediaLibrary({ adminKey, isMobile }: { adminKey: string; isMobile: boolean }) {
  const [items, setItems] = useState<MediaItem[] | null>(null)
  const [saved, setSaved] = useState<string[]>([])
  const [date, setDate] = useState<string | null>(null)
  const [type, setType] = useState<"all" | "photo" | "video">("all")
  const [picks, setPicks] = useState<Set<string>>(new Set())
  const [msg, setMsg] = useState<string | null>(null)
  const [showSaved, setShowSaved] = useState(false)

  const load = useCallback(async () => {
    try {
      const d = await adminJson<{ ok: boolean; items: MediaItem[]; picks: string[] }>(adminKey, "/api/admin/chef-media")
      setItems(d.items ?? [])
      setSaved(d.picks ?? [])
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "读取失败")
      setItems([])
    }
  }, [adminKey])
  useEffect(() => {
    void load()
  }, [load])

  const dates = useMemo(() => Array.from(new Set((items ?? []).map((i) => i.date))).sort().reverse(), [items])
  const cur = showSaved ? null : date ?? dates[0] ?? null
  const shown = useMemo(() => (items ?? []).filter((i) => (showSaved ? saved.includes(i.id) : i.date === cur) && (type === "all" || i.type === type)), [items, cur, type, showSaved, saved])
  const groups = useMemo(() => {
    const m = new Map<string, MediaItem[]>()
    for (const i of shown) (m.get(`${i.chef}|${i.event}`) ?? m.set(`${i.chef}|${i.event}`, []).get(`${i.chef}|${i.event}`)!).push(i)
    return Array.from(m.entries()).map(([k, list]) => ({ chef: k.split("|")[0], event: k.split("|")[1], items: list }))
  }, [shown])

  const savePicks = async () => {
    const ids = Array.from(new Set([...saved, ...picks]))
    try {
      const d = await adminJson<{ ok: boolean; picks: string[] }>(adminKey, "/api/admin/chef-media", { body: { action: "picks", ids } })
      setSaved(d.picks ?? ids)
      setPicks(new Set())
      setMsg(`选材夹现在 ${(d.picks ?? ids).length} 个`)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "保存失败")
    }
  }
  const removeSaved = async (id: string) => {
    const ids = saved.filter((x) => x !== id)
    const d = await adminJson<{ ok: boolean; picks: string[] }>(adminKey, "/api/admin/chef-media", { body: { action: "picks", ids } })
    setSaved(d.picks ?? ids)
  }
  const download = () => {
    for (const i of shown.filter((x) => picks.has(x.id))) if (i.url) window.open(i.url, "_blank", "noopener")
  }

  return (
    <>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
        <button type="button" className="wb-chip" aria-pressed={showSaved ? "true" : "false"} onClick={() => setShowSaved(true)} style={{ flexDirection: "column", alignItems: "flex-start", gap: 0, padding: "6px 12px", lineHeight: 1.3 }}>
          <span style={{ fontWeight: 600 }}>选材夹</span>
          <span style={{ fontSize: 11, opacity: 0.7 }}>{saved.length} 个</span>
        </button>
        {dates.map((d) => {
          const list = (items ?? []).filter((i) => i.date === d)
          return (
            <button
              key={d}
              type="button"
              className="wb-chip"
              aria-pressed={!showSaved && d === cur ? "true" : "false"}
              onClick={() => {
                setShowSaved(false)
                setDate(d)
              }}
              style={{ flexDirection: "column", alignItems: "flex-start", gap: 0, padding: "6px 12px", lineHeight: 1.3 }}
            >
              <span style={{ fontWeight: 600 }}>
                {md(d)} {dowZh(d)}
              </span>
              <span style={{ fontSize: 11, opacity: 0.7 }}>
                {list.filter((i) => i.type === "photo").length} 图 · {list.filter((i) => i.type === "video").length} 视频
              </span>
            </button>
          )
        })}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <h4 style={{ fontSize: 17 }}>{showSaved ? "选材夹" : cur ? `${md(cur)} ${dowZh(cur)}` : "还没有上传"}</h4>
        <div style={{ display: "flex", marginLeft: 8 }}>
          {(["all", "photo", "video"] as const).map((t) => (
            <Chip key={t} small active={type === t} onClick={() => setType(t)} style={{ marginLeft: -1 }}>
              {t === "all" ? "全部" : t === "photo" ? "照片" : "视频"}
            </Chip>
          ))}
        </div>
        {picks.size > 0 ? (
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13 }}>
              已选 <strong style={{ color: "var(--color-accent-700)" }}>{picks.size}</strong>
            </span>
            {!showSaved ? (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => void savePicks()}>
                加入选材夹
              </button>
            ) : null}
            <button type="button" className="btn btn-secondary btn-sm" onClick={download}>
              下载原片
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPicks(new Set())}>
              清空
            </button>
          </div>
        ) : null}
      </div>
      {msg ? <div className="notice">{msg}</div> : null}
      {items === null ? <div className="empty">读取中…</div> : null}
      {items !== null && shown.length === 0 ? <div style={{ fontSize: 13, color: "var(--color-neutral-600)", padding: "24px 0", borderTop: "2px solid var(--color-divider)" }}>{showSaved ? "选材夹是空的。在某一天里点选照片，再点“加入选材夹”。" : "这天没有上传。"}</div> : null}
      {groups.map((g) => (
        <div key={`${g.chef}|${g.event}`} style={{ borderTop: "2px solid var(--color-divider)", paddingTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
            <div style={{ fontSize: 13 }}>
              <strong>{g.chef}</strong> <span style={{ color: "var(--color-neutral-600)" }}>· {g.event}</span>
            </div>
            <span style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>{g.items.length} 个</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, minmax(0,1fr))" : "repeat(auto-fill, minmax(168px, 1fr))", gap: 8 }}>
            {g.items.map((m) => {
              const picked = picks.has(m.id)
              return (
                <button
                  key={m.id}
                  type="button"
                  className="wb-ev"
                  aria-pressed={picked ? "true" : "false"}
                  onClick={() =>
                    setPicks((s) => {
                      const n = new Set(s)
                      if (n.has(m.id)) n.delete(m.id)
                      else n.add(m.id)
                      return n
                    })
                  }
                  onDoubleClick={() => m.url && window.open(m.url, "_blank", "noopener")}
                  title={`${m.chef} · ${m.event}${m.phase ? ` · ${m.phase === "setup" ? "开始" : "结束"}` : ""} · 双击放大`}
                  style={{ position: "relative", aspectRatio: "4 / 3", background: "var(--color-neutral-300)", padding: 0, outline: `3px solid ${picked ? "var(--color-accent)" : "transparent"}`, outlineOffset: -3, display: "flex", alignItems: "flex-end", overflow: "hidden" }}
                >
                  {m.url && m.type === "photo" ? <img src={m.url} alt="" loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "grayscale(1) contrast(1.08)" }} /> : null}
                  {m.url && m.type === "video" ? <video src={m.url} muted playsInline preload="metadata" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "grayscale(1) contrast(1.08)" }} /> : null}
                  {m.type === "video" ? <span style={{ position: "absolute", top: 6, left: 6, background: "var(--color-text)", color: "var(--color-bg)", fontSize: 10, padding: "2px 6px", fontWeight: 600 }}>▶ 视频</span> : null}
                  {picked ? <span style={{ position: "absolute", top: 6, right: 6, background: "var(--color-accent)", color: "var(--color-bg)", fontSize: 11, width: 20, height: 20, display: "grid", placeItems: "center", fontWeight: 800 }}>✓</span> : null}
                  {showSaved ? (
                    <span
                      role="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        void removeSaved(m.id)
                      }}
                      style={{ position: "absolute", top: 6, right: picked ? 30 : 6, background: "var(--color-bg)", color: "var(--color-text)", fontSize: 11, padding: "2px 6px", fontWeight: 600 }}
                    >
                      移出
                    </span>
                  ) : null}
                  <span className="clamp1" style={{ position: "relative", width: "100%", fontSize: 10, color: "var(--color-bg)", background: "color-mix(in srgb, var(--color-text) 55%, transparent)", padding: "3px 6px", textAlign: "left" }}>
                    {m.chef}
                    {m.phase ? ` · ${m.phase === "setup" ? "开始" : "结束"}` : ""}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
      <div style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>师傅端传的派对照片自动进来；点一下选中，双击放大。选材夹是给营销挑图用的，链接 1 小时有效，下载原片时重新打开。</div>
    </>
  )
}
