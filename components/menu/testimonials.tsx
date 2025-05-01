import { Star } from "lucide-react"

interface Testimonial {
  name: string
  rating: number
  comment: string
}

interface TestimonialsProps {
  testimonials: Testimonial[]
}

export default function Testimonials({ testimonials }: TestimonialsProps) {
  return (
    <div className="mb-10">
      <div className="flex flex-wrap justify-center gap-4">
        {testimonials.map((testimonial, index) => (
          <div key={index} className="bg-secondary/5 rounded-lg p-4 max-w-xs">
            <div className="flex items-center mb-2">
              {Array.from({ length: testimonial.rating }).map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-secondary text-secondary" />
              ))}
            </div>
            <p className="text-sm italic mb-2">"{testimonial.comment}"</p>
            <p className="text-xs text-right font-medium">- {testimonial.name}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
