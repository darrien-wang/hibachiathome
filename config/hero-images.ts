// Carousel image configuration
export interface HeroImage {
  url: string
  alt: string
  priority?: number // Optional priority field, lower numbers have higher priority
  duration?: number // Optional display duration (milliseconds)
}

// Carousel configuration
export interface CarouselConfig {
  interval: number // Carousel interval time (milliseconds)
  transition: number // Transition animation time (milliseconds)
  autoplayAfterInteraction: boolean // Whether to autoplay after user interaction
  firstSlideDuration: number // Display time for first slide (milliseconds)
}

// Default carousel configuration
export const carouselConfig: CarouselConfig = {
  interval: 5000, // Switch every 5 seconds
  transition: 500, // Transition animation lasts 0.5 seconds
  autoplayAfterInteraction: true, // Autoplay after user interaction
  firstSlideDuration: 10000, // First slide displays for 10 seconds
}

export const heroImages: HeroImage[] = [
  {
    url: "https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hero/ChatGPT%20Image%20May%2019%2C%202025%2C%2012_09_48%20AM-nfrN2RlFbVT5NJuQKq4AHsBN1fHiDp.png",
    alt: "Hibachi chef cooking with flames",
    priority: 1, // Highest priority, ensures it's the first image
    duration: carouselConfig.firstSlideDuration, // Use the first slide duration from config
  },
  {
    url: "https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hero/banner5-QXDgD4u9YK9SAwtGBCSDADdrM5YNG1.jpg",
    alt: "Hibachi chef cooking with flames",
    priority: 2,
    timestamp: "2025-05-15",
  },
  {
    url: "https://live.staticflickr.com/65535/53336755436_3c614274cd_b.jpg",
    alt: "Hibachi chef cooking at home party",
    priority: 3,
  },

  // 4 additional carousel images
  {
    url: "https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hero/banner-xN3z5y6ICfaVbAUl5fGRtovtIMuRem.jpg",
    alt: "Professional hibachi chef preparing meal",
    priority: 5,
  },
  {
    url: "https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hero/banner2-gGtPpZjmEvOwNHxapy4YBFmbbbuhKk.jpg",
    alt: "Hibachi grill with delicious food",
    priority: 6,
  },
  {
    url: "https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hero/banner4-gzupE1yCoJ0UA36Gm8v3BMNHdVfA5Q.jpg",
    alt: "Elegant hibachi dining experience",
    priority: 8,
  },
]

// Get sorted image array
export function getSortedHeroImages(): HeroImage[] {
  return [...heroImages].sort((a, b) => (a.priority || 999) - (b.priority || 999))
}
