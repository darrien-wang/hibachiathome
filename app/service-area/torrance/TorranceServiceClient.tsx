"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function TorranceServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Torrance"
      region="California"
      description="Suburban hibachi at home service in diverse Torrance, bringing authentic Japanese flavors to your neighborhood."
      zipCodes={["90501","90502","90503","90504","90505"]}
      neighborhoods={["Old Torrance","West Torrance","North Torrance","South Bay","Del Amo"]}
      popularVenues={["Residential Homes","Community Centers","Corporate Offices","Shopping Center Venues"]}
      cityHighlights={["Diverse multicultural community","Strong manufacturing and aerospace industry presence","Excellent schools and family-oriented neighborhoods","Japanese cultural influence and community"]}
      storyContent="In Torrance's diverse community, we hosted a multicultural hibachi at home celebration where our private chef honored both Japanese traditions and local flavors. The hibachi party guests from various backgrounds bonded over amazing teppanyaki cooking. This private birthday hibachi party showcased how food brings people together, perfectly reflecting Torrance's wonderful cultural diversity and community spirit."
      nearbyCities={["Redondo Beach","Manhattan Beach","Gardena","Carson","El Segundo"]}
    />
  )
}