"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function GardenaServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Gardena"
      region="California"
      description="Multicultural hibachi experience in diverse Gardena, celebrating the area's Japanese heritage and modern diversity."
      zipCodes={["90247","90248","90249"]}
      neighborhoods={["Downtown Gardena","Strawberry Park","Alondra Park area","Harbor Gateway"]}
      popularVenues={["Cultural Centers","Japanese Community Venues","Family Homes","Community Gathering Spaces"]}
      cityHighlights={["Large Japanese-American community","Rich cultural heritage and authentic cuisine","Family-oriented residential neighborhoods","Cultural festivals and community events"]}
      storyContent="At a Gardena family gathering celebrating Japanese-American heritage, we brought authentic hibachi at home traditions to a community with deep cultural roots. Our private chef honored both traditional techniques and modern California influences. The hibachi party became a beautiful cultural celebration, connecting generations through food and storytelling. This private birthday hibachi party honored Gardena's rich Japanese-American legacy."
      nearbyCities={["Torrance","Carson","Hawthorne","Compton","Los Angeles"]}
    />
  )
}