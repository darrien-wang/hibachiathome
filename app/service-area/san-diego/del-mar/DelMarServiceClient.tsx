"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function DelMarServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Del Mar"
      region="San Diego County"
      description="Charming coastal village charm meets authentic Japanese tradition - hibachi at home experiences where luxury and laid-back beach culture create perfect celebrations."
      zipCodes={["92014"]}
      neighborhoods={["Del Mar Heights", "Carmel Valley", "Del Mar Village", "Torrey Hills"]}
      popularVenues={["Beachfront Properties", "Country Club Estates", "Luxury Condos", "Historic Beach Cottages"]}
      cityHighlights={[
        "Charming coastal village with beautiful beaches",
        "Famous Del Mar Racetrack and annual fair",
        "Upscale shopping and dining scene",
        "Perfect blend of luxury and laid-back beach culture"
      ]}
      storyContent="The Johnsons had dreamed of the perfect anniversary celebration for months. After 20 years together, they wanted something special in their Del Mar beach home. As our hibachi chef set up on their oceanview deck, the sound of waves provided the perfect soundtrack. The theatrical cooking performance reminded them of their honeymoon in Japan, while the intimate setting allowed them to reconnect without distractions. This hibachi at home experience captured the romance and sophistication that makes Del Mar magical - where every celebration feels like a fairy tale."
      nearbyCities={["La Jolla", "Encinitas", "Solana Beach", "Carmel Valley"]}
    />
  )
}

