"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function LongBeachServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Long Beach"
      region="California"
      description="Coastal hibachi excellence in Long Beach, bringing oceanside dining experiences to this vibrant port city."
      zipCodes={["90801", "90802", "90803", "90804", "90805", "90806", "90807", "90808", "90810", "90813", "90814", "90815"]}
      neighborhoods={["Downtown Long Beach", "Belmont Shore", "Naples", "Bixby Knolls", "California Heights"]}
      popularVenues={["Waterfront Properties", "Downtown Venues", "Beach Houses", "Port-area Corporate Venues"]}
      cityHighlights={[
        "Major port city with beautiful waterfront views",
        "Historic Queen Mary ship and maritime attractions", 
        "Diverse communities and cultural neighborhoods",
        "Belmont Shore beachfront dining and shopping",
        "Vibrant downtown area with entertainment venues"
      ]}
      storyContent="At a Long Beach waterfront home with harbor views, we brought hibachi at home excitement to a port city celebration. Our private chef prepared fresh seafood while ships passed in the distance, creating a unique maritime dining experience. The hibachi party guests enjoyed the coastal atmosphere and spectacular cooking performance. This private birthday hibachi party captured Long Beach's dynamic blend of urban energy and coastal charm."
      nearbyCities={["Carson","Lakewood","Signal Hill","Seal Beach","Torrance"]}
    />
  )
}
