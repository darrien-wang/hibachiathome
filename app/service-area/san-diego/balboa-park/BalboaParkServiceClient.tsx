"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function BalboaParkServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Balboa Park"
      region="San Diego County"
      description="Cultural sophistication meets authentic Japanese tradition - hibachi at home experiences where culture and community create lasting experiences in San Diego's cultural heart."
      zipCodes={["92101", "92103"]}
      neighborhoods={["Park West", "Golden Hill", "Bankers Hill", "East Village"]}
      popularVenues={["Historic Homes", "Park Adjacent Properties", "Cultural District", "Museum Area"]}
      cityHighlights={[
        "Cultural heart of San Diego with world-class museums",
        "Historic architecture and beautiful gardens",
        "Central location near downtown",
        "Rich arts and cultural community"
      ]}
      storyContent="Museum curator Rebecca had just opened a groundbreaking new exhibition, and she wanted to celebrate with the cultural community that made it possible. At her historic home near the park, our hibachi chef created an evening where art met culinary performance. As artists, donors, and museum staff gathered around the grill, conversations flowed from creative inspiration to cultural impact. This hibachi at home celebration reflected Balboa Park's mission - where culture and community create lasting experiences."
      nearbyCities={["San Diego", "Hillcrest", "Golden Hill", "Bankers Hill"]}
    />
  )
}
