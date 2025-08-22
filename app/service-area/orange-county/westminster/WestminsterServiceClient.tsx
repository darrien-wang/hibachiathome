"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function WestminsterServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Westminster"
      region="Orange County"
      description="Where meaningful moments deserve extraordinary celebrations - hibachi at home experiences that create lasting memories in Orange County's westminster community."
      zipCodes={[]}
      neighborhoods={[]}
      popularVenues={["Private Homes","Community Centers","Event Venues","Family Residences"]}
      cityHighlights={["Beautiful Orange County community","Family-friendly neighborhoods","Diverse local culture","Great dining and entertainment"]}
      storyContent="After losing her husband of 45 years, Vietnamese immigrant Mrs. Nguyen had retreated into herself, barely speaking even to her children. Her family worried she was giving up on life. For her 75th birthday, they wanted to do something that would remind her she was still needed, still loved, still part of a family that couldn't imagine life without her. The hibachi at home experience in their Westminster home became a love letter written in flames and food. As our chef performed, something shifted in Mrs. Nguyen's eyes - she began translating the excitement to her youngest grandchildren, sharing stories of cooking in Vietnam, laughing at the chef's playful antics. When the chef invited her to help with a traditional technique, her hands moved with the confidence of someone remembering her purpose. This private birthday hibachi party didn't just celebrate her life - it reminded her she still had living to do."
      nearbyCities={["Garden Grove","Fountain Valley","Huntington Beach","Seal Beach","Cypress"]}
    />
  )
}