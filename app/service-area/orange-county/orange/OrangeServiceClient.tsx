"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function OrangeServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Orange"
      region="Orange County"
      description="Premium hibachi at home experiences in orange, bringing authentic Japanese tradition to your Orange County celebration."
      zipCodes={[]}
      neighborhoods={[]}
      popularVenues={["Private Homes","Community Centers","Event Venues"]}
      cityHighlights={["Beautiful Orange County community","Family-friendly neighborhoods","Diverse local culture","Great dining and entertainment"]}
      storyContent="When Michael's startup finally got funded after three years of struggle, he knew a simple celebration wouldn't capture the rollercoaster of emotions - the sleepless nights, the rejected pitches, the moments he almost gave up, and now this victory that felt surreal. He wanted to gather his team, his family, everyone who'd believed in the impossible dream. The hibachi at home experience in his Orange home became a victory lap for all of them. As our chef performed with flames dancing high, Michael saw his journey reflected in the fire - sometimes dangerous, always transformative, ultimately beautiful. His investors laughed alongside his parents, his team bonded over shared wonder, and his five-year-old nephew declared it 'better than Disneyland.' In that moment, success wasn't just about money or recognition - it was about the people who'd stood by him and the community that made the dream possible. Some achievements deserve a celebration as bold as the risks you took to get there."
      nearbyCities={["Anaheim","Costa Mesa","Tustin","Santa Ana","Villa Park"]}
    />
  )
}