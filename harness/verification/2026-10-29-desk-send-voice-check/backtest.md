# Voice check backtest (2026-10-29, before go-live)

Every text the workbench sent, 2026-09-12..10-29: 1,927 (`lead_touchpoints`
`sms_outbound`, source `workbench`). Each was checked with the thread as it
stood when it went out (our earlier texts incl. the site's automatic quote
synced from Twilio, the customer's texts before it), the same inputs `desk
send` reads. The rules were run as SQL ports of `voice_check`; the port was
checked against the Python on a 45-text sample (same hits).

## First version: 63% stopped - too strict

1,208 / 1,927 would have been stopped. The sample showed why:

| rule | stopped | problem |
|---|---|---|
| any word + " - " opener | 752 | `Yes - under 5 eat free.`, `You're right - it's...` are ordinary English |
| "your N" | 114 | `for your 16 adults and 3 kids` is ordinary English; only a bare `your 17` is not |
| "said once" | 106 | the automatic quote says "nothing charged today", so a person's first link was a "repeat" |
| same opener | 104 | `Hi, it's Bling ...` after `Hi, it's Bling ...` days apart is a greeting |
| re-intro | 12 | a customer who texts first still gets the name in our first text (SKILL §2) |

## Fixes, then two levels

- stop (exit 2 unless `--voice-ok`): em dash, 2+ "!", 2+ emoji, emotion-word
  opener, bare "your N", banned phrase, re-intro after we already gave the
  name, "said once" (not counting the automatic quote)
- note (printed, sent): 2+ " - ", a reaction word + " - " opener, a
  parenthesis, the same opener as our last text (greetings excepted)

## Result

| | texts | stopped | note only | clean |
|---|---|---|---|---|
| all | 1,927 | **380 (20%)** | 480 (25%) | 1,067 (55%) |
| via desk | 1,176 | 251 (21%) | 317 | 608 |
| workbench UI / older | 751 | 129 (17%) | 163 | 459 |

Stopped, by rule (a text can hit more than one): emotion opener 140, bare
"your N" 106, em dash 60, said once 42, banned phrase 32, 2+ "!" 28,
re-intro 6, 2+ emoji 6. Notes: parenthesis 220, 2+ " - " 251, reaction
opener 190, same opener 17.

By week, stopped: 09-14 18%, 09-21 22%, 09-28 15%, 10-05 17%, 10-12 18%,
10-19 21%, 10-26 **30%** (more "Perfect -", "!!", "we're so excited").

Samples of what is stopped (10-26..10-29): "Our pleasure - see you on the 17th! 🔥",
"We're excited too - it's going to be an amazing 30th! 🔥", "Perfect - steak and
shrimp for everyone, it's on your order! 🥩🍤", "Totally up to you! ...",
"Hi, it's Rowling - figured you're still picking a date. Which weekend are you
thinking for your 14?", "Got it - 26 it is! 🎉 ... See you Friday at 7:30!",
the hand-copied template B with "—". One borderline: "Absolutely - the card
just holds the date, nothing is charged today." answering a card question
(stopped for the opener anyway).

Only `desk send` runs the check. Texts typed in the workbench UI or the
owner's phone are not checked.
