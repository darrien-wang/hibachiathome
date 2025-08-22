"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function CoronadoServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Coronado"
      region="San Diego County"
      description="Island elegance meets authentic Japanese tradition - hibachi at home experiences in America's most beautiful seaside community where every celebration feels royal."
      zipCodes={["92118", "92178"]}
      neighborhoods={["Coronado Village", "Coronado Shores", "The Strand", "Glorietta Bay", "Naval Air Station"]}
      popularVenues={["Beachfront Condos", "Historic Homes", "Military Housing", "Luxury Resorts"]}
      cityHighlights={[
        "Prestigious island community with pristine beaches",
        "Historic Hotel del Coronado and royal heritage",
        "Strong military presence with Naval Air Station",
        "Charming small-town feel with resort amenities"
      ]}
      storyContent="Admiral Peterson's retirement ceremony was complete, but his family wanted an intimate celebration that honored 30 years of naval service. In their Coronado home overlooking the bay where his aircraft carrier was docked, our hibachi chef created a performance that matched military precision with culinary artistry. As F-18s flew overhead and waves lapped the shore, three generations of military family gathered around the hibachi grill. This celebration perfectly embodied Coronado's unique character - where military honor meets resort elegance in America's most beautiful seaside community."
      nearbyCities={["San Diego", "Imperial Beach", "Chula Vista", "National City"]}
    />
  )
}

