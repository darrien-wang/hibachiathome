import type { MetadataRoute } from "next"
import { siteConfig } from "@/config/site"
import { getBlogPosts } from "@/lib/blog" // Assuming you have a way to get blog posts

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || siteConfig.url

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Los Angeles cities for long-tail SEO
  const laCityPages = [
    "/service-area/los-angeles-city",
    "/service-area/beverly-hills",
    "/service-area/west-hollywood",
    "/service-area/santa-monica",
    "/service-area/venice",
    "/service-area/culver-city",
    "/service-area/manhattan-beach",
    "/service-area/hermosa-beach",
    "/service-area/redondo-beach",
    "/service-area/torrance",
    "/service-area/el-segundo",
    "/service-area/burbank",
    "/service-area/glendale",
    "/service-area/pasadena",
    "/service-area/arcadia",
    "/service-area/monrovia",
    "/service-area/san-gabriel",
    "/service-area/alhambra",
    "/service-area/monterey-park",
    "/service-area/south-pasadena",
    "/service-area/sherman-oaks",
    "/service-area/studio-city",
    "/service-area/north-hollywood",
    "/service-area/encino",
    "/service-area/tarzana",
    "/service-area/woodland-hills",
    "/service-area/inglewood",
    "/service-area/hawthorne",
    "/service-area/gardena",
    "/service-area/carson",
    "/service-area/long-beach",
    "/service-area/lakewood",
    "/service-area/downey",
    "/service-area/whittier",
    "/service-area/cerritos",
    "/service-area/norwalk",
    "/service-area/bellflower",
    "/service-area/compton"
  ]

  const staticPages = [
    "", // Homepage
    "/locations/la-orange-county", // Los Angeles page - highest priority
    "/service-area", // Service area page - high priority
    "/service-area/los-angeles", // Los Angeles service area
    "/service-area/orange-county", // Orange County service area
    "/service-area/san-diego", // San Diego service area
    "/service-area/san-bernardino", // San Bernardino service area
    "/service-area/palm-springs", // Palm Springs service area
    "/service-area/riverside", // Riverside service area
    ...laCityPages, // Add all LA city pages
    "/menu",
    "/book",
    "/faq",
    "/gallery",
    "/estimation",
    "/locations", // Main locations page
    "/privacy-policy",
    "/rentals",
  ].map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified: new Date().toISOString(),
    changeFrequency: route === "" || route === "/locations/la-orange-county" || route === "/service-area" || route.startsWith("/service-area/") ? "daily" : "monthly",
    priority: route === "" ? 1.0 : route === "/locations/la-orange-county" ? 0.9 : route === "/service-area" ? 0.85 : route.startsWith("/service-area/") ? 0.75 : 0.7,
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
