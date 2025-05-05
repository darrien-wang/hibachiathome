import Link from "next/link"
import { Facebook, Instagram, Twitter, Phone, Mail } from "lucide-react"
import Image from "next/image"
import { siteConfig } from "@/config/site"

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
              <p className="flex items-center text-[16px]">
                <Phone className="h-5 w-5 mr-2 text-[#F1691B]" />
                562-713-4832
              </p>
              <p className="flex items-center text-[16px]">
                <Mail className="h-5 w-5 mr-2 text-[#F1691B]" />
                darrien.wang@gmail.com
              </p>
            </div>
            <p className="text-[14px] text-[#A1A1A1]">
              Serving Chicago (IL), Los Angeles, Palm Springs, San Diego (CA), and Panama City, Destin, 30A (FL)
            </p>
          </div>
        </div>

        {/* 底部边框与版权 */}
        <div className="border-t border-[#21212A] pt-6 mt-6 text-center">
          <p className="text-[14px] text-[#A1A1A1]">
            &copy; {new Date().getFullYear()} Real Hibachi. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
