"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function FullertonServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Fullerton"
      region="Orange County"
      description="Premium hibachi at home experiences in fullerton, bringing authentic Japanese tradition to your Orange County celebration."
      zipCodes={[]}
      neighborhoods={[]}
      popularVenues={["Private Homes","Community Centers","Event Venues"]}
      cityHighlights={["Beautiful Orange County community","Family-friendly neighborhoods","Diverse local culture","Great dining and entertainment"]}
      storyContent="After the divorce, single mom Rachel wondered if she'd ever feel joyful about celebrations again. Her daughter's sweet sixteen was approaching, and Rachel was determined to prove that their smaller family could still create big happiness. She didn't want to fake it - she wanted to feel it. The hibachi at home experience in their Fullerton home became a declaration of resilience. As our private chef entertained her daughter and friends, Rachel watched her child's pure delight and felt something shift inside her heart. The teenagers gasped at every trick, took selfies with the flames, and created the kind of authentic fun that money can't buy but memories are made of. When her daughter hugged her and whispered 'this is the best birthday ever,' Rachel realized she hadn't just given her daughter a party - she'd given herself permission to believe in new beginnings. Sometimes the most important person you're celebrating is yourself."
      nearbyCities={["Anaheim","Buena Park","La Habra","Placentia","Brea"]}
    />
  )
}