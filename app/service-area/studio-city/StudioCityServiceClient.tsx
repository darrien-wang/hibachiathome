"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function StudioCityServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Studio City"
      region="California"
      description="Creative hibachi experiences in entertainment-focused Studio City, perfect for industry professionals."
      zipCodes={["91604","91614"]}
      neighborhoods={["Ventura Boulevard","Laurel Canyon","Colfax Meadows","Woodbridge Park"]}
      popularVenues={["Entertainment Industry Homes","Creative Spaces","Studio Executive Residences","Industry Venues"]}
      cityHighlights={["Heart of the entertainment industry","Home to many film and TV studios","Trendy restaurants and creative venues","Arts district with galleries and theaters"]}
      storyContent="At a Studio City creative's home near the studios, we brought hibachi at home artistry to a gathering of writers and actors. Our private chef's improvisational cooking style resonated with the creative crowd's spontaneous energy. The hibachi party became an inspiring artistic collaboration, with guests suggesting flavor combinations. This private birthday hibachi party proved that creativity enhances every aspect of dining."
      nearbyCities={["Sherman Oaks","North Hollywood","Encino","Burbank","Universal City"]}
    />
  )
}