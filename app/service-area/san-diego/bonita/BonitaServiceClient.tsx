"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function BonitaServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Bonita"
      region="San Diego County"
      description="Peaceful suburban charm meets authentic Japanese tradition - hibachi at home experiences in a retreat where relationships flourish and hard work is celebrated."
      zipCodes={["91902", "91905"]}
      neighborhoods={["Bonita Village", "Sunnyside", "Sweetwater Heights", "Casa de Oro"]}
      popularVenues={["Suburban Homes", "Golf Communities", "Family Properties", "Hillside Estates"]}
      cityHighlights={[
        "Peaceful suburban community with small-town feel",
        "Beautiful views and rolling hills",
        "Close to nature and outdoor recreation",
        "Family-friendly neighborhoods and schools"
      ]}
      storyContent="Dr. Kim's medical practice had thrived for 20 years, and she wanted to thank her devoted staff with something special at her Bonita home. Our hibachi chef set up in her backyard overlooking the rolling hills as nurses, receptionists, and fellow doctors gathered after a long day of caring for others. The peaceful setting and entertaining performance provided the perfect way to unwind and connect. This hibachi at home experience reflected Bonita's character - a peaceful retreat where relationships flourish and hard work is celebrated."
      nearbyCities={["Chula Vista", "National City", "La Mesa", "El Cajon"]}
    />
  )
}
