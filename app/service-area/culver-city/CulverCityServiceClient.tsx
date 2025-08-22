"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function CulverCityServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Culver City"
      region="California"
      description="Professional hibachi service in the heart of Culver City, perfect for entertainment industry events."
      zipCodes={["90230","90232"]}
      neighborhoods={["Downtown Culver City","Fox Hills","Hayden Tract","Culver West"]}
      popularVenues={["Studio Lots","Production Offices","Modern Apartments","Corporate Facilities"]}
      cityHighlights={["Major entertainment industry studios and production facilities","Growing culinary scene and food culture","Historic downtown area with modern developments","Tech and creative industry hub"]}
      storyContent="At a Culver City film studio executive's home, we provided a hibachi at home experience that felt like a movie premiere. Our private chef entertained industry professionals with dazzling teppanyaki skills between studio lots. The hibachi party became the perfect networking event, with the birthday girl's colleagues raving about this unique private birthday hibachi party concept. Hollywood magic meets Japanese culinary artistry!"
      nearbyCities={["Santa Monica","Venice","Beverly Hills","West Hollywood","Manhattan Beach"]}
    />
  )
}