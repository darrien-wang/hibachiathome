// Shared by the <Dial action> handler (app/api/twilio/voice-status) and the
// lead-watch backstop: one text, one idempotency key, so a caller is texted
// once per missed call no matter which path notices first.

// Opens with the house signature so the SMS brakes read it as automated.
export const MISSED_CALL_TEXT =
  "Real Hibachi: sorry we missed your call - text here with your date and city and a real person answers right away."

export function missedCallTouchpointId(callSid: string): string {
  return `missed:${callSid}`
}
