import { NextResponse } from "next/server"
import { DEPOSIT_AMOUNT } from "@/config/pricing-rules"
import { SITE } from "@/lib/ai-facts"

// The booking interface for AI agents, described as OpenAPI 3.1 so Codex,
// Claude, ChatGPT actions and similar tools can call it without reading our
// JavaScript (决策日志 D-0917-06). Linked from /llms.txt and /for-ai.
export const revalidate = 3600

const err = { $ref: "#/components/schemas/Error" }

const spec = {
  openapi: "3.1.0",
  info: {
    title: "Real Hibachi booking API for AI agents",
    version: "1.0.0",
    description: [
      "Private hibachi chef at home in Southern California. Use these endpoints to check a date, get an exact price, and, with the customer's permission, request a quote that we text and email to them.",
      `Agents never take payment: the customer pays a $${DEPOSIT_AMOUNT.toFixed(2)} refundable deposit through the link we send them.`,
      `Business facts in plain text: ${SITE}/llms.txt. People can also call or text (213) 770-7788.`,
    ].join("\n\n"),
    contact: { name: "Real Hibachi", email: "support@realhibachi.com", url: SITE },
  },
  servers: [{ url: SITE }],
  paths: {
    "/api/quote/slot-availability": {
      get: {
        operationId: "checkDate",
        summary: "Check which start times are open on a date",
        parameters: [{ name: "date", in: "query", required: true, schema: { type: "string", format: "date" }, example: "2026-10-17" }],
        responses: {
          "200": {
            description: "Open start times (local Pacific time) for the date.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    date: { type: "string", format: "date" },
                    remaining: { type: "integer", description: "Parties we can still take that day" },
                    slots: {
                      type: "array",
                      items: { type: "object", properties: { time: { type: "string", example: "16:00" }, available: { type: "boolean" } } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/agent/price": {
      get: {
        operationId: "getPrice",
        summary: "Exact price for a party",
        description: "Same rules the website and our quotes use: per-guest rate, Weekday Special (Mon-Thu), party size discount, $599 minimum, travel past 50 driving miles. Gratuity and add-ons are extra.",
        parameters: [
          { name: "adults", in: "query", required: true, schema: { type: "integer", minimum: 1 }, description: "Guests 13 and older" },
          { name: "kids", in: "query", schema: { type: "integer", minimum: 0 }, description: "Ages 5-12" },
          { name: "under5", in: "query", schema: { type: "integer", minimum: 0 }, description: "Under 5, eat free" },
          { name: "date", in: "query", schema: { type: "string", format: "date" }, description: "Event date; decides whether the Weekday Special applies" },
          { name: "zip", in: "query", schema: { type: "string", pattern: "^\\d{5}$" }, description: "Event ZIP for the exact travel fee" },
        ],
        responses: {
          "200": { description: "Price breakdown in USD. `customQuote: true` for parties of 31+.", content: { "application/json": { schema: { type: "object" } } } },
          "400": { description: "Invalid input", content: { "application/json": { schema: err } } },
          "429": { description: "Too many requests" },
        },
      },
    },
    "/api/agent/quote-request": {
      post: {
        operationId: "requestQuote",
        summary: "Send the customer their exact quote and a deposit link",
        description:
          "Only call this when the customer asked you to and agreed to be contacted. We text and email them the exact price and a secure deposit link, and a real person follows up by text. Limited to 2 requests per phone number per hour.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "phone", "email", "adults", "customerConsent"],
                properties: {
                  name: { type: "string", description: "Customer's name" },
                  phone: { type: "string", description: "Customer's US mobile number; the quote is texted here", example: "+13105550123" },
                  email: { type: "string", format: "email" },
                  adults: { type: "integer", minimum: 1 },
                  kids: { type: "integer", minimum: 0, description: "Ages 5-12" },
                  under5: { type: "integer", minimum: 0 },
                  date: { type: "string", format: "date" },
                  zip: { type: "string", pattern: "^\\d{5}$" },
                  city: { type: "string" },
                  notes: { type: "string", maxLength: 600, description: "Occasion, allergies, setup space, preferred start time, anything else" },
                  agent: { type: "string", maxLength: 40, description: "Your name, e.g. ChatGPT, Claude, Codex" },
                  customerConsent: { type: "boolean", const: true, description: "true = the customer asked for this quote and agreed to texts and email from Real Hibachi" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Sent to the customer.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean" },
                    total: { type: "number" },
                    textedToCustomer: { type: "boolean" },
                    emailedToCustomer: { type: "boolean" },
                    depositUrl: { type: "string", description: "The customer's own deposit link; share only with them" },
                    message: { type: "string" },
                  },
                },
              },
            },
          },
          "400": { description: "Missing or invalid field (see `error`)", content: { "application/json": { schema: err } } },
          "429": { description: "Too many requests, or a quote already went to this number in the last hour", content: { "application/json": { schema: err } } },
        },
      },
    },
  },
  components: {
    schemas: {
      Error: {
        type: "object",
        properties: { ok: { type: "boolean", const: false }, error: { type: "string" }, message: { type: "string" } },
      },
    },
  },
}

export function GET() {
  return NextResponse.json(spec, { headers: { "Cache-Control": "public, max-age=3600", "Access-Control-Allow-Origin": "*" } })
}
