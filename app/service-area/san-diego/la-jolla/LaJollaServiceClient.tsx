"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function LaJollaServiceClient() {
  return (
    <CityServiceTemplate
      cityName="La Jolla"
      region="San Diego County"
      description="Oceanfront elegance meets authentic Japanese tradition - hibachi at home experiences for San Diego's most prestigious coastal community."
      zipCodes={["92037", "92093"]}
      neighborhoods={["La Jolla Village", "La Jolla Shores", "La Jolla Cove", "Mount Soledad", "Torrey Pines"]}
      popularVenues={["Oceanfront Estates", "Luxury Condos", "Golf Course Communities", "Clifftop Homes"]}
      cityHighlights={[
        "Prestigious coastal community with stunning ocean views",
        "World-class shopping and dining in La Jolla Village",
        "Beautiful beaches and upscale residential areas",
        "Home to UC San Diego and Scripps Institution"
      ]}
      storyContent="Dr. Jennifer's research team had just published breakthrough findings that would change medicine forever. Instead of the usual conference room celebration, she invited her colleagues to her La Jolla home overlooking the Pacific. Our hibachi chef arrived as the sun painted the sky orange and pink. Between the chef's skillful tricks and the stunning ocean backdrop, conversations flowed from scientific discoveries to personal dreams. This hibachi at home experience perfectly captured the elegance and innovation that defines La Jolla - where world-changing ideas meet California coastal luxury."
      nearbyCities={["San Diego", "Del Mar", "Pacific Beach", "Torrey Pines"]}
    />
  )
}

