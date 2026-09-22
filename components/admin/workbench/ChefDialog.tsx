"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { adminJson, AdminApiError } from "./api"
import { Chip, Dialog, DialogHead, Field, Kicker, PhoneIcon, Tag } from "./ui"
import { askConfirm, askPrompt } from "./ask"
import { addDays, dowZh, md, money, prettyPhone, ptToday, stamp } from "./helpers"
import { FILE_KIND_LABELS, FILE_STATUS_LABELS, mondayOf, type ChefDetail, type ChefFile, type ShiftRow } from "./chef-types"
import type { ChefTabKey } from "./ChefsTab"
import { BILLING_LABELS, chefPayCents, docState, rateLabel, taxMissing } from "@/lib/chef-pay"
import type { WorkbenchSettings } from "@/lib/workbench-settings-shared"

// 厨师弹窗 · 场次 / 资料·工价 / 评价·准时 / 证件·报税 / 结算 / 文件.
// Reads /api/admin/chefs?id=, writes through its POST actions. 净额 = 工钱 +
// 报销 − 代收；正数我们欠他，负数他欠我们。

const TABS: Array<[ChefTabKey, string]> = [
  ["shifts", "场次"],
  ["profile", "资料 · 工价"],
  ["perf", "评价 · 准时"],
  ["docs", "证件 · 报税"],
  ["settle", "结算"],
  ["files", "文件"],
]

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "")
    r.onerror = () => reject(new Error("read failed"))
    r.readAsDataURL(file)
  })
}

export function ChefDialog({
  adminKey,
  chefId,
  initialTab,
  settings,
  viewerRole,
  sensitive,
  onClose,
  onChanged,
  onOpenOrder,
  onCall,
}: {
  adminKey: string
  chefId: string
  initialTab?: ChefTabKey | null
  settings: WorkbenchSettings
  viewerRole: "owner" | "agent" | null
  sensitive: boolean
  onClose: () => void
  onChanged: () => Promise<void> | void
  onOpenOrder: (id: string) => void
  onCall: (phone: string) => void
}) {
  const owner = viewerRole === "owner"
  const hiddenTab = (k: ChefTabKey) => !sensitive && (k === "docs" || k === "settle")
  const [tab, setTab] = useState<ChefTabKey>(initialTab && !hiddenTab(initialTab) ? initialTab : "shifts")
  const [d, setD] = useState<ChefDetail | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const today = ptToday()
  const thisMonday = mondayOf(today)
  const [week, setWeek] = useState(thisMonday)
  const [settleView, setSettleView] = useState<"week" | "month">("week")
  const [fileFilter, setFileFilter] = useState<"all" | ChefFile["kind"]>("all")
  const [profile, setProfile] = useState<Record<string, string>>({})
  const [docs, setDocs] = useState<Record<string, string>>({})
  const [skills, setSkills] = useState<string[]>([])
  const [areas, setAreas] = useState<string[]>([])
  const [perfForm, setPerfForm] = useState<{ open: boolean; date: string; customer: string; review: "good" | "bad" | ""; late: string; comment: string; orderId: string }>({ open: false, date: today, customer: "", review: "", late: "0", comment: "", orderId: "" })
  const [uploadKind, setUploadKind] = useState<ChefFile["kind"]>(sensitive ? "receipt" : "photo")
  const [uploadAmount, setUploadAmount] = useState("")
  const [uploadTitle, setUploadTitle] = useState("")
  const fileRef = useRef<HTMLInputElement | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await adminJson<ChefDetail & { ok: boolean }>(adminKey, `/api/admin/chefs?id=${encodeURIComponent(chefId)}`)
      setD(r)
      const c = r.chef
      setProfile({ display_name: c.display_name ?? c.full_name ?? "", phone: c.phone ?? "", email: c.email ?? "", wechat: c.wechat ?? "", base: String((c.base_pay_cents ?? 0) / 100), head_from: String(c.head_from ?? 0), per_head: String((c.per_head_cents ?? 0) / 100), billing_cycle: c.billing_cycle ?? "weekly", notes: c.notes ?? "", status: c.status })
      setSkills(c.skills ?? [])
      setAreas(c.areas ?? [])
      setDocs({ food_handler_no: c.food_handler_no ?? "", food_handler_exp: c.food_handler_exp ?? "", id_type: c.id_type ?? "", id_last4: c.id_last4 ?? "", id_exp: c.id_exp ?? "", tax_form: c.tax_form ?? "W-9", tax_legal_name: c.tax_legal_name ?? "", tax_id_last4: c.tax_id_last4 ?? "", tax_address: c.tax_address ?? "" })
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "读取失败")
    }
  }, [adminKey, chefId])
  useEffect(() => {
    void load()
  }, [load])

  const post = async (label: string, body: Record<string, unknown>, ok?: string) => {
    setBusy(label)
    setMsg(null)
    try {
      const r = await adminJson<{ ok: boolean; error?: string } & Record<string, unknown>>(adminKey, "/api/admin/chefs", { body })
      if (!r.ok) throw new Error(r.error ?? "失败")
      await Promise.all([load(), onChanged()])
      if (ok) setMsg(ok)
      return r
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "失败")
      return null
    } finally {
      setBusy(null)
    }
  }

  const c = d?.chef
  const name = c ? (c.display_name ?? c.full_name ?? "").trim() || "未命名" : "…"
  const shifts = useMemo(() => (d?.shifts ?? []).filter((s) => s.orderStatus !== "cancelled"), [d])
  const upcoming = shifts.filter((s) => s.date >= today).length
  const monthDone = shifts.filter((s) => s.date < today && s.date.slice(0, 7) === today.slice(0, 7)).length
  const weekEnd = addDays(week, 6)
  const weekShifts = useMemo(() => shifts.filter((s) => s.date >= week && s.date <= weekEnd).sort((a, b) => a.date.localeCompare(b.date) || (a.eventStart ?? "").localeCompare(b.eventStart ?? "")), [shifts, week, weekEnd])
  const weekTitle = week === thisMonday ? "本周" : week === addDays(thisMonday, -7) ? "上周" : week === addDays(thisMonday, 7) ? "下周" : `${md(week)} 那周`

  const done = useMemo(() => shifts.filter((s) => s.date <= today), [shifts, today])
  const openRows = useMemo(() => done.filter((s) => !s.settledAt).sort((a, b) => a.date.localeCompare(b.date)), [done])
  const settledRecent = useMemo(() => done.filter((s) => s.settledAt && Date.now() - Date.parse(s.settledAt) < 60 * 86400000).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12), [done])
  const approvedReimb = (d?.files ?? []).filter((f) => f.kind === "receipt" && f.status === "approved")
  const pendingReceipts = (d?.files ?? []).filter((f) => f.kind === "receipt" && f.status === "pending")
  const payTotal = openRows.reduce((a, s) => a + s.payCents, 0)
  const cashTotal = openRows.reduce((a, s) => a + s.cashCents, 0)
  const reimbTotal = approvedReimb.reduce((a, f) => a + (f.amount_cents ?? 0), 0)
  const net = payTotal + reimbTotal - cashTotal
  const perf = d?.performance ?? []
  const good = perf.filter((p) => p.review === "good").length
  const bad = perf.filter((p) => p.review === "bad").length
  const lateN = perf.filter((p) => p.late_minutes > 0).length
  const income = useMemo(() => {
    const g = new Map<string, { k: string; shifts: number; guests: number; pay: number; cash: number }>()
    for (const s of done) {
      const k = settleView === "week" ? mondayOf(s.date) : s.date.slice(0, 7)
      const row = g.get(k) ?? { k, shifts: 0, guests: 0, pay: 0, cash: 0 }
      row.shifts += 1
      row.guests += s.share
      row.pay += s.payCents
      row.cash += s.cashCents
      g.set(k, row)
    }
    const rows = Array.from(g.values()).sort((a, b) => b.k.localeCompare(a.k)).slice(0, 12)
    const max = Math.max(1, ...rows.map((r) => r.pay))
    return rows.map((r) => ({ ...r, label: settleView === "week" ? `${md(r.k)} – ${md(addDays(r.k, 6))}` : `${r.k.slice(0, 4)} 年 ${Number(r.k.slice(5))} 月`, sub: settleView === "week" ? (r.k === thisMonday ? "本周" : r.k === addDays(thisMonday, -7) ? "上周" : "") : r.k === today.slice(0, 7) ? "本月" : "", w: `${Math.round((100 * r.pay) / max)}%` }))
  }, [done, settleView, thisMonday, today])
  const ytdPay = done.filter((s) => s.date.slice(0, 4) === today.slice(0, 4)).reduce((a, s) => a + s.payCents, 0)
  const dstate = c ? docState(c, today) : null
  const files = (d?.files ?? []).filter((f) => fileFilter === "all" || f.kind === fileFilter)

  const saveProfile = () =>
    post("profile", {
      action: "update_profile",
      id: chefId,
      fields: { display_name: profile.display_name, phone: profile.phone, email: profile.email, wechat: profile.wechat, notes: profile.notes, base_pay_cents: Math.round(Number(profile.base) * 100) || 0, head_from: Number(profile.head_from) || 0, per_head_cents: Math.round(Number(profile.per_head) * 100) || 0, billing_cycle: profile.billing_cycle, status: profile.status, skills, areas },
    }, "已保存")
  const saveDocs = () => post("docs", { action: "update_docs", id: chefId, fields: docs }, "已保存")
  // Not through post(): the dialog has nothing to reload once the chef is gone.
  const deleteChef = async () => {
    if (!(await askConfirm({ title: "删除厨师", message: `删掉「${name}」？派单、文件、评价会一起删除，不可恢复。有结算记录的厨师删不了，只能停用。`, okLabel: "删除", danger: true }))) return
    setBusy("delete")
    setMsg(null)
    try {
      const r = await adminJson<{ ok: boolean; error?: string }>(adminKey, "/api/admin/chefs", { body: { action: "delete_chef", id: chefId } })
      if (!r.ok) throw new Error(r.error ?? "失败")
      await onChanged()
      onClose()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "失败")
      setBusy(null)
    }
  }
  const addPerf = () =>
    post("perf", { action: "add_perf", id: chefId, event_date: perfForm.date, customer_label: perfForm.customer, review: perfForm.review || null, late_minutes: Number(perfForm.late) || 0, comment: perfForm.comment, order_id: perfForm.orderId || undefined }, "已记录").then(() => setPerfForm({ ...perfForm, open: false, comment: "", late: "0", review: "" }))
  const settleAll = async () => {
    if (openRows.length === 0 && approvedReimb.length === 0) return
    const what = net > 0 ? `付给 ${name} ${money(net)}` : net < 0 ? `向 ${name} 收 ${money(-net)}` : "标记已结清"
    const method = await askPrompt({ title: "结清本期", message: `${what}，结清 ${openRows.length} 场 + ${approvedReimb.length} 张报销。`, placeholder: "付款方式：Zelle / Venmo / 现金 / 转账", defaultValue: "Zelle", okLabel: "结清" })
    if (method === null) return
    await post("settle", { action: "settle", id: chefId, method, note: "" }, "本期已结清")
  }
  const settleOne = (s: ShiftRow) => post(`settle:${s.assignmentId}`, { action: "settle", id: chefId, assignment_ids: [s.assignmentId] }, "这一场已结")
  const unsettle = (s: ShiftRow) => post(`unsettle:${s.assignmentId}`, { action: "unsettle", assignment_id: s.assignmentId }, "已撤销")
  const setCash = async (s: ShiftRow) => {
    const raw = await askPrompt({ title: "现场代收", message: `${s.customer ?? ""} ${md(s.date)}：师傅现场代收了多少尾款（美元）？留空 = 用师傅端上报的数`, defaultValue: s.cashCents ? (s.cashCents / 100).toFixed(2) : "", placeholder: "0.00", inputMode: "decimal", okLabel: "记录" })
    if (raw === null) return
    await post(`cash:${s.assignmentId}`, { action: "set_cash", assignment_id: s.assignmentId, cash_cents: raw.trim() === "" ? null : Math.round(Number(raw) * 100) })
  }
  const upload = async (file: File) => {
    if (file.size > 8 * 1024 * 1024) {
      setMsg("文件太大（8 MB 以内）")
      return
    }
    setBusy("upload")
    try {
      const data = await fileToBase64(file)
      const r = await adminJson<{ ok: boolean; error?: string }>(adminKey, "/api/admin/chefs", {
        body: { action: "upload", id: chefId, kind: uploadKind, title: uploadTitle.trim() || file.name, amount_cents: uploadKind === "receipt" ? Math.round(Number(uploadAmount) * 100) || 0 : undefined, file: { name: file.name, type: file.type, data } },
      })
      if (!r.ok) throw new Error(r.error ?? "上传失败")
      setUploadAmount("")
      setUploadTitle("")
      await Promise.all([load(), onChanged()])
      setMsg("已上传")
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "上传失败")
    } finally {
      setBusy(null)
    }
  }
  const viewFile = async (f: ChefFile) => {
    try {
      const r = await adminJson<{ ok: boolean; url?: string }>(adminKey, `/api/admin/chefs?file=${encodeURIComponent(f.id)}`)
      if (r.url) window.open(r.url, "_blank", "noopener")
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "打不开")
    }
  }
  const sendStatement = async () => {
    if (!c?.phone) {
      setMsg("没有电话")
      return
    }
    const lines = openRows.map((s) => `${md(s.date)} ${s.customer ?? ""} ${s.share}p: pay $${(s.payCents / 100).toFixed(2)}${s.cashCents ? ` - collected $${(s.cashCents / 100).toFixed(2)}` : ""}`)
    const body = `Real Hibachi statement for ${name}:\n${lines.join("\n")}${reimbTotal ? `\nReimbursements: +$${(reimbTotal / 100).toFixed(2)}` : ""}\nNet: ${net >= 0 ? "we owe you" : "you owe us"} $${(Math.abs(net) / 100).toFixed(2)}. Reply if anything looks off.`
    if (!(await askConfirm({ title: "发对账单", message: `发给 ${prettyPhone(c.phone)}？\n\n${body}`, okLabel: "发送" }))) return
    setBusy("statement")
    try {
      await adminJson(adminKey, "/api/admin/sms-thread", { body: { phone: c.phone, body, force: true } })
      setMsg("对账单已发")
    } catch (e) {
      setMsg(e instanceof AdminApiError ? e.message : "发送失败")
    } finally {
      setBusy(null)
    }
  }

  const toggleIn = (list: string[], v: string, set: (l: string[]) => void) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
  const NetSpan = ({ n }: { n: number }) => <span style={{ color: n < 0 ? "var(--color-accent-700)" : undefined }}>{n >= 0 ? "+" : "−"}{money(Math.abs(n))}</span>

  return (
    <Dialog onClose={onClose} width={720}>
      <DialogHead
        title={name}
        tags={
          c ? (
            <span style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>
              {(c.areas ?? []).join(" / ") || "区域未填"} · 接下来 {upcoming} 场 · 本月已办 {monthDone} 场{c.status !== "active" ? " · 已停用" : ""}
            </span>
          ) : null
        }
        lines={c ? [<>{prettyPhone(c.phone)} · 微信 {c.wechat || "—"}</>] : []}
        actions={
          c?.phone ? (
            <button type="button" className="btn btn-primary" onClick={() => onCall(c.phone!)}>
              {PhoneIcon} 打电话
            </button>
          ) : null
        }
        onClose={onClose}
      />
      <div style={{ display: "flex", padding: "0 20px", borderBottom: "2px solid var(--color-divider)", overflowX: "auto" }}>
        {TABS.filter(([k]) => !hiddenTab(k)).map(([k, label]) => (
          <button key={k} type="button" className="wb-tab" aria-current={tab === k ? "page" : undefined} onClick={() => setTab(k)} style={{ marginRight: 20 }}>
            {k === "profile" && !sensitive ? "资料" : label}
            {k === "files" && pendingReceipts.length ? <span className="wb-badge">{pendingReceipts.length}</span> : null}
            {k === "docs" && dstate && dstate.level !== "ok" ? <span className="wb-badge">!</span> : null}
          </button>
        ))}
      </div>
      <div className="dialog-col" style={{ gap: 18 }}>
        {msg ? <div className="notice">{msg}</div> : null}
        {!d ? <div className="empty">读取中…</div> : null}

        {d && tab === "shifts" ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <button type="button" className="btn btn-secondary btn-icon" onClick={() => setWeek(addDays(week, -7))} aria-label="上一周">
                ‹
              </button>
              <button type="button" className="btn btn-secondary btn-icon" onClick={() => setWeek(addDays(week, 7))} aria-label="下一周">
                ›
              </button>
              <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                {weekTitle} <span style={{ fontWeight: 400, color: "var(--color-neutral-600)" }}>{md(week)} – {md(weekEnd)}</span>
              </span>
              {week !== thisMonday ? (
                <button type="button" className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => setWeek(thisMonday)}>
                  回到本周
                </button>
              ) : null}
              <span style={{ marginLeft: "auto", fontSize: 13, whiteSpace: "nowrap" }}>
                <strong>{weekShifts.length}</strong> 场 · {weekShifts.reduce((a, s) => a + s.share, 0)} 人
              </span>
            </div>
            <div style={{ fontSize: 13, borderTop: "2px solid var(--color-divider)" }}>
              {weekShifts.length === 0 ? <div style={{ padding: "16px 0", color: "var(--color-neutral-600)" }}>这周没有派给他的场次。</div> : null}
              {weekShifts.map((s) => (
                <div key={s.assignmentId} className="wb-row" onClick={() => onOpenOrder(s.orderId)} style={{ display: "grid", gridTemplateColumns: "96px 1fr auto auto", gap: 10, padding: "9px 0", borderBottom: "1px solid var(--color-line)", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                      {md(s.date)} {dowZh(s.date)}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--color-neutral-600)" }}>{s.eventStart ? s.eventStart.slice(11, 16) : ""}</div>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="clamp1">
                      <strong>{s.customer ?? "客户"}</strong> <span className="mono" style={{ fontSize: 11, color: "var(--color-neutral-600)" }}>{s.orderNo}</span>
                    </div>
                    <div className="clamp1" style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>
                      {s.address ?? ""}
                    </div>
                    {s.team.length > 1 ? <div style={{ fontSize: 11, color: "var(--color-accent-700)" }}>与 {s.team.filter((t) => t.id !== chefId).map((t) => t.name).join("、")} 同场 · 人头平分</div> : null}
                  </div>
                  <span style={{ whiteSpace: "nowrap", color: "var(--color-neutral-700)" }}>{s.team.length > 1 ? `${s.share} / ${s.guests} 人` : `${s.guests} 人`}</span>
                  <Tag cls={s.date < today ? "tag-neutral" : "tag-ink"}>{s.date < today ? "已办" : "已派"}</Tag>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>点一场进订单。改派、加人在订单弹窗的"Planner · 派单"里操作。</div>
          </>
        ) : null}

        {d && c && tab === "profile" ? (
          <>
            <div>
              <Kicker>联系方式</Kicker>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <Field label="名字">
                  <input className="input" value={profile.display_name ?? ""} disabled={!owner} onChange={(e) => setProfile({ ...profile, display_name: e.target.value })} />
                </Field>
                <Field label="电话">
                  <input className="input" value={profile.phone ?? ""} disabled={!owner} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
                </Field>
                <Field label="微信">
                  <input className="input" value={profile.wechat ?? ""} disabled={!owner} onChange={(e) => setProfile({ ...profile, wechat: e.target.value })} />
                </Field>
                <Field label="邮箱">
                  <input className="input" value={profile.email ?? ""} disabled={!owner} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
                </Field>
              </div>
            </div>
{sensitive ? (
            <div>
              <Kicker>工价配置</Kicker>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <Field label="每场底价 $">
                  <input className="input" type="number" value={profile.base ?? ""} disabled={!owner} onChange={(e) => setProfile({ ...profile, base: e.target.value })} />
                </Field>
                <Field label="超过多少人开始加">
                  <input className="input" type="number" value={profile.head_from ?? ""} disabled={!owner} onChange={(e) => setProfile({ ...profile, head_from: e.target.value })} />
                </Field>
                <Field label="每加一人 $">
                  <input className="input" type="number" value={profile.per_head ?? ""} disabled={!owner} onChange={(e) => setProfile({ ...profile, per_head: e.target.value })} />
                </Field>
              </div>
              <div style={{ fontSize: 12, color: "var(--color-neutral-600)", marginTop: 6 }}>
                现在：{rateLabel({ base_pay_cents: Math.round(Number(profile.base) * 100) || 0, head_from: Number(profile.head_from) || 0, per_head_cents: Math.round(Number(profile.per_head) * 100) || 0 })} · 20 人一场 = {money(chefPayCents({ base_pay_cents: Math.round(Number(profile.base) * 100) || 0, head_from: Number(profile.head_from) || 0, per_head_cents: Math.round(Number(profile.per_head) * 100) || 0 }, 20))}
              </div>
            </div>
) : null}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
{sensitive ? (
              <Field label="结算周期">
                <select className="input" value={profile.billing_cycle ?? "weekly"} disabled={!owner} onChange={(e) => setProfile({ ...profile, billing_cycle: e.target.value })}>
                  {Object.entries(BILLING_LABELS).map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
) : null}
              <Field label="状态">
                <select className="input" value={profile.status ?? "active"} disabled={!owner} onChange={(e) => setProfile({ ...profile, status: e.target.value })}>
                  <option value="active">在职</option>
                  <option value="inactive">停用</option>
                </select>
              </Field>
            </div>
            <div>
              <Kicker>区域</Kicker>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {Array.from(new Set([...settings.chefs.area_options, ...areas])).map((a) => (
                  <Chip key={a} small active={areas.includes(a)} disabled={!owner} onClick={() => toggleIn(areas, a, setAreas)}>
                    {a}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <Kicker>能力</Kicker>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {Array.from(new Set([...settings.chefs.skill_options, ...skills])).map((a) => (
                  <Chip key={a} small active={skills.includes(a)} disabled={!owner} onClick={() => toggleIn(skills, a, setSkills)}>
                    {a}
                  </Chip>
                ))}
                {owner ? (
                  <Chip
                    small
                    onClick={() => {
                      void askPrompt({ title: "加一项能力", placeholder: "如：法语、烧烤" }).then((v) => {
                        if (v?.trim()) setSkills([...skills, v.trim()])
                      })
                    }}
                  >
                    + 添加
                  </Chip>
                ) : null}
              </div>
            </div>
            <Field label="备注">
              <textarea className="input" rows={2} value={profile.notes ?? ""} disabled={!owner} onChange={(e) => setProfile({ ...profile, notes: e.target.value })} />
            </Field>
            {owner ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button type="button" className="btn btn-secondary" disabled={!!busy} onClick={() => void saveProfile()}>
                  {busy === "profile" ? "保存中…" : "保存修改"}
                </button>
                <button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: "auto", color: "var(--color-accent-700)" }} disabled={!!busy} onClick={() => void deleteChef()}>
                  {busy === "delete" ? "删除中…" : "删除厨师"}
                </button>
              </div>
            ) : null}
          </>
        ) : null}

        {d && tab === "perf" ? (
          <>
            <div className="wb-grid" style={{ gridTemplateColumns: "repeat(4, minmax(0,1fr))" }}>
              <div className="wb-cell">
                <div className="kicker">好评</div>
                <div className="big">{good}</div>
                <div style={{ fontSize: 11, color: "var(--color-neutral-600)" }}>好评率 {perf.length ? `${Math.round((100 * good) / perf.length)}%` : "–"}</div>
              </div>
              <div className="wb-cell">
                <div className="kicker">差评</div>
                <div className="big" style={{ color: bad ? "var(--color-accent-700)" : undefined }}>
                  {bad}
                </div>
              </div>
              <div className="wb-cell">
                <div className="kicker">迟到</div>
                <div className="big" style={{ color: lateN ? "var(--color-accent-700)" : undefined }}>
                  {lateN}
                </div>
                <div style={{ fontSize: 11, color: "var(--color-neutral-600)" }}>迟到率 {perf.length ? `${Math.round((100 * lateN) / perf.length)}%` : "–"}</div>
              </div>
              <div className="wb-cell">
                <div className="kicker">统计场次</div>
                <div className="big">{perf.length}</div>
              </div>
            </div>
            <div>
              <Kicker>逐场记录</Kicker>
              <div style={{ fontSize: 13, borderTop: "2px solid var(--color-divider)" }}>
                {perf.length === 0 ? <div style={{ padding: "12px 0", color: "var(--color-neutral-600)" }}>还没有记录。</div> : null}
                {perf.map((r) => (
                  <div key={r.id} style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--color-line)", alignItems: "start" }}>
                    <div style={{ minWidth: 0 }}>
                      <div className="clamp1">{r.customer_label ?? "—"}</div>
                      <div style={{ fontSize: 11, color: "var(--color-neutral-600)" }}>
                        {md(r.event_date)} {dowZh(r.event_date)} · {r.source === "manual" ? "手动" : r.source}
                      </div>
                      {r.comment ? <div style={{ fontSize: 12, color: "var(--color-neutral-700)", marginTop: 4 }}>“{r.comment}”</div> : null}
                    </div>
                    <Tag cls={r.review === "good" ? "tag-neutral" : r.review === "bad" ? "tag-accent" : "tag-outline"}>{r.review === "good" ? "好评" : r.review === "bad" ? "差评" : "未评"}</Tag>
                    <span style={{ whiteSpace: "nowrap", fontSize: 12, color: r.late_minutes > 0 ? "var(--color-accent-700)" : "var(--color-neutral-600)" }}>{r.late_minutes > 0 ? `迟到 ${r.late_minutes} 分` : "准时"}</span>
                    {owner ? (
                      <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => void askConfirm({ title: "删掉这条记录", message: "这条评价记录会被删除。", okLabel: "删除", danger: true }).then((ok) => { if (ok) void post(`delperf:${r.id}`, { action: "delete_perf", perfId: r.id }) })}>
                        删
                      </button>
                    ) : (
                      <span />
                    )}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 12, color: "var(--color-neutral-600)", marginTop: 8 }}>好评 / 差评来自派对后的客人反馈，迟到按到场时间与开席时间之差；都可手动登记。</div>
              {!perfForm.open ? (
                <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  <button type="button" className="btn btn-secondary btn-left" onClick={() => setPerfForm({ ...perfForm, open: true, review: "", late: "15" })}>
                    手动登记一次迟到
                  </button>
                  <button type="button" className="btn btn-secondary btn-left" onClick={() => setPerfForm({ ...perfForm, open: true, review: "good", late: "0" })}>
                    补录评价
                  </button>
                </div>
              ) : (
                <div className="notice" style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <Field label="日期">
                      <input className="input" type="date" value={perfForm.date} onChange={(e) => setPerfForm({ ...perfForm, date: e.target.value })} />
                    </Field>
                    <Field label="哪一场">
                      <select className="input" value={perfForm.orderId} onChange={(e) => {
                        const s = shifts.find((x) => x.orderId === e.target.value)
                        setPerfForm({ ...perfForm, orderId: e.target.value, customer: s ? `${s.customer ?? ""} · ${(s.address ?? "").split(",").slice(-3, -2)[0]?.trim() ?? ""}` : perfForm.customer, date: s ? s.date : perfForm.date })
                      }}>
                        <option value="">手填</option>
                        {done.slice(0, 30).map((s) => (
                          <option key={s.assignmentId} value={s.orderId}>
                            {md(s.date)} {s.customer}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="客人 / 场次">
                      <input className="input" value={perfForm.customer} onChange={(e) => setPerfForm({ ...perfForm, customer: e.target.value })} />
                    </Field>
                    <Field label="迟到分钟（0 = 准时）">
                      <input className="input" type="number" min={0} value={perfForm.late} onChange={(e) => setPerfForm({ ...perfForm, late: e.target.value })} />
                    </Field>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {(["good", "bad", ""] as const).map((v) => (
                      <Chip key={v || "none"} small active={perfForm.review === v} onClick={() => setPerfForm({ ...perfForm, review: v })}>
                        {v === "good" ? "好评" : v === "bad" ? "差评" : "无评价"}
                      </Chip>
                    ))}
                  </div>
                  <input className="input" placeholder="客人原话（可选）" value={perfForm.comment} onChange={(e) => setPerfForm({ ...perfForm, comment: e.target.value })} />
                  <div style={{ display: "flex", gap: 6 }}>
                    <button type="button" className="btn btn-primary btn-sm" disabled={!!busy || !perfForm.date} onClick={() => void addPerf()}>
                      记录
                    </button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPerfForm({ ...perfForm, open: false })}>
                      取消
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : null}

        {d && c && tab === "docs" ? (
          <>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <Kicker style={{ margin: 0 }}>资质 · 证件</Kicker>
                <span style={{ fontSize: 12, fontWeight: 600, color: dstate?.level === "ok" ? "var(--color-neutral-600)" : "var(--color-accent-700)" }}>{docState(docs, today).label}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <Field label="Food Handler 卡号">
                  <input className="input" value={docs.food_handler_no ?? ""} disabled={!owner} placeholder="未登记" onChange={(e) => setDocs({ ...docs, food_handler_no: e.target.value })} />
                </Field>
                <Field label="到期日">
                  <input className="input" type="date" value={docs.food_handler_exp ?? ""} disabled={!owner} onChange={(e) => setDocs({ ...docs, food_handler_exp: e.target.value })} />
                </Field>
                <Field label="证件类型">
                  <input className="input" value={docs.id_type ?? ""} disabled={!owner} placeholder="驾照 / 护照" onChange={(e) => setDocs({ ...docs, id_type: e.target.value })} />
                </Field>
                <Field label="证件号后四位 · 到期">
                  <div style={{ display: "flex", gap: 6 }}>
                    <input className="input" value={docs.id_last4 ?? ""} disabled={!owner} maxLength={4} placeholder="后四位" onChange={(e) => setDocs({ ...docs, id_last4: e.target.value })} />
                    <input className="input" type="date" value={docs.id_exp ?? ""} disabled={!owner} onChange={(e) => setDocs({ ...docs, id_exp: e.target.value })} />
                  </div>
                </Field>
              </div>
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <Kicker style={{ margin: 0 }}>报税 · 1099</Kicker>
                <span style={{ fontSize: 12, fontWeight: 600, color: taxMissing(docs) ? "var(--color-accent-700)" : "var(--color-neutral-600)" }}>{taxMissing(docs) ? "W-9 信息未填全" : "W-9 信息齐全"}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <Field label="税表">
                  <input className="input" value={docs.tax_form ?? ""} disabled={!owner} onChange={(e) => setDocs({ ...docs, tax_form: e.target.value })} />
                </Field>
                <Field label="法定姓名">
                  <input className="input" value={docs.tax_legal_name ?? ""} disabled={!owner} onChange={(e) => setDocs({ ...docs, tax_legal_name: e.target.value })} />
                </Field>
                <Field label="SSN / EIN 后四位（只存后四位）">
                  <input className="input" value={docs.tax_id_last4 ?? ""} disabled={!owner} maxLength={4} placeholder="未填" onChange={(e) => setDocs({ ...docs, tax_id_last4: e.target.value })} />
                </Field>
                <Field label="报税地址" style={{ gridColumn: "1 / -1" }}>
                  <input className="input" value={docs.tax_address ?? ""} disabled={!owner} placeholder="未填" onChange={(e) => setDocs({ ...docs, tax_address: e.target.value })} />
                </Field>
              </div>
            </div>
            <div style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>证件照片、Food Handler 卡、W-9 原件在"文件"页上传（私有桶，只有后台能打开）。年底 1099 用"结算"页的累计工钱 + 报销。</div>
            {owner ? (
              <button type="button" className="btn btn-secondary" style={{ alignSelf: "flex-start" }} disabled={!!busy} onClick={() => void saveDocs()}>
                {busy === "docs" ? "保存中…" : "保存修改"}
              </button>
            ) : null}
          </>
        ) : null}

        {d && c && tab === "settle" ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <Kicker style={{ margin: 0 }}>本期结算 · {BILLING_LABELS[c.billing_cycle] ?? c.billing_cycle}</Kicker>
              <span style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>
                上次结清 {c.last_settled_at ? md(c.last_settled_at) : "—"} · 未结 {openRows.length} 场
              </span>
            </div>
            <div style={{ fontSize: 13, borderTop: "2px solid var(--color-divider)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto auto", gap: 10, padding: "6px 0", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-neutral-600)", borderBottom: "1px solid var(--color-line)" }}>
                <span>场次</span>
                <span style={{ textAlign: "right" }}>工钱</span>
                <span style={{ textAlign: "right" }}>代收尾款</span>
                <span style={{ textAlign: "right" }}>净额</span>
                <span />
              </div>
              {openRows.length === 0 ? <div style={{ padding: "10px 0", color: "var(--color-neutral-600)" }}>没有未结的场次。</div> : null}
              {[...openRows, ...settledRecent].map((s) => {
                const rowNet = s.payCents - s.cashCents
                return (
                  <div key={s.assignmentId} style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto auto", gap: 10, padding: "7px 0", borderBottom: "1px solid var(--color-line)", alignItems: "center", opacity: s.settledAt ? 0.45 : 1 }}>
                    <div style={{ minWidth: 0 }}>
                      <div className="clamp1">{s.customer ?? "客户"}</div>
                      <div style={{ fontSize: 11, color: "var(--color-neutral-600)" }}>
                        {md(s.date)} {dowZh(s.date)} · {s.team.length > 1 ? `${s.share} / ${s.guests} 人 · 与 ${s.team.filter((t) => t.id !== chefId).map((t) => t.name).join("、")} 平分` : `${s.share} 人`}
                        {s.settledAt ? ` · 已结 ${stamp(s.settledAt).split(",")[0]}` : ""}
                      </div>
                    </div>
                    <span style={{ textAlign: "right", whiteSpace: "nowrap" }}>{money(s.payCents)}</span>
                    <button type="button" className="btn btn-ghost btn-sm" style={{ justifyContent: "flex-end", padding: "2px 4px", color: "var(--color-neutral-700)" }} disabled={!owner || !!busy || !!s.settledAt} onClick={() => void setCash(s)} title={s.cashSource === "chef_sheet" ? "师傅端上报" : s.cashSource === "manual" ? "手动登记" : "没有代收 · 点击登记"}>
                      {s.cashCents ? money(s.cashCents) : "—"}
                      {s.cashSource === "chef_sheet" ? " ·师傅报" : ""}
                    </button>
                    <span style={{ textAlign: "right", whiteSpace: "nowrap", fontWeight: 600 }}>
                      <NetSpan n={rowNet} />
                    </span>
                    {owner ? (
                      <button type="button" className="btn btn-ghost btn-sm" style={{ padding: "2px 6px" }} disabled={!!busy} onClick={() => void (s.settledAt ? unsettle(s) : settleOne(s))}>
                        {s.settledAt ? "撤销" : "结这一场"}
                      </button>
                    ) : (
                      <span />
                    )}
                  </div>
                )
              })}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid var(--color-line)", color: "var(--color-neutral-700)" }}>
                <span>+ 已批报销（{approvedReimb.length} 张）</span>
                <span>{money(reimbTotal)}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "10px 0 4px" }}>
                <span style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>
                  工钱 {money(payTotal)} + 报销 {money(reimbTotal)} − 代收 {money(cashTotal)}
                </span>
                <strong className="num" style={{ fontSize: 20, whiteSpace: "nowrap", color: net < 0 ? "var(--color-accent-700)" : undefined }}>
                  {net > 0 ? `欠他 ${money(net)}` : net < 0 ? `他欠 ${money(-net)}` : "已结清"}
                </strong>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {owner ? (
                <button type="button" className="btn btn-primary btn-left" disabled={!!busy || (openRows.length === 0 && approvedReimb.length === 0)} onClick={() => void settleAll()}>
                  {busy === "settle" ? "结算中…" : net > 0 ? `付给厨师 ${money(net)} 并结清` : net < 0 ? `收到 ${money(-net)} 并结清` : "标记本期已结清"}
                </button>
              ) : null}
              <button type="button" className="btn btn-secondary btn-left" disabled={!!busy || openRows.length === 0} onClick={() => void sendStatement()}>
                发对账单给厨师
              </button>
            </div>
            <div style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>
              净额 = 工钱 + 报销 − 代收；正数我们欠他，<span style={{ color: "var(--color-accent-700)" }}>负数他欠我们</span>。可逐场结，也可一键结清；结过的工钱冻结，之后改工价不影响历史。
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 8, borderTop: "2px solid var(--color-divider)", paddingTop: 12 }}>
              <Kicker style={{ margin: 0 }}>
                收入 · 已办 {done.length} 场 · 今年工钱 {money(ytdPay)}
              </Kicker>
              <div style={{ display: "flex" }}>
                <Chip small active={settleView === "week"} onClick={() => setSettleView("week")}>
                  按周
                </Chip>
                <Chip small active={settleView === "month"} onClick={() => setSettleView("month")} style={{ marginLeft: -1 }}>
                  按月
                </Chip>
              </div>
            </div>
            <div style={{ fontSize: 13, borderTop: "2px solid var(--color-divider)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "120px 1fr auto auto auto", gap: 10, padding: "6px 0", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-neutral-600)", borderBottom: "1px solid var(--color-line)" }}>
                <span>期间</span>
                <span>场次 · 人数</span>
                <span style={{ textAlign: "right" }}>工钱</span>
                <span style={{ textAlign: "right" }}>代收</span>
                <span style={{ textAlign: "right" }}>净额</span>
              </div>
              {income.map((p) => (
                <div key={p.k} style={{ display: "grid", gridTemplateColumns: "120px 1fr auto auto auto", gap: 10, padding: "7px 0", borderBottom: "1px solid var(--color-line)", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{p.label}</div>
                    <div style={{ fontSize: 11, color: "var(--color-neutral-600)" }}>{p.sub}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <div style={{ height: 10, background: "var(--color-neutral-300)", width: p.w, flex: "none", maxWidth: "60%" }} />
                    <span style={{ fontSize: 12, color: "var(--color-neutral-700)", whiteSpace: "nowrap" }}>
                      {p.shifts} 场 · {p.guests} 人
                    </span>
                  </div>
                  <span style={{ textAlign: "right", whiteSpace: "nowrap", fontWeight: 600 }}>{money(p.pay)}</span>
                  <span style={{ textAlign: "right", whiteSpace: "nowrap", color: "var(--color-neutral-700)" }}>{p.cash ? money(p.cash) : "—"}</span>
                  <span style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <NetSpan n={p.pay - p.cash} />
                  </span>
                </div>
              ))}
            </div>
            {(d.settlements ?? []).length ? (
              <details>
                <summary>结算记录（{d.settlements.length}）</summary>
                <div style={{ fontSize: 12.5, marginTop: 6 }}>
                  {d.settlements.map((s) => (
                    <div key={s.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "5px 0", borderBottom: "1px solid var(--color-line)" }}>
                      <span>
                        {stamp(s.created_at)} · {s.shifts} 场{s.period_start ? ` · ${md(s.period_start)}–${s.period_end ? md(s.period_end) : ""}` : ""} · {s.method ?? "—"}
                      </span>
                      <span style={{ whiteSpace: "nowrap" }}>
                        <NetSpan n={s.net_cents} />
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            ) : null}
          </>
        ) : null}

        {d && tab === "files" ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Kicker style={{ margin: 0 }}>上传的文件</Kicker>
              <div style={{ display: "flex" }}>
                {(["all", "receipt", "photo", "video", "food_card", "id_doc", "w9"] as const).filter((k) => sensitive || k === "all" || k === "photo" || k === "video").map((k) => (
                  <Chip key={k} small active={fileFilter === k} onClick={() => setFileFilter(k)} style={{ marginLeft: -1 }}>
                    {k === "all" ? "全部" : FILE_KIND_LABELS[k]}
                  </Chip>
                ))}
              </div>
            </div>
            {files.length === 0 ? <div style={{ fontSize: 13, color: "var(--color-neutral-600)" }}>还没有上传。厨师在师傅端上传后会出现在这里，也可以在下面代传。</div> : null}
            <div style={{ display: "flex", flexDirection: "column", borderTop: "2px solid var(--color-divider)" }}>
              {files.map((f) => (
                <div key={f.id} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 10, alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--color-line)", fontSize: 13 }}>
                  <Tag cls="tag-neutral">{FILE_KIND_LABELS[f.kind]}</Tag>
                  <div style={{ minWidth: 0 }}>
                    <div className="clamp1">{f.title ?? "（无标题）"}</div>
                    <div style={{ fontSize: 11, color: "var(--color-neutral-600)" }}>
                      {stamp(f.created_at)} <span style={{ color: f.status === "pending" ? "var(--color-accent-700)" : "var(--color-neutral-600)" }}>{FILE_STATUS_LABELS[f.status]}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                    {f.amount_cents != null ? <strong>{money(f.amount_cents)}</strong> : null}
                    {owner && f.status === "pending" ? (
                      <>
                        <button type="button" className="btn btn-secondary btn-sm" disabled={!!busy} onClick={() => void post(`ok:${f.id}`, { action: "approve_receipt", file_id: f.id }, "已批准，下次结算一起付")}>
                          批准报销
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => void post(`no:${f.id}`, { action: "reject_receipt", file_id: f.id })}>
                          拒
                        </button>
                      </>
                    ) : null}
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => void viewFile(f)}>
                      查看
                    </button>
                    {owner && f.status !== "paid" ? (
                      <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => void askConfirm({ title: "删掉这个文件", message: `「${f.title || FILE_KIND_LABELS[f.kind] || "文件"}」会从素材库和存储里删除。`, okLabel: "删除", danger: true }).then((ok) => { if (ok) void post(`del:${f.id}`, { action: "delete_file", file_id: f.id }) })}>
                        删
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
{sensitive ? (
            <div style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>
              待报销合计 <strong style={{ color: "var(--color-accent-700)" }}>{money(pendingReceipts.reduce((a, f) => a + (f.amount_cents ?? 0), 0))}</strong>（{pendingReceipts.length} 张）· 已批未结 {money(reimbTotal)}
            </div>
) : null}
            <div className="notice" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="kicker">代传一个文件（8 MB 以内）</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <select className="input" value={uploadKind} onChange={(e) => setUploadKind(e.target.value as ChefFile["kind"])}>
                  {(Object.keys(FILE_KIND_LABELS) as ChefFile["kind"][]).filter((k) => sensitive || k === "photo" || k === "video" || k === "other").map((k) => (
                    <option key={k} value={k}>
                      {FILE_KIND_LABELS[k]}
                    </option>
                  ))}
                </select>
                <input className="input" placeholder="标题（如 Costco 食材 9/19）" value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} />
                {uploadKind === "receipt" ? <input className="input" type="number" step="0.01" placeholder="金额 $" value={uploadAmount} onChange={(e) => setUploadAmount(e.target.value)} /> : <span />}
              </div>
              <input ref={fileRef} type="file" accept="image/*,video/*,application/pdf" style={{ fontSize: 13 }} disabled={!!busy} onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0]).then(() => { if (fileRef.current) fileRef.current.value = "" })} />
              {busy === "upload" ? <span style={{ fontSize: 12 }}>上传中…</span> : null}
            </div>
          </>
        ) : null}
      </div>
    </Dialog>
  )
}
