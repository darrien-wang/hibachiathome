"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function BurbankServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Burbank"
      region="California"
      description="Entertainment capital hibachi service in Burbank, bringing showbiz flair to your dining experience."
      zipCodes={["91501","91502","91503","91504","91505","91506"]}
      neighborhoods={["Downtown Burbank","Magnolia Park","Rancho Equestrian","Toluca Lake area"]}
      popularVenues={["Studio Executive Homes","Entertainment Industry Venues","Family Residences","Corporate Studios"]}
      cityHighlights={["Entertainment capital with major studios","Home to Disney, Warner Bros, and other studios","Charming downtown area and family neighborhoods","Rich Hollywood history and film industry heritage"]}
      storyContent="Behind the scenes at a Burbank studio executive's home, we created a hibachi at home experience worthy of a movie set. Our private chef performed for entertainment industry VIPs with the same showmanship as their favorite actors. The hibachi party felt like an exclusive Hollywood event, complete with dramatic flair and perfect timing. This private birthday hibachi party proved that real entertainment happens off-camera too!"
      nearbyCities={["Glendale","North Hollywood","Studio City","Pasadena","Los Angeles"]}
    />
  )
}