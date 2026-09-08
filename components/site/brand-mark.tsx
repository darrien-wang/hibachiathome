import Link from "next/link"

/**
 * Flame + "REAL / HIBACHI" wordmark from the 2026-09 redesign. Pure SVG + text,
 * so it stays crisp at 22px on a phone and inherits the header's tone (white
 * over the homepage hero, ink everywhere else).
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
      <svg width="22" height="26" viewBox="0 0 22 26" fill="none" aria-hidden="true" className="shrink-0">
        <path
          d="M12.5 1c.3 4-2.6 5.6-3.9 8.3C7.5 11.6 8.4 13.6 10 15c-.1-2 .7-3.3 2-4.3.4 2.3 2.7 3.3 3 6 .3 3.3-2 6.3-5.5 6.3S3.5 20.4 3.5 16.7C3.5 12.5 7 10.6 8.2 6.9 8.8 5 8.5 3 8 1c2 .3 3.6 1 4.5 0z"
          fill="#e8722a"
        />
        <path
          d="M9.6 25c-2.8 0-4.6-1.9-4.6-4.3 0-2.4 1.9-3.4 2.6-5.6.6 1.4 1.7 2 2.6 3 .3-1 .2-1.9 0-2.7 1.9 1.1 3.3 2.7 3.3 5 0 2.6-1.7 4.6-3.9 4.6z"
          fill="#f7b78a"
        />
      </svg>
      <span className={`font-serif text-[15px] font-extrabold uppercase leading-[0.9] tracking-[0.02em] ${text}`}>
        <span className="block">Real</span>
        <span className="block text-flame-300">Hibachi</span>
      </span>
    </Link>
  )
}
