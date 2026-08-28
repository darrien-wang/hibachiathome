// Menu item images
export const menuImages = {
  "chicken-steak":
    "/images/menu/chicken-and-beef.jpg",
  "steak-shrimp":
    "/images/menu/hibachi-plate.png",
  "filet-chicken-shrimp":
    "/images/menu/filet-chicken-shrimp.jpg",
  "filet-lobster":
    "/images/menu/hibachi-plate.png",
  "shrimp-sca":
    "/images/menu/hibachi-plate.png",
  "hibachi-logo":
    "/images/logo-realhibachi.png",
  "chicken-scallop":
    "/images/menu/hibachi-plate.png",
    "chicken-shrimp":
    "/images/menu/chicken-and-beef.jpg"
}

// Package images - we'll use some of the same images for packages
export const packageImages = {
  basic:
    "/images/menu/chicken-and-beef.jpg",
  premium:
    "/images/menu/hibachi-plate.png",
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
