"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function ComptonServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Compton"
      region="California"
      description="Community-focused hibachi service in historic Compton, bringing cultural appreciation through authentic dining experiences."
      zipCodes={["90220","90221","90222","90223","90224"]}
      neighborhoods={["Downtown Compton","East Compton","West Compton","Lynwood border"]}
      popularVenues={["Community Centers","Cultural Venues","Family Homes","Local Event Spaces"]}
      cityHighlights={["Historic community with rich cultural heritage","Diverse urban neighborhoods","Strong community pride and resilience","Growing arts and music scene"]}
      storyContent="At a Compton community celebration, we brought hibachi at home pride to a neighborhood known for resilience and creativity. Our private chef's energetic performance style matched the community's dynamic spirit and cultural richness. The hibachi party became an uplifting celebration of good food, family, and community strength. This private birthday hibachi party honored Compton's legacy while creating positive new memories for all generations."
      nearbyCities={["Carson","Gardena"]}
    />
  )
}