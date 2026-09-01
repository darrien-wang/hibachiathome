// Occasion landing pages: one entry here = one live page at /party/[slug].
// Positioning: Real Hibachi competes with every other way a group could spend
// an evening together (restaurants, hot pot, BBQ, doing nothing) — so each
// page sells the gathering, not the food. Reviews are verbatim 5-star Google
// reviews (same source set as the quote page); never invent one.

export type OccasionMedia = {
  src: string
  alt: string
}

export type OccasionVideo = {
  src: string
  poster: string
  alt: string
}

export type OccasionPage = {
  slug: string
  occasion: string // short label, e.g. "Birthday Party"
  headline: string // H1
  subline: string // emotional one-liner under the H1
  metaTitle: string
  metaDescription: string
  intro: string[] // 2 short paragraphs of scene-setting
  moments: { title: string; description: string }[] // the designed highlights
  photos: OccasionMedia[]
  video: OccasionVideo
  reviews: { name: string; text: string }[]
  faqs: { question: string; answer: string }[]
}

export const OCCASION_PAGES_LAST_UPDATED = "2026-08-31T00:00:00.000Z"

const SPACE_FAQ = {
  question: "How much space do we need?",
  answer:
    "About a 6x8 ft flat area for the grill plus roughly 10 ft of overhead clearance, in open air — a patio, deck, driveway, or yard all work. The cooking stays outdoors; your guests can eat inside if you like. Send a photo when you book and we'll confirm the setup spot before your date.",
}

const PRICE_FAQ = {
  question: "How much does it cost?",
  answer:
    "$59.90 per adult and $29.90 per child (5–12) on the Standard Plan, with a $599 event minimum. That includes the chef, the live show, 2 proteins per guest, fried rice, vegetables, salad, setup, and cleanup. A $19.90 refundable deposit locks your date. Get an exact number in 30 seconds with the instant quote — no sign-up.",
}

export const occasionPages: OccasionPage[] = [
  {
    slug: "birthday-party",
    occasion: "Birthday Party",
    headline: "Hibachi Birthday Party at Home",
    subline: "The birthday they'll still be talking about next year.",
    metaTitle: "Hibachi Birthday Party at Home | Private Chef Comes to You",
    metaDescription:
      "Throw a birthday party nobody forgets: a private hibachi chef, live fire show, and dinner cooked in your own backyard. Serving all of Southern California from $59.90/adult.",
    intro: [
      "A restaurant gives the birthday person a table. A hibachi party gives them the whole show — a chef performing three feet away, flames lighting up the yard, and every single guest facing them instead of a wall.",
      "No driving, no splitting the group across two booths, no 9pm closing time. The party is at home, so grandma and the kids are comfortable, and the celebration keeps going after the last plate.",
    ],
    moments: [
      {
        title: "The cake moment, staged right",
        description:
          "Tell us when the cake is coming out. The chef finishes with a flame send-off and gets the whole yard singing — it's the photo everyone posts.",
      },
      {
        title: "The guest of honor eats first",
        description: "First plate, biggest shrimp catch, and the chef makes sure everyone knows whose day it is.",
      },
      {
        title: "Games between courses",
        description:
          "Egg toss, shrimp catch, the legendary squeeze-bottle challenge — the table is laughing before the first course lands.",
      },
    ],
    photos: [
      {
        src: "/gallery/real-hibachi-party-los-angeles-birthday-event-13.jpg",
        alt: "Evening hibachi birthday party under string lights in Los Angeles",
      },
      {
        src: "/gallery/real-hibachi-party-orange-county-night-fire-show-18.jpg",
        alt: "Huge hibachi flame lighting up a night birthday party",
      },
      {
        src: "/gallery/real-hibachi-party-los-angeles-chef-guest-game-17.jpg",
        alt: "Hibachi chef playing a game with a laughing birthday guest",
      },
    ],
    video: {
      src: "/videos/birthday-moment.mp4",
      poster: "/videos/posters/birthday-moment.jpg",
      alt: "Birthday cake moment at a Real Hibachi party",
    },
    reviews: [
      {
        name: "Kelsey Molnar",
        text: "Real Hibachi is such a fun experience! I decided to hire for my sisters 30th bday and it was an absolute success! We had Chef Bling and he was a riot and so sweet! I told him it was a surprise and he made it SO FUN! HIGHLY RECOMMEND, HIGHLY AFFORDABLE, so delicious…",
      },
      {
        name: "Warren Zhang",
        text: "Bling was a great chef and also very personable! He made our night and it was my birthday! Best night ever!",
      },
      {
        name: "Judy Gothelf",
        text: "What a great experience having Blue as our chef! Aside from the fact that he made delicious food, he was so much fun and so engaging! We loved having him here to celebrate our friend's BIG birthday!",
      },
    ],
    faqs: [
      {
        question: "Can the chef do something special for the birthday person?",
        answer:
          "Yes — tell us it's a birthday when you book. The chef will build the show around the guest of honor: first plate, extra games, and a flame finale timed to the cake if you want one. Surprises welcome; we're good at keeping them.",
      },
      SPACE_FAQ,
      PRICE_FAQ,
    ],
  },
  {
    slug: "pool-party",
    occasion: "Pool Party",
    headline: "Hibachi Pool Party",
    subline: "Swim until dinner finds you.",
    metaTitle: "Hibachi Pool Party Catering | Chef & Grill by the Pool",
    metaDescription:
      "The pool party upgrade: a private hibachi chef cooks poolside while everyone stays in the water until the first course lands. Southern California, from $59.90/adult.",
    intro: [
      "The problem with every pool party is dinner — someone has to leave the water, stand at a grill, and miss the party they're hosting. Not this time. The chef sets up poolside, and the show starts while towels are still wet.",
      "Nobody has to change, drive, or wait for a table in wet sandals. The fire show hits different with a pool reflecting it.",
    ],
    moments: [
      {
        title: "The poolside fire show",
        description: "An onion volcano and a wall of flame, doubled in the water. Phones come out every time.",
      },
      {
        title: "Water gun ceasefire",
        description:
          "The chef has been known to pick a side in the water fight. Armed. Guests are still talking about it.",
      },
      {
        title: "Dinner in towels",
        description: "No dress code, no reservations. Swim, eat, swim again — the chef handles everything else.",
      },
    ],
    photos: [
      {
        src: "/gallery/real-hibachi-party-southern-california-dinner-06.jpg",
        alt: "Happy guests with their hibachi chef at a Southern California pool party",
      },
      {
        src: "/gallery/real-hibachi-party-san-diego-water-gun-fun-19.jpg",
        alt: "Hibachi chef water gun game with laughing guests",
      },
      {
        src: "/gallery/real-hibachi-party-santa-barbara-oceanfront-sunset-16.jpg",
        alt: "Oceanfront sunset hibachi party table with lanterns",
      },
    ],
    video: {
      src: "/gallery/real-hibachi-party-malibu-beach-sunset-video-05.mp4",
      poster: "/gallery/real-hibachi-party-malibu-beach-sunset-video-05-poster.jpg",
      alt: "Oceanfront sunset hibachi dinner party",
    },
    reviews: [
      {
        name: "David Armstrong",
        text: "Chef Bling curated a brilliant display of culinary mastery and phenomenal vibes to create an forgettable evening for the bros and I. 2 thumbs up.",
      },
      {
        name: "Spencer Sprowls",
        text: "Bling is an amazing chef!! He makes the party 100x better and will make amazing food for you.",
      },
    ],
    faqs: [
      {
        question: "How close to the pool can the grill be?",
        answer:
          "The grill needs a flat, stable surface a safe distance from splash range — a patio or deck area near the pool is perfect. We'll confirm the exact spot from a photo when you book.",
      },
      SPACE_FAQ,
      PRICE_FAQ,
    ],
  },
  {
    slug: "family-reunion",
    occasion: "Family Reunion",
    headline: "Family Reunion Hibachi Dinner",
    subline: "Three generations, one table, zero people stuck in the kitchen.",
    metaTitle: "Family Reunion Catering at Home | Hibachi Chef & Show",
    metaDescription:
      "Get every generation at one table: a private hibachi chef cooks and performs at your family gathering while you actually spend time with your family. From $59.90/adult.",
    intro: [
      "At every family gathering, someone spends the whole evening cooking and misses it. A hibachi party retires that job. The chef cooks, performs, and cleans up — and for once the whole family is in the photos, including the one who usually holds the camera.",
      "The show works on everyone: kids scream for the egg toss, grandparents get the comfortable seat at home, and picky eaters pick their own proteins. No restaurant can seat twenty of you at one table. Your backyard can.",
    ],
    moments: [
      {
        title: "Kids' front row",
        description:
          "The chef switches the show up between adults and kids — flying broccoli for the little ones, bigger flames for the big ones.",
      },
      {
        title: "Everyone in the photo",
        description: "Nobody's stuck at the stove, so the group photo finally has the whole group in it.",
      },
      {
        title: "The long dinner",
        description:
          "No table time limit. The chef's show runs about an hour, and the table keeps going as long as the stories do.",
      },
    ],
    photos: [
      {
        src: "/gallery/real-hibachi-party-orange-county-family-event-04.jpg",
        alt: "Hibachi chef cooking fresh eggs at an Orange County family event",
      },
      {
        src: "/gallery/real-hibachi-party-los-angeles-group-dinner-09.jpg",
        alt: "Big family group at a hibachi dinner in Los Angeles",
      },
      {
        src: "/gallery/real-hibachi-party-orange-county-hibachi-at-home-12.jpg",
        alt: "Family hibachi party at home in Orange County",
      },
    ],
    video: {
      src: "/gallery/real-hibachi-party-los-angeles-balloon-fun-video-06.mp4",
      poster: "/gallery/real-hibachi-party-los-angeles-balloon-fun-video-06-poster.jpg",
      alt: "Guests with balloon hats having fun at a family hibachi dinner",
    },
    reviews: [
      {
        name: "Lisa Craven",
        text: "Chef blue was absolutely amazing!!! Super friendly and personable. So fun and interactive. Knew how to switch it up between adults and kids. Food was delicious and he was great! Highly recommend !",
      },
      {
        name: "Laura Gallop",
        text: "Chef Bling and Chef Noodle was great! Very entertaining and food was delicious.",
      },
      {
        name: "Karen Wertheimer",
        text: "Just had a wonderful dinner prepared by Blue. He was engaging and entertaining. I would recommend this for any occasion.",
      },
    ],
    faqs: [
      {
        question: "Do you handle kids and picky eaters?",
        answer:
          "All the time. Kids 5–12 are $29.90, little ones under 5 are $5, and every guest picks their own two proteins — chicken, steak, shrimp, salmon, or tofu — so nobody negotiates with anyone else's plate.",
      },
      {
        question: "How many people can you serve?",
        answer:
          "One chef comfortably serves up to about 25 guests; for bigger reunions we bring a second chef and grill so both ends of the party get the full show. Tell us your headcount in the quote and we'll set it up right.",
      },
      PRICE_FAQ,
    ],
  },
  {
    slug: "backyard-party",
    occasion: "Backyard Party",
    headline: "Backyard Hibachi Party",
    subline: "Your yard. Our fire. Everyone's night.",
    metaTitle: "Backyard Hibachi Party | Private Chef & Fire Show at Home",
    metaDescription:
      "Turn a backyard into the best restaurant in town for one night: private hibachi chef, live fire show, dinner for the whole crew. Southern California, from $59.90/adult.",
    intro: [
      "A backyard BBQ means someone works the grill all night. A backyard hibachi party means a professional does — with knife tricks, an onion volcano, and fire you can feel from your chair.",
      "It's the privacy of home with the theater of a teppanyaki restaurant: your music, your schedule, your people, no last call. We bring the restaurant. You keep the night.",
    ],
    moments: [
      {
        title: "The first flame",
        description: "The moment the grill lights up, the whole party turns around. It gets a scream every single time.",
      },
      {
        title: "The show at golden hour",
        description: "Time the chef's start to sunset and the fire show runs straight into the string-light hours.",
      },
      {
        title: "Nothing to clean",
        description: "Setup and cleanup are in the price. When the chef leaves, your kitchen doesn't know a party happened.",
      },
    ],
    photos: [
      {
        src: "/gallery/real-hibachi-party-los-angeles-chef-grill-setup-03.jpg",
        alt: "Hibachi chef with a huge flame at a Los Angeles backyard party",
      },
      {
        src: "/gallery/real-hibachi-party-riverside-sunset-flame-20.jpg",
        alt: "Sunset hibachi flame show at a Southern California backyard party",
      },
      {
        src: "/gallery/real-hibachi-party-southern-california-private-event-10.jpg",
        alt: "Private backyard hibachi event in Southern California",
      },
    ],
    video: {
      src: "/videos/hibachi-show.mp4",
      poster: "/videos/posters/hibachi-show.jpg",
      alt: "Live hibachi chef show at a backyard party",
    },
    reviews: [
      {
        name: "Beatrix Barrera",
        text: "Chef John was our personal chef and he was sooooo much fun. I highly recommend requesting for him because aside from the delicious food, there was so much laughing because of him. 5 stars for the service, 5 stars for the food, 5 stars for Chef John! Definitely will do this again!",
      },
      {
        name: "Max Schwenk",
        text: "Unbelievable experience! Bling was the best chef ever!",
      },
    ],
    faqs: [
      {
        question: "What do we need to provide?",
        answer:
          "Tables, chairs, and place settings for your guests — or add our tableware rental ($15/person: tables, chairs, tableware, tablecloth) and provide nothing at all. We bring the chef, the grill, all the food, and take everything away after.",
      },
      SPACE_FAQ,
      PRICE_FAQ,
    ],
  },
  {
    slug: "anniversary",
    occasion: "Anniversary",
    headline: "Anniversary Hibachi Dinner at Home",
    subline: "The place you built together is the venue.",
    metaTitle: "Anniversary Dinner at Home | Private Hibachi Chef Experience",
    metaDescription:
      "Celebrate your anniversary with a private chef at home — a hibachi dinner and show for two, or for everyone who loves you two. Southern California, from $59.90/adult.",
    intro: [
      "Restaurants on anniversary night: crowded, rushed, a candle if you're lucky. Instead, a private chef sets up at the home you built together and cooks the kind of dinner people dress up for — while you stay exactly where the memories live.",
      "Keep it intimate or invite everyone who was at the wedding. Either way, nobody's driving home after, and the toast can run as long as you like.",
    ],
    moments: [
      {
        title: "Golden hour dinner",
        description: "Book the sunset slot. The show starts in daylight and ends under the stars.",
      },
      {
        title: "The story retold",
        description:
          "Tell us the story — how you met, the number of years — and the chef weaves it into the show. It lands better than any restaurant candle.",
      },
      {
        title: "A table for two, or twenty",
        description: "The $599 minimum makes an intimate dinner party work, and the show scales up for a full renewal crowd.",
      },
    ],
    photos: [
      {
        src: "/gallery/real-hibachi-party-santa-barbara-oceanfront-sunset-16.jpg",
        alt: "Romantic oceanfront sunset hibachi table with lanterns and roses",
      },
      {
        src: "/gallery/real-hibachi-party-los-angeles-birthday-event-13.jpg",
        alt: "Evening hibachi celebration under string lights",
      },
      {
        src: "/gallery/real-hibachi-party-riverside-sunset-flame-20.jpg",
        alt: "Sunset hibachi flame show at a Southern California celebration",
      },
    ],
    video: {
      src: "/videos/atmosphere.mp4",
      poster: "/videos/posters/atmosphere.jpg",
      alt: "The atmosphere at a Real Hibachi dinner party",
    },
    reviews: [
      {
        name: "Karen Wertheimer",
        text: "Just had a wonderful dinner prepared by Blue. He was engaging and entertaining. I would recommend this for any occasion.",
      },
      {
        name: "Beatrix Barrera",
        text: "Chef John was our personal chef and he was sooooo much fun. I highly recommend requesting for him because aside from the delicious food, there was so much laughing because of him. 5 stars for the service, 5 stars for the food, 5 stars for Chef John! Definitely will do this again!",
      },
    ],
    faqs: [
      {
        question: "Can we do a small, intimate dinner?",
        answer:
          "Yes. The $599 event minimum covers intimate parties — think of it as a private-restaurant buyout for the evening, at home. Many couples invite two or three other couples and split a genuinely memorable night.",
      },
      SPACE_FAQ,
      PRICE_FAQ,
    ],
  },
  {
    slug: "bachelorette-party",
    occasion: "Bachelorette Party",
    headline: "Bachelorette Party Hibachi Night",
    subline: "The pre-wedding night that doesn't need a reservation for twelve.",
    metaTitle: "Bachelorette Party Ideas | Private Hibachi Chef & Show at Home",
    metaDescription:
      "Skip the impossible reservation: a private hibachi chef brings dinner and a fire show to your bachelorette weekend house. Southern California, from $59.90/adult.",
    intro: [
      "Try getting a table for twelve on a Saturday night. Now try doing it where everyone can hear each other, phones can charge, and nobody has to pick a designated driver. That's the bachelorette math that ends with a chef coming to you.",
      "The show is the icebreaker between the college friends and the work friends — by the shrimp toss, everyone's on the same team. And the Airbnb backyard just became the best restaurant in town.",
    ],
    moments: [
      {
        title: "The bride's spotlight",
        description:
          "The chef knows exactly who tonight is about. First plate, most games, and a flame finale for the bride.",
      },
      {
        title: "The group photo",
        description: "Matching outfits, one chef hat, a wall of fire in the back. It's the grid post of the weekend.",
      },
      {
        title: "No closing time",
        description: "Dinner flows straight into the rest of the night without moving twelve people across town.",
      },
    ],
    photos: [
      {
        src: "/gallery/real-hibachi-party-southern-california-dinner-06.jpg",
        alt: "Group of friends with their hibachi chef at a Southern California party",
      },
      {
        src: "/gallery/real-hibachi-party-santa-barbara-oceanfront-sunset-16.jpg",
        alt: "Oceanfront sunset party table with lanterns and roses",
      },
      {
        src: "/gallery/real-hibachi-party-san-diego-water-gun-fun-19.jpg",
        alt: "Hibachi chef game with laughing party guests",
      },
    ],
    video: {
      src: "/videos/party-highlight.mp4",
      poster: "/videos/posters/party-highlight.jpg",
      alt: "Party highlights from a Real Hibachi event",
    },
    reviews: [
      {
        name: "Kelsey Molnar",
        text: "Real Hibachi is such a fun experience! I decided to hire for my sisters 30th bday and it was an absolute success! We had Chef Bling and he was a riot and so sweet! I told him it was a surprise and he made it SO FUN! HIGHLY RECOMMEND, HIGHLY AFFORDABLE, so delicious…",
      },
      {
        name: "Judy Gothelf",
        text: "What a great experience having Blue as our chef! Aside from the fact that he made delicious food, he was so much fun and so engaging! We loved having him here to celebrate our friend's BIG birthday!",
      },
    ],
    faqs: [
      {
        question: "Can you come to an Airbnb or vacation rental?",
        answer:
          "Yes — most bachelorette bookings are at rentals. We just need an outdoor spot for the grill (patio, deck, or yard) and the host's OK for outdoor cooking. Send the listing photos and we'll confirm the setup before you book.",
      },
      SPACE_FAQ,
      PRICE_FAQ,
    ],
  },
  {
    slug: "gender-reveal",
    occasion: "Gender Reveal",
    headline: "Gender Reveal Hibachi Party",
    subline: "Reveal it with fire.",
    metaTitle: "Gender Reveal Party Ideas | Hibachi Chef & Fire Show at Home",
    metaDescription:
      "A gender reveal your guests will actually remember: private hibachi chef, live show, and a reveal moment built into the performance. Southern California, from $59.90/adult.",
    intro: [
      "Everyone's seen the balloon pop and the confetti cannon. Nobody's seen the chef pause mid-show, gather the whole yard around the grill, and make the reveal part of the performance.",
      "And unlike a park or a rented hall, it's at home — comfortable for the parents-to-be, easy for the grandparents, and dinner for everyone is already handled.",
    ],
    moments: [
      {
        title: "The reveal, staged by a showman",
        description:
          "Work with the chef on the moment — a covered plate, a colored surprise in the show — and let a professional performer land it.",
      },
      {
        title: "Everyone stays for dinner",
        description: "The reveal is two minutes; the party is the whole evening. The chef feeds the crowd right after.",
      },
      {
        title: "The reaction shot",
        description: "Every phone is already up for the fire show when the reveal hits. Nobody misses the moment.",
      },
    ],
    photos: [
      {
        src: "/gallery/real-hibachi-party-los-angeles-chef-guest-game-17.jpg",
        alt: "Hibachi chef celebrating with a party guest",
      },
      {
        src: "/gallery/real-hibachi-party-orange-county-family-event-04.jpg",
        alt: "Hibachi chef cooking for a family gathering",
      },
      {
        src: "/gallery/real-hibachi-party-orange-county-night-fire-show-18.jpg",
        alt: "Hibachi flame show lighting up an evening party",
      },
    ],
    video: {
      src: "/videos/fried-rice.mp4",
      poster: "/videos/posters/fried-rice.jpg",
      alt: "Fresh hibachi fried rice on the griddle",
    },
    reviews: [
      {
        name: "Lisa Craven",
        text: "Chef blue was absolutely amazing!!! Super friendly and personable. So fun and interactive. Knew how to switch it up between adults and kids. Food was delicious and he was great! Highly recommend !",
      },
      {
        name: "Laura Gallop",
        text: "Chef Bling and Chef Noodle was great! Very entertaining and food was delicious.",
      },
    ],
    faqs: [
      {
        question: "Can the chef help stage the reveal?",
        answer:
          "Yes — tell us the plan when you book and we'll coordinate with your chef. Chefs have staged reveals with covered plates, color moments in the show, and countdowns. Keep it a surprise from the guests, not from us.",
      },
      SPACE_FAQ,
      PRICE_FAQ,
    ],
  },
  {
    slug: "graduation-party",
    occasion: "Graduation Party",
    headline: "Graduation Party Hibachi at Home",
    subline: "They worked years for this. Give the night a show.",
    metaTitle: "Graduation Party Ideas | Hibachi Chef & Show at Home",
    metaDescription:
      "Celebrate the graduate with a private hibachi chef at home — live fire show, dinner for family and friends, zero restaurant chaos in graduation season. From $59.90/adult.",
    intro: [
      "Graduation week: every restaurant in town is slammed, split between ten other families' parties. Meanwhile your backyard is free, fits everyone from roommates to grandparents, and doesn't mind how loud the toasts get.",
      "The chef gives the night a centerpiece — a show the college friends and the family can both cheer for — and the graduate gets a celebration that isn't a two-hour table slot.",
    ],
    moments: [
      {
        title: "The graduate's toast",
        description: "The chef hands the night to the graduate at the perfect moment — flame up, glasses up.",
      },
      {
        title: "Two worlds, one table",
        description: "The show gives the family crowd and the friend crowd something to react to together.",
      },
      {
        title: "The last one home",
        description: "Before everyone scatters to new cities, one long dinner at home with nobody watching the clock.",
      },
    ],
    photos: [
      {
        src: "/gallery/real-hibachi-party-los-angeles-group-dinner-09.jpg",
        alt: "Big group hibachi dinner celebration in Los Angeles",
      },
      {
        src: "/gallery/real-hibachi-party-southern-california-private-event-10.jpg",
        alt: "Private hibachi celebration in Southern California",
      },
      {
        src: "/gallery/real-hibachi-party-los-angeles-birthday-event-13.jpg",
        alt: "Evening celebration under string lights",
      },
    ],
    video: {
      src: "/videos/party-highlight.mp4",
      poster: "/videos/posters/party-highlight.jpg",
      alt: "Party highlights from a Real Hibachi event",
    },
    reviews: [
      {
        name: "Spencer Sprowls",
        text: "Bling is an amazing chef!! He makes the party 100x better and will make amazing food for you.",
      },
      {
        name: "Max Schwenk",
        text: "Unbelievable experience! Bling was the best chef ever!",
      },
    ],
    faqs: [
      {
        question: "Graduation season is busy — how far ahead should we book?",
        answer:
          "May and June weekends go first. Two to three weeks ahead is comfortable; for a specific Saturday at sunset, book as soon as you have the date. A $19.90 refundable deposit is all it takes to lock it.",
      },
      SPACE_FAQ,
      PRICE_FAQ,
    ],
  },
  {
    slug: "holiday-party",
    occasion: "Holiday Party",
    headline: "Holiday Hibachi Party at Home",
    subline: "New tradition: the holidays where nobody's stuck in the kitchen.",
    metaTitle: "Holiday Party Catering at Home | Private Hibachi Chef & Show",
    metaDescription:
      "Thanksgiving, Christmas, New Year's, Fourth of July — a private hibachi chef turns any holiday gathering into dinner and a show, with zero kitchen duty. From $59.90/adult.",
    intro: [
      "Every holiday has the same casualty: whoever's cooking. This year, the kitchen stays closed, the chef performs in the backyard, and the person who usually disappears behind a stove is at the table for the whole thing.",
      "It works for the Fourth of July crowd and the New Year's countdown alike — SoCal weather keeps the backyard open year-round, and a fire show beats a fireplace.",
    ],
    moments: [
      {
        title: "The cook, retired for a night",
        description: "The family cook's actual holiday gift: sitting down. The chef handles all of it, cleanup included.",
      },
      {
        title: "Fire for the countdown",
        description: "New Year's, Fourth of July — time the flame finale to the moment and let the yard light up.",
      },
      {
        title: "A tradition people opt into",
        description:
          "The first year it's a novelty. The second year the family asks for it by name. That's how traditions start.",
      },
    ],
    photos: [
      {
        src: "/gallery/real-hibachi-party-los-angeles-birthday-event-13.jpg",
        alt: "Festive evening hibachi party under string lights",
      },
      {
        src: "/gallery/real-hibachi-party-orange-county-night-fire-show-18.jpg",
        alt: "Hibachi flame show lighting up a night gathering",
      },
      {
        src: "/gallery/real-hibachi-party-santa-barbara-oceanfront-sunset-16.jpg",
        alt: "Holiday party table with lanterns at sunset",
      },
    ],
    video: {
      src: "/videos/atmosphere.mp4",
      poster: "/videos/posters/atmosphere.jpg",
      alt: "The atmosphere at a Real Hibachi dinner party",
    },
    reviews: [
      {
        name: "Karen Wertheimer",
        text: "Just had a wonderful dinner prepared by Blue. He was engaging and entertaining. I would recommend this for any occasion.",
      },
      {
        name: "Spencer Sprowls",
        text: "Bling is an amazing chef!! He makes the party 100x better and will make amazing food for you.",
      },
    ],
    faqs: [
      {
        question: "Do you work on actual holidays?",
        answer:
          "Yes — Thanksgiving, Christmas Eve, New Year's Eve, and the Fourth of July are some of our biggest dates. They book out first, so lock your date early with the $19.90 refundable deposit.",
      },
      {
        question: "Is it warm enough for an outdoor party in winter?",
        answer:
          "In Southern California, almost always — December evenings usually just mean patio heaters and string lights. The chef cooks outside; guests can eat indoors where it's cozy, which is exactly how many winter parties run.",
      },
      PRICE_FAQ,
    ],
  },
]

export const EXTRA_OCCASIONS: OccasionPage[] = [
  {
    slug: "quinceanera",
    occasion: "Quinceañera",
    headline: "Quinceañera Hibachi Party at Home",
    subline: "Her fifteenth deserves fire.",
    metaTitle: "Quinceañera Party Ideas | Hibachi Chef & Show at Home",
    metaDescription:
      "A quinceañera dinner the whole family talks about: private hibachi chef, live fire show, and dinner for every generation at home. Southern California, from $59.90/adult.",
    intro: [
      "The banquet hall quote came back at how much? A quinceañera doesn't need a rented ballroom to feel grand — it needs the whole family in one place, a show worthy of the occasion, and food everyone from the little cousins to the abuelos will actually eat.",
      "A hibachi chef gives the court and the guests one shared spectacle — fire, games, and a performance that doesn't need a translation for anyone at the table.",
    ],
    moments: [
      {
        title: "Her entrance, then the flame",
        description: "Time the chef's first big flame to the birthday girl's entrance — the yard lights up on cue.",
      },
      {
        title: "Every generation at one table",
        description: "Kids pick their proteins, grandparents get the comfortable seat, and nobody's stuck hosting.",
      },
      {
        title: "The court's toast",
        description: "The chef hands the night to the family at the perfect moment — flame up, glasses up.",
      },
    ],
    photos: [
      {
        src: "/gallery/real-hibachi-party-los-angeles-birthday-event-13.jpg",
        alt: "Evening celebration under string lights at a Los Angeles party",
      },
      {
        src: "/gallery/real-hibachi-party-orange-county-night-fire-show-18.jpg",
        alt: "Hibachi flame show lighting up a night celebration",
      },
      {
        src: "/gallery/real-hibachi-party-southern-california-dinner-06.jpg",
        alt: "Family group with their hibachi chef at a Southern California celebration",
      },
    ],
    video: {
      src: "/videos/birthday-moment.mp4",
      poster: "/videos/posters/birthday-moment.jpg",
      alt: "Cake moment at a Real Hibachi celebration",
    },
    reviews: [
      {
        name: "Lisa Craven",
        text: "Chef blue was absolutely amazing!!! Super friendly and personable. So fun and interactive. Knew how to switch it up between adults and kids. Food was delicious and he was great! Highly recommend !",
      },
      {
        name: "Judy Gothelf",
        text: "What a great experience having Blue as our chef! Aside from the fact that he made delicious food, he was so much fun and so engaging! We loved having him here to celebrate our friend's BIG birthday!",
      },
    ],
    faqs: [
      {
        question: "Can you handle a big quinceañera guest list?",
        answer:
          "Yes — one chef serves up to about 25 guests with the full show, and larger celebrations get additional chefs and grills so every table has a front row. Tell us your headcount in the quote and we'll staff it right.",
      },
      SPACE_FAQ,
      PRICE_FAQ,
    ],
  },
  {
    slug: "corporate-event",
    occasion: "Corporate Event",
    headline: "Corporate Hibachi Catering",
    subline: "The team event people don't make excuses to skip.",
    metaTitle: "Corporate Event Catering Ideas | Hibachi Chef & Show On-Site",
    metaDescription:
      "Office parties, launch dinners, team celebrations: a private hibachi chef brings dinner and a live show to your office patio or venue. Southern California, from $59.90/person.",
    intro: [
      "Another catered tray of sandwiches isn't a team event — it's lunch with an agenda. A hibachi chef cooking live, with fire and games, gives a team something to react to together, which is the entire point of gathering people who usually only share a Slack channel.",
      "Weekday events are our sweet spot: Monday–Thursday bookings with 15+ people qualify for the $45.90/person Weekday Special, and daytime slots are usually easy to get.",
    ],
    moments: [
      {
        title: "The icebreaker that isn't forced",
        description:
          "Nobody has to do trust falls. The show gives every department the same thing to laugh at, and the games pull in the quiet ones naturally.",
      },
      {
        title: "The launch-night flame",
        description: "Shipping something? Time the flame finale to the toast. It photographs better than a conference room.",
      },
      {
        title: "Zero logistics for the organizer",
        description:
          "Setup, cooking, show, cleanup — all handled. The person who booked it gets to attend it, which is rare in corporate event planning.",
      },
    ],
    photos: [
      {
        src: "/gallery/real-hibachi-party-los-angeles-fresh-cooking-05.jpg",
        alt: "Hibachi chef cooking on the griddle at a catered event",
      },
      {
        src: "/gallery/real-hibachi-party-los-angeles-group-dinner-09.jpg",
        alt: "Large group dinner with hibachi chef service",
      },
      {
        src: "/gallery/real-hibachi-party-riverside-sunset-flame-20.jpg",
        alt: "Sunset hibachi flame show at a Southern California event",
      },
    ],
    video: {
      src: "/videos/hibachi-show.mp4",
      poster: "/videos/posters/hibachi-show.jpg",
      alt: "Live hibachi chef show",
    },
    reviews: [
      {
        name: "David Armstrong",
        text: "Chef Bling curated a brilliant display of culinary mastery and phenomenal vibes to create an forgettable evening for the bros and I. 2 thumbs up.",
      },
      {
        name: "Karen Wertheimer",
        text: "Just had a wonderful dinner prepared by Blue. He was engaging and entertaining. I would recommend this for any occasion.",
      },
    ],
    faqs: [
      {
        question: "Can you invoice the company and work with our office building?",
        answer:
          "Yes. We handle headcount changes gracefully, and the quote you approve is the price. For the venue we just need an outdoor spot for the grill — an office patio, courtyard, or parking area works; coordinate with your building and we'll confirm the setup from a photo.",
      },
      {
        question: "Do weekday corporate events get a discount?",
        answer:
          "Monday–Thursday events with 15+ guests qualify for the Weekday Special: $45.90/person instead of $59.90. Same food, same show — corporate events are exactly what that tier is for.",
      },
      PRICE_FAQ,
    ],
  },
]

occasionPages.push(...EXTRA_OCCASIONS)

export function getOccasionPage(slug: string): OccasionPage | undefined {
  return occasionPages.find((page) => page.slug === slug)
}

export function getOtherOccasions(slug: string): OccasionPage[] {
  return occasionPages.filter((page) => page.slug !== slug)
}
