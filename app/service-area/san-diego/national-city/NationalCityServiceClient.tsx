"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function NationalCityServiceClient() {
  return (
    <CityServiceTemplate
      cityName="National City"
      region="San Diego County"
      description="Cultural heritage meets authentic Japanese tradition - hibachi at home experiences where diverse traditions blend to create something beautiful and uniquely American."
      zipCodes={["91950", "91951"]}
      neighborhoods={["Downtown National City", "Lincoln Acres", "Paradise Hills", "Sweetwater"]}
      popularVenues={["Historic Homes", "Community Centers", "Family Neighborhoods", "Cultural Venues"]}
      cityHighlights={[
        "Rich cultural heritage and diversity",
        "Historic downtown with revitalization projects",
        "Strong sense of community pride",
        "Affordable family-friendly neighborhoods"
      ]}
      storyContent="Maria's quinceañera was more than a birthday - it was a celebration of heritage and community in National City. In their family home where three generations had lived, our hibachi chef created a unique fusion of cultures. As the theatrical Japanese cooking met the festive quinceañera tradition, neighbors and family from both sides of the border gathered around the grill. This hibachi at home experience perfectly captured National City's spirit - where diverse traditions blend to create something beautiful and uniquely American."
      nearbyCities={["Chula Vista", "San Diego", "Coronado", "Imperial Beach"]}
    />
  )
}
