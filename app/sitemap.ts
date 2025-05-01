import type { MetadataRoute } from "next"

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://hibachi-at-home.example.com"

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
    },
    {
      url: `${baseUrl}/book`,
      lastModified: new Date(),
    },
    {
      url: `${baseUrl}/locations`,
      lastModified: new Date(),
    },
    {
      url: `${baseUrl}/menu`,
      lastModified: new Date(),
    },
    {
      url: `${baseUrl}/gallery`,
      lastModified: new Date(),
    },
    {
      url: `${baseUrl}/faq`,
      lastModified: new Date(),
    },
    {
      url: `${baseUrl}/rentals`,
      lastModified: new Date(),
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date(),
    },
  ]
}
