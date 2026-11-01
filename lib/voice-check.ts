// What makes a customer text read like an AI support bot (owner 2026-10-29,
// .claude/skills/leads/voice.md). The lists are config/voice-rules.json, the
// same file `desk send` reads (scripts/desk/desk.py voice_check), so a
// machine-written text and a hand-written one are held to one ruler.
//
// This side only checks a text on its own - the rules that need the
// conversation (a name given twice, a line said twice, the same opener as
// our last text) live in desk, where the thread is. tests/voice-check.test.ts
// runs every text the code writes through it.

import rules from "@/config/voice-rules.json"

const alt = (list: string[]) => list.join("|")
const HI = String.raw`^(?:hi\b[^.!?]{0,40}?[-,.!]\s*)?`
const OPENER = new RegExp(`${HI}(?:${alt(rules.openers)})\\b`, "i")
const SPLICE_OPENER = new RegExp(`${HI}(?:${alt(rules.reactionOpeners)}) - `, "i")
const YOUR_N = new RegExp(
  String.raw`\b(?:for|of|with|and|is|plan for) your (\d{1,3})\b` +
    String.raw`(?!\s*(?:[:%/+]|-year|(?:am|pm|th|st|nd|rd|` + alt(rules.headcountNouns) + String.raw`)\b))`,
  "i",
)
const BANNED = new RegExp(`\\b(?:${alt(rules.banned)})\\b`, "i")
// A request with no "please" (owner 2026-11-01: "Tell me if anyone needs
// something different" is not how we speak to a customer). "Please tell me",
// "Could you tell me" and "You can text me" pass; "Reply STOP" is the law.
const VERB = String.raw`(?:${alt(rules.bareImperatives)})\b(?![-'])(?!\s+(?:stop|works?|is|was)\b)`
const IMPERATIVE = new RegExp(
  String.raw`(?:^|[.!?:]\s+|\n\s*)(?:(?:hi|hey|hello)\b[^.!?,]{0,30},\s*|(?:if|when|once|whenever)\b[^.!?]{0,80}?,\s*)?(?:just\s+)?${VERB}|,\s*just\s+${VERB}`,
  "i",
)
const CASUAL = new RegExp(`\\b(?:${alt(rules.casualAsks)})\\b`, "i")
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu

export type VoiceHit = { level: "stop" | "note"; rule: string; detail: string }

const count = (text: string, part: string) => text.split(part).length - 1

/** The tells in one text, sure ones ("stop") first; [] = clean. */
export function voiceHits(body: string): VoiceHit[] {
  const b = (body ?? "").trim()
  const hits: VoiceHit[] = []
  const add = (level: VoiceHit["level"], rule: string, detail: string) => hits.push({ level, rule, detail })
  if (b.includes("—")) add("stop", "em_dash", "—")
  if (count(b, "!") > rules.limits.bangs) add("stop", "bangs", `${count(b, "!")} "!"`)
  const emoji = b.match(EMOJI)?.length ?? 0
  if (emoji > rules.limits.emoji) add("stop", "emoji", `${emoji} emoji`)
  const opener = OPENER.exec(b)
  if (opener) add("stop", "opener", opener[0].trim())
  const yourN = YOUR_N.exec(b)
  if (yourN) add("stop", "your_n", yourN[0])
  const banned = BANNED.exec(b)
  if (banned) add("stop", "banned", banned[0])
  const imperative = IMPERATIVE.exec(b)
  if (imperative) add("stop", "imperative", imperative[0].trim())
  const casual = CASUAL.exec(b)
  if (casual) add("note", "casual", casual[0])
  if (count(b, " - ") > rules.limits.splices) add("note", "splices", `${count(b, " - ")} " - "`)
  const splice = SPLICE_OPENER.exec(b)
  if (splice) add("note", "splice_opener", splice[0].trim())
  if (b.includes("(")) add("note", "parenthesis", "(")
  return hits
}
