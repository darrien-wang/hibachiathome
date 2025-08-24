interface CityData {
  name: string
  slug: string
  description: string
  zipCodes: string[]
  neighborhoods: string[]
  popularVenues: string[]
  cityHighlights: string[]
}

export const laCitiesData: CityData[] = [
  {
    name: "Los Angeles",
    slug: "los-angeles-city",
    description: "Experience premium hibachi at home service in downtown Los Angeles and surrounding areas.",
    zipCodes: ["90012", "90013", "90014", "90015", "90017", "90028", "90036", "90038", "90048", "90068"],
    neighborhoods: ["Downtown", "Hollywood", "Mid-City", "Koreatown", "Los Feliz", "Silver Lake"],
    popularVenues: ["Private Residences", "Event Halls", "Corporate Venues", "Rooftop Spaces"],
    cityHighlights: ["Major business and financial center of the West Coast", "Home to Hollywood entertainment industry", "Diverse cultural neighborhoods and communities"]
  },
  {
    name: "Beverly Hills",
    slug: "beverly-hills",
    description: "Luxury hibachi chef service in prestigious Beverly Hills, bringing five-star dining to your elegant home.",
    zipCodes: ["90210", "90211", "90212"],
    neighborhoods: ["Beverly Hills Flats", "Trousdale Estates", "Beverly Hills Post Office", "North Beverly Hills"],
    popularVenues: ["Luxury Private Residences", "Estate Properties", "Private Clubs", "Executive Mansions"],
    cityHighlights: ["World-famous luxury shopping on Rodeo Drive", "Home to Hollywood celebrities and entertainment figures", "Prestigious residential neighborhoods and estates"]
  },
  {
    name: "West Hollywood",
    slug: "west-hollywood",
    description: "Contemporary hibachi dining experience in trendy West Hollywood, perfect for stylish gatherings.",
    zipCodes: ["90069", "90046"],
    neighborhoods: ["West Hollywood", "Sunset Strip", "Design District", "Melrose District"],
    popularVenues: ["Modern Condos", "Loft Spaces", "Rooftop Venues", "Creative Event Spaces"],
    cityHighlights: ["Vibrant nightlife and entertainment scene on Sunset Strip", "LGBTQ+ friendly community with inclusive culture", "Trendy restaurants, bars, and creative venues"]
  },
  {
    name: "Santa Monica",
    slug: "santa-monica",
    description: "Beachside hibachi at home service in Santa Monica, combining ocean vibes with authentic Japanese cuisine.",
    zipCodes: ["90401", "90402", "90403", "90404", "90405"],
    neighborhoods: ["Santa Monica Pier", "Third Street Promenade", "Main Street", "Pico Boulevard", "Ocean Park"],
    popularVenues: ["Beachfront Properties", "High-rise Condos", "Beach Houses", "Ocean View Venues"],
    cityHighlights: ["Beautiful Pacific Ocean beaches and coastline", "Famous Santa Monica Pier with amusement park", "Third Street Promenade shopping and dining"]
  },
  {
    name: "Venice",
    slug: "venice",
    description: "Bohemian hibachi experience in artistic Venice, bringing Japanese flair to this creative coastal community.",
    zipCodes: ["90291", "90292"],
    neighborhoods: ["Venice Beach", "Abbot Kinney", "Rose Avenue", "Marina Peninsula"],
    popularVenues: ["Artistic Lofts", "Beach Properties", "Creative Spaces", "Canal-side Homes"],
    cityHighlights: ["Bohemian arts community and creative culture", "Famous Venice Beach boardwalk and street performers", "Unique canal neighborhoods and artistic murals"]
  },
  {
    name: "Culver City",
    slug: "culver-city",
    description: "Professional hibachi service in the heart of Culver City, perfect for entertainment industry events.",
    zipCodes: ["90230", "90232"],
    neighborhoods: ["Downtown Culver City", "Fox Hills", "Hayden Tract", "Culver West"],
    popularVenues: ["Studio Lots", "Production Offices", "Modern Apartments", "Corporate Facilities"],
    specialFeatures: ["Entertainment industry experience", "Studio-friendly scheduling", "Production catering expertise"]
  },
  {
    name: "Manhattan Beach",
    slug: "manhattan-beach",
    description: "Upscale beachside hibachi service in Manhattan Beach, bringing premium dining to luxury coastal homes.",
    zipCodes: ["90266"],
    neighborhoods: ["The Strand", "Manhattan Village", "Sand Section", "Hill Section", "Tree Section"],
    popularVenues: ["Beachfront Mansions", "Luxury Beach Houses", "Strand Properties", "Private Beach Clubs"],
    specialFeatures: ["Luxury beachside service", "High-end presentation", "Oceanfront dining expertise"]
  },
  {
    name: "Hermosa Beach",
    slug: "hermosa-beach",
    description: "Fun and energetic hibachi service in party-loving Hermosa Beach, perfect for celebrations.",
    zipCodes: ["90254"],
    neighborhoods: ["The Strand", "Hermosa Valley", "North Hermosa", "South Hermosa"],
    popularVenues: ["Beach Condos", "Party Houses", "Beachfront Properties", "Group Vacation Rentals"],
    specialFeatures: ["Party atmosphere specialists", "Young crowd favorites", "Celebration-focused presentations"]
  },
  {
    name: "Redondo Beach",
    slug: "redondo-beach",
    description: "Relaxed hibachi dining experience in family-friendly Redondo Beach with coastal charm.",
    zipCodes: ["90277", "90278"],
    neighborhoods: ["Redondo Pier", "Riviera Village", "Hollywood Riviera", "South Redondo"],
    popularVenues: ["Family Homes", "Beach Properties", "Community Centers", "Pier-area Venues"],
    specialFeatures: ["Family-friendly service", "Coastal community atmosphere", "Multi-generational event expertise"]
  },
  {
    name: "Torrance",
    slug: "torrance",
    description: "Suburban hibachi at home service in diverse Torrance, bringing authentic Japanese flavors to your neighborhood.",
    zipCodes: ["90501", "90502", "90503", "90504", "90505"],
    neighborhoods: ["Old Torrance", "West Torrance", "North Torrance", "South Bay", "Del Amo"],
    popularVenues: ["Residential Homes", "Community Centers", "Corporate Offices", "Shopping Center Venues"],
    specialFeatures: ["Suburban family specialists", "Cultural diversity appreciation", "Community event expertise"]
  },
  {
    name: "El Segundo",
    slug: "el-segundo",
    description: "Professional hibachi catering in tech-savvy El Segundo, ideal for corporate and residential events.",
    zipCodes: ["90245"],
    neighborhoods: ["Downtown El Segundo", "Smoky Hollow", "Recreation Park", "Grand Avenue"],
    popularVenues: ["Tech Company Offices", "Corporate Headquarters", "Modern Apartments", "Event Spaces"],
    specialFeatures: ["Corporate event specialists", "Tech industry experience", "Professional presentation standards"]
  },
  {
    name: "Burbank",
    slug: "burbank",
    description: "Entertainment capital hibachi service in Burbank, bringing showbiz flair to your dining experience.",
    zipCodes: ["91501", "91502", "91503", "91504", "91505", "91506"],
    neighborhoods: ["Downtown Burbank", "Magnolia Park", "Rancho Equestrian", "Toluca Lake area"],
    popularVenues: ["Studio Executive Homes", "Entertainment Industry Venues", "Family Residences", "Corporate Studios"],
    specialFeatures: ["Entertainment industry connections", "Show business atmosphere", "Celebrity-level service"]
  },
  {
    name: "Glendale",
    slug: "glendale",
    description: "Diverse cultural hibachi experience in Glendale, celebrating the area's rich multicultural community.",
    zipCodes: ["91201", "91202", "91203", "91204", "91205", "91206", "91207", "91208"],
    neighborhoods: ["Downtown Glendale", "Verdugo Mountains", "Rossmoyne", "Sparr Heights", "Adams Hill"],
    popularVenues: ["Cultural Community Centers", "Family Homes", "Corporate Venues", "Mountain View Properties"],
    specialFeatures: ["Multicultural event expertise", "Armenian community favorites", "Hillside venue accommodations"]
  },
  {
    name: "Pasadena",
    slug: "pasadena",
    description: "Historic charm meets modern hibachi in Pasadena, perfect for elegant gatherings in the City of Roses.",
    zipCodes: ["91101", "91102", "91103", "91104", "91105", "91106", "91107"],
    neighborhoods: ["Old Pasadena", "South Lake District", "Caltech area", "Altadena border", "San Rafael"],
    popularVenues: ["Historic Mansions", "Craftsman Homes", "Rose Bowl area", "Academic Institution Venues"],
    specialFeatures: ["Historic venue specialists", "Rose Bowl event experience", "Academic community service"]
  },
  {
    name: "Arcadia",
    slug: "arcadia",
    description: "Upscale hibachi service in beautiful Arcadia, bringing premium dining to this prestigious foothill community.",
    zipCodes: ["91006", "91007"],
    neighborhoods: ["Arcadia Highlands", "Santa Anita area", "Foothill Boulevard", "Live Oak area"],
    popularVenues: ["Luxury Estates", "Gated Communities", "Country Club Venues", "Foothill Properties"],
    specialFeatures: ["Luxury community specialists", "Country club experience", "Upscale presentation standards"]
  },
  {
    name: "Monrovia",
    slug: "monrovia",
    description: "Charming foothill hibachi service in historic Monrovia, combining small-town warmth with authentic cuisine.",
    zipCodes: ["91016", "91017"],
    neighborhoods: ["Old Town Monrovia", "Foothill area", "Hillcrest", "Library District"],
    popularVenues: ["Historic Homes", "Family Residences", "Community Venues", "Foothill Properties"],
    specialFeatures: ["Historic community charm", "Small-town personal service", "Foothill venue expertise"]
  },
  {
    name: "San Gabriel",
    slug: "san-gabriel",
    description: "Authentic Asian fusion hibachi in San Gabriel, honoring the area's rich Asian heritage and culture.",
    zipCodes: ["91775", "91776"],
    neighborhoods: ["San Gabriel Square", "Mission District", "Temple City border", "Rosemead border"],
    popularVenues: ["Asian Community Centers", "Cultural Venues", "Family Homes", "Community Gathering Spaces"],
    specialFeatures: ["Asian community specialists", "Cultural sensitivity", "Traditional Asian hospitality"]
  },
  {
    name: "Alhambra",
    slug: "alhambra",
    description: "Culturally rich hibachi experience in Alhambra, celebrating diversity through authentic Japanese cuisine.",
    zipCodes: ["91801", "91802", "91803"],
    neighborhoods: ["Downtown Alhambra", "Monterey Park border", "South Pasadena area", "San Gabriel border"],
    popularVenues: ["Cultural Centers", "Multi-generational Homes", "Community Spaces", "Cultural Event Venues"],
    specialFeatures: ["Cultural diversity celebration", "Multi-generational service", "Traditional hospitality"]
  },
  {
    name: "Monterey Park",
    slug: "monterey-park",
    description: "Authentic Asian community hibachi service in Monterey Park, blending Japanese and Chinese culinary traditions.",
    zipCodes: ["91754", "91755"],
    neighborhoods: ["East LA border", "Garvey Avenue", "Atlantic Boulevard", "Monterey Park Highlands"],
    popularVenues: ["Asian Family Homes", "Community Centers", "Cultural Event Spaces", "Multi-family Residences"],
    specialFeatures: ["Asian community expertise", "Bilingual service options", "Cultural fusion presentations"]
  },
  {
    name: "South Pasadena",
    slug: "south-pasadena",
    description: "Quaint community hibachi service in charming South Pasadena, perfect for intimate family gatherings.",
    zipCodes: ["91030", "91031"],
    neighborhoods: ["Mission Street area", "Huntington Drive", "Fair Oaks", "Diamond Avenue"],
    popularVenues: ["Craftsman Homes", "Family Residences", "Small Community Venues", "Historic Properties"],
    specialFeatures: ["Small community intimacy", "Family-focused service", "Historic home accommodations"]
  },
  {
    name: "Sherman Oaks",
    slug: "sherman-oaks",
    description: "Sophisticated hibachi dining in upscale Sherman Oaks, bringing elegance to this prestigious Valley community.",
    zipCodes: ["91403", "91423"],
    neighborhoods: ["Ventura Boulevard", "Mulholland Drive area", "Coldwater Canyon", "Beverly Glen"],
    popularVenues: ["Hillside Estates", "Modern Condos", "Executive Homes", "Ventura Boulevard venues"],
    specialFeatures: ["Valley sophistication", "Hillside venue specialists", "Executive-level service"]
  },
  {
    name: "Studio City",
    slug: "studio-city",
    description: "Creative hibachi experiences in entertainment-focused Studio City, perfect for industry professionals.",
    zipCodes: ["91604", "91614"],
    neighborhoods: ["Ventura Boulevard", "Laurel Canyon", "Colfax Meadows", "Woodbridge Park"],
    popularVenues: ["Entertainment Industry Homes", "Creative Spaces", "Studio Executive Residences", "Industry Venues"],
    specialFeatures: ["Entertainment industry focus", "Creative presentation styles", "Industry networking events"]
  },
  {
    name: "North Hollywood",
    slug: "north-hollywood",
    description: "Arts-focused hibachi service in creative North Hollywood, bringing culinary artistry to the NoHo Arts District.",
    zipCodes: ["91601", "91602", "91603", "91605", "91606", "91607", "91608"],
    neighborhoods: ["NoHo Arts District", "Valley Village", "Toluca Lake border", "Universal City area"],
    popularVenues: ["Artist Lofts", "Creative Spaces", "Theater District venues", "Arts Community Centers"],
    specialFeatures: ["Arts community specialists", "Creative dietary options", "Artistic presentation flair"]
  },
  {
    name: "Encino",
    slug: "encino",
    description: "Luxury hibachi service in affluent Encino, delivering premium dining experiences to elegant Valley homes.",
    zipCodes: ["91316", "91426", "91436"],
    neighborhoods: ["South of Ventura", "Encino Hills", "Royal Oaks", "Balboa area"],
    popularVenues: ["Luxury Estates", "Gated Communities", "Country Club venues", "Executive Homes"],
    specialFeatures: ["Luxury Valley service", "Upscale presentation", "Country club experience"]
  },
  {
    name: "Tarzana",
    slug: "tarzana",
    description: "Exclusive hibachi at home service in upscale Tarzana, bringing five-star dining to this prestigious Valley community.",
    zipCodes: ["91335", "91356"],
    neighborhoods: ["South Tarzana", "Tarzana Hills", "Ventura Boulevard area", "Mulholland area"],
    popularVenues: ["Estate Properties", "Hillside Homes", "Luxury Residences", "Private Estates"],
    specialFeatures: ["Estate service specialists", "Hillside venue expertise", "Executive-level presentations"]
  },
  {
    name: "Woodland Hills",
    slug: "woodland-hills",
    description: "Upscale hibachi catering in beautiful Woodland Hills, perfect for elegant gatherings in this scenic Valley locale.",
    zipCodes: ["91364", "91365", "91367"],
    neighborhoods: ["Warner Center", "West Hills border", "Calabasas border", "Topanga area"],
    popularVenues: ["Corporate Centers", "Luxury Homes", "Golf Course venues", "Mountain View Properties"],
    specialFeatures: ["Corporate event expertise", "Scenic venue accommodations", "Warner Center business district service"]
  },
  {
    name: "Inglewood",
    slug: "inglewood",
    description: "Community-focused hibachi service in vibrant Inglewood, bringing authentic flavors to this diverse neighborhood.",
    zipCodes: ["90301", "90302", "90303", "90304", "90305", "90306", "90308", "90309", "90311"],
    neighborhoods: ["Downtown Inglewood", "Morningside Park", "Fairview Heights", "Centinela Heights"],
    popularVenues: ["Community Centers", "Family Homes", "Cultural Venues", "Sports-related venues"],
    specialFeatures: ["Community event specialists", "Cultural diversity celebration", "Sports venue experience"]
  },
  {
    name: "Hawthorne",
    slug: "hawthorne",
    description: "Neighborhood hibachi service in working-class Hawthorne, bringing affordable luxury to local families.",
    zipCodes: ["90250"],
    neighborhoods: ["Downtown Hawthorne", "Del Aire border", "Lawndale border", "El Segundo area"],
    popularVenues: ["Family Homes", "Community Centers", "Local Event Spaces", "Neighborhood Gatherings"],
    specialFeatures: ["Affordable luxury options", "Family-friendly service", "Community-focused events"]
  },
  {
    name: "Gardena",
    slug: "gardena",
    description: "Multicultural hibachi experience in diverse Gardena, celebrating the area's Japanese heritage and modern diversity.",
    zipCodes: ["90247", "90248", "90249"],
    neighborhoods: ["Downtown Gardena", "Strawberry Park", "Alondra Park area", "Harbor Gateway"],
    popularVenues: ["Cultural Centers", "Japanese Community Venues", "Family Homes", "Community Gathering Spaces"],
    specialFeatures: ["Japanese heritage celebration", "Multicultural community service", "Traditional and modern fusion"]
  },
  {
    name: "Carson",
    slug: "carson",
    description: "Family-oriented hibachi service in suburban Carson, perfect for community celebrations and family gatherings.",
    zipCodes: ["90745", "90746", "90747", "90810"],
    neighborhoods: ["West Carson", "Carson Park", "Dominguez Hills area", "Harbor area"],
    popularVenues: ["Family Homes", "Community Centers", "Sports Complexes", "Suburban Event Venues"],
    specialFeatures: ["Suburban family specialists", "Large group accommodations", "Sports-themed events"]
  },
  {
    name: "Long Beach",
    slug: "long-beach",
    description: "Coastal hibachi excellence in Long Beach, bringing oceanside dining experiences to this vibrant port city.",
    zipCodes: ["90801", "90802", "90803", "90804", "90805", "90806", "90807", "90808", "90810", "90813", "90814", "90815"],
    neighborhoods: ["Downtown Long Beach", "Belmont Shore", "Naples", "Bixby Knolls", "California Heights"],
    popularVenues: ["Waterfront Properties", "Downtown Venues", "Beach Houses", "Port-area Corporate Venues"],
    specialFeatures: ["Waterfront venue specialists", "Port city atmosphere", "Coastal event expertise"]
  },
  {
    name: "Lakewood",
    slug: "lakewood",
    description: "Suburban hibachi service in family-friendly Lakewood, bringing restaurant-quality dining to your neighborhood home.",
    zipCodes: ["90712", "90713"],
    neighborhoods: ["Lakewood Village", "Lakewood Park", "Mayfair area", "Long Beach border"],
    popularVenues: ["Residential Homes", "Community Centers", "Family-friendly Venues", "Neighborhood Spaces"],
    specialFeatures: ["Suburban community focus", "Family event specialists", "Neighborhood-friendly service"]
  },
  {
    name: "Downey",
    slug: "downey",
    description: "Traditional community hibachi service in historic Downey, combining small-town charm with authentic cuisine.",
    zipCodes: ["90239", "90240", "90241", "90242"],
    neighborhoods: ["Downtown Downey", "North Downey", "South Downey", "Norwalk border"],
    popularVenues: ["Historic Homes", "Community Centers", "Family Residences", "Cultural Venues"],
    specialFeatures: ["Historic community charm", "Small-town personal service", "Traditional family values"]
  },
  {
    name: "Whittier",
    slug: "whittier",
    description: "Community-centered hibachi service in friendly Whittier, perfect for celebrating life's special moments together.",
    zipCodes: ["90601", "90602", "90603", "90604", "90605", "90606", "90607", "90608"],
    neighborhoods: ["Uptown Whittier", "East Whittier", "South Whittier", "La Mirada border"],
    popularVenues: ["Family Homes", "Community Centers", "Cultural Centers", "Local Event Venues"],
    specialFeatures: ["Community-focused service", "Multi-generational events", "Cultural celebration expertise"]
  },
  {
    name: "Cerritos",
    slug: "cerritos",
    description: "Upscale suburban hibachi service in beautiful Cerritos, bringing premium dining to this well-planned community.",
    zipCodes: ["90703"],
    neighborhoods: ["Cerritos Towne Center area", "Whitney High area", "Artesia border", "Norwalk border"],
    popularVenues: ["Modern Homes", "Community Centers", "Shopping Center venues", "Cultural Venues"],
    specialFeatures: ["Planned community specialists", "Modern suburban service", "Cultural diversity appreciation"]
  },
  {
    name: "Norwalk",
    slug: "norwalk",
    description: "Welcoming hibachi service in diverse Norwalk, bringing authentic flavors to this vibrant community.",
    zipCodes: ["90650"],
    neighborhoods: ["Downtown Norwalk", "Norwalk Square area", "Santa Fe Springs border", "Cerritos border"],
    popularVenues: ["Family Homes", "Community Centers", "Cultural Venues", "Local Event Spaces"],
    specialFeatures: ["Community diversity celebration", "Family-centered service", "Cultural fusion appreciation"]
  },
  {
    name: "Bellflower",
    slug: "bellflower",
    description: "Neighborhood hibachi service in close-knit Bellflower, bringing people together through authentic Japanese cuisine.",
    zipCodes: ["90706"],
    neighborhoods: ["Downtown Bellflower", "Lakewood border", "Artesia border", "Paramount border"],
    popularVenues: ["Family Homes", "Community Centers", "Local Gathering Spaces", "Neighborhood Venues"],
    specialFeatures: ["Close-knit community service", "Neighborhood intimacy", "Family tradition building"]
  },
  {
    name: "Compton",
    slug: "compton",
    description: "Community-focused hibachi service in historic Compton, bringing cultural appreciation through authentic dining experiences.",
    zipCodes: ["90220", "90221", "90222", "90223", "90224"],
    neighborhoods: ["Downtown Compton", "East Compton", "West Compton", "Lynwood border"],
    popularVenues: ["Community Centers", "Cultural Venues", "Family Homes", "Local Event Spaces"],
    specialFeatures: ["Cultural bridge building", "Community celebration focus", "Authentic cultural exchange"]
  },
  {
    name: "San Pedro",
    slug: "san-pedro",
    description: "Historic port community hibachi service in San Pedro, bringing authentic Japanese cuisine to LA's maritime district.",
    zipCodes: ["90731", "90732"],
    neighborhoods: ["Downtown San Pedro", "Cabrillo Beach", "Ports O' Call", "Angel's Gate", "Rancho San Pedro"],
    popularVenues: ["Harbor View Homes", "Historic Properties", "Waterfront Venues", "Community Centers"],
    cityHighlights: [
      "Historic Port of Los Angeles and maritime heritage",
      "Beautiful Cabrillo Beach and coastal recreation", 
      "Rich fishing and shipping industry culture",
      "Growing arts district and community revitalization",
      "Gateway to Catalina Island ferry services"
    ]
  }
]
