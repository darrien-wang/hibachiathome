# Machine-written texts in the leads voice (owner 2026-10-29: "都按建议改，然后上线")

Rewritten (lib/first-response.ts, lib/missed-call.ts, lib/customers.ts, scripts/desk/desk.py):

- template A: `Hi, it's Rowling from Real Hibachi. Our system was supposed to text you a price and didn't, sorry. For 15 adults in Anaheim it's $838.50 Fri-Sun or $763.50 Mon-Thu, no travel fee. Each guest gets 2 proteins, fried rice, veggies, salad and the chef show. What date are you thinking?`
  (app/api/admin/sms-thread SAYS_NO_PRICE_WAS_SENT also reads "supposed to text you a price", so the 5-minute template-A brake still sees it)
- 72h: `Hi Ana, it's Rowling from Real Hibachi. Your party is Saturday the 24th at 3:30 PM at 10756 McLennan Ave. Reply YES if everything's still set, or tell me what changed.`
- 24h: `Hi Carlos, it's Rowling. Just making sure we're set for tomorrow at 6:30 PM at 5556 Myrtle Ave. Could you reply so I know you got this?`
- bill: `Hi Matthew, it's Bling from Real Hibachi. Hope the party's going well. Whenever you're ready to settle up, your bill is here and you can pay by card: <link> Cash to your chef works too.`
- missed call: `Real Hibachi: sorry we missed your call. Text your date and city here and we'll answer right away.`
- returning-customer drafts: em dashes out
- desk order remind / order send: no parenthesis, no "charged by Stripe", no " - " splice

One ruler: config/voice-rules.json, read by desk.py voice_check and lib/voice-check.ts.
tests/voice-check.test.ts runs every machine text through it and also
requires no emoji and no " - " in them (they go to every customer word for word).

`npm test`: 344 pass, 2 fail - tests/meta-pixel-lead.test.ts and
tests/referrer-source.test.ts, failing the same way before this change.
`selfcheck.py`: all passed.
