"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function CostaMesaServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Costa Mesa"
      region="Orange County"
      description="Premium hibachi at home experiences in costa mesa, bringing authentic Japanese tradition to your Orange County celebration."
      zipCodes={[]}
      neighborhoods={[]}
      popularVenues={["Private Homes","Community Centers","Event Venues"]}
      cityHighlights={["Beautiful Orange County community","Family-friendly neighborhoods","Diverse local culture","Great dining and entertainment"]}
      storyContent="When Jennifer's teenage son announced he was gay, she felt overwhelmed - not with disappointment, but with love and the fierce need to show him he was celebrated exactly as he was. A simple family dinner wouldn't capture the magnitude of her pride and acceptance. She wanted a moment that would forever symbolize 'you are loved, you are perfect, you belong.' The hibachi at home experience in their Costa Mesa home became that moment. As our chef performed with theatrical flair, the family rallied around their son with cheers and applause. The chef, sensing the special energy, dedicated extra tricks to the guest of honor. Through laughter and flames, a message was delivered louder than words ever could: this family was a safe harbor, and love was the only ingredient that mattered. Years later, they still talk about 'the night we celebrated being ourselves.'"
      nearbyCities={["Irvine","Newport Beach","Huntington Beach","Orange","Santa Ana"]}
    />
  )
}