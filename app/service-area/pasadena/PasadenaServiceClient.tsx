"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function PasadenaServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Pasadena"
      region="California"
      description="Historic charm meets modern hibachi in Pasadena, perfect for elegant gatherings in the City of Roses."
      zipCodes={["91101", "91102", "91103", "91104", "91105", "91106", "91107"]}
      neighborhoods={["Old Pasadena", "South Lake District", "Caltech area", "Altadena border", "San Rafael"]}
      popularVenues={["Historic Mansions", "Craftsman Homes", "Rose Bowl area", "Academic Institution Venues"]}
      cityHighlights={[
        "Famous Rose Bowl Stadium and Tournament of Roses Parade",
        "Historic Old Pasadena with charming architecture", 
        "Home to prestigious Caltech university",
        "Beautiful Craftsman-style homes and tree-lined streets",
        "Rich cultural attractions and museums"
      ]}
      storyContent="In a historic Pasadena Craftsman home, we brought hibachi at home elegance to a sophisticated dinner party during Rose Bowl season. Our private chef's artistry complemented the home's architectural beauty perfectly. The hibachi party guests from Caltech and JPL appreciated both the scientific precision of teppanyaki cooking and its entertainment value. This private birthday hibachi party combined old Pasadena charm with modern culinary innovation."
      nearbyCities={["Arcadia","Glendale","Burbank","Los Angeles","Monrovia","Alhambra"]}
    />
  )
}
