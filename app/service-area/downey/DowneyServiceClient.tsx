"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function DowneyServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Downey"
      region="California"
      description="Traditional community hibachi service in historic Downey, combining small-town charm with authentic cuisine."
      zipCodes={["90239","90240","90241","90242"]}
      neighborhoods={["Downtown Downey","North Downey","South Downey","Norwalk border"]}
      popularVenues={["Historic Homes","Community Centers","Family Residences","Cultural Venues"]}
      cityHighlights={["Historic community with small-town charm","Rich aerospace and manufacturing heritage","Beautiful downtown area with local businesses","Family-friendly neighborhoods and community events"]}
      storyContent="At a historic Downey home with aerospace heritage, we brought hibachi at home innovation to a community proud of its contributions to space exploration. Our private chef's technical precision impressed guests who appreciate engineering excellence. The hibachi party celebrated both tradition and progress, values that define Downey. This private birthday hibachi party honored the city's legacy while creating new memories."
      nearbyCities={["Norwalk","Bellflower","Whittier","Pico Rivera","Bell Gardens"]}
    />
  )
}