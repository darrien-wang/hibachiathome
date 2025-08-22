"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function EncinitasServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Encinitas"
      region="San Diego County"
      description="Laid-back surf culture meets authentic Japanese tradition - hibachi at home experiences where endless summer vibes create unforgettable celebrations."
      zipCodes={["92023", "92024"]}
      neighborhoods={["Downtown Encinitas", "Leucadia", "Cardiff", "Olivenhain"]}
      popularVenues={["Surf Town Homes", "Garden Communities", "Beachside Condos", "Hillside Estates"]}
      cityHighlights={[
        "Laid-back surf culture with beautiful beaches",
        "Thriving arts scene and yoga community", 
        "Famous flower fields and botanical gardens",
        "Charming downtown with unique shops and cafes"
      ]}
      storyContent="Jake's surf shop was celebrating 10 years in business, and he wanted to thank his loyal customers with something unforgettable. Instead of renting a venue, he hosted a hibachi at home party at his Encinitas home overlooking Swami's Beach. As our chef performed with the sunset painting the sky, surfers paddled out for evening sessions below. The combination of Japanese culinary artistry and California surf culture created pure magic. This celebration perfectly embodied Encinitas' spirit - where authentic traditions meet endless summer vibes."
      nearbyCities={["Del Mar", "Carlsbad", "Solana Beach", "Rancho Santa Fe"]}
    />
  )
}

