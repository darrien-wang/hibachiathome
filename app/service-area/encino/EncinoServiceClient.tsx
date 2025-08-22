"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function EncinoServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Encino"
      region="California"
      description="Luxury hibachi service in affluent Encino, delivering premium dining experiences to elegant Valley homes."
      zipCodes={["91316","91426","91436"]}
      neighborhoods={["South of Ventura","Encino Hills","Royal Oaks","Balboa area"]}
      popularVenues={["Luxury Estates","Gated Communities","Country Club venues","Executive Homes"]}
      cityHighlights={["Affluent San Fernando Valley community","Beautiful tree-lined residential streets","Upscale shopping and dining options","Family-friendly neighborhoods with excellent schools"]}
      storyContent="At a luxurious Encino estate with resort-style amenities, we created an upscale hibachi at home experience matching the sophisticated Valley lifestyle. Our private chef prepared premium ingredients with five-star presentation for successful business executives. The hibachi party felt like an exclusive members-only club gathering. This private birthday hibachi party epitomized Encino's blend of luxury, comfort, and California sophistication."
      nearbyCities={["Sherman Oaks","Studio City","Tarzana","Woodland Hills","Van Nuys"]}
    />
  )
}