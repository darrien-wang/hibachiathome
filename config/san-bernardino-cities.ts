export interface SanBernardinoCityConfig {
  name: string
  slug: string
  zipCodes: string[]
  neighborhoods: string[]
  popularVenues: string[]
  highlights: string[]
  story: string
  nearbyCities: string[]
}

export const sanBernardinoCities: SanBernardinoCityConfig[] = [
  {
    name: "San Bernardino",
    slug: "san-bernardino-city",
    zipCodes: ["92401", "92402", "92403", "92404", "92405", "92406", "92407", "92408", "92410", "92411", "92413", "92415"],
    neighborhoods: ["Downtown San Bernardino", "North Park", "Muscoy", "Del Rosa", "Shandin Hills", "Cajon", "University District"],
    popularVenues: ["Family Homes", "University Communities", "Historic Districts", "Suburban Neighborhoods"],
    highlights: [
      "Historic Route 66 and downtown heritage",
      "California State University San Bernardino campus",
      "Gateway to the San Bernardino Mountains",
      "Rich railroad and transportation history"
    ],
    story: "When Professor Martinez's research team at Cal State San Bernardino achieved a breakthrough in renewable energy, they wanted to celebrate this milestone that could change the world. At his home near the university, our hibachi chef created an evening where academic excellence met culinary artistry. As students, faculty, and researchers gathered around the sizzling grill, conversations flowed from scientific discoveries to future innovations. This hibachi at home experience embodied San Bernardino's spirit - where education, innovation, and community collaboration create a brighter tomorrow.",
    nearbyCities: ["Highland", "Redlands", "Colton", "Rialto"]
  },
  {
    name: "Fontana",
    slug: "fontana",
    zipCodes: ["92331", "92335", "92336", "92337"],
    neighborhoods: ["North Fontana", "South Fontana", "Southridge", "Citrus Glen", "Country Club Village", "Hunter's Ridge"],
    popularVenues: ["Family Communities", "Industrial Districts", "Shopping Centers", "Residential Developments"],
    highlights: [
      "Major logistics and distribution hub",
      "Fast-growing family communities",
      "Historic Route 66 significance",
      "Close to mountain recreation areas"
    ],
    story: "The Johnson family's logistics company had just landed their biggest contract ever, securing jobs for hundreds of local residents. At their Fontana home with views of the San Gabriel Mountains, our hibachi chef created a celebration that honored both business success and community impact. As employees, partners, and family gathered around the grill, stories were shared about hard work, determination, and the American dream. This hibachi at home experience reflected Fontana's character - where industrial strength meets family values and community growth.",
    nearbyCities: ["Rancho Cucamonga", "Ontario", "Rialto", "San Bernardino"]
  },
  {
    name: "Ontario",
    slug: "ontario",
    zipCodes: ["91708", "91710", "91761", "91762", "91764"],
    neighborhoods: ["Ontario Center", "North Ontario", "South Ontario", "Airport Area", "Vineyard District"],
    popularVenues: ["International Airport Area", "Business Districts", "Shopping Centers", "Residential Communities"],
    highlights: [
      "Ontario International Airport gateway",
      "Major business and commerce hub",
      "Historic Model Colony heritage",
      "Thriving multicultural community"
    ],
    story: "Captain Williams' final flight before retirement touched down at Ontario International Airport, marking the end of a distinguished 35-year aviation career. His family wanted to honor this milestone at their Ontario home near the airport where his journey began. Our hibachi chef performed as pilots, flight attendants, and aviation professionals gathered to celebrate decades of safe flights and dedication to service. This hibachi at home experience captured Ontario's spirit - where global connections meet local community pride.",
    nearbyCities: ["Rancho Cucamonga", "Upland", "Chino", "Fontana"]
  },
  {
    name: "Rancho Cucamonga",
    slug: "rancho-cucamonga",
    zipCodes: ["91701", "91729", "91730", "91737", "91739"],
    neighborhoods: ["Alta Loma", "Etiwanda", "North Rancho Cucamonga", "South Rancho Cucamonga", "Victoria"],
    popularVenues: ["Victoria Gardens", "Upscale Communities", "Wine Country", "Mountain Foothills"],
    highlights: [
      "Award-winning planned communities",
      "Historic wine-making region",
      "Excellent schools and family amenities",
      "Beautiful mountain foothill setting"
    ],
    story: "Tech entrepreneur Sarah's startup had just been acquired by a Fortune 500 company, validating years of innovation and hard work. At her Rancho Cucamonga home with stunning mountain views, our hibachi chef created a celebration that matched the sophistication of this achievement. As investors, employees, and family gathered around the elegant outdoor setup, conversations flowed from technological breakthroughs to future possibilities. This hibachi at home experience embodied Rancho Cucamonga's excellence - where innovation meets refined living in perfect harmony.",
    nearbyCities: ["Upland", "Ontario", "Fontana", "Claremont"]
  },
  {
    name: "Rialto",
    slug: "rialto",
    zipCodes: ["92376", "92377"],
    neighborhoods: ["North Rialto", "South Rialto", "West Rialto", "Rialto Center", "Renaissance"],
    popularVenues: ["Historic Downtown", "Family Neighborhoods", "Community Centers", "Parks and Recreation"],
    highlights: [
      "Historic Route 66 heritage",
      "Strong community spirit and pride",
      "Growing arts and cultural scene",
      "Family-friendly neighborhoods"
    ],
    story: "Fire Chief Rodriguez was retiring after 30 years of protecting Rialto's families and businesses. His department wanted to honor his service with a celebration at his home where three generations of his family had served the community. Our hibachi chef set up as firefighters, paramedics, and city officials gathered to share stories of heroism and dedication. This hibachi at home experience reflected Rialto's heart - where service, sacrifice, and community bonds create lasting legacies.",
    nearbyCities: ["San Bernardino", "Fontana", "Colton", "Bloomington"]
  },
  {
    name: "Redlands",
    slug: "redlands",
    zipCodes: ["92373", "92374", "92375"],
    neighborhoods: ["Downtown Redlands", "University District", "South Redlands", "Mountain View", "Bryn Mawr"],
    popularVenues: ["Historic Downtown", "University of Redlands", "Citrus Groves", "Victorian Homes"],
    highlights: [
      "Historic Victorian architecture and charm",
      "University of Redlands campus",
      "Beautiful citrus heritage and groves",
      "Thriving arts and cultural community"
    ],
    story: "Professor Elizabeth's musicology department at University of Redlands had just received a prestigious grant to preserve American folk traditions. At her historic Victorian home downtown, our hibachi chef created an evening where academic achievement met cultural celebration. As musicians, scholars, and students gathered around the grill, conversations flowed from musical heritage to future preservation efforts. This hibachi at home experience captured Redlands' essence - where history, education, and artistic expression create timeless beauty.",
    nearbyCities: ["Highland", "San Bernardino", "Yucaipa", "Loma Linda"]
  },
  {
    name: "Highland",
    slug: "highland",
    zipCodes: ["92346"],
    neighborhoods: ["Highland Central", "Highland Highlands", "Pacific Heights", "Church Street Corridor"],
    popularVenues: ["Suburban Communities", "Shopping Districts", "Mountain Views", "Family Neighborhoods"],
    highlights: [
      "Beautiful mountain and valley views",
      "Strong family-oriented community",
      "Growing business and retail districts",
      "Gateway to mountain recreation"
    ],
    story: "The Peterson family's construction company had just completed their largest project - affordable housing for local families. At their Highland home with panoramic San Bernardino Valley views, our hibachi chef created a celebration that honored both business success and community service. As contractors, architects, and new homeowners gathered around the grill, stories were shared about building dreams and creating lasting communities. This hibachi at home experience embodied Highland's values - where hard work and family commitment build strong foundations.",
    nearbyCities: ["San Bernardino", "Redlands", "Patton", "East Highlands"]
  },
  {
    name: "Upland",
    slug: "upland",
    zipCodes: ["91784", "91785", "91786"],
    neighborhoods: ["North Upland", "Central Upland", "South Upland", "Foothill Boulevard Corridor"],
    popularVenues: ["Historic Downtown", "Mountain Foothills", "Family Communities", "Shopping Centers"],
    highlights: [
      "Historic Route 66 and lemon heritage",
      "Beautiful mountain foothill location",
      "Charming downtown district",
      "Strong community and family values"
    ],
    story: "Dr. Kim's pediatric practice was celebrating 25 years of caring for Upland's children, having delivered thousands of babies and watched families grow. At her home near the foothills, our hibachi chef created a multigenerational celebration where former patients - now parents themselves - gathered with their own children. This hibachi at home experience reflected Upland's heart - where medical dedication and community care create lasting family bonds across generations.",
    nearbyCities: ["Rancho Cucamonga", "Claremont", "Montclair", "San Antonio Heights"]
  },
  {
    name: "Chino",
    slug: "chino",
    zipCodes: ["91708", "91710"],
    neighborhoods: ["Old Town Chino", "Los Serranos", "Rolling Ridge", "Preserve"],
    popularVenues: ["Historic Dairy Farms", "Shopping Centers", "Family Communities", "Agricultural Heritage"],
    highlights: [
      "Rich agricultural and dairy heritage",
      "Family-friendly suburban communities",
      "Growing business and retail districts",
      "Close to transportation corridors"
    ],
    story: "The Martinez family's dairy farm had been passed down through four generations, and they were celebrating their transition to sustainable organic practices. At their Chino home surrounded by the farmland their great-grandfather first worked, our hibachi chef created a celebration that honored both tradition and innovation. As family members from across generations gathered around the grill, stories flowed from old farming methods to new environmental stewardship. This hibachi at home experience embodied Chino's evolution - where agricultural roots meet modern sustainability.",
    nearbyCities: ["Chino Hills", "Ontario", "Pomona", "Diamond Bar"]
  },
  {
    name: "Chino Hills",
    slug: "chino-hills",
    zipCodes: ["91709"],
    neighborhoods: ["Butterfield Ranch", "Los Serranos", "Woodview", "Village Park"],
    popularVenues: ["Upscale Communities", "Shopping Centers", "Golf Courses", "Hill Country Homes"],
    highlights: [
      "Affluent master-planned communities",
      "Beautiful rolling hills setting",
      "Excellent schools and amenities",
      "Family-oriented suburban lifestyle"
    ],
    story: "Investment banker Michael's team had just completed the largest municipal bond offering in county history, securing funding for schools and infrastructure across the region. At his Chino Hills home with sweeping valley views, our hibachi chef created an elegant celebration that matched this significant financial achievement. As colleagues, municipal leaders, and family gathered around the sophisticated outdoor setup, conversations flowed from market strategies to community impact. This hibachi at home experience reflected Chino Hills' excellence - where professional success meets refined family living.",
    nearbyCities: ["Chino", "Diamond Bar", "Brea", "Yorba Linda"]
  },
  {
    name: "Victorville",
    slug: "victorville",
    zipCodes: ["92392", "92393", "92394", "92395"],
    neighborhoods: ["Old Town Victorville", "Spring Valley Lake", "Baldy Mesa", "Desert Knolls"],
    popularVenues: ["Desert Communities", "Spring Valley Lake", "Route 66 Heritage", "High Desert Living"],
    highlights: [
      "High desert lifestyle and scenery",
      "Historic Route 66 significance",
      "Growing logistics and transportation hub",
      "Affordable family communities"
    ],
    story: "Train conductor Robert's final run on the BNSF line marked the end of a 40-year career keeping America's freight moving through the high desert. At his Victorville home with views of the Mojave, our hibachi chef created a celebration that honored the backbone of American commerce. As railroad workers, dispatchers, and family gathered around the grill, stories were shared about dedication, precision, and the vital role of transportation. This hibachi at home experience captured Victorville's spirit - where desert strength meets industrial pride.",
    nearbyCities: ["Apple Valley", "Hesperia", "Adelanto", "Phelan"]
  },
  {
    name: "Hesperia",
    slug: "hesperia",
    zipCodes: ["92344", "92345"],
    neighborhoods: ["Hesperia Lake", "Oak Hills", "Summit Valley", "Lime Street Corridor"],
    popularVenues: ["Desert Communities", "Lake Recreation", "Family Neighborhoods", "Shopping Centers"],
    highlights: [
      "High desert mountain living",
      "Hesperia Lake recreation area",
      "Growing family communities",
      "Beautiful desert and mountain views"
    ],
    story: "Park Ranger Susan had spent 20 years protecting the Mojave National Preserve, educating visitors about desert ecology and conservation. At her Hesperia home with stunning desert vistas, our hibachi chef created a celebration that honored environmental stewardship. As fellow rangers, naturalists, and outdoor enthusiasts gathered around the grill, conversations flowed from desert wildlife to conservation success stories. This hibachi at home experience embodied Hesperia's connection to nature - where desert beauty meets environmental responsibility.",
    nearbyCities: ["Victorville", "Apple Valley", "Oak Hills", "Phelan"]
  },
  {
    name: "Apple Valley",
    slug: "apple-valley",
    zipCodes: ["92307", "92308"],
    neighborhoods: ["Central Apple Valley", "Newton Park", "Thunderbird Heights", "Jess Ranch"],
    popularVenues: ["Desert Living", "Golf Communities", "Family Neighborhoods", "Shopping Centers"],
    highlights: [
      "High desert retirement haven",
      "Beautiful mountain and desert views",
      "Golf and recreational amenities",
      "Peaceful small-town atmosphere"
    ],
    story: "Retired Colonel Thompson's military service had taken him around the world, but he chose Apple Valley for its peaceful beauty and strong veteran community. At his home with panoramic high desert views, our hibachi chef created a celebration honoring his 30-year military career. As fellow veterans, military families, and community members gathered around the grill, stories were shared about service, sacrifice, and finding peace in the high desert. This hibachi at home experience reflected Apple Valley's tranquility - where military honor meets desert serenity.",
    nearbyCities: ["Victorville", "Hesperia", "Lucerne Valley", "Adelanto"]
  },
  {
    name: "Colton",
    slug: "colton",
    zipCodes: ["92324"],
    neighborhoods: ["Downtown Colton", "La Loma Hills", "Reche Canyon", "South Colton"],
    popularVenues: ["Historic Railroad District", "Family Communities", "Industrial Areas", "Mountain Foothills"],
    highlights: [
      "Historic railroad heritage and significance",
      "Growing industrial and logistics sector",
      "Close-knit community atmosphere",
      "Gateway to San Bernardino Mountains"
    ],
    story: "Railroad engineer Carlos had been keeping freight moving through Colton's crucial rail junction for 25 years, helping maintain the supply chains that keep America running. At his home near the historic depot, our hibachi chef created a celebration that honored the vital role of transportation workers. As rail workers, dispatchers, and family gathered around the grill, stories were shared about precision, teamwork, and the pride of keeping commerce moving. This hibachi at home experience captured Colton's importance - where railroad heritage meets modern logistics excellence.",
    nearbyCities: ["San Bernardino", "Rialto", "Grand Terrace", "Loma Linda"]
  },
  {
    name: "Montclair",
    slug: "montclair",
    zipCodes: ["91763"],
    neighborhoods: ["Central Montclair", "Monte Vista", "Indian Hill", "Moreno"],
    popularVenues: ["Shopping Centers", "Family Communities", "Parks and Recreation", "Cultural Centers"],
    highlights: [
      "Diverse and multicultural community",
      "Growing arts and cultural scene",
      "Family-friendly neighborhoods",
      "Central location with easy access"
    ],
    story: "Community center director Maria had dedicated 15 years to bringing Montclair's diverse cultures together through arts, education, and celebration. At her home where neighbors from dozen different countries had become family, our hibachi chef created an evening that honored cultural unity. As community leaders, artists, and families from various backgrounds gathered around the grill, conversations flowed in multiple languages about shared dreams and common goals. This hibachi at home experience embodied Montclair's spirit - where diversity creates strength and unity.",
    nearbyCities: ["Upland", "Pomona", "Claremont", "Ontario"]
  },
  {
    name: "Loma Linda",
    slug: "loma-linda",
    zipCodes: ["92350", "92354"],
    neighborhoods: ["South Loma Linda", "University District", "Country Club"],
    popularVenues: ["Loma Linda University", "Medical Centers", "Health Community", "Family Neighborhoods"],
    highlights: [
      "World-renowned medical university and hospital",
      "Health-focused community lifestyle",
      "Beautiful suburban family neighborhoods",
      "Strong educational and healthcare presence"
    ],
    story: "Dr. Sarah's medical research at Loma Linda University had just led to a breakthrough in pediatric cardiology that would save countless children's lives. At her home near the university medical center, our hibachi chef created a celebration that honored both scientific achievement and humanitarian service. As fellow doctors, nurses, and medical students gathered around the grill, conversations flowed from medical innovations to healing communities. This hibachi at home experience embodied Loma Linda's mission - where medical excellence meets compassionate care.",
    nearbyCities: ["Redlands", "San Bernardino", "Colton", "Yucaipa"]
  },
  {
    name: "Grand Terrace",
    slug: "grand-terrace",
    zipCodes: ["92313"],
    neighborhoods: ["Blue Mountain", "Mount Vernon Avenue", "Barton Road Corridor"],
    popularVenues: ["Small Town Community", "Family Neighborhoods", "Local Parks", "Quiet Residential"],
    highlights: [
      "Small-town charm and community spirit",
      "Beautiful views of surrounding mountains",
      "Family-friendly neighborhoods",
      "Close-knit residential community"
    ],
    story: "The Anderson family had lived in Grand Terrace for three generations, watching their small community grow while maintaining its close-knit character. When their son graduated as valedictorian, they wanted to celebrate with neighbors who had become family. Our hibachi chef set up in their backyard as three generations of Grand Terrace residents gathered to honor achievement and community bonds. This hibachi at home experience reflected Grand Terrace's heart - where small-town values create big family connections.",
    nearbyCities: ["Colton", "Loma Linda", "Riverside", "Redlands"]
  },
  {
    name: "Claremont",
    slug: "claremont",
    zipCodes: ["91711"],
    neighborhoods: ["Claremont Village", "University District", "Thompson Creek", "North Claremont"],
    popularVenues: ["Claremont Colleges", "Village Walk", "Tree-lined Streets", "Academic Community"],
    highlights: [
      "Prestigious Claremont Colleges consortium",
      "Charming village atmosphere",
      "Tree-lined streets and academic culture",
      "Vibrant arts and intellectual community"
    ],
    story: "Professor Williams' philosophy department at the Claremont Colleges was hosting a symposium on ethics and technology when she decided to bring the conversation home. At her Claremont Village residence, our hibachi chef created an intimate setting where Nobel laureates, students, and community members could continue their dialogue. This hibachi at home experience captured Claremont's essence - where intellectual curiosity meets warm community hospitality.",
    nearbyCities: ["Pomona", "Upland", "La Verne", "Montclair"]
  },
  {
    name: "Pomona",
    slug: "pomona",
    zipCodes: ["91766", "91767", "91768", "91769"],
    neighborhoods: ["Downtown Pomona", "Cal Poly Area", "Lincoln Park", "Phillips Ranch"],
    popularVenues: ["Cal Poly Pomona", "Fairplex", "Arts Colony", "Family Communities"],
    highlights: [
      "Cal Poly Pomona university campus",
      "LA County Fair at Fairplex",
      "Growing arts and cultural scene",
      "Diverse multicultural community"
    ],
    story: "Engineering student Miguel's senior project at Cal Poly Pomona had just won a national competition for sustainable energy solutions. His family wanted to celebrate this achievement that honored both their immigrant journey and American dreams. At their Pomona home, our hibachi chef created a gathering where classmates, professors, and three generations of family shared stories of perseverance and innovation. This hibachi at home experience embodied Pomona's spirit - where hard work and education transform dreams into reality.",
    nearbyCities: ["Claremont", "La Verne", "Diamond Bar", "Chino"]
  },
  {
    name: "La Verne",
    slug: "la-verne",
    zipCodes: ["91750"],
    neighborhoods: ["Old Town La Verne", "University of La Verne Area", "Hillside", "Bonita Avenue"],
    popularVenues: ["University of La Verne", "Historic Downtown", "Family Communities", "Tree-lined Neighborhoods"],
    highlights: [
      "University of La Verne campus",
      "Historic downtown charm",
      "Beautiful tree-lined residential streets",
      "Strong educational community"
    ],
    story: "Teacher Maria had spent 20 years at La Verne Elementary, watching hundreds of students grow from kindergarten through high school graduation. When the community wanted to honor her dedication to education, they gathered at her home near the university. Our hibachi chef created an evening where former students - now doctors, teachers, and community leaders - shared how her influence shaped their lives. This hibachi at home experience reflected La Verne's character - where educational excellence creates lasting community bonds.",
    nearbyCities: ["Claremont", "Pomona", "San Dimas", "Glendora"]
  },
  {
    name: "Crestline",
    slug: "crestline",
    zipCodes: ["92325"],
    neighborhoods: ["Lake Gregory", "Valley of Enchantment", "Cedarpines Park"],
    popularVenues: ["Mountain Community", "Lake Gregory", "Forest Recreation", "Cabin Retreats"],
    highlights: [
      "Beautiful mountain lake community",
      "Lake Gregory recreation area",
      "Forest and mountain outdoor activities",
      "Peaceful mountain retreat atmosphere"
    ],
    story: "The Thompson family's mountain cabin in Crestline had been their refuge for 30 years, a place where city stress melted away among pine trees and lake breezes. When their children's families gathered for their annual reunion, our hibachi chef brought the celebration to their deck overlooking Lake Gregory. As three generations shared stories under mountain stars, the performance reminded everyone why family traditions matter. This hibachi at home experience captured Crestline's magic - where mountain serenity creates lasting memories.",
    nearbyCities: ["Lake Arrowhead", "Running Springs", "San Bernardino", "Highland"]
  },
  {
    name: "Lake Arrowhead",
    slug: "lake-arrowhead",
    zipCodes: ["92352"],
    neighborhoods: ["Arrowhead Village", "Cedar Glen", "Blue Jay", "Skyland"],
    popularVenues: ["Lake Arrowhead Village", "Mountain Resort", "Forest Communities", "Lake Recreation"],
    highlights: [
      "Premier mountain resort destination",
      "Beautiful alpine lake setting",
      "Lake Arrowhead Village shopping and dining",
      "Year-round outdoor recreation"
    ],
    story: "Resort manager David had worked at Lake Arrowhead for 15 years, helping countless families create perfect mountain getaways. When his own family celebrated his promotion to general manager, they wanted something special at their lakefront home. Our hibachi chef performed on their deck as the sun set over the pristine alpine lake, creating a magical evening that rivaled any resort experience. This hibachi at home celebration embodied Lake Arrowhead's luxury - where natural beauty meets world-class hospitality.",
    nearbyCities: ["Crestline", "Running Springs", "Big Bear Lake", "Silverwood Lake"]
  },
  {
    name: "Big Bear Lake",
    slug: "big-bear-lake",
    zipCodes: ["92314", "92315"],
    neighborhoods: ["Big Bear City", "Fawnskin", "Sugarloaf", "Moonridge"],
    popularVenues: ["Big Bear Lake", "Snow Summit", "Mountain Resorts", "Alpine Recreation"],
    highlights: [
      "World-class skiing and winter sports",
      "Beautiful alpine lake recreation",
      "Mountain resort destination",
      "Four-season outdoor activities"
    ],
    story: "Ski instructor Jake had taught thousands of people to love the mountains during his 20-year career at Snow Summit. When his ski school was recognized as the best in Southern California, his team wanted to celebrate at his Big Bear Lake cabin. Our hibachi chef set up on his deck as the snow-covered peaks glowed in the evening light, creating a perfect mountain celebration. This hibachi at home experience reflected Big Bear's adventure spirit - where mountain challenges create lifelong friendships.",
    nearbyCities: ["Lake Arrowhead", "Running Springs", "Victorville", "Lucerne Valley"]
  },
  {
    name: "Running Springs",
    slug: "running-springs",
    zipCodes: ["92382"],
    neighborhoods: ["Running Springs Center", "Green Valley", "Arrowbear"],
    popularVenues: ["Mountain Community", "Forest Areas", "Outdoor Recreation", "Quiet Neighborhoods"],
    highlights: [
      "Peaceful mountain forest community",
      "Beautiful natural surroundings",
      "Outdoor recreation and hiking",
      "Quiet mountain living"
    ],
    story: "Forest Service ranger Patricia had protected the San Bernardino Mountains for 25 years, teaching visitors about conservation and natural beauty. At her Running Springs home surrounded by towering pines, our hibachi chef created a celebration honoring her environmental stewardship. As fellow rangers, naturalists, and community members gathered around the grill, stories were shared about protecting wilderness for future generations. This hibachi at home experience embodied Running Springs' connection to nature - where forest conservation meets community dedication.",
    nearbyCities: ["Crestline", "Lake Arrowhead", "Big Bear Lake", "Highland"]
  },
  {
    name: "Yucaipa",
    slug: "yucaipa",
    zipCodes: ["92399"],
    neighborhoods: ["Oak Glen", "Wildwood Canyon", "Chapman Heights", "Yucaipa Regional Park"],
    popularVenues: ["Oak Glen Apple Orchards", "Regional Park", "Family Communities", "Mountain Views"],
    highlights: [
      "Famous Oak Glen apple orchards",
      "Beautiful mountain foothill setting",
      "Family-friendly regional park",
      "Peaceful suburban community"
    ],
    story: "The Garcia family's apple orchard in Oak Glen had been passed down through four generations, weathering droughts, market changes, and urban development. When their organic apples won the state fair's grand prize, three generations gathered at their family home overlooking the orchard. Our hibachi chef performed as the setting sun painted their apple trees golden, creating a celebration that honored both agricultural tradition and family perseverance. This hibachi at home experience captured Yucaipa's heritage - where farming roots grow strong family bonds.",
    nearbyCities: ["Redlands", "Highland", "Oak Glen", "Calimesa"]
  },
  {
    name: "Calimesa",
    slug: "calimesa",
    zipCodes: ["92320"],
    neighborhoods: ["Calimesa Country Club", "Mesa Grande", "Noble Creek"],
    popularVenues: ["Golf Community", "Country Club", "Suburban Neighborhoods", "Foothill Living"],
    highlights: [
      "Golf course community living",
      "Beautiful foothill location",
      "Country club amenities",
      "Peaceful suburban atmosphere"
    ],
    story: "Retired airline pilot Robert had chosen Calimesa for its peaceful golf community and mountain views after 30 years of flying around the world. When his aviation club gathered to honor his career, they met at his home overlooking the golf course where he'd found perfect tranquility. Our hibachi chef created an evening where pilots, flight attendants, and aviation enthusiasts shared stories of adventure and safe landings. This hibachi at home experience reflected Calimesa's serenity - where world travels lead to peaceful retirement.",
    nearbyCities: ["Yucaipa", "Redlands", "Beaumont", "Oak Glen"]
  }
]

export const getSBCityBySlug = (slug: string) => {
  return sanBernardinoCities.find(city => city.slug === slug)
}
