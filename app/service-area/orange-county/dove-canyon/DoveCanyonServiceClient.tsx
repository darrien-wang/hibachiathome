"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function DoveCanyonServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Dove Canyon"
      region="Orange County"
      description="Where luxury living meets culinary excellence - hibachi at home experiences that bring authentic Japanese teppanyaki to Orange County's prestigious Dove Canyon community."
      zipCodes={["92679"]}
      neighborhoods={["Dove Canyon Country Club","The Reserve","Canyon View Estates","Dove Canyon Ranch","Hillcrest Community"]}
      popularVenues={["Private Homes","Country Club Venues","Luxury Residences","Community Clubhouses","Estate Properties"]}
      cityHighlights={["Exclusive gated community","Golf course living","Luxury home settings","Family-oriented neighborhood","Stunning canyon views"]}
      storyContent="When successful entrepreneur Maria decided to celebrate her daughter's Sweet 16, she wanted something that would match their family's appreciation for both luxury and authenticity. Living in Dove Canyon's exclusive community, she'd grown tired of the same country club parties that everyone else hosted. The hibachi at home experience transformed their elegant dining room into an interactive theater of culinary art. As our master chef performed against the backdrop of their canyon view windows, Maria watched her usually reserved teenage daughter light up with genuine excitement, laughing and cheering with her friends. The evening reminded Maria that true luxury isn't about the most expensive venue - it's about creating moments where joy feels effortless and memories are made around your own table. Sometimes the most exclusive experience is the one that brings authentic wonder right to your door."
      nearbyCities={["Rancho Santa Margarita","Mission Viejo","Coto de Caza","Trabuco Canyon","Aliso Viejo"]}
    />
  )
}
