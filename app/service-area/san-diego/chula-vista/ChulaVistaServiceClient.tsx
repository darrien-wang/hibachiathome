"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function ChulaVistaServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Chula Vista"
      region="San Diego County"
      description="Family dreams meet authentic Japanese tradition - hibachi at home experiences in master-planned communities where hard work and family values create beautiful celebrations."
      zipCodes={["91909", "91910", "91911", "91913", "91914", "91915"]}
      neighborhoods={["Eastlake", "Otay Ranch", "Rolling Hills Ranch", "Terra Nova", "Rancho del Rey"]}
      popularVenues={["Master-planned Communities", "Family Homes", "Golf Course Properties", "New Developments"]}
      cityHighlights={[
        "Fast-growing family-oriented community",
        "Master-planned neighborhoods with amenities",
        "Excellent schools and parks system",
        "Diverse multicultural population"
      ]}
      storyContent="The Rodriguez family had saved for years to buy their dream home in Eastlake, and when they finally got the keys, they wanted to celebrate with style. Our hibachi chef transformed their new backyard into a stage for joy as extended family gathered to christen the new home. Children laughed at the chef's tricks while grandparents shared stories of their own journey to homeownership. This hibachi at home celebration embodied the American dream that Chula Vista represents - where hard work and family values create beautiful new chapters."
      nearbyCities={["San Diego", "National City", "Imperial Beach", "Bonita"]}
    />
  )
}
