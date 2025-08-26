"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function LakeArrowheadServiceClient() {
  const cityData = {
    name: "Lake Arrowhead",
    slug: "lake-arrowhead",
    zipCodes: ["92352", "92321"],
    neighborhoods: ["Lake Arrowhead Village", "Cedar Glen", "Rimforest", "Blue Jay", "Deer Lodge Park"],
    popularVenues: ["Luxury Mountain Homes", "Lakefront Properties", "Private Estates", "Resort Communities"],
    highlights: [
      "Exclusive alpine community with pristine lake views",
      "Luxury mountain homes and upscale resort atmosphere",
      "Private lake community with restricted access",
      "Year-round destination for affluent mountain retreats"
    ],
    story: "When entertainment industry executive Sarah chose her Lake Arrowhead estate for her daughter's engagement celebration, she wanted an experience as exclusive as the community itself. Our hibachi chef navigated the private roads to reach the stunning lakefront property, where floor-to-ceiling windows offered breathtaking views of the pristine alpine lake. As our chef created culinary magic on the expansive deck, guests were treated to both spectacular teppanyaki artistry and the serene beauty that makes Lake Arrowhead Southern California's most prestigious mountain retreat. This hibachi at home experience embodied Lake Arrowhead's essence - where privacy, luxury, and natural beauty create the perfect setting for life's most treasured moments.",
    nearbyCities: ["Big Bear Lake", "Crestline", "Running Springs", "Blue Jay"]
  }

  return (
    <CityServiceTemplate
      cityName={cityData.name}
      region="San Bernardino"
      description="Exclusive alpine community with luxury mountain homes and pristine lake views, offering professional hibachi at home service for upscale celebrations and private estate gatherings."
      zipCodes={cityData.zipCodes}
      neighborhoods={cityData.neighborhoods}
      popularVenues={cityData.popularVenues}
      cityHighlights={cityData.highlights}
      storyContent={cityData.story}
      nearbyCities={cityData.nearbyCities}
    />
  )
}








