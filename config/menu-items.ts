// Menu item type definition
export interface MenuItem {
  id: string
  name: string
  description: string
  price: number
  image?: string
  category: "regular-protein" | "premium-protein" | "side" | "beverage" | "addon"
  allergens?: string[]
  isVegetarian?: boolean
  isGlutenFree?: boolean
  cookingOptions?: string[]
}

// Package type definition
export interface PackageOption {
  id: string
  name: string
  description: string
  headcount: number
  childCount: number
  flatRate: number
  originalPrice?: number
  currentPrice?: number
  includedItems: {
    regularProteins: number
    premiumProteins: number
    sides: number
  }
  packageCredit: number
  defaultSelections: {
    proteins: string[]
    sides: string[]
  }
  image?: string
}

// Regular proteins
export const regularProteins: MenuItem[] = [
  {
    id: "chicken",
    name: "Chicken",
    description: "Tender chicken breast, marinated in our signature sauce",
    price: 10,
    category: "regular-protein",
    allergens: ["none"],
    isGlutenFree: true,
    image: "/images/menu/chicken.png",
  },
  {
    id: "steak",
    name: "Steak",
    description: "USDA Choice beef, perfectly seasoned",
    price: 10,
    category: "regular-protein",
    allergens: ["none"],
    isGlutenFree: true,
    cookingOptions: ["Rare", "Medium Rare", "Medium", "Medium Well", "Well Done"],
    image: "/images/menu/steak.png",
  },
  {
    id: "shrimp",
    name: "Shrimp",
    description: "Large shrimp, lightly seasoned and grilled to perfection",
    price: 10,
    category: "regular-protein",
    allergens: ["shellfish"],
    isGlutenFree: true,
    image: "/images/menu/shrimp.png",
  },

  {
    id: "salmon",
    name: "Salmon",
    description: "Wild-caught salmon fillet, lightly seasoned",
    price: 10,
    category: "regular-protein",
    allergens: ["fish"],
    isGlutenFree: true,
    image: "/images/menu/salmon.png",
  },
  {
    id: "tofu",
    name: "Tofu",
    description: "Firm tofu, marinated and grilled",
    price: 10,
    category: "regular-protein",
    allergens: ["soy"],
    isVegetarian: true,
    isGlutenFree: true,
    image: "/images/menu/tofu.png",
  },
]

// Premium proteins
export const premiumProteins: MenuItem[] = [
  {
    id: "filet",
    name: "Filet Mignon Upgrade",
    description: "USDA Prime filet mignon - the most tender cut, expertly seasoned and cooked to perfection",
    price: 8,
    category: "premium-protein",
    allergens: ["none"],
    isGlutenFree: true,
    cookingOptions: ["Rare", "Medium Rare", "Medium", "Medium Well", "Well Done"],
    image: "/images/menu/filet.png",
  },
  {
    id: "scallops-premium",
    name: "Premium Sea Scallops Upgrade",
    description: "U-10 jumbo sea scallops, perfectly seared with a golden crust and creamy center",
    price: 6,
    category: "premium-protein",
    allergens: ["shellfish"],
    isGlutenFree: true,
    image: "/images/menu/scallops.png",
  },
  {
    id: "lobster",
    name: "Spiny Lobster Tail Upgrade",
    description: "Fresh Australian spiny lobster tail, pan-seared to golden perfection with clarified butter",
    price: 12,
    category: "premium-protein",
    allergens: ["shellfish"],
    isGlutenFree: true,
    image: "/images/menu/lobster.png",
  },
]

// Side dishes
export const sides: MenuItem[] = [
  {
    id: "gyoza",
    name: "Gyoza",
    description: "Pan-fried Japanese dumplings (12pcs)",
    price: 15,
    category: "side",
    allergens: ["gluten", "soy"],
    image: "/images/menu/gyoza.png",
  },
  {
    id: "edamame",
    name: "Edamame",
    description: "Steamed soybeans lightly salted",
    price: 10,
    category: "side",
    allergens: ["soy"],
    isVegetarian: true,
    isGlutenFree: true,
    image: "/images/menu/edamame.png",
  },
  {
    id: "noodles",
    name: "Noodles",
    description: "Stir-fried noodles with vegetables",
    price: 5,
    category: "side",
    allergens: ["gluten", "soy"],
    isVegetarian: true,
    image: "/images/menu/noodles.png",
  },
]

// Beverages
export const beverages: MenuItem[] = [
  {
    id: "soft-drinks",
    name: "Soft Drinks Package",
    description: "Coke, Diet Coke, Sprite, Water (per person)",
    price: 5,
    category: "beverage",
    allergens: ["none"],
    isVegetarian: true,
    isGlutenFree: true,
  },
  {
    id: "premium-beverage",
    name: "Premium Beverage Package",
    description: "Soft drinks, juices, and mocktails (per person)",
    price: 12,
    category: "beverage",
    allergens: ["none"],
    isVegetarian: true,
    isGlutenFree: true,
  },
]

// Package options
export const packageOptions: PackageOption[] = [
  {
    id: "buffet",
    name: "Buffet Package",
    description: "Self-service buffet mode",
    headcount: 20,
    childCount: 0,
    flatRate: 998,
    originalPrice: 60,
    currentPrice: 59.9,
    includedItems: {
      regularProteins: 3,
      premiumProteins: 0,
      sides: 0,
    },
    packageCredit: 30, // 3 regular proteins
    defaultSelections: {
      proteins: ["chicken", "steak", "shrimp"],
      sides: [],
    },
    image: "/images/packages/buffet-package.png",
  },
  {
    id: "basic",
    name: "Basic Package",
    description: "Perfect for intimate gatherings",
    headcount: 10,
    childCount: 0,
    flatRate: 599,
    originalPrice: 60,
    currentPrice: 59.9,
    includedItems: {
      regularProteins: 2,
      premiumProteins: 0,
      sides: 0,
    },
    packageCredit: 20, // 2 regular proteins
    defaultSelections: {
      proteins: ["chicken", "steak"],
      sides: [],
    },
    image: "/images/packages/basic-package.png",
  },
]

// Get all menu items
export const getAllMenuItems = (): MenuItem[] => {
  return [...regularProteins, ...premiumProteins, ...sides, ...beverages]
}

// Get menu item by ID
export const getMenuItemById = (id: string): MenuItem | undefined => {
  return getAllMenuItems().find((item) => item.id === id)
}

// Get package by ID
export const getPackageById = (id: string): PackageOption | undefined => {
  return packageOptions.find((pkg) => pkg.id === id)
}

// Calculate package price
export const calculatePackagePrice = (
  packageId: string,
  headcount: number,
  childCount: number,
  selectedItems: Record<string, { selected: boolean; quantity: number }>,
): number => {
  const pkg = getPackageById(packageId)
  if (!pkg) return 0

  // If it's a fixed price package, return directly
  if (packageId === "buffet") {
    return pkg.flatRate
  }

  // Calculate total price of all selected items
  let totalItemsPrice = 0

  // Iterate through all selected menu items
  Object.entries(selectedItems).forEach(([itemId, { selected, quantity }]) => {
    if (selected && quantity > 0) {
      const menuItem = getMenuItemById(itemId)
      if (menuItem) {
        totalItemsPrice += menuItem.price * quantity
      }
    }
  })

  // Subtract package credit amount
  const extraCharge = Math.max(0, totalItemsPrice - pkg.packageCredit)

  // Base price + extra charges
  return pkg.flatRate + extraCharge
}
