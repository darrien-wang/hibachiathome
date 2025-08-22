"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function TustinServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Tustin"
      region="Orange County"
      description="Premium hibachi at home experiences in tustin, bringing authentic Japanese tradition to your Orange County celebration."
      zipCodes={[]}
      neighborhoods={[]}
      popularVenues={["Private Homes","Community Centers","Event Venues"]}
      cityHighlights={["Beautiful Orange County community","Family-friendly neighborhoods","Diverse local culture","Great dining and entertainment"]}
      storyContent="When Emma's grandmother turned 90, the family realized this might be their last chance to see her truly light up with joy. Grandma Rose had been withdrawing lately, claiming she was 'too old for fuss,' but Emma suspected she just felt forgotten in a world that moved too fast for her memories. The hibachi at home experience in Emma's Tustin home wasn't just a birthday party - it was a love letter to someone who'd given everything to her family. As our private chef performed, something magical happened: Grandma Rose became the star. She clapped for every trick, asked questions about the cooking, and when the chef let her help with a simple technique, she positively glowed. Four generations gathered around that grill, but all eyes were on the birthday girl who suddenly felt relevant, valued, celebrated. When she whispered to Emma, 'I haven't felt this special in years,' the family knew they'd given her more than a meal - they'd given her back her sparkle."
      nearbyCities={["Irvine","Orange","Santa Ana","Lake Forest","Villa Park"]}
    />
  )
}