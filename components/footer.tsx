import Link from "next/link"
import { Facebook, Instagram } from "lucide-react"
import BrandMark from "@/components/site/brand-mark"
import { phone, siteConfig, smsHref, whatsappHref } from "@/config/site"

// 2026-09-08 redesign: cream footer that reads as a colophon, not a second
// navigation. Same link set as before (search engines still see every
// service, city and sitemap link) — just three short columns on desktop and
// two wrapped rows on phones.

const EXPLORE = [
  { name: "Menu", href: "/menu" },
  { name: "Gallery", href: "/gallery" },
  { name: "Party ideas", href: "/party" },
  { name: "FAQ", href: "/faq" },
  { name: "Blog", href: "/blog" },
  { name: "Partner opportunities", href: "/partner-opportunities" },
] as const

const AREAS = [
  { name: "Los Angeles", href: "/hibachi-at-home/los-angeles" },
  { name: "Orange County", href: "/locations/la-orange-county" },
  { name: "San Diego", href: "/hibachi-at-home/san-diego" },
  { name: "Irvine", href: "/hibachi-at-home/irvine" },
  { name: "Pasadena", href: "/hibachi-at-home/pasadena" },
  { name: "Riverside", href: "/hibachi-at-home/riverside" },
  { name: "All cities →", href: "/locations" },
] as const

const SERVICES = [
  { name: "Hibachi at Home", href: "/hibachi-at-home" },
  { name: "Hibachi Catering", href: "/hibachi-catering" },
  { name: "Mobile Hibachi", href: "/mobile-hibachi" },
  { name: "Private Hibachi Chef", href: "/private-hibachi-chef" },
] as const

const link = "text-clay-600 transition-colors hover:text-flame-700"

export default function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="bg-cream pb-28 pt-10 text-ink lg:pb-16 lg:pt-14" role="contentinfo">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="border-t border-ink/10 pt-8 lg:flex lg:items-start lg:justify-between lg:gap-12 lg:pt-10">
          <div className="max-w-xs">
            <BrandMark />
            <p className="mt-3 text-[13px] leading-relaxed text-clay-600">
              Bringing the hibachi experience to your home across Southern California.
            </p>
            <div className="mt-3 flex gap-3">
              <a href={siteConfig.social.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className={link}>
                <Facebook className="h-5 w-5" />
              </a>
              <a href={siteConfig.social.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className={link}>
                <Instagram className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Phones: two wrapped rows. Desktop: three columns. */}
          <div className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-[13px] font-semibold lg:hidden">
            {EXPLORE.slice(0, 4).map((item) => (
              <Link key={item.href} href={item.href} className="text-ink/85 hover:text-flame-700">
                {item.name}
              </Link>
            ))}
            <Link href="/contact" className="text-ink/85 hover:text-flame-700">Contact</Link>
            <Link href="/es" className="text-ink/85 hover:text-flame-700">Español</Link>
          </div>
          <div className="mt-2.5 text-[12px] leading-relaxed text-clay-600 lg:hidden">
            <Link href="/locations" className={link}>Cities we serve</Link>
            {" · "}
            <Link href="/blog" className={link}>Blog</Link>
            {" · "}
            <Link href="/partner-opportunities" className={link}>Partner opportunities</Link>
            <br />
            {SERVICES.map((s, i) => (
              <span key={s.href}>
                {i > 0 ? " · " : ""}
                <Link href={s.href} className={link}>{s.name}</Link>
              </span>
            ))}
            <br />
            <a href={phone.voice.tel} className={link}>{phone.voice.dashed}</a>
            {" · "}
            <a href={smsHref()} className={link}>SMS</a>
            {" · "}
            <a href={whatsappHref()} target="_blank" rel="noopener noreferrer" className={link}>WhatsApp</a>
            {" · "}
            <a href={`mailto:${siteConfig.contact.email}`} className={link}>{siteConfig.contact.email}</a>
          </div>

          <div className="hidden gap-12 text-[13px] leading-[1.9] text-clay-600 lg:flex">
            <div>
              <p className="font-semibold text-ink">Explore</p>
              {EXPLORE.map((item) => (
                <Link key={item.href} href={item.href} className={`block ${link}`}>
                  {item.name}
                </Link>
              ))}
            </div>
            <div>
              <p className="font-semibold text-ink">Areas</p>
              {AREAS.map((item) => (
                <Link key={item.href} href={item.href} className={`block ${link}`}>
                  {item.name}
                </Link>
              ))}
            </div>
            <div>
              <p className="font-semibold text-ink">Services</p>
              {SERVICES.map((item) => (
                <Link key={item.href} href={item.href} className={`block ${link}`}>
                  {item.name}
                </Link>
              ))}
            </div>
            <div>
              <p className="font-semibold text-ink">Contact</p>
              <a href={phone.voice.tel} className={`block ${link}`}>{phone.voice.dashed}</a>
              <span className="block">
                <a href={whatsappHref()} target="_blank" rel="noopener noreferrer" className={link}>WhatsApp</a>
                {" · "}
                <a href={smsHref()} className={link}>SMS</a>
              </span>
              <a href={`mailto:${siteConfig.contact.email}`} className={`block ${link}`}>{siteConfig.contact.email}</a>
              <Link href="/contact" className={`block ${link}`}>Contact form</Link>
              <Link href="/es" className={`block ${link}`}>Español</Link>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-clay-600 lg:mt-10 lg:justify-between">
          <span>
            <Link href="/privacy-policy" className={link}>Privacy</Link>
            {" · "}
            <Link href="/terms" className={link}>Terms</Link>
            {" · "}© {year} {siteConfig.name}
          </span>
          <span>
            <a href="https://www.realhibachi.com/sitemap.html" title="HTML sitemap" className={link}>Sitemap</a>
            {" · "}
            <a href="https://www.realhibachi.com/sitemap.xml" title="XML sitemap" className={link}>XML</a>
          </span>
        </div>
      </div>
    </footer>
  )
}
