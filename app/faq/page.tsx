"use client"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import Link from "next/link"

// FAQ data
const faqItems = [
  {
    question: "How much does your hibachi experience cost?",
    answer:
      "Base rate: $60 per guest (minimum $600 total)\n\nGratuity: We recommend 20% of the final bill\n\nTravel fee: May apply depending on your location; exact amount disclosed during booking\n\nPayment: Cash or credit card (4% processing fee).\n\nIf using credit card, payment must be settled at least 72 hours before your event.",
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
      "We're happy to swap in tofu—and add extra veggies, salads or noodles at no extra per-person charge. The $60 rate applies to all dietary preferences.",
  },
  {
    question: "Can guests bring their own protein?",
    answer: "For safety and pricing consistency, we ask that all proteins be provided by us. Thanks for understanding!",
  },
  {
    question: "How do I make a reservation?",
    answer:
      "Book directly on our website: www.hibachi2u.com\n\n30 or more guests? Please place two reservations for the same date/time so we can send an additional chef—at no extra charge.",
  },
  {
    question: "What is your cancellation policy?",
    answer:
      "48 hours' notice required for cancellations or reschedules\n\nLate changes incur a $200 fee\n\nRain plan: You're responsible for providing cover (e.g., tent, canopy) within 48 hours of the event. If you need to cancel due to weather, please let us know at least 48 hours beforehand.",
  },
]

export default function FAQPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold mb-4">Frequently Asked Questions</h1>
          <p className="text-xl text-gray-600">
            Have questions about our hibachi catering service? Find answers to our most commonly asked questions below.
          </p>
        </div>

        <Accordion type="single" collapsible className="mb-12">
          {faqItems.map((item, index) => (
            <AccordionItem key={index} value={`item-${index}`}>
              <AccordionTrigger className="text-lg font-medium">{item.question}</AccordionTrigger>
              <AccordionContent className="text-gray-600">{item.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Still have questions?</h2>
          <p className="text-gray-600 mb-6">
            Can't find the answer you're looking for? Feel free to reach out to our team directly.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button asChild variant="outline">
              <Link href="/contact">Contact Us</Link>
            </Button>
            <Button asChild>
              <Link href="/book">Book a Consultation</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
