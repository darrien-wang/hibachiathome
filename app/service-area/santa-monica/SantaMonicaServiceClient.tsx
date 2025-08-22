"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function SantaMonicaServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Santa Monica"
      region="California"
      description="Beachside hibachi at home service in Santa Monica, combining ocean vibes with authentic Japanese cuisine."
      zipCodes={["90401", "90402", "90403", "90404", "90405"]}
      neighborhoods={["Santa Monica Pier", "Third Street Promenade", "Main Street", "Pico Boulevard", "Ocean Park"]}
      popularVenues={["Beachfront Properties", "High-rise Condos", "Beach Houses", "Ocean View Venues"]}
      cityHighlights={[
        "Beautiful Pacific Ocean beaches and coastline",
        "Famous Santa Monica Pier with amusement park", 
        "Third Street Promenade shopping and dining",
        "Year-round mild climate perfect for outdoor events",
        "Vibrant beachfront culture and lifestyle"
      ]}
      storyContent="Picture this: a hibachi at home experience on a Santa Monica beachfront deck with ocean waves in the background. For Jessica's graduation celebration, our private chef created magic with fresh seafood while seagulls watched curiously. The hibachi party guests enjoyed teppanyaki-style salmon and shrimp as the Pacific sunset painted the sky. This private birthday hibachi party became a perfect California dream memory."
      nearbyCities={["Venice","West Hollywood","Beverly Hills","Culver City","Manhattan Beach"]}
    />
  )
}
