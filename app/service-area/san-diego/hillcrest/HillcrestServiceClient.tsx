"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function HillcrestServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Hillcrest"
      region="San Diego County"
      description="Urban vibrancy meets authentic Japanese tradition - hibachi at home experiences where dedication and diversity create a unique community spirit and unforgettable celebrations."
      zipCodes={["92103"]}
      neighborhoods={["Hillcrest Village", "Park West", "Medical District", "Balboa Park Adjacent"]}
      popularVenues={["Urban Condos", "Historic Apartments", "Medical Facilities", "Cultural Venues"]}
      cityHighlights={[
        "Vibrant urban neighborhood with rich culture",
        "Historic architecture and tree-lined streets",
        "Medical district with major hospitals",
        "LGBTQ+ friendly community with pride events"
      ]}
      storyContent="Dr. Martinez had just completed his residency at UCSD Medical Center, and his partner wanted to celebrate this incredible achievement. In their Hillcrest apartment near the hospital where he'd spent countless hours, our hibachi chef created an intimate celebration. The urban setting provided energy while the personal cooking performance offered the perfect way to mark this transition from student to practicing physician. This hibachi at home experience embodied Hillcrest's character - where dedication and diversity create a unique community spirit."
      nearbyCities={["San Diego", "Mission Valley", "Balboa Park", "University Heights"]}
    />
  )
}
