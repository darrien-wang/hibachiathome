import type { MetadataRoute } from "next"
import { getBlogPosts } from "@/lib/blog"
import { cityPages, CITY_PAGES_LAST_UPDATED } from "@/config/city-pages"

const BASE_URL = "https://www.realhibachi.com"

// lastmod has to be honest in both directions. Using `new Date()` on every
// build claims constant freshness, which search engines learn to distrust and
// then ignore entirely — but a single frozen constant across the whole site is
// the same lie in reverse, and it was telling Google that pages rewritten this
// week had not moved since July. So: a date per route, edited when that route's
// content actually changes.
const LAST_UPDATED: Record<string, string> = {
  "": "2026-08-27T00:00:00.000Z", // pricing tiers, nav
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

  return [...staticPages, ...cityPagesSitemap, ...blogPostsSitemap]
}
