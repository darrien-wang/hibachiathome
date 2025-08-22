"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function BuenaParkServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Buena Park"
      region="Orange County"
      description="Where meaningful moments deserve extraordinary celebrations - hibachi at home experiences that create lasting memories in Orange County's buena park community."
      zipCodes={[]}
      neighborhoods={[]}
      popularVenues={["Private Homes","Community Centers","Event Venues","Family Residences"]}
      cityHighlights={["Beautiful Orange County community","Family-friendly neighborhoods","Diverse local culture","Great dining and entertainment"]}
      storyContent="When auto mechanic Roberto's son graduated from medical school, the family struggled with how to honor an achievement that seemed to bridge two different worlds. Roberto worked with his hands, lived paycheck to paycheck, and wondered if his college-educated son would still value the lessons of hard work and humility. The hibachi at home experience in their Buena Park home became a celebration that honored both their past and future. As our chef performed, the conversation flowed between Roberto's practical wisdom and his son's medical knowledge, both men realizing they shared the same core values of service and dedication. When the chef presented the new doctor with his meal and asked Roberto to share advice for his son, his words about integrity and compassion resonated with everyone present. This private graduation hibachi party didn't just celebrate an individual achievement - it honored the family foundation that made it possible."
      nearbyCities={["Anaheim","Fullerton","Cypress","La Palma","Stanton"]}
    />
  )
}