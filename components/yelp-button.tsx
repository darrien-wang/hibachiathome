import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ExternalLink, Star } from "lucide-react"

interface YelpButtonProps {
  variant?: "default" | "outline" | "ghost"
  size?: "sm" | "default" | "lg"
  showReviews?: boolean
  className?: string
}

export function YelpButton({ 
  variant = "outline", 
  size = "default", 
  showReviews = false,
  className = ""
}: YelpButtonProps) {
  return (
    <Button 
      asChild 
      variant={variant} 
      size={size}
      className={`border-red-600 text-red-600 hover:bg-red-50 ${className}`}
    >
      <Link 
        href="https://www.yelp.com/biz/real-hibachi-at-home-baldwin-park" 
        target="_blank" 
        rel="noopener noreferrer"
        className="flex items-center gap-2"
      >
        <div className="bg-red-600 text-white px-2 py-1 rounded text-xs font-bold">
          Yelp
        </div>
        {showReviews ? (
          <>
            <Star className="w-4 h-4 fill-current" />
            <span>Read Reviews</span>
          </>
        ) : (
          <>
            <ExternalLink className="w-4 h-4" />
            <span>View on Yelp</span>
          </>
        )}
      </Link>
    </Button>
  )
}

export function YelpFloatingButton() {
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Button 
        asChild 
        className="bg-red-600 hover:bg-red-700 text-white shadow-lg rounded-full p-3"
      >
        <Link 
          href="https://www.yelp.com/biz/real-hibachi-at-home-baldwin-park" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-2"
        >
          <div className="bg-white text-red-600 px-2 py-1 rounded text-xs font-bold">
            Yelp
          </div>
          <Star className="w-4 h-4 fill-current" />
        </Link>
      </Button>
    </div>
  )
}
