"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function RedondoBeachServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Redondo Beach"
      region="California"
      description="Relaxed hibachi dining experience in family-friendly Redondo Beach with coastal charm."
      zipCodes={["90277","90278"]}
      neighborhoods={["Redondo Pier","Riviera Village","Hollywood Riviera","South Redondo"]}
      popularVenues={["Family Homes","Beach Properties","Community Centers","Pier-area Venues"]}
      cityHighlights={["Family-friendly coastal community","Historic pier with restaurants and attractions","Beautiful beaches perfect for swimming and fishing","Charming seaside neighborhoods"]}
      storyContent="At a charming family home near Redondo Pier, three generations gathered for grandma's 80th hibachi at home celebration. Our private chef delighted everyone from toddlers to grandparents with gentle tricks and delicious food. The hibachi party brought the whole family together, creating precious memories. This private birthday hibachi party proved that our service creates magic for all ages in family-friendly Redondo Beach."
      nearbyCities={["Manhattan Beach","Hermosa Beach","Torrance","Palos Verdes"]}
    />
  )
}