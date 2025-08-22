"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function AnaheimServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Anaheim"
      region="Orange County"
      description="Premium hibachi at home experiences in anaheim, bringing authentic Japanese tradition to your Orange County celebration."
      zipCodes={[]}
      neighborhoods={[]}
      popularVenues={["Private Homes","Community Centers","Event Venues"]}
      cityHighlights={["Beautiful Orange County community","Family-friendly neighborhoods","Diverse local culture","Great dining and entertainment"]}
      storyContent="Maria's father was losing his memory to dementia, and she was desperate to create one last perfect family gathering while he could still recognize everyone. She didn't want a sad goodbye dinner - she wanted magic, laughter, something that would light up his eyes one more time. When our hibachi chef arrived at their Anaheim family home, her father's face transformed. The showmanship, the fire, the playful interaction triggered something beautiful - he became animated, engaged, present. For three precious hours, dementia took a backseat to wonder. He clapped for every trick, laughed at every joke, and when the chef taught him to catch an egg, he beamed with childlike pride. Maria watched her father truly see and be seen by his family one last time. This wasn't just a private birthday hibachi party - it was a gift of connection, a bridge across the darkness of disease, a memory that would sustain them through the difficult days ahead."
      nearbyCities={["Fullerton","Orange","Buena Park","Garden Grove","Placentia"]}
    />
  )
}