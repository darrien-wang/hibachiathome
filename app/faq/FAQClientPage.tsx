"use client"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { pricing } from "@/config/pricing"

// Format text with paragraphs and bullet points
const formatText = (text: string) => {
  // Split text by double newlines for paragraphs
  const paragraphs = text.split("\n\n")

  return (
    <>
      {paragraphs.map((paragraph, index) => {
        // Check if paragraph contains bullet points (lines starting with - or *)
        if (paragraph.includes("\n")) {
          const lines = paragraph.split("\n")
          const hasBulletPoints = lines.some((line) => line.trim().startsWith("-") || line.trim().startsWith("•"))

          if (hasBulletPoints) {
            return (
              <div key={index} className="mb-3">
                <ul className="list-disc pl-5 space-y-1">
                  {lines.map((line, lineIndex) => {
                    const trimmedLine = line.trim()
                    // Convert lines starting with - or • to list items
                    if (trimmedLine.startsWith("-") || trimmedLine.startsWith("•")) {
                      return <li key={lineIndex}>{trimmedLine.substring(1).trim()}</li>
                    }
                    // Regular lines become paragraphs
                    return trimmedLine ? (
                      <p key={lineIndex} className="mb-2">
                        {trimmedLine}
                      </p>
                    ) : null
                  })}
                </ul>
              </div>
            )
          }
        }

        // Regular paragraph
        return (
          <p key={index} className="mb-3">
            {paragraph}
          </p>
        )
      })}
    </>
  )
}

// FAQ data
const faqItems = [
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
      "Yes! We offer table & chair rental at $15 per person. If you'd rather supply your own, that's fine too—just let us know in advance.",
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
      "No. Our recipes are free of nuts and sesame. If anyone in your party has other allergies, just inform your booking agent and we'll accommodate.",
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
      "Booking is simple and straightforward:\n\n- Visit our website: www.hibachibirthday.party\n- Select your preferred date and package\n- Provide your guest count and contact information\n- Confirm your booking with a deposit\n\nFor parties of any size, you only need to make a single reservation. We'll arrange the appropriate number of chefs based on your guest count.",
  },
  {
    question: "What is your cancellation policy?",
    answer:
      "Our cancellation policy includes the following terms:\n\n- 48 hours' notice required for cancellations or reschedules\n- Late changes incur a $100 fee\n- Weather contingency: You're responsible for providing cover (e.g., tent, canopy) within 48 hours of the event\n- If you need to cancel due to weather, please let us know at least 48 hours beforehand",
  },
]

export default function FAQClientPage() {
  return (
    <section className="container grid items-center justify-center gap-6 pt-32 pb-10">
      <div className="mx-auto max-w-[980px] text-center">
        <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl">Frequently Asked Questions</h1>
        <p className="mx-auto max-w-[700px] text-gray-500 md:text-xl dark:text-gray-400">
          Everything you need to know about our hibachi service.
        </p>
      </div>
      <Accordion type="single" collapsible className="w-full max-w-[980px]">
        {faqItems.map((item, index) => (
          <AccordionItem value={`item-${index}`} key={index}>
            <AccordionTrigger className="text-left">{item.question}</AccordionTrigger>
            <AccordionContent>{formatText(item.answer)}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      <div className="mx-auto max-w-[980px] text-center">
        <p className="text-gray-500 dark:text-gray-400">
          Still have questions? Call us at{" "}
          <a href="tel:2137707788" className="text-amber-600 hover:text-amber-700 font-medium">
            (213) 770-7788
          </a>{" "}
          or text{" "}
          <a href="sms:5627134832" className="text-amber-600 hover:text-amber-700 font-medium">
            (562) 713-4832
          </a>
        </p>
      </div>
    </section>
  )
}
