import type { MetadataRoute } from "next"
import { getBlogPosts } from "@/lib/blog" // Assuming you have a way to get blog posts

const BASE_URL = "https://www.realhibachi.com"

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
    lastModified: new Date().toISOString(),
    changeFrequency:
      route === "" || route === "/hibachi-at-home" || route === "/locations/la-orange-county" ? "daily" : "monthly",
    priority:
      route === "" ? 1.0 : route === "/hibachi-at-home" ? 0.95 : route === "/locations/la-orange-county" ? 0.9 : 0.8,
  }))

  let blogPostsSitemap: MetadataRoute.Sitemap = []
  try {
    const blogPosts = await getBlogPosts() // Fetch your blog posts
    blogPostsSitemap = blogPosts.map((post) => ({
      url: `${BASE_URL}/blog/${post.slug}`,
      lastModified: new Date(post.date).toISOString(),
      changeFrequency: "weekly",
      priority: 0.7,
    }))
  } catch (error) {
    console.error("Failed to fetch blog posts for sitemap:", error)
    // Optionally, you could add a default blog page if posts can't be fetched
    blogPostsSitemap.push({
      url: `${BASE_URL}/blog`,
      lastModified: new Date().toISOString(),
      changeFrequency: "weekly",
      priority: 0.7,
    })
  }

  return [...staticPages, ...blogPostsSitemap]
}
