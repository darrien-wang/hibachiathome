const fs = require('fs')
const path = require('path')

// Orange County emotional stories - focused on selling the experience and feelings
const ocCitiesData = {
  "irvine": {
    cityName: "Irvine",
    story: "When Sarah's teenage daughter announced she'd gotten into UC Irvine, the family knew this moment deserved more than just dinner at a restaurant. They wanted something that would capture the significance - the years of studying, the dreams finally realized, the pride bursting in their hearts. Our hibachi at home experience transformed their Irvine home into a stage for celebration. As our chef performed, three generations gathered around the sizzling grill, sharing stories of dreams and achievements. This wasn't just about food - it was about creating a memory that would forever mark this milestone. Sarah later said the teppanyaki tricks made everyone laugh until they cried happy tears, but what she treasured most was watching her daughter's face glow with pure joy, surrounded by everyone who believed in her.",
    nearbyCities: ["Costa Mesa", "Newport Beach", "Tustin", "Orange", "Lake Forest"]
  },
  "newport-beach": {
    cityName: "Newport Beach",
    story: "After 25 years of marriage, David wanted to surprise his wife Linda with something extraordinary for their anniversary. Not another fancy restaurant where they'd sit across from each other making small talk. He craved something that would bring back the spark, the laughter, the sense of adventure they had when they first fell in love. When our private chef arrived at their Newport Beach waterfront home, Linda was confused - until the magic began. Watching the hibachi performance together, they found themselves giggling like teenagers again. The chef's playful banter broke down walls they didn't even know they'd built. By the time the onion volcano erupted, they were holding hands and remembering why they chose each other. This hibachi at home experience didn't just feed their bodies - it rekindled their connection and reminded them that their love story was still being written.",
    nearbyCities: ["Costa Mesa", "Irvine", "Huntington Beach", "Laguna Beach", "Balboa Island"]
  },
  "huntington-beach": {
    cityName: "Huntington Beach",
    story: "Emma had been dreading her 40th birthday. Forty felt like a deadline she wasn't ready to meet - career transitions, kids growing up, dreams deferred. Her sister knew Emma needed more than a typical party; she needed to remember that life's best chapters might still be unwritten. The hibachi at home celebration in Emma's Huntington Beach home wasn't about the food - it was about reclaiming joy. As our chef juggled spatulas and created towering flames, Emma found herself laughing for the first time in months. Her friends shared stories of their own fears and triumphs, bonds deepening over the shared experience. When the chef presented Emma with a perfectly cooked meal shaped like a birthday cake, she realized this wasn't an ending - it was a beginning. Sometimes you need a moment that interrupts the ordinary to remember how extraordinary life can be.",
    nearbyCities: ["Costa Mesa", "Newport Beach", "Fountain Valley", "Westminster", "Seal Beach"]
  },
  "costa-mesa": {
    cityName: "Costa Mesa",
    story: "When Jennifer's teenage son announced he was gay, she felt overwhelmed - not with disappointment, but with love and the fierce need to show him he was celebrated exactly as he was. A simple family dinner wouldn't capture the magnitude of her pride and acceptance. She wanted a moment that would forever symbolize 'you are loved, you are perfect, you belong.' The hibachi at home experience in their Costa Mesa home became that moment. As our chef performed with theatrical flair, the family rallied around their son with cheers and applause. The chef, sensing the special energy, dedicated extra tricks to the guest of honor. Through laughter and flames, a message was delivered louder than words ever could: this family was a safe harbor, and love was the only ingredient that mattered. Years later, they still talk about 'the night we celebrated being ourselves.'",
    nearbyCities: ["Irvine", "Newport Beach", "Huntington Beach", "Orange", "Santa Ana"]
  },
  "anaheim": {
    cityName: "Anaheim",
    story: "Maria's father was losing his memory to dementia, and she was desperate to create one last perfect family gathering while he could still recognize everyone. She didn't want a sad goodbye dinner - she wanted magic, laughter, something that would light up his eyes one more time. When our hibachi chef arrived at their Anaheim family home, her father's face transformed. The showmanship, the fire, the playful interaction triggered something beautiful - he became animated, engaged, present. For three precious hours, dementia took a backseat to wonder. He clapped for every trick, laughed at every joke, and when the chef taught him to catch an egg, he beamed with childlike pride. Maria watched her father truly see and be seen by his family one last time. This wasn't just a private birthday hibachi party - it was a gift of connection, a bridge across the darkness of disease, a memory that would sustain them through the difficult days ahead.",
    nearbyCities: ["Fullerton", "Orange", "Buena Park", "Garden Grove", "Placentia"]
  },
  "fullerton": {
    cityName: "Fullerton",
    story: "After the divorce, single mom Rachel wondered if she'd ever feel joyful about celebrations again. Her daughter's sweet sixteen was approaching, and Rachel was determined to prove that their smaller family could still create big happiness. She didn't want to fake it - she wanted to feel it. The hibachi at home experience in their Fullerton home became a declaration of resilience. As our private chef entertained her daughter and friends, Rachel watched her child's pure delight and felt something shift inside her heart. The teenagers gasped at every trick, took selfies with the flames, and created the kind of authentic fun that money can't buy but memories are made of. When her daughter hugged her and whispered 'this is the best birthday ever,' Rachel realized she hadn't just given her daughter a party - she'd given herself permission to believe in new beginnings. Sometimes the most important person you're celebrating is yourself.",
    nearbyCities: ["Anaheim", "Buena Park", "La Habra", "Placentia", "Brea"]
  },
  "orange": {
    cityName: "Orange",
    story: "When Michael's startup finally got funded after three years of struggle, he knew a simple celebration wouldn't capture the rollercoaster of emotions - the sleepless nights, the rejected pitches, the moments he almost gave up, and now this victory that felt surreal. He wanted to gather his team, his family, everyone who'd believed in the impossible dream. The hibachi at home experience in his Orange home became a victory lap for all of them. As our chef performed with flames dancing high, Michael saw his journey reflected in the fire - sometimes dangerous, always transformative, ultimately beautiful. His investors laughed alongside his parents, his team bonded over shared wonder, and his five-year-old nephew declared it 'better than Disneyland.' In that moment, success wasn't just about money or recognition - it was about the people who'd stood by him and the community that made the dream possible. Some achievements deserve a celebration as bold as the risks you took to get there.",
    nearbyCities: ["Anaheim", "Costa Mesa", "Tustin", "Santa Ana", "Villa Park"]
  },
  "santa-ana": {
    cityName: "Santa Ana",
    story: "When Rosa became an American citizen after fifteen years of hoping and waiting, her family wanted to honor not just her achievement, but her journey. The struggles, the English classes after long work days, the dreams she carried from El Salvador, the courage it took to build a new life. A restaurant celebration felt too ordinary for such an extraordinary milestone. The hibachi at home experience in their Santa Ana home became a bridge between her past and future. As our chef performed with theatrical flair, Rosa's children translated the excitement for their Spanish-speaking abuela, creating a beautiful blend of cultures around the grill. When the chef presented Rosa with a special dish and the whole family erupted in applause, tears mixed with laughter. This wasn't just about becoming American - it was about honoring the strength it took to get here while celebrating the family love that made it all worthwhile. Some dreams are too big for ordinary celebrations.",
    nearbyCities: ["Orange", "Costa Mesa", "Tustin", "Garden Grove", "Fountain Valley"]
  },
  "tustin": {
    cityName: "Tustin",
    story: "When Emma's grandmother turned 90, the family realized this might be their last chance to see her truly light up with joy. Grandma Rose had been withdrawing lately, claiming she was 'too old for fuss,' but Emma suspected she just felt forgotten in a world that moved too fast for her memories. The hibachi at home experience in Emma's Tustin home wasn't just a birthday party - it was a love letter to someone who'd given everything to her family. As our private chef performed, something magical happened: Grandma Rose became the star. She clapped for every trick, asked questions about the cooking, and when the chef let her help with a simple technique, she positively glowed. Four generations gathered around that grill, but all eyes were on the birthday girl who suddenly felt relevant, valued, celebrated. When she whispered to Emma, 'I haven't felt this special in years,' the family knew they'd given her more than a meal - they'd given her back her sparkle.",
    nearbyCities: ["Irvine", "Orange", "Santa Ana", "Lake Forest", "Villa Park"]
  },
  "mission-viejo": {
    cityName: "Mission Viejo",
    story: "After Jake's cancer treatment ended, his family struggled with how to celebrate. The word 'remission' felt too clinical, 'survivor' felt too dramatic, but 'grateful' - that felt right. They wanted a celebration that honored the fight without dwelling on the fear, that welcomed the future without forgetting the journey. The hibachi at home experience in their Mission Viejo home became a ritual of renewal. As our chef created flames that danced and disappeared, Jake saw a metaphor for his own resilience - moments of intensity followed by calm, beauty emerging from heat and pressure. His teenage kids, who'd been so serious for so long, erupted in genuine laughter for the first time in months. When the chef presented Jake with a heart-shaped portion of food and said 'to new beginnings,' the family understood: this wasn't just about surviving cancer - it was about choosing to thrive. Some victories require a celebration as vibrant as your will to live.",
    nearbyCities: ["Lake Forest", "Laguna Hills", "Aliso Viejo", "Rancho Santa Margarita", "Tustin"]
  },
  "laguna-beach": {
    cityName: "Laguna Beach",
    story: "When artist Maya sold her first major painting after years of struggle, she realized she'd been living in survival mode so long that she'd forgotten how to celebrate her wins. Her partner suggested dinner out, but Maya craved something more intentional - a moment to pause and acknowledge that her dreams weren't naive, they were finally real. The hibachi at home experience in their Laguna Beach cottage became an art performance of its own. As our chef created flames and flavors, Maya saw her own creative process reflected - the patience, the precision, the moment when separate elements become something beautiful. Her artist friends gathered around the grill, sharing stories of their own breakthroughs and setbacks, bonding over the universal truth that creating anything meaningful requires faith in the invisible. When the chef presented her with a dish arranged like a palette of colors, Maya felt seen not just as a customer, but as a creator. Sometimes you need to celebrate not just what you've achieved, but who you've become in the process.",
    nearbyCities: ["Dana Point", "Aliso Viejo", "Laguna Hills", "Newport Beach", "Mission Viejo"]
  },
  "dana-point": {
    cityName: "Dana Point",
    story: "When retirement finally arrived for Captain Tom after 30 years with the Coast Guard, his family faced an unexpected challenge: how do you celebrate someone who'd spent his career putting others first? Tom deflected attention, claimed he was 'just doing his job,' but his family knew better. They wanted to honor not just his service, but the man who'd missed family dinners to save strangers, who'd carried the weight of others' emergencies with quiet strength. The hibachi at home experience at their Dana Point harbor home became a homecoming in the truest sense. As our chef performed near the water where Tom had spent his career, something beautiful happened: stories started flowing. Fellow servicemen shared rescues Tom had never mentioned, family members revealed how his dedication had inspired their own choices. When the chef presented Tom with a anchor-shaped portion and thanked him for his service, this humble hero finally understood what his family had always known - some people deserve to be celebrated not for what they've gained, but for what they've given.",
    nearbyCities: ["Laguna Beach", "San Juan Capistrano", "Aliso Viejo", "Laguna Niguel", "San Clemente"]
  }
}

// Mapping from file slugs to story keys for Orange County
const ocCityMappings = {
  "irvine": "irvine",
  "newport-beach": "newport-beach",
  "huntington-beach": "huntington-beach",
  "costa-mesa": "costa-mesa",
  "anaheim": "anaheim",
  "fullerton": "fullerton",
  "orange": "orange",
  "santa-ana": "santa-ana",
  "tustin": "tustin",
  "mission-viejo": "mission-viejo",
  "laguna-beach": "laguna-beach",
  "dana-point": "dana-point"
}

function createOCServiceClient(citySlug, cityDisplayName) {
  const storyKey = ocCityMappings[citySlug]
  
  if (!storyKey || !ocCitiesData[storyKey]) {
    console.log(`No story data found for ${citySlug}`)
    return
  }

  const storyData = ocCitiesData[storyKey]
  
  // Create Orange County specific client file
  const clientFileName = cityDisplayName.replace(/\s+/g, '') + 'ServiceClient.tsx'
  const cityDir = path.join(__dirname, '..', 'app', 'service-area', 'orange-county', citySlug)
  const clientPath = path.join(cityDir, clientFileName)
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(cityDir)) {
    fs.mkdirSync(cityDir, { recursive: true })
  }

  // Orange County city data - you can customize these for each city
  const cityData = getCitySpecificData(citySlug)
  
  const storyContent = storyData.story.replace(/"/g, '\\"')
  const nearbyCities = JSON.stringify(storyData.nearbyCities)
  
  // Create the page.tsx file
  const pageContent = `import type { Metadata } from "next"
import ${cityDisplayName.replace(/\s+/g, '')}ServiceClient from "./${clientFileName.replace('.tsx', '')}"

export const metadata: Metadata = {
  title: "Hibachi at Home ${cityDisplayName} | Orange County Private Chef Service | Real Hibachi",
  description: "Premium hibachi at home experience in ${cityDisplayName}, Orange County. Professional private chef bringing authentic Japanese teppanyaki and unforgettable memories to your celebration.",
  keywords: "hibachi at home ${cityDisplayName}, private chef Orange County, Japanese teppanyaki ${cityDisplayName}, hibachi catering OC, private birthday hibachi party ${cityDisplayName}",
  openGraph: {
    title: "Hibachi at Home ${cityDisplayName} | Orange County Private Chef Service",
    description: "Create unforgettable memories with our hibachi at home experience in ${cityDisplayName}. Professional private chef, authentic teppanyaki, and emotional celebrations that matter.",
    url: "https://realhibachi.com/service-area/orange-county/${citySlug}",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home ${cityDisplayName} - Create Memories That Matter',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home ${cityDisplayName} | Memories That Matter',
    description: 'Transform your special moments with our hibachi at home experience in ${cityDisplayName}, Orange County.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function ${cityDisplayName.replace(/\s+/g, '')}ServicePage() {
  return <${cityDisplayName.replace(/\s+/g, '')}ServiceClient />
}`

  // Create the ServiceClient.tsx file
  const clientContent = `"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function ${cityDisplayName.replace(/\s+/g, '')}ServiceClient() {
  return (
    <CityServiceTemplate
      cityName="${cityDisplayName}"
      region="Orange County"
      description="${cityData.description}"
      zipCodes={${JSON.stringify(cityData.zipCodes)}}
      neighborhoods={${JSON.stringify(cityData.neighborhoods)}}
      popularVenues={${JSON.stringify(cityData.popularVenues)}}
      cityHighlights={${JSON.stringify(cityData.cityHighlights)}}
      storyContent="${storyContent}"
      nearbyCities={${nearbyCities}}
    />
  )
}`

  // Write both files
  fs.writeFileSync(path.join(cityDir, 'page.tsx'), pageContent)
  fs.writeFileSync(clientPath, clientContent)
  
  console.log(`Created emotional story pages for ${cityDisplayName}`)
}

function getCitySpecificData(citySlug) {
  const cityDataMap = {
    "irvine": {
      description: "Where life's biggest moments deserve extraordinary celebrations - hibachi at home experiences that honor your achievements in Orange County's most prestigious community.",
      zipCodes: ["92602", "92603", "92604", "92606", "92612", "92614", "92616", "92617", "92618", "92619", "92620"],
      neighborhoods: ["Irvine Spectrum", "University Park", "Woodbridge", "Northwood", "Turtle Rock", "Shady Canyon"],
      popularVenues: ["Executive Homes", "University Community", "Corporate Event Spaces", "Luxury Residences"],
      cityHighlights: ["Master-planned community with excellent schools", "Home to UC Irvine and tech companies", "Beautiful parks and family-friendly neighborhoods", "Diverse cultural community and dining scene"]
    },
    "newport-beach": {
      description: "Waterfront elegance meets authentic Japanese tradition - hibachi at home experiences for Orange County's most discerning celebrations.",
      zipCodes: ["92660", "92661", "92662", "92663"],
      neighborhoods: ["Balboa Island", "Corona del Mar", "Newport Coast", "Lido Isle", "Fashion Island area"],
      popularVenues: ["Waterfront Estates", "Luxury Condos", "Beach Houses", "Private Yacht Clubs"],
      cityHighlights: ["Prestigious waterfront living and luxury shopping", "Beautiful beaches and harbor activities", "Upscale dining and entertainment scene", "Exclusive residential communities and marinas"]
    },
    // Add more cities as needed...
  }
  
  return cityDataMap[citySlug] || {
    description: `Premium hibachi at home experiences in ${citySlug.replace('-', ' ')}, bringing authentic Japanese tradition to your Orange County celebration.`,
    zipCodes: [],
    neighborhoods: [],
    popularVenues: ["Private Homes", "Community Centers", "Event Venues"],
    cityHighlights: ["Beautiful Orange County community", "Family-friendly neighborhoods", "Diverse local culture", "Great dining and entertainment"]
  }
}

// Generate Orange County cities
console.log('Creating emotional Orange County hibachi stories...')
Object.keys(ocCityMappings).forEach(citySlug => {
  const cityDisplayName = citySlug.split('-').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ')
  
  createOCServiceClient(citySlug, cityDisplayName)
})

console.log('\nOrange County emotional stories created successfully!')
console.log('These stories focus on WHY people need hibachi experiences, not just WHAT we provide.')
console.log('Each story sells the emotional transformation and memory creation.')

