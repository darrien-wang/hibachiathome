import type { ReactNode } from "react"

// Dynamic rendering so usePathname resolves during SSR and the site chrome
// (header/footer/chat) is stripped server-side — no flash of public-site UI.
export const dynamic = "force-dynamic"

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* Server-rendered kill switch for public-site chrome on admin pages.
          The HideOnAdmin client wrapper then removes these nodes on hydration. */}
      <style>{`header, footer, #social-proof-toast { display: none !important; }`}</style>
      {children}
    </>
  )
}
