"use client"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { faqItems } from "@/config/faq"

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

export default function FAQClientPage() {
  const topObjections = [
    {
      title: "What if weather changes on event day?",
      answer:
        "If weather is uncertain, we can provide a complimentary tent for the chef setup. If you still need to cancel for weather, notify us at least 72 hours in advance for a full deposit refund.",
    },
    {
      title: "How does cancellation/reschedule work?",
      answer:
        "You can cancel or reschedule with at least 72 hours notice for a full deposit refund. Changes made inside 72 hours may make the deposit non-refundable because staff and ingredients are already allocated.",
    },
    {
      title: "Can you handle allergies and dietary restrictions?",
      answer:
        "Yes. We can accommodate common dietary restrictions when informed in advance. Please include allergy details during booking so the chef can prepare safely.",
    },
  ]

  return (
    <section className="page-container container grid items-center justify-center gap-6 pb-10">
      <div className="mx-auto max-w-[980px] text-center">
        <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl">Frequently Asked Questions</h1>
        <p className="mx-auto max-w-[700px] text-gray-500 md:text-xl dark:text-gray-400">
          Everything you need to know about our hibachi service.
        </p>
      </div>
      <div className="w-full max-w-[980px] space-y-3">
        <h2 className="text-2xl font-bold">Top Booking Concerns (Answered)</h2>
        {topObjections.map((item) => (
          <div key={item.title} className="rounded-lg border bg-white p-4">
            <h3 className="font-semibold text-gray-900 mb-1">{item.title}</h3>
            <p className="text-gray-700 text-sm">{item.answer}</p>
          </div>
        ))}
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
          Still have questions? Call or text us at{" "}
          <a href="tel:2137707788" className="text-amber-600 hover:text-amber-700 font-medium">
            (213) 770-7788
          </a>{" "}
        </p>
      </div>
    </section>
  )
}
