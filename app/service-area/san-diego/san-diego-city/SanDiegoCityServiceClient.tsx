"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function SanDiegoCityServiceClient() {
  return (
    <CityServiceTemplate
      cityName="San Diego"
      region="San Diego County"
      description="Where life's biggest moments deserve extraordinary celebrations - hibachi at home experiences in America's Finest City that create lasting memories."
      zipCodes={["92101", "92102", "92103", "92104", "92105", "92106", "92107", "92108", "92109", "92110", "92111", "92113", "92114", "92115", "92116", "92117", "92119", "92120", "92121", "92122", "92123", "92124", "92126", "92127", "92128", "92129", "92130", "92131", "92132", "92134", "92135", "92136", "92137", "92138", "92139", "92140", "92142", "92145", "92147", "92154", "92155", "92158", "92159", "92160", "92161", "92162", "92163", "92165", "92166", "92167", "92168", "92169", "92170", "92171", "92172", "92173", "92174", "92175", "92176", "92177", "92179", "92182", "92186", "92187", "92191", "92192", "92193", "92194", "92195", "92196", "92197", "92198", "92199"]}
      neighborhoods={["Downtown San Diego", "Gaslamp Quarter", "Little Italy", "Hillcrest", "Mission Valley", "Pacific Beach", "Mission Beach", "Point Loma", "Ocean Beach", "Balboa Park"]}
      popularVenues={["Luxury Condos", "Historic Homes", "Beachfront Properties", "Urban Lofts"]}
      cityHighlights={[
        "California's second-largest city with vibrant urban culture",
        "Beautiful beaches and perfect year-round weather",
        "Rich military history and diverse neighborhoods",
        "Amazing food scene and craft beer capital"
      ]}
      storyContent="When Maria's husband returned from deployment, she wanted to create a celebration that honored both his service and their reunion. Instead of crowded restaurants where they couldn't truly connect, she chose hibachi at home in their Hillcrest apartment. As our chef prepared the meal, they shared stories of separation and dreams for the future. The sizzling sounds and theatrical performance created an intimate atmosphere where they could focus on each other. This private hibachi party became more than dinner - it was a homecoming celebration that marked a new chapter in their love story."
      nearbyCities={["La Jolla", "Mission Valley", "Pacific Beach", "Point Loma", "Coronado"]}
    />
  )
}

