export interface PartyType {
  id: string
  name: string
  href: string
  title: string
  description: string
  shortDescription: string
  heroImage: string
  features: string[]
  seoTitle: string
  seoDescription: string
  perfectFor: string[]
  galleryImages: string[]
  socialMediaLinks?: {
    instagram?: string
    facebook?: string
    tiktok?: string
  }
  videoLinks?: string[]
  testimonials?: {
    name: string
    review: string
    rating: number
  }[]
}

export const partyTypes: PartyType[] = [
  {
    id: "birthday",
    name: "Birthday Parties",
    href: "/parties/birthday",
    title: "Unforgettable Birthday Hibachi Parties",
    description: "Make birthdays magical with our interactive hibachi birthday party experience. Our skilled chefs will create an entertaining and delicious celebration that your guests will never forget.",
    shortDescription: "Interactive hibachi entertainment for memorable birthday celebrations",
    heroImage: "/images/20250825183415_572_50.jpg", // 生日聚会设置
    features: [
      "Interactive teppanyaki cooking show",
      "Birthday song & special celebration",
      "Customizable menu for all ages",
      "Professional entertainment",
      "Photo opportunities with the chef",
      "Special birthday dessert presentation"
    ],
    seoTitle: "Birthday Party Hibachi Catering Los Angeles | Hibachi at Home",
    seoDescription: "Book the perfect hibachi birthday party in Los Angeles! Interactive teppanyaki chefs, entertainment, and delicious food for unforgettable birthday celebrations.",
    perfectFor: [
      "Kids birthday parties (all ages)",
      "Adult milestone birthdays",
      "Sweet 16 celebrations",
      "Surprise birthday parties",
      "Family birthday gatherings"
    ],
    galleryImages: [
      "/images/20250825183415_572_50.jpg", // 生日聚会
      "/images/20250825183410_571_50.jpg", // 泳池边聚会
      "/images/20250825183349_567_50.jpg"  // 团体照
    ],
    socialMediaLinks: {
      instagram: "https://instagram.com/realhibachiathome",
      facebook: "https://facebook.com/realhibachiathome"
    },
    videoLinks: [
      "https://www.instagram.com/p/DNBj1r7yWvq/",
      "https://www.tiktok.com/@real.hibachi/video/7541290219983703351"
    ]
  },
  {
    id: "graduation",
    name: "Graduation Parties",
    href: "/parties/graduation",
    title: "Celebrate Success with Hibachi Graduation Parties",
    description: "Honor your graduate's achievement with an exciting hibachi graduation party. Our chefs will create an impressive culinary show that matches the magnitude of their accomplishment.",
    shortDescription: "Celebrate academic achievements with impressive hibachi entertainment",
    heroImage: "/images/20250825183449_576_50.jpg", // 厨师烹饪照片
    features: [
      "Customizable menu options",
      "Group entertainment & interaction",
      "Professional photography moments",
    ],
    seoTitle: "Graduation Party Hibachi Catering | Los Angeles Teppanyaki Chef",
    seoDescription: "Celebrate graduation with hibachi catering in Los Angeles. Professional teppanyaki chefs create memorable graduation party entertainment for your special day.",
    perfectFor: [
      "High school graduations",
      "College graduation parties",
      "Graduate school celebrations",
      "Professional certification parties",
      "Academic achievement recognition"
    ],
    galleryImages: [
      "/images/20250825183449_576_50.jpg", // 厨师烹饪
      "/images/20250825183502_578_50.jpg", // 室内火焰表演
      "/images/20250825183355_569_50.jpg"  // 室内设置
    ],
    videoLinks: [
      "https://www.instagram.com/p/DNBj1r7yWvq/",
      "https://www.tiktok.com/@real.hibachi/video/7541290219983703351"
    ]
  },
  {
    id: "anniversary",
    name: "Anniversary Celebrations",
    href: "/parties/anniversary",
    title: "Romantic Hibachi Anniversary Celebrations",
    description: "Create a romantic and entertaining anniversary celebration with our hibachi experience. Perfect for intimate gatherings or larger family celebrations of love and commitment.",
    shortDescription: "Romantic hibachi experiences for celebrating love and commitment",
    heroImage: "/images/20250825183502_578_50.jpg", // 火焰表演
    features: [
      "Romantic ambiance with entertainment",
      "Heart-shaped food presentations",
      "Couples cooking demonstrations",
      "Photo-worthy moments",
    ],
    seoTitle: "Anniversary Party Hibachi Catering Los Angeles | Romantic Dining",
    seoDescription: "Celebrate your anniversary with romantic hibachi catering in Los Angeles. Interactive teppanyaki chefs create intimate and entertaining anniversary experiences.",
    perfectFor: [
      "Wedding anniversaries",
      "Dating anniversaries",
      "Milestone anniversary celebrations",
      "Romantic surprise parties",
      "Family anniversary gatherings"
    ],
    galleryImages: [
      "/images/20250825183502_578_50.jpg", // 火焰表演
      "/images/20250825183558_585_50.jpg", // 晚餐设置
      "/images/20250825183403_570_50.jpg"  // SAKE主题
    ],
    videoLinks: [
      "https://www.instagram.com/p/DNBj1r7yWvq/",
      "https://www.tiktok.com/@real.hibachi/video/7541290219983703351"
    ]
  },
  {
    id: "corporate",
    name: "Corporate Events",
    href: "/parties/corporate",
    title: "Professional Hibachi Corporate Events",
    description: "Impress clients and boost team morale with our professional hibachi corporate catering. Perfect for team building, client entertainment, and company celebrations.",
    shortDescription: "Professional hibachi catering for corporate team building and client entertainment",
    heroImage: "/images/20250825183605_586_50.jpg", // 大型聚会设置
    features: [
      "Professional presentation style",
      "Team building cooking activities",
      "Client entertainment focus",
      "Flexible scheduling options",
      "Corporate-appropriate menu",
      "Networking-friendly format"
    ],
    seoTitle: "Corporate Event Hibachi Catering Los Angeles | Business Entertainment",
    seoDescription: "Elevate your corporate events with professional hibachi catering in Los Angeles. Perfect for team building, client entertainment, and business celebrations.",
    perfectFor: [
      "Team building events",
      "Client appreciation dinners",
      "Company milestone celebrations",
      "Holiday office parties",
      "Product launch events",
      "Executive retreats"
    ],
    galleryImages: [
      "/images/20250825183605_586_50.jpg", // 大型聚会
      "/images/20250825183624_589_50.jpg", // 食物展示
      "/images/20250825183632_590_50.jpg"  // 室外火焰表演
    ],
    videoLinks: [
      "https://www.instagram.com/p/DNBj1r7yWvq/",
      "https://www.tiktok.com/@real.hibachi/video/7541290219983703351"
    ]
  },
  {
    id: "family",
    name: "Family Gatherings",
    href: "/parties/family",
    title: "Heartwarming Hibachi Family Gatherings",
    description: "Bring the family together with our entertaining hibachi family gathering experience. Perfect for reunions, holidays, and special family moments that create lasting memories.",
    shortDescription: "Interactive hibachi entertainment for memorable family moments and reunions",
    heroImage: "/images/20250825183525_581_50.jpg", // 家庭聚会绿色桌布
    features: [
      "Multi-generational entertainment",
      "Family-friendly cooking show",
      "Kid-approved menu options",
      "Interactive family participation",
      "Memory-making moments",
      "Flexible family-style serving"
    ],
    seoTitle: "Family Gathering Hibachi Catering Los Angeles | Family Entertainment",
    seoDescription: "Create memorable family gatherings with hibachi catering in Los Angeles. Interactive teppanyaki entertainment perfect for family reunions and celebrations.",
    perfectFor: [
      "Family reunions",
      "Holiday gatherings",
      "Extended family celebrations",
      "Multi-generational parties",
      "Family milestone events",
      "Sunday family dinners"
    ],
    galleryImages: [
      "/images/20250825183525_581_50.jpg", // 绿色桌布聚会
      "/images/20250825183534_582_50.jpg", // 绿色桌布聚会2
      "/images/20250825183517_580_50.jpg"  // 后院聚会
    ],
    videoLinks: [
      "https://www.instagram.com/p/DNBj1r7yWvq/",
      "https://www.tiktok.com/@real.hibachi/video/7541290219983703351"
    ]
  },
  {
    id: "holiday",
    name: "Holiday Parties",
    href: "/parties/holiday",
    title: "Festive Hibachi Holiday Celebrations",
    description: "Add excitement to your holiday celebrations with our festive hibachi holiday party experience. From Christmas to New Year's, we make every holiday memorable with delicious food and entertainment.",
    shortDescription: "Festive hibachi entertainment for memorable holiday celebrations",
    heroImage: "/images/20250825183424_573_50.jpg", // 室外hibachi设置
    features: [
      "Holiday-themed presentations",
      "Seasonal menu adaptations",
      "Festive cooking demonstrations",
      "Holiday music coordination",
      "Gift presentation moments",
      "Celebration countdown events"
    ],
    seoTitle: "Holiday Party Hibachi Catering Los Angeles | Festive Entertainment",
    seoDescription: "Celebrate holidays with hibachi catering in Los Angeles. Festive teppanyaki entertainment perfect for Christmas, New Year's, and holiday gatherings.",
    perfectFor: [
      "Christmas parties",
      "New Year's celebrations",
      "Thanksgiving gatherings",
      "Easter celebrations",
      "Fourth of July parties",
      "Halloween events"
    ],
    galleryImages: [
      "/images/20250825183424_573_50.jpg", // 室外设置
      "/images/20250825183431_574_50.jpg", // 室外聚会
      "/images/20250825183438_575_50.jpg"  // 食物展示
    ],
    videoLinks: [
      "https://www.instagram.com/p/DNBj1r7yWvq/",
      "https://www.tiktok.com/@real.hibachi/video/7541290219983703351"
    ]
  }
]

// Helper function to get party type by ID
export const getPartyTypeById = (id: string): PartyType | undefined => {
  return partyTypes.find(party => party.id === id)
}

// Helper function to get party types for navigation
export const getPartyNavItems = () => {
  return partyTypes.map(party => ({
    name: party.name,
    href: party.href,
    description: party.shortDescription
  }))
}