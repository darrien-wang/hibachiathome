"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function WhittierServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Whittier"
      region="California"
      description="Community-centered hibachi service in friendly Whittier, perfect for celebrating life's special moments together."
      zipCodes={["90601","90602","90603","90604","90605","90606","90607","90608"]}
      neighborhoods={["Uptown Whittier","East Whittier","South Whittier","La Mirada border"]}
      popularVenues={["Family Homes","Community Centers","Cultural Centers","Local Event Venues"]}
      cityHighlights={["Historic Quaker heritage and community values","Diverse multicultural neighborhoods","Beautiful hillside areas and parks","Strong community spirit and local traditions"]}
      storyContent="In Whittier's hills with beautiful city views, we created a hibachi at home experience for a multi-generational Hispanic family celebration. Our private chef respectfully blended Japanese techniques with familiar flavors, creating fusion magic. The hibachi party honored both cultural traditions while building new ones. This private birthday hibachi party became a beautiful example of cultural appreciation and family unity."
      nearbyCities={["Downey","Norwalk","La Mirada","Pico Rivera","Santa Fe Springs"]}
    />
  )
}