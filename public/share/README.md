# Texting-sized party photos

MMS copies of the gallery originals, for texting prospects from 213-770-7788.

Carriers compress or drop MMS well before Twilio's 5 MB ceiling, so these are
capped at 1200 px / ~250 KB each — small enough that three fit in one message
and still sharp on a phone. The 3–5 MB gallery originals cannot be used here,
and the Next.js image optimizer is not available on this deployment (404).

Regenerate with PIL: thumbnail((1200,1200)), JPEG quality 76, optimize,
progressive. Keep the filenames stable — they are pasted into Twilio MediaUrl
by hand and in agent sessions.
