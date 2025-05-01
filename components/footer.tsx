import Link from "next/link"
import Image from "next/image"
import { Facebook, Instagram, Twitter } from "lucide-react"

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-white pt-12 pb-6">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div>
            <div className="flex items-center justify-center md:justify-start">
              <div className="w-full">
                <Image
                  src="https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/logo-mjF6aoj9t3X7OPJnxLwaZzOEZ3qYn2.png"
                  alt="Hibachi-at-Home Logo"
                  width={300}
                  height={100}
                  className="w-full h-auto max-w-[250px]"
                />
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-secondary font-bold mb-4">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/" className="hover:text-secondary transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/book" className="hover:text-secondary transition-colors">
                  Book Online
                </Link>
              </li>
              <li>
                <Link href="/menu" className="hover:text-secondary transition-colors">
                  Menu
                </Link>
              </li>
              <li>
                <Link href="/gallery" className="hover:text-secondary transition-colors">
                  Gallery
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-secondary font-bold mb-4">Services</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/menu" className="hover:text-secondary transition-colors">
                  Catering
                </Link>
              </li>
              <li>
                <Link href="/rentals" className="hover:text-secondary transition-colors">
                  Equipment Rentals
                </Link>
              </li>
              <li>
                <Link href="/locations" className="hover:text-secondary transition-colors">
                  Service Areas
                </Link>
              </li>
              <li>
                <Link href="/faq" className="hover:text-secondary transition-colors">
                  FAQ
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-secondary font-bold mb-4">Connect With Us</h4>
            <div className="flex space-x-4 mb-4">
              <a href="#" className="hover:text-secondary transition-colors">
                <Facebook size={20} />
                <span className="sr-only">Facebook</span>
              </a>
              <a href="#" className="hover:text-secondary transition-colors">
                <Instagram size={20} />
                <span className="sr-only">Instagram</span>
              </a>
              <a href="#" className="hover:text-secondary transition-colors">
                <Twitter size={20} />
                <span className="sr-only">Twitter</span>
              </a>
            </div>
            <p className="text-sm text-gray-300">
              <strong>Phone:</strong> 562-713-4832
              <br />
              <strong>Email:</strong> darrien.wang@gmail.com
            </p>
            <p className="text-sm text-gray-400">
              Serving Chicago (IL), Los Angeles, Palm Springs, San Diego (CA), and Panama City, Destin, 30A (FL)
            </p>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-6 mt-6 text-center text-sm text-gray-400">
          <p>&copy; {new Date().getFullYear()} Hibachi-at-Home. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
