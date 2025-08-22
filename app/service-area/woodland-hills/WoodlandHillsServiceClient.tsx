"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function WoodlandHillsServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Woodland Hills"
      region="California"
      description="Upscale hibachi catering in beautiful Woodland Hills, perfect for elegant gatherings in this scenic Valley locale."
      zipCodes={["91364","91365","91367"]}
      neighborhoods={["Warner Center","West Hills border","Calabasas border","Topanga area"]}
      popularVenues={["Corporate Centers","Luxury Homes","Golf Course venues","Mountain View Properties"]}
      cityHighlights={["Upscale Valley community with mountain views","Warner Center business district","Beautiful parks and recreational facilities","Family-friendly suburban atmosphere"]}
      storyContent="At a Warner Center executive's Woodland Hills home, we provided a hibachi at home experience that impressed business leaders from the corporate district. Our private chef's professional presentation matched their high standards for entertaining clients. The hibachi party created the perfect atmosphere for relationship building and celebration. This private birthday hibachi party demonstrated why successful professionals choose our premium service."
      nearbyCities={["Tarzana","Encino"]}
    />
  )
}