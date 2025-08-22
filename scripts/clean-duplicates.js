const fs = require('fs')
const path = require('path')

// List of all city directories to clean
const cityDirectories = [
  "los-angeles-city", "beverly-hills", "west-hollywood", "santa-monica", "venice",
  "culver-city", "manhattan-beach", "hermosa-beach", "redondo-beach", "torrance",
  "el-segundo", "burbank", "glendale", "pasadena", "arcadia", "monrovia",
  "san-gabriel", "alhambra", "monterey-park", "south-pasadena", "sherman-oaks",
  "studio-city", "north-hollywood", "encino", "tarzana", "woodland-hills",
  "inglewood", "hawthorne", "gardena", "carson", "long-beach", "lakewood",
  "downey", "whittier", "cerritos", "norwalk", "bellflower", "compton"
]

function cleanDuplicatesInFile(citySlug) {
  // Get the correct client file name
  let clientFileName
  if (citySlug === 'los-angeles-city') {
    clientFileName = 'LosAngelesCityServiceClient.tsx'
  } else {
    const cityDisplayName = citySlug.split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
    clientFileName = cityDisplayName.replace(/\s+/g, '') + 'ServiceClient.tsx'
  }
  
  const clientPath = path.join(__dirname, '..', 'app', 'service-area', citySlug, clientFileName)
  
  if (!fs.existsSync(clientPath)) {
    console.log(`File not found: ${clientPath}`)
    return
  }

  let content = fs.readFileSync(clientPath, 'utf8')
  
  // Remove duplicate storyContent lines
  content = content.replace(/\s+storyContent="[^"]*"\s+nearbyCities=\{[^\}]*\}\s+storyContent="[^"]*"\s+nearbyCities=\{[^\}]*\}/g, 
    function(match) {
      // Keep only the first occurrence
      const firstMatch = match.match(/\s+storyContent="[^"]*"\s+nearbyCities=\{[^\}]*\}/)
      return firstMatch ? firstMatch[0] : match
    })
  
  // Also handle cases where they're on separate lines
  const lines = content.split('\n')
  const cleanedLines = []
  let foundStoryContent = false
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    if (line.includes('storyContent=')) {
      if (!foundStoryContent) {
        cleanedLines.push(line)
        foundStoryContent = true
      }
      // Skip duplicate storyContent lines
    } else if (line.includes('nearbyCities=') && foundStoryContent) {
      // Only add the first nearbyCities after finding storyContent
      const hasNearbyInCleanedLines = cleanedLines.some(l => l.includes('nearbyCities='))
      if (!hasNearbyInCleanedLines) {
        cleanedLines.push(line)
      }
    } else {
      cleanedLines.push(line)
    }
  }
  
  content = cleanedLines.join('\n')
  
  fs.writeFileSync(clientPath, content)
  console.log(`Cleaned duplicates in ${citySlug}`)
}

// Clean all cities
cityDirectories.forEach(citySlug => {
  cleanDuplicatesInFile(citySlug)
})

console.log('\nAll duplicate attributes cleaned!')
