"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function RanchoSantaMargaritaServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Rancho Santa Margarita"
      region="Orange County"
      description="Where meaningful moments deserve extraordinary celebrations - hibachi at home experiences that create lasting memories in Orange County's rancho santa-margarita community."
      zipCodes={[]}
      neighborhoods={[]}
      popularVenues={["Private Homes","Community Centers","Event Venues","Family Residences"]}
      cityHighlights={["Beautiful Orange County community","Family-friendly neighborhoods","Diverse local culture","Great dining and entertainment"]}
      storyContent="When empty-nesters Janet and Robert realized they'd spent 25 years organizing their lives around their children's schedules, they felt lost about how to be a couple again. Their kids suggested they celebrate their upcoming anniversary not with a quiet dinner, but with something that would help them rediscover fun together. The hibachi at home experience in their Rancho Santa Margarita home became their second first date. As our chef performed, they found themselves reaching for each other's hands during exciting moments, sharing surprised looks, behaving like the young couple who'd fallen in love decades ago. When the chef presented them with heart-shaped portions and toasted their enduring love, they realized their empty nest wasn't an ending - it was a beginning. Sometimes you need to be surprised by joy to remember that romance doesn't have to retire when the kids grow up."
      nearbyCities={["Mission Viejo","Coto de Caza","Las Flores","Dove Canyon","Trabuco Canyon"]}
    />
  )
}