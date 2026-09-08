import Image from "next/image"
import Link from "next/link"

/**
 * Flame + "REAL / HIBACHI" wordmark. The flame is the one from the brand logo
 * (public/images/logo-realhibachi.png, cropped to public/images/brand/flame.png
 * with a transparent background on 2026-09-08 — the owner preferred it to the
 * drawn SVG). The wordmark inherits the header's tone: white over the homepage
 * hero, ink everywhere else.
 */
export default function BrandMark({
  tone = "ink",
  className,
  href = "/",
}: {
  tone?: "ink" | "white"
  className?: string
  href?: string
}) {
  const text = tone === "white" ? "text-white" : "text-ink"
  return (
    <Link href={href} aria-label="Real Hibachi — home" className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <Image
        src="/images/brand/flame.png"
        alt=""
        aria-hidden="true"
        width={272}
        height={377}
        priority
        className="h-[30px] w-auto shrink-0"
      />
      <span className={`font-serif text-[15px] font-extrabold uppercase leading-[0.9] tracking-[0.02em] ${text}`}>
        <span className="block">Real</span>
        <span className="block text-flame-300">Hibachi</span>
      </span>
    </Link>
  )
}
