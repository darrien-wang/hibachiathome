import { pricing } from "@/config/pricing"

// Shared FAQ content: rendered on /faq and emitted as FAQPage JSON-LD so
// search engines and AI assistants read exactly what users see.
export const faqItems = [
  {
    question: "How much does your hibachi experience cost?",
    answer: `Base rate: $${pricing.packages.basic.perPerson} per guest (minimum $${pricing.packages.basic.minimum} total)

Gratuity: We recommend 20% of the final bill

Travel fee: May apply depending on your location; exact amount disclosed during booking

Payment options:
- Cash (preferred)
- Credit card (4% processing fee)
- Venmo/Zelle (no fee)

If using credit card, payment must be settled at least 72 hours before your event.`,
  },
  {
    question: "Can you provide tables and chairs?",
    answer:
      "Yes! We offer table, chair, and tablecloth rental at $10 per person. Utensils are not included in this package. If you need utensils, we can provide them for an additional $5 per person. If you'd rather supply your own tables, chairs, and utensils, that's fine too—just let us know in advance.",
  },
  {
    question: "When will the chef arrive?",
    answer:
      "Your chef will pull up about 10 minutes before the start time you chose. Setup is very quick, so we'll be ready with the grill and ingredients moments later.",
  },
  {
    question: "Do you cook indoors?",
    answer:
      "All cooking is done outdoors—on patios, balconies, decks or under tents/awnings. (Feel free to arrange seating indoors, but our grill stays outside.) We're fully licensed and insured.",
  },
  {
    question: "Do you use nuts or sesame?",
    answer:
      "We cannot promise a nut-free or sesame-free table, and we would rather say so than guess. Our sauces and gyoza are commercial products: the gyoza contain sesame, and one of our sauces is made in a facility that also handles peanuts. Both sauces contain egg. Tell your booking agent about any allergy and we will check the labels of the products in use for your date and tell you honestly whether we can serve that guest safely.",
  },
  {
    question: "Can you handle gluten-free guests?",
    answer:
      "Absolutely. We've served many gluten-free diners. Just bring your preferred gluten-free soy and teriyaki sauces, and we'll prepare their meal on a separate station.",
  },
  {
    question: "What about vegetarians or vegans?",
    answer:
      "We're happy to accommodate special dietary needs:\n\n- Vegetarian options include tofu and extra vegetables\n- Vegan meals can be prepared with plant-based ingredients\n- All special dietary meals are prepared at the same per-person rate\n\nPlease let us know about any dietary requirements when booking.",
  },
  {
    question: "Can guests bring their own protein?",
    answer: "For safety and pricing consistency, we ask that all proteins be provided by us. Thanks for understanding!",
  },
  {
    question: "How do I make a reservation?",
    answer:
      "Booking is simple and straightforward:\n\n- Get an instant quote at www.realhibachi.com\n- Select your preferred date and package\n- Provide your guest count and contact information\n- Confirm your booking with a deposit\n\nFor parties of any size, you only need to make a single reservation. We'll arrange the appropriate number of chefs based on your guest count.",
  },
  {
    question: "What is your cancellation policy?",
    answer:
      "Our cancellation policy includes the following terms:\n\n- 72 hours' notice required for cancellations or reschedules to receive a full deposit refund\n- Changes made inside 72 hours may make the deposit non-refundable\n- For rainy days, plan on a 10'x10' pop-up tent over the chef's station — you provide it, we do not supply tents\n- If you still need to cancel due to weather, please let us know at least 72 hours beforehand",
  },
]
