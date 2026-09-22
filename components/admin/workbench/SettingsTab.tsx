"use client"

import { useEffect, useState } from "react"
import { adminJson } from "./api"
import { Field, Kicker } from "./ui"
import { stamp } from "./helpers"
import { MembersSection } from "./MembersSection"
import { PasskeySection } from "./PasskeySection"
import type { PublicActor } from "@/lib/workbench-perms"
import { DEFAULT_SETTINGS, QUICK_REPLY_PLACEHOLDERS, type QuickReply, type SettingsSection, type WorkbenchSettings } from "@/lib/workbench-settings-shared"

// 基础设置. Each section is its own little form with its own 保存; the API
// validates and returns the merged settings, which the shell hands to every
// tab (targets colour the board, brakes gate the SMS route, quick replies
// feed the dialogs). Numbers in code (prices, home base, blackouts) are shown
// read-only at the bottom so the owner sees everything in one place.

type Meta = Record<string, { updated_at: string; updated_by: string | null }>

function Section({
  title,
  hint,
  section,
  meta,
  canEdit,
  dirty,
  busy,
  onSave,
  onReset,
  children,
}: {
  title: string
  hint?: string
  section: SettingsSection
  meta: Meta
  canEdit: boolean
  dirty: boolean
  busy: boolean
  onSave: () => void
  onReset: () => void
  children: React.ReactNode
}) {
  const m = meta[section]
  return (
    <section style={{ borderTop: "2px solid var(--color-divider)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h4>{title}</h4>
          {hint ? <div style={{ fontSize: 12, color: "var(--color-neutral-600)", marginTop: 2 }}>{hint}</div> : null}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "var(--color-neutral-600)" }}>{m ? `${stamp(m.updated_at)} · ${m.updated_by ?? "?"} 改过` : "代码默认值"}</span>
          {canEdit ? (
            <>
              {m ? (
                <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={onReset}>
                  恢复默认
                </button>
              ) : null}
              <button type="button" className={`btn btn-sm ${dirty ? "btn-primary" : "btn-secondary"}`} disabled={busy || !dirty} onClick={onSave}>
                {busy ? "保存中…" : "保存"}
              </button>
            </>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  )
}

const cents = (v: number) => (v / 100).toFixed(0)
const toCents = (s: string) => Math.round((Number(s) || 0) * 100)

export function SettingsTab({
  adminKey,
  settings,
  meta,
  code,
  viewerRole,
  viewer,
  onSaved,
  onLogout,
}: {
  adminKey: string
  settings: WorkbenchSettings
  meta: Meta
  code: Record<string, unknown> | null
  viewerRole: "owner" | "agent" | null
  viewer: PublicActor | null
  onSaved: (s: WorkbenchSettings, meta: Meta) => void
  onLogout: () => void
}) {
  const canEdit = viewerRole === "owner"
  // Inside the Android shell the notification settings are native; the shell intercepts rhapp:// links.
  const inApp = typeof navigator !== "undefined" && /RealHibachiWorkbenchAndroid/.test(navigator.userAgent)
  const [draft, setDraft] = useState<WorkbenchSettings>(settings)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [operator, setOperator] = useState("")
  const [watchResult, setWatchResult] = useState<string | null>(null)

  useEffect(() => {
    setDraft(settings)
  }, [settings])
  useEffect(() => {
    try {
      setOperator(localStorage.getItem("rh_operator_name") ?? "")
    } catch {}
  }, [])

  const dirty = (s: SettingsSection) => JSON.stringify(draft[s]) !== JSON.stringify(settings[s])
  const save = async (section: SettingsSection, reset = false) => {
    setBusy(section)
    setMsg(null)
    try {
      const d = await adminJson<{ ok: boolean; settings: WorkbenchSettings; meta: Meta; error?: string }>(adminKey, "/api/admin/settings", { method: "PUT", body: reset ? { section, reset: true } : { section, value: draft[section] } })
      if (!d.ok) throw new Error(d.error ?? "保存失败")
      onSaved(d.settings, d.meta)
      setMsg(`${reset ? "已恢复默认" : "已保存"} · ${section}`)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "保存失败")
    } finally {
      setBusy(null)
    }
  }
  const set = <K extends SettingsSection>(section: K, patch: Partial<WorkbenchSettings[K]>) => setDraft((d) => ({ ...d, [section]: { ...(d[section] as object), ...patch } }))
  const setQr = (list: QuickReply[]) => setDraft((d) => ({ ...d, quick_replies: list }))

  const tryWatch = async () => {
    setBusy("watch")
    try {
      const d = await adminJson<{ ok: boolean; disabled?: boolean; autoSent?: unknown[]; needsHuman?: unknown[]; stillOpen?: number }>(adminKey, "/api/admin/lead-watch?dry=1", { method: "POST", body: {} })
      setWatchResult(d.disabled ? "巡检已关闭（enabled=false）" : `试跑：会自动首响 ${d.autoSent?.length ?? 0} 条 · 需要人 ${d.needsHuman?.length ?? 0} 条 · 仍待处理 ${d.stillOpen ?? 0}`)
    } catch (e) {
      setWatchResult(e instanceof Error ? e.message : "试跑失败")
    } finally {
      setBusy(null)
    }
  }

  const numField = (label: string, value: number, onChange: (n: number) => void, opts?: { step?: number; suffix?: string; min?: number }) => (
    <Field label={label}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input className="input" type="number" step={opts?.step ?? 1} min={opts?.min ?? 0} value={value} disabled={!canEdit} onChange={(e) => onChange(Number(e.target.value))} />
        {opts?.suffix ? <span style={{ fontSize: 12, color: "var(--color-neutral-600)", whiteSpace: "nowrap" }}>{opts.suffix}</span> : null}
      </div>
    </Field>
  )
  const textField = (label: string, value: string, onChange: (s: string) => void, placeholder?: string) => (
    <Field label={label}>
      <input className="input" value={value} disabled={!canEdit} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </Field>
  )
  const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }
  const b = draft.business
  const t = draft.targets
  const s = draft.sms_brakes
  const w = draft.lead_watch
  const c = draft.calendar

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28, maxWidth: 980 }}>
      <div>
        <h2>基础设置</h2>
        <div style={{ fontSize: 13, color: "var(--color-neutral-700)", marginTop: 4 }}>
          这里改的立刻生效：看板的目标线、短信刹车、线索巡检、快捷回复、日历时段。价格、基地 ZIP、黑名单日期在代码里（发票仓库要同步），只读展示在最下面。
          {!canEdit ? " 你是坐席账号，只能看。" : ""}
        </div>
      </div>
      {msg ? <div className="notice">{msg}</div> : null}

      <Section title="业务信息" hint="签名、师傅默认名、对客电话邮箱、工具地址。改这里不改网站。" section="business" meta={meta} canEdit={canEdit} dirty={dirty("business")} busy={busy === "business"} onSave={() => void save("business")} onReset={() => void save("business", true)}>
        <div style={grid}>
          {textField("品牌", b.brand, (v) => set("business", { brand: v }))}
          {textField("我方署名（短信里的 It's …）", b.agent_name, (v) => set("business", { agent_name: v }))}
          {textField("师傅默认名（48h 确认短信）", b.chef_default_name, (v) => set("business", { chef_default_name: v }))}
          {textField("客服电话（对客）", b.support_phone, (v) => set("business", { support_phone: v }))}
          {textField("备用电话", b.backup_phone, (v) => set("business", { backup_phone: v }))}
          {textField("客服邮箱", b.support_email, (v) => set("business", { support_email: v }))}
          {textField("Google 好评链接", b.review_url, (v) => set("business", { review_url: v }), "https://g.page/r/…")}
          {textField("发票工具地址", b.invoice_tool_url, (v) => set("business", { invoice_tool_url: v }))}
          {textField("Planner 地址", b.planner_url, (v) => set("business", { planner_url: v }))}
        </div>
      </Section>

      <Section title="目标与止损" hint="看板用这些画红线。周口径：太平洋时间周日–周六；有效线索 = 人数 ≥ N。" section="targets" meta={meta} canEdit={canEdit} dirty={dirty("targets")} busy={busy === "targets"} onSave={() => void save("targets")} onReset={() => void save("targets", true)}>
        <div style={grid}>
          {numField("CPA 目标 $", Number(cents(t.cpa_target_cents)), (n) => set("targets", { cpa_target_cents: toCents(String(n)) }), { suffix: "超过变红" })}
          {numField("CPA 长期目标 $", Number(cents(t.cpa_goal_cents)), (n) => set("targets", { cpa_goal_cents: toCents(String(n)) }))}
          {numField("首响 SLA", t.first_response_sla_minutes, (n) => set("targets", { first_response_sla_minutes: n }), { suffix: "分钟", min: 1 })}
          {numField("每周花费上限 $", Number(cents(t.weekly_spend_cap_cents)), (n) => set("targets", { weekly_spend_cap_cents: toCents(String(n)) }))}
          {numField("每周押金目标", t.weekly_deposit_target, (n) => set("targets", { weekly_deposit_target: n }), { suffix: "单" })}
          {numField("每单成本停线 $", Number(cents(t.weekly_cost_per_order_stop_cents)), (n) => set("targets", { weekly_cost_per_order_stop_cents: toCents(String(n)) }), { suffix: "任一周超过就停" })}
          {numField("有效线索最少人数", t.lead_min_guests, (n) => set("targets", { lead_min_guests: n }), { suffix: "人", min: 1 })}
        </div>
      </Section>

      <Section title="短信刹车" hint="主动消息的上限。回客人问题不算主动（回复窗口内），'Real Hibachi:' 开头的系统短信不算间隔。点发送时还是会提示，可以硬发。" section="sms_brakes" meta={meta} canEdit={canEdit} dirty={dirty("sms_brakes")} busy={busy === "sms_brakes"} onSave={() => void save("sms_brakes")} onReset={() => void save("sms_brakes", true)}>
        <div style={grid}>
          {numField("对方从没回过：最多发", s.followup_cap, (n) => set("sms_brakes", { followup_cap: n }), { suffix: "条", min: 1 })}
          {numField("24 小时内最多主动", s.daily_cap, (n) => set("sms_brakes", { daily_cap: n }), { suffix: "条", min: 1 })}
          {numField("两条主动消息间隔", s.spacing_hours, (n) => set("sms_brakes", { spacing_hours: n }), { suffix: "小时", step: 0.5 })}
          {numField("回复窗口", s.reply_window_minutes, (n) => set("sms_brakes", { reply_window_minutes: n }), { suffix: "分钟内算回答", min: 1 })}
          {numField("窗口内最多回", s.reply_burst_cap, (n) => set("sms_brakes", { reply_burst_cap: n }), { suffix: "条", min: 1 })}
        </div>
      </Section>

      <Section title="线索巡检（自动首响 + 提醒）" hint="桌面定时任务每 10 分钟调一次；关掉开关它就只报告不动手。" section="lead_watch" meta={meta} canEdit={canEdit} dirty={dirty("lead_watch")} busy={busy === "lead_watch"} onSave={() => void save("lead_watch")} onReset={() => void save("lead_watch", true)}>
        <div style={grid}>
          <label className="check">
            <input type="checkbox" checked={w.enabled} disabled={!canEdit} onChange={(e) => set("lead_watch", { enabled: e.target.checked })} /> 巡检开启
          </label>
          <label className="check">
            <input type="checkbox" checked={w.auto_first_response} disabled={!canEdit} onChange={(e) => set("lead_watch", { auto_first_response: e.target.checked })} /> 允许自动发首响（只对 A 型落地页线索）
          </label>
          {numField("留资后等", w.grace_minutes, (n) => set("lead_watch", { grace_minutes: n }), { suffix: "分钟再动（让第二步先落地）" })}
          {numField("同一条再提醒间隔", w.renotify_minutes, (n) => set("lead_watch", { renotify_minutes: n }), { suffix: "分钟", min: 10 })}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" className="btn btn-secondary btn-sm" disabled={busy === "watch"} onClick={() => void tryWatch()}>
            {busy === "watch" ? "试跑中…" : "现在试跑一次（不发）"}
          </button>
          {watchResult ? <span style={{ fontSize: 12 }}>{watchResult}</span> : null}
        </div>
      </Section>

      <Section title="快捷回复" hint={`线索弹窗里的一排按钮。占位符：${QUICK_REPLY_PLACEHOLDERS.join(" ")}（押金链接会按这条线索现生成并缩短）。价格要跟代码里的一致，见最下面。`} section="quick_replies" meta={meta} canEdit={canEdit} dirty={dirty("quick_replies")} busy={busy === "quick_replies"} onSave={() => void save("quick_replies")} onReset={() => void save("quick_replies", true)}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {draft.quick_replies.map((q, i) => (
            <div key={q.id} style={{ display: "grid", gridTemplateColumns: "160px 1fr auto", gap: 8, alignItems: "start" }}>
              <input className="input" value={q.label} disabled={!canEdit} placeholder="按钮名" onChange={(e) => setQr(draft.quick_replies.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
              <textarea className="input" rows={2} value={q.body} disabled={!canEdit} onChange={(e) => setQr(draft.quick_replies.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))} />
              {canEdit ? (
                <div style={{ display: "flex", gap: 4 }}>
                  <button type="button" className="btn btn-secondary btn-sm" disabled={i === 0} onClick={() => setQr(draft.quick_replies.map((x, j) => (j === i - 1 ? draft.quick_replies[i] : j === i ? draft.quick_replies[i - 1] : x)))} aria-label="上移">
                    ↑
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setQr(draft.quick_replies.filter((_, j) => j !== i))} aria-label="删除">
                    ×
                  </button>
                </div>
              ) : null}
            </div>
          ))}
          {canEdit ? (
            <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setQr([...draft.quick_replies, { id: `qr_${Date.now().toString(36)}`, label: "新按钮", body: "" }])}>
              + 加一条
            </button>
          ) : null}
        </div>
      </Section>

      <Section title="日历" hint="周视图的时间轴范围，以及几点起算晚场。" section="calendar" meta={meta} canEdit={canEdit} dirty={dirty("calendar")} busy={busy === "calendar"} onSave={() => void save("calendar")} onReset={() => void save("calendar", true)}>
        <div style={grid}>
          {numField("时间轴从", c.day_start_hour, (n) => set("calendar", { day_start_hour: n }), { suffix: "点" })}
          {numField("时间轴到", c.day_end_hour, (n) => set("calendar", { day_end_hour: n }), { suffix: "点" })}
          {numField("晚场从", c.evening_from_hour, (n) => set("calendar", { evening_from_hour: n }), { suffix: "点起" })}
        </div>
      </Section>

      <Section title="厨师" hint="新加厨师时的默认工价，以及资料页里可选的能力 / 区域。每位厨师的工价在他自己的资料页改。" section="chefs" meta={meta} canEdit={canEdit} dirty={dirty("chefs")} busy={busy === "chefs"} onSave={() => void save("chefs")} onReset={() => void save("chefs", true)}>
        <div style={grid}>
          {numField("默认每场底价 $", Number(cents(draft.chefs.default_base_pay_cents)), (n) => set("chefs", { default_base_pay_cents: toCents(String(n)) }))}
          {numField("默认超过多少人开始加", draft.chefs.default_head_from, (n) => set("chefs", { default_head_from: n }), { suffix: "人" })}
          {numField("默认每加一人 $", draft.chefs.default_per_head_cents / 100, (n) => set("chefs", { default_per_head_cents: toCents(String(n)) }), { step: 0.5 })}
        </div>
        <div style={grid}>
          <Field label="能力选项（逗号分隔）">
            <input className="input" value={draft.chefs.skill_options.join("，")} disabled={!canEdit} onChange={(e) => set("chefs", { skill_options: e.target.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean) })} />
          </Field>
          <Field label="区域选项（逗号分隔）">
            <input className="input" value={draft.chefs.area_options.join("，")} disabled={!canEdit} onChange={(e) => set("chefs", { area_options: e.target.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean) })} />
          </Field>
        </div>
      </Section>

      <section style={{ borderTop: "2px solid var(--color-divider)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <h4>代码里的配置（只读）</h4>
          <div style={{ fontSize: 12, color: "var(--color-neutral-600)", marginTop: 2 }}>
            改价在 <span className="mono">config/pricing-rules.ts</span>（发票仓库同名文件要同步），基地在 <span className="mono">config/home-base.ts</span>。这里显示的是线上正在用的值。
          </div>
        </div>
        {code ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 4, fontSize: 13 }}>
            {[
              ["定价版本", String(code.pricing_version)],
              ["大人 / 周中", `$${code.adult} / $${code.adult_weekday}`],
              ["小孩 / 周中", `$${code.child} / $${code.child_weekday}`],
              ["起订", `$${code.minimum_spend}`],
              ["押金", `$${code.deposit}`],
              ["卡费", `${Number(code.card_surcharge_rate) * 100}%`],
              ["路费", `${code.travel_free_miles} 英里内免，之后 $${code.travel_rate_per_mile}/英里，从 ${code.home_base_zip} 算`],
              ["桌椅 / 餐具 / 全套", `$${code.tables_chairs_per_guest} / $${code.utensils_per_guest} / $${code.full_setup_per_guest} 每人`],
              ["每位师傅", `${code.guests_per_chef} 人`],
              ["周中特价日", `周${(code.weekday_special_days as number[]).map((d) => "日一二三四五六"[d]).join("")} · 送自选前菜 1 份（最高 $${code.weekday_platter_value}）`],
              ["人数折扣", (code.party_size_tiers as Array<{ minGuests: number; maxGuests: number; amount: number }>).map((x) => `${x.minGuests}–${x.maxGuests} 人 −$${x.amount}`).join(" · ")],
              ["特价黑名单日", (code.blackouts as Array<{ start: string; end: string; label: string }>).map((x) => `${x.start}${x.end !== x.start ? `~${x.end}` : ""} ${x.label}`).join(" · ")],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", gap: 8, padding: "5px 0", borderBottom: "1px solid var(--color-line)" }}>
                <span style={{ color: "var(--color-neutral-600)", whiteSpace: "nowrap" }}>{k}</span>
                <span>{v}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty">读取中…</div>
        )}
      </section>

      <section style={{ borderTop: "2px solid var(--color-divider)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>
        <h4>这台电脑</h4>
        <div style={grid}>
          <Field label="操作人名字（记进订单事件的 operator）">
            <input
              className="input"
              value={operator}
              placeholder="Bling"
              onChange={(e) => {
                setOperator(e.target.value)
                try {
                  localStorage.setItem("rh_operator_name", e.target.value.trim())
                } catch {}
              }}
            />
          </Field>
          <div>
            <Kicker>登录</Kicker>
            <div style={{ fontSize: 13 }}>
              {viewer ? `${viewer.name} · ${viewer.role === "owner" ? "管理员" : "坐席"} · ${viewer.via === "session" ? "手机号登录" : "密钥登录"}` : "—"}{" "}
              <button type="button" className="btn btn-ghost btn-sm" onClick={onLogout}>
                退出登录
              </button>
              {inApp ? (
                <button type="button" className="btn btn-secondary btn-sm" style={{ marginLeft: 6 }} onClick={() => window.location.assign("rhapp://settings")}>
                  App 通知设置
                </button>
              ) : null}
            </div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>
          数据同步在看板右下角：同步 Google 花费（日报任务每天用服务账号同步；按钮是手动补）、归因扫描（把没渠道的押金单按线索/表单证据补上）。
        </div>
      </section>
      <PasskeySection adminKey={adminKey} viewer={viewer} />
      {canEdit ? <MembersSection adminKey={adminKey} selfId={viewer?.memberId ?? null} /> : null}
      <div style={{ fontSize: 11, color: "var(--color-neutral-500)" }}>默认值来自 lib/workbench-settings-shared.ts · 快捷回复默认 {DEFAULT_SETTINGS.quick_replies.length} 条</div>
    </div>
  )
}
