"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function RanchoSanDiegoServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Rancho San Diego"
      region="San Diego County"
      description="Peaceful community meets authentic Japanese tradition - hibachi at home experiences where wisdom, family, and community create lasting legacies in suburban tranquility."
      zipCodes={["91977", "91978"]}
      neighborhoods={["Rancho San Diego Village", "Jamacha", "Casa de Oro", "Spring Valley"]}
      popularVenues={["Suburban Homes", "Golf Communities", "Family Properties", "Hillside Estates"]}
      cityHighlights={[
        "Peaceful suburban community with rural feel",
        "Beautiful views of surrounding hills",
        "Family-friendly neighborhoods and schools",
        "Close to nature and outdoor activities"
      ]}
      storyContent="Retired teacher Barbara had spent 40 years shaping young minds, and her former students wanted to honor her impact on their lives. At her Rancho San Diego home with views of the surrounding hills, our hibachi chef created a multigenerational celebration. Students who were now doctors, teachers, and parents gathered with their own children to thank the woman who believed in them. This hibachi at home experience reflected Rancho San Diego's character - where wisdom, family, and community create lasting legacies."
      nearbyCities={["La Mesa", "El Cajon", "Lemon Grove", "Bonita"]}
    />
  )
}
