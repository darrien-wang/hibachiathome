"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function PowayServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Poway"
      region="San Diego County"
      description="Academic excellence meets authentic Japanese tradition - hibachi at home experiences that honor family achievement and heritage in the City of Trees."
      zipCodes={["92064", "92074"]}
      neighborhoods={["Old Poway", "Stoneridge", "Torrey Highlands", "4S Ranch", "Poway Valley"]}
      popularVenues={["Family Homes", "Master-planned Communities", "Ranch Properties", "Suburban Neighborhoods"]}
      cityHighlights={[
        "Family-oriented community with excellent schools",
        "Beautiful rural setting with modern amenities", 
        "Strong sense of community and local pride",
        "Close to nature with hiking trails and parks"
      ]}
      storyContent="The Chen family's youngest son had just graduated valedictorian, following in his older siblings' footsteps of academic excellence. They wanted a celebration that honored not just this achievement, but their family's journey from Taiwan to Poway. Our hibachi chef performed in their backyard while grandparents shared stories of immigration and dreams fulfilled. The precision and artistry of teppanyaki reminded everyone of their heritage, while the warm Poway evening represented their American home. This hibachi at home experience perfectly captured the blend of tradition and achievement that defines Poway families."
      nearbyCities={["Escondido", "Rancho Bernardo", "Scripps Ranch", "Mira Mesa"]}
    />
  )
}

