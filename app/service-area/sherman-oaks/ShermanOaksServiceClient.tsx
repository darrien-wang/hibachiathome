"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function ShermanOaksServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Sherman Oaks"
      region="California"
      description="Sophisticated hibachi dining in upscale Sherman Oaks, bringing elegance to this prestigious Valley community."
      zipCodes={["91403","91423"]}
      neighborhoods={["Ventura Boulevard","Mulholland Drive area","Coldwater Canyon","Beverly Glen"]}
      popularVenues={["Hillside Estates","Modern Condos","Executive Homes","Ventura Boulevard venues"]}
      cityHighlights={["Upscale San Fernando Valley community","Ventura Boulevard shopping and dining district","Beautiful hillside homes with city views","Entertainment industry professionals and families"]}
      storyContent="High in the Sherman Oaks hills with spectacular Valley views, we provided a hibachi at home experience for entertainment industry professionals. Our private chef's theatrical skills impressed directors and producers who appreciate great performance. The hibachi party overlooked the twinkling Valley lights, creating movie-like ambiance. This private birthday hibachi party felt like an exclusive Hollywood Hills gathering."
      nearbyCities={["Studio City","Encino","North Hollywood","Beverly Hills","West Hollywood"]}
    />
  )
}