"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function NewportBeachServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Newport Beach"
      region="Orange County"
      description="Waterfront elegance meets authentic Japanese tradition - hibachi at home experiences for Orange County's most discerning celebrations."
      zipCodes={["92660","92661","92662","92663"]}
      neighborhoods={["Balboa Island","Corona del Mar","Newport Coast","Lido Isle","Fashion Island area"]}
      popularVenues={["Waterfront Estates","Luxury Condos","Beach Houses","Private Yacht Clubs"]}
      cityHighlights={["Prestigious waterfront living and luxury shopping","Beautiful beaches and harbor activities","Upscale dining and entertainment scene","Exclusive residential communities and marinas"]}
      storyContent="After 25 years of marriage, David wanted to surprise his wife Linda with something extraordinary for their anniversary. Not another fancy restaurant where they'd sit across from each other making small talk. He craved something that would bring back the spark, the laughter, the sense of adventure they had when they first fell in love. When our private chef arrived at their Newport Beach waterfront home, Linda was confused - until the magic began. Watching the hibachi performance together, they found themselves giggling like teenagers again. The chef's playful banter broke down walls they didn't even know they'd built. By the time the onion volcano erupted, they were holding hands and remembering why they chose each other. This hibachi at home experience didn't just feed their bodies - it rekindled their connection and reminded them that their love story was still being written."
      nearbyCities={["Costa Mesa","Irvine","Huntington Beach","Laguna Beach","Balboa Island"]}
    />
  )
}