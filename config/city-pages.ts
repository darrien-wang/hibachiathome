// City landing page content for /hibachi-at-home/[city].
// Every field must be genuinely city-specific — these pages only outrank
// competitors if the copy reads like it was written by someone who has
// actually cooked parties in that city. Keep pricing claims consistent with
// config/pricing.ts and the FAQ (config/faq.ts).

export type CityOccasion = {
  title: string
  description: string
}

export type CityFaq = {
  question: string
  answer: string
}

export type CityPage = {
  slug: string
  city: string
  county: string
  metaTitle: string
  metaDescription: string
  intro: string[]
  neighborhoods: string[]
  occasions: CityOccasion[]
  faqs: CityFaq[]
  nearby: string[]
}

export const cityPages: CityPage[] = [
  {
    slug: "san-diego",
    city: "San Diego",
    county: "San Diego County",
    metaTitle: "Hibachi at Home San Diego CA | Private Hibachi Chef",
    metaDescription:
      "Private hibachi chef for your San Diego home, backyard, or vacation rental. $59.90/adult flat rate — chef, grill, food, live show, setup & cleanup included. Serving La Jolla to Chula Vista.",
    intro: [
      "San Diego might be the best hibachi-at-home city in America: patio weather nearly year-round, big backyards in East County, and ocean-view decks from La Jolla to Point Loma. Our private hibachi chef brings the mobile teppanyaki grill, fresh ingredients, and the full live show to your home — you host, we cook, we clean up.",
      "We serve all of San Diego County, from North Park bungalows and Pacific Beach vacation rentals to family homes in Chula Vista and Carmel Valley. Flat rate $59.90 per adult with a $599 event minimum.",
    ],
    neighborhoods: [
      "La Jolla",
      "North Park",
      "Pacific Beach",
      "Mission Beach",
      "Point Loma",
      "Del Mar",
      "Encinitas",
      "Carmel Valley",
      "Chula Vista",
      "El Cajon",
      "Poway",
      "Coronado",
    ],
    occasions: [
      {
        title: "Graduation Parties",
        description:
          "UCSD, SDSU, and USD graduations book out fast in May and June — a backyard hibachi show beats fighting for a restaurant reservation.",
      },
      {
        title: "Military Homecomings & Retirements",
        description:
          "We cook for Navy and Marine Corps families across San Diego — homecomings, retirements, and deployment send-offs deserve more than takeout.",
      },
      {
        title: "Beach House Weekends",
        description:
          "Mission Beach and PB vacation rentals are our most-booked venues. The chef sets up on the patio while your group watches the sunset.",
      },
      {
        title: "Birthdays & Family Reunions",
        description:
          "From kids' birthdays in Poway to multigenerational reunions in Chula Vista, one flat rate covers the food, the show, and the cleanup.",
      },
    ],
    faqs: [
      {
        question: "Do you serve all of San Diego County?",
        answer:
          "Yes — from Oceanside and Escondido down to Chula Vista and the border. A travel fee may apply depending on your exact location; it's disclosed upfront when you get your quote.",
      },
      {
        question: "Can you cook at our vacation rental in Mission Beach or Pacific Beach?",
        answer:
          "Absolutely — beach rentals are some of our most common San Diego bookings. We just need a permitted outdoor space like a patio, deck, or driveway. We can't set up on the public beach itself.",
      },
      {
        question: "What about June Gloom or marine layer?",
        answer:
          "The grill doesn't mind the marine layer, and neither do our chefs. If real rain threatens, we can provide a complimentary tent for the chef setup, or you can reschedule with 72+ hours notice for a full deposit refund.",
      },
      {
        question: "How much does hibachi at home cost in San Diego?",
        answer:
          "$59.90 per adult and $29.95 per child under 13, with a $599 event minimum. That includes the chef, grill, 2 proteins per guest, fried rice, vegetables, salad, the live show, setup, and cleanup.",
      },
    ],
    nearby: ["oceanside", "temecula", "corona"],
  },
  {
    slug: "irvine",
    city: "Irvine",
    county: "Orange County",
    metaTitle: "Hibachi at Home Irvine CA | Private Hibachi Chef",
    metaDescription:
      "Private hibachi chef in Irvine — backyard parties, HOA-friendly patio setups, UCI graduations & corporate events. $59.90/adult flat rate with setup and cleanup included.",
    intro: [
      "Irvine's masterplanned neighborhoods were practically designed for hibachi at home: clean patios in Woodbridge and Northwood, big family backyards in Great Park, and community spaces that make hosting easy. Our chef arrives with the grill, fresh ingredients, and a full teppanyaki show — no restaurant reservation required.",
      "We're familiar with Irvine's HOA communities and keep our setup compact, tidy, and quiet until showtime. Flat rate $59.90 per adult, $599 event minimum, cleanup always included.",
    ],
    neighborhoods: [
      "Woodbridge",
      "Northwood",
      "Great Park",
      "Turtle Rock",
      "University Park",
      "Westpark",
      "Quail Hill",
      "Portola Springs",
      "Cypress Village",
      "Orchard Hills",
    ],
    occasions: [
      {
        title: "UCI Graduations",
        description:
          "Skip the impossible June restaurant scramble — bring the celebration to your backyard with a live chef show your family will remember.",
      },
      {
        title: "Corporate & Team Events",
        description:
          "Companies around Irvine Spectrum and the Business Complex book us for team dinners and office celebrations at private homes and venues.",
      },
      {
        title: "Multigenerational Family Dinners",
        description:
          "Hibachi works for every generation at the table — grandparents get a proper dinner, kids get a show, and nobody's stuck cooking.",
      },
      {
        title: "Milestone Birthdays",
        description:
          "From Sweet 16s in Woodbridge to 60th birthdays in Turtle Rock, one booking covers food, entertainment, and cleanup.",
      },
    ],
    faqs: [
      {
        question: "Will the setup work with my HOA's rules?",
        answer:
          "Almost always. We cook on your private patio, backyard, or driveway with a compact professional setup, and we leave the space exactly as we found it. If your HOA has specific outdoor-cooking rules, let us know at booking and we'll plan around them.",
      },
      {
        question: "Can you fit a townhome or condo patio?",
        answer:
          "In most cases yes — we need roughly an 8x8 ft outdoor space for the grill and chef. Send us a photo of your patio if you're unsure and we'll confirm before you pay a deposit.",
      },
      {
        question: "Do you do corporate events in Irvine?",
        answer:
          "Yes — team dinners, launch celebrations, and client events. For groups over 20 we can bring multiple chefs and stations. Ask about our Custom Plan for corporate logistics.",
      },
      {
        question: "What does hibachi at home cost in Irvine?",
        answer:
          "$59.90 per adult and $29.95 per child under 13 with a $599 event minimum — chef, grill, food, show, setup, and cleanup included. Weekday Saver pricing ($45.90/adult, Mon–Thu, 15+ guests) is also available in California.",
      },
    ],
    nearby: ["newport-beach", "huntington-beach", "anaheim"],
  },
  {
    slug: "anaheim",
    city: "Anaheim",
    county: "Orange County",
    metaTitle: "Hibachi at Home Anaheim CA | Private Hibachi Chef",
    metaDescription:
      "Private hibachi chef in Anaheim — vacation rentals near Disneyland, Anaheim Hills backyards, family reunions. $59.90/adult flat rate, setup & cleanup included.",
    intro: [
      "Anaheim is one of our busiest cities — and not just because of the mouse. Families renting vacation homes near Disneyland book our chefs for the one night nobody wants to fight park crowds for dinner, while Anaheim Hills backyards host birthdays, reunions, and graduation parties all year.",
      "The chef brings everything: mobile teppanyaki grill, fresh ingredients, the full performance, and cleanup. You provide the outdoor space and the guests.",
    ],
    neighborhoods: [
      "Anaheim Hills",
      "Platinum Triangle",
      "Anaheim Resort District",
      "West Anaheim",
      "The Colony",
      "Yorba Linda",
      "Placentia",
      "Fullerton",
      "Orange",
      "Garden Grove",
    ],
    occasions: [
      {
        title: "Disneyland Trip Dinners",
        description:
          "The most popular booking in Anaheim: your group comes back from the parks, and dinner plus a show is already set up at the rental.",
      },
      {
        title: "Family Reunions",
        description:
          "Big vacation-rental groups are our specialty — one reservation feeds everyone, and the chef show is the evening's entertainment.",
      },
      {
        title: "Anaheim Hills Backyard Parties",
        description:
          "Birthdays, anniversaries, and graduation parties with a private chef and open-flame show under the hills.",
      },
      {
        title: "Sports Watch Parties",
        description:
          "Angels and Ducks game-day gatherings hit different when a hibachi chef is flipping shrimp at halftime.",
      },
    ],
    faqs: [
      {
        question: "Can you cook at our vacation rental near Disneyland?",
        answer:
          "Yes — this is our single most common Anaheim booking. We need a permitted outdoor space (patio, backyard, or driveway). Double-check that your rental allows outdoor cooking events, and we handle the rest.",
      },
      {
        question: "We're visiting from out of town — how far ahead should we book?",
        answer:
          "For weekend dates, 2–3 weeks ahead is safe; holiday weeks around the parks book out earlier. A $19.90 deposit locks your date, fully refundable with 72+ hours notice.",
      },
      {
        question: "How many guests can you handle at one event?",
        answer:
          "Any size. One chef comfortably serves up to about 20 guests; for larger reunions we bring additional chefs and grills. You still make just one reservation.",
      },
      {
        question: "What does hibachi at home cost in Anaheim?",
        answer:
          "$59.90 per adult, $29.95 per child under 13, $599 event minimum — including chef, grill, 2 proteins per guest, fried rice, vegetables, salad, show, setup, and cleanup.",
      },
    ],
    nearby: ["irvine", "huntington-beach", "long-beach"],
  },
  {
    slug: "long-beach",
    city: "Long Beach",
    county: "Los Angeles County",
    metaTitle: "Hibachi at Home Long Beach CA | Private Hibachi Chef",
    metaDescription:
      "Private hibachi chef in Long Beach — Belmont Shore patios, Naples canal homes, CSULB graduations. $59.90/adult flat rate with full setup and cleanup.",
    intro: [
      "From canal-front homes in Naples to craftsman backyards in Bixby Knolls, Long Beach knows how to host outdoors — and a private hibachi chef turns any patio into the best seat in the city. We bring the grill, the food, and the fire; you bring the people.",
      "We cook across all of Long Beach and the surrounding harbor cities, with wind-smart setups for evenings when the sea breeze picks up.",
    ],
    neighborhoods: [
      "Belmont Shore",
      "Naples",
      "Bixby Knolls",
      "Alamitos Beach",
      "Bluff Park",
      "Los Altos",
      "Lakewood",
      "Signal Hill",
      "Seal Beach",
      "San Pedro",
    ],
    occasions: [
      {
        title: "CSULB Graduations",
        description:
          "May and June fill up fast — celebrate the grad at home with a chef show instead of a 90-minute restaurant wait.",
      },
      {
        title: "Canal & Waterfront Dinners",
        description:
          "Naples and Belmont Shore patios were made for teppanyaki at sunset. Neighbors will ask what smells so good.",
      },
      {
        title: "Birthday Parties",
        description:
          "Kids get the onion volcano and egg tricks; adults get restaurant-quality steak and shrimp without leaving the backyard.",
      },
      {
        title: "Small Wedding Events",
        description:
          "Rehearsal dinners and intimate receptions with live cooking as both catering and entertainment.",
      },
    ],
    faqs: [
      {
        question: "Our patio gets harbor wind in the evening — is that a problem?",
        answer:
          "Rarely. Our chefs cook outdoors in Long Beach year-round and bring windscreens when needed. For exposed waterfront patios, an earlier start time or a simple tent setup keeps everything comfortable.",
      },
      {
        question: "Can you set up in a smaller Belmont Shore backyard?",
        answer:
          "Usually yes — we need about an 8x8 ft outdoor footprint for the grill and chef. Send a photo with your quote request and we'll confirm fit before you commit.",
      },
      {
        question: "Do you serve the surrounding harbor cities?",
        answer:
          "Yes — Lakewood, Signal Hill, Seal Beach, San Pedro, and the rest of the South Bay and north OC coast are all in our regular rotation.",
      },
      {
        question: "What does hibachi at home cost in Long Beach?",
        answer:
          "$59.90 per adult, $29.95 per child under 13, with a $599 event minimum — covering chef, grill, food, live show, setup, and cleanup.",
      },
    ],
    nearby: ["torrance", "huntington-beach", "anaheim"],
  },
  {
    slug: "pasadena",
    city: "Pasadena",
    county: "Los Angeles County",
    metaTitle: "Hibachi at Home Pasadena CA | Private Hibachi Chef",
    metaDescription:
      "Private hibachi chef in Pasadena — craftsman backyards, Rose Bowl gatherings, Caltech & JPL events. $59.90/adult flat rate, setup & cleanup included.",
    intro: [
      "Pasadena's craftsman backyards and tree-lined patios are some of our favorite venues in Los Angeles County. A private hibachi chef sets up under the oaks, and suddenly your Bungalow Heaven backyard is the best teppanyaki room in town.",
      "We cook across Pasadena, South Pasadena, San Marino, Altadena, and the rest of the San Gabriel Valley — birthdays, game days, lab celebrations, and everything between.",
    ],
    neighborhoods: [
      "Bungalow Heaven",
      "Madison Heights",
      "Linda Vista",
      "Hastings Ranch",
      "South Pasadena",
      "San Marino",
      "Altadena",
      "Sierra Madre",
      "Arcadia",
      "Eagle Rock",
    ],
    occasions: [
      {
        title: "Rose Bowl Game Days",
        description:
          "Skip the stadium lines — host the pre-game or watch party at home with a chef flipping shrimp during warmups.",
      },
      {
        title: "Caltech & JPL Celebrations",
        description:
          "Thesis defenses, mission milestones, and team dinners — we've cooked for more than a few rocket scientists.",
      },
      {
        title: "Garden Party Birthdays",
        description:
          "Pasadena backyards with mature trees and string lights make the hibachi show feel like dinner theater.",
      },
      {
        title: "Family Holidays",
        description:
          "Thanksgiving-adjacent gatherings and Lunar New Year parties where nobody has to spend the day in the kitchen.",
      },
    ],
    faqs: [
      {
        question: "Can you cook under our patio cover or trees?",
        answer:
          "Yes, with adequate clearance — we need roughly 10 ft of overhead clearance above the grill for safe flame work. Solid-roof patios and mature trees usually work fine; we'll confirm from a photo before your event.",
      },
      {
        question: "Do you serve the rest of the San Gabriel Valley?",
        answer:
          "Yes — South Pasadena, San Marino, Altadena, Arcadia, Sierra Madre, and neighboring cities are all regular service areas.",
      },
      {
        question: "Can you handle mixed dietary needs for a faculty or team dinner?",
        answer:
          "Absolutely. Vegetarian, vegan, and gluten-free guests are easy to accommodate at the same per-person rate — just note it when booking. Our recipes are already free of nuts and sesame.",
      },
      {
        question: "What does hibachi at home cost in Pasadena?",
        answer:
          "$59.90 per adult, $29.95 per child under 13, $599 event minimum — chef, grill, food, show, setup, and cleanup all included.",
      },
    ],
    nearby: ["glendale", "santa-clarita", "santa-monica"],
  },
  {
    slug: "santa-monica",
    city: "Santa Monica",
    county: "Los Angeles County",
    metaTitle: "Hibachi at Home Santa Monica CA | Private Hibachi Chef",
    metaDescription:
      "Private hibachi chef in Santa Monica — beachside patios, rooftop decks, sunset dinner parties. $59.90/adult flat rate with setup and cleanup included.",
    intro: [
      "Sunset over the Pacific, a private chef at the grill, and nobody has to find parking on Ocean Avenue. Hibachi at home in Santa Monica means rooftop decks, courtyard patios, and North of Montana backyards turned into the city's most exclusive teppanyaki table.",
      "Our chefs are pros at compact coastal setups — smaller patios, ocean breeze, and building rules included. We bring everything and leave the space spotless.",
    ],
    neighborhoods: [
      "North of Montana",
      "Ocean Park",
      "Sunset Park",
      "Wilshire-Montana",
      "Mid-City Santa Monica",
      "Venice",
      "Pacific Palisades",
      "Brentwood",
      "West LA",
      "Marina del Rey",
    ],
    occasions: [
      {
        title: "Sunset Dinner Parties",
        description:
          "Golden hour on a west-facing deck with a live teppanyaki show — the reason people move to Santa Monica.",
      },
      {
        title: "Rooftop Celebrations",
        description:
          "Birthdays and engagement parties on condo rooftop decks, with a setup sized for the space and cleared with your building.",
      },
      {
        title: "Beach House Gatherings",
        description:
          "Ocean Park and Venice rentals where the after-beach dinner becomes the main event.",
      },
      {
        title: "Intimate Date-Night Dinners",
        description:
          "Anniversaries and proposals with a private chef — we've been the surprise more than once.",
      },
    ],
    faqs: [
      {
        question: "Can you cook on an apartment balcony or rooftop?",
        answer:
          "Often yes — we need about an 8x8 ft outdoor space, open air above the grill, and your building's OK for outdoor cooking. Send photos with your quote request and we'll confirm feasibility honestly before you book.",
      },
      {
        question: "What about the ocean breeze?",
        answer:
          "We cook on the Westside year-round and bring windscreens for exposed decks. Evening marine layer is no problem for the grill or the show.",
      },
      {
        question: "Can you cook on the beach?",
        answer:
          "Not on public sand — Santa Monica beaches don't permit private open-flame cooking. Private patios, decks, courtyards, and backyards all work great.",
      },
      {
        question: "What does hibachi at home cost in Santa Monica?",
        answer:
          "$59.90 per adult, $29.95 per child under 13, with a $599 event minimum — chef, grill, food, live show, setup, and cleanup included.",
      },
    ],
    nearby: ["torrance", "glendale", "pasadena"],
  },
  {
    slug: "huntington-beach",
    city: "Huntington Beach",
    county: "Orange County",
    metaTitle: "Hibachi at Home Huntington Beach CA | Private Hibachi Chef",
    metaDescription:
      "Private hibachi chef in Huntington Beach — Surf City backyards, fire-pit patios, graduation & birthday parties. $59.90/adult flat rate, setup & cleanup included.",
    intro: [
      "Surf City already lives outdoors — hibachi at home just makes it official. From backyard fire-pit patios in Huntington Harbour to family homes off Goldenwest, our chef rolls in with the grill and turns your next party into dinner and a show.",
      "We cook across Huntington Beach, Sunset Beach, Fountain Valley, and the north OC coast, in beach weather and marine layer alike.",
    ],
    neighborhoods: [
      "Huntington Harbour",
      "Downtown HB",
      "Southeast HB",
      "Bolsa Chica",
      "Sunset Beach",
      "Fountain Valley",
      "Westminster",
      "Midway City",
      "Seal Beach",
      "Costa Mesa",
    ],
    occasions: [
      {
        title: "Backyard Beach Parties",
        description:
          "Post-surf birthdays and summer gatherings where the chef show is the entertainment and dinner in one.",
      },
      {
        title: "Graduations",
        description:
          "HB high school and Golden West grads celebrated at home — no restaurant wait, no per-plate surprise fees.",
      },
      {
        title: "Harbour-Front Dinners",
        description:
          "Huntington Harbour patios overlooking the water, with teppanyaki at sunset and the boats going by.",
      },
      {
        title: "Fourth of July & Summer Holidays",
        description:
          "The most HB way to host a holiday: grill fire, ocean air, and zero cleanup for the host.",
      },
    ],
    faqs: [
      {
        question: "Does the marine layer or beach wind affect the show?",
        answer:
          "No — our chefs cook beachside all year and bring windscreens for exposed patios. If real rain threatens, a complimentary tent keeps the chef cooking.",
      },
      {
        question: "Can you set up near our fire pit or pool?",
        answer:
          "Yes, with a safe buffer. The grill needs about an 8x8 ft footprint on a stable surface away from pool splash zones — our chef sorts the layout on arrival.",
      },
      {
        question: "Do you serve Sunset Beach and Fountain Valley too?",
        answer: "Yes — the whole north OC coast and inland to Westminster and Fountain Valley are regular service areas.",
      },
      {
        question: "What does hibachi at home cost in Huntington Beach?",
        answer:
          "$59.90 per adult, $29.95 per child under 13, $599 event minimum — chef, grill, food, show, setup, and cleanup included.",
      },
    ],
    nearby: ["newport-beach", "irvine", "long-beach"],
  },
  {
    slug: "riverside",
    city: "Riverside",
    county: "Riverside County",
    metaTitle: "Hibachi at Home Riverside CA | Private Hibachi Chef",
    metaDescription:
      "Private hibachi chef in Riverside & the Inland Empire — big backyards, warm evenings, UCR graduations, milestone parties. $59.90/adult flat rate.",
    intro: [
      "Inland Empire backyards are built for hibachi: room for the grill, room for the crowd, and warm evenings that make outdoor dinner shows feel effortless. From Canyon Crest to Woodcrest, our chefs bring the full teppanyaki experience to Riverside homes year-round.",
      "One flat rate covers the chef, grill, fresh ingredients, live show, setup, and cleanup — for birthdays, graduations, quinceañera after-parties, and family milestones of every kind.",
    ],
    neighborhoods: [
      "Canyon Crest",
      "Woodcrest",
      "Orangecrest",
      "Mission Grove",
      "La Sierra",
      "Downtown Riverside",
      "Jurupa Valley",
      "Moreno Valley",
      "Norco",
      "Grand Terrace",
    ],
    occasions: [
      {
        title: "UCR & RCC Graduations",
        description:
          "Commencement season backyard parties where the grad gets a show and the family gets a real dinner.",
      },
      {
        title: "Milestone Birthdays & Quinceañera Weekends",
        description:
          "Big family celebrations are our specialty — multiple chefs and grills for larger guest lists, one simple reservation.",
      },
      {
        title: "Ranch & Estate Events",
        description:
          "Norco and Woodcrest properties with space to spare — rehearsal dinners and anniversaries under the open sky.",
      },
      {
        title: "Summer Evening Parties",
        description:
          "IE summer nights were made for teppanyaki — we book sunset slots so the show starts as the heat breaks.",
      },
    ],
    faqs: [
      {
        question: "Is there a travel fee to Riverside?",
        answer:
          "Depending on your exact location a modest travel fee may apply — it's calculated from your address and shown upfront in your quote before you pay anything.",
      },
      {
        question: "It's 100°F here in summer — how does that work?",
        answer:
          "We book evening slots in summer so the show starts as the sun drops. The chef handles the heat at the grill; your guests enjoy dinner in the shade or under lights.",
      },
      {
        question: "Can you handle 40+ guests for a big family party?",
        answer:
          "Yes — we scale with additional chefs and grills. One reservation, one flat per-person rate, and the party runs in simultaneous cooking stations.",
      },
      {
        question: "What does hibachi at home cost in Riverside?",
        answer:
          "$59.90 per adult, $29.95 per child under 13, $599 event minimum — everything included. Weekday Saver ($45.90/adult, Mon–Thu, 15+ guests) applies in California too.",
      },
    ],
    nearby: ["corona", "temecula", "anaheim"],
  },
  {
    slug: "temecula",
    city: "Temecula",
    county: "Riverside County",
    metaTitle: "Hibachi at Home Temecula CA | Private Hibachi Chef",
    metaDescription:
      "Private hibachi chef in Temecula wine country — vineyard Airbnbs, bachelorette weekends, estate dinners. $59.90/adult flat rate, setup & cleanup included.",
    intro: [
      "Wine country weekends end better with fire. Temecula's vineyard-view Airbnbs and estate rentals are one of our favorite stages: the group comes back from tastings, and a private hibachi chef is already setting up on the patio for the evening's show.",
      "We cook across Temecula, Murrieta, and the wine country corridor — bachelorette parties, birthday weekends, and family getaways with dinner handled.",
    ],
    neighborhoods: [
      "Wine Country",
      "Old Town Temecula",
      "Redhawk",
      "Morgan Hill",
      "Harveston",
      "Paloma del Sol",
      "Murrieta",
      "Wildomar",
      "Menifee",
      "Fallbrook",
    ],
    occasions: [
      {
        title: "Bachelorette & Bachelor Weekends",
        description:
          "The classic Temecula itinerary: wineries by day, private chef show at the rental by night. We handle dinner so nobody has to drive.",
      },
      {
        title: "Vineyard Airbnb Dinners",
        description:
          "Estate rentals with vineyard views — the chef sets up on the patio and the show runs through sunset.",
      },
      {
        title: "Golf Trip Dinners",
        description:
          "Redhawk and Temecula Creek groups who want a real dinner at the house after 18 holes.",
      },
      {
        title: "Anniversary & Birthday Getaways",
        description:
          "Milestone celebrations where wine country scenery meets teppanyaki fire.",
      },
    ],
    faqs: [
      {
        question: "Can you cook at our vineyard-area vacation rental?",
        answer:
          "Yes — wine country rentals are our most common Temecula booking. We need a permitted outdoor space (patio, courtyard, or driveway) and confirmation that your rental allows outdoor cooking events.",
      },
      {
        question: "Is there a travel fee to Temecula?",
        answer:
          "Often a modest one, depending on your exact address — it's calculated and shown upfront in your instant quote before any commitment.",
      },
      {
        question: "Can we pair the dinner with our own wine?",
        answer:
          "Please do — you supply the bottles from your tasting haul, we supply the chef, the show, and the traditional sake service for guests who want it.",
      },
      {
        question: "What does hibachi at home cost in Temecula?",
        answer:
          "$59.90 per adult, $29.95 per child under 13, with a $599 event minimum — chef, grill, food, live show, setup, and cleanup included.",
      },
    ],
    nearby: ["riverside", "corona", "oceanside"],
  },
  {
    slug: "santa-clarita",
    city: "Santa Clarita",
    county: "Los Angeles County",
    metaTitle: "Hibachi at Home Santa Clarita CA | Private Hibachi Chef",
    metaDescription:
      "Private hibachi chef in Santa Clarita — Valencia backyards, family parties, graduation celebrations. $59.90/adult flat rate with setup and cleanup included.",
    intro: [
      "Santa Clarita does backyard gatherings right: cul-de-sac neighborhoods in Valencia and Saugus, pool decks in Stevenson Ranch, and families who'd rather host than drive into LA. A private hibachi chef brings the restaurant — and the show — to you.",
      "We serve all of the Santa Clarita Valley with the full teppanyaki experience: grill, fresh ingredients, live performance, setup, and cleanup.",
    ],
    neighborhoods: [
      "Valencia",
      "Saugus",
      "Canyon Country",
      "Newhall",
      "Stevenson Ranch",
      "Castaic",
      "Westridge",
      "Bridgeport",
      "Copper Hill",
      "Sand Canyon",
    ],
    occasions: [
      {
        title: "Backyard Birthday Parties",
        description:
          "Kids' parties with the onion volcano and egg toss; adult milestones with filet and lobster upgrades.",
      },
      {
        title: "Graduation Celebrations",
        description:
          "Hart District and COC grads celebrated at home — book May–June dates early.",
      },
      {
        title: "Pool Party Dinners",
        description:
          "Stevenson Ranch and Westridge pool decks where the chef takes over when the swimming winds down.",
      },
      {
        title: "Neighborhood Get-Togethers",
        description:
          "Cul-de-sac block parties and HOA socials with multiple grills and simultaneous shows for bigger crowds.",
      },
    ],
    faqs: [
      {
        question: "How hot is too hot for a summer party?",
        answer:
          "We cook SCV summers regularly — evening bookings start as the heat breaks, and the show runs into the cool of the night. Shade for guests plus a sunset start is the winning formula.",
      },
      {
        question: "Can you handle a 30–50 person block party?",
        answer:
          "Yes — we bring additional chefs and grills for large groups and run simultaneous stations so everyone eats hot food together. One reservation covers it.",
      },
      {
        question: "Do you serve Castaic and Sand Canyon?",
        answer: "Yes — the whole Santa Clarita Valley, from Castaic down through Newhall and out to Sand Canyon.",
      },
      {
        question: "What does hibachi at home cost in Santa Clarita?",
        answer:
          "$59.90 per adult, $29.95 per child under 13, $599 event minimum — chef, grill, food, show, setup, and cleanup included.",
      },
    ],
    nearby: ["glendale", "pasadena", "santa-monica"],
  },
  {
    slug: "torrance",
    city: "Torrance",
    county: "Los Angeles County",
    metaTitle: "Hibachi at Home Torrance CA | Private Hibachi Chef",
    metaDescription:
      "Private hibachi chef in Torrance & the South Bay — authentic teppanyaki for an audience that knows the real thing. $59.90/adult flat rate, setup & cleanup included.",
    intro: [
      "Torrance is home to one of the largest Japanese-American communities in the country — which means our chefs cook for the most discerning teppanyaki audience in Southern California, and we like it that way. Real technique, fresh ingredients, and a show that holds up.",
      "We serve all of Torrance and the South Bay: birthdays in West Torrance, family dinners in Old Torrance, and beach-adjacent patios from Redondo to Palos Verdes.",
    ],
    neighborhoods: [
      "West Torrance",
      "Old Torrance",
      "Walteria",
      "Hollywood Riviera",
      "Redondo Beach",
      "Manhattan Beach",
      "Hermosa Beach",
      "Palos Verdes",
      "Gardena",
      "Carson",
    ],
    occasions: [
      {
        title: "Family Dinners That Have Standards",
        description:
          "When the grandparents grew up on real teppanyaki, delivery won't cut it. Our chefs bring technique, not just tricks.",
      },
      {
        title: "South Bay Birthdays",
        description:
          "From Hollywood Riviera patios to West Torrance backyards — dinner and a show without the PCH drive.",
      },
      {
        title: "Company & Team Events",
        description:
          "South Bay offices and teams celebrate at private homes with multi-station setups for bigger groups.",
      },
      {
        title: "Beach City Gatherings",
        description:
          "Redondo, Hermosa, and Manhattan Beach patios where the marine layer is no match for the grill.",
      },
    ],
    faqs: [
      {
        question: "How authentic is the menu?",
        answer:
          "Our chefs cook proper teppanyaki — garlic butter fried rice made live, proteins cooked to order, real knife work. The show is the fun part; the food is the point.",
      },
      {
        question: "Do you serve the whole South Bay?",
        answer:
          "Yes — Torrance, Redondo, Hermosa, Manhattan Beach, Palos Verdes, Gardena, and Carson are all core service areas.",
      },
      {
        question: "Can you accommodate a mixed group with dietary needs?",
        answer:
          "Easily — vegetarian, vegan, and gluten-free guests are served at the same rate with advance notice. Recipes are already free of nuts and sesame.",
      },
      {
        question: "What does hibachi at home cost in Torrance?",
        answer:
          "$59.90 per adult, $29.95 per child under 13, $599 event minimum — chef, grill, food, show, setup, and cleanup included.",
      },
    ],
    nearby: ["long-beach", "santa-monica", "huntington-beach"],
  },
  {
    slug: "newport-beach",
    city: "Newport Beach",
    county: "Orange County",
    metaTitle: "Hibachi at Home Newport Beach CA | Private Hibachi Chef",
    metaDescription:
      "Private hibachi chef in Newport Beach — Balboa Island patios, waterfront dinners, upscale events with filet & lobster upgrades. $59.90/adult flat rate.",
    intro: [
      "Newport Beach entertains at a certain level, and a private hibachi chef fits right in: dockside patios on Balboa Island, courtyards in Corona del Mar, and Lido Isle dinner parties where the show is as polished as the guest list.",
      "Premium upgrades — filet mignon, lobster, scallops — turn the standard menu into a proper waterfront dinner party. Setup is compact and tidy; cleanup is complete.",
    ],
    neighborhoods: [
      "Balboa Island",
      "Balboa Peninsula",
      "Lido Isle",
      "Corona del Mar",
      "Newport Coast",
      "Dover Shores",
      "Eastbluff",
      "Crystal Cove",
      "Costa Mesa",
      "Laguna Beach",
    ],
    occasions: [
      {
        title: "Waterfront Dinner Parties",
        description:
          "Dockside and bayfront patios where teppanyaki fire meets harbor lights. We cook on private property, steps from the boat.",
      },
      {
        title: "Upscale Birthdays & Anniversaries",
        description:
          "Filet, lobster, and scallop upgrades with a chef performance that earns the occasion.",
      },
      {
        title: "Client & Corporate Entertaining",
        description:
          "Private-home client dinners where the entertainment is built into the meal.",
      },
      {
        title: "Summer House Parties",
        description:
          "Peninsula and island rentals in July — we navigate the tight streets and compact patios like locals.",
      },
    ],
    faqs: [
      {
        question: "Can you set up on Balboa Island's smaller patios?",
        answer:
          "Yes — island patios are a regular gig. We need roughly an 8x8 ft outdoor footprint; send photos with your quote request and we'll confirm the layout in advance.",
      },
      {
        question: "Can you cook on our dock or aboard the boat?",
        answer:
          "Dockside on private property, yes. Aboard a vessel, no — open-flame teppanyaki and boats don't mix. The dock show with the boat as backdrop is the move.",
      },
      {
        question: "What premium menu upgrades are available?",
        answer:
          "Filet mignon, lobster, and scallops are the favorites for Newport events — priced per guest as add-ons to the $59.90 base. Full details appear in your instant quote.",
      },
      {
        question: "What does hibachi at home cost in Newport Beach?",
        answer:
          "$59.90 per adult, $29.95 per child under 13, $599 event minimum — chef, grill, food, show, setup, and cleanup included. Upgrades optional.",
      },
    ],
    nearby: ["irvine", "huntington-beach", "anaheim"],
  },
  {
    slug: "glendale",
    city: "Glendale",
    county: "Los Angeles County",
    metaTitle: "Hibachi at Home Glendale CA | Private Hibachi Chef",
    metaDescription:
      "Private hibachi chef in Glendale — hillside backyards, big multigenerational family gatherings, birthdays. $59.90/adult flat rate, setup & cleanup included.",
    intro: [
      "Glendale gatherings run big — multigenerational tables, hillside backyards in Verdugo Woodlands, and hosts who take feeding people seriously. A private hibachi chef matches that energy: a full live show, generous portions, and a spread the whole family talks about after.",
      "We cook across Glendale, Burbank, La Crescenta, and the Verdugos — from Adams Hill patios to Rossmoyne backyards.",
    ],
    neighborhoods: [
      "Verdugo Woodlands",
      "Rossmoyne",
      "Adams Hill",
      "Montrose",
      "La Crescenta",
      "Sparr Heights",
      "Glenoaks Canyon",
      "Burbank",
      "Eagle Rock",
      "Atwater Village",
    ],
    occasions: [
      {
        title: "Big Family Feasts",
        description:
          "Multigenerational gatherings where 25 guests is a normal Tuesday — we scale chefs and grills to match, one reservation.",
      },
      {
        title: "Hillside Backyard Birthdays",
        description:
          "Verdugo view patios with the grill fire going as the city lights come on.",
      },
      {
        title: "Graduation & Name-Day Celebrations",
        description:
          "Milestones that call for a proper show, not a chafing dish.",
      },
      {
        title: "Holiday Hosting",
        description:
          "New Year and summer holidays where the host actually gets to sit down — setup and cleanup are on us.",
      },
    ],
    faqs: [
      {
        question: "Can you handle a 30+ person family gathering?",
        answer:
          "Yes — larger parties get multiple chefs and grills running simultaneous stations so every table eats hot food together. One reservation, one flat per-person rate.",
      },
      {
        question: "Our backyard is on a hillside slope — is that workable?",
        answer:
          "Usually, yes — the grill needs a stable, level 8x8 ft area (a patio pad or flat lawn section works). Send photos with your quote and we'll confirm placement.",
      },
      {
        question: "Do you serve Burbank and La Crescenta too?",
        answer: "Yes — Burbank, Montrose, La Crescenta, Eagle Rock, and the whole Verdugo corridor are regular stops.",
      },
      {
        question: "What does hibachi at home cost in Glendale?",
        answer:
          "$59.90 per adult, $29.95 per child under 13, $599 event minimum — chef, grill, food, show, setup, and cleanup included.",
      },
    ],
    nearby: ["pasadena", "santa-clarita", "santa-monica"],
  },
  {
    slug: "corona",
    city: "Corona",
    county: "Riverside County",
    metaTitle: "Hibachi at Home Corona CA | Private Hibachi Chef",
    metaDescription:
      "Private hibachi chef in Corona — big Inland Empire backyards, family milestones, warm-evening parties. $59.90/adult flat rate with setup and cleanup.",
    intro: [
      "Corona backyards have what LA patios dream of: space. Room for the grill, room for long tables, and warm Inland Empire evenings that keep the party outside until late. Our chef brings the teppanyaki show to Dos Lagos, Eagle Glen, and every neighborhood between.",
      "Just off the 91 and 15, Corona is an easy run for our chefs — birthdays, graduations, and family milestones with everything included.",
    ],
    neighborhoods: [
      "Dos Lagos",
      "Eagle Glen",
      "Sierra del Oro",
      "South Corona",
      "Corona Hills",
      "Horsethief Canyon",
      "Norco",
      "Eastvale",
      "Chino Hills",
      "Lake Elsinore",
    ],
    occasions: [
      {
        title: "Backyard Milestone Parties",
        description:
          "Quinceañera after-parties, Sweet 16s, and 50th birthdays with space for the whole guest list.",
      },
      {
        title: "Graduation Season",
        description:
          "Santiago and Centennial grads celebrated at home — May and June dates go quickly.",
      },
      {
        title: "Summer Evening Cookouts",
        description:
          "Sunset-slot bookings where the show starts as the heat breaks and runs under the string lights.",
      },
      {
        title: "Golf-Course Community Dinners",
        description:
          "Eagle Glen and Dos Lagos patios where the 19th hole is your own backyard.",
      },
    ],
    faqs: [
      {
        question: "Is there a travel fee to Corona?",
        answer:
          "Sometimes a modest one depending on your address — it's calculated automatically and shown in your instant quote before you commit to anything.",
      },
      {
        question: "Can you do a large party of 40+ in my backyard?",
        answer:
          "Yes — that's what IE backyards are for. We bring additional chefs and grills, run simultaneous stations, and you still make just one reservation.",
      },
      {
        question: "Do you serve Eastvale and Norco?",
        answer: "Yes — Eastvale, Norco, Chino Hills, and the surrounding IE communities are all in our service area.",
      },
      {
        question: "What does hibachi at home cost in Corona?",
        answer:
          "$59.90 per adult, $29.95 per child under 13, $599 event minimum — chef, grill, food, show, setup, and cleanup included. Weekday Saver ($45.90/adult, Mon–Thu, 15+ guests) also applies.",
      },
    ],
    nearby: ["riverside", "anaheim", "temecula"],
  },
  {
    slug: "oceanside",
    city: "Oceanside",
    county: "San Diego County",
    metaTitle: "Hibachi at Home Oceanside CA | Private Hibachi Chef",
    metaDescription:
      "Private hibachi chef in Oceanside & North County San Diego — military homecomings, beach rentals, backyard parties. $59.90/adult flat rate.",
    intro: [
      "North County's beach town does celebrations its own way: homecomings at Camp Pendleton, vacation rentals near the pier, and backyard parties from Fire Mountain to South O. Our private hibachi chef brings the grill, the food, and the show — you just gather the people.",
      "We serve Oceanside, Carlsbad, Vista, and the North County corridor year-round in true beach-town weather.",
    ],
    neighborhoods: [
      "South Oceanside",
      "Fire Mountain",
      "Rancho del Oro",
      "Downtown / Pier Area",
      "Morro Hills",
      "Carlsbad",
      "Vista",
      "San Marcos",
      "Encinitas",
      "Camp Pendleton Area",
    ],
    occasions: [
      {
        title: "Military Homecomings & Send-Offs",
        description:
          "Camp Pendleton families are regulars — deployments end and begin with a proper backyard feast and a show for the kids.",
      },
      {
        title: "Beach Rental Weekends",
        description:
          "Pier-area and South O vacation homes where the after-beach dinner becomes the main event.",
      },
      {
        title: "Birthdays & Retirements",
        description:
          "From first birthdays to 20-year retirement parties — one flat rate, everything handled.",
      },
      {
        title: "North County Family Gatherings",
        description:
          "Carlsbad, Vista, and San Marcos backyards with the whole crew around the grill.",
      },
    ],
    faqs: [
      {
        question: "Do you cook for events near Camp Pendleton?",
        answer:
          "Regularly — homecomings, retirements, and promotion parties at homes in and around Oceanside. For on-base housing, confirm your housing office's outdoor-cooking rules and we'll work within them.",
      },
      {
        question: "Can you cook at our beach vacation rental?",
        answer:
          "Yes — pier-area and South O rentals are common bookings. We need a permitted outdoor space (patio, deck, or driveway); public beach sand is off-limits for open flame.",
      },
      {
        question: "Do you serve the rest of North County?",
        answer: "Yes — Carlsbad, Vista, San Marcos, Encinitas, and Fallbrook are all regular service areas.",
      },
      {
        question: "What does hibachi at home cost in Oceanside?",
        answer:
          "$59.90 per adult, $29.95 per child under 13, $599 event minimum — chef, grill, food, live show, setup, and cleanup included.",
      },
    ],
    nearby: ["san-diego", "temecula", "irvine"],
  },
  {
    slug: "palm-springs",
    city: "Palm Springs",
    county: "Riverside County",
    metaTitle: "Hibachi at Home Palm Springs CA | Private Hibachi Chef",
    metaDescription:
      "Private hibachi chef in Palm Springs — pool-party weekends, bachelorette trips, mid-century patio dinners at your vacation rental. $59.90/adult flat rate.",
    intro: [
      "Palm Springs is the vacation-rental party capital of California, and a private hibachi chef is the upgrade every group chat agrees on. Mid-century patios, pool decks at golden hour, and a live fire show against the San Jacinto backdrop — dinner becomes the itinerary.",
      "We cook across the whole Coachella Valley: Palm Springs, Palm Desert, La Quinta, Rancho Mirage, and Indio. Evening slots keep desert heat out of the equation.",
    ],
    neighborhoods: [
      "Movie Colony",
      "Twin Palms",
      "Vista Las Palmas",
      "Deepwell Estates",
      "Racquet Club Estates",
      "Cathedral City",
      "Rancho Mirage",
      "Palm Desert",
      "La Quinta",
      "Indio",
    ],
    occasions: [
      {
        title: "Bachelorette Weekends",
        description:
          "The signature Palm Springs booking: pool day, golden-hour photos, then a private chef show at the rental. Nobody drives, nobody cooks.",
      },
      {
        title: "Birthday Trip Dinners",
        description:
          "Milestone birthdays at mid-century rentals where the teppanyaki flame is the evening's centerpiece.",
      },
      {
        title: "Festival Season Groups",
        description:
          "Coachella and Stagecoach houses that want one real dinner between festival days — book these dates well ahead.",
      },
      {
        title: "Poolside Dinner Parties",
        description:
          "The chef sets up on the deck, the pool glows, the mountains turn pink. That's the whole pitch.",
      },
    ],
    faqs: [
      {
        question: "Can you cook at our Palm Springs vacation rental?",
        answer:
          "Yes — vacation rentals are most of our desert bookings. We need a permitted outdoor space and the rental's OK for outdoor cooking events. Many Palm Springs rentals have quiet hours; our show wraps well within them when you book an early-evening slot.",
      },
      {
        question: "What about summer desert heat?",
        answer:
          "Summer bookings run at sunset and after — the show starts as the temperature drops and the patio becomes perfect. Misters and shade for guests help; the chef handles the grill heat regardless.",
      },
      {
        question: "Is there a travel fee to the desert?",
        answer:
          "Usually yes, given the distance from our SoCal base — the exact amount is calculated from your address and shown upfront in your instant quote.",
      },
      {
        question: "What does hibachi at home cost in Palm Springs?",
        answer:
          "$59.90 per adult, $29.95 per child under 13, $599 event minimum — chef, grill, food, show, setup, and cleanup included, plus any disclosed travel fee.",
      },
    ],
    nearby: ["temecula", "riverside", "corona"],
  },
]

export function getCityPage(slug: string): CityPage | undefined {
  return cityPages.find((page) => page.slug === slug)
}

export function getNearbyCityPages(page: CityPage): CityPage[] {
  return page.nearby
    .map((slug) => getCityPage(slug))
    .filter((nearby): nearby is CityPage => Boolean(nearby))
}
