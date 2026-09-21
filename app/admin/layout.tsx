import type { Metadata } from "next"
import type { ReactNode } from "react"
import { SoftphoneProvider } from "@/components/admin/SoftphoneProvider"
import { MarkInternal } from "@/components/admin/mark-internal"
import "./workbench.css"

// Dynamic rendering so usePathname/useSearchParams resolve during SSR and the
// site chrome (header/footer/chat) is stripped server-side — no flash of
// public-site UI.
export const dynamic = "force-dynamic"

// robots.ts already disallows /admin; the meta tag is the belt to that brace.
export const metadata: Metadata = {
  title: "Workbench · Real Hibachi",
  robots: { index: false, follow: false, noarchive: true },
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* Server-rendered kill switch for public-site chrome on admin pages.
          The HideOnAdmin client wrapper then removes these nodes on hydration. */}
      <style>{`header:not(.wb header), footer, #social-proof-toast { display: none !important; } body { background: #f3f2f2; }`}</style>
      {/* The workbench and the mobile softphone sheet are set in Archivo
          (the Modernist design system); without this it silently falls back
          to system-ui. Admin-only, so the extra request never touches a
          customer page. */}
      <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <MarkInternal />
      <SoftphoneProvider>{children}</SoftphoneProvider>
    </>
  )
}
