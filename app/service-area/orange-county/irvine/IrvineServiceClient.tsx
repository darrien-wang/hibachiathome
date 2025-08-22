"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function IrvineServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Irvine"
      region="Orange County"
      description="Where life's biggest moments deserve extraordinary celebrations - hibachi at home experiences that honor your achievements in Orange County's most prestigious community."
      zipCodes={["92602","92603","92604","92606","92612","92614","92616","92617","92618","92619","92620"]}
      neighborhoods={["Irvine Spectrum","University Park","Woodbridge","Northwood","Turtle Rock","Shady Canyon"]}
      popularVenues={["Executive Homes","University Community","Corporate Event Spaces","Luxury Residences"]}
      cityHighlights={["Master-planned community with excellent schools","Home to UC Irvine and tech companies","Beautiful parks and family-friendly neighborhoods","Diverse cultural community and dining scene"]}
      storyContent="When Sarah's teenage daughter announced she'd gotten into UC Irvine, the family knew this moment deserved more than just dinner at a restaurant. They wanted something that would capture the significance - the years of studying, the dreams finally realized, the pride bursting in their hearts. Our hibachi at home experience transformed their Irvine home into a stage for celebration. As our chef performed, three generations gathered around the sizzling grill, sharing stories of dreams and achievements. This wasn't just about food - it was about creating a memory that would forever mark this milestone. Sarah later said the teppanyaki tricks made everyone laugh until they cried happy tears, but what she treasured most was watching her daughter's face glow with pure joy, surrounded by everyone who believed in her."
      nearbyCities={["Costa Mesa","Newport Beach","Tustin","Orange","Lake Forest"]}
    />
  )
}