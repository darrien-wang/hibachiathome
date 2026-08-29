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

// Where we actually set the grill up in this city. Three entries, and each one
// should name a real housing stock / venue type someone who lives there would
// recognize — not "backyards, patios, and event spaces".
export type CityVenue = {
  title: string
  description: string
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
  venues: CityVenue[]
  // A party Chef Bling actually cooked in this city, in his own words.
  // OPTIONAL AND STAYS OPTIONAL: only add one when there is a real party to
  // describe. An invented story here would undo the point of the whole page.
  story?: {
    heading: string
    body: string[]
    readMore?: { label: string; href: string }
  }
  // Two paragraphs on the practical stuff that is genuinely different in this
  // city: parking and street rules, HOA/permit reality, clearance, timing.
  // This is the section that proves we have actually worked here.
  logistics: string[]
  faqs: CityFaq[]
  nearby: string[]
  // ISO date this page's content last meaningfully changed, for sitemap
  // lastModified. Omit to fall back to CITY_PAGES_LAST_UPDATED. Set it per
  // city when you edit one page on its own — a lastmod that claims every page
  // changed on the same day is the kind of thing search engines learn to
  // ignore, and so is one that never moves at all.
  lastUpdated?: string
}

// The date the whole city-page set was last revised together. Bump this when a
// change lands across all of them (a template edit, a pricing change); use a
// per-city `lastUpdated` when only one page moves.
export const CITY_PAGES_LAST_UPDATED = "2026-08-27T00:00:00.000Z"

export const cityPages: CityPage[] = [
  {
    slug: "los-angeles",
    city: "Los Angeles",
    county: "Los Angeles County",
    metaTitle: "Hibachi at Home Los Angeles CA | Private Hibachi Chef",
    metaDescription:
      "Private hibachi chef anywhere in Los Angeles — backyards, rooftops, and rentals from the Westside to the Valley. $59.90/adult flat rate, setup & cleanup included, $19.90 deposit.",
    intro: [
      "Los Angeles is the reason we do this. In a city where a Saturday dinner reservation for twelve means three cars, ninety minutes of traffic, and a table you get pushed off at 9pm, a private hibachi chef in your own backyard is simply the better version of the evening. We bring the mobile teppanyaki grill, the food, and the full show — you stay home.",
      "We cook across the whole city: Westside backyards, Hollywood Hills decks, Valley pools, DTLA rooftops, and Eastside bungalows. Flat rate $59.90 per adult, $29.90 per child 5–12, and a flat $5 for kids under 5, $599 event minimum, with setup and cleanup always included and any travel fee shown upfront before you pay anything.",
    ],
    neighborhoods: [
      "Downtown LA",
      "Silver Lake",
      "Los Feliz",
      "Echo Park",
      "Hollywood Hills",
      "Brentwood",
      "Westwood",
      "Mar Vista",
      "Playa Vista",
      "Sherman Oaks",
      "Studio City",
      "Woodland Hills",
      "Eagle Rock",
      "Highland Park",
    ],
    occasions: [
      {
        title: "Backyard Birthdays",
        description:
          "The most-booked party in Los Angeles, and the reason most people find us. Twelve to twenty people, a yard, and a chef who makes the cake unnecessary.",
      },
      {
        title: "Industry Wrap Parties",
        description:
          "End-of-shoot dinners at a producer's house where the crew has already eaten enough catering trucks for one year.",
      },
      {
        title: "Graduation Season",
        description:
          "UCLA, USC, and LMU weekends when every restaurant within five miles is booked solid and the family is flying in anyway.",
      },
      {
        title: "Rooftop & Pool Parties",
        description:
          "DTLA rooftops and Hills pool decks where the flame at golden hour is genuinely the best thing in the room.",
      },
    ],
    venues: [
      {
        title: "Westside Backyards",
        description:
          "Mar Vista, Palms, and Culver-adjacent lots with real yards. Easy setups, usually a driveway to park in, and our highest repeat-booking rate in the city.",
      },
      {
        title: "Hills & Canyon Decks",
        description:
          "Hollywood Hills, Laurel Canyon, and Beachwood homes with stepped decks and hairpin streets. Steep access is normal; we plan for it when you tell us.",
      },
      {
        title: "DTLA & Arts District Rooftops",
        description:
          "Loft buildings with shared roof decks. Great setting, and building approval for open-flame cooking is the one thing to lock down early.",
      },
    ],
    logistics: [
      "Los Angeles is really a dozen different setup problems wearing one name, and the two that decide how your evening starts are parking and stairs. On the Westside and in the Hills, the chef arrives with a teppanyaki grill, propane, and coolers that need to come within about a block of your door — a held driveway space is worth more to your start time than anything else you can arrange. Hillside homes in Laurel Canyon, Beachwood, and Silver Lake often mean two or three flights up from the street, which is completely fine as long as we know before the day.",
      "Rooftop and apartment parties need building sign-off, and in LA the answer comes from the HOA or property manager rather than the front desk, so ask a week ahead. Beyond that: we need roughly a 6x8 ft flat area for the grill and about 10 ft of overhead clearance, which rules out low pergolas and a lot of the mature-tree canopy on the Eastside — a photo sent when you book settles it in a minute. During red-flag fire conditions in the Hills we keep the setup on hardscape well clear of brush.",
    ],
    faqs: [
      {
        question: "Do you cover all of Los Angeles?",
        answer:
          "Yes — the Westside, Downtown, Hollywood, the Eastside, the Harbor area, and the San Fernando Valley are all regular service areas, along with the surrounding LA County cities. The first 50 miles from our base are free, which covers central and southern LA County, the San Gabriel Valley, and most of Orange County — so most LA addresses carry no travel fee at all. Outlying areas like Malibu, the far north county, and the Antelope Valley sit past that; there it is $1 for each mile beyond the free 50, shown upfront in your instant quote before you pay anything.",
      },
      {
        question: "Can you cook on a rooftop or apartment balcony in LA?",
        answer:
          "Rooftops and podium decks, usually yes with the building's approval for open-flame cooking. Enclosed balconies, usually no — we need real ventilation and about 10 ft of overhead clearance. Ask your property manager first, and send us a photo if you are unsure.",
      },
      {
        question: "How far in advance should I book in Los Angeles?",
        answer:
          "Two to three weeks for a weekend date is safe. Graduation season in May and June and the weeks around major holidays go earlier — a $19.90 deposit locks your date and is fully refundable with 72+ hours notice.",
      },
      {
        question: "What does hibachi at home cost in Los Angeles?",
        answer:
          "$59.90 per adult, $29.90 per child 5–12, and a flat $5 for kids under 5, with a $599 event minimum. That covers the chef, grill, 2 proteins per guest, garlic fried rice, vegetables, salad, the live show, setup, and cleanup. Weekday Special pricing ($45.90/adult, Mon-Thu, 15+ guests) is available too.",
      },
      {
        question: "Do I need to provide tables and chairs?",
        answer:
          "You provide the tables, chairs, plates, and utensils, or you can rent them from us — either way there is no per-guest setup surcharge on top of your rate. The chef sets up the cooking station and breaks it down completely.",
      },
    ],
    nearby: ["santa-monica", "pasadena", "glendale"],
  },
  {
    slug: "downtown-los-angeles",
    city: "Downtown LA",
    county: "Los Angeles County",
    metaTitle: "Hibachi at Home Downtown LA | Private Chef & Rooftop Catering",
    metaDescription:
      "Private hibachi chef for DTLA lofts, rooftops, and offices. Arts District to South Park. $59.90/adult flat rate, setup & cleanup included, $19.90 deposit.",
    intro: [
      "Downtown LA parties happen on roofs, in loft courtyards, and in office spaces after hours — and almost none of them have a backyard. That is fine. Our teppanyaki grill is mobile, and a DTLA rooftop at sunset with the skyline behind the flame is one of the best rooms we cook in all year.",
      "We serve the Arts District, South Park, Historic Core, Little Tokyo, Chinatown, and the surrounding blocks. Flat rate $59.90 per adult, $29.90 per child 5–12, and a flat $5 for kids under 5, $599 event minimum, setup and cleanup included.",
    ],
    neighborhoods: [
      "Arts District",
      "South Park",
      "Historic Core",
      "Little Tokyo",
      "Chinatown",
      "Fashion District",
      "Bunker Hill",
      "Financial District",
      "Boyle Heights",
      "Echo Park",
    ],
    occasions: [
      {
        title: "Rooftop Birthdays",
        description:
          "The signature DTLA booking: a building roof deck, twenty friends, and the skyline doing the decorating for you.",
      },
      {
        title: "Office & Team Dinners",
        description:
          "After-hours team celebrations in offices and studios where ordering another catering platter would have been the fifth one this quarter.",
      },
      {
        title: "Loft Housewarmings",
        description:
          "Arts District lofts with courtyards or roof access — the chef works the grill while the party stays exactly where it is.",
      },
      {
        title: "Engagement & Milestone Dinners",
        description:
          "Smaller, dressier evenings where the show is the entertainment and nobody has to book a private room somewhere.",
      },
    ],
    venues: [
      {
        title: "Building Roof Decks",
        description:
          "South Park and Historic Core towers with shared roof lounges. Excellent setting, and the building's open-flame policy is the whole conversation.",
      },
      {
        title: "Arts District Courtyards",
        description:
          "Converted-warehouse lofts with ground-level courtyards and loading access — the easiest DTLA setups by a wide margin.",
      },
      {
        title: "Offices & Studio Spaces",
        description:
          "After-hours events in workspaces with an outdoor terrace or a loading area we can cook in. Ventilation decides it.",
      },
    ],
    logistics: [
      "Downtown is the one part of LA where the building matters more than the address. Before anything else, ask your property manager or HOA two questions: is propane cooking allowed on the roof deck or terrace, and is there freight elevator access with a loading dock time. Buildings that say yes to both make for our smoothest parties in the city; buildings that say no to the first cannot be worked around, and it is much better to find out a week ahead than on the day.",
      "Loading is the other DTLA-specific thing. Metered street parking, one-way blocks, and buildings without a dock all mean the chef needs a plan for moving a grill and coolers from vehicle to venue — a reserved loading zone, a validated garage spot, or a freight elevator window all work. Tell us what your building has and we will schedule the arrival around it. We need roughly a 6x8 ft flat area and about 10 ft of overhead clearance, in open air rather than an enclosed room.",
    ],
    faqs: [
      {
        question: "Can you cook on a DTLA rooftop or terrace?",
        answer:
          "Yes, when the building permits open-flame cooking on that space — most roof decks that allow gas grills allow us. We need open air, roughly a 6x8 ft flat area, and about 10 ft of overhead clearance. Get your property manager's OK before booking and we will handle the rest.",
      },
      {
        question: "What about parking and loading for the chef?",
        answer:
          "This is the main DTLA planning item. A reserved loading zone, a validated garage space, or a freight elevator window all work. Let us know what your building has when you book so the chef arrives at the right door with the right amount of time.",
      },
      {
        question: "Can you do a hibachi dinner in an office after hours?",
        answer:
          "Yes, if there is a terrace, courtyard, or loading area with real ventilation — we cannot cook in an enclosed room. Office team dinners are a regular DTLA booking for us, usually starting between 6 and 7pm.",
      },
      {
        question: "What does hibachi at home cost in Downtown LA?",
        answer:
          "$59.90 per adult, $29.90 per child 5–12, and a flat $5 for kids under 5, $599 event minimum — chef, grill, 2 proteins per guest, fried rice, vegetables, salad, show, setup, and cleanup included, plus any disclosed travel fee.",
      },
    ],
    nearby: ["los-angeles", "pasadena", "glendale"],
  },
  {
    slug: "hollywood",
    city: "Hollywood",
    county: "Los Angeles County",
    metaTitle: "Hibachi at Home Hollywood CA | Private Hibachi Chef",
    metaDescription:
      "Private hibachi chef in Hollywood and the Hollywood Hills — decks, pools, and rentals. $59.90/adult flat rate, setup & cleanup included, $19.90 deposit.",
    intro: [
      "Hollywood parties are usually one of two things: a hillside deck with a view, or a flats bungalow with a yard and string lights. Both are great hibachi venues, and both are far better than trying to get a group of fifteen into a Sunset restaurant on a Saturday night.",
      "We cook throughout Hollywood, the Hollywood Hills, Beachwood Canyon, Los Feliz, and the surrounding blocks. Flat rate $59.90 per adult, $29.90 per child 5–12, and a flat $5 for kids under 5, $599 event minimum, setup and cleanup included.",
    ],
    neighborhoods: [
      "Hollywood Hills",
      "Beachwood Canyon",
      "Los Feliz",
      "Franklin Village",
      "Hollywood Heights",
      "Whitley Heights",
      "Larchmont",
      "Melrose Hill",
      "East Hollywood",
      "Silver Lake",
    ],
    occasions: [
      {
        title: "Hills Deck Dinners",
        description:
          "Golden hour, a view deck, and a chef working the grill while the city lights come on. The most-photographed party we do.",
      },
      {
        title: "Wrap & Industry Parties",
        description:
          "End-of-production dinners where the crew has seen enough craft services for one lifetime and wants something cooked in front of them.",
      },
      {
        title: "Short-Term Rental Groups",
        description:
          "Visiting groups renting a Hills house for the weekend who want one real dinner without a reservation or a rideshare.",
      },
      {
        title: "Birthday Pool Parties",
        description:
          "Daytime pool, evening hibachi, same address. Nobody moves, nobody drives.",
      },
    ],
    venues: [
      {
        title: "Hillside View Decks",
        description:
          "Hollywood Hills and Beachwood homes with stepped, cantilevered decks. Beautiful, and the tightest access in our LA coverage.",
      },
      {
        title: "Flats Bungalow Yards",
        description:
          "Melrose Hill, Franklin Village, and Larchmont-adjacent lots with flat yards and a driveway — our easiest Hollywood setups.",
      },
      {
        title: "Vacation Rental Pool Decks",
        description:
          "Short-term rental properties with pool decks. Check the listing's open-flame and event policy before you book us.",
      },
    ],
    logistics: [
      "The Hills are the whole Hollywood logistics story. Beachwood Canyon, Outpost, and the streets off Mulholland are narrow, steep, and frequently permit-only, and many homes sit two or three flights below or above the street. The chef can absolutely work with that — it is a normal Hills party — but it needs to be said at booking so the right equipment cart comes and the arrival window is wide enough. A held driveway or garage space is genuinely the difference between a relaxed start and a scramble.",
      "Short-term rentals need one check before you book us: LA's rules and most Hills rental listings address open-flame cooking and evening noise directly, and an early-evening start almost always sits comfortably inside quiet hours. During red-flag fire conditions we keep the grill on hardscape and well clear of brush — non-negotiable up here. We need roughly a 6x8 ft flat area and about 10 ft of overhead clearance; deep eaves and low deck roofs are the common reason we shift the position a few feet.",
    ],
    faqs: [
      {
        question: "Can you get a grill up to a Hollywood Hills house?",
        answer:
          "Yes — steep streets, narrow driveways, and multiple flights of stairs are routine for us up here. Just tell us at booking so the chef brings the cart and we schedule enough arrival time. A held driveway or garage space helps more than anything else.",
      },
      {
        question: "Can you cook at a short-term rental in Hollywood?",
        answer:
          "Usually yes, but check the listing first: many Hills rentals have explicit rules on open-flame cooking and evening noise. An early-evening start typically wraps well inside quiet hours.",
      },
      {
        question: "Is hibachi safe on a wooden deck?",
        answer:
          "Yes, with the right placement. We set the grill on a stable, level surface with clearance from railings, walls, and anything overhanging, and the chef manages the flame throughout. During red-flag conditions we move to hardscape away from brush.",
      },
      {
        question: "What does hibachi at home cost in Hollywood?",
        answer:
          "$59.90 per adult, $29.90 per child 5–12, and a flat $5 for kids under 5, with a $599 event minimum — chef, grill, food, live show, setup, and cleanup included.",
      },
    ],
    nearby: ["los-angeles", "west-hollywood", "glendale"],
  },
  {
    slug: "west-hollywood",
    city: "West Hollywood",
    county: "Los Angeles County",
    metaTitle: "Hibachi at Home West Hollywood CA | Private Hibachi Chef",
    metaDescription:
      "Private hibachi chef in West Hollywood — courtyards, rooftop decks, and Norma Triangle backyards. $59.90/adult flat rate, setup & cleanup included.",
    intro: [
      "West Hollywood is dense, walkable, and full of small outdoor spaces that turn out to be perfect hibachi venues — a Norma Triangle backyard, a building courtyard, a rooftop deck off Santa Monica Boulevard. The party is close-in, and the show reads better at close range than it does across a big lawn.",
      "We cook throughout WeHo, from the Sunset Strip down to Beverly Grove and across to the Design District. Flat rate $59.90 per adult, $29.90 per child 5–12, and a flat $5 for kids under 5, $599 event minimum, setup and cleanup included.",
    ],
    neighborhoods: [
      "Norma Triangle",
      "West Hollywood West",
      "Sunset Strip",
      "Design District",
      "Beverly Grove",
      "Melrose",
      "Fairfax",
      "Laurel Canyon",
      "Beverly Hills adjacent",
      "Hollywood",
    ],
    occasions: [
      {
        title: "Birthday Dinner Parties",
        description:
          "Fifteen to twenty-five people who would otherwise be fighting for a table on Santa Monica Boulevard. Everyone stays, everyone eats together.",
      },
      {
        title: "Pride & Summer Gatherings",
        description:
          "Rooftop and courtyard parties during the busiest weeks of the WeHo calendar, when getting a group seated anywhere is genuinely impossible.",
      },
      {
        title: "Engagement Parties",
        description:
          "Smaller, dressier evenings at home where the teppanyaki show is the entertainment and there is no venue minimum to hit.",
      },
      {
        title: "Industry & Agency Dinners",
        description:
          "Team celebrations at a house or building deck where a private room somewhere would have cost more and impressed people less.",
      },
    ],
    venues: [
      {
        title: "Norma Triangle Backyards",
        description:
          "Small, private yards behind classic WeHo homes. Compact setups where the whole party is within ten feet of the grill.",
      },
      {
        title: "Building Courtyards & Pool Decks",
        description:
          "Mid-century apartment complexes with shared courtyards. Great spaces, and the building's cooking policy decides it.",
      },
      {
        title: "Rooftop Decks",
        description:
          "Newer buildings off Santa Monica and Sunset with roof lounges and skyline views. Confirm open-flame approval early.",
      },
    ],
    logistics: [
      "Parking is the defining WeHo constraint. Nearly every residential block is permit-only, meters run late on the commercial corridors, and the chef needs to be within about a block of your door with a grill and coolers. A guest permit, a driveway space, or a garage spot held for the chef is the single most useful thing you can arrange here — more so than in almost any other city we serve.",
      "Shared courtyards and roof decks need building approval for open-flame cooking, and in WeHo's older mid-century complexes the answer varies building to building, so ask the manager or HOA before you book. Neighbors are close everywhere in this city, so we keep setup quiet, keep the footprint tight, and start the loud part of the show only when you are ready. We need roughly a 6x8 ft flat area and about 10 ft of overhead clearance in open air.",
    ],
    faqs: [
      {
        question: "Is parking going to be a problem in West Hollywood?",
        answer:
          "It is the main thing to plan. Most residential blocks are permit-only and the chef needs to unload within about a block of your door. A guest permit, a driveway space, or a held garage spot solves it — tell us what you have when you book.",
      },
      {
        question: "Can we do this in a building courtyard or on a roof deck?",
        answer:
          "Yes, with the building's approval for open-flame cooking. WeHo's older complexes vary building to building, so check with your manager or HOA a week ahead. We need open air, a roughly 6x8 ft flat area, and about 10 ft of overhead clearance.",
      },
      {
        question: "Will the show bother the neighbors?",
        answer:
          "We set up quietly and keep the footprint compact, and the loud, fun part of the show only starts when you are ready. For an evening start, parties typically wrap well inside normal quiet hours.",
      },
      {
        question: "What does hibachi at home cost in West Hollywood?",
        answer:
          "$59.90 per adult, $29.90 per child 5–12, and a flat $5 for kids under 5, $599 event minimum — chef, grill, 2 proteins per guest, fried rice, vegetables, salad, show, setup, and cleanup included.",
      },
    ],
    nearby: ["beverly-hills", "hollywood", "los-angeles"],
  },
  {
    slug: "beverly-hills",
    city: "Beverly Hills",
    county: "Los Angeles County",
    metaTitle: "Hibachi at Home Beverly Hills CA | Private Hibachi Chef",
    metaDescription:
      "Private hibachi chef in Beverly Hills — poolside terraces, garden dinners, and estate events. $59.90/adult flat rate, setup & cleanup included.",
    intro: [
      "Beverly Hills homes were built for exactly this kind of evening: a terrace, a pool, a garden with room for a long table, and enough separation from the street that a live teppanyaki show never feels like an imposition. We bring the grill and the performance to you, and your guests never leave the property.",
      "We cook across Beverly Hills, from the Flats to Trousdale and up into the canyons, plus Beverly Grove and Century City nearby. Flat rate $59.90 per adult, $29.90 per child 5–12, and a flat $5 for kids under 5, $599 event minimum, setup and cleanup included, with any travel fee disclosed upfront.",
    ],
    neighborhoods: [
      "The Flats",
      "Trousdale Estates",
      "Beverly Hills Post Office",
      "Coldwater Canyon",
      "Benedict Canyon",
      "Century City",
      "Beverly Grove",
      "Holmby Hills",
      "Bel Air",
      "Westwood",
    ],
    occasions: [
      {
        title: "Poolside Dinner Parties",
        description:
          "The grill on the terrace, the pool lit behind it, and dinner served course by course as it comes off the flat top.",
      },
      {
        title: "Milestone Birthdays",
        description:
          "Thirties through eighties. The show does the work a hired entertainer would otherwise do, and the food is the actual dinner.",
      },
      {
        title: "Graduation & Family Celebrations",
        description:
          "Beverly Hills High and UCLA weekends when the family is in town and every restaurant nearby is booked out.",
      },
      {
        title: "Private Client & Business Dinners",
        description:
          "Smaller, quieter evenings at home where a restaurant would have been the wrong setting entirely.",
      },
    ],
    venues: [
      {
        title: "Pool Terraces",
        description:
          "Hardscaped terraces with room for the grill well clear of the water — the most common and the easiest Beverly Hills setup.",
      },
      {
        title: "Garden Lawns & Loggias",
        description:
          "Flats properties with mature gardens. We set up on hardscape or a firm level surface rather than soft lawn.",
      },
      {
        title: "Canyon & Trousdale View Decks",
        description:
          "Hillside homes with terraces and city views. Gate access and driveway space are the two things to arrange ahead.",
      },
    ],
    logistics: [
      "Gates and access are the Beverly Hills planning items. Many properties here have a call box, a gate code, or staff who need the chef's name in advance — without that, the chef sits at the gate while your party waits. Send the code or add the chef to the list when you confirm, and note whether the service entrance or the main drive is the right approach.",
      "Street parking is restricted on most residential blocks and enforced seriously, so a spot in the motor court or driveway for the chef is the norm here rather than a favor. Beyond that, Beverly Hills setups are among the smoothest we do: level hardscape, real space, and rarely a stair problem. We need roughly a 6x8 ft flat area and about 10 ft of overhead clearance — deep loggias and low pergolas are the one thing worth a photo in advance. During red-flag fire conditions in the canyons we keep the setup on hardscape well clear of brush.",
    ],
    story: {
      heading: "An estate here taught me the thing I did not expect",
      body: [
        "I cooked a party at a Beverly Hills estate that was everything you would imagine: space, staff, and a host who was extraordinarily generous. She sent every child home with a gift, and she tipped in a way I still remember.",
        "The same year I cooked a grandmother's birthday in Inglewood, in a yard so small I could barely turn around.",
        "Here is what I did not expect: the two parties felt the same. Not similar — the same. Same warmth, same noise, same people leaning in. The money here made that night memorable to me, but it is not what made it a good party. Take away the gifts and the tip and it is still a family that clearly loved each other, which is exactly what Inglewood was.",
        "So when people ask whether their place is nice enough for this, that is my honest answer. The variable was never the yard, and it was never the budget.",
      ],
      readMore: { label: "Read the full story", href: "/blog/will-hibachi-work-in-my-space" },
    },
    faqs: [
      {
        question: "Do you need gate access details in advance?",
        answer:
          "Yes, please. A gate code, a call-box name, or the chef added to your guest list means the chef arrives at your door instead of waiting at the entrance. Note too whether you would rather we use the service entrance or the main drive.",
      },
      {
        question: "Can you set up on a pool terrace?",
        answer:
          "Yes — pool terraces are our most common Beverly Hills setup. We place the grill on level hardscape with clearance from the water, railings, and anything overhanging, and the chef manages the flame throughout.",
      },
      {
        question: "Can you accommodate dietary restrictions for a mixed group?",
        answer:
          "Yes, with advance notice — vegetarian, vegan and gluten-free guests are served at the same per-person rate. Two things to know. Our standard soy sauce is not gluten free, so a coeliac or gluten-free guest should have their own gluten-free soy and teriyaki on hand and we will cook their portion with it. And we cannot promise a nut- or sesame-free table: our sauces and the gyoza are commercial products, some carry allergen advisories, and both sauces contain egg. Tell us the allergy when you book and we will check the labels in use for your date and tell you straight whether we can serve that guest safely.",
      },
      {
        question: "What does hibachi at home cost in Beverly Hills?",
        answer:
          "$59.90 per adult, $29.90 per child 5–12, and a flat $5 for kids under 5, with a $599 event minimum — chef, grill, 2 proteins per guest, garlic fried rice, vegetables, salad, the live show, setup, and cleanup all included. Premium upgrades like filet and lobster are available.",
      },
    ],
    nearby: ["west-hollywood", "culver-city", "santa-monica"],
  },
  {
    slug: "culver-city",
    city: "Culver City",
    county: "Los Angeles County",
    metaTitle: "Hibachi at Home Culver City CA | Private Hibachi Chef",
    metaDescription:
      "Private hibachi chef in Culver City — backyard birthdays, studio team dinners, and Westside gatherings. $59.90/adult flat rate, setup & cleanup included.",
    intro: [
      "Culver City has the thing most of the Westside does not: actual backyards, on flat streets, with driveways to park in. That makes it one of the easiest cities we cook in, and one of the best value-for-effort hibachi venues in Los Angeles — the setup is simple, so the whole evening runs on time.",
      "We cook throughout Culver City and the surrounding Westside, from Blair Hills and Carlson Park out to Mar Vista and Playa Vista. Flat rate $59.90 per adult, $29.90 per child 5–12, and a flat $5 for kids under 5, $599 event minimum, setup and cleanup included.",
    ],
    neighborhoods: [
      "Carlson Park",
      "Blair Hills",
      "Fox Hills",
      "Culver Crest",
      "Downtown Culver City",
      "Mar Vista",
      "Palms",
      "Playa Vista",
      "Marina del Rey",
      "Del Rey",
    ],
    occasions: [
      {
        title: "Backyard Birthdays",
        description:
          "Carlson Park yards with a lawn, a fence, and twenty friends. Our single most-booked Culver City party.",
      },
      {
        title: "Studio & Tech Team Dinners",
        description:
          "Sony, Apple, and Amazon teams celebrating a launch at someone's house instead of booking another private room.",
      },
      {
        title: "Kids' Parties That Adults Enjoy",
        description:
          "The show holds a room of eight-year-olds and their parents at the same time, which very few things do.",
      },
      {
        title: "Housewarmings",
        description:
          "New Westside homeowners introducing the yard to everyone they know, with dinner handled.",
      },
    ],
    venues: [
      {
        title: "Carlson Park Backyards",
        description:
          "Flat lots, real lawns, driveway parking. Genuinely the easiest setups on the Westside.",
      },
      {
        title: "Hillside Homes in Blair Hills & Culver Crest",
        description:
          "Stepped yards and view decks with a few stairs from the street — straightforward as long as we know in advance.",
      },
      {
        title: "Playa Vista & Fox Hills Complexes",
        description:
          "Newer developments with courtyards and shared decks. Building approval for open-flame cooking is the thing to check.",
      },
    ],
    logistics: [
      "Culver City is one of our simplest LA cities. Most homes have a driveway, streets are wide, and load-in is short — which is why we can often accommodate later booking requests here than on the coast. Downtown Culver City blocks near the Ivy Station and Platform area are the exception, where parking is metered and busy in the evening.",
      "The newer Playa Vista and Fox Hills complexes are where rules come up: shared courtyards and podium decks need the association's OK for open-flame cooking, and that answer comes from the HOA rather than the leasing desk. For private yards there is rarely anything to arrange. We need roughly a 6x8 ft flat area and about 10 ft of overhead clearance, and we set up on hardscape or firm level ground rather than soft lawn.",
    ],
    faqs: [
      {
        question: "Do you serve the rest of the Westside from here?",
        answer:
          "Yes — Mar Vista, Palms, Del Rey, Marina del Rey, Playa Vista, and the surrounding neighborhoods are all regular service areas, along with Santa Monica and Beverly Hills nearby.",
      },
      {
        question: "Can you cook in a Playa Vista courtyard or podium deck?",
        answer:
          "With the association's approval for open-flame cooking, yes. Ask the HOA rather than the leasing office, and give it a week. We need open air, a roughly 6x8 ft flat area, and about 10 ft of overhead clearance.",
      },
      {
        question: "Is this good for a kids' birthday party?",
        answer:
          "It is one of the best things we do. The show holds children and adults at the same time, kids 5-12 are $29.90, and kids under 5 are a flat $5. We keep the flame work at a safe distance from the seating.",
      },
      {
        question: "What does hibachi at home cost in Culver City?",
        answer:
          "$59.90 per adult, $29.90 per child 5–12, and a flat $5 for kids under 5, $599 event minimum — chef, grill, food, live show, setup, and cleanup included. Weekday Special pricing ($45.90/adult, Mon-Thu, 15+ guests) is available.",
      },
    ],
    nearby: ["santa-monica", "beverly-hills", "los-angeles"],
  },
  {
    slug: "burbank",
    city: "Burbank",
    county: "Los Angeles County",
    metaTitle: "Hibachi at Home Burbank CA | Private Hibachi Chef",
    metaDescription:
      "Private hibachi chef in Burbank — Magnolia Park backyards, studio team dinners, and Valley pool parties. $59.90/adult flat rate, setup & cleanup included.",
    intro: [
      "Burbank backyards are exactly the right size for this. Flat lots, real grass, a driveway to park in, and a fence line to set the grill against — it is the kind of setup where the chef is cooking within ten minutes of arriving and the whole evening runs early rather than late.",
      "We cook across Burbank, Magnolia Park, the Rancho district, and the surrounding Valley cities. Flat rate $59.90 per adult, $29.90 per child 5–12, and a flat $5 for kids under 5, $599 event minimum, setup and cleanup included.",
    ],
    neighborhoods: [
      "Magnolia Park",
      "Rancho District",
      "Burbank Hills",
      "Toluca Lake",
      "Media District",
      "Chandler",
      "North Hollywood",
      "Studio City",
      "Sun Valley",
      "Glendale",
    ],
    occasions: [
      {
        title: "Studio Wrap Dinners",
        description:
          "Post-production and crew celebrations at a house nearby, hosted by someone who has eaten enough catering trucks this year.",
      },
      {
        title: "Backyard Birthdays",
        description:
          "Magnolia Park and Rancho yards with string lights and a table for twenty — the everyday Burbank booking.",
      },
      {
        title: "Pool Parties",
        description:
          "Valley summers mean the pool gets used from May to October. Swim in the afternoon, hibachi at sunset.",
      },
      {
        title: "Graduation Season",
        description:
          "Burbank High, Burroughs, and Woodbury families hosting at home in May and June when restaurants are booked solid.",
      },
    ],
    venues: [
      {
        title: "Magnolia Park Backyards",
        description:
          "Flat, fenced lots with driveways and room for a long table. Some of the easiest setups in LA County.",
      },
      {
        title: "Rancho District Properties",
        description:
          "Larger equestrian-zone lots with real space — good for bigger guest counts and long tables.",
      },
      {
        title: "Burbank Hills Homes",
        description:
          "Hillside lots with stepped yards and a few stairs from the street. Easy, once we know they are there.",
      },
    ],
    logistics: [
      "Burbank is a straightforward logistics city: driveways are standard, streets are wide, and the chef usually parks within a few steps of the gate. The Media District and blocks near the studios are busier on weekday evenings, but residential Burbank rarely presents a parking problem at all.",
      "Valley heat is the real scheduling factor. From June through September an afternoon start puts your guests next to a teppanyaki grill in triple digits, and the same party at sunset is a completely different evening, so that is what we usually suggest. It is a recommendation, not a rule. Daytime and lunch bookings work well in Burbank from roughly October through May, when a midday party on a shaded patio is genuinely pleasant — it is the peak of Valley summer, not daylight itself, that we steer people away from. Shade over the guest seating matters more than shade over the chef. We need about a 6x8 ft flat area and roughly 10 ft of overhead clearance; mature trees and low patio covers are the usual reason we move the grill a few feet.",
    ],
    faqs: [
      {
        question: "What is the best start time for a Burbank party in summer?",
        answer:
          "For June through September we suggest sunset or later — Valley afternoons run hot enough that guests standing near the grill get uncomfortable. From roughly October through May the opposite is true: a lunch or early-afternoon booking on a shaded patio is one of the nicest ways to do this, and those slots are easier to get than summer evenings.",
      },
      {
        question: "Do you serve Toluca Lake, NoHo, and Studio City too?",
        answer:
          "Yes — Toluca Lake, North Hollywood, Studio City, Sun Valley, and neighboring Glendale are all regular service areas.",
      },
      {
        question: "How much space do we need in the backyard?",
        answer:
          "Roughly a 6x8 ft flat area for the grill and about 10 ft of overhead clearance, plus your table and seating. Most Burbank yards have far more than that. Send a photo when you book and we will pick the grill position ahead of time.",
      },
      {
        question: "What does hibachi at home cost in Burbank?",
        answer:
          "$59.90 per adult, $29.90 per child 5–12, and a flat $5 for kids under 5, $599 event minimum — chef, grill, 2 proteins per guest, fried rice, vegetables, salad, show, setup, and cleanup included. Weekday Special pricing ($45.90/adult, Mon-Thu, 15+ guests) applies here too.",
      },
    ],
    nearby: ["glendale", "los-angeles", "pasadena"],
  },
  {
    slug: "thousand-oaks",
    city: "Thousand Oaks",
    county: "Ventura County",
    metaTitle: "Hibachi at Home Thousand Oaks CA | Private Hibachi Chef",
    metaDescription:
      "Private hibachi chef in Thousand Oaks and the Conejo Valley \u2014 big backyards, pool decks, and gated communities. $59.90/adult flat rate, setup & cleanup included.",
    intro: [
      "The Conejo Valley has the two things that make a hibachi party easy: room and quiet. Backyards out here are big enough for a long table and thirty people, the streets are wide enough that the chef parks fifty feet from your gate, and nobody is close enough to mind an outdoor dinner running late.",
      "We cook throughout Thousand Oaks, Westlake Village, Newbury Park, Agoura Hills, and the surrounding Conejo Valley. Flat rate $59.90 per adult, $29.90 per child 5–12, and a flat $5 for kids under 5, $599 event minimum, setup and cleanup included.",
    ],
    neighborhoods: [
      "Westlake Village",
      "Newbury Park",
      "Agoura Hills",
      "Oak Park",
      "Lynn Ranch",
      "Wildwood",
      "North Ranch",
      "Dos Vientos",
      "Calabasas",
      "Camarillo",
    ],
    occasions: [
      {
        title: "Graduation Season",
        description:
          "Thousand Oaks High, Westlake, and Newbury Park families hosting at home in May and June, usually with relatives flying in for the weekend.",
      },
      {
        title: "Pool Party Birthdays",
        description:
          "Conejo Valley pools get used from May through October. Swim in the afternoon, hibachi at sunset, nobody gets in a car.",
      },
      {
        title: "Big Family Gatherings",
        description:
          "Yards out here comfortably hold thirty, which makes reunions and holiday dinners far easier to host at home than in the city.",
      },
      {
        title: "Corporate & Team Dinners",
        description:
          "Biotech and insurance teams along the 101 corridor celebrating at somebody's house instead of booking another private room.",
      },
    ],
    venues: [
      {
        title: "North Ranch & Lynn Ranch Estates",
        description:
          "Large lots with terraces, lawn and hardscape both, and room for a table of thirty. Among the roomiest setups we do.",
      },
      {
        title: "Pool Deck Setups",
        description:
          "Wide hardscaped decks with the grill placed well clear of the water. The everyday Conejo Valley configuration.",
      },
      {
        title: "Gated Community Homes",
        description:
          "Westlake and North Ranch properties behind a guard gate. A gate code or the chef's name on the list is all we need.",
      },
    ],
    logistics: [
      "Thousand Oaks is one of the easiest cities we serve for load-in \u2014 long driveways, wide streets, and rarely a stair problem. If you are behind a guard gate in Westlake or North Ranch, send the code or add the chef to the list when you confirm; without it the chef waits at the kiosk while your party waits inside.",
      "Two local factors. The Conejo Valley runs hot inland in July and August, so we suggest a sunset start in high summer and a lunch or afternoon booking from roughly October through May, when midday out here is genuinely lovely. And during red-flag fire conditions \u2014 which this corridor gets \u2014 we keep the setup on hardscape well clear of dry brush, especially on lots backing onto open hillside. We need about a 6x8 ft flat area and roughly 10 ft of overhead clearance.",
    ],
    faqs: [
      {
        question: "Is there a travel fee to Thousand Oaks?",
        answer:
          "Usually not. Most Conejo Valley addresses fall inside our free 50-mile radius, and past that it is $1 for each mile beyond the free 50 \u2014 not $1 on the whole distance \u2014 shown upfront in your instant quote before you pay anything.",
      },
      {
        question: "We are in a gated community. What do you need?",
        answer:
          "A gate code, or the chef added to the guard list under your booking name. Send it when you confirm and the chef drives straight in. Without it, entry can take fifteen minutes off your start time.",
      },
      {
        question: "Can you handle 30 guests?",
        answer:
          "Yes \u2014 Conejo Valley yards are among the few that comfortably hold that many, and it is a regular booking for us here. Larger parties may use a second chef or a longer service window; give us the count when you book.",
      },
      {
        question: "What does hibachi at home cost in Thousand Oaks?",
        answer:
          "$59.90 per adult, $29.90 per child 5–12, and a flat $5 for kids under 5, $599 event minimum \u2014 chef, grill, 2 proteins per guest, garlic fried rice, vegetables, salad, the live show, setup, and cleanup included. Weekday Special pricing ($45.90/adult, Mon\u2013Thu, 15+ guests) applies here too.",
      },
    ],
    nearby: ["woodland-hills", "santa-clarita", "malibu"],
  },
  {
    slug: "west-covina",
    city: "West Covina",
    county: "Los Angeles County",
    metaTitle: "Hibachi at Home West Covina CA | Private Hibachi Chef",
    metaDescription:
      "Private hibachi chef in West Covina and the eastern San Gabriel Valley \u2014 backyard parties, family banquets, graduations. $59.90/adult flat rate, setup & cleanup included.",
    intro: [
      "West Covina is about fifteen minutes from where our chefs load the truck, which makes it one of the easiest cities we serve and one of the few where we can often take a booking on shorter notice. The yards are the classic eastern San Gabriel Valley kind: flat, fenced, concrete patio, room for a long folding table and twenty-five people.",
      "We cook throughout West Covina, Covina, Walnut, La Puente, Baldwin Park, and the surrounding SGV. Flat rate $59.90 per adult, $29.90 per child 5–12, and a flat $5 for kids under 5, $599 event minimum, setup and cleanup included, and no travel fee.",
    ],
    neighborhoods: [
      "South Hills",
      "Woodside Village",
      "Covina",
      "Walnut",
      "La Puente",
      "Baldwin Park",
      "Hacienda Heights",
      "Rowland Heights",
      "Glendora",
      "Azusa",
    ],
    occasions: [
      {
        title: "Family Banquets at Home",
        description:
          "The dinner that would otherwise be a restaurant banquet room \u2014 held in the backyard instead, with better seating and no time limit.",
      },
      {
        title: "Graduation Parties",
        description:
          "West Covina, South Hills, and Mt. SAC families hosting in May and June, when every SGV restaurant with a private room is booked out.",
      },
      {
        title: "Holiday Gatherings",
        description:
          "Lunar New Year, Thanksgiving and Christmas dinners where the host would otherwise spend two days in the kitchen.",
      },
      {
        title: "Kids' Birthdays",
        description:
          "The show holds a yard full of children and their parents at the same time, which very few things do.",
      },
    ],
    venues: [
      {
        title: "Classic SGV Backyards",
        description:
          "Flat lots with a concrete patio, a fruit tree or two, and room for a long folding table. The most common setup here by far.",
      },
      {
        title: "South Hills Slope Homes",
        description:
          "Hillside lots with stepped rear patios and a view. A few stairs from the driveway, which is worth flagging at booking.",
      },
      {
        title: "Pool & Covered Patio Homes",
        description:
          "Woodside Village and Covina properties with pool decks and permanent patio covers \u2014 good shade, which matters at a summer lunch.",
      },
    ],
    logistics: [
      "West Covina is close to base, so this is a city where we can sometimes fit a booking in on shorter notice than the coast allows, and where the chef arrives unhurried. Driveways are standard and the streets are wide; load-in is usually a couple of minutes rather than the twenty it can take on the Westside.",
      "The one thing we plan around is overhead. Older SGV lots often have mature fruit trees or a permanent patio cover right over the natural grill spot, and that is the usual reason we shift a setup a few feet. Send a photo when you book and we will pick the position in advance. Summers here are hot and still, so we suggest an evening start from June through September and a lunch booking from roughly October through May. We need about a 6x8 ft flat area and roughly 10 ft of overhead clearance, on concrete or pavers rather than soft lawn.",
    ],
    faqs: [
      {
        question: "Is there a travel fee to West Covina?",
        answer:
          "No. West Covina is well inside our free 50-mile radius, so your quote carries no travel fee at all.",
      },
      {
        question: "Do you serve Covina, Walnut, and Baldwin Park too?",
        answer:
          "Yes \u2014 Covina, Walnut, La Puente, Baldwin Park, Hacienda Heights, Rowland Heights, Glendora and Azusa are all regular service areas, along with the rest of the San Gabriel Valley.",
      },
      {
        question: "How late can we book?",
        answer:
          "Two to three weeks ahead is safe for a weekend, and holiday weekends fill first. That said, West Covina is close enough to base that we can sometimes accommodate shorter notice \u2014 it is worth asking. A $19.90 deposit locks your date, fully refundable with 72+ hours notice.",
      },
      {
        question: "What does hibachi at home cost in West Covina?",
        answer:
          "$59.90 per adult, $29.90 per child 5–12, and a flat $5 for kids under 5, $599 event minimum \u2014 chef, grill, food, live show, setup, and cleanup included, with no travel fee and no per-guest setup surcharge. Weekday Special pricing ($45.90/adult, Mon\u2013Thu, 15+ guests) is available.",
      },
    ],
    nearby: ["rowland-heights", "diamond-bar", "whittier"],
  },
  {
    slug: "whittier",
    city: "Whittier",
    county: "Los Angeles County",
    metaTitle: "Hibachi at Home Whittier CA | Private Hibachi Chef",
    metaDescription:
      "Private hibachi chef in Whittier \u2014 Uptown bungalows, hillside patios, and family backyards. $59.90/adult flat rate, setup & cleanup included, no travel fee.",
    intro: [
      "Whittier has two kinds of backyard and we cook in both: the older Uptown and Hadley lots with deep yards and mature trees, and the hillside homes above Whittier Boulevard with stepped patios and a view over the basin. Both make good hibachi venues; they just need different setups.",
      "We cook across Whittier, La Habra Heights, Santa Fe Springs, Pico Rivera, and the surrounding area. Flat rate $59.90 per adult, $29.90 per child 5–12, and a flat $5 for kids under 5, $599 event minimum, setup and cleanup included, and no travel fee.",
    ],
    neighborhoods: [
      "Uptown Whittier",
      "Hadley",
      "Friendly Hills",
      "East Whittier",
      "La Habra Heights",
      "Santa Fe Springs",
      "Pico Rivera",
      "Downey",
      "La Mirada",
      "Norwalk",
    ],
    occasions: [
      {
        title: "Backyard Birthdays",
        description:
          "Deep Uptown yards with string lights and a table for twenty. The everyday Whittier booking, and our most requested.",
      },
      {
        title: "Graduation Parties",
        description:
          "Whittier College, Whittier High and California High families hosting at home in May and June with relatives in town.",
      },
      {
        title: "Family Reunions",
        description:
          "Long afternoons and big tables, where the chef handles dinner so the host can actually be at the party.",
      },
      {
        title: "Quinceañeras & Milestone Parties",
        description:
          "A live teppanyaki show works as the dinner and the entertainment at once, which takes a line item off the budget.",
      },
    ],
    venues: [
      {
        title: "Uptown & Hadley Backyards",
        description:
          "Older lots with deep yards, real grass, and mature trees. Lovely, and the reason we ask about overhead clearance here.",
      },
      {
        title: "Friendly Hills Terraces",
        description:
          "Hillside homes with stepped rear patios and a view over the basin. Usually a flight of stairs from the driveway.",
      },
      {
        title: "Flat Tract Homes",
        description:
          "East Whittier lots with a driveway, a fence and a concrete patio \u2014 fast, simple setups.",
      },
    ],
    logistics: [
      "Whittier is close to base, so there is no travel fee and the chef arrives with time in hand. The two things worth telling us at booking are stairs and trees. Friendly Hills and the La Habra Heights side often mean a flight or two from where the chef parks down to the patio, which is completely workable as long as we know in advance and bring the cart.",
      "The older Uptown and Hadley lots have the same mature-tree situation as Pasadena \u2014 beautiful, and low branches over the natural grill spot are the usual reason we move the setup a few feet. A photo sent with your quote request settles it before the day. Summer afternoons here run hot enough that we suggest an evening start from June through September; from roughly October through May a lunch or afternoon booking works well. We need about a 6x8 ft flat area and roughly 10 ft of overhead clearance.",
    ],
    faqs: [
      {
        question: "Is there a travel fee to Whittier?",
        answer:
          "No. Whittier is comfortably inside our free 50-mile radius, so your quote carries no travel fee at all.",
      },
      {
        question: "Our patio is up a flight of stairs from the driveway. Is that a problem?",
        answer:
          "Not at all \u2014 that is a normal Friendly Hills setup. Tell us when you book so the chef brings the right cart and we schedule enough arrival time. Stairs have never been the reason a party did not happen; not knowing about them is what shortens setup.",
      },
      {
        question: "Do you serve Pico Rivera, Downey and La Mirada?",
        answer:
          "Yes \u2014 Pico Rivera, Downey, La Mirada, Norwalk, Santa Fe Springs and La Habra Heights are all regular service areas.",
      },
      {
        question: "What does hibachi at home cost in Whittier?",
        answer:
          "$59.90 per adult, $29.90 per child 5–12, and a flat $5 for kids under 5, $599 event minimum \u2014 chef, grill, 2 proteins per guest, fried rice, vegetables, salad, show, setup, and cleanup included, with no travel fee. Weekday Special pricing ($45.90/adult, Mon\u2013Thu, 15+ guests) applies here too.",
      },
    ],
    nearby: ["west-covina", "long-beach", "downtown-los-angeles"],
  },
  {
    slug: "arcadia",
    city: "Arcadia",
    county: "Los Angeles County",
    metaTitle: "Hibachi at Home Arcadia CA | Private Hibachi Chef",
    metaDescription:
      "Private hibachi chef in Arcadia — large backyards, family banquets, and Lunar New Year gatherings. $59.90/adult flat rate, setup & cleanup included.",
    intro: [
      "Arcadia has some of the largest residential lots in the San Gabriel Valley, and large lots are what make a hibachi party easy: room for the grill, room for a long table, and room for twenty-five people without anyone standing in the driveway. It is one of the best backyard-party cities in LA County and one of the least served by mobile hibachi chefs.",
      "We cook throughout Arcadia, Santa Anita Oaks, Baldwin Stocker, and the neighboring SGV cities. Flat rate $59.90 per adult, $29.90 per child 5–12, and a flat $5 for kids under 5, $599 event minimum, setup and cleanup included.",
    ],
    neighborhoods: [
      "Santa Anita Oaks",
      "Baldwin Stocker",
      "Highland Oaks",
      "Upper Rancho",
      "Peacock Village",
      "Temple City",
      "San Marino",
      "Sierra Madre",
      "Monrovia",
      "Pasadena",
    ],
    occasions: [
      {
        title: "Multi-Generational Family Banquets",
        description:
          "Arcadia parties are often three generations at one long table. The chef cooks course by course so the food arrives hot for everyone at once.",
      },
      {
        title: "Lunar New Year Gatherings",
        description:
          "A reunion dinner at home without anyone spending two days in the kitchen or fighting for a banquet-hall reservation in February.",
      },
      {
        title: "Graduation Parties",
        description:
          "Arcadia High and neighboring school celebrations in May and June, when every SGV restaurant with a private room is already booked.",
      },
      {
        title: "Milestone Birthdays & Anniversaries",
        description:
          "Big-number birthdays and anniversaries where the show is the entertainment and the backyard is the venue.",
      },
    ],
    venues: [
      {
        title: "Large Estate Backyards",
        description:
          "Santa Anita Oaks and Upper Rancho lots with lawn, hardscape, and space for 30+ guests. Among the roomiest setups we do anywhere.",
      },
      {
        title: "Pool & Patio Homes",
        description:
          "Baldwin Stocker and Highland Oaks properties with pool decks and covered patios — the everyday Arcadia setup.",
      },
      {
        title: "Newer Rebuild Homes",
        description:
          "Recently rebuilt houses with wide hardscaped rear yards and clean access. Genuinely simple to work in.",
      },
    ],
    logistics: [
      "Arcadia is one of the easiest cities in LA County for us. Driveways are long, streets are wide, gates are usually vehicle-width, and load-in takes minutes. That is also why our Arcadia guest counts run higher than our coastal ones — a 30-person party that would be impossible in Santa Monica is comfortable here.",
      "Two local specifics. First, mature oaks are protected in Arcadia and common in the older neighborhoods, and low branches over the intended grill spot are the usual reason we shift a setup a few feet — send a photo when you book and we will pick the position in advance. Second, SGV summers run hot and still, so evening starts from June through September make a real difference for guests seated near the grill. We need about a 6x8 ft flat area and roughly 10 ft of overhead clearance, set on hardscape rather than soft lawn.",
    ],
    faqs: [
      {
        question: "Can you handle a large family party of 25 or 30 people?",
        answer:
          "Yes, and Arcadia is one of the best cities for it — the lots are big enough. Larger parties may use a second chef or a longer service window; tell us your guest count when you book and we will scope it properly.",
      },
      {
        question: "Do you cook for Lunar New Year and other holiday gatherings?",
        answer:
          "Yes, and those dates book out early — late January and February weekends fill first. A $19.90 deposit locks your date and is fully refundable with 72+ hours notice.",
      },
      {
        question: "Do you serve the rest of the San Gabriel Valley?",
        answer:
          "Yes — Temple City, San Marino, Monrovia, Sierra Madre, San Gabriel, Alhambra, Rosemead, and the neighboring SGV cities are all regular service areas, along with Pasadena.",
      },
      {
        question: "What does hibachi at home cost in Arcadia?",
        answer:
          "$59.90 per adult, $29.90 per child 5–12, and a flat $5 for kids under 5, $599 event minimum — chef, grill, 2 proteins per guest, garlic fried rice, vegetables, salad, the live show, setup, and cleanup included. Weekday Special pricing ($45.90/adult, Mon-Thu, 15+ guests) is available.",
      },
    ],
    nearby: ["pasadena", "san-gabriel", "glendale"],
  },
  {
    slug: "san-gabriel",
    city: "San Gabriel",
    county: "Los Angeles County",
    metaTitle: "Hibachi at Home San Gabriel CA | Private Hibachi Chef",
    metaDescription:
      "Private hibachi chef in San Gabriel and the SGV — family banquets, red egg parties, and backyard celebrations. $59.90/adult flat rate, setup & cleanup included.",
    intro: [
      "San Gabriel is one of the best food cities in America, which makes it a demanding place to cook — and a great one. The hibachi pitch here is not novelty; it is that a chef cooking teppanyaki in your own backyard means the whole family eats together, hot, at the same time, and nobody hosts from the kitchen all night.",
      "We cook throughout San Gabriel, Alhambra, Rosemead, Monterey Park, and the surrounding SGV. Flat rate $59.90 per adult, $29.90 per child 5–12, and a flat $5 for kids under 5, $599 event minimum, setup and cleanup included.",
    ],
    neighborhoods: [
      "Mission District",
      "Las Tunas",
      "Alhambra",
      "Rosemead",
      "Monterey Park",
      "Temple City",
      "San Marino",
      "Arcadia",
      "El Monte",
      "Montebello",
    ],
    occasions: [
      {
        title: "Family Banquets at Home",
        description:
          "The dinner that would otherwise be a restaurant banquet room, held in the backyard with better seating and no time limit.",
      },
      {
        title: "Red Egg & Full-Moon Parties",
        description:
          "One-month baby celebrations where the extended family comes and the hosts should not be cooking for any of it.",
      },
      {
        title: "Lunar New Year Reunions",
        description:
          "Reunion dinners in late January and February — the busiest booking window of our SGV year, and the one to reserve earliest.",
      },
      {
        title: "Graduation Celebrations",
        description:
          "May and June parties for families whose kids are heading to college, with relatives flying in for the weekend.",
      },
    ],
    venues: [
      {
        title: "Classic SGV Backyards",
        description:
          "Post-war lots with concrete patios, a fruit tree or two, and room for a long folding table. The most common setup here.",
      },
      {
        title: "Rebuilt Two-Story Homes",
        description:
          "Newer rebuilds with wide hardscaped rear yards and side-gate access. Simple, fast setups.",
      },
      {
        title: "Multi-Family & Duplex Yards",
        description:
          "Shared rear yards where we keep the footprint tight and the setup out of the walkway.",
      },
    ],
    logistics: [
      "San Gabriel's streets are narrower than Arcadia's and driveways are shorter, so parking is the one thing worth arranging. A driveway space held for the chef, or a note about the closest place to pull in, keeps load-in to a few minutes. Side-gate access is common here and usually fine — just tell us if the gate is under about three feet wide so the chef brings the right cart.",
      "Older SGV lots often have mature fruit trees and low patio covers over the natural grill spot, which is the usual reason we shift the setup. We need roughly a 6x8 ft flat area and about 10 ft of overhead clearance, on concrete or pavers rather than soft ground. Summer here is hot and still, so evening starts from June through September are noticeably more comfortable for guests seated near the grill, and Lunar New Year weekends book out first among all our SGV dates.",
    ],
    faqs: [
      {
        question: "Do you serve Alhambra, Rosemead, and Monterey Park?",
        answer:
          "Yes — Alhambra, Rosemead, Monterey Park, Temple City, El Monte, San Marino, and Arcadia are all regular service areas, along with the rest of the San Gabriel Valley.",
      },
      {
        question: "Can you cook for a big extended-family party?",
        answer:
          "Yes. We add a second chef past 28 guests — give us the number when you book and we will scope it. Kids 5-12 are $29.90 and kids under 5 are a flat $5, which matters at a family party.",
      },
      {
        question: "Our backyard is small and paved. Is that a problem?",
        answer:
          "Not at all — paved is better than lawn. We need roughly a 6x8 ft flat area for the grill and about 10 ft of overhead clearance, plus your table and seating. Most SGV patios have it. Send a photo and we will confirm before your date.",
      },
      {
        question: "What does hibachi at home cost in San Gabriel?",
        answer:
          "$59.90 per adult, $29.90 per child 5–12, and a flat $5 for kids under 5, $599 event minimum — chef, grill, food, live show, setup, and cleanup included, with no per-guest setup surcharge.",
      },
    ],
    nearby: ["arcadia", "pasadena", "rowland-heights"],
  },
  {
    slug: "rowland-heights",
    city: "Rowland Heights",
    county: "Los Angeles County",
    metaTitle: "Hibachi at Home Rowland Heights CA | Private Hibachi Chef",
    metaDescription:
      "Private hibachi chef in Rowland Heights — hillside backyards, family gatherings, and holiday banquets. $59.90/adult flat rate, setup & cleanup included.",
    intro: [
      "Rowland Heights sits on the hill side of the San Gabriel Valley, which means bigger lots, sloped yards, and views — and a lot of homes with the kind of wide rear patio a teppanyaki grill was made for. It is a strong hibachi city that almost nobody in this business serves properly.",
      "We cook throughout Rowland Heights, Hacienda Heights, Walnut, Diamond Bar, and the eastern SGV. Flat rate $59.90 per adult, $29.90 per child 5–12, and a flat $5 for kids under 5, $599 event minimum, setup and cleanup included.",
    ],
    neighborhoods: [
      "Hacienda Heights",
      "Walnut",
      "Diamond Bar",
      "West Covina",
      "La Puente",
      "Industry",
      "Brea",
      "Chino Hills",
      "Whittier",
      "Pomona",
    ],
    occasions: [
      {
        title: "Holiday Family Dinners",
        description:
          "Lunar New Year, Mid-Autumn, Thanksgiving — the gatherings where the host would otherwise cook for two days straight.",
      },
      {
        title: "Backyard Birthdays",
        description:
          "Hillside patios with a view and a table for twenty. The everyday Rowland Heights booking.",
      },
      {
        title: "Graduation Parties",
        description:
          "May and June celebrations for families across the eastern SGV, usually with relatives in town for the weekend.",
      },
      {
        title: "Housewarmings & Reunions",
        description:
          "New homes and extended-family get-togethers where the show gives everyone something to do besides stand around.",
      },
    ],
    venues: [
      {
        title: "Hillside Rear Patios",
        description:
          "Sloped lots with a wide hardscaped patio behind the house and a view past it. The signature Rowland Heights setup.",
      },
      {
        title: "Pool Decks",
        description:
          "Eastern SGV pools get used from spring through fall. The grill goes on the deck well clear of the water.",
      },
      {
        title: "Large Tract Backyards",
        description:
          "Walnut and Hacienda Heights lots with room for a long table and 25+ guests, and a driveway to park in.",
      },
    ],
    logistics: [
      "Hillside streets are the local specific. Many Rowland Heights homes sit above or below the road with a flight of steps to the entry, and the rear patio is often another level down. That is a normal setup for us, but it needs mentioning at booking so the chef brings the cart and we allow a little extra arrival time. Driveways are generally long enough to park in, which makes the rest of load-in easy.",
      "Inland summer heat runs hotter here than in the coastal SGV, so evening starts from June through September are the norm and make a real difference for guests near the grill. Lots that back onto open hillside catch an afternoon breeze that an exposed grill will fight, so we set against a wall or fence where we can, and during red-flag fire conditions we keep the setup on hardscape clear of dry brush. We need about a 6x8 ft flat area and roughly 10 ft of overhead clearance.",
    ],
    faqs: [
      {
        question: "Our patio is down a flight of steps from the driveway. Is that OK?",
        answer:
          "Yes — that is a normal Rowland Heights setup. Tell us when you book so the chef brings the right cart and we schedule enough arrival time. Steps have never been the reason a party did not happen.",
      },
      {
        question: "Do you serve Hacienda Heights, Walnut, and Diamond Bar?",
        answer:
          "Yes — Hacienda Heights, Walnut, Diamond Bar, West Covina, La Puente, and the surrounding eastern SGV cities are all regular service areas.",
      },
      {
        question: "When should we book for a holiday gathering?",
        answer:
          "Earlier than you think. Lunar New Year weekends and the weeks around Thanksgiving and Christmas are our busiest SGV dates and fill first. A $19.90 deposit locks your date, fully refundable with 72+ hours notice.",
      },
      {
        question: "What does hibachi at home cost in Rowland Heights?",
        answer:
          "$59.90 per adult, $29.90 per child 5–12, and a flat $5 for kids under 5, $599 event minimum — chef, grill, 2 proteins per guest, fried rice, vegetables, salad, show, setup, and cleanup included.",
      },
    ],
    nearby: ["diamond-bar", "san-gabriel", "corona"],
  },
  {
    slug: "diamond-bar",
    city: "Diamond Bar",
    county: "Los Angeles County",
    metaTitle: "Hibachi at Home Diamond Bar CA | Private Hibachi Chef",
    metaDescription:
      "Private hibachi chef in Diamond Bar — hillside yards, pool decks, and family celebrations. $59.90/adult flat rate, setup & cleanup included.",
    intro: [
      "Diamond Bar is hillside suburbia at its most hibachi-friendly: big lots, wide patios, pools, and quiet streets where an outdoor dinner party runs late without anyone minding. It sits at the corner of three counties and gets served properly by almost no one in this business.",
      "We cook throughout Diamond Bar, Walnut, Chino Hills, Rowland Heights, and the surrounding area. Flat rate $59.90 per adult, $29.90 per child 5–12, and a flat $5 for kids under 5, $599 event minimum, setup and cleanup included.",
    ],
    neighborhoods: [
      "The Country Estates",
      "Diamond Ridge",
      "Walnut",
      "Chino Hills",
      "Rowland Heights",
      "Phillips Ranch",
      "Pomona",
      "Brea",
      "Industry",
      "Hacienda Heights",
    ],
    occasions: [
      {
        title: "Pool Party Birthdays",
        description:
          "Swim through the afternoon, hibachi at sunset, same address. The most common Diamond Bar booking from May through October.",
      },
      {
        title: "Extended Family Gatherings",
        description:
          "Big tables, three generations, and a host who gets to actually sit down for once.",
      },
      {
        title: "Graduation Season",
        description:
          "Diamond Bar High and Walnut families hosting at home in May and June, usually with relatives in from out of state.",
      },
      {
        title: "Holiday Dinners",
        description:
          "Lunar New Year, Thanksgiving, and Christmas gatherings where the kitchen would otherwise be a two-day project.",
      },
    ],
    venues: [
      {
        title: "Country Estates Properties",
        description:
          "Gated hillside homes with large terraces and views. Gate access for the chef is the one thing to arrange ahead.",
      },
      {
        title: "Pool & Patio Backyards",
        description:
          "Wide hardscaped decks with the grill well clear of the water. The everyday Diamond Bar setup.",
      },
      {
        title: "Tract Homes with Deep Yards",
        description:
          "Room for a long table and 25+ guests, with a driveway to park in and short load-in.",
      },
    ],
    logistics: [
      "If you are in The Country Estates or another gated community, send the gate code or add the chef to the guard list when you confirm — otherwise the chef waits at the kiosk while your party waits inside. Everywhere else in Diamond Bar, driveways are long and load-in is quick.",
      "Heat and wind are the scheduling factors. Inland summer afternoons are genuinely hot next to a teppanyaki grill, so we usually suggest a sunset start in July and August. Outside the hot months — roughly October through May — midday is a genuinely good time out here, and lunch bookings on a shaded patio are easier to schedule than summer evening slots. Hillside lots that back onto open space catch a real afternoon breeze, so we set the grill against a wall or fence where possible, and during red-flag fire conditions we keep everything on hardscape well clear of brush. We need about a 6x8 ft flat area and roughly 10 ft of overhead clearance.",
    ],
    faqs: [
      {
        question: "We live in a gated community. What do you need?",
        answer:
          "A gate code, or the chef added to the guard list under the booking name. Send it when you confirm and the chef drives straight in. Without it, entry can take fifteen minutes off your start time.",
      },
      {
        question: "Can you set up next to the pool?",
        answer:
          "Yes — pool decks are our most common Diamond Bar setup. We place the grill on level hardscape with clearance from the water, railings, and anything overhanging, and the chef manages the flame throughout.",
      },
      {
        question: "Do you serve Chino Hills and Walnut?",
        answer:
          "Yes — Chino Hills, Walnut, Rowland Heights, Phillips Ranch, Pomona, and Brea are all regular service areas.",
      },
      {
        question: "What does hibachi at home cost in Diamond Bar?",
        answer:
          "$59.90 per adult, $29.90 per child 5–12, and a flat $5 for kids under 5, $599 event minimum — chef, grill, food, live show, setup, and cleanup included. Weekday Special pricing ($45.90/adult, Mon-Thu, 15+ guests) applies here too.",
      },
    ],
    nearby: ["rowland-heights", "corona", "san-gabriel"],
  },
  {
    slug: "inglewood",
    city: "Inglewood",
    county: "Los Angeles County",
    metaTitle: "Hibachi at Home Inglewood CA | Private Hibachi Chef",
    metaDescription:
      "Private hibachi chef in Inglewood — backyard parties, game-day gatherings near SoFi, and family celebrations. $59.90/adult flat rate, setup & cleanup included.",
    intro: [
      "Inglewood backyards are flat, fenced, and a good size — which is most of what a hibachi party needs. Add a game or a concert at SoFi and the Forum a few minutes away, and hosting at home stops being the fallback and starts being the obviously better plan.",
      "We cook throughout Inglewood, Westchester, Hawthorne, Lennox, and the surrounding South Bay and Westside. Flat rate $59.90 per adult, $29.90 per child 5–12, and a flat $5 for kids under 5, $599 event minimum, setup and cleanup included.",
    ],
    neighborhoods: [
      "Morningside Park",
      "Fairview Heights",
      "Centinela",
      "Lockhaven",
      "Westchester",
      "Hawthorne",
      "Lennox",
      "Ladera Heights",
      "El Segundo",
      "Playa del Rey",
    ],
    occasions: [
      {
        title: "Game Day & Concert Nights",
        description:
          "SoFi and Intuit Dome nights when the whole area is gridlocked. Eat at home first, walk or ride over, skip the restaurant entirely.",
      },
      {
        title: "Backyard Birthdays",
        description:
          "Flat lots with real yards and room for twenty — the everyday Inglewood booking, and our most requested.",
      },
      {
        title: "Family Reunions",
        description:
          "Big tables and long afternoons where the chef handles dinner so the host can actually be at the party.",
      },
      {
        title: "Graduation Celebrations",
        description:
          "May and June gatherings for families across the South Bay, hosted at home while restaurants are booked out.",
      },
    ],
    venues: [
      {
        title: "Flat Backyards",
        description:
          "Morningside Park and Lockhaven lots with lawn, fence, and driveway. Straightforward, fast setups.",
      },
      {
        title: "Front Driveways & Side Yards",
        description:
          "Where the rear yard is small, a gated driveway works well — we set up out of the walkway and keep the footprint tight.",
      },
      {
        title: "Ladera Heights Hillside Homes",
        description:
          "Stepped yards and view decks with a few stairs from the street. Easy once we know they are there.",
      },
    ],
    logistics: [
      "Event days are the one thing to plan around in Inglewood. When SoFi, the Forum, or the Intuit Dome has something on, surrounding streets get closed, restricted, or filled by mid-afternoon, and getting a vehicle with a grill and coolers to your door becomes the hard part. Tell us if your date coincides with an event and we will set an earlier arrival window — it works fine, it just cannot be improvised on the day.",
      "The rest is simple: most Inglewood homes have a driveway, streets are flat, and load-in is short. Marine-layer evenings come in cool and a little damp near the coast side, so an earlier start or a patio heater keeps guests comfortable. We need roughly a 6x8 ft flat area and about 10 ft of overhead clearance, set on hardscape rather than soft lawn.",
    ],
    story: {
      heading: "The smallest backyard I ever cooked in was here",
      body: [
        "The space was tiny. I could barely turn around at the grill. By every measure I use to judge a venue — room, access, a flat spot for the station — it was a hard setup.",
        "It was a grandmother's birthday.",
        "I have cooked in big houses and small ones, and that night made something clear to me that I had only half understood before: whether you are rich or not, everybody gets the same amount of time, and time with your family is worth the same to all of us. Every hour you actually spend together is worth celebrating, even when the conditions are not generous.",
        "A big backyard does not give you a good party. It just gives you room. So if you have been holding off because your Inglewood yard feels too small — I have cooked in smaller.",
      ],
      readMore: { label: "Read the full story", href: "/blog/will-hibachi-work-in-my-space" },
    },
    faqs: [
      {
        question: "Can you still come if there is an event at SoFi that day?",
        answer:
          "Yes — we just schedule the chef's arrival earlier to get ahead of the street closures and traffic. Tell us the event when you book so we build the right window into your booking.",
      },
      {
        question: "Our backyard is small. Can you set up in the driveway?",
        answer:
          "Yes, a gated or private driveway works well and it is a common Inglewood setup. We need roughly a 6x8 ft flat area, about 10 ft of overhead clearance, and enough room to keep the station out of the walkway.",
      },
      {
        question: "Do you serve Westchester, Hawthorne, and El Segundo?",
        answer:
          "Yes — Westchester, Hawthorne, Lennox, Ladera Heights, El Segundo, and Playa del Rey are all regular service areas, along with the rest of the South Bay.",
      },
      {
        question: "What does hibachi at home cost in Inglewood?",
        answer:
          "$59.90 per adult, $29.90 per child 5–12, and a flat $5 for kids under 5, $599 event minimum — chef, grill, 2 proteins per guest, fried rice, vegetables, salad, show, setup, and cleanup included, with no per-guest setup surcharge.",
      },
    ],
    nearby: ["culver-city", "torrance", "los-angeles"],
  },
  {
    slug: "malibu",
    city: "Malibu",
    county: "Los Angeles County",
    metaTitle: "Hibachi at Home Malibu CA | Private Hibachi Chef",
    metaDescription:
      "Private hibachi chef in Malibu — oceanfront decks, canyon homes, and vacation rentals. $59.90/adult flat rate, setup & cleanup included.",
    intro: [
      "A teppanyaki grill on a Malibu deck at sunset is close to the best version of this that exists. The ocean does the scenery, the chef does the show, and nobody has to drive PCH twice in one evening to get dinner.",
      "We cook along the Malibu coast and up into the canyons, from Las Flores to Point Dume and Trancas. Flat rate $59.90 per adult, $29.90 per child 5–12, and a flat $5 for kids under 5, $599 event minimum, setup and cleanup included, with any travel fee disclosed upfront.",
    ],
    neighborhoods: [
      "Point Dume",
      "Malibu Colony",
      "Carbon Beach",
      "Broad Beach",
      "Trancas",
      "Las Flores",
      "Malibu Park",
      "Serra Retreat",
      "Topanga",
      "Pacific Palisades",
    ],
    occasions: [
      {
        title: "Sunset Deck Dinners",
        description:
          "The reason people book Malibu. Golden hour, the grill on the deck, and the show finishing as the light goes.",
      },
      {
        title: "Vacation Rental Weekends",
        description:
          "Groups renting a beach house who want one real dinner without anyone driving PCH after dark.",
      },
      {
        title: "Milestone Birthdays",
        description:
          "Big-number celebrations where the venue is already perfect and the catering just needs to match it.",
      },
      {
        title: "Wedding Weekend Dinners",
        description:
          "Rehearsal and day-after dinners at a rented property, cooked on site so the group stays together.",
      },
    ],
    venues: [
      {
        title: "Oceanfront Decks",
        description:
          "Carbon Beach and Broad Beach decks right over the sand. Beautiful, breezy, and the tightest access we work with.",
      },
      {
        title: "Point Dume & Bluff Properties",
        description:
          "Larger lots with terraces and real space — the easiest Malibu setups and good for bigger guest counts.",
      },
      {
        title: "Canyon Homes",
        description:
          "Serra Retreat and Topanga-adjacent properties with decks tucked into the hillside. Narrow access, worth flagging at booking.",
      },
    ],
    logistics: [
      "Malibu is a real drive from our base and PCH decides how long it takes, so a travel fee usually applies here — calculated from your address and shown upfront in your quote rather than added later. We also build extra buffer into Malibu arrivals: summer weekend traffic on PCH is unpredictable enough that the chef leaves early by default rather than cutting it fine.",
      "Access is the other Malibu specific. Beachfront homes on Carbon and Broad Beach often mean a narrow gate, a stairway down to the deck, and no room to park anywhere near the door — all workable, all things we need to know at booking. Send a gate code if you have one. Ocean wind picks up in the afternoon and an exposed deck grill will fight it, so we set against a wall or windbreak where possible. We need roughly a 6x8 ft flat area, about 10 ft of overhead clearance, and during red-flag fire conditions in the canyons we keep everything on hardscape clear of brush.",
    ],
    faqs: [
      {
        question: "Is there a travel fee to Malibu?",
        answer:
          "Usually yes. Our first 50 miles are free and most of Malibu sits past that, so expect a fee — $1 for each mile beyond the free 50, which for a typical Malibu address is a modest number rather than a flat surcharge. It is calculated from your address and shown upfront in your instant quote before you pay anything, never added after the fact.",
      },
      {
        question: "Can you cook on an oceanfront deck?",
        answer:
          "Yes, and it is our favorite Malibu setup. We need a stable level surface with clearance from railings and anything overhanging, and we position with the afternoon wind in mind. Tell us about stairs or a narrow gate at booking so the chef packs accordingly.",
      },
      {
        question: "Can you cook at a Malibu vacation rental?",
        answer:
          "Yes, and rentals are a large share of our Malibu bookings — just check the listing for open-flame cooking and evening event rules before you book us. An early-evening start typically wraps well inside quiet hours.",
      },
      {
        question: "What does hibachi at home cost in Malibu?",
        answer:
          "$59.90 per adult, $29.90 per child 5–12, and a flat $5 for kids under 5, $599 event minimum — chef, grill, 2 proteins per guest, fried rice, vegetables, salad, the live show, setup, and cleanup included, plus the disclosed travel fee.",
      },
    ],
    nearby: ["santa-monica", "culver-city", "woodland-hills"],
  },
  {
    slug: "woodland-hills",
    city: "Woodland Hills",
    county: "Los Angeles County",
    metaTitle: "Hibachi at Home Woodland Hills CA | Private Hibachi Chef",
    metaDescription:
      "Private hibachi chef in Woodland Hills and the West Valley — pool parties, big backyards, and family gatherings. $59.90/adult flat rate, setup & cleanup included.",
    intro: [
      "The West Valley has the biggest backyards and the most pools of anywhere in the city, and from spring through fall those yards get used constantly. Woodland Hills is one of our highest-volume areas for exactly that reason — the setup is easy, the space is real, and the party stays outside all evening.",
      "We cook across Woodland Hills, Warner Center, Tarzana, Encino, Calabasas, and the West Valley. Flat rate $59.90 per adult, $29.90 per child 5–12, and a flat $5 for kids under 5, $599 event minimum, setup and cleanup included.",
    ],
    neighborhoods: [
      "Warner Center",
      "Walnut Acres",
      "Tarzana",
      "Encino",
      "Calabasas",
      "West Hills",
      "Canoga Park",
      "Winnetka",
      "Sherman Oaks",
      "Chatsworth",
    ],
    occasions: [
      {
        title: "Pool Party Birthdays",
        description:
          "The definitive West Valley booking. Swim all afternoon, hibachi at sunset, nobody gets in a car.",
      },
      {
        title: "Graduation Season",
        description:
          "El Camino, Taft, and Calabasas High families hosting at home in May and June — our busiest Valley weeks of the year.",
      },
      {
        title: "Big Family Gatherings",
        description:
          "Yards out here hold 30 people comfortably, which makes reunions and holiday dinners easy to host at home.",
      },
      {
        title: "Neighborhood & Block Parties",
        description:
          "Larger groups where one chef and a long table beat six people each bringing a dish.",
      },
    ],
    venues: [
      {
        title: "Pool Deck Setups",
        description:
          "Wide hardscaped decks with the grill well clear of the water. The most common West Valley configuration by far.",
      },
      {
        title: "Large Flat Backyards",
        description:
          "Walnut Acres and West Hills lots with room for a long table and 30 guests, plus a driveway to park in.",
      },
      {
        title: "Hillside Homes in Calabasas & Tarzana",
        description:
          "Terraced yards with views and a few stairs from the street. Straightforward once we know about them.",
      },
    ],
    logistics: [
      "Valley heat is the single biggest scheduling factor here, more than in any other LA city we serve. Woodland Hills regularly runs ten to fifteen degrees hotter than the Westside, and a July party starting at 4pm puts your guests next to a teppanyaki grill at the worst possible hour. A sunset start is what we recommend from June through September and the difference is dramatic. Daytime is a different story outside the hot months: from roughly October through May a lunch or early-afternoon party on a shaded patio works beautifully out here, and those slots book up far less than summer evenings. Shade over the guest seating matters more than shade over the chef.",
      "Everything else is easy. Driveways are long, streets are wide, and load-in is short, which is why our largest guest counts in LA proper happen out here. Hillside homes in Calabasas and Tarzana may add a few stairs — mention them at booking. During red-flag fire conditions, and especially on lots backing onto open hillside, we keep the setup on hardscape well clear of dry brush. We need about a 6x8 ft flat area and roughly 10 ft of overhead clearance.",
    ],
    faqs: [
      {
        question: "What time should we start a summer party in the Valley?",
        answer:
          "For June through September we suggest sunset or later — Woodland Hills runs much hotter than the coast in the afternoon. From roughly October through May, midday is genuinely lovely here and a lunch booking on a shaded patio is one of our favorite ways to do this. Tell us your date and preferred time and we will tell you honestly whether it works.",
      },
      {
        question: "Can you handle 30 guests?",
        answer:
          "Yes — West Valley yards are among the few in LA that comfortably hold that many, and it is a regular booking for us here. Larger parties may use a second chef or a longer service window; give us the count when you book.",
      },
      {
        question: "Do you serve Calabasas, Encino, and Tarzana?",
        answer:
          "Yes — Calabasas, Encino, Tarzana, West Hills, Canoga Park, Winnetka, Chatsworth, and Sherman Oaks are all regular service areas across the San Fernando Valley.",
      },
      {
        question: "What does hibachi at home cost in Woodland Hills?",
        answer:
          "$59.90 per adult, $29.90 per child 5–12, and a flat $5 for kids under 5, $599 event minimum — chef, grill, 2 proteins per guest, garlic fried rice, vegetables, salad, show, setup, and cleanup included. Weekday Special pricing ($45.90/adult, Mon-Thu, 15+ guests) applies here too.",
      },
    ],
    nearby: ["burbank", "santa-clarita", "malibu"],
  },
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
    venues: [
      {
        title: "East County Backyards",
        description:
          "El Cajon, Santee, and Poway lots are the biggest we cook on anywhere in SoCal — room for the grill, a long table, and 30 people without anyone standing in the driveway.",
      },
      {
        title: "Beach Rentals & Decks",
        description:
          "Pacific Beach and Mission Beach rentals put the grill on a deck with the ocean behind it. Sand is fine; we set up on the hard surface and keep the flame clear of railings.",
      },
      {
        title: "Coastal Canyon Homes",
        description:
          "La Jolla, Del Mar, and Carmel Valley homes with hillside patios — usually tight access and a lot of stairs, which is worth telling us about when you book.",
      },
    ],
    logistics: [
      "San Diego is the easiest weather city we serve and the hardest parking city outside LA proper. In Pacific Beach, Mission Beach, and downtown La Jolla the chef needs a spot within about a block to walk the grill and coolers in, so a driveway space or a held street spot saves fifteen minutes. Coronado and parts of La Jolla have permit-only blocks; if that is your street, tell us and we will plan around it.",
      "Vacation rentals are a large share of our San Diego bookings, so check the listing before you book us: some Mission Beach and Ocean Beach rentals prohibit open-flame cooking, and a few Carmel Valley and Del Mar HOAs require cooking on a hard surface away from the structure. We need roughly a 6x8 ft flat area and about 10 ft of overhead clearance. Beach-facing decks with low pergolas are the one setup we occasionally have to move.",
    ],
    faqs: [
      {
        question: "Do you serve all of San Diego County?",
        answer:
          "Yes — from Oceanside and Escondido down to Chula Vista and the border. The first 50 miles from our base are free; past that it is $1 for each mile beyond the free 50, disclosed upfront when you get your quote.",
      },
      {
        question: "Can you cook at our vacation rental in Mission Beach or Pacific Beach?",
        answer:
          "Absolutely — beach rentals are some of our most common San Diego bookings. We just need a permitted outdoor space like a patio, deck, or driveway. We can't set up on the public beach itself.",
      },
      {
        question: "What about June Gloom or marine layer?",
        answer:
          "The grill doesn't mind the marine layer, and neither do our chefs. If real rain threatens, a 10'x10' pop-up tent over the chef's station solves it — you provide the tent, we do not supply them. You can also seat guests indoors while the chef cooks outside, or reschedule with 72+ hours notice for a full deposit refund.",
      },
      {
        question: "How much does hibachi at home cost in San Diego?",
        answer:
          "$59.90 per adult, $29.90 per child 5–12, and a flat $5 for kids under 5, with a $599 event minimum. That includes the chef, grill, 2 proteins per guest, fried rice, vegetables, salad, the live show, setup, and cleanup.",
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
    venues: [
      {
        title: "HOA Community Patios",
        description:
          "Woodbridge, Northwood, and Turtle Rock homes where the patio is compact and the neighbors are close. We keep the footprint tight and stay quiet until showtime.",
      },
      {
        title: "Great Park Neighborhood Yards",
        description:
          "Newer builds in Portola Springs and Eastwood with clean hardscape — some of the easiest setups in Orange County.",
      },
      {
        title: "UCI-Area Rentals & Courtyards",
        description:
          "Graduation season means shared patios and courtyards. We can work in one if the property allows outdoor cooking — worth confirming with management first.",
      },
    ],
    logistics: [
      "Irvine is HOA country and we plan for it. Most associations here are fine with a propane teppanyaki grill on a private patio, but a handful of Village communities ask for notice or restrict cooking near shared walls. If your community has a rule, tell us and we will position the grill to satisfy it.",
      "Parking is straightforward in most Irvine neighborhoods and genuinely tight in Woodbridge and around UCI during graduation week; a guest spot or driveway space held for the chef makes load-in painless. We need about a 6x8 ft flat area and roughly 10 ft of overhead clearance. Solid patio covers usually work; low pergolas with lattice sometimes do not, and a photo sent ahead settles it in a minute.",
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
          "$59.90 per adult, $29.90 per child 5–12, and a flat $5 for kids under 5 with a $599 event minimum — chef, grill, food, show, setup, and cleanup included. Weekday Special pricing ($45.90/adult, Mon–Thu, 15+ guests) is also available in California.",
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
    venues: [
      {
        title: "Disneyland-Area Vacation Rentals",
        description:
          "Rentals within a few miles of the parks, usually a family group that has been walking all day and does not want to get back in the car.",
      },
      {
        title: "Anaheim Hills Backyards",
        description:
          "Bigger lots, hillside views, and room for a long table — our most common Anaheim setup for milestone birthdays and reunions.",
      },
      {
        title: "Platinum Triangle Podium Patios",
        description:
          "Apartment and condo decks near the stadium. Building approval for open-flame cooking is the only thing to check.",
      },
    ],
    logistics: [
      "Vacation-rental rules matter more in Anaheim than anywhere else we cook. Rentals near the parks turn over constantly and many carry explicit no-open-flame clauses; a two-line message to your host before booking us avoids the one problem that actually cancels these parties. Hosts who allow it usually just want the grill off the lawn and away from the structure, which is where we set up anyway.",
      "Park-adjacent streets fill up in the evening and some neighborhoods post overnight restrictions, so a driveway spot for the chef is worth holding. Timing is the other Anaheim-specific thing: families coming off a park day almost always want 7pm or later, and those slots go first on weekends and school holidays. We need about a 6x8 ft flat area, roughly 10 ft of overhead clearance, and a path from the curb that does not involve carrying the grill up more than a short flight of stairs.",
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
          "$59.90 per adult, $29.90 per child 5–12, and a flat $5 for kids under 5, $599 event minimum — including chef, grill, 2 proteins per guest, fried rice, vegetables, salad, show, setup, and cleanup.",
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
    venues: [
      {
        title: "Naples Canal Homes",
        description:
          "Narrow lots, water on one side, and a patio built for exactly this. Access is often a side gate or a walk over a bridge, so we stage from the street.",
      },
      {
        title: "Belmont Shore Patios",
        description:
          "Compact beach-block yards where the whole party is within ten feet of the grill — the show reads better up close than it does in a big yard.",
      },
      {
        title: "Bixby Knolls & Los Altos Backyards",
        description:
          "Mid-century lots with real grass and room to spread out. The classic Long Beach birthday setup.",
      },
    ],
    logistics: [
      "Belmont Shore and Naples parking is the biggest variable in a Long Beach booking. Second Street and the canal blocks are permit-heavy and full by early evening; if you can hold a driveway space or a spot on your block for the chef, do it. Naples in particular often means a walk over a bridge or down a walk-street, which is fine — just tell us at booking so the chef brings the cart.",
      "Coastal wind off the water is the other Long Beach factor. It rarely stops a party, but a grill placed in an exposed corner will fight it, so we look for a wall or fence to set against. Most Belmont Shore and Naples yards are small enough that the grill goes at one end and the table along the fence. The upside of the coastal air is that midday stays comfortable here most of the year, so lunch and afternoon bookings are a real option rather than a summer-only compromise. We need roughly a 6x8 ft flat area and about 10 ft of overhead clearance; low canal-side pergolas are worth photographing for us in advance.",
    ],
    story: {
      heading: "My very first at-home party was in Long Beach",
      body: [
        "I learned teppanyaki behind a fixed grill in a Benihana-style restaurant, where the room comes to you. In 2023 I took the same grill into a stranger's backyard for the first time, and it was here — ten people, a bachelorette party.",
        "It went well in a way I had not earned yet. The group was warm, they helped without being asked, they laughed at the right moments, and at the end we all took a photo together.",
        "That was three years and more than three hundred parties ago, and I still think about it, because it taught me the thing it took me another two years to be able to say out loud: the food is my job, but the party is theirs.",
      ],
      readMore: { label: "Read the full story", href: "/blog/three-states-one-grill" },
    },
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
          "$59.90 per adult, $29.90 per child 5–12, and a flat $5 for kids under 5, with a $599 event minimum — covering chef, grill, food, live show, setup, and cleanup.",
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
    venues: [
      {
        title: "Craftsman Backyards",
        description:
          "Bungalow Heaven and Madison Heights yards with mature oaks and deep porches. Beautiful, and the reason we always ask about overhead clearance here.",
      },
      {
        title: "San Marino & Linda Vista Estates",
        description:
          "Large lots with lawn and hardscape both — usually the easiest setups in the San Gabriel Valley, and room for 30+ guests.",
      },
      {
        title: "Rose Bowl-Adjacent Homes",
        description:
          "Game-day parties in Linda Vista and Annandale where the whole block is hosting and street parking disappears by noon.",
      },
    ],
    logistics: [
      "Pasadena's tree canopy is the thing we plan around. Bungalow Heaven and Madison Heights yards have gorgeous mature oaks and pepper trees, and low branches over the intended grill spot are the most common reason we shift a setup a few feet. Send a photo of your yard when you book and we will pick the position before the chef arrives instead of on the day.",
      "Street parking is easy most of the year and impossible on Rose Bowl event days — if your party lands on a game or flea-market Sunday, hold a driveway space for the chef. Several Pasadena and South Pasadena blocks are permit-only after 6pm; a guest permit or a driveway spot handles it. We need about a 6x8 ft flat area and roughly 10 ft of overhead clearance. Solid-roof patio covers are generally fine; a pergola with a low crossbeam usually is not.",
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
          "Yes, with advance notice — vegetarian, vegan and gluten-free guests are served at the same per-person rate. Two things to know. Our standard soy sauce is not gluten free, so a coeliac or gluten-free guest should have their own gluten-free soy and teriyaki on hand and we will cook their portion with it. And we cannot promise a nut- or sesame-free table: our sauces and the gyoza are commercial products, some carry allergen advisories, and both sauces contain egg. Tell us the allergy when you book and we will check the labels in use for your date and tell you straight whether we can serve that guest safely.",
      },
      {
        question: "What does hibachi at home cost in Pasadena?",
        answer:
          "$59.90 per adult, $29.90 per child 5–12, and a flat $5 for kids under 5, $599 event minimum — chef, grill, food, show, setup, and cleanup all included.",
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
    venues: [
      {
        title: "Rooftop & Building Decks",
        description:
          "Ocean Avenue and Wilshire-corridor buildings with shared roof decks. Approval for open-flame cooking is the one thing to confirm early.",
      },
      {
        title: "North of Montana Backyards",
        description:
          "Hedged yards with real privacy and room for a long table — our most common Santa Monica setup for dinner parties.",
      },
      {
        title: "Ocean Park & Sunset Park Patios",
        description:
          "Smaller lots, closer neighbors, and usually a sunset start time. We keep setup quiet and compact.",
      },
    ],
    logistics: [
      "Santa Monica parking is the hardest of any city we serve. Nearly everything north of Pico is permit-only, meters run late, and the chef arrives with a grill and coolers that need to be within about a block of your door. A guest permit, a driveway space, or a garage spot held for the chef is the single most useful thing you can arrange — without one, load-in can add twenty minutes to your start time.",
      "Rooftop and building-deck parties need property sign-off, and Santa Monica buildings are stricter than most: some allow propane on a roof deck, some do not, and the answer usually comes from the HOA or property manager rather than the front desk, so ask early. For yards we need roughly a 6x8 ft flat area and about 10 ft of overhead clearance. The marine layer means evenings cool off fast, so a heater or a slightly earlier start makes dinner more comfortable than it sounds. It also keeps midday pleasant here for most of the year — lunch and early-afternoon bookings work in Santa Monica when they would be unbearable inland, and those slots are much easier to get than weekend evenings.",
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
          "$59.90 per adult, $29.90 per child 5–12, and a flat $5 for kids under 5, with a $599 event minimum — chef, grill, food, live show, setup, and cleanup included.",
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
    venues: [
      {
        title: "Downtown Beach Blocks",
        description:
          "Walk-to-the-pier homes with compact yards and a lot of foot traffic outside. We stage from the driveway and set up out of the walkway.",
      },
      {
        title: "Huntington Harbour Decks",
        description:
          "Waterfront lots where the grill goes on the deck and the boat is right there. Wind is the only planning factor.",
      },
      {
        title: "Fire-Pit Backyards",
        description:
          "Inland tract homes with fire pits and big patios — the classic Surf City birthday and graduation setup.",
      },
    ],
    logistics: [
      "Onshore wind is the real Huntington Beach variable and it picks up in the late afternoon almost every day. It does not stop the show, but a grill set in an open corner with nothing to block it runs harder and cooks slower, so we look for a wall, fence, or the lee side of the house. If your only usable space is fully exposed, tell us and the chef brings extra wind shielding.",
      "Because the ocean keeps midday temperatures reasonable here nearly year-round, lunch and afternoon bookings are a genuine option in Huntington Beach rather than a seasonal one. Downtown blocks near the pier are metered and busy through the evening, and summer weekends make a driveway space genuinely valuable for load-in. Harbour homes are usually easy to park at but often mean a walk down a side yard or a dock ramp — worth mentioning at booking. We need roughly a 6x8 ft flat area, about 10 ft of overhead clearance, and enough distance from a fire pit that the two flames are not competing.",
    ],
    faqs: [
      {
        question: "Does the marine layer or beach wind affect the show?",
        answer:
          "No — our chefs cook beachside all year and bring windscreens for exposed patios. If real rain threatens, a 10'x10' pop-up tent over the chef's station keeps things going; you provide the tent, we do not supply them.",
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
          "$59.90 per adult, $29.90 per child 5–12, and a flat $5 for kids under 5, $599 event minimum — chef, grill, food, show, setup, and cleanup included.",
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
    venues: [
      {
        title: "Big Inland Backyards",
        description:
          "Orangecrest, Woodcrest, and Canyon Crest lots with room for 40 people and a table you do not have to fold up. Our largest parties happen out here.",
      },
      {
        title: "Historic Wood Streets Homes",
        description:
          "Older lots with deep yards and mature trees near downtown — charming, with the same overhead-clearance question as Pasadena.",
      },
      {
        title: "Pool & Patio Setups",
        description:
          "Inland Empire pools get used from April to October. The grill goes on the deck well clear of the water and the party stays outside all night.",
      },
    ],
    logistics: [
      "Riverside is the easiest logistics city we serve: driveways are long, streets are wide, and load-in is usually fifty feet from where the chef parks. That is why our biggest guest counts happen here — a 30 or 40-person party that would be impossible in Santa Monica is routine in Orangecrest.",
      "Heat is the planning factor instead. From June through September an afternoon start is genuinely uncomfortable for guests standing near a teppanyaki grill, and the parties that go best start at or after sunset. Shade over the guest seating matters more than shade over the chef. We need about a 6x8 ft flat area and roughly 10 ft of overhead clearance; for pool decks we keep the grill on the far side from the water and clear of anything overhanging.",
    ],
    faqs: [
      {
        question: "Is there a travel fee to Riverside?",
        answer:
          "Most Riverside addresses fall inside our free 50-mile radius, so usually there is no travel fee at all. Past 50 miles it is $1 for each mile beyond the free 50, shown upfront in your quote before you pay anything.",
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
          "$59.90 per adult, $29.90 per child 5–12, and a flat $5 for kids under 5, $599 event minimum — everything included. Weekday Special ($45.90/adult, Mon–Thu, 15+ guests) applies in California too.",
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
    venues: [
      {
        title: "Wine Country Estates",
        description:
          "De Portola and Rancho California properties with long driveways, vineyard views, and room for a table of thirty. The grill goes on the terrace at golden hour.",
      },
      {
        title: "Vacation Rentals & Ranch Houses",
        description:
          "Wedding-weekend and bachelorette groups renting a whole property. One dinner, everyone stays put, nobody drives the wine roads at night.",
      },
      {
        title: "Tract-Home Backyards",
        description:
          "Redhawk, Harveston, and Vail Ranch yards with pools and covered patios — the everyday Temecula birthday setup.",
      },
    ],
    logistics: [
      "Temecula is a long drive from our SoCal base, so a travel fee usually applies here and it is calculated from your address and shown upfront in your quote rather than added afterward. It also means we schedule Temecula parties with more buffer: the chef leaves early and arrives with time to spare rather than cutting it fine on the 15.",
      "Wine country properties are easy to set up on and occasionally hard to find — gated entries, unnamed driveways, and spotty cell service are all normal out here, so a gate code and a note about where to pull in saves the chef circling. Evening temperature swings are real: a 95-degree afternoon can drop into the 60s by 9pm, which is pleasant for the party but worth knowing when you plan seating. We need about a 6x8 ft flat area and roughly 10 ft of overhead clearance.",
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
          "Please do — you supply the bottles from your tasting haul, we supply the chef and the full teppanyaki show.",
      },
      {
        question: "What does hibachi at home cost in Temecula?",
        answer:
          "$59.90 per adult, $29.90 per child 5–12, and a flat $5 for kids under 5, with a $599 event minimum — chef, grill, food, live show, setup, and cleanup included.",
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
    venues: [
      {
        title: "Valencia & Stevenson Ranch Backyards",
        description:
          "Newer tract homes with hardscaped patios, pools, and good access — among the smoothest setups anywhere in LA County.",
      },
      {
        title: "Canyon Country Lots",
        description:
          "Bigger, more rural properties with room to spread out. Some have gravel or slope, so we pick the flat spot together.",
      },
      {
        title: "Community Clubhouses & Parks",
        description:
          "Valencia HOA clubhouse patios for larger parties. These need the association's OK for outdoor cooking, which is usually a form rather than a fight.",
      },
    ],
    logistics: [
      "Santa Clarita's HOAs are more organized than most, which is actually good news: if your community requires clubhouse booking or written notice for a cooking event, there is a clear process and it is usually a one-page form. Get it in a week or two ahead and the day itself is easy. Private backyard parties in Valencia and Stevenson Ranch rarely need anything at all.",
      "Summer heat here runs hotter than the coast and the wind through the pass can gust in the late afternoon, so evening starts are the norm from June to September. Fire-season awareness matters too: during red-flag conditions we keep the grill on hardscape well clear of dry brush, and if your lot backs onto open hillside we will position accordingly. We need about a 6x8 ft flat area and roughly 10 ft of overhead clearance.",
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
          "$59.90 per adult, $29.90 per child 5–12, and a flat $5 for kids under 5, $599 event minimum — chef, grill, food, show, setup, and cleanup included.",
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
    venues: [
      {
        title: "South Torrance Backyards",
        description:
          "Hollywood Riviera and Southwood lots with mature yards and easy driveway access — our most common Torrance setup.",
      },
      {
        title: "Old Torrance Bungalows",
        description:
          "Smaller downtown-adjacent lots where the party is close-in and the show is right on top of the table.",
      },
      {
        title: "Condo & Townhome Patios",
        description:
          "West Torrance complexes with private patios. Association rules on open flame vary, so it is worth a quick check.",
      },
    ],
    logistics: [
      "Torrance is one of the more forgiving South Bay cities for load-in: most homes have real driveways and the streets are wide enough that the chef parks close. Hollywood Riviera is the exception, where hillside blocks get narrow and a held driveway space genuinely helps.",
      "The South Bay marine layer means evenings cool down quickly and can come in damp, which affects your guests more than the cooking. An earlier start or a patio heater handles it — and the same marine layer keeps midday mild most of the year, so lunch and early-afternoon parties work well in Torrance and are easier to schedule than weekend evenings. Condo and townhome patios are the one place we hit rules: some West Torrance associations restrict open-flame cooking on shared-wall patios, so confirm with your HOA before booking. We need roughly a 6x8 ft flat area and about 10 ft of overhead clearance above the grill.",
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
          "Yes, with advance notice — vegetarian, vegan and gluten-free guests are served at the same per-person rate. Two things to know. Our standard soy sauce is not gluten free, so a coeliac or gluten-free guest should have their own gluten-free soy and teriyaki on hand and we will cook their portion with it. And we cannot promise a nut- or sesame-free table: our sauces and the gyoza are commercial products, some carry allergen advisories, and both sauces contain egg. Tell us the allergy when you book and we will check the labels in use for your date and tell you straight whether we can serve that guest safely.",
      },
      {
        question: "What does hibachi at home cost in Torrance?",
        answer:
          "$59.90 per adult, $29.90 per child 5–12, and a flat $5 for kids under 5, $599 event minimum — chef, grill, food, show, setup, and cleanup included.",
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
    venues: [
      {
        title: "Balboa Island & Peninsula Homes",
        description:
          "Narrow lots, tight streets, and patios a few steps from the water. Access is the whole planning conversation here.",
      },
      {
        title: "Bayfront Decks & Docks",
        description:
          "Dover Shores and Linda Isle properties where the grill goes on the deck with boats behind it. Wind off the bay is the only variable.",
      },
      {
        title: "Newport Coast Estates",
        description:
          "Gated communities with large terraces and ocean views. Gate codes and guest lists are the thing to sort out ahead of time.",
      },
    ],
    logistics: [
      "Balboa Island and the Peninsula are the tightest access we deal with in Orange County. Streets are narrow, parking is scarce and largely permit or meter, and the chef may need to walk equipment in from a block away. It works fine every time — it just requires telling us in advance so the chef brings the cart and arrives with extra time. A held driveway or garage spot changes the whole load-in.",
      "Newport Coast and other gated communities need the chef on the guest list or a gate code sent ahead; without one the chef sits at the kiosk while your party waits. Bayfront decks catch afternoon wind, so we set against a rail or wall where we can. We need about a 6x8 ft flat area and roughly 10 ft of overhead clearance, and on dock or deck setups we keep the grill on a stable, level surface well clear of the water.",
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
          "$59.90 per adult, $29.90 per child 5–12, and a flat $5 for kids under 5, $599 event minimum — chef, grill, food, show, setup, and cleanup included. Upgrades optional.",
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
    venues: [
      {
        title: "Hillside Homes & Terraces",
        description:
          "Verdugo Woodlands and Chevy Chase Canyon properties with stepped patios and city views. Stairs are normal here; we plan for them.",
      },
      {
        title: "Flats Backyards",
        description:
          "Adams Hill and Northwest Glendale lots with flat yards and driveway access — the easiest setups in the city.",
      },
      {
        title: "Condo & Apartment Patios",
        description:
          "Central Glendale buildings with private patios or podium decks. Building approval for open-flame cooking is the thing to confirm.",
      },
    ],
    logistics: [
      "Glendale's hillside neighborhoods are the planning factor. Verdugo Woodlands and Chevy Chase Canyon homes often mean a flight or two of stairs from the street to the patio, sometimes more. That is completely workable — the chef packs for it — but only if we know before the day, so mention stairs and any narrow side-gate access when you book.",
      "Parking in the flats is easy; parking in central Glendale near Brand and Americana is not, and several blocks are permit-only in the evening. Hold a driveway or garage space for the chef if you are in that area. Many Glendale hillside patios have deep overhangs and low trellises, so send a photo and we will pick the grill position ahead of time. We need about a 6x8 ft flat area and roughly 10 ft of overhead clearance.",
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
          "$59.90 per adult, $29.90 per child 5–12, and a flat $5 for kids under 5, $599 event minimum — chef, grill, food, show, setup, and cleanup included.",
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
    venues: [
      {
        title: "South Corona Backyards",
        description:
          "Eagle Glen and Sierra Del Oro homes with pools, covered patios, and space for a long table. Big-party territory.",
      },
      {
        title: "Hillside & Canyon Lots",
        description:
          "Properties backing onto open space with views and afternoon wind. We set the grill against a wall where we can.",
      },
      {
        title: "Community Clubhouses",
        description:
          "HOA clubhouse patios for larger family gatherings. Reserve the space and confirm outdoor cooking is allowed.",
      },
    ],
    logistics: [
      "Corona shares the Inland Empire advantage: long driveways, wide streets, and load-in that takes minutes rather than a small expedition. It is a good city for a large guest count, and our Corona parties skew bigger than our coastal ones for exactly that reason.",
      "Summer heat and canyon wind are the two things we schedule around. From June through September, sunset starts are far more comfortable for guests than late-afternoon ones, and lots that back onto the canyons catch a real breeze in the late afternoon that a grill in an open corner will fight. During red-flag fire conditions we keep the setup on hardscape well clear of dry brush. We need about a 6x8 ft flat area and roughly 10 ft of overhead clearance.",
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
          "$59.90 per adult, $29.90 per child 5–12, and a flat $5 for kids under 5, $599 event minimum — chef, grill, food, show, setup, and cleanup included. Weekday Special ($45.90/adult, Mon–Thu, 15+ guests) also applies.",
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
    venues: [
      {
        title: "Beachside Rentals",
        description:
          "South O and downtown rentals a few blocks from the sand, usually a family group or a wedding-weekend party staying put for one night.",
      },
      {
        title: "Fire-Pit Backyards",
        description:
          "Inland Oceanside and Rancho del Oro homes with real yards, pools, and room to spread out.",
      },
      {
        title: "Military Family Homes",
        description:
          "Camp Pendleton-adjacent housing for homecomings, promotions, and send-offs. We work around short-notice dates when we can.",
      },
    ],
    logistics: [
      "Beach-block Oceanside parking is metered and busy through the summer evening, and rentals near the pier often have a single assigned space. Holding that space for the chef, or telling us where the closest loading spot is, is the most useful thing you can do. Inland neighborhoods have driveways and are simple.",
      "Vacation rentals here carry the same caution as San Diego and Anaheim: check the listing for open-flame restrictions before you book us. Coastal wind and evening damp are mild but real, so we set against a wall or fence where possible and an earlier start keeps guests comfortable. We need about a 6x8 ft flat area and roughly 10 ft of overhead clearance, and a travel fee applies past our free 50-mile radius at $1 for each mile beyond it — calculated from your address and shown upfront in your quote.",
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
          "$59.90 per adult, $29.90 per child 5–12, and a flat $5 for kids under 5, $599 event minimum — chef, grill, food, live show, setup, and cleanup included.",
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
    venues: [
      {
        title: "Mid-Century Vacation Rentals",
        description:
          "Pool, patio, mountain backdrop. Most of our desert bookings are a whole group renting a house for the weekend.",
      },
      {
        title: "Poolside Decks",
        description:
          "The grill goes on the hard deck well clear of the water, the pool lights come on, and the mountains turn pink behind the show.",
      },
      {
        title: "Country Club & Gated Homes",
        description:
          "Rancho Mirage and Indian Wells properties with terraces and guard gates. Gate codes and the chef's name on the list, sorted in advance.",
      },
    ],
    logistics: [
      "The desert has two hard rules and both are about heat. From May through September we strongly recommend an evening start — a teppanyaki grill at 105 degrees is miserable for everyone standing near it, and the same party at 8pm is genuinely lovely. Between October and April a lunch or afternoon booking on the patio is one of the best things about the desert. Second, shade and water for your guests matter more than anything we bring; the chef manages the grill heat regardless.",
      "Vacation rentals dominate our Palm Springs bookings, and desert rentals have the strictest quiet-hours and event rules of anywhere we serve. Check your rental's policy on outdoor cooking and evening noise before booking us — an early-evening slot almost always wraps inside quiet hours. Gated communities need the chef on the list or a gate code sent ahead. A travel fee applies given the distance from our base and is shown upfront in your quote. We need about a 6x8 ft flat area and roughly 10 ft of overhead clearance.",
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
          "Often yes, given the distance — our first 50 miles are free and the desert is past that, so expect $1 per mile beyond the 50. The exact amount is calculated from your address and shown upfront in your instant quote.",
      },
      {
        question: "What does hibachi at home cost in Palm Springs?",
        answer:
          "$59.90 per adult, $29.90 per child 5–12, and a flat $5 for kids under 5, $599 event minimum — chef, grill, food, show, setup, and cleanup included, plus any disclosed travel fee.",
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
