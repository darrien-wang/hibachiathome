export type QuoteContactTemplateKeys = "sms" | "emailSubject" | "emailBody" | "callScript"

export type QuoteContactTemplateMap = Record<QuoteContactTemplateKeys, string>

export const defaultQuoteContactTemplates: QuoteContactTemplateMap = {
  sms: [
    "Hi Real Hibachi, I completed a quote and want to book.",
    "Date: {{event_date}}",
    "Location: {{location}}",
    "Guests: {{guest_count}} (Adults {{adults}}, Kids {{kids}})",
    "Full setup (tables/chairs/utensils): {{tableware_rental}}",
    "Upgrades: {{upgrades}}",
    "Estimated total: {{estimate_low}} - {{estimate_high}}",
  ].join(" "),
  emailSubject: "Quote Request - {{event_date}} - {{location}}",
  emailBody: [
    "Hi Real Hibachi team,",
    "",
    "I would like a confirmation for this event:",
    "- Event date: {{event_date}}",
    "- Location: {{location}}",
    "- Guests: {{guest_count}} (Adults {{adults}}, Kids {{kids}})",
    "- Tableware rental: {{tableware_rental}}",
    "- Upgrades: {{upgrades}}",
    "- Estimated total range: {{estimate_low}} - {{estimate_high}}",
    "",
    "Please confirm availability and next steps.",
    "",
    "Thank you.",
  ].join("\n"),
  callScript:
    "Hi, I am calling about a quote for {{event_date}} in {{location}}. We have {{guest_count}} guests (Adults {{adults}}, Kids {{kids}}), full setup is {{tableware_rental}}, and my estimate range is {{estimate_low}} to {{estimate_high}}.",
}

function normalizeTemplateValue(value: string | undefined, fallback: string): string {
  const normalized = value?.trim()
  return normalized ? normalized : fallback
}

export function getQuoteContactTemplates(): QuoteContactTemplateMap {
  return {
    sms: normalizeTemplateValue(process.env.NEXT_PUBLIC_QUOTE_SMS_TEMPLATE, defaultQuoteContactTemplates.sms),
    emailSubject: normalizeTemplateValue(
      process.env.NEXT_PUBLIC_QUOTE_EMAIL_SUBJECT_TEMPLATE,
      defaultQuoteContactTemplates.emailSubject,
    ),
    emailBody: normalizeTemplateValue(
      process.env.NEXT_PUBLIC_QUOTE_EMAIL_BODY_TEMPLATE,
      defaultQuoteContactTemplates.emailBody,
    ),
    callScript: normalizeTemplateValue(
      process.env.NEXT_PUBLIC_QUOTE_CALL_SCRIPT_TEMPLATE,
      defaultQuoteContactTemplates.callScript,
    ),
  }
}
