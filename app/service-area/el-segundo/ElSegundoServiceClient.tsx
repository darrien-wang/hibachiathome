"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function ElSegundoServiceClient() {
  return (
    <CityServiceTemplate
      cityName="El Segundo"
      region="California"
      description="Professional hibachi catering in tech-savvy El Segundo, ideal for corporate and residential events."
      zipCodes={["90245"]}
      neighborhoods={["Downtown El Segundo","Smoky Hollow","Recreation Park","Grand Avenue"]}
      popularVenues={["Tech Company Offices","Corporate Headquarters","Modern Apartments","Event Spaces"]}
      cityHighlights={["Major aerospace and technology hub","Close to LAX airport with business district","Growing tech startup and creative scene","Historic small-town charm with modern amenities"]}
      storyContent="At a tech startup's El Segundo headquarters, we brought hibachi at home innovation to their product launch party. Our private chef amazed the engineering team with precision cooking that matched their attention to detail. The hibachi party created the perfect blend of traditional Japanese artistry and modern Silicon Beach culture. This corporate private birthday hibachi party became their most talked-about company event."
      nearbyCities={["Manhattan Beach","Hawthorne","Torrance","Inglewood","Santa Monica"]}
    />
  )
}