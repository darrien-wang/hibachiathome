import type { Metadata } from "next"
import TableStudioClient from "./table-studio-client"

// Hidden soft-launch: direct link only — not indexed, not in the sitemap,
// no nav entry. Flip robots + add to STATIC_ROUTES when it goes public.
export const metadata: Metadata = {
  title: "Table Studio | Real Hibachi",
  description:
    "Design your hibachi party table: linens, chair covers, plates, and chargers — we bring it all, set it up, and clean it up.",
  robots: { index: false, follow: false },
}

export default function TableStudioPage() {
  return <TableStudioClient />
}
