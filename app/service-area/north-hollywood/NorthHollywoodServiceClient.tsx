"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function NorthHollywoodServiceClient() {
  return (
    <CityServiceTemplate
      cityName="North Hollywood"
      region="California"
      description="Arts-focused hibachi service in creative North Hollywood, bringing culinary artistry to the NoHo Arts District."
      zipCodes={["91601","91602","91603","91605","91606","91607","91608"]}
      neighborhoods={["NoHo Arts District","Valley Village","Toluca Lake border","Universal City area"]}
      popularVenues={["Artist Lofts","Creative Spaces","Theater District venues","Arts Community Centers"]}
      cityHighlights={["NoHo Arts District with theaters and galleries","Growing creative community and arts scene","Diverse neighborhoods with cultural variety","Close to Universal Studios and entertainment venues"]}
      storyContent="In NoHo's arts district, we delivered a hibachi at home experience to a loft filled with actors, dancers, and musicians. Our private chef's performance art approach to cooking mesmerized the artistic community. The hibachi party became an immersive dinner theater experience, blending culinary and performing arts. This private birthday hibachi party showcased North Hollywood's creative spirit through food."
      nearbyCities={["Studio City","Sherman Oaks","Burbank","Glendale","Valley Village"]}
    />
  )
}