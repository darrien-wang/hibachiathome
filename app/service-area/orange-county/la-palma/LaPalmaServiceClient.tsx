"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function LaPalmaServiceClient() {
  return (
    <CityServiceTemplate
      cityName="La Palma"
      region="Orange County"
      description="Where meaningful moments deserve extraordinary celebrations - hibachi at home experiences that create lasting memories in Orange County's la palma community."
      zipCodes={[]}
      neighborhoods={[]}
      popularVenues={["Private Homes","Community Centers","Event Venues","Family Residences"]}
      cityHighlights={["Beautiful Orange County community","Family-friendly neighborhoods","Diverse local culture","Great dining and entertainment"]}
      storyContent="When kindergarten teacher Mrs. Chen announced her retirement after 40 years, her final class parents wanted to create a farewell that would capture how she'd shaped not just their children, but entire generations of families. She'd taught siblings, then their children, watching the community grow while remaining its steady, nurturing heart. The hibachi at home experience in her La Palma home became a multigenerational thank you. As our chef performed, former students arrived with their own children, sharing stories of lessons learned and confidence gained in her classroom. When the chef invited the children to participate safely in the cooking process, everyone watched Mrs. Chen naturally guide and encourage them, demonstrating the teaching instincts that had made her legendary. This retirement hibachi party didn't just mark the end of a career - it celebrated a legacy of love that would continue through every life she'd touched."
      nearbyCities={["Buena Park","Cypress","Cerritos","Stanton","Anaheim"]}
    />
  )
}