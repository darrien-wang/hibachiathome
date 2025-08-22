"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function InglewoodServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Inglewood"
      region="California"
      description="Community-focused hibachi service in vibrant Inglewood, bringing authentic flavors to this diverse neighborhood."
      zipCodes={["90301","90302","90303","90304","90305","90306","90308","90309","90311"]}
      neighborhoods={["Downtown Inglewood","Morningside Park","Fairview Heights","Centinela Heights"]}
      popularVenues={["Community Centers","Family Homes","Cultural Venues","Sports-related venues"]}
      cityHighlights={["Diverse urban community with rich culture","Home to SoFi Stadium and major sports venues","Growing arts and entertainment scene","Historic neighborhoods with community pride"]}
      storyContent="Near the excitement of SoFi Stadium, we brought hibachi at home energy to an Inglewood sports celebration. Our private chef's dynamic cooking style matched the community's athletic spirit and enthusiasm. The hibachi party guests cheered for cooking tricks like they were at a Lakers game! This private birthday hibachi party captured Inglewood's vibrant community pride and love for spectacular entertainment."
      nearbyCities={["Hawthorne","El Segundo","Los Angeles","Culver City"]}
    />
  )
}