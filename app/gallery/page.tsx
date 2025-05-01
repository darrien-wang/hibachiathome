"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Image from "next/image"

// Gallery data (placeholder)
const galleryImages = [
  {
    id: "img1",
    src: "/hibachi-flames.png",
    alt: "Hibachi chef cooking with flames",
  },
  {
    id: "img2",
    src: "/sizzling-hibachi.png",
    alt: "Fresh hibachi food being prepared",
  },
  {
    id: "img3",
    src: "/placeholder.svg?key=j64w5",
    alt: "Family enjoying hibachi at home",
  },
  {
    id: "img4",
    src: "/fiery-onion-volcano.png",
    alt: "Chef performing tricks",
  },
  {
    id: "img5",
    src: "/placeholder.svg?key=va32w",
    alt: "Seafood hibachi",
  },
  {
    id: "img6",
    src: "/placeholder.svg?height=600&width=800&query=elegant backyard party with hibachi chef",
    alt: "Backyard party with hibachi",
  },
  {
    id: "img7",
    src: "/placeholder.svg?height=600&width=800&query=hibachi chef preparing food for guests",
    alt: "Chef preparing food for guests",
  },
  {
    id: "img8",
    src: "/placeholder.svg?height=600&width=800&query=indoor hibachi catering setup",
    alt: "Indoor hibachi setup",
  },
]

// Video data (placeholder)
const galleryVideos = [
  {
    id: "vid1",
    poster: "/placeholder.svg?height=600&width=800&query=chef performing onion volcano thumbnail",
    title: "Chef's Onion Volcano Performance",
  },
  {
    id: "vid2",
    poster: "/placeholder.svg?height=600&width=800&query=egg tricks on hibachi grill thumbnail",
    title: "Amazing Egg Cooking Tricks",
  },
  {
    id: "vid3",
    poster: "/placeholder.svg?height=600&width=800&query=shrimp cooking demonstration thumbnail",
    title: "Shrimp Cooking Demonstration",
  },
  {
    id: "vid4",
    poster: "/placeholder.svg?height=600&width=800&query=customer testimonial hibachi at home thumbnail",
    title: "Customer Testimonial - Birthday Party",
  },
]

export default function GalleryPage() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  const openLightbox = (id: string) => {
    setSelectedImage(id)
  }

  const closeLightbox = () => {
    setSelectedImage(null)
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold mb-4">Gallery</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Browse photos and videos of our hibachi experiences. See our chefs in action and the amazing presentations
            they create.
          </p>
        </div>

        <Tabs defaultValue="photos" className="mb-12">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
            <TabsTrigger value="photos">Photos</TabsTrigger>
            <TabsTrigger value="videos">Videos</TabsTrigger>
          </TabsList>

          {/* Photos Tab */}
          <TabsContent value="photos">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {galleryImages.map((image) => (
                <div
                  key={image.id}
                  className="relative aspect-video overflow-hidden rounded-lg cursor-pointer border shadow-sm hover:shadow-md transition-shadow"
                  onClick={() => openLightbox(image.id)}
                >
                  <Image
                    src={image.src || "/placeholder.svg"}
                    alt={image.alt}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Videos Tab */}
          <TabsContent value="videos">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {galleryVideos.map((video) => (
                <div key={video.id} className="rounded-lg overflow-hidden border shadow-sm">
                  <div className="relative aspect-video bg-gray-100">
                    <Image
                      src={video.poster || "/placeholder.svg"}
                      alt={video.title}
                      fill
                      sizes="(max-width: 640px) 100vw, 50vw"
                      className="object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="h-16 w-16 rounded-full bg-primary/90 flex items-center justify-center">
                        <div className="w-0 h-0 border-y-8 border-y-transparent border-l-12 border-l-white ml-1"></div>
                      </div>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-medium">{video.title}</h3>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-center mt-6 text-gray-500 text-sm">
              <p>Note: Video content will be added once the service is live. These are placeholder thumbnails.</p>
            </div>
          </TabsContent>
        </Tabs>

        {/* Lightbox */}
        {selectedImage && (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center" onClick={closeLightbox}>
            <div className="relative max-w-5xl w-full h-full max-h-[80vh] p-4">
              {galleryImages.find((img) => img.id === selectedImage) && (
                <Image
                  src={galleryImages.find((img) => img.id === selectedImage)!.src || "/placeholder.svg"}
                  alt={galleryImages.find((img) => img.id === selectedImage)!.alt}
                  fill
                  sizes="100vw"
                  className="object-contain"
                />
              )}
              <button className="absolute top-4 right-4 text-white text-4xl" onClick={closeLightbox}>
                &times;
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
