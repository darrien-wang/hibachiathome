"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Image from "next/image"
import { siteConfig } from "@/config/site"

// Gallery data with actual blob images
const galleryImages = [
  {
    id: "img1",
    src: "https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hibachiimage/1-m93dHNDISVKua3hTFnhnZ2JOqCPLB8.jpg",
    alt: "Hibachi chef cooking with flames",
  },
  {
    id: "img2",
    src: "https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hibachiimage/2-fwVMDe7XNA5vixCVGUffU4v1pDKdGG.jpg",
    alt: "Fresh hibachi food being prepared",
  },
  {
    id: "img3",
    src: "https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hibachiimage/3-ECGoDibwRJkqEKZFdiHbo4zufuvMyy.jpg",
    alt: "Family enjoying hibachi at home",
  },
  {
    id: "img4",
    src: "https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hibachiimage/4-SfqZqyg2PR4QVtatCRbequgR4WEoED.jpg",
    alt: "Chef performing tricks",
  },
  {
    id: "img5",
    src: "https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hibachiimage/5-q0GCQMceuaTeB4FEj5cRTas5xwHNeM.jpg",
    alt: "Seafood hibachi",
  },
  {
    id: "img6",
    src: "https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hibachiimage/7-TDZQrw5MJ7F6E1PmyHBDTtVPfNotpU.jpg",
    alt: "Backyard party with hibachi",
  },
  {
    id: "img7",
    src: "https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hibachiimage/9-qHeyNSeSAqYXM7I48CSkphbX7otGg4.jpg",
    alt: "Chef preparing food for guests",
  },
  {
    id: "img8",
    src: "https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hibachiimage/10-J7UoyKbxWTbhf21D1MIAUmZDztkwuY.jpg",
    alt: "Indoor hibachi setup",
  },
  {
    id: "img9",
    src: "https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hibachiimage/12-iIr42kDF4rQun91qqi0fabY58OlvAa.jpg",
    alt: "Hibachi chef in action",
  },
  {
    id: "img10",
    src: "https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hibachiimage/13-DOajRn24VwHuGDHsSSquxCmhKZqwwz.jpg",
    alt: "Hibachi cooking demonstration",
  },
  {
    id: "img11",
    src: "https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hibachiimage/15-YiS8DnJX7ucNCKnwemQ63i2HLwp8FH.jpg",
    alt: "Hibachi dinner party",
  },
  {
    id: "img12",
    src: "https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hibachiimage/21-0VdJxRFuoOsjk8mAAP0E1uKNupLa1E.jpg",
    alt: "Hibachi chef preparing meal",
  },
]

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
    id: "vid0",
    youtubeId: "zI9av1pmEFk",
    title: "Learn How to Breathe Fire - Tutorial",
    description:
      "A professional tutorial on fire breathing techniques. Note: This is for educational purposes only - fire breathing should only be attempted under the supervision of trained professionals and with proper safety precautions.",
    isAvailable: false, // 标记为不可用
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
  {
    id: "vid6",
    youtubeId: "dW0c4t1RUW0",
    title: "Hibachi Chef's Amazing Skills - Onion Volcano",
    description:
      "Watch a professional hibachi chef create the famous onion volcano and showcase impressive cooking skills.",
    isAvailable: true,
  },
  {
    id: "vid7",
    youtubeId: "gy4PMoAkNc0",
    title: "Hibachi Cooking Techniques",
    description: "Learn the techniques and skills behind authentic hibachi cooking from master chefs.",
    isAvailable: true,
  },
  {
    id: "vid8",
    youtubeId: "Hc6_CpJQrpg",
    title: "Hibachi Steak and Shrimp - Professional Cooking",
    description: "See how professional hibachi chefs prepare delicious steak and shrimp with flair and entertainment.",
    isAvailable: true,
  },
  {
    id: "vid9",
    youtubeId: "Yk7_c8G8ZT8",
    title: "Hibachi Chef Performance",
    description:
      "Enjoy the full hibachi chef performance with all the tricks and entertainment you can expect at your event.",
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
    <div className="container mx-auto px-4 py-12 pt-24 mt-16">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold mb-4">Gallery</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Browse our collection of hibachi photos and instructional videos. Learn professional techniques and get
            inspired for your next hibachi experience.
          </p>
        </div>

        <Tabs defaultValue="photos" className="mb-12">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
            <TabsTrigger value="photos">Photos</TabsTrigger>
            <TabsTrigger value="videos">Videos</TabsTrigger>
          </TabsList>

          {/* Photos Tab */}
          <TabsContent value="photos">
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
          </TabsContent>

          {/* Videos Tab */}
          <TabsContent value="videos">
            <div className="mb-8 max-w-3xl mx-auto">
              <h2 className="text-2xl font-bold mb-3">Hibachi Cooking Tutorials</h2>
              <p className="text-gray-600 mb-4">
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
  )
}
