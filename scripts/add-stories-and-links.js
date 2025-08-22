const fs = require('fs')
const path = require('path')

// City stories and nearby cities data
const cityStoriesData = {
  "los-angeles": {
    cityName: "Los Angeles",
    story: "Last month, we brought our hibachi at home experience to a stunning downtown LA penthouse for Sarah's 30th birthday hibachi party. With the city lights twinkling below, our private chef performed amazing teppanyaki tricks while cooking fresh steak and shrimp. The birthday girl was amazed when our chef created the famous onion volcano right in her living room! This private birthday hibachi party became the talk of her Hollywood friends.",
    nearbyCities: ["Beverly Hills", "West Hollywood", "Santa Monica", "Culver City", "Burbank", "Glendale", "Pasadena"]
  },
  "beverly-hills": {
    cityName: "Beverly Hills",
    story: "We recently catered an elegant hibachi at home celebration at a beautiful Beverly Hills mansion on Rodeo Drive. The host wanted a private chef experience for their anniversary, and our Japanese teppanyaki master didn't disappoint. Between the luxury setting and our entertaining hibachi party performance, guests felt like celebrities dining at an exclusive restaurant. The sizzling sounds and delicious aromas filled their gorgeous estate dining room.",
    nearbyCities: ["West Hollywood", "Los Angeles", "Santa Monica", "Culver City", "Century City"]
  },
  "west-hollywood": {
    cityName: "West Hollywood",
    story: "At a trendy WeHo rooftop with Sunset Strip views, we hosted an unforgettable private birthday hibachi party for Marcus, a local artist. Our hibachi at home service transformed his modern loft into a Japanese steakhouse. The private chef's knife skills impressed the creative crowd, and the egg-catching trick had everyone cheering. This hibachi party perfectly matched West Hollywood's vibrant, artistic energy.",
    nearbyCities: ["Beverly Hills", "Los Angeles", "Santa Monica", "Culver City", "Sherman Oaks"]
  },
  "santa-monica": {
    cityName: "Santa Monica",
    story: "Picture this: a hibachi at home experience on a Santa Monica beachfront deck with ocean waves in the background. For Jessica's graduation celebration, our private chef created magic with fresh seafood while seagulls watched curiously. The hibachi party guests enjoyed teppanyaki-style salmon and shrimp as the Pacific sunset painted the sky. This private birthday hibachi party became a perfect California dream memory.",
    nearbyCities: ["Venice", "West Hollywood", "Beverly Hills", "Culver City", "Manhattan Beach"]
  },
  "venice": {
    cityName: "Venice",
    story: "In a converted warehouse loft near the Venice canals, we brought our hibachi at home magic to an eclectic group of artists and surfers. The private chef's performance fit perfectly with Venice's bohemian vibe. Local musicians played while we cooked, creating a unique hibachi party atmosphere. The private birthday hibachi party honoree, a street artist, said it was the most creative dining experience they'd ever had.",
    nearbyCities: ["Santa Monica", "Marina del Rey", "Culver City", "El Segundo"]
  },
  "culver-city": {
    cityName: "Culver City",
    story: "At a Culver City film studio executive's home, we provided a hibachi at home experience that felt like a movie premiere. Our private chef entertained industry professionals with dazzling teppanyaki skills between studio lots. The hibachi party became the perfect networking event, with the birthday girl's colleagues raving about this unique private birthday hibachi party concept. Hollywood magic meets Japanese culinary artistry!",
    nearbyCities: ["Santa Monica", "Venice", "Beverly Hills", "West Hollywood", "Manhattan Beach"]
  },
  "manhattan-beach": {
    cityName: "Manhattan Beach",
    story: "On The Strand with million-dollar ocean views, we delivered an upscale hibachi at home experience for the Thompson family reunion. Our private chef prepared fresh lobster and wagyu beef while beach volleyball players practiced nearby. This exclusive hibachi party showcased why Manhattan Beach is perfect for luxury celebrations. The private birthday hibachi party atmosphere matched the sophisticated beachfront community perfectly.",
    nearbyCities: ["Hermosa Beach", "Redondo Beach", "El Segundo", "Santa Monica", "Torrance"]
  },
  "hermosa-beach": {
    cityName: "Hermosa Beach",
    story: "During a lively Hermosa Beach house party, our hibachi at home service brought restaurant-quality entertainment to a group of young professionals. The private chef's fire tricks energized the party crowd, and the hibachi party vibe matched Hermosa's legendary nightlife scene. This private birthday hibachi party had guests dancing between courses, creating the ultimate beach town celebration experience.",
    nearbyCities: ["Manhattan Beach", "Redondo Beach", "Torrance", "El Segundo"]
  },
  "redondo-beach": {
    cityName: "Redondo Beach",
    story: "At a charming family home near Redondo Pier, three generations gathered for grandma's 80th hibachi at home celebration. Our private chef delighted everyone from toddlers to grandparents with gentle tricks and delicious food. The hibachi party brought the whole family together, creating precious memories. This private birthday hibachi party proved that our service creates magic for all ages in family-friendly Redondo Beach.",
    nearbyCities: ["Manhattan Beach", "Hermosa Beach", "Torrance", "Palos Verdes"]
  },
  "torrance": {
    cityName: "Torrance",
    story: "In Torrance's diverse community, we hosted a multicultural hibachi at home celebration where our private chef honored both Japanese traditions and local flavors. The hibachi party guests from various backgrounds bonded over amazing teppanyaki cooking. This private birthday hibachi party showcased how food brings people together, perfectly reflecting Torrance's wonderful cultural diversity and community spirit.",
    nearbyCities: ["Redondo Beach", "Manhattan Beach", "Gardena", "Carson", "El Segundo"]
  },
  "el-segundo": {
    cityName: "El Segundo",
    story: "At a tech startup's El Segundo headquarters, we brought hibachi at home innovation to their product launch party. Our private chef amazed the engineering team with precision cooking that matched their attention to detail. The hibachi party created the perfect blend of traditional Japanese artistry and modern Silicon Beach culture. This corporate private birthday hibachi party became their most talked-about company event.",
    nearbyCities: ["Manhattan Beach", "Hawthorne", "Torrance", "Inglewood", "Santa Monica"]
  },
  "burbank": {
    cityName: "Burbank",
    story: "Behind the scenes at a Burbank studio executive's home, we created a hibachi at home experience worthy of a movie set. Our private chef performed for entertainment industry VIPs with the same showmanship as their favorite actors. The hibachi party felt like an exclusive Hollywood event, complete with dramatic flair and perfect timing. This private birthday hibachi party proved that real entertainment happens off-camera too!",
    nearbyCities: ["Glendale", "North Hollywood", "Studio City", "Pasadena", "Los Angeles"]
  },
  "glendale": {
    cityName: "Glendale",
    story: "In Glendale's Armenian community, we adapted our hibachi at home service to honor both Japanese and Armenian hospitality traditions. Our private chef impressed three generations with skillful cooking while sharing cultural cooking techniques. The hibachi party became a beautiful cultural exchange, with guests teaching each other traditional toasts. This private birthday hibachi party celebrated diversity through delicious food and friendship.",
    nearbyCities: ["Burbank", "Pasadena", "Los Angeles", "North Hollywood", "Arcadia"]
  },
  "pasadena": {
    cityName: "Pasadena",
    story: "In a historic Pasadena Craftsman home, we brought hibachi at home elegance to a sophisticated dinner party during Rose Bowl season. Our private chef's artistry complemented the home's architectural beauty perfectly. The hibachi party guests from Caltech and JPL appreciated both the scientific precision of teppanyaki cooking and its entertainment value. This private birthday hibachi party combined old Pasadena charm with modern culinary innovation.",
    nearbyCities: ["Arcadia", "Glendale", "Burbank", "Los Angeles", "Monrovia", "Alhambra"]
  },
  "arcadia": {
    cityName: "Arcadia",
    story: "At a beautiful Arcadia estate near Santa Anita Park, we delivered a hibachi at home experience as elegant as the surrounding horse country. Our private chef prepared wagyu beef with the same attention to quality that Arcadia residents expect. The hibachi party unfolded in their magnificent backyard with mountain views, creating an atmosphere of luxury and tranquility. This private birthday hibachi party felt like dining at an exclusive country club.",
    nearbyCities: ["Pasadena", "Monrovia", "San Gabriel", "Alhambra", "Temple City"]
  },
  "monrovia": {
    cityName: "Monrovia",
    story: "In historic Old Town Monrovia, we brought hibachi at home charm to a cozy neighborhood gathering. Our private chef's warm personality matched the small-town community spirit perfectly. The hibachi party neighbors all joined in, creating an impromptu block party atmosphere. This private birthday hibachi party showed how food brings communities together, embodying Monrovia's friendly, close-knit character.",
    nearbyCities: ["Arcadia", "Pasadena", "Duarte", "Bradbury", "Azusa"]
  },
  "san-gabriel": {
    cityName: "San Gabriel",
    story: "At a San Gabriel family celebration, we created a unique hibachi at home fusion experience honoring both Japanese and Chinese culinary traditions. Our private chef delighted guests by incorporating local Asian market ingredients into classic teppanyaki dishes. The hibachi party became a beautiful cultural bridge, celebrating the area's rich heritage. This private birthday hibachi party proved that great food transcends cultural boundaries.",
    nearbyCities: ["Alhambra", "Monterey Park", "Arcadia", "Rosemead", "Temple City"]
  },
  "alhambra": {
    cityName: "Alhambra",
    story: "In Alhambra's diverse community, our hibachi at home service brought together families from different backgrounds for a heartwarming celebration. The private chef's entertaining cooking style delighted children while impressing adults from various cultures. This hibachi party showcased how food creates universal joy and connection. The private birthday hibachi party became a neighborhood legend, with requests for repeat performances.",
    nearbyCities: ["San Gabriel", "Monterey Park", "Pasadena", "Los Angeles", "South Pasadena"]
  },
  "monterey-park": {
    cityName: "Monterey Park",
    story: "At a Monterey Park family reunion, we brought hibachi at home excitement to four generations of a Chinese-American family. Our private chef amazed grandparents who immigrated decades ago while entertaining American-born grandchildren. The hibachi party created bridges between traditional and modern dining experiences. This private birthday hibachi party became a cherished family memory spanning cultures and generations.",
    nearbyCities: ["Alhambra", "San Gabriel", "Rosemead", "East Los Angeles"]
  },
  "south-pasadena": {
    cityName: "South Pasadena",
    story: "In a charming South Pasadena Craftsman bungalow, we delivered an intimate hibachi at home experience that matched the town's cozy, village-like atmosphere. Our private chef's gentle, family-friendly approach won over multiple generations. The hibachi party felt like a neighborhood tradition, with the warmth and care that South Pasadena is known for. This private birthday hibachi party created the perfect small-town celebration.",
    nearbyCities: ["Pasadena", "Alhambra", "Los Angeles", "Monterey Park"]
  },
  "sherman-oaks": {
    cityName: "Sherman Oaks",
    story: "High in the Sherman Oaks hills with spectacular Valley views, we provided a hibachi at home experience for entertainment industry professionals. Our private chef's theatrical skills impressed directors and producers who appreciate great performance. The hibachi party overlooked the twinkling Valley lights, creating movie-like ambiance. This private birthday hibachi party felt like an exclusive Hollywood Hills gathering.",
    nearbyCities: ["Studio City", "Encino", "North Hollywood", "Beverly Hills", "West Hollywood"]
  },
  "studio-city": {
    cityName: "Studio City",
    story: "At a Studio City creative's home near the studios, we brought hibachi at home artistry to a gathering of writers and actors. Our private chef's improvisational cooking style resonated with the creative crowd's spontaneous energy. The hibachi party became an inspiring artistic collaboration, with guests suggesting flavor combinations. This private birthday hibachi party proved that creativity enhances every aspect of dining.",
    nearbyCities: ["Sherman Oaks", "North Hollywood", "Encino", "Burbank", "Universal City"]
  },
  "north-hollywood": {
    cityName: "North Hollywood",
    story: "In NoHo's arts district, we delivered a hibachi at home experience to a loft filled with actors, dancers, and musicians. Our private chef's performance art approach to cooking mesmerized the artistic community. The hibachi party became an immersive dinner theater experience, blending culinary and performing arts. This private birthday hibachi party showcased North Hollywood's creative spirit through food.",
    nearbyCities: ["Studio City", "Sherman Oaks", "Burbank", "Glendale", "Valley Village"]
  },
  "encino": {
    cityName: "Encino",
    story: "At a luxurious Encino estate with resort-style amenities, we created an upscale hibachi at home experience matching the sophisticated Valley lifestyle. Our private chef prepared premium ingredients with five-star presentation for successful business executives. The hibachi party felt like an exclusive members-only club gathering. This private birthday hibachi party epitomized Encino's blend of luxury, comfort, and California sophistication.",
    nearbyCities: ["Sherman Oaks", "Studio City", "Tarzana", "Woodland Hills", "Van Nuys"]
  },
  "tarzana": {
    cityName: "Tarzana",
    story: "In a beautiful Tarzana hillside home, we brought hibachi at home elegance to a milestone anniversary celebration. Our private chef's refined techniques impressed this upscale community's discerning tastes. The hibachi party unfolded in their stunning backyard overlooking the Valley, creating an atmosphere of celebration and luxury. This private birthday hibachi party exemplified Tarzana's reputation for sophisticated entertaining.",
    nearbyCities: ["Encino", "Woodland Hills", "Sherman Oaks", "Reseda", "Canoga Park"]
  },
  "woodland-hills": {
    cityName: "Woodland Hills",
    story: "At a Warner Center executive's Woodland Hills home, we provided a hibachi at home experience that impressed business leaders from the corporate district. Our private chef's professional presentation matched their high standards for entertaining clients. The hibachi party created the perfect atmosphere for relationship building and celebration. This private birthday hibachi party demonstrated why successful professionals choose our premium service.",
    nearbyCities: ["Tarzana", "Encino", "Canoga Park", "West Hills", "Warner Center"]
  },
  "inglewood": {
    cityName: "Inglewood",
    story: "Near the excitement of SoFi Stadium, we brought hibachi at home energy to an Inglewood sports celebration. Our private chef's dynamic cooking style matched the community's athletic spirit and enthusiasm. The hibachi party guests cheered for cooking tricks like they were at a Lakers game! This private birthday hibachi party captured Inglewood's vibrant community pride and love for spectacular entertainment.",
    nearbyCities: ["Hawthorne", "El Segundo", "Los Angeles", "Culver City"]
  },
  "hawthorne": {
    cityName: "Hawthorne",
    story: "In Hawthorne's aerospace community, we delivered a hibachi at home experience that impressed engineers and aviation professionals. Our private chef's precision cooking techniques resonated with their appreciation for technical excellence. The hibachi party combined entertainment with the methodical approach that Hawthorne's tech industry values. This private birthday hibachi party celebrated both innovation and tradition.",
    nearbyCities: ["Inglewood", "El Segundo", "Torrance", "Gardena", "Lawndale"]
  },
  "gardena": {
    cityName: "Gardena",
    story: "At a Gardena family gathering celebrating Japanese-American heritage, we brought authentic hibachi at home traditions to a community with deep cultural roots. Our private chef honored both traditional techniques and modern California influences. The hibachi party became a beautiful cultural celebration, connecting generations through food and storytelling. This private birthday hibachi party honored Gardena's rich Japanese-American legacy.",
    nearbyCities: ["Torrance", "Carson", "Hawthorne", "Compton", "Los Angeles"]
  },
  "carson": {
    cityName: "Carson",
    story: "At a large Carson family gathering with multiple generations, we created a hibachi at home experience that brought everyone together around our cooking station. Our private chef's family-friendly approach delighted children while satisfying adults' sophisticated tastes. The hibachi party became the centerpiece of their reunion, creating lasting memories. This private birthday hibachi party exemplified Carson's strong family values and community spirit.",
    nearbyCities: ["Gardena", "Torrance", "Long Beach", "Compton", "Wilmington"]
  },
  "long-beach": {
    cityName: "Long Beach",
    story: "At a Long Beach waterfront home with harbor views, we brought hibachi at home excitement to a port city celebration. Our private chef prepared fresh seafood while ships passed in the distance, creating a unique maritime dining experience. The hibachi party guests enjoyed the coastal atmosphere and spectacular cooking performance. This private birthday hibachi party captured Long Beach's dynamic blend of urban energy and coastal charm.",
    nearbyCities: ["Carson", "Lakewood", "Signal Hill", "Seal Beach", "Torrance"]
  },
  "lakewood": {
    cityName: "Lakewood",
    story: "In Lakewood's planned community, we delivered a hibachi at home experience that matched the neighborhood's family-focused values. Our private chef's wholesome approach and interactive cooking delighted parents and children alike. The hibachi party became the talk of the subdivision, with neighbors asking for referrals. This private birthday hibachi party showcased why Lakewood families choose experiences that bring people together.",
    nearbyCities: ["Long Beach", "Cerritos", "Bellflower", "Norwalk", "Carson"]
  },
  "downey": {
    cityName: "Downey",
    story: "At a historic Downey home with aerospace heritage, we brought hibachi at home innovation to a community proud of its contributions to space exploration. Our private chef's technical precision impressed guests who appreciate engineering excellence. The hibachi party celebrated both tradition and progress, values that define Downey. This private birthday hibachi party honored the city's legacy while creating new memories.",
    nearbyCities: ["Norwalk", "Bellflower", "Whittier", "Pico Rivera", "Bell Gardens"]
  },
  "whittier": {
    cityName: "Whittier",
    story: "In Whittier's hills with beautiful city views, we created a hibachi at home experience for a multi-generational Hispanic family celebration. Our private chef respectfully blended Japanese techniques with familiar flavors, creating fusion magic. The hibachi party honored both cultural traditions while building new ones. This private birthday hibachi party became a beautiful example of cultural appreciation and family unity.",
    nearbyCities: ["Downey", "Norwalk", "La Mirada", "Pico Rivera", "Santa Fe Springs"]
  },
  "cerritos": {
    cityName: "Cerritos",
    story: "At a modern Cerritos home in this well-planned community, we delivered a hibachi at home experience that impressed the area's diverse, educated residents. Our private chef's international background resonated with families from around the world. The hibachi party showcased the global appreciation for quality food and entertainment. This private birthday hibachi party reflected Cerritos' reputation for embracing diverse cultures and excellence.",
    nearbyCities: ["Lakewood", "Norwalk", "Bellflower", "La Palma", "Artesia"]
  },
  "norwalk": {
    cityName: "Norwalk",
    story: "At a Norwalk community center gathering, we brought hibachi at home excitement to a neighborhood celebration. Our private chef's engaging personality matched the city's friendly, welcoming spirit. The hibachi party brought together families from throughout the community, creating new friendships over delicious food. This private birthday hibachi party demonstrated how shared meals strengthen community bonds.",
    nearbyCities: ["Cerritos", "Downey", "Whittier", "Bellflower", "La Mirada"]
  },
  "bellflower": {
    cityName: "Bellflower",
    story: "In Bellflower's close-knit neighborhood, we created a hibachi at home experience that felt like a family gathering. Our private chef's warm, personal approach won over this tight community where everyone knows each other. The hibachi party had neighbors dropping by to see what smelled so amazing! This private birthday hibachi party became the kind of local legend that makes small communities special.",
    nearbyCities: ["Cerritos", "Lakewood", "Norwalk", "Downey", "Paramount"]
  },
  "compton": {
    cityName: "Compton",
    story: "At a Compton community celebration, we brought hibachi at home pride to a neighborhood known for resilience and creativity. Our private chef's energetic performance style matched the community's dynamic spirit and cultural richness. The hibachi party became an uplifting celebration of good food, family, and community strength. This private birthday hibachi party honored Compton's legacy while creating positive new memories for all generations.",
    nearbyCities: ["Carson", "Gardena", "Lynwood", "Paramount", "Willowbrook"]
  }
}

// Mapping from file slugs to story keys
const cityMappings = {
  "los-angeles-city": "los-angeles",
  "beverly-hills": "beverly-hills",
  "west-hollywood": "west-hollywood", 
  "santa-monica": "santa-monica",
  "venice": "venice",
  "culver-city": "culver-city",
  "manhattan-beach": "manhattan-beach",
  "hermosa-beach": "hermosa-beach",
  "redondo-beach": "redondo-beach",
  "torrance": "torrance",
  "el-segundo": "el-segundo",
  "burbank": "burbank",
  "glendale": "glendale",
  "pasadena": "pasadena",
  "arcadia": "arcadia",
  "monrovia": "monrovia",
  "san-gabriel": "san-gabriel",
  "alhambra": "alhambra",
  "monterey-park": "monterey-park",
  "south-pasadena": "south-pasadena",
  "sherman-oaks": "sherman-oaks",
  "studio-city": "studio-city",
  "north-hollywood": "north-hollywood",
  "encino": "encino",
  "tarzana": "tarzana",
  "woodland-hills": "woodland-hills",
  "inglewood": "inglewood",
  "hawthorne": "hawthorne",
  "gardena": "gardena",
  "carson": "carson",
  "long-beach": "long-beach",
  "lakewood": "lakewood",
  "downey": "downey",
  "whittier": "whittier",
  "cerritos": "cerritos",
  "norwalk": "norwalk",
  "bellflower": "bellflower",
  "compton": "compton"
}

function updateCityServiceClient(citySlug, cityDisplayName) {
  const storyKey = cityMappings[citySlug]
  
  if (!storyKey || !cityStoriesData[storyKey]) {
    console.log(`No story data found for ${citySlug}`)
    return
  }

  const storyData = cityStoriesData[storyKey]
  
  // Handle special case for Los Angeles City
  let clientFileName
  if (citySlug === 'los-angeles-city') {
    clientFileName = 'LosAngelesCityServiceClient.tsx'
  } else {
    clientFileName = cityDisplayName.replace(/\s+/g, '') + 'ServiceClient.tsx'
  }
  
  const clientPath = path.join(__dirname, '..', 'app', 'service-area', citySlug, clientFileName)
  
  if (!fs.existsSync(clientPath)) {
    console.log(`File not found: ${clientPath}`)
    return
  }

  let content = fs.readFileSync(clientPath, 'utf8')
  
  // Add storyContent and nearbyCities props
  const storyContent = storyData.story.replace(/"/g, '\\"')
  const nearbyCities = JSON.stringify(storyData.nearbyCities)
  
  // Find the closing of CityServiceTemplate props and add new props before it
  const propsEndRegex = /(cityHighlights=\{[^}]*\})\s*\/>/
  
  if (content.match(propsEndRegex)) {
    content = content.replace(
      propsEndRegex,
      `$1
      storyContent="${storyContent}"
      nearbyCities={${nearbyCities}}
    />`
    )
  } else {
    // If no cityHighlights, add before the closing />
    content = content.replace(
      /(\s+)\/>/,
      `$1storyContent="${storyContent}"
      nearbyCities={${nearbyCities}}
    />`
    )
  }
  
  fs.writeFileSync(clientPath, content)
  console.log(`Updated ${cityDisplayName} with story and nearby cities`)
}

// Update all cities
Object.keys(cityMappings).forEach(citySlug => {
  const cityDisplayName = citySlug.split('-').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ')
  
  // Handle special cases
  if (citySlug === 'los-angeles-city') {
    updateCityServiceClient(citySlug, 'Los Angeles')
  } else {
    updateCityServiceClient(citySlug, cityDisplayName)
  }
})

console.log('\nAll cities updated with stories and nearby city links!')
