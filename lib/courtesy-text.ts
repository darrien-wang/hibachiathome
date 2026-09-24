// "Amazing - thank you so much!!" is not a question.
//
// The phone app already refused to ring for texts like that; the lead-watch
// sweep did not, so a booked customer's thank-you sat in the "waiting for a
// reply" list for hours and came back every renotify window (Diana Lai,
// 2026-09-24). Both now read the same rule from here — the phone and the
// sweep should never disagree about whether a customer is owed an answer.
//
// Two different jobs, deliberately kept apart:
//   - this file drops texts that say NOTHING ("thanks!", "sounds good")
//   - a lead on hold drops texts that say "the ball is mine, not yours"
//     ("will get back to you soon")
// The first version of this did both, by matching a courtesy word at the
// START of the message. That swallowed "Awesome, currently towards the 8th
// but getting a poll" — a customer telling us which date she was leaning
// toward — so the rule now has to hold for every word, not just the first.

const ACTION_WORDS =
  /\b(cancel|cancell|change|reschedul|refund|move|update|remove|address|deposit|balance|pay|price|quote|cost|guest|people|person|sake|chef|arriv|late|earl|confirm|availab|menu|allerg|vegetarian|table|chair|park|invoice|receipt|call me|text me|tomorrow|tonight|today)\w*/i
const QUESTION_WORDS = /^(when|how|what|which|where|who|can|could|would|do|does|is|are|will)\b/i

// Words that carry no information on their own. Note what is NOT here:
// "yes", "yeah", "sure", "no" — those are ANSWERS, often the most important
// message in a thread ("Yes, lock it in"), and must always reach a person.
const COURTESY = new Set([
  "ok", "okay", "k", "kk", "got", "it", "thanks", "thank", "thx", "ty", "ty!",
  "perfect", "great", "awesome", "cool", "nice", "sweet", "excellent", "fantastic",
  "lovely", "wonderful", "amazing", "super", "sounds", "good", "sound",
  "no", "problem", "np", "worries", "paid", "done", "see", "ya", "bye",
  "night", "goodnight", "morning", "love", "excited", "appreciate", "appreciated",
  "looking", "forward", "gracias", "welcome", "cheers", "ditto", "same",
])
const FILLER = new Set([
  "a", "an", "the", "and", "but", "so", "to", "for", "of", "that", "this",
  "you", "u", "your", "i", "im", "we", "my", "me", "us", "too", "very",
  "much", "really", "all", "then", "again", "hi", "hello", "hey", "yo",
  "guys", "man", "dear", "bling", "again!", "on", "in", "at", "with", "soon",
])

/**
 * True when a customer text is pure courtesy and needs no answer — every
 * single word has to be courtesy or filler, so anything with real content
 * still reaches a person.
 */
export function courtesyOnly(body: string): boolean {
  const t = (body ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s?]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
  if (!t) return true
  if (t.includes("?")) return false
  if (ACTION_WORDS.test(t) || QUESTION_WORDS.test(t)) return false
  const words = t.split(" ").filter(Boolean)
  if (words.length > 12) return false
  return words.every((w) => COURTESY.has(w) || FILLER.has(w))
}

/** Tapbacks ("Liked …"), STOP, and a bare "cancel" are not questions either. */
export function notAQuestion(body: string): boolean {
  const b = (body ?? "").trim()
  if (/^(liked|loved|laughed at|emphasized|disliked|questioned)\s/i.test(b)) return true
  if (/^(stop|unsubscribe)$/i.test(b)) return true
  // A bare "cancel" is an opt-out (2026-09-22, 用户定): nobody replies to it.
  if (/^(please\s+)?cancel(l?ed)?(\s+(it|this|that|please|the party|my party))?[.!\s]*$/i.test(b)) return true
  return courtesyOnly(b)
}
