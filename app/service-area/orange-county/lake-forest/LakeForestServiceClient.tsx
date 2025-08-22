"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function LakeForestServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Lake Forest"
      region="Orange County"
      description="Where meaningful moments deserve extraordinary celebrations - hibachi at home experiences that create lasting memories in Orange County's lake forest community."
      zipCodes={[]}
      neighborhoods={[]}
      popularVenues={["Private Homes","Community Centers","Event Venues","Family Residences"]}
      cityHighlights={["Beautiful Orange County community","Family-friendly neighborhoods","Diverse local culture","Great dining and entertainment"]}
      storyContent="After years of fertility struggles, Jennifer and Mark had finally welcomed their adopted baby girl. The first birthday wasn't just about cake and presents - it was about celebrating the miracle of family that forms through love, not just biology. They wanted extended family to understand this wasn't a consolation prize; this was their dream come true. The hibachi at home experience in their Lake Forest home became a celebration of chosen family. As our chef performed, relatives who'd been tiptoeing around the subject of adoption found themselves genuinely enchanted by the one-year-old's giggles at the flames. When the chef presented the birthday girl with her own tiny portion of fried rice, shaped like a heart, her grandfather whispered, 'she's perfect.' This private birthday hibachi party didn't just mark a first birthday - it was the moment a baby became everyone's granddaughter, niece, and beloved family member without qualification."
      nearbyCities={["Mission Viejo","Irvine","Tustin","Aliso Viejo","Laguna Hills"]}
    />
  )
}