// Two-line Chinese summary of a call transcript (owner 2026-10-20: "电话打过来我不知道什么情况").
//
// The App posts the live-caption transcript of every call as a 【通话记录】 note a few minutes after
// the call ends (VoiceManager call_note -> /api/admin/leads). Nobody reads a wall of captions on a
// phone, so the server boils it down to two lines and files them as a 【来电小结】 note; the inbox
// (lib/inbox.ts) shows that note as a notification for the next few hours.
//
// Line 1: who and what - party, date/time, headcount, place, price and any discount named.
// Line 2: where it landed - what we promised, what the customer will do, what needs doing next.

export const CALL_SUMMARY_PREFIX = "【来电小结】"
export const CALL_TRANSCRIPT_PREFIX = "【通话记录】"

const MODEL = process.env.OPENAI_SUMMARY_MODEL ?? process.env.OPENAI_TRANSLATE_MODEL ?? "gpt-5.6-luna"

const SYSTEM_PROMPT = [
  "You summarize phone-call transcripts for Real Hibachi, a hibachi catering company: chefs cook and perform at the customer's home or venue.",
  "The transcript is speech-to-text of an accented speaker and may be garbled; 我 is our staff, 客户 is the customer. Chinese translations in parentheses are machine translations of the same words, not extra content.",
  "Write exactly two lines in Simplified Chinese, each at most 60 characters, no preamble, no bullet markers, no quotes:",
  "Line 1: who called and what they want - occasion, date and time, headcount, city or address, price quoted, any discount or freebie named. Keep names, dates, numbers and prices exactly as said; write 未提 for anything not said.",
  "Line 2: where it landed - what we promised, what the customer said they would do, and the one next step for us. If nothing was agreed, say so.",
].join(" ")

/**
 * The two-line summary, or null when the transcript is too thin, the key is missing, or OpenAI
 * fails. Never throws: a summary is a convenience, the call note itself has already been saved.
 */
export async function summarizeCallTranscript(transcript: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY
  const text = (transcript ?? "").trim()
  if (!apiKey || text.replace(CALL_TRANSCRIPT_PREFIX, "").trim().length < 40) return null
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: text.slice(0, 12_000) },
        ],
      }),
    })
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } }
    if (!res.ok) {
      console.error("[call-summary] OpenAI refused", json?.error?.message ?? `status ${res.status}`)
      return null
    }
    const lines = (json.choices?.[0]?.message?.content ?? "")
      .split(/\r?\n/)
      .map((l) => l.replace(/^[\s\-•*·]+/, "").trim())
      .filter(Boolean)
      .slice(0, 2)
    return lines.length ? lines.join("\n") : null
  } catch (error) {
    console.error("[call-summary] failed", error)
    return null
  }
}

/** The note text as filed on the lead's timeline. */
export function callSummaryNote(summary: string): string {
  return `${CALL_SUMMARY_PREFIX}${summary}`
}
