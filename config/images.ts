// Menu item images — every path points at a real photo of real food.
// The old hibachi-plate.png (a pool-side table-setting render) must never
// be used as a dish photo again.
export const menuImages = {
  "chicken-steak":
    "/images/menu/chicken-and-beef.jpg",
  "steak-shrimp":
    "/images/menu/shrimp.jpg",
  "filet-chicken-shrimp":
    "/images/menu/filet-chicken-shrimp.jpg",
  "filet-lobster":
    "/images/menu/lobster.jpg",
  "shrimp-sca":
    "/images/menu/scallops.jpg",
  "hibachi-logo":
    "/images/logo-realhibachi.png",
  "chicken-scallop":
    "/images/menu/scallops.jpg",
    "chicken-shrimp":
    "/images/menu/chicken-and-beef.jpg"
}

// Package images - we'll use some of the same images for packages
export const packageImages = {
  basic:
    "/images/menu/chicken-and-beef.jpg",
  premium:
    "/images/menu/combo-regular.jpg",
  buffet:
    "/images/menu/filet-chicken-shrimp.jpg",
}

// Function to get image URL by ID
export const getMenuImageById = (id: string): string => {
  return menuImages[id] || "/hibachi-food.png"
}

// Function to get package image URL by ID
export const getPackageImageById = (id: string): string => {
  return packageImages[id] || "/hibachi-package.png"
}
