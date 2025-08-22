"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function PointLomaServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Point Loma"
      region="San Diego County"
      description="Military heritage meets authentic Japanese tradition - hibachi at home experiences where service and sacrifice meet breathtaking beauty and honor family legacy."
      zipCodes={["92106", "92107"]}
      neighborhoods={["Point Loma Heights", "Loma Portal", "Liberty Station", "Sunset Cliffs"]}
      popularVenues={["Coastal Homes", "Military Housing", "Historic Properties", "Waterfront Venues"]}
      cityHighlights={[
        "Historic peninsula with military heritage",
        "Stunning coastal views and sunset spots",
        "Liberty Station arts and cultural district",
        "Strong military and maritime community"
      ]}
      storyContent="Captain Johnson's retirement from the Navy marked the end of a distinguished 30-year career, and his family wanted to honor his service. At their Point Loma home overlooking the bay where his ships once docked, our hibachi chef created a celebration that matched military precision with culinary artistry. As F-18s flew overhead and the sun set over the Pacific, three generations of military family shared stories of duty, honor, and sacrifice. This hibachi at home experience captured Point Loma's legacy - where service and sacrifice meet breathtaking beauty."
      nearbyCities={["San Diego", "Ocean Beach", "Midway", "Liberty Station"]}
    />
  )
}
