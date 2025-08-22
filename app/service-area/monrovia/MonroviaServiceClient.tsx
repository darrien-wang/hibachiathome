"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function MonroviaServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Monrovia"
      region="California"
      description="Charming foothill hibachi service in historic Monrovia, combining small-town warmth with authentic cuisine."
      zipCodes={["91016","91017"]}
      neighborhoods={["Old Town Monrovia","Foothill area","Hillcrest","Library District"]}
      popularVenues={["Historic Homes","Family Residences","Community Venues","Foothill Properties"]}
      cityHighlights={["Historic small-town charm in the foothills","Beautiful old town area with local shops","Close to Angeles National Forest hiking trails","Family-oriented community with local events"]}
      storyContent="In historic Old Town Monrovia, we brought hibachi at home charm to a cozy neighborhood gathering. Our private chef's warm personality matched the small-town community spirit perfectly. The hibachi party neighbors all joined in, creating an impromptu block party atmosphere. This private birthday hibachi party showed how food brings communities together, embodying Monrovia's friendly, close-knit character."
      nearbyCities={["Arcadia","Pasadena","Duarte","Bradbury","Azusa"]}
    />
  )
}