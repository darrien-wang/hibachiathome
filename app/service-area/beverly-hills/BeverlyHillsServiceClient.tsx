"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function BeverlyHillsServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Beverly Hills"
      region="California"
      description="Luxury hibachi chef service in prestigious Beverly Hills, bringing five-star dining to your elegant home."
      zipCodes={["90210", "90211", "90212"]}
      neighborhoods={["Beverly Hills Flats", "Trousdale Estates", "Beverly Hills Post Office", "North Beverly Hills"]}
      popularVenues={["Luxury Private Residences", "Estate Properties", "Private Clubs", "Executive Mansions"]}
      cityHighlights={[
        "World-famous luxury shopping on Rodeo Drive",
        "Home to Hollywood celebrities and entertainment figures", 
        "Prestigious residential neighborhoods and estates",
        "High-end dining and entertainment venues",
        "Exclusive cultural events and galas"
      ]}
      storyContent="We recently catered an elegant hibachi at home celebration at a beautiful Beverly Hills mansion on Rodeo Drive. The host wanted a private chef experience for their anniversary, and our Japanese teppanyaki master didn't disappoint. Between the luxury setting and our entertaining hibachi party performance, guests felt like celebrities dining at an exclusive restaurant. The sizzling sounds and delicious aromas filled their gorgeous estate dining room."
      nearbyCities={["West Hollywood","Los Angeles","Santa Monica","Culver City","Century City"]}
    />
  )
}
