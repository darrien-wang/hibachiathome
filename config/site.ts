// Site configuration
export const siteConfig = {
  name: "Real Hibachi",
  description: "Bringing the hibachi experience directly to your home or venue.",
  url: "https://realhibachi.com",
  ogImage: "https://realhibachi.com/og-image.jpg",

  // Logo configurations
  logo: {
    main: "https://www.realhibachi.com/images/logo-realhibachi.png",
    alt: "Real Hibachi Logo",
    width: 180,
    height: 60,
  },

  // Contact information
  contact: {
    // Kept for existing callers; new code should use `phone.voice` / `phone.sms`.
    phone: "213-770-7788",
    email: "support@realhibachi.com",
    locations: ["Los Angeles", "Orange County", "Beverly Hills", "Santa Monica", "Pasadena", "Irvine", "Newport Beach", "Anaheim", "Long Beach", "Burbank"],
  },

  // Social media links
  social: {
    facebook: "https://www.facebook.com/profile.php?id=61576199137704",
    instagram: "https://www.instagram.com/realhibachi/",
    twitter: "#", // Assuming twitter remains unchanged or is a placeholder
  },
}

// Two lines, on purpose.
//
// Voice runs through Twilio: calls are logged as leads, recorded, and ring the
// browser softphone and the backup handset at once. SMS does not — outbound
// A2P messaging from a 10-digit long code is blocked by the carriers until the
// 10DLC campaign is approved, so a texting number that the system replies from
// would simply fail. Texts therefore go to a separate business handset that a
// person answers by hand.
//
// Never hard-code either number again: every page, button and JSON-LD block
// reads from here, so changing a line is one edit instead of a hunt through
// two dozen files. Publish `voice` for calling and `sms` for texting — mixing
// them is what sends a customer's text into a mailbox nobody can reply from.
export const phone = {
  voice: {
    e164: "+12137707788",
    raw: "2137707788",
    display: "(213) 770-7788",
    dashed: "213-770-7788",
    tel: "tel:+12137707788",
  },
  sms: {
    e164: "+16263628824",
    raw: "6263628824",
    display: "(626) 362-8824",
    dashed: "626-362-8824",
  },
} as const

/** `sms:` link to the texting line, with an optional prefilled body. */
export function smsHref(body?: string): string {
  return body ? `sms:${phone.sms.e164}?body=${encodeURIComponent(body)}` : `sms:${phone.sms.e164}`
}

/**
 * WhatsApp link to the texting line.
 *
 * wa.me wants bare digits with the country code and no "+", which is exactly
 * the shape hand-written template literals keep getting wrong — a stray "+" or
 * a dashed number produces a link that silently goes nowhere. Build it here.
 */
export function whatsappHref(text?: string): string {
  const base = `https://wa.me/1${phone.sms.raw}`
  return text ? `${base}?text=${encodeURIComponent(text)}` : base
}
