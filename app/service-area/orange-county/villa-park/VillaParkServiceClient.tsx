"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function VillaParkServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Villa Park"
      region="Orange County"
      description="Where meaningful moments deserve extraordinary celebrations - hibachi at home experiences that create lasting memories in Orange County's villa park community."
      zipCodes={[]}
      neighborhoods={[]}
      popularVenues={["Private Homes","Community Centers","Event Venues","Family Residences"]}
      cityHighlights={["Beautiful Orange County community","Family-friendly neighborhoods","Diverse local culture","Great dining and entertainment"]}
      storyContent="When successful surgeon Dr. Martinez's teenage daughter announced she wanted to study art instead of medicine, the family dinner table became a battlefield of expectations versus dreams. Her mother worried about financial security, her father felt rejected, and she felt misunderstood. The hibachi at home experience in their Villa Park home became neutral ground where they could rediscover each other beyond their conflict. As our chef created edible art with precision that rivaled surgery, Dr. Martinez began to see his daughter's chosen field through new eyes. When the chef asked about their family and heard about the art versus medicine debate, he shared how cooking was both science and art, requiring the same dedication and creativity as any worthy profession. This family hibachi party didn't resolve their differences overnight - but it reminded them that love was more important than agreement, and supporting each other mattered more than sharing the same dreams."
      nearbyCities={["Orange","Yorba Linda","Tustin","Santa Ana"]}
    />
  )
}