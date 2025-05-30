import type { MetadataRoute } from "next"
import { siteConfig } from "@/config/site"
import { getBlogPosts } from "@/lib/blog" // Assuming you have a way to get blog posts

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || siteConfig.url

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages = [
    "", // Homepage
    "/menu",
    "/gallery",
    "/faq",
    "/contact",
    "/book",
    "/estimation",
    "/locations/nyc-long-island", // Updated from pensacola
    "/privacy-policy",
    "/rentals",
  ].map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified: new Date().toISOString(),
    changeFrequency: route === "" ? "daily" : "monthly", // Homepage might change more often
    priority: route === "" ? 1.0 : 0.8,
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
