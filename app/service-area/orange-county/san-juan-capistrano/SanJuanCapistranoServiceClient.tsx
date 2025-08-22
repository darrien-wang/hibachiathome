"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function SanJuanCapistranoServiceClient() {
  return (
    <CityServiceTemplate
      cityName="San Juan Capistrano"
      region="Orange County"
      description="Where meaningful moments deserve extraordinary celebrations - hibachi at home experiences that create lasting memories in Orange County's san juan-capistrano community."
      zipCodes={[]}
      neighborhoods={[]}
      popularVenues={["Private Homes","Community Centers","Event Venues","Family Residences"]}
      cityHighlights={["Beautiful Orange County community","Family-friendly neighborhoods","Diverse local culture","Great dining and entertainment"]}
      storyContent="When art teacher Elena received news that her small-town school's arts program was being cut due to budget constraints, she felt defeated. She'd spent 20 years nurturing creativity in children, watching shy kids bloom into confident artists. Her husband knew she needed to remember why her work mattered before making any big decisions. The hibachi at home experience in their San Juan Capistrano home became an unexpected art lesson. As our chef created edible masterpieces, Elena's own artistic eye reawakened. Former students surprised her by arriving mid-meal, sharing how her classes had changed their lives. One was now a graphic designer, another a museum curator, a third simply a parent who taught their own children to see beauty everywhere. When the chef presented Elena with a dish arranged like a painter's palette, she realized her true masterpiece wasn't hanging on walls - it was walking around creating more beauty in the world."
      nearbyCities={["Dana Point","Mission Viejo","Laguna Niguel","Rancho Santa Margarita","Ladera Ranch"]}
    />
  )
}