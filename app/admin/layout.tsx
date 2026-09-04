import type { ReactNode } from "react"
import AdminNav from "@/components/admin/AdminNav"
import { SoftphoneProvider } from "@/components/admin/SoftphoneProvider"

// Dynamic rendering so usePathname resolves during SSR and the site chrome
// (header/footer/chat) is stripped server-side — no flash of public-site UI.
export const dynamic = "force-dynamic"

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* Server-rendered kill switch for public-site chrome on admin pages.
          The HideOnAdmin client wrapper then removes these nodes on hydration. */}
      <style>{`header, footer, #social-proof-toast { display: none !important; }`}</style>
      {/* The mobile softphone sheet is set in Archivo; without this it silently
          falls back to system-ui and the design's typography does not happen.
          Admin-only, so the extra request never touches a customer page. */}
      <link
        href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;700;800&display=swap"
        rel="stylesheet"
      />
      <AdminNav />
      <SoftphoneProvider>{children}</SoftphoneProvider>
    </>
  )
}
