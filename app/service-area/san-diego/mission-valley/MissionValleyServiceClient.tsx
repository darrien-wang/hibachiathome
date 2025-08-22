"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function MissionValleyServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Mission Valley"
      region="San Diego County"
      description="Urban convenience meets authentic Japanese tradition - hibachi at home experiences where dynamic energy and academic excellence create celebrations of achievement."
      zipCodes={["92108", "92119", "92120"]}
      neighborhoods={["Mission Valley East", "Mission Valley West", "Grantville", "Allied Gardens"]}
      popularVenues={["Urban Condos", "Transit-Oriented Housing", "Shopping Centers", "Business Districts"]}
      cityHighlights={[
        "Central location with excellent transit access",
        "Major shopping and entertainment district",
        "Mix of urban living and suburban comfort",
        "Home to SDSU and major employers"
      ]}
      storyContent="When SDSU professor Elena received tenure, her colleagues wanted to celebrate this major milestone. At her Mission Valley condo near campus, our hibachi chef created an intimate celebration for the faculty who had supported her journey. As the trolley passed by and the city lights twinkled, conversations flowed from academic achievements to future research plans. This hibachi at home experience captured Mission Valley's dynamic energy - where urban convenience meets academic excellence."
      nearbyCities={["San Diego", "Hillcrest", "Grantville", "Serra Mesa"]}
    />
  )
}
