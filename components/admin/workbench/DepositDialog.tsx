"use client"

import { useState } from "react"
import { adminJson } from "./api"
import { Dialog, DialogHead, Field } from "./ui"
import { digits10, displayName, isPlaceholderName, type LeadRow } from "./helpers"
import { DEPOSIT_AMOUNT } from "@/config/pricing-rules"

// 押金已付（线下）→ 转入订单. Posts /api/admin/orders/deposit-confirm, which
// mints the RH- number through the CRM envelope, links the lead and marks it
// won. Stripe deposits never come through here - the webhook does that.

const CHANNELS = [
  ["venmo", "Venmo"],
  ["zelle", "Zelle"],
  ["cash", "现金"],
  ["other", "其他"],
] as const

export function DepositDialog({
  adminKey,
  lead,
  onClose,
  onDone,
}: {
  adminKey: string
  lead: LeadRow | null
  onClose: () => void
  onDone: (orderId: string, orderNo: string) => void
}) {
  const [name, setName] = useState(lead && !isPlaceholderName(lead.full_name) ? (lead.full_name ?? "") : "")
  const [email, setEmail] = useState(lead?.email ?? "")
  const [phone, setPhone] = useState(lead?.phone ?? "")
  const [date, setDate] = useState(lead?.event_hint ?? "")
  const [time, setTime] = useState("18:00")
  const [address, setAddress] = useState(lead?.city_or_zip ?? "")
  const [adults, setAdults] = useState(String(lead?.guest_count ?? ""))
  const [kids, setKids] = useState("0")
  const [amount, setAmount] = useState(DEPOSIT_AMOUNT.toFixed(2))
  const [channel, setChannel] = useState<(typeof CHANNELS)[number][0]>("venmo")
  const [proof, setProof] = useState("")
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const submit = async () => {
    if (!name.trim() || !date) {
      setMsg("客户姓名和活动日期必填")
      return
    }
    if (!digits10(phone) && !email.trim()) {
      setMsg("电话或邮箱至少填一个（布置工具和查单都靠它）")
      return
    }
    setBusy(true)
    setMsg(null)
    try {
      const d = await adminJson<{ ok: boolean; orderId?: string; orderNo?: string; error?: string }>(adminKey, "/api/admin/orders/deposit-confirm", {
        body: {
          leadId: lead?.id,
          customerName: name.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          eventDate: date,
          eventTime: time || "18:00",
          eventAddress: address.trim() || undefined,
          adults: Number(adults) || 0,
          kids: Number(kids) || 0,
          amount: Number(amount),
          channel,
          proofUrl: proof.trim() || undefined,
          operator: localStorage.getItem("rh_operator_name") ?? "staff",
        },
      })
      if (d.ok && d.orderId && d.orderNo) onDone(d.orderId, d.orderNo)
      else setMsg(d.error ?? "登记失败")
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "登记失败")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog onClose={onClose} width={560}>
      <DialogHead
        title="押金已付 → 转入订单"
        lines={[lead ? `${displayName(lead.full_name, lead.phone)} · 线索会自动标为已成单，对话和承诺跟着进订单` : "线下收到的押金（Venmo / Zelle / 现金）。Stripe 付的不用登记，webhook 自动建单。"]}
        onClose={onClose}
      />
      <div className="dialog-col" style={{ gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="客户姓名 *">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="手机">
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label="邮箱">
            <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="活动地址 / 城市">
            <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} />
          </Field>
          <Field label="活动日期 *">
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="开始时间">
            <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
          <Field label="大人">
            <input className="input" type="number" min={0} value={adults} onChange={(e) => setAdults(e.target.value)} />
          </Field>
          <Field label="小孩">
            <input className="input" type="number" min={0} value={kids} onChange={(e) => setKids(e.target.value)} />
          </Field>
          <Field label="押金金额 $">
            <input className="input" type="number" step="0.01" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="收款方式">
            <select className="input" value={channel} onChange={(e) => setChannel(e.target.value as (typeof CHANNELS)[number][0])}>
              {CHANNELS.map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="凭证链接（截图 URL，可选）">
          <input className="input" value={proof} onChange={(e) => setProof(e.target.value)} placeholder="https://…" />
        </Field>
        {msg ? <div className="notice danger">{msg}</div> : null}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            取消
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void submit()} disabled={busy}>
            {busy ? "登记中…" : "登记押金，建立订单"}
          </button>
        </div>
      </div>
    </Dialog>
  )
}
