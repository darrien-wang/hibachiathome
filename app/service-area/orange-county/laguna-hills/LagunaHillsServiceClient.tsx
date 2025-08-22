"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function LagunaHillsServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Laguna Hills"
      region="Orange County"
      description="Where meaningful moments deserve extraordinary celebrations - hibachi at home experiences that create lasting memories in Orange County's laguna hills community."
      zipCodes={[]}
      neighborhoods={[]}
      popularVenues={["Private Homes","Community Centers","Event Venues","Family Residences"]}
      cityHighlights={["Beautiful Orange County community","Family-friendly neighborhoods","Diverse local culture","Great dining and entertainment"]}
      storyContent="When grandmother Rose started showing signs of memory loss, her family knew they were racing against time to create lasting memories while she could still participate. Her 85th birthday needed to be more than a dinner - it needed to be an experience that would anchor itself in whatever remained of her fading memory. The hibachi at home experience in their Laguna Hills home became a sensory celebration designed to reach her through sight, sound, and smell. As our chef performed, Rose became more animated than she'd been in months. The sizzling sounds, the dramatic flames, the interactive nature of the cooking seemed to awaken something in her. When she clapped and laughed at the egg-catching trick, her children saw glimpses of their vibrant mother shining through. This private birthday hibachi party didn't just honor her past - it gave her family hope that love could transcend even the cruelest diseases."
      nearbyCities={["Aliso Viejo","Lake Forest","Mission Viejo","Irvine"]}
    />
  )
}