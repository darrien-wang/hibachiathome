import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"

interface MenuItemCardProps {
  id: string
  title: string
  price: number
  image: string
  description: string
}

export default function MenuItemCard({ id, title, price, image, description }: MenuItemCardProps) {
  return (
    <div className="border rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-all">
      <div className="relative h-64 overflow-hidden">
        <Image
          src={image || "/placeholder.svg"}
          alt={title}
          fill
          className="object-cover hover:scale-105 transition-transform duration-500"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
      </div>
      <div className="p-4">
        <h3 className="text-xl font-bold mb-1">{title}</h3>
        <p className="text-gray-600 text-sm mb-3">{description}</p>
        <div className="flex justify-between items-center">
          <span className="text-xl font-bold text-amber-600">
            ${typeof price === "number" ? price.toFixed(1) : price}{" "}
            <span className="text-xs font-normal text-gray-500">+tax</span>
          </span>
          <Button asChild size="sm" className="bg-amber-500 hover:bg-amber-600">
            <Link href="/book">Book Now</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
