// City x occasion crossover pages (/party/[occasion]/[city]) — the long-tail
// combos competitor research found nobody has landing pages for. Each combo
// carries a custom localIntro so the page reads written-for-the-city, not
// mail-merged; everything else composes from the occasion + city configs.

export type OccasionCityCombo = {
  occasion: string // occasion slug from config/occasion-pages
  city: string // city slug from config/city-pages
  localIntro: string[] // 2 short city-specific paragraphs
}

export const OCCASION_CITY_COMBOS: OccasionCityCombo[] = [
  {
    occasion: "birthday-party",
    city: "los-angeles",
    localIntro: [
      "An LA birthday fights for attention — everyone in the group chat has been to a rooftop bar and a dinner at a place with a wait. What they haven't done is stand in a Silver Lake or Mid-City backyard while a chef sends a flame over the grill for the birthday person.",
      "No valet, no splitting the party across two reservation slots, and the show comes to whichever neighborhood you call home.",
    ],
  },
  {
    occasion: "birthday-party",
    city: "san-diego",
    localIntro: [
      "San Diego birthdays live outdoors — and a backyard in North Park or a patio in Carmel Valley beats a crowded Gaslamp table every time. The chef brings the restaurant to the marine layer's favorite city.",
      "Evening parties here run long and comfortable; time the show to sunset and the fire does the lighting.",
    ],
  },
  {
    occasion: "birthday-party",
    city: "anaheim",
    localIntro: [
      "Anaheim families know how to throw a party — and after the theme-park birthdays blur together, a hibachi chef in your own backyard is the one the kids describe at school on Monday.",
      "From the Colony to Anaheim Hills, the grill fits wherever there's a patio and ten feet of sky.",
    ],
  },
  {
    occasion: "pool-party",
    city: "los-angeles",
    localIntro: [
      "An LA pool party with catering usually means someone's dad at a grill missing the whole thing. Swap him out: the chef cooks poolside while everyone stays in the water until the first course lands.",
      "Valley heat, Westside evenings, Eastside patios — the fire show reflects off any pool in the county.",
    ],
  },
  {
    occasion: "pool-party",
    city: "san-diego",
    localIntro: [
      "San Diego has more pool days than anywhere in California — and the same problem everywhere: dinner ends the swim. Not when the grill is six feet from the water and the chef times dinner to the last cannonball.",
      "From Chula Vista to Carlsbad, if the pool deck has a flat 6x8 spot, the show is on.",
    ],
  },
  {
    occasion: "bachelorette-party",
    city: "san-diego",
    localIntro: [
      "San Diego is a bachelorette capital — which is exactly why a Saturday table for twelve downtown is a fantasy. The move: the chef comes to your Mission Beach or Gaslamp-adjacent rental, and the night never needs a rideshare.",
      "Dinner, show, and the group photo with a wall of flame — all before the night's second act.",
    ],
  },
  {
    occasion: "bachelorette-party",
    city: "palm-springs",
    localIntro: [
      "Palm Springs bachelorette weekends run on one geometry: the rental house with the pool. Everyone's already there — the only question is whether dinner means eleven people in three cars, or a chef arriving at golden hour while nobody moves from the water.",
      "We cook at vacation rentals constantly; send the listing photos and we'll confirm the setup spot before you book.",
    ],
  },
  {
    occasion: "family-reunion",
    city: "riverside",
    localIntro: [
      "Riverside and the Inland Empire are where SoCal families actually have the yards for a proper reunion — the kind where three generations fit at one table without renting a hall.",
      "The chef handles dinner and the show; the family finally gets a reunion photo with everyone in it, including whoever usually mans the grill.",
    ],
  },
  {
    occasion: "backyard-party",
    city: "los-angeles",
    localIntro: [
      "The best restaurant in Los Angeles tonight might be your backyard. A private chef, a wall of flame, and a show your street will hear about — no reservation app involved.",
      "From Highland Park to Westchester, if there's a patio and open sky, we'll turn it into the venue.",
    ],
  },
  {
    occasion: "quinceanera",
    city: "los-angeles",
    localIntro: [
      "LA quinceañeras are legendary — and banquet hall quotes are too, for the wrong reason. Bring the celebration home: the whole family in one backyard, a show worthy of her fifteenth, and food every generation actually eats.",
      "The chef times the first big flame to her entrance. The court gets a front row. The abuelos get the comfortable seats.",
    ],
  },
  {
    occasion: "corporate-event",
    city: "irvine",
    localIntro: [
      "Irvine's office parks host a thousand forgettable catered lunches a week. A hibachi chef on the patio is the one team event people don't invent meetings to skip — live fire, games, and dinner cooked in front of the whole floor.",
      "Weekday events with 15+ people hit our $45.90/person Weekday Special — corporate budgets love that math.",
    ],
  },
  {
    occasion: "holiday-party",
    city: "pasadena",
    localIntro: [
      "Pasadena does holidays properly — and the host usually pays for it with a night in the kitchen. This year the chef cooks outside under the string lights while the whole street's worth of family sits down together.",
      "December evenings here mean patio heaters and jackets, not cancellations: the chef cooks outdoors, guests eat wherever it's cozy.",
    ],
  },
]

export function getCombo(occasion: string, city: string): OccasionCityCombo | undefined {
  return OCCASION_CITY_COMBOS.find((combo) => combo.occasion === occasion && combo.city === city)
}
