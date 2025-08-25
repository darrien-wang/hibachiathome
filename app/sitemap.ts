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
    "/service-area/compton",
    "/service-area/san-pedro"
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

  // San Diego cities (Tier 1 + Tier 2 optimized)
  const sdCityPages = [
    // Tier 1: Premium coastal cities
    "/service-area/san-diego/san-diego-city",
    "/service-area/san-diego/la-jolla", 
    "/service-area/san-diego/del-mar",
    "/service-area/san-diego/carlsbad",
    // Tier 2: Strong secondary markets
    "/service-area/san-diego/encinitas",
    "/service-area/san-diego/oceanside",
    "/service-area/san-diego/chula-vista",
    "/service-area/san-diego/coronado",
    "/service-area/san-diego/mission-beach",
    "/service-area/san-diego/pacific-beach"
  ]

  // San Bernardino cities (Tier 1 + Tier 2 + Resort destinations)
  const sbCityPages = [
    // Tier 1: Major inland empire cities
    "/service-area/san-bernardino/san-bernardino-city",
    "/service-area/san-bernardino/rancho-cucamonga",
    "/service-area/san-bernardino/ontario",
    // Tier 2: Secondary markets with good potential
    "/service-area/san-bernardino/redlands",
    "/service-area/san-bernardino/fontana",
    "/service-area/san-bernardino/chino",
    "/service-area/san-bernardino/chino-hills",
    // Resort destinations (always included)
    "/service-area/san-bernardino/big-bear-lake",
    "/service-area/san-bernardino/lake-arrowhead"
  ]

  // Riverside cities (Tier 1 + Tier 2 + Resort destinations)  
  const riversideCityPages = [
    // Tier 1: Major riverside county cities
    "/service-area/riverside/riverside-city",
    "/service-area/riverside/corona",
    "/service-area/riverside/temecula",
    // Tier 2: Secondary markets with good potential
    "/service-area/riverside/moreno-valley",
    "/service-area/riverside/murrieta",
    // Resort/Arts destinations (always included)
    "/service-area/riverside/idyllwild"
  ]

  // Palm Springs cities (Tier 1 + Tier 2 + Resort destinations)
  const psCityPages = [
    // Tier 1: Premium desert resort destinations
    "/service-area/palm-springs/palm-springs-city",
    "/service-area/palm-springs/palm-desert", 
    "/service-area/palm-springs/rancho-mirage",
    // Tier 2: Secondary markets with good potential
    "/service-area/palm-springs/cathedral-city",
    "/service-area/palm-springs/indian-wells",
    "/service-area/palm-springs/la-quinta",
    "/service-area/palm-springs/indio",
    "/service-area/palm-springs/coachella",
    // Resort/Spa destinations (always included)
    "/service-area/palm-springs/desert-hot-springs"
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
    ...sbCityPages, // Add all San Bernardino city pages
    ...riversideCityPages, // Add all Riverside city pages
    ...psCityPages, // Add all Palm Springs city pages
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
