"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function MiraMesaServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Mira Mesa"
      region="San Diego County"
      description="Academic achievement meets authentic Japanese tradition - hibachi at home experiences where diverse families unite around education, opportunity, and cultural heritage."
      zipCodes={["92126"]}
      neighborhoods={["Mira Mesa Boulevard", "Camino Ruiz", "Black Mountain Ranch", "New Salem"]}
      popularVenues={["Suburban Communities", "Tech Worker Housing", "Family Homes", "Planned Developments"]}
      cityHighlights={[
        "Diverse community with strong Asian-American presence",
        "Excellent schools and educational focus",
        "Tech industry hub with many professionals",
        "Family-oriented neighborhoods and parks"
      ]}
      storyContent="The Chen family's son had just been accepted to MIT, following his parents' journey from Taiwan to achieving the American dream. In their Mira Mesa home, our hibachi chef created a celebration that honored both academic achievement and cultural heritage. As extended family gathered around the sizzling grill, stories were shared in both English and Mandarin about sacrifice, dreams, and the next generation's bright future. This hibachi at home experience embodied Mira Mesa's character - where diverse families unite around education and opportunity."
      nearbyCities={["Rancho Bernardo", "Scripps Ranch", "Poway", "Kearny Mesa"]}
    />
  )
}
