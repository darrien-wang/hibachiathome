"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function ImperialBeachServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Imperial Beach"
      region="San Diego County"
      description="Southernmost beach charm meets authentic Japanese tradition - hibachi at home experiences where small-town warmth creates unforgettable celebrations."
      zipCodes={["91932", "91933"]}
      neighborhoods={["Imperial Beach Village", "Seacoast Drive", "Palm Avenue", "Coronado Avenue"]}
      popularVenues={["Beachfront Homes", "Surfside Communities", "Border Field State Park", "Family Residences"]}
      cityHighlights={[
        "Southernmost beach city in California",
        "Famous for world-class surfing and beach culture",
        "Close-knit community with small-town charm",
        "Beautiful pier and waterfront activities"
      ]}
      storyContent="When the Garcia family celebrated their daughter's graduation from UCSD, they wanted something special in their Imperial Beach home steps from the sand. As our hibachi chef set up on their beachside deck, the sound of waves and seagulls created the perfect backdrop. The sunset painted the sky as our chef performed, and three generations gathered around the sizzling grill sharing stories of dreams achieved. This hibachi at home experience captured the laid-back beauty that makes Imperial Beach a hidden gem where families create lasting memories."
      nearbyCities={["Coronado", "Chula Vista", "San Diego", "National City"]}
    />
  )
}
