import type { MetadataRoute } from "next"
import { getBlogPosts } from "@/lib/blog"
import { cityPages } from "@/config/city-pages"

const BASE_URL = "https://www.realhibachi.com"

// Bump this date whenever page content meaningfully changes. Using
// `new Date()` on every build claims constant freshness, which search
// engines learn to distrust and then ignore lastmod entirely.
const STATIC_PAGES_LAST_UPDATED = "2026-07-02T00:00:00.000Z"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages = [
    "", // Homepage
    "/hibachi-at-home", // Core at-home hibachi service page
    "/locations/la-orange-county", // Los Angeles page - highest priority
    "/menu",
    "/book",
    "/contact",
    "/partner-opportunities",
    "/faq",
    "/gallery",
    "/locations", // Main locations page
    "/privacy-policy",
    "/rentals",
  ].map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified: STATIC_PAGES_LAST_UPDATED,
    changeFrequency:
      route === "" || route === "/hibachi-at-home" || route === "/locations/la-orange-county" ? "weekly" : "monthly",
    priority:
      route === "" ? 1.0 : route === "/hibachi-at-home" ? 0.95 : route === "/locations/la-orange-county" ? 0.9 : 0.8,
  }))

  const cityPagesSitemap: MetadataRoute.Sitemap = cityPages.map((city) => ({
    url: `${BASE_URL}/hibachi-at-home/${city.slug}`,
    lastModified: STATIC_PAGES_LAST_UPDATED,
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
    console.error("Failed to fetch blog posts for sitemap:", error)
    blogPostsSitemap.push({
      url: `${BASE_URL}/blog`,
      lastModified: STATIC_PAGES_LAST_UPDATED,
      changeFrequency: "monthly",
      priority: 0.6,
    })
  }

  return [...staticPages, ...cityPagesSitemap, ...blogPostsSitemap]
}
