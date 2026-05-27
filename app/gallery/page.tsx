"use client"

import { useState } from "react"
import Image from "next/image"

type GalleryMedia = {
  id: string
  type: "image" | "video"
  src: string
  title: string
  alt: string
}

const galleryMedia: GalleryMedia[] = [
  {
    id: "real-hibachi-party-los-angeles-private-chef-01",
    type: "image",
    src: "/gallery/real-hibachi-party-los-angeles-private-chef-01.jpg",
    title: "Private Hibachi Chef Party in Los Angeles",
    alt: "Private hibachi chef cooking at a Los Angeles hibachi party",
  },
  {
    id: "real-hibachi-party-los-angeles-backyard-event-02",
    type: "image",
    src: "/gallery/real-hibachi-party-los-angeles-backyard-event-02.jpg",
    title: "Backyard Hibachi Party in Los Angeles",
    alt: "Backyard hibachi party setup for a Los Angeles private event",
  },
  {
    id: "real-hibachi-party-los-angeles-chef-grill-setup-03",
    type: "image",
    src: "/gallery/real-hibachi-party-los-angeles-chef-grill-setup-03.jpg",
    title: "Hibachi Chef and Grill Setup in LA",
    alt: "Hibachi chef and grill setup for an at-home party in Los Angeles",
  },
  {
    id: "real-hibachi-party-orange-county-family-event-04",
    type: "image",
    src: "/gallery/real-hibachi-party-orange-county-family-event-04.jpg",
    title: "Orange County Family Hibachi Event",
    alt: "Family hibachi party at home in Orange County",
  },
  {
    id: "real-hibachi-party-los-angeles-fresh-cooking-05",
    type: "image",
    src: "/gallery/real-hibachi-party-los-angeles-fresh-cooking-05.jpg",
    title: "Fresh On-Site Hibachi Cooking in Los Angeles",
    alt: "Fresh hibachi food cooked on-site for a Los Angeles party",
  },
  {
    id: "real-hibachi-party-southern-california-dinner-06",
    type: "image",
    src: "/gallery/real-hibachi-party-southern-california-dinner-06.jpg",
    title: "Southern California Hibachi Dinner Party",
    alt: "Hibachi dinner party for a Southern California private event",
  },
  {
    id: "real-hibachi-party-los-angeles-chef-show-07",
    type: "image",
    src: "/gallery/real-hibachi-party-los-angeles-chef-show-07.jpg",
    title: "Los Angeles Hibachi Chef Show",
    alt: "Hibachi chef show during a Los Angeles at-home party",
  },
  {
    id: "real-hibachi-party-orange-county-backyard-hibachi-08",
    type: "image",
    src: "/gallery/real-hibachi-party-orange-county-backyard-hibachi-08.jpg",
    title: "Orange County Backyard Hibachi Party",
    alt: "Backyard hibachi party service in Orange County",
  },
  {
    id: "real-hibachi-party-los-angeles-group-dinner-09",
    type: "image",
    src: "/gallery/real-hibachi-party-los-angeles-group-dinner-09.jpg",
    title: "Los Angeles Group Hibachi Dinner",
    alt: "Group dinner with hibachi chef service in Los Angeles",
  },
  {
    id: "real-hibachi-party-southern-california-private-event-10",
    type: "image",
    src: "/gallery/real-hibachi-party-southern-california-private-event-10.jpg",
    title: "Southern California Private Hibachi Event",
    alt: "Private hibachi event with chef service in Southern California",
  },
  {
    id: "real-hibachi-party-los-angeles-on-site-chef-11",
    type: "image",
    src: "/gallery/real-hibachi-party-los-angeles-on-site-chef-11.jpg",
    title: "On-Site Hibachi Chef in Los Angeles",
    alt: "On-site hibachi chef cooking for guests in Los Angeles",
  },
  {
    id: "real-hibachi-party-orange-county-hibachi-at-home-12",
    type: "image",
    src: "/gallery/real-hibachi-party-orange-county-hibachi-at-home-12.jpg",
    title: "Hibachi at Home in Orange County",
    alt: "Hibachi at home party with chef service in Orange County",
  },
  {
    id: "real-hibachi-party-los-angeles-birthday-event-13",
    type: "image",
    src: "/gallery/real-hibachi-party-los-angeles-birthday-event-13.jpg",
    title: "Los Angeles Birthday Hibachi Party",
    alt: "Birthday hibachi party with private chef service in Los Angeles",
  },
  {
    id: "real-hibachi-party-southern-california-chef-experience-14",
    type: "image",
    src: "/gallery/real-hibachi-party-southern-california-chef-experience-14.jpg",
    title: "Southern California Hibachi Chef Experience",
    alt: "Private hibachi chef experience for a Southern California party",
  },
  {
    id: "real-hibachi-party-los-angeles-chef-show-video-01",
    type: "video",
    src: "/gallery/real-hibachi-party-los-angeles-chef-show-video-01.mp4",
    title: "Los Angeles Hibachi Chef Show Video",
    alt: "Video of a hibachi chef show at a Los Angeles private party",
  },
  {
    id: "real-hibachi-party-orange-county-backyard-video-02",
    type: "video",
    src: "/gallery/real-hibachi-party-orange-county-backyard-video-02.mp4",
    title: "Orange County Backyard Hibachi Party Video",
    alt: "Video of a backyard hibachi party in Orange County",
  },
  {
    id: "real-hibachi-party-los-angeles-live-cooking-video-03",
    type: "video",
    src: "/gallery/real-hibachi-party-los-angeles-live-cooking-video-03.mp4",
    title: "Los Angeles Live Hibachi Cooking Video",
    alt: "Video of live hibachi cooking for a Los Angeles at-home event",
  },
  {
    id: "real-hibachi-party-southern-california-event-video-04",
    type: "video",
    src: "/gallery/real-hibachi-party-southern-california-event-video-04.mp4",
    title: "Southern California Hibachi Event Video",
    alt: "Video of a Southern California hibachi party with on-site chef service",
  },
]

export default function GalleryPage() {
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null)
  const [mediaLoadErrors, setMediaLoadErrors] = useState<Record<string, boolean>>({})

  const selectedMedia = galleryMedia.find((media) => media.id === selectedMediaId)

  const openLightbox = (id: string) => {
    setSelectedMediaId(id)
  }

  const closeLightbox = () => {
    setSelectedMediaId(null)
  }

  const handleMediaError = (mediaId: string) => {
    setMediaLoadErrors(prev => ({
      ...prev,
      [mediaId]: true
    }))
  }

  return (
    <div className="gallery-page-safe container mx-auto px-4 py-12">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold mb-4">Gallery</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            See real hibachi-at-home events, chef show moments, backyard parties, and fresh on-site cooking from Real
            Hibachi service examples.
          </p>
        </div>

        <div className="mb-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {galleryMedia.map((media) => (
            <div
              key={media.id}
              className="relative aspect-[4/3] overflow-hidden rounded-lg cursor-pointer border shadow-sm hover:shadow-md transition-all hover:scale-[1.02] duration-300"
              onClick={() => !mediaLoadErrors[media.id] && openLightbox(media.id)}
              aria-label={media.alt}
              title={media.title}
            >
              {!mediaLoadErrors[media.id] && media.type === "image" ? (
                <Image
                  src={media.src}
                  alt={media.alt}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                  className="object-cover"
                  priority={media.id.endsWith("-01") || media.id.endsWith("-02")}
                  onError={() => handleMediaError(media.id)}
                />
              ) : !mediaLoadErrors[media.id] ? (
                <video
                  src={media.src}
                  aria-label={media.alt}
                  title={media.title}
                  className="h-full w-full object-cover"
                  muted
                  playsInline
                  preload="metadata"
                  onError={() => handleMediaError(media.id)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
                  <span className="text-sm">Media unavailable</span>
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-black/55 px-3 py-2 text-sm font-medium text-white">
                {media.title}
              </div>
            </div>
          ))}
        </div>

        {/* Lightbox */}
        {selectedMedia && !mediaLoadErrors[selectedMedia.id] && (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center" onClick={closeLightbox}>
            <div className="relative max-w-5xl w-full h-full max-h-[80vh] p-4">
              {selectedMedia.type === "image" ? (
                <Image
                  src={selectedMedia.src}
                  alt={selectedMedia.alt}
                  fill
                  sizes="100vw"
                  className="object-contain"
                  onError={() => {
                    handleMediaError(selectedMedia.id)
                    closeLightbox()
                  }}
                />
              ) : (
                <video
                  src={selectedMedia.src}
                  aria-label={selectedMedia.alt}
                  title={selectedMedia.title}
                  className="h-full w-full object-contain"
                  controls
                  autoPlay
                  playsInline
                  onError={() => {
                    handleMediaError(selectedMedia.id)
                    closeLightbox()
                  }}
                />
              )}
              <div className="absolute inset-x-4 bottom-4 rounded bg-black/65 px-4 py-3 text-white">
                <p className="font-semibold">{selectedMedia.title}</p>
                <p className="text-sm text-white/80">{selectedMedia.alt}</p>
              </div>
              <button
                className="absolute top-4 right-4 text-white text-4xl hover:text-gray-300 transition-colors"
                onClick={closeLightbox}
                aria-label="Close gallery preview"
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
