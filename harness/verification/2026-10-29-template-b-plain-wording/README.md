# Template B plain wording (owner 2026-10-29, leads voice.md)

`npm test`: 338 pass, 2 fail. The two failures (`tests/meta-pixel-lead.test.ts`,
`tests/referrer-source.test.ts`) fail identically on the branch before this
change (checked with `git stash`), unrelated to this commit.

New template B (`lib/first-response.ts quoteFollowUpPlan`):
- dated, within 14 days: `Hi, it's Rowling from Real Hibachi. Sunday the 18th is open for the 15 of you in Palm Springs. What's the celebration?`
- dated, beyond: `... Saturday, May 15 is open for the 30 of you in San Diego. What's the celebration?`
- no date: `... Saw your quote for 10 in Temecula. What's the celebration?`
- count unknown: `... Saw your quote. What's the celebration?`

`lib/caller-card.ts FOR_N` now reads "for the 15 of you" as a headcount of 15
(caller-card test extended).
