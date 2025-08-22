import type { MetadataRoute } from "next"
import { siteConfig } from "@/config/site"
import { getBlogPosts } from "@/lib/blog" // Assuming you have a way to get blog posts

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || siteConfig.url

// Ensure BASE_URL has protocol and www - simplified logic
const normalizedBaseUrl = `https://www.realhibachi.com`

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

  // Orange County cities for long-tail SEO - all 31 cities
  const ocCityPages = [
    "/service-area/orange-county/irvine",
    "/service-area/orange-county/newport-beach", 
    "/service-area/orange-county/huntington-beach",
    "/service-area/orange-county/costa-mesa",
    "/service-area/orange-county/anaheim",
    "/service-area/orange-county/fullerton",
    "/service-area/orange-county/orange",
    "/service-area/orange-county/santa-ana",
    "/service-area/orange-county/tustin",
    "/service-area/orange-county/mission-viejo",
    "/service-area/orange-county/laguna-beach",
    "/service-area/orange-county/dana-point",
    "/service-area/orange-county/dove-canyon",
    "/service-area/orange-county/fountain-valley",
    "/service-area/orange-county/westminster",
    "/service-area/orange-county/garden-grove",
    "/service-area/orange-county/san-juan-capistrano",
    "/service-area/orange-county/lake-forest",
    "/service-area/orange-county/aliso-viejo",
    "/service-area/orange-county/laguna-hills",
    "/service-area/orange-county/laguna-niguel",
    "/service-area/orange-county/rancho-santa-margarita",
    "/service-area/orange-county/brea",
    "/service-area/orange-county/placentia",
    "/service-area/orange-county/yorba-linda",
    "/service-area/orange-county/cypress",
    "/service-area/orange-county/los-alamitos",
    "/service-area/orange-county/seal-beach",
    "/service-area/orange-county/buena-park",
    "/service-area/orange-county/la-palma",
    "/service-area/orange-county/stanton",
    "/service-area/orange-county/la-habra",
    "/service-area/orange-county/villa-park"
  ]

  // San Diego cities for long-tail SEO
  const sdCityPages = [
    "/service-area/san-diego/san-diego-city",
    "/service-area/san-diego/la-jolla",
    "/service-area/san-diego/del-mar",
    "/service-area/san-diego/encinitas",
    "/service-area/san-diego/carlsbad",
    "/service-area/san-diego/oceanside",
    "/service-area/san-diego/vista",
    "/service-area/san-diego/escondido",
    "/service-area/san-diego/poway",
    "/service-area/san-diego/coronado",
    "/service-area/san-diego/imperial-beach",
    "/service-area/san-diego/chula-vista",
    "/service-area/san-diego/national-city",
    "/service-area/san-diego/bonita",
    "/service-area/san-diego/rancho-bernardo",
    "/service-area/san-diego/mira-mesa",
    "/service-area/san-diego/scripps-ranch",
    "/service-area/san-diego/mission-valley",
    "/service-area/san-diego/hillcrest",
    "/service-area/san-diego/point-loma",
    "/service-area/san-diego/mission-beach",
    "/service-area/san-diego/pacific-beach",
    "/service-area/san-diego/balboa-park",
    "/service-area/san-diego/eastlake",
    "/service-area/san-diego/otay-ranch",
    "/service-area/san-diego/rancho-san-diego",
    "/service-area/san-diego/el-cajon"
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
    ...ocCityPages, // Add all OC city pages
    ...sdCityPages, // Add all San Diego city pages
    "/menu",
    "/book",
    "/faq",
    "/gallery",
    "/estimation",
    "/locations", // Main locations page
    "/privacy-policy",
    "/rentals",
  ].map((route) => ({
    url: `${normalizedBaseUrl}${route}`,
    lastModified: new Date().toISOString(),
    changeFrequency: (route === "" || route === "/locations/la-orange-county" || route === "/service-area" || route.startsWith("/service-area/") ? "daily" : "monthly") as "daily" | "monthly",
    priority: route === "" ? 1.0 : route === "/locations/la-orange-county" ? 0.9 : route === "/service-area" ? 0.85 : route.startsWith("/service-area/") ? 0.75 : 0.7,
  }))

  let blogPostsSitemap: MetadataRoute.Sitemap = []
  try {
    const blogPosts = await getBlogPosts() // Fetch your blog posts
    blogPostsSitemap = blogPosts.map((post) => ({
      url: `${normalizedBaseUrl}/blog/${post.slug}`,
      lastModified: new Date(post.date).toISOString(),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }))
  } catch (error) {
    console.error("Failed to fetch blog posts for sitemap:", error)
    // Optionally, you could add a default blog page if posts can't be fetched
    blogPostsSitemap.push({
      url: `${normalizedBaseUrl}/blog`,
      lastModified: new Date().toISOString(),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })
  }

  return [...staticPages, ...blogPostsSitemap]
}
