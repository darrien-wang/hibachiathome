// Verbatim 5-star Google reviews (owner-supplied screenshots, 2026-08).
// Shared by the quote page, city pages, and occasion pages. Never invent one;
// quotes may be truncated (…) but not rewritten. Two are cut before alcohol
// mentions to keep the site A2P/CTIA-clean.

export type GoogleReview = {
  name: string
  text: string
}

export const GOOGLE_REVIEWS: GoogleReview[] = [
  {
    name: "Spencer Sprowls",
    text: "Bling is an amazing chef!! He makes the party 100x better and will make amazing food for you.",
  },
  {
    name: "Kelsey Molnar",
    text: "Real Hibachi is such a fun experience! I decided to hire for my sisters 30th bday and it was an absolute success! We had Chef Bling and he was a riot and so sweet! I told him it was a surprise and he made it SO FUN! HIGHLY RECOMMEND, HIGHLY AFFORDABLE, so delicious…",
  },
  {
    name: "David Armstrong",
    text: "Chef Bling curated a brilliant display of culinary mastery and phenomenal vibes to create an forgettable evening for the bros and I. 2 thumbs up.",
  },
  {
    name: "Warren Zhang",
    text: "Bling was a great chef and also very personable! He made our night and it was my birthday! Best night ever!",
  },
  {
    name: "Lisa Craven",
    text: "Chef blue was absolutely amazing!!! Super friendly and personable. So fun and interactive. Knew how to switch it up between adults and kids. Food was delicious and he was great! Highly recommend !",
  },
  {
    name: "Laura Gallop",
    text: "Chef Bling and Chef Noodle was great! Very entertaining and food was delicious.",
  },
  {
    name: "Max Schwenk",
    text: "Unbelievable experience! Bling was the best chef ever!",
  },
  {
    name: "Judy Gothelf",
    text: "What a great experience having Blue as our chef! Aside from the fact that he made delicious food, he was so much fun and so engaging! We loved having him here to celebrate our friend's BIG birthday!",
  },
  {
    name: "Karen Wertheimer",
    text: "Just had a wonderful dinner prepared by Blue. He was engaging and entertaining. I would recommend this for any occasion.",
  },
  {
    name: "Beatrix Barrera",
    text: "Chef John was our personal chef and he was sooooo much fun. I highly recommend requesting for him because aside from the delicious food, there was so much laughing because of him. 5 stars for the service, 5 stars for the food, 5 stars for Chef John! Definitely will do this again!",
  },
]

// Stable per-page rotation so every city page shows a different-but-consistent
// trio and the whole corpus gets crawled across the site.
export function pickReviews(seed: string, count = 3): GoogleReview[] {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0
  }
  const start = Math.abs(hash) % GOOGLE_REVIEWS.length
  return Array.from({ length: Math.min(count, GOOGLE_REVIEWS.length) }, (_, i) => {
    return GOOGLE_REVIEWS[(start + i) % GOOGLE_REVIEWS.length]
  })
}
