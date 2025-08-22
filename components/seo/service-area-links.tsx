import Link from "next/link"
import { MapPin } from "lucide-react"

interface ServiceAreaLinksProps {
  title?: string
  description?: string
  className?: string
}

export default function ServiceAreaLinks({ 
  title = "Our Service Areas", 
  description = "Professional hibachi service across Southern California",
  className = ""
}: ServiceAreaLinksProps) {
  const serviceAreas = [
    {
      name: "Los Angeles",
      href: "/service-area/los-angeles",
      description: "Premium hibachi service in LA and surrounding areas"
    },
    {
      name: "Orange County", 
      href: "/service-area/orange-county",
      description: "Authentic teppanyaki experience in OC"
    },
    {
      name: "San Diego",
      href: "/service-area/san-diego", 
      description: "Coastal hibachi dining in San Diego"
    },
    {
      name: "San Bernardino",
      href: "/service-area/san-bernardino",
      description: "Mountain region hibachi catering service"
    },
    {
      name: "Palm Springs",
      href: "/service-area/palm-springs",
      description: "Desert resort hibachi experience"
    },
    {
      name: "Riverside",
      href: "/service-area/riverside",
      description: "Inland Empire hibachi service"
    }
  ]

  return (
    <div className={`bg-white rounded-lg shadow-sm border p-6 ${className}`}>
      <div className="text-center mb-6">
        <h3 className="text-xl font-bold text-gray-800 mb-2">{title}</h3>
        <p className="text-gray-600">{description}</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {serviceAreas.map((area) => (
          <Link 
            key={area.name}
            href={area.href}
            className="group p-4 border border-gray-200 rounded-lg hover:border-orange-300 hover:bg-orange-50 transition-all"
          >
            <div className="flex items-start space-x-3">
              <MapPin className="h-5 w-5 text-orange-500 mt-0.5" />
              <div>
                <h4 className="font-semibold text-gray-800 group-hover:text-orange-600">
                  {area.name} Hibachi
                </h4>
                <p className="text-sm text-gray-600 mt-1">
                  {area.description}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
      
      <div className="text-center mt-6">
        <Link 
          href="/service-area" 
          className="inline-flex items-center text-orange-600 hover:text-orange-700 font-medium"
        >
          View All Service Areas
          <svg className="ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  )
}
