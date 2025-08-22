"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function DanaPointServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Dana Point"
      region="Orange County"
      description="Premium hibachi at home experiences in dana point, bringing authentic Japanese tradition to your Orange County celebration."
      zipCodes={[]}
      neighborhoods={[]}
      popularVenues={["Private Homes","Community Centers","Event Venues"]}
      cityHighlights={["Beautiful Orange County community","Family-friendly neighborhoods","Diverse local culture","Great dining and entertainment"]}
      storyContent="When retirement finally arrived for Captain Tom after 30 years with the Coast Guard, his family faced an unexpected challenge: how do you celebrate someone who'd spent his career putting others first? Tom deflected attention, claimed he was 'just doing his job,' but his family knew better. They wanted to honor not just his service, but the man who'd missed family dinners to save strangers, who'd carried the weight of others' emergencies with quiet strength. The hibachi at home experience at their Dana Point harbor home became a homecoming in the truest sense. As our chef performed near the water where Tom had spent his career, something beautiful happened: stories started flowing. Fellow servicemen shared rescues Tom had never mentioned, family members revealed how his dedication had inspired their own choices. When the chef presented Tom with a anchor-shaped portion and thanked him for his service, this humble hero finally understood what his family had always known - some people deserve to be celebrated not for what they've gained, but for what they've given."
      nearbyCities={["Laguna Beach","San Juan Capistrano","Aliso Viejo","Laguna Niguel","San Clemente"]}
    />
  )
}