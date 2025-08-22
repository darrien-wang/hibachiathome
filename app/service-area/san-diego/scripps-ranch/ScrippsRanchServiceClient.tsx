"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function ScrippsRanchServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Scripps Ranch"
      region="San Diego County"
      description="Professional sophistication meets authentic Japanese tradition - hibachi at home experiences where achievement and refined living create celebrations of excellence."
      zipCodes={["92131"]}
      neighborhoods={["Scripps Ranch Village", "Miramar Ranch North", "Cypress Canyon", "Scripps Highlands"]}
      popularVenues={["Executive Homes", "Golf Course Properties", "Gated Communities", "Luxury Estates"]}
      cityHighlights={[
        "Prestigious planned community with high property values",
        "Top-rated schools and educational excellence",
        "Beautiful parks and recreational facilities",
        "Strong community involvement and safety"
      ]}
      storyContent="Attorney Sarah's law firm had won a landmark case, and she invited her legal team to celebrate at her Scripps Ranch home. Our hibachi chef set up on the elegant patio as partners, associates, and paralegals gathered to mark this career-defining victory. The theatrical performance and gourmet meal provided the perfect backdrop for toasting success and recognizing everyone's hard work. This hibachi at home celebration reflected Scripps Ranch's sophistication - where professional achievement meets refined living."
      nearbyCities={["Mira Mesa", "Rancho Bernardo", "Poway", "Carmel Valley"]}
    />
  )
}
