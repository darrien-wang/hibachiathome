"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function TarzanaServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Tarzana"
      region="California"
      description="Exclusive hibachi at home service in upscale Tarzana, bringing five-star dining to this prestigious Valley community."
      zipCodes={["91335","91356"]}
      neighborhoods={["South Tarzana","Tarzana Hills","Ventura Boulevard area","Mulholland area"]}
      popularVenues={["Estate Properties","Hillside Homes","Luxury Residences","Private Estates"]}
      cityHighlights={["Upscale suburban community in the Valley","Named after famous Tarzan creator Edgar Rice Burroughs","Beautiful hillside homes and estates","Family-oriented neighborhood with parks and recreation"]}
      storyContent="In a beautiful Tarzana hillside home, we brought hibachi at home elegance to a milestone anniversary celebration. Our private chef's refined techniques impressed this upscale community's discerning tastes. The hibachi party unfolded in their stunning backyard overlooking the Valley, creating an atmosphere of celebration and luxury. This private birthday hibachi party exemplified Tarzana's reputation for sophisticated entertaining."
      nearbyCities={["Encino","Woodland Hills","Sherman Oaks"]}
    />
  )
}