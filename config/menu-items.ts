// 菜品类型定义
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

// 套餐类型定义
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

// 常规蛋白质
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
    id: "scallops",
    name: "Scallops",
    description: "Fresh sea scallops, seared to perfection",
    price: 10,
    category: "regular-protein",
    allergens: ["shellfish"],
    isGlutenFree: true,
    image: "/images/menu/scallops.png",
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

// 高级蛋白质
export const premiumProteins: MenuItem[] = [
  {
    id: "filet",
    name: "Filet Mignon",
    description: "Premium cut filet mignon, tender and juicy",
    price: 15,
    category: "premium-protein",
    allergens: ["none"],
    isGlutenFree: true,
    cookingOptions: ["Rare", "Medium Rare", "Medium", "Medium Well", "Well Done"],
    image: "/images/menu/filet.png",
  },
  {
    id: "lobster",
    name: "Lobster",
    description: "Maine lobster tail, buttery and delicious",
    price: 20,
    category: "premium-protein",
    allergens: ["shellfish"],
    isGlutenFree: true,
    image: "/images/menu/lobster.png",
  },
  {
    id: "premium-chicken",
    name: "Premium Chicken",
    description: "Free-range organic chicken breast, specially marinated",
    price: 15, // 两倍于regular chicken
    category: "premium-protein",
    allergens: ["none"],
    isGlutenFree: true,
    image: "/images/menu/chicken.png",
  },
  {
    id: "premium-steak",
    name: "Premium Steak",
    description: "USDA Prime beef, aged for tenderness and flavor",
    price: 20, // 两倍于regular steak
    category: "premium-protein",
    allergens: ["none"],
    isGlutenFree: true,
    cookingOptions: ["Rare", "Medium Rare", "Medium", "Medium Well", "Well Done"],
    image: "/images/menu/steak.png",
  },
  {
    id: "premium-shrimp",
    name: "Premium Shrimp",
    description: "Jumbo wild-caught shrimp, perfectly seasoned",
    price: 20, // 两倍于regular shrimp
    category: "premium-protein",
    allergens: ["shellfish"],
    isGlutenFree: true,
    image: "/images/menu/shrimp.png",
  },
  {
    id: "premium-salmon",
    name: "Premium Salmon",
    description: "Wild Alaskan salmon, sustainably sourced",
    price: 20, // 两倍于regular salmon
    category: "premium-protein",
    allergens: ["fish"],
    isGlutenFree: true,
    image: "/images/menu/salmon.png",
  },
]

// 配菜
export const sides: MenuItem[] = [
  {
    id: "gyoza",
    name: "Gyoza",
    description: "Pan-fried Japanese dumplings (12pcs)",
    price: 5,
    category: "side",
    allergens: ["gluten", "soy"],
    image: "/images/menu/gyoza.png",
  },
  {
    id: "edamame",
    name: "Edamame",
    description: "Steamed soybeans lightly salted",
    price: 5,
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
  {
    id: "soup",
    name: "Miso soup",
    description: "Miso soup with tofu and kelp",
    price: 5,
    category: "side",
    allergens: ["gluten", "soy"],
    isVegetarian: true,
    image: "/images/menu/soup.png",
  },
]

// 饮料
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

// 套餐选项
export const packageOptions: PackageOption[] = [
  {
    id: "buffet",
    name: "Buffet Package",
    description: "Self-service buffet mode",
    headcount: 20,
    childCount: 0,
    flatRate: 998,
    originalPrice: 60,
    currentPrice: 49.9,
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
    flatRate: 499,
    originalPrice: 60,
    currentPrice: 49.9,
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

// 获取所有菜品
export const getAllMenuItems = (): MenuItem[] => {
  return [...regularProteins, ...premiumProteins, ...sides, ...beverages]
}

// 根据ID获取菜品
export const getMenuItemById = (id: string): MenuItem | undefined => {
  return getAllMenuItems().find((item) => item.id === id)
}

// 根据ID获取套餐
export const getPackageById = (id: string): PackageOption | undefined => {
  return packageOptions.find((pkg) => pkg.id === id)
}

// 计算套餐价格
export const calculatePackagePrice = (
  packageId: string,
  headcount: number,
  childCount: number,
  selectedItems: Record<string, { selected: boolean; quantity: number }>,
): number => {
  const pkg = getPackageById(packageId)
  if (!pkg) return 0

  // 如果是固定价格套餐，直接返回
  if (packageId === "buffet") {
    return pkg.flatRate
  }

  // 计算所有选中项目的总价
  let totalItemsPrice = 0

  // 遍历所有选中的菜品
  Object.entries(selectedItems).forEach(([itemId, { selected, quantity }]) => {
    if (selected && quantity > 0) {
      const menuItem = getMenuItemById(itemId)
      if (menuItem) {
        totalItemsPrice += menuItem.price * quantity
      }
    }
  })

  // 减去套餐抵扣额度
  const extraCharge = Math.max(0, totalItemsPrice - pkg.packageCredit)

  // 基础价格 + 额外费用
  return pkg.flatRate + extraCharge
}
