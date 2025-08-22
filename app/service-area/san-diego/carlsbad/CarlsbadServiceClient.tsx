"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function CarlsbadServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Carlsbad"
      region="San Diego County"
      description="Family-oriented excellence meets authentic Japanese tradition - hibachi at home experiences in Southern California's premier family community."
      zipCodes={["92008", "92009", "92010", "92011", "92013"]}
      neighborhoods={["Village Carlsbad", "La Costa", "Aviara", "Calavera Hills", "Bressi Ranch"]}
      popularVenues={["Resort Communities", "Golf Course Homes", "Family Neighborhoods", "Luxury Estates"]}
      cityHighlights={[
        "Beautiful beaches and world-class golf resorts",
        "Family-friendly community with excellent schools",
        "Famous flower fields and LEGOLAND California",
        "Thriving business district and tech companies"
      ]}
      storyContent="When the Martinez family's teenage daughter was accepted to Stanford, they knew this achievement deserved more than dinner out. They wanted a celebration that honored years of hard work while bringing three generations together. Our hibachi chef transformed their Carlsbad backyard into an entertainment stage where grandparents, parents, and teens all laughed at the same tricks. As sparks flew from the grill, so did stories of family dreams and accomplishments. This hibachi at home experience created the perfect blend of celebration and connection that makes Carlsbad families so strong."
      nearbyCities={["Encinitas", "Oceanside", "Vista", "San Marcos"]}
    />
  )
}

