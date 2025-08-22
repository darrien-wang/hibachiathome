"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function YorbaLindaServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Yorba Linda"
      region="Orange County"
      description="Where meaningful moments deserve extraordinary celebrations - hibachi at home experiences that create lasting memories in Orange County's yorba linda community."
      zipCodes={[]}
      neighborhoods={[]}
      popularVenues={["Private Homes","Community Centers","Event Venues","Family Residences"]}
      cityHighlights={["Beautiful Orange County community","Family-friendly neighborhoods","Diverse local culture","Great dining and entertainment"]}
      storyContent="When tech executive David finally sold his startup after years of 18-hour days, his family realized they'd been putting life on hold waiting for 'someday.' His wife suggested they celebrate not just his success, but their decision to prioritize presence over productivity going forward. The hibachi at home experience in their Yorba Linda home became a declaration of new values. As our chef performed, David found himself actually watching instead of checking his phone, engaging with the moment instead of planning the next one. When his eight-year-old daughter asked the chef to teach her a trick, and David got down on the floor to learn alongside her, his wife knew the real victory wasn't financial - it was getting her husband back. This hibachi party didn't just celebrate business success - it marked the beginning of a man choosing to be rich in time with the people he loved most."
      nearbyCities={["Placentia","Brea","Orange"]}
    />
  )
}