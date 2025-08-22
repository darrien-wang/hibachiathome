"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function RanchoBernardoServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Rancho Bernardo"
      region="San Diego County"
      description="Executive excellence meets authentic Japanese tradition - hibachi at home experiences where innovation and precision create celebrations worthy of success."
      zipCodes={["92127", "92128"]}
      neighborhoods={["Bernardo Heights", "Westwood", "Oaks North", "Glassman"]}
      popularVenues={["Golf Course Communities", "Executive Homes", "Country Club Properties", "Planned Communities"]}
      cityHighlights={[
        "Upscale master-planned community",
        "Beautiful golf courses and country clubs",
        "Excellent schools and family amenities",
        "Corporate headquarters and business parks"
      ]}
      storyContent="When tech executive David's startup got acquired, he wanted to celebrate with his team at his Rancho Bernardo home overlooking the golf course. Our hibachi chef performed as software engineers, designers, and investors gathered around the grill sharing stories of late nights and breakthrough moments. The precision of teppanyaki cooking reminded everyone of the attention to detail that made their success possible. This hibachi at home celebration captured the innovation and excellence that defines Rancho Bernardo."
      nearbyCities={["Poway", "Escondido", "Mira Mesa", "Scripps Ranch"]}
    />
  )
}
