import Link from "next/link"
import Image from "next/image"
import { Facebook, Instagram, Twitter, Phone, Mail, MessageSquare } from "lucide-react"
import { siteConfig } from "@/config/site"

// Helper function to format phone number for WhatsApp link
function formatPhoneForWhatsApp(phone: string) {
  return phone.replace(/\D/g, "") // Remove all non-digit characters
}

export default function Footer() {
  return (
    <footer
      className="bg-gradient-to-b from-gray-900 to-black text-white py-[60px] relative overflow-hidden"
      role="contentinfo"
    >
      <div className="absolute inset-0 bg-fire-gradient opacity-5 animate-fire-glow"></div>
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
          {/* Left Column: Brand Logo and Description */}
          <div className="flex flex-col items-start">
            <div className="flex items-center mb-4">
              <Image
                src={siteConfig.logo.main || "/placeholder.svg"}
                alt={siteConfig.logo.alt}
                width={siteConfig.logo.width || 60} // Fallback if not in siteConfig
                height={siteConfig.logo.height || 60} // Fallback if not in siteConfig
                className="h-auto rounded-full relative z-10 bg-white/95 backdrop-blur-sm after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-1/2 after:rounded-b-full after:shadow-[0_4px_6px_-1px_rgba(0,0,0,0.2)]"
                priority={false} // Set to true if it's LCP, usually not for footer logo
              />
            </div>
            <p className="text-[16px] text-white/80 mt-2">
              Bringing the hibachi experience directly to your home or venue.
            </p>
          </div>

          {/* Middle Column: Quick Links */}
          <div className="mb-8 md:mb-0">
            <h4 className="text-[18px] font-bold text-white mb-6">Quick Links</h4>
            <ul className="space-y-3">
              <li>
                <Link href="/" className="text-[16px] hover:text-fire-bright transition-colors duration-200">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/book" className="text-[16px] hover:text-fire-bright transition-colors duration-200">
                  Book Online
                </Link>
              </li>
              <li>
                <Link href="/menu" className="text-[16px] hover:text-fire-bright transition-colors duration-200">
                  Menu
                </Link>
              </li>
              <li>
                <Link href="/gallery" className="text-[16px] hover:text-fire-bright transition-colors duration-200">
                  Gallery
                </Link>
              </li>
              <li>
                <Link
                  href="/locations/nyc-long-island"
                  className="text-[16px] hover:text-fire-bright transition-colors duration-200"
                >
                  NYC & Long Island Hibachi
                </Link>
              </li>
              <li>
                <Link href="/faq" className="text-[16px] hover:text-fire-bright transition-colors duration-200">
                  FAQ
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-[16px] hover:text-fire-bright transition-colors duration-200">
                  Contact Us
                </Link>
              </li>
            </ul>
          </div>

          {/* Right Column: Connect With Us & Contact Info */}
          <div>
            <h4 className="text-[18px] font-bold text-white mb-6">Connect With Us</h4>
            <div className="flex space-x-4 mb-6">
              <a
                href={siteConfig.socialLinks?.facebook ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-fire-bright transition-colors duration-200"
                aria-label="Facebook"
              >
                <Facebook size={24} />
                <span className="sr-only">Facebook</span>
              </a>
              <a
                href={siteConfig.socialLinks?.instagram ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-fire-bright transition-colors duration-200"
                aria-label="Instagram"
              >
                <Instagram size={24} />
                <span className="sr-only">Instagram</span>
              </a>
              <a
                href={siteConfig.socialLinks?.twitter ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-fire-bright transition-colors duration-200"
                aria-label="Twitter"
              >
                <Twitter size={24} />
                <span className="sr-only">Twitter</span>
              </a>
            </div>
            <div className="space-y-3 mb-4">
              {siteConfig.contact.phone && (
                <a
                  href={`tel:${siteConfig.contact.phone}`}
                  className="flex items-center text-[16px] hover:text-fire-bright transition-colors duration-200"
                >
                  <Phone className="h-5 w-5 mr-2 text-fire-bright animate-fireFlicker" />
                  {siteConfig.contact.phone}
                </a>
              )}
              {siteConfig.contact.phone && (
                <a
                  href={`https://wa.me/${formatPhoneForWhatsApp(siteConfig.contact.phone)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center text-[16px] hover:text-fire-bright transition-colors duration-200"
                >
                  <svg // WhatsApp Icon
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="currentColor" // Changed to currentColor to inherit color, or use #F1691B
                    className="mr-2 text-fire-bright animate-fireFlicker" // Explicitly set color here if needed
                  >
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  WhatsApp
                </a>
              )}
              {siteConfig.contact.phone && (
                <a
                  href={`sms:${siteConfig.contact.phone}`}
                  className="flex items-center text-[16px] hover:text-fire-bright transition-colors duration-200"
                >
                  <MessageSquare className="h-5 w-5 mr-2 text-fire-bright animate-fireFlicker" />
                  SMS
                </a>
              )}
              {siteConfig.contact.email && (
                <a
                  href={`mailto:${siteConfig.contact.email}`}
                  className="flex items-center text-[16px] hover:text-fire-bright transition-colors duration-200"
                >
                  <Mail className="h-5 w-5 mr-2 text-fire-bright animate-fireFlicker" />
                  {siteConfig.contact.email}
                </a>
              )}
            </div>
            {siteConfig.contact.locations && siteConfig.contact.locations.length > 0 && (
              <p className="text-[14px] text-[#A1A1A1]">
                Serving {siteConfig.contact.locations.join(", ")} areas in New York
              </p>
            )}
          </div>
        </div>

        {/* Bottom Section: Sitemap Links and Copyright */}
        <div className="border-t border-[#21212A] pt-6 mt-6 text-center">
          <div className="mb-4">
            <a
              href="https://www.realhibachi.com/sitemap.html" // Assuming this is the correct public URL
              title="Hibachi at home in NY - HTML Sitemap"
              target="_blank"
              rel="noopener noreferrer"
              className="mx-2 text-[14px] text-[#A1A1A1] hover:text-fire-bright"
            >
              <strong>HTML Sitemap</strong>
            </a>
            <a
              href="https://www.realhibachi.com/sitemap.xml" // Assuming this is the correct public URL
              title="Hibachi at home in NY - XML Sitemap"
              target="_blank"
              rel="noopener noreferrer"
              className="mx-2 text-[14px] text-[#A1A1A1] hover:text-fire-bright"
            >
              <strong>XML Sitemap</strong>
            </a>
          </div>
          <p className="text-[14px] text-[#A1A1A1]">
            &copy; {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
