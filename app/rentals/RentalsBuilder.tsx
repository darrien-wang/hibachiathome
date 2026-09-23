"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Image from "next/image"
import {
  DEFAULT_OCCASION,
  OCCASIONS,
  TABLECLOTHS,
  TABLE_THEMES,
  clothFor,
  findTheme,
  findVariant,
  type ClothId,
  type SetupSelection,
  type ThemeVariant,
} from "@/config/table-themes"
import { FULL_SETUP_PER_GUEST, TABLES_CHAIRS_PER_GUEST, UTENSILS_PER_GUEST, WHITE_CLOTH_PER_GUEST } from "@/config/pricing-rules"

// 设计稿 4a704199 "Rentals Page" 的配置器。稿子是用 Design 自己的 token 写
// 的，这里照旧翻成站点自己的 Organic token（奶油底、flame 做选中态、gold 做
// 第二声部、全圆角），和 09-20 那版重建一个做法。
//
// 两种 CTA：没身份的去 /quote 带参数；带 lead_id 进来的（押金后我们发的短信）
// 直接把选择 POST 回订单。同一个页面同一个配置器，不开第二个前门。

const usd = (n: number) => "$" + n.toLocaleString("en-US")

// 只要桌椅时的预览：选什么颜色就看什么颜色。选了白布却看到黑布，等于
// 让客户为一个没见过的东西多付 $5。
const SETUP_PHOTOS: Record<ClothId, { src: string; alt: string }> = {
  black: {
    src: "/gallery/real-hibachi-tables-chairs-black-linen-backyard.jpg",
    alt: "Folding tables in a U shape under black fitted tablecloths with black folding chairs, set up on a backyard patio beside the Real Hibachi grill",
  },
  white: {
    src: "/gallery/real-hibachi-tables-chairs-white-linen-backyard.jpg",
    alt: "Folding tables in a U shape under white fitted tablecloths with black folding chairs, set up on a backyard patio beside the Real Hibachi grill",
  },
}

/** 没有实拍时的盘具色块：从外到内 托盘 / 盘子 / 餐具。 */
function Swatch({ v, size = "lg" }: { v: ThemeVariant; size?: "sm" | "lg" }) {
  const big = size === "lg"
  return (
    <div
      className="grid h-full w-full place-items-center bg-cream"
      role="img"
      aria-label={`${v.name}: ${v.packLabel}`}
    >
      <span
        className="grid place-items-center rounded-full"
        style={{
          width: big ? "58%" : "82%",
          aspectRatio: "1",
          background: v.swatch.charger,
          boxShadow: "inset 0 0 0 1px rgba(0,0,0,.08)",
        }}
      >
        <span
          className="grid place-items-center rounded-full"
          style={{ width: "76%", aspectRatio: "1", background: v.swatch.plate }}
        >
          <span
            className="rounded-full"
            style={{ width: "26%", aspectRatio: "1", background: v.swatch.accent, opacity: 0.9 }}
          />
        </span>
      </span>
    </div>
  )
}

function VariantArt({ v, sizes, priority }: { v: ThemeVariant; sizes: string; priority?: boolean }) {
  if (!v.photo) return <Swatch v={v} />
  return (
    <Image
      src={v.photo.src}
      alt={v.photo.alt}
      width={1448}
      height={1086}
      sizes={sizes}
      priority={priority}
      className="h-full w-full object-cover"
      style={{ objectPosition: v.photo.position ?? "50% 50%" }}
    />
  )
}

type Props = {
  /** 页面服务端渲染时不知道有没有 lead_id，交给客户端读 */
  quoteBase?: string
}

export default function RentalsBuilder({ quoteBase = "/quote" }: Props) {
  const [pkg, setPkg] = useState<"tables" | "full">("full")
  const [cloth, setCloth] = useState<ClothId>("black")
  const [occasion, setOccasion] = useState(DEFAULT_OCCASION)
  const [pickedTheme, setPickedTheme] = useState<string | null>(null)
  const [variantIdx, setVariantIdx] = useState(0)
  const [guests, setGuests] = useState(20)

  // 认身份：押金后我们发的短信带 lead_id。useSearchParams 曾经把构建整页推进
  // CSR（见 architecture 备忘），所以一律读 window.location。
  const [leadId, setLeadId] = useState("")
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search)
      setLeadId((p.get("lead_id") ?? "").trim().slice(0, 64))
    } catch {
      /* 读不到就是匿名访客，按匿名走 */
    }
  }, [])

  const isFull = pkg === "full"
  const recommendedId = OCCASIONS.find((o) => o.name === occasion)?.themeId ?? TABLE_THEMES[0].id
  const themeId = pickedTheme ?? recommendedId
  const theme = findTheme(themeId)
  const variant = theme?.variants[Math.min(variantIdx, theme.variants.length - 1)]

  // 桌布跟着摆法走（Gold Rim 白盘配白布、黑盘配黑布），只要桌椅时才是客户自己选。
  const effectiveCloth: ClothId = isFull ? clothFor(theme, variant) : cloth
  const clothName = TABLECLOTHS.find((c) => c.id === effectiveCloth)?.name ?? effectiveCloth

  const selection: SetupSelection = useMemo(
    () => ({
      pkg,
      cloth: effectiveCloth,
      ...(isFull ? { themeId: theme?.id, variantId: variant?.id } : {}),
      guests,
      source: "rentals_page",
    }),
    [pkg, effectiveCloth, isFull, theme?.id, variant?.id, guests],
  )

  // 白桌布另算钱（老板 09-23 定）。白布的主题因此比黑布的贵 $5/人——这是
  // 唯一一处"选主题影响价格",FAQ 里如实写了。
  const whiteCloth = effectiveCloth === "white"
  const perGuest = (isFull ? FULL_SETUP_PER_GUEST : TABLES_CHAIRS_PER_GUEST) + (whiteCloth ? WHITE_CLOTH_PER_GUEST : 0)
  const total = perGuest * guests

  const quoteUrl = useMemo(() => {
    const q = new URLSearchParams({
      source: "rentals",
      guests: String(guests),
      setup: pkg,
      cloth: effectiveCloth,
    })
    if (isFull && theme) {
      q.set("theme", theme.id)
      if (variant && theme.variants.length > 1) q.set("variant", variant.id)
    }
    return `${quoteBase}?${q.toString()}`
  }, [guests, pkg, effectiveCloth, isFull, theme, variant, quoteBase])

  // 已下单客户：直接回写订单，不再走一遍报价。
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [sendErr, setSendErr] = useState<string | null>(null)
  const send = useCallback(async () => {
    setSending(true)
    setSendErr(null)
    try {
      const r = await fetch("/api/setup-selection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: leadId, ...selection }),
      })
      const j = (await r.json()) as { ok?: boolean; error?: string }
      if (!r.ok || !j.ok) throw new Error(j.error || "Could not send that through.")
      setSent(true)
    } catch (e) {
      setSendErr(e instanceof Error ? e.message : "Could not send that through.")
    } finally {
      setSending(false)
    }
  }, [leadId, selection])

  // 改了选择就允许再发一次，否则客户改完主意没法纠正。
  useEffect(() => {
    setSent(false)
  }, [selection])

  const packages = [
    {
      id: "tables" as const,
      name: "Tables & chairs",
      price: TABLES_CHAIRS_PER_GUEST,
      items: ["Seating for every guest", "Tablecloths on every table", "You bring plates & cutlery"],
    },
    {
      id: "full" as const,
      name: "Full setup",
      price: FULL_SETUP_PER_GUEST,
      items: ["Everything in Tables & chairs", "Plates, napkins & silverware", "Choose a table theme"],
    },
  ]

  // 推荐的那套顶到第一位，其余保持目录顺序。
  const orderedThemes = [
    ...TABLE_THEMES.filter((t) => t.id === recommendedId),
    ...TABLE_THEMES.filter((t) => t.id !== recommendedId),
  ]

  const stepLabel = "text-[15px] font-bold text-ink"

  return (
    <div className="grid items-start gap-10 md:grid-cols-[1fr_360px] md:gap-12">
      <div className="flex min-w-0 flex-col gap-10">
        {/* 1 · 要什么 */}
        <fieldset className="m-0 flex flex-col gap-3.5 border-0 p-0">
          <legend className={stepLabel}>1 · What do you need?</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {packages.map((k) => {
              const on = pkg === k.id
              return (
                <button
                  key={k.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setPkg(k.id)}
                  className={`flex flex-col gap-2.5 rounded-[24px] border-2 p-5 text-left transition-colors ${
                    on ? "border-flame bg-flame-100" : "border-transparent bg-surface hover:bg-gold-100"
                  }`}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-[17px] font-bold">{k.name}</span>
                    <span className="whitespace-nowrap font-serif text-2xl font-extrabold text-flame-800">
                      ${k.price}
                    </span>
                  </span>
                  <span className="text-[13px] text-clay-700">per guest</span>
                  <span className="flex flex-col gap-1.5">
                    {k.items.map((i) => (
                      <span key={i} className="flex items-center gap-2 text-sm">
                        <span className="h-[7px] w-[7px] flex-none rounded-full bg-gold-500" />
                        {i}
                      </span>
                    ))}
                  </span>
                </button>
              )
            })}
          </div>
        </fieldset>

        {/* 2 · 桌布颜色（只要桌椅时）*/}
        {!isFull && (
          <fieldset className="m-0 flex flex-col gap-3.5 border-0 p-0">
            <legend className={stepLabel}>2 · Tablecloth color</legend>
            <div className="flex gap-2.5">
              {TABLECLOTHS.map((c) => {
                const on = cloth === c.id
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setCloth(c.id)}
                    className={`flex items-center gap-2.5 rounded-full border-2 py-2 pl-2 pr-4 text-sm font-semibold transition-colors ${
                      on ? "border-flame bg-flame-100" : "border-transparent bg-surface hover:bg-gold-100"
                    }`}
                  >
                    <span
                      className="h-7 w-7 rounded-full ring-1 ring-black/10"
                      style={{ background: c.swatch }}
                    />
                    {c.name}
                    {c.id === "white" && (
                      <span className="text-[13px] font-normal text-clay-700">+${WHITE_CLOTH_PER_GUEST}/guest</span>
                    )}
                  </button>
                )
              })}
            </div>
            <p className="m-0 max-w-[52ch] text-sm leading-relaxed text-clay-700">
              You bring plates, napkins and cutlery. Chopsticks on request, no extra charge.
            </p>
          </fieldset>
        )}

        {/* 2 · 桌面主题（全套时）*/}
        {isFull && (
          <fieldset className="m-0 flex flex-col gap-4 border-0 p-0">
            <legend className={stepLabel}>2 · Pick a table theme</legend>
            <div className="flex flex-col gap-2">
              <span className="text-[13px] text-clay-700">What&apos;s the occasion?</span>
              <div className="flex flex-wrap gap-2">
                {OCCASIONS.map((o) => {
                  const on = occasion === o.name
                  return (
                    <button
                      key={o.name}
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        setOccasion(o.name)
                        setPickedTheme(null)
                        setVariantIdx(0)
                      }}
                      className={`rounded-full border-2 px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                        on ? "border-flame bg-flame-100" : "border-transparent bg-surface hover:bg-gold-100"
                      }`}
                    >
                      {o.name}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="flex flex-col gap-2.5">
              {orderedThemes.map((t) => {
                const on = t.id === themeId
                const rec = t.id === recommendedId
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      setPickedTheme(t.id)
                      setVariantIdx(0)
                    }}
                    className={`grid grid-cols-[88px_1fr] items-center gap-4 rounded-[24px] border-2 p-2.5 text-left transition-colors ${
                      on ? "border-flame bg-flame-100" : "border-transparent bg-surface hover:bg-gold-100"
                    }`}
                  >
                    <span className="h-[88px] w-[88px] overflow-hidden rounded-[18px] bg-cream">
                      <VariantArt v={t.variants[0]} sizes="88px" />
                    </span>
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-bold">{t.name}</span>
                        {rec && (
                          <span className="rounded-full bg-gold-200 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-gold-800">
                            Best for {occasion.toLowerCase()}
                          </span>
                        )}
                      </span>
                      <span className="text-[13px] leading-snug">{t.desc}</span>
                      <span className="text-xs leading-snug text-clay-700">Great for {t.fit}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </fieldset>
        )}

        {/* 3 · 人数 */}
        <fieldset className="m-0 flex flex-col gap-3.5 border-0 p-0">
          <legend className={stepLabel}>3 · How many guests?</legend>
          <div className="flex items-center gap-3.5">
            <button
              type="button"
              aria-label="One guest fewer"
              onClick={() => setGuests((g) => Math.max(1, g - 1))}
              className="grid h-11 w-11 place-items-center rounded-full bg-surface text-xl font-bold transition-colors hover:bg-gold-100"
            >
              &minus;
            </button>
            <span className="min-w-[44px] text-center text-2xl font-bold tabular-nums">{guests}</span>
            <button
              type="button"
              aria-label="One more guest"
              onClick={() => setGuests((g) => Math.min(200, g + 1))}
              className="grid h-11 w-11 place-items-center rounded-full bg-surface text-xl font-bold transition-colors hover:bg-gold-100"
            >
              +
            </button>
          </div>
        </fieldset>
      </div>

      {/* 预览 + 小计 */}
      <aside className="flex flex-col gap-4 rounded-[28px] bg-surface p-5 md:sticky md:top-24">
        <div className="aspect-[3/2] overflow-hidden rounded-[20px] bg-cream">
          {isFull && variant ? (
            <VariantArt v={variant} sizes="(min-width: 768px) 320px, 92vw" priority />
          ) : (
            <Image
              src={SETUP_PHOTOS[effectiveCloth].src}
              alt={SETUP_PHOTOS[effectiveCloth].alt}
              width={1448}
              height={1086}
              sizes="(min-width: 768px) 320px, 92vw"
              className="h-full w-full object-cover"
            />
          )}
        </div>

        {isFull && theme && theme.variants.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {theme.variants.map((v, i) => {
              const on = i === variantIdx
              return (
                <button
                  key={v.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setVariantIdx(i)}
                  className={`rounded-full border-2 px-3 py-1 text-[13px] font-semibold transition-colors ${
                    on ? "border-flame bg-flame-100" : "border-transparent bg-cream hover:bg-gold-100"
                  }`}
                >
                  {v.name}
                </button>
              )
            })}
          </div>
        )}

        <div className="flex flex-col gap-0.5">
          <span className="font-serif text-2xl font-extrabold leading-tight">
            {isFull && theme ? theme.name : "Tables & chairs"}
          </span>
          <span className="text-sm text-clay-700">
            {clothName} tablecloths · {guests} guests
          </span>
        </div>

        <div className="flex flex-col gap-1.5 text-sm tabular-nums">
          <div className="flex justify-between gap-3">
            <span>
              Tables, chairs &amp; tablecloths · ${TABLES_CHAIRS_PER_GUEST} × {guests}
            </span>
            <span>{usd(TABLES_CHAIRS_PER_GUEST * guests)}</span>
          </div>
          {isFull && (
            <div className="flex justify-between gap-3">
              <span>
                Plates &amp; utensils · ${UTENSILS_PER_GUEST} × {guests}
              </span>
              <span>{usd(UTENSILS_PER_GUEST * guests)}</span>
            </div>
          )}
          {whiteCloth && (
            <div className="flex justify-between gap-3">
              <span>
                White tablecloths · ${WHITE_CLOTH_PER_GUEST} × {guests}
              </span>
              <span>{usd(WHITE_CLOTH_PER_GUEST * guests)}</span>
            </div>
          )}
          <div className="flex justify-between gap-3 pt-2 text-[17px] font-bold">
            <span>Setup total</span>
            <span>{usd(total)}</span>
          </div>
        </div>

        {leadId ? (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => void send()}
              disabled={sending || sent}
              className="rounded-full bg-flame px-6 py-3.5 text-center font-semibold text-cream transition-colors hover:bg-flame-800 disabled:opacity-70"
            >
              {sent ? "Sent — we've got it" : sending ? "Sending…" : "Send this to Real Hibachi"}
            </button>
            {sent && (
              <span className="text-[13px] leading-snug text-clay-700">
                Added to your party. Change anything above and send again if you want a different look.
              </span>
            )}
            {sendErr && <span className="text-[13px] leading-snug text-flame-800">{sendErr}</span>}
          </div>
        ) : (
          <a
            href={quoteUrl}
            className="rounded-full bg-flame px-6 py-3.5 text-center font-semibold text-cream transition-colors hover:bg-flame-800"
          >
            Add to my quote
          </a>
        )}

        <span className="text-xs leading-relaxed text-clay-700">
          Rentals only come with a hibachi party. Set up before the chef starts, taken away after.
          {/* Owner 2026-09-23: part of the setup is booked in from outside, so a
              week's notice is what makes every theme available. Said plainly and
              small - short-notice parties still get an answer, just not a promise. */}
          {" "}
          Some of the setup needs about a week&apos;s notice. If your party is sooner, send it anyway and
          we&apos;ll tell you what we can have there.
        </span>
      </aside>
    </div>
  )
}
