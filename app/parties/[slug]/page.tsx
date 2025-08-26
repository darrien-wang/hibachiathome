import { Metadata } from "next"
import { notFound } from "next/navigation"
import { getPartyTypeById, partyTypes } from "@/config/party-types"
import PartyPageLayout from "@/components/party-page-layout"

interface PartyPageProps {
  params: {
    slug: string
  }
}

// Generate static params for all party types
export async function generateStaticParams() {
  return partyTypes.map((party) => ({
    slug: party.id,
  }))
}

// Generate metadata for each party type
export async function generateMetadata({ params }: PartyPageProps): Promise<Metadata> {
  const partyType = getPartyTypeById(params.slug)
  
  if (!partyType) {
    return {
      title: "Party Not Found | Hibachi at Home"
    }
  }

  return {
    title: partyType.seoTitle,
    description: partyType.seoDescription,
    keywords: `${partyType.name}, hibachi catering Los Angeles, teppanyaki party, ${partyType.perfectFor.join(", ")}`,
    openGraph: {
      title: partyType.title,
      description: partyType.description,
      images: [partyType.heroImage],
      type: "website",
    },
    alternates: {
      canonical: `https://realhibachiathome.com${partyType.href}`
    },
    other: {
      "article:section": "Party Types",
      "article:tag": partyType.name,
    }
  }
}

export default function PartyPage({ params }: PartyPageProps) {
  const partyType = getPartyTypeById(params.slug)
  
  if (!partyType) {
    notFound()
  }

  return <PartyPageLayout partyType={partyType} />
}






