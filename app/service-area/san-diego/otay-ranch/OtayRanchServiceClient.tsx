"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function OtayRanchServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Otay Ranch"
      region="San Diego County"
      description="Innovation meets authentic Japanese tradition - hibachi at home experiences in San Diego's newest community where innovation meets family values in modern celebrations."
      zipCodes={["91913", "91914"]}
      neighborhoods={["Otay Ranch Village", "Rolling Hills", "Millenia", "Santa Fe Hills"]}
      popularVenues={["New Home Communities", "Shopping Centers", "Family Properties", "Planned Developments"]}
      cityHighlights={[
        "Newest master-planned community in South Bay",
        "State-of-the-art amenities and facilities",
        "Diverse housing options for all families",
        "Growing retail and entertainment options"
      ]}
      storyContent="Tech startup founder Miguel had chosen Otay Ranch for his growing family, attracted by the innovation and opportunity it represented. When his company reached a major milestone, he celebrated at his new home with the team that made it possible. Our hibachi chef performed as engineers, designers, and investors gathered around the modern outdoor kitchen. This hibachi at home celebration embodied Otay Ranch's vision - where innovation meets family values in San Diego's newest community."
      nearbyCities={["Chula Vista", "Eastlake", "San Ysidro", "Imperial Beach"]}
    />
  )
}
