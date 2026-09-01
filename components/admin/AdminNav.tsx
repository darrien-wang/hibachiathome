"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

// Top-level nav for the order workbench: orders is the main surface, the
// legacy lead dashboard is one tab of it (pre-deposit work only).
const TABS = [
  { href: "/admin/orders", label: "订单" },
  { href: "/admin/leads", label: "线索" },
]

export default function AdminNav() {
  const pathname = usePathname()
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 18,
        padding: "10px 20px",
        borderBottom: "1px solid #e5e7eb",
        background: "#fff",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      <strong style={{ fontSize: 15 }}>🔥 订单工作台</strong>
      <nav style={{ display: "flex", gap: 6 }}>
        {TABS.map((t) => {
          const active = pathname?.startsWith(t.href)
          return (
            <Link
              key={t.href}
              href={t.href}
              style={{
                padding: "5px 14px",
                borderRadius: 999,
                fontSize: 13.5,
                textDecoration: "none",
                fontWeight: active ? 700 : 400,
                color: active ? "#fff" : "#374151",
                background: active ? "#111827" : "transparent",
                border: active ? "1px solid #111827" : "1px solid #d1d5db",
              }}
            >
              {t.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
