"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function SanPedroServiceClient() {
  return (
    <CityServiceTemplate
      cityName="San Pedro"
      region="Los Angeles County"
      description="Historic port community hibachi service in San Pedro, bringing authentic Japanese cuisine to LA's maritime district."
      zipCodes={["90731", "90732"]}
      neighborhoods={["Downtown San Pedro", "Cabrillo Beach", "Ports O' Call", "Angel's Gate", "Rancho San Pedro"]}
      popularVenues={["Harbor View Homes", "Historic Properties", "Waterfront Venues", "Community Centers"]}
      cityHighlights={[
        "Historic Port of Los Angeles and maritime heritage",
        "Beautiful Cabrillo Beach and coastal recreation", 
        "Rich fishing and shipping industry culture",
        "Growing arts district and community revitalization",
        "Gateway to Catalina Island ferry services"
      ]}
      storyContent="When Captain Rodriguez retired after 30 years navigating container ships through the Port of Los Angeles, his family wanted to honor his maritime career with a celebration at their San Pedro home overlooking the harbor. Our hibachi chef set up on their waterfront deck as the setting sun painted the port cranes golden. As three generations of longshoremen, sailors, and port workers gathered around the grill, stories flowed about the ships, the sea, and the hardworking community that keeps America's busiest port running. This hibachi at home experience captured San Pedro's soul - where maritime tradition meets family celebration, and the harbor's rhythm becomes the heartbeat of home."
      nearbyCities={["Long Beach", "Torrance", "Carson", "Wilmington"]}
    />
  )
}










