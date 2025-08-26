"use client"

import { useState } from "react"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MessageSquare, ChevronLeft, ChevronRight, Star } from "lucide-react"
import { AnimateOnScroll } from "@/components/animate-on-scroll"

interface SMSReview {
  id: string
  imagePath: string
  title: string
  date: string
  rating: number
  customerName?: string
  summary?: string
  type?: "sms" | "facebook"
}

// SMS Reviews 数据
const smsReviews: SMSReview[] = [
  {
    id: "1",
    imagePath: "/images/reviews/7.22.png",
    title: "Customer SMS Review",
    date: "July 22nd",
    rating: 5,
    customerName: "Mrs. Williams",
    summary: "Excellent hibachi service with professional chef and amazing food quality"
  },
  {
    id: "2",
    imagePath: "/images/reviews/7.25 8pm.png",
    title: "Customer SMS Review",
    date: "July 25th, 8pm",
    rating: 5,
    customerName: "Mr. Johnson",
    summary: "Authentic SMS feedback showing complete satisfaction with our hibachi service"
  },
  {
    id: "3", 
    imagePath: "/images/reviews/8.4.png",
    title: "Customer SMS Review",
    date: "August 4th",
    rating: 5,
    customerName: "Ms. Rodriguez",
    summary: "Another satisfied customer sharing their wonderful hibachi experience"
  },
  {
    id: "4",
    imagePath: "/images/reviews/8.9.jpg",
    title: "Facebook Customer Review",
    date: "August 9th",
    rating: 5,
    customerName: "Mr. Davis",
    summary: "Facebook chat review from a delighted customer praising our hibachi catering"
  },
  {
    id: "5",
    imagePath: "/images/reviews/8.23.png",
    title: "Customer SMS Review",
    date: "August 23rd",
    rating: 5,
    customerName: "Mrs. Thompson",
    summary: "Outstanding hibachi experience with exceptional service and delicious food"
  }
]

export default function SMSReviews() {
  const [currentPage, setCurrentPage] = useState(0)
  const reviewsPerPage = 3
  const totalPages = Math.ceil(smsReviews.length / reviewsPerPage)

  const getCurrentReviews = () => {
    const start = currentPage * reviewsPerPage
    return smsReviews.slice(start, start + reviewsPerPage)
  }

  const nextPage = () => {
    setCurrentPage((prev) => (prev + 1) % totalPages)
  }

  const prevPage = () => {
    setCurrentPage((prev) => (prev - 1 + totalPages) % totalPages)
  }

  if (smsReviews.length === 0) {
    return null
  }

  return (
    <section className="py-16 bg-gradient-to-r from-blue-50 to-indigo-50">
      <div className="container mx-auto px-4">
        <AnimateOnScroll>
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-2 mb-4">
              <MessageSquare className="w-8 h-8 text-blue-600" />
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
                Real Customer Reviews
              </h2>
            </div>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Authentic SMS and social media feedback from real customers who experienced our professional hibachi service
            </p>
            <div className="flex items-center justify-center gap-1 mt-4">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-6 h-6 fill-yellow-400 text-yellow-400" />
              ))}
              <span className="ml-2 text-gray-600 font-medium">
                Based on {smsReviews.length} authentic reviews
              </span>
            </div>
          </div>
        </AnimateOnScroll>

        {/* Reviews Grid */}
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-8">
            {getCurrentReviews().map((review, index) => (
              <AnimateOnScroll key={review.id} delay={index * 100}>
                <Card className="group hover:shadow-xl transition-all duration-300 bg-white/90 backdrop-blur-sm overflow-hidden">
                  <CardContent className="p-0">
                    {/* SMS Image */}
                    <div className="relative h-80 overflow-hidden">
                      <Image
                        src={review.imagePath}
                        alt={review.title}
                        fill
                        className="object-contain bg-gray-50 group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      />
                      {/* Date Badge */}
                      <div className="absolute top-4 right-4 bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                        {review.date}
                      </div>
                    </div>
                    
                    {/* Review Info */}
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-lg text-gray-900">
                          {review.title}
                        </h3>
                        <div className="flex items-center gap-1">
                          {[...Array(review.rating)].map((_, i) => (
                            <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                          ))}
                        </div>
                      </div>
                      
                      {review.customerName && (
                        <p className="text-gray-600 mb-2">
                          From: <span className="font-medium">{review.customerName}</span>
                        </p>
                      )}
                      
                      {review.summary && (
                        <p className="text-gray-600 text-sm italic">
                          "{review.summary}"
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </AnimateOnScroll>
            ))}
          </div>

          {/* Pagination Controls - 只在有多页时显示 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={prevPage}
                disabled={smsReviews.length <= reviewsPerPage}
                className="hover:bg-blue-50"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>
              
              <div className="flex items-center gap-2">
                {[...Array(totalPages)].map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentPage(i)}
                    className={`w-3 h-3 rounded-full transition-colors ${
                      i === currentPage ? "bg-blue-600" : "bg-gray-300 hover:bg-gray-400"
                    }`}
                  />
                ))}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={nextPage}
                disabled={smsReviews.length <= reviewsPerPage}
                className="hover:bg-blue-50"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}
        </div>

        {/* CTA */}
        <AnimateOnScroll delay={300}>
          <div className="text-center mt-12">
            <div className="bg-white/80 backdrop-blur-sm rounded-lg p-8 max-w-2xl mx-auto">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                Experience the Same Quality Service
              </h3>
              <p className="text-gray-600 mb-6">
                Join our satisfied customers and enjoy professional hibachi at-home service
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  size="lg" 
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  asChild
                >
                  <a href="/book">Book Now</a>
                </Button>
                <Button 
                  variant="outline" 
                  size="lg"
                  className="border-blue-600 text-blue-600 hover:bg-blue-50"
                  asChild
                >
                  <a href="sms:2137707788">
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Text for Quote
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </AnimateOnScroll>
      </div>
    </section>
  )
}
