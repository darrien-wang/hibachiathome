"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function WestHollywoodServiceClient() {
  return (
    <CityServiceTemplate
      cityName="West Hollywood"
      region="California"
      description="Contemporary hibachi dining experience in trendy West Hollywood, perfect for stylish gatherings."
      zipCodes={["90069", "90046"]}
      neighborhoods={["West Hollywood", "Sunset Strip", "Design District", "Melrose District"]}
      popularVenues={["Modern Condos", "Loft Spaces", "Rooftop Venues", "Creative Event Spaces"]}
      cityHighlights={[
        "Vibrant nightlife and entertainment scene on Sunset Strip",
        "LGBTQ+ friendly community with inclusive culture", 
        "Trendy restaurants, bars, and creative venues",
        "Art galleries and design district attractions",
        "Central location between Hollywood and Beverly Hills"
      ]}
      storyContent="At a trendy WeHo rooftop with Sunset Strip views, we hosted an unforgettable private birthday hibachi party for Marcus, a local artist. Our hibachi at home service transformed his modern loft into a Japanese steakhouse. The private chef's knife skills impressed the creative crowd, and the egg-catching trick had everyone cheering. This hibachi party perfectly matched West Hollywood's vibrant, artistic energy."
      nearbyCities={["Beverly Hills","Los Angeles","Santa Monica","Culver City","Sherman Oaks"]}
    />
  )
}
