"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function LosAngelesCityServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Los Angeles"
      region="California"
      description="Experience premium hibachi at home service in downtown Los Angeles and surrounding areas."
      zipCodes={["90012", "90013", "90014", "90015", "90017", "90028", "90036", "90038", "90048", "90068"]}
      neighborhoods={["Downtown", "Hollywood", "Mid-City", "Koreatown", "Los Feliz", "Silver Lake"]}
      popularVenues={["Private Residences", "Event Halls", "Corporate Venues", "Rooftop Spaces"]}
      cityHighlights={[
        "Major business and financial center of the West Coast",
        "Home to Hollywood entertainment industry", 
        "Diverse cultural neighborhoods and communities",
        "Iconic downtown skyline and urban attractions",
        "Rich history and vibrant arts scene"
      ]}
      storyContent="Last month, we brought our hibachi at home experience to a stunning downtown LA penthouse for Sarah's 30th birthday hibachi party. With the city lights twinkling below, our private chef performed amazing teppanyaki tricks while cooking fresh steak and shrimp. The birthday girl was amazed when our chef created the famous onion volcano right in her living room! This private birthday hibachi party became the talk of her Hollywood friends."
      nearbyCities={["Beverly Hills","West Hollywood","Santa Monica","Culver City","Burbank","Glendale","Pasadena"]}
    />
  )
}
