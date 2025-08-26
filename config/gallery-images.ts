// Gallery images configuration
export interface GalleryImage {
  id: string
  src: string
  alt: string
  category?: string
}

// Gallery images data - using SEO optimized local images
export const galleryImages: GalleryImage[] = [
  {
    id: "img1",
    src: "/images/gallery/hibachi-chef-los-angeles-home-cooking-flames.jpg",
    alt: "Professional hibachi chef at home in Los Angeles cooking with spectacular flames",
    category: "chef-performance"
  },
  {
    id: "img2", 
    src: "/images/gallery/hibachi-at-home-los-angeles-fresh-ingredients.jpg",
    alt: "Fresh hibachi ingredients prepared for at-home dining in Los Angeles",
    category: "food-prep"
  },
  {
    id: "img3",
    src: "/images/gallery/family-hibachi-dinner-party-los-angeles-home.jpg", 
    alt: "Family enjoying private hibachi dinner party at home in Los Angeles",
    category: "family-dining"
  },
  {
    id: "img4",
    src: "/images/gallery/hibachi-chef-entertainment-los-angeles-home-service.jpg",
    alt: "Professional hibachi chef performing entertaining tricks for Los Angeles home service",
    category: "chef-performance"
  },
  {
    id: "img5",
    src: "/images/gallery/hibachi-seafood-platter-los-angeles-home-dining.jpg",
    alt: "Premium seafood hibachi platter with shrimp and scallops for Los Angeles home dining",
    category: "food-dishes"
  },
  {
    id: "img6", 
    src: "/images/gallery/backyard-hibachi-party-los-angeles-outdoor-catering.jpg",
    alt: "Outdoor backyard hibachi party catering service in Los Angeles",
    category: "outdoor-dining"
  },
  {
    id: "img7",
    src: "/images/gallery/hibachi-chef-preparing-meal-los-angeles-home.jpg",
    alt: "Professional hibachi chef preparing delicious meal for Los Angeles home guests",
    category: "chef-performance"
  },
  {
    id: "img8",
    src: "/images/gallery/hibachi-table-setup-los-angeles-home-service.jpg",
    alt: "Professional hibachi table setup for Los Angeles at-home dining service",
    category: "table-setup"
  },
  {
    id: "img9",
    src: "/images/gallery/hibachi-chef-skills-los-angeles-home-entertainment.jpg",
    alt: "Skilled hibachi chef demonstrating cooking techniques for Los Angeles home entertainment",
    category: "chef-performance"
  },
  {
    id: "img10",
    src: "/images/gallery/hibachi-cooking-demonstration-los-angeles-home.jpg",
    alt: "Live hibachi cooking demonstration for Los Angeles at-home dining experience",
    category: "chef-performance"
  },
  {
    id: "img11",
    src: "/images/gallery/elegant-hibachi-dinner-party-los-angeles-home.jpg",
    alt: "Elegant hibachi dinner party atmosphere for Los Angeles home celebrations",
    category: "dinner-party"
  },
  {
    id: "img12",
    src: "/images/gallery/hibachi-meal-prep-los-angeles-home-chef-service.jpg",
    alt: "Professional hibachi chef meal preparation for Los Angeles home dining service",
    category: "food-prep"
  },
  {
    id: "img13",
    src: "/images/gallery/hibachi-teppanyaki-chef-los-angeles-home-catering.jpg",
    alt: "Expert teppanyaki hibachi chef providing premium catering service in Los Angeles homes",
    category: "chef-performance"
  },
  {
    id: "img14",
    src: "/images/gallery/hibachi-grill-setup-los-angeles-private-chef-service.jpg",
    alt: "Professional hibachi grill setup for private chef service in Los Angeles",
    category: "table-setup"
  },
  {
    id: "img15",
    src: "/images/gallery/hibachi-birthday-party-los-angeles-home-celebration.jpg",
    alt: "Hibachi birthday party celebration at home in Los Angeles with chef entertainment",
    category: "birthday-party"
  },
  {
    id: "img16",
    src: "/images/gallery/hibachi-steak-cooking-los-angeles-home-dining.jpg",
    alt: "Premium hibachi steak cooking for Los Angeles home dining experience",
    category: "food-dishes"
  },
  {
    id: "img17",
    src: "/images/gallery/hibachi-chicken-teriyaki-los-angeles-home-service.jpg",
    alt: "Delicious hibachi chicken teriyaki prepared for Los Angeles home service",
    category: "food-dishes"
  },
  {
    id: "img18",
    src: "/images/gallery/hibachi-vegetables-grilling-los-angeles-home-cooking.jpg",
    alt: "Fresh hibachi vegetables grilling for healthy Los Angeles home cooking",
    category: "food-dishes"
  },
  {
    id: "img19",
    src: "/images/gallery/hibachi-fried-rice-preparation-los-angeles-home.jpg",
    alt: "Authentic hibachi fried rice preparation for Los Angeles home dining",
    category: "food-dishes"
  }
]

// Categories for filtering (optional future feature)
export const galleryCategories = [
  { id: "all", label: "All Photos" },
  { id: "chef-performance", label: "Chef Performance" },
  { id: "food-dishes", label: "Food & Dishes" },
  { id: "family-dining", label: "Family Dining" },
  { id: "outdoor-dining", label: "Outdoor Events" },
  { id: "table-setup", label: "Table Setup" },
  { id: "food-prep", label: "Food Preparation" },
  { id: "dinner-party", label: "Dinner Parties" },
  { id: "birthday-party", label: "Birthday Celebrations" }
]

// Helper function to get images by category
export const getImagesByCategory = (category: string): GalleryImage[] => {
  if (category === "all") return galleryImages
  return galleryImages.filter(img => img.category === category)
}

// Helper function to get image by ID
export const getImageById = (id: string): GalleryImage | undefined => {
  return galleryImages.find(img => img.id === id)
}
