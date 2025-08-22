"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function CypressServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Cypress"
      region="Orange County"
      description="Where meaningful moments deserve extraordinary celebrations - hibachi at home experiences that create lasting memories in Orange County's cypress community."
      zipCodes={[]}
      neighborhoods={[]}
      popularVenues={["Private Homes","Community Centers","Event Venues","Family Residences"]}
      cityHighlights={["Beautiful Orange County community","Family-friendly neighborhoods","Diverse local culture","Great dining and entertainment"]}
      storyContent="When nurse practitioner Lisa came home from her first week working COVID wards, her family saw someone changed by witnessing both tragedy and miraculous recoveries. She was processing emotions too big for normal conversation. Her husband knew she needed to be celebrated for her courage, but also given space to decompress from the weight she was carrying. The hibachi at home experience in their Cypress home became her gentle reentry into normalcy. As our chef performed with healing flames, Lisa found herself laughing for the first time in weeks, sharing stories of patient victories rather than losses, remembering why she chose healthcare. When the chef presented her with a heart-shaped dish and thanked her for her service to humanity, she felt seen not just as a healthcare worker, but as a person who'd chosen to show up during the world's darkest hours. Sometimes heroes need to be reminded they're allowed to rest and be celebrated."
      nearbyCities={["Westminster","Garden Grove","Los Alamitos","Seal Beach","Stanton"]}
    />
  )
}