"use client"

import { useEffect, useState } from "react"

// 触屏上看 title 提示（iPad 2026-11-26）。工作台很多数字的细账写在 title 里（师傅工资怎么算、
// 大人小孩各几位、包装规格……），鼠标一悬停就出来，iPad 上根本看不到。这里补两种手势：
//   - 点一下：点的地方不是按钮 / 链接 / 输入框 / 可点的行，就直接弹出它的提示；
//   - 长按（0.45 秒）：任何带 title 的东西都弹，按钮也行；松手后那一下点击吃掉，免得长按变成点了按钮。
// 只在触屏挂（Workbench 里 pointer: coarse 才渲染），电脑上照旧用浏览器自己的悬停提示。

const INTERACTIVE = "button, a, input, select, textarea, label, summary, [role=button], [contenteditable=true], .wb-row, [data-row-click]"
const HOLD_MS = 450

type Tip = { text: string; x: number; y: number }

function titled(t: EventTarget | null): HTMLElement | null {
  const el = t instanceof Element ? t.closest<HTMLElement>("[title]") : null
  if (!el || !el.closest(".wb")) return null
  return el.getAttribute("title")?.trim() ? el : null
}

export function TouchTitle() {
  const [tip, setTip] = useState<Tip | null>(null)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    let hide: ReturnType<typeof setTimeout> | null = null
    let start: { x: number; y: number } | null = null
    let swallowUntil = 0
    const show = (text: string, x: number, y: number) => {
      setTip({ text, x, y })
      if (hide) clearTimeout(hide)
      hide = setTimeout(() => setTip(null), 4000)
    }
    const cancel = () => {
      if (timer) clearTimeout(timer)
      timer = null
    }
    const onStart = (e: TouchEvent) => {
      setTip(null)
      cancel()
      const p = e.touches[0]
      if (!p || e.touches.length > 1) return
      const el = titled(e.target)
      if (!el) return
      start = { x: p.clientX, y: p.clientY }
      timer = setTimeout(() => {
        timer = null
        swallowUntil = Date.now() + 800
        show(el.getAttribute("title") ?? "", start?.x ?? p.clientX, start?.y ?? p.clientY)
      }, HOLD_MS)
    }
    const onMove = (e: TouchEvent) => {
      const p = e.touches[0]
      if (start && p && Math.hypot(p.clientX - start.x, p.clientY - start.y) > 10) cancel()
    }
    const onClick = (e: MouseEvent) => {
      if (Date.now() < swallowUntil) {
        swallowUntil = 0
        e.preventDefault()
        e.stopPropagation()
        return
      }
      const el = titled(e.target)
      if (!el) return
      const target = e.target instanceof Element ? e.target : null
      if (target?.closest(INTERACTIVE)) return
      show(el.getAttribute("title") ?? "", e.clientX, e.clientY)
    }
    const onScroll = () => setTip(null)
    document.addEventListener("touchstart", onStart, { passive: true })
    document.addEventListener("touchmove", onMove, { passive: true })
    document.addEventListener("touchend", cancel, { passive: true })
    document.addEventListener("touchcancel", cancel, { passive: true })
    document.addEventListener("click", onClick, true)
    window.addEventListener("scroll", onScroll, { passive: true, capture: true })
    return () => {
      cancel()
      if (hide) clearTimeout(hide)
      document.removeEventListener("touchstart", onStart)
      document.removeEventListener("touchmove", onMove)
      document.removeEventListener("touchend", cancel)
      document.removeEventListener("touchcancel", cancel)
      document.removeEventListener("click", onClick, true)
      window.removeEventListener("scroll", onScroll, { capture: true })
    }
  }, [])

  if (!tip) return null
  // 放在手指上方，贴着屏幕边就往里收；上面放不下就放下面。
  const w = typeof window === "undefined" ? 1024 : window.innerWidth
  const left = Math.max(12, Math.min(tip.x - 120, w - 372))
  const above = tip.y > 120
  return (
    <div className="wb-touch-tip" role="tooltip" style={above ? { left, bottom: `calc(100% - ${tip.y - 16}px)` } : { left, top: tip.y + 24 }}>
      {tip.text}
    </div>
  )
}
