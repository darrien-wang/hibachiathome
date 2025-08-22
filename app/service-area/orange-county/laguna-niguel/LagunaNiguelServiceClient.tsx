"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function LagunaNiguelServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Laguna Niguel"
      region="Orange County"
      description="Where meaningful moments deserve extraordinary celebrations - hibachi at home experiences that create lasting memories in Orange County's laguna niguel community."
      zipCodes={[]}
      neighborhoods={[]}
      popularVenues={["Private Homes","Community Centers","Event Venues","Family Residences"]}
      cityHighlights={["Beautiful Orange County community","Family-friendly neighborhoods","Diverse local culture","Great dining and entertainment"]}
      storyContent="After surviving breast cancer, Amy didn't want a 'cancer-free' party - she wanted a 'life is beautiful' celebration. She'd spent a year focused on fighting, and now she wanted to remember how to live with joy again. Her family understood this wasn't about congratulations; it was about reclaiming celebration itself. The hibachi at home experience in their Laguna Niguel home became her reintroduction to wonder. As our chef performed, Amy found herself gasping at tricks, laughing at jokes, feeling genuinely present for the first time in months. When the chef dedicated a special flame display to 'new beginnings,' she felt something shift inside her heart. This wasn't just about surviving cancer - it was about choosing to thrive, to be amazed, to believe that her best chapters might still be unwritten. Sometimes healing isn't just physical; it's remembering that life is worth celebrating."
      nearbyCities={["Dana Point","Aliso Viejo","Laguna Hills","San Juan Capistrano","Laguna Beach"]}
    />
  )
}