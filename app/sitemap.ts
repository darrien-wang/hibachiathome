import type { MetadataRoute } from "next"
import { getBlogPosts } from "@/lib/blog"
import { cityPages, CITY_PAGES_LAST_UPDATED } from "@/config/city-pages"
import { occasionPages, OCCASION_PAGES_LAST_UPDATED } from "@/config/occasion-pages"
import { CATERING_CITIES } from "@/config/catering-cities"
import { OCCASION_CITY_COMBOS } from "@/config/occasion-city-pages"

const BASE_URL = "https://www.realhibachi.com"

// lastmod has to be honest in both directions. Using `new Date()` on every
// build claims constant freshness, which search engines learn to distrust and
// then ignore entirely — but a single frozen constant across the whole site is
// the same lie in reverse, and it was telling Google that pages rewritten this
// week had not moved since July. So: a date per route, edited when that route's
// content actually changes.
const LAST_UPDATED: Record<string, string> = {
  "": "2026-09-02T00:00:00.000Z", // hero repositioning, honest trust markers
  "/es": "2026-09-03T00:00:00.000Z", // Spanish homepage launch
  "/es/preguntas-frecuentes": "2026-09-03T00:00:00.000Z", // Spanish FAQ launch
  "/hibachi-at-home": "2026-08-27T00:00:00.000Z", // weather policy copy
  "/menu": "2026-08-27T00:00:00.000Z", // sourcing spec section
  "/faq": "2026-08-27T00:00:00.000Z", // allergen and tent answers
  "/book": "2026-08-27T00:00:00.000Z", // tent copy
  "/blog": "2026-08-26T00:00:00.000Z", // four new posts
  "/locations/la-orange-county": "2026-08-27T00:00:00.000Z", // child pricing
}

// Routes not listed above genuinely have not changed since the SEO rebuild.
const DEFAULT_LAST_UPDATED = "2026-07-02T00:00:00.000Z"

const STATIC_ROUTES = [
  "", // Homepage
  "/es", // Spanish homepage
  "/es/preguntas-frecuentes", // Spanish FAQ (/es/cotizar is noindex like /quote)
  "/hibachi-at-home", // Core at-home hibachi service page
  "/locations/la-orange-county", // Los Angeles page - highest priority
  "/menu",
  "/blog", // Blog index — was missing from the sitemap entirely
  "/book",
  "/contact",
  "/partner-opportunities",
  "/faq",
  "/gallery",
  "/locations", // Main locations page
  "/privacy-policy",
  // "/referral" deliberately absent: page is live but unlisted (noindex) while
  // referral anti-abuse rules are finalized — shared 1:1 via SMS only.
  "/rentals",
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified: LAST_UPDATED[route] ?? DEFAULT_LAST_UPDATED,
    changeFrequency:
      route === "" || route === "/hibachi-at-home" || route === "/locations/la-orange-county" ? "weekly" : "monthly",
    priority:
      route === "" ? 1.0 : route === "/hibachi-at-home" ? 0.95 : route === "/locations/la-orange-county" ? 0.9 : 0.8,
  }))

  const cityPagesSitemap: MetadataRoute.Sitemap = cityPages.map((city) => ({
    url: `${BASE_URL}/hibachi-at-home/${city.slug}`,
    lastModified: city.lastUpdated ?? CITY_PAGES_LAST_UPDATED,
    changeFrequency: "monthly",
    priority: 0.85,
  }))

  const cateringPagesSitemap: MetadataRoute.Sitemap = CATERING_CITIES.map((slug) => ({
    url: `${BASE_URL}/hibachi-catering/${slug}`,
    lastModified: "2026-09-01T00:00:00.000Z",
    changeFrequency: "monthly" as const,
    priority: 0.85,
  }))

  const occasionPagesSitemap: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/party`,
      lastModified: OCCASION_PAGES_LAST_UPDATED,
      changeFrequency: "monthly" as const,
      priority: 0.9,
    },
    ...occasionPages.map((occasion) => ({
      url: `${BASE_URL}/party/${occasion.slug}`,
      lastModified: OCCASION_PAGES_LAST_UPDATED,
      changeFrequency: "monthly" as const,
      priority: 0.85,
    })),
    ...OCCASION_CITY_COMBOS.map((combo) => ({
      url: `${BASE_URL}/party/${combo.occasion}/${combo.city}`,
      lastModified: "2026-09-01T00:00:00.000Z",
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ]

  let blogPostsSitemap: MetadataRoute.Sitemap = []
  try {
    const blogPosts = await getBlogPosts()
    blogPostsSitemap = blogPosts.map((post) => ({
      url: `${BASE_URL}/blog/${post.slug}`,
      lastModified: new Date(post.date).toISOString(),
      changeFrequency: "monthly",
      priority: 0.6,
    }))
  } catch (error) {
    // /blog itself is already in STATIC_ROUTES, so a failure here costs us the
    // individual posts but never the index.
    console.error("Failed to fetch blog posts for sitemap:", error)
  }

  return [...staticPages, ...cityPagesSitemap, ...cateringPagesSitemap, ...occasionPagesSitemap, ...blogPostsSitemap]
}
