// Real party photos and clips from /gallery and /videos. Shared by the quote
// page and the ad landing pages (city / catering / mobile / private chef):
// paid visitors need one glance of proof this is a real local operation
// before they read a price. Add only media from real Real Hibachi parties.

export type ProofMedia =
  | { type: "video"; src: string; poster: string; alt: string }
  | { type: "image"; src: string; alt: string }

export const PROOF_MEDIA: ProofMedia[] = [
  {
    type: "video",
    src: "/videos/hibachi-show.mp4",
    poster: "/videos/posters/hibachi-show.jpg",
    alt: "Live hibachi chef show",
  },
  {
    type: "image",
    src: "/gallery/real-hibachi-party-orange-county-family-event-04.jpg",
    alt: "Real Hibachi chef cooking fresh eggs on the griddle at an Orange County family event",
  },
  {
    type: "video",
    src: "/videos/fried-rice.mp4",
    poster: "/videos/posters/fried-rice.jpg",
    alt: "Fresh hibachi fried rice on the griddle",
  },
  {
    type: "image",
    src: "/gallery/real-hibachi-party-southern-california-dinner-06.jpg",
    alt: "Happy guests with their Real Hibachi chef at a Southern California pool party",
  },
  {
    type: "video",
    src: "/videos/real-fire.mp4",
    poster: "/videos/posters/real-fire.jpg",
    alt: "Real hibachi fire show",
  },
  {
    type: "video",
    src: "/videos/birthday-moment.mp4",
    poster: "/videos/posters/birthday-moment.jpg",
    alt: "Birthday cake moment at a Real Hibachi party",
  },
  {
    type: "image",
    src: "/gallery/real-hibachi-party-orange-county-night-fire-show-18.jpg",
    alt: "Huge hibachi flame lighting up a night party in Orange County",
  },
  {
    type: "image",
    src: "/gallery/real-hibachi-party-santa-barbara-oceanfront-sunset-16.jpg",
    alt: "Oceanfront sunset hibachi party table with lanterns and roses in Santa Barbara",
  },
  {
    type: "video",
    src: "/gallery/real-hibachi-party-malibu-beach-sunset-video-05.mp4",
    poster: "/gallery/real-hibachi-party-malibu-beach-sunset-video-05-poster.jpg",
    alt: "Oceanfront sunset hibachi dinner party with lanterns",
  },
  {
    type: "video",
    src: "/videos/party-highlight.mp4",
    poster: "/videos/posters/party-highlight.jpg",
    alt: "Party highlights from a Real Hibachi event",
  },
  {
    type: "video",
    src: "/videos/atmosphere.mp4",
    poster: "/videos/posters/atmosphere.jpg",
    alt: "The atmosphere at a Real Hibachi dinner party",
  },
]
