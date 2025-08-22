"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function SealBeachServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Seal Beach"
      region="Orange County"
      description="Where meaningful moments deserve extraordinary celebrations - hibachi at home experiences that create lasting memories in Orange County's seal beach community."
      zipCodes={[]}
      neighborhoods={[]}
      popularVenues={["Private Homes","Community Centers","Event Venues","Family Residences"]}
      cityHighlights={["Beautiful Orange County community","Family-friendly neighborhoods","Diverse local culture","Great dining and entertainment"]}
      storyContent="When retired teacher Margaret turned 70, her family noticed she'd been saying 'at my age' more often, as if she was apologizing for still being vital and curious. Her daughter wanted to remind her that age was just a number, and she still had adventures ahead. The hibachi at home experience in their Seal Beach cottage became a celebration of timeless spirit. As our chef performed, Margaret became the most enthusiastic audience member, asking questions about techniques, sharing stories of her own cooking disasters, and cheering louder than her grandchildren. When the chef invited her to help with a simple preparation, she moved with the confidence of someone who'd spent decades teaching others to try new things. This private birthday hibachi party didn't just mark another year - it reminded Margaret that wisdom and wonder can coexist, and the best chapters might be the ones where you stop counting pages."
      nearbyCities={["Los Alamitos","Westminster","Huntington Beach","Cypress","Long Beach"]}
    />
  )
}