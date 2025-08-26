"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Image from "next/image"
import { siteConfig } from "@/config/site"
import { galleryImages } from "@/config/gallery-images"

// Video data with YouTube embeds
const galleryVideos = [
  {
    id: "vid-scallops",
    youtubeId: "fSDzyAoXnfE",
    title: "How to Make Perfect Hibachi Scallops: Expert Tips and Techniques",
    description:
      "Learn how to make perfectly seared hibachi scallops with expert tips and techniques from a professional hibachi chef. Watch as the chef demonstrates the proper way to prepare and cook scallops on a hibachi grill, using just the right amount of heat and seasoning to bring out their natural flavors.",
    isAvailable: true,
  },

  {
    id: "vid1",
    youtubeId: "5ZH43ej3wys",
    title: "Benihana Fried Rice Secrets Revealed",
    description:
      "A comprehensive guide to making Benihana's famous fried rice at home. Learn all the tips, tricks and techniques to make restaurant-quality hibachi fried rice.",
    isAvailable: true,
  },
  {
    id: "vid10",
    youtubeId: "3Ha8hMsF0t0",
    title: "Hibachi Restaurant Chef Live",
    description:
      "Experience the excitement of a live hibachi restaurant chef performance. Watch as the chef demonstrates impressive cooking skills and entertaining tricks right at the table.",
    isAvailable: true,
  },
  {
    id: "vid11",
    youtubeId: "ENTCDF8du_A",
    title: "How to Make Hibachi at Home | Steak and Shrimp Hibachi on Blackstone Griddle",
    description:
      "A detailed tutorial on how to make restaurant-quality steak and shrimp hibachi at home using a Blackstone griddle. Learn professional techniques and tips for creating the perfect hibachi meal in your own backyard.",
    isAvailable: true,
  },
  {
    id: "vid2",
    youtubeId: "SdRL0xprY24",
    title: "Hibachi Chicken At Home Better Than Benihana",
    description:
      "Learn how to make hibachi chicken at home that's even better than Benihana or any Japanese steakhouse, for a fraction of the cost. This Japanese-inspired hibachi teppanyaki recipe is super easy to make.",
    isAvailable: true,
  },
  {
    id: "vid3",
    youtubeId: "cnjPsZP0Uj8",
    title: "Hibachi Steak At Home Better Than Benihana",
    description:
      "Make restaurant-quality hibachi steak at home with this easy-to-follow recipe. Perfect for a special dinner that's more affordable than dining out.",
    isAvailable: true,
  },
  {
    id: "vid4",
    youtubeId: "ZnzRmM1KE48",
    title: "Benihana Hibachi Ginger Salad Dressing Recipe",
    description:
      "Learn how to make Benihana's famous ginger salad dressing at home. This tangy, sweet, and slightly spicy dressing perfectly complements any hibachi meal.",
    isAvailable: true,
  },
  {
    id: "vid5",
    youtubeId: "Lj_OqXwh-Ks",
    title: "Benihana Hibachi Vegetables Recipe",
    description:
      "Create restaurant-quality hibachi vegetables at home with this authentic recipe. Perfect as a side dish for your hibachi-style meal.",
    isAvailable: true,
  },
]

export default function GalleryPage() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [imageLoadErrors, setImageLoadErrors] = useState<Record<string, boolean>>({})

  const openLightbox = (id: string) => {
    setSelectedImage(id)
  }

  const closeLightbox = () => {
    setSelectedImage(null)
  }

  const handleImageError = (imageId: string) => {
    setImageLoadErrors(prev => ({
      ...prev,
      [imageId]: true
    }))
  }

  return (
    <div className="gallery-page-safe">
      {/* 火焰视频背景 */}
      <div className="fixed inset-0 z-0">
        <video
          className="w-full h-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          poster="/images/hibachi-dinner-party.jpg"
        >
          <source src="/video/00ebf7a19327d6f30078329b3e163952.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        {/* 深色遮罩层，让文字更清晰 */}
        <div className="absolute inset-0 bg-black/60"></div>
      </div>

      {/* 内容区域 */}
      <div className="relative z-10 container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-bold mb-4 text-white drop-shadow-lg">Gallery</h1>
            <p className="text-xl text-gray-200 max-w-2xl mx-auto drop-shadow">
              Browse our collection of hibachi photos and instructional videos. Learn professional techniques and get
              inspired for your next hibachi experience.
            </p>
          </div>

          <Tabs defaultValue="photos" className="mb-12">
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 bg-white/90 backdrop-blur-sm">
              <TabsTrigger value="photos" className="data-[state=active]:bg-white data-[state=active]:text-black">Photos</TabsTrigger>
              <TabsTrigger value="videos" className="data-[state=active]:bg-white data-[state=active]:text-black">Videos</TabsTrigger>
            </TabsList>

            {/* Photos Tab */}
            <TabsContent value="photos">
              <div className="bg-white/95 backdrop-blur-sm rounded-xl p-6 shadow-lg">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {galleryImages.map((image) => (
                    <div
                      key={image.id}
                      className="relative aspect-[4/3] overflow-hidden rounded-lg cursor-pointer border shadow-sm hover:shadow-md transition-all hover:scale-[1.02] duration-300"
                      onClick={() => !imageLoadErrors[image.id] && openLightbox(image.id)}
                    >
                  {!imageLoadErrors[image.id] ? (
                    <Image
                      src={image.src}
                      alt={image.alt}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                      className="object-cover"
                      priority={image.id === "img1" || image.id === "img2"}
                      onError={() => handleImageError(image.id)}
                      unoptimized={true}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
                      <span className="text-sm">Image unavailable</span>
                    </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            </TabsContent>

            {/* Videos Tab */}
            <TabsContent value="videos">
              <div className="bg-white/95 backdrop-blur-sm rounded-xl p-6 shadow-lg">
                <div className="mb-8 max-w-3xl mx-auto">
                  <h2 className="text-2xl font-bold mb-3 text-gray-800">Hibachi Cooking Tutorials</h2>
                  <p className="text-gray-700 mb-4">
                    Explore our collection of high-quality Hibachi cooking tutorials. Learn everything from basic ingredient
                    preparation to professional cooking techniques, all demonstrated by expert chefs. Recreate
                    restaurant-quality Hibachi experiences at home!
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {galleryVideos
                    .filter((video) => video.isAvailable !== false) // 过滤掉不可用的视频
                    .map((video) => (
                      <div key={video.id} className="rounded-lg overflow-hidden border shadow-md">
                        <div className="relative aspect-video bg-gray-100">
                          <iframe
                            src={`https://www.youtube.com/embed/${video.youtubeId}`}
                            title={video.title}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            className="absolute inset-0 w-full h-full"
                          ></iframe>
                        </div>
                        <div className="p-4">
                          <h3 className="font-medium text-lg mb-1">{video.title}</h3>
                          <p className="text-sm text-gray-600">{video.description}</p>
                        </div>
                      </div>
                    ))}
                </div>

                <div className="mt-10 text-center text-sm text-gray-500 max-w-2xl mx-auto border-t border-gray-200 pt-6">
                  <p className="mb-2">
                    <strong>Disclaimer:</strong> All videos featured on this page are sourced from public platforms. Rights
                    belong to their respective creators and are shared for educational purposes only.
                  </p>
                  <p>If you're the original creator and have concerns, please contact us at {siteConfig.contact.email}</p>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Lightbox */}
        {selectedImage && !imageLoadErrors[selectedImage] && (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center" onClick={closeLightbox}>
            <div className="relative max-w-5xl w-full h-full max-h-[80vh] p-4">
              {galleryImages.find((img) => img.id === selectedImage) && (
                <Image
                  src={galleryImages.find((img) => img.id === selectedImage)!.src}
                  alt={galleryImages.find((img) => img.id === selectedImage)!.alt}
                  fill
                  sizes="100vw"
                  className="object-contain"
                  onError={() => {
                    handleImageError(selectedImage)
                    closeLightbox()
                  }}
                  unoptimized={true}
                />
              )}
              <button 
                className="absolute top-4 right-4 text-white text-4xl hover:text-gray-300 transition-colors" 
                onClick={closeLightbox}
              >
                &times;
              </button>
            </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
