"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function SouthPasadenaServiceClient() {
  return (
    <CityServiceTemplate
      cityName="South Pasadena"
      region="California"
      description="Quaint community hibachi service in charming South Pasadena, perfect for intimate family gatherings."
      zipCodes={["91030","91031"]}
      neighborhoods={["Mission Street area","Huntington Drive","Fair Oaks","Diamond Avenue"]}
      popularVenues={["Craftsman Homes","Family Residences","Small Community Venues","Historic Properties"]}
      cityHighlights={["Charming small-town atmosphere","Historic Craftsman and Victorian homes","Tree-lined streets and walkable neighborhoods","Strong community spirit and local events"]}
      storyContent="In a charming South Pasadena Craftsman bungalow, we delivered an intimate hibachi at home experience that matched the town's cozy, village-like atmosphere. Our private chef's gentle, family-friendly approach won over multiple generations. The hibachi party felt like a neighborhood tradition, with the warmth and care that South Pasadena is known for. This private birthday hibachi party created the perfect small-town celebration."
      nearbyCities={["Pasadena","Alhambra","Los Angeles","Monterey Park"]}
    />
  )
}