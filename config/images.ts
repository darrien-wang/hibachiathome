// Menu item images
export const menuImages = {
  "chicken-steak":
    "https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hibachiimage/Chicken-and-Beef-Hibachi-Catering-LA-itQYZOc95RTr9yWdNJOr1NiXsBBIBu.jpg",
  "steak-shrimp":
    "https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hibachiimage/beef-and-shrimp-Hibachi-Catering-LA-NRW9nr9Zd1SvIX9ZgF481S1k2rplaH.jpg",
  "filet-chicken-shrimp":
    "https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hibachiimage/filetchickenshrimp-Hibachi-Catering-LA-s2QYxFQesPB2wRPyaCJabQ5nGIPH4V.jpg",
  "filet-lobster":
    "https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hibachiimage/filetlobster-hibachi-catering-la-6ZxNKSPHgqPZw4uLxGMXjcoQVoEQhB.jpg",
  "shrimp-sca":
    "https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hibachiimage/RC7dYRhyfNFo-njYBXDvbfaLBzIKpNc943JTjkfX7D8.png",
  "hibachi-logo":
    "https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hibachiimage/hibachidoge-mfIO7eb5OysEpROnF0PZMbbjMaZzYl.png",
  "chicken-scallop":
    "https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hibachiimage/images-hNctUIvTEU7qVt4PnyRu9EYLLZ1WHa.jpg",
    "chicken-shrimp":
    "https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hibachiimage/chiken_shrimps-gk9raxJIf9vMkA73P0D1R7AxNnwx4J.jpg"
}

// Package images - we'll use some of the same images for packages
export const packageImages = {
  basic:
    "https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hibachiimage/Chicken-and-Beef-Hibachi-Catering-LA-itQYZOc95RTr9yWdNJOr1NiXsBBIBu.jpg",
  premium:
    "https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hibachiimage/filetlobster-hibachi-catering-la-6ZxNKSPHgqPZw4uLxGMXjcoQVoEQhB.jpg",
  buffet:
    "https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hibachiimage/filetchickenshrimp-Hibachi-Catering-LA-s2QYxFQesPB2wRPyaCJabQ5nGIPH4V.jpg",
}

// Function to get image URL by ID
export const getMenuImageById = (id: string): string => {
  return menuImages[id] || "/hibachi-food.png"
}

// Function to get package image URL by ID
export const getPackageImageById = (id: string): string => {
  return packageImages[id] || "/hibachi-package.png"
}
