import Link from "next/link"
import { Facebook, Instagram, Twitter, Phone, Mail, MessageSquare } from "lucide-react"
import Image from "next/image"
import { siteConfig } from "@/config/site"

// 辅助函数：格式化电话号码以用于WhatsApp（只保留数字）
function formatPhoneForWhatsApp(phone: string) {
  return phone.replace(/\D/g, "")
}

export default function Footer() {
  return (
    <footer className="bg-[#0E1117] text-white py-[60px]" role="contentinfo">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
          {/* 左侧：品牌 */}
          <div className="flex flex-col items-start">
            <div className="flex items-center mb-4">
              <Image
                src="https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/logo/realhibachiathome-Gn1I9pZdsKZZZyYtU2kuyfGH4XaAdN.png"
                alt={siteConfig.logo.alt}
                width={siteConfig.logo.width}
                height={siteConfig.logo.height}
                className="h-auto rounded-full relative z-10 bg-white/95 backdrop-blur-sm after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-1/2 after:rounded-b-full after:shadow-[0_4px_6px_-1px_rgba(0,0,0,0.2)]"
              />
            </div>
            <p className="text-[16px] text-white/80 mt-2">
              Bringing the hibachi experience directly to your home or venue.
            </p>
          </div>

          {/* 中间：快速链接 */}
          <div className="mb-8 md:mb-0">
            <h4 className="text-[18px] font-bold text-white mb-6">Quick Links</h4>
            <ul className="space-y-3">
              <li>
                <Link href="/" className="text-[16px] hover:text-[#F1691B] transition-colors duration-200">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/book" className="text-[16px] hover:text-[#F1691B] transition-colors duration-200">
                  Book Online
                </Link>
              </li>
              <li>
                <Link href="/menu" className="text-[16px] hover:text-[#F1691B] transition-colors duration-200">
                  Menu
                </Link>
              </li>
              <li>
                <Link href="/gallery" className="text-[16px] hover:text-[#F1691B] transition-colors duration-200">
                  Gallery
                </Link>
              </li>
            </ul>
          </div>

          {/* 右侧：联系方式 */}
          <div>
            <h4 className="text-[18px] font-bold text-white mb-6">Connect With Us</h4>
            <div className="flex space-x-4 mb-6">
              <a href="#" className="hover:text-[#F1691B] transition-colors duration-200">
                <Facebook size={24} />
                <span className="sr-only">Facebook</span>
              </a>
              <a href="#" className="hover:text-[#F1691B] transition-colors duration-200">
                <Instagram size={24} />
                <span className="sr-only">Instagram</span>
              </a>
              <a href="#" className="hover:text-[#F1691B] transition-colors duration-200">
                <Twitter size={24} />
                <span className="sr-only">Twitter</span>
              </a>
            </div>
            <div className="space-y-3 mb-4">
              <a
                href={`tel:${siteConfig.contact.phone}`}
                className="flex items-center text-[16px] hover:text-[#F1691B] transition-colors duration-200"
              >
                <Phone className="h-5 w-5 mr-2 text-[#F1691B]" />
                {siteConfig.contact.phone}
              </a>
              <a
                href={`https://wa.me/${formatPhoneForWhatsApp(siteConfig.contact.phone)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center text-[16px] hover:text-[#F1691B] transition-colors duration-200"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="#F1691B"
                  className="mr-2"
                >
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                WhatsApp
              </a>
              <a
                href={`sms:${siteConfig.contact.phone}`}
                className="flex items-center text-[16px] hover:text-[#F1691B] transition-colors duration-200"
              >
                <MessageSquare className="h-5 w-5 mr-2 text-[#F1691B]" />
                SMS
              </a>
              <a
                href={`mailto:${siteConfig.contact.email}`}
                className="flex items-center text-[16px] hover:text-[#F1691B] transition-colors duration-200"
              >
                <Mail className="h-5 w-5 mr-2 text-[#F1691B]" />
                {siteConfig.contact.email}
              </a>
            </div>
            <p className="text-[14px] text-[#A1A1A1]">
              Serving {siteConfig.contact.locations.join(", ")} areas in New York
            </p>
          </div>
        </div>

        {/* 底部边框与版权 */}
        <div className="border-t border-[#21212A] pt-6 mt-6 text-center">
          {/* SEO Keywords */}
          <div className="mb-4">
            <a
              href="https://www.realhibachi.com/sitemap.html"
              title="Hibachi at home in NY"
              target="_blank"
              rel="noopener noreferrer"
              className="mx-2"
            >
              <strong>Hibachi at home in NY</strong>
            </a>
            <a
              href="https://www.realhibachi.com/sitemap.xml"
              title="Hibachi at home in NY"
              target="_blank"
              rel="noopener noreferrer"
              className="mx-2"
            >
              <strong>Hibachi at home in NY</strong>
            </a>
          </div>
          <p className="text-[14px] text-[#A1A1A1]">
            &copy; {new Date().getFullYear()} Real Hibachi. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
