# Real Hibachi UTM Attribution Rules

Updated: 2026-06-02

## Goal

Reduce fake "direct" traffic by tagging controllable links before they enter the quote flow. The default booking link for owned, partner, and paid channels is:

```text
https://www.realhibachi.com/quoteA
```

Every controllable external link should include at least:

```text
utm_source
utm_medium
utm_campaign
```

Use lowercase snake_case. Do not put customer names, phone numbers, emails, or private notes in URLs.

## Standard Patterns

| Channel | Source | Medium | Campaign | Content example |
| --- | --- | --- | --- | --- |
| Instagram bio | `instagram` | `social_profile` | `owned_2026_booking` | `bio` |
| Instagram story | `instagram` | `social_story` | `owned_2026_booking` | `story_booking` |
| SMS follow-up | `sms` | `sms` | `owned_2026_booking` | `manual_followup` |
| SMS deposit follow-up | `sms` | `sms` | `owned_2026_booking` | `deposit_followup` |
| Support chat | `livechat` | `chat` | `owned_2026_booking` | `support_quote_link` |
| Email signature | `email` | `email` | `owned_2026_booking` | `signature` |
| Email booking follow-up | `email` | `email` | `owned_2026_booking` | `booking_followup` |
| Google Ads | `google` | `cpc` | `la_search_clean_leads` | `{creative}` |
| Partner links | `partner_{partner_slug}` | `referral` | `partner_2026_booking` | `{placement}` |

## Approved Links

Instagram bio:

```text
https://www.realhibachi.com/quoteA?utm_source=instagram&utm_medium=social_profile&utm_campaign=owned_2026_booking&utm_content=bio
```

Instagram story:

```text
https://www.realhibachi.com/quoteA?utm_source=instagram&utm_medium=social_story&utm_campaign=owned_2026_booking&utm_content=story_booking
```

SMS manual follow-up:

```text
https://www.realhibachi.com/quoteA?utm_source=sms&utm_medium=sms&utm_campaign=owned_2026_booking&utm_content=manual_followup
```

SMS deposit follow-up:

```text
https://www.realhibachi.com/quoteA?utm_source=sms&utm_medium=sms&utm_campaign=owned_2026_booking&utm_content=deposit_followup
```

Support chat quote link:

```text
https://www.realhibachi.com/quoteA?utm_source=livechat&utm_medium=chat&utm_campaign=owned_2026_booking&utm_content=support_quote_link
```

Email signature:

```text
https://www.realhibachi.com/quoteA?utm_source=email&utm_medium=email&utm_campaign=owned_2026_booking&utm_content=signature
```

Email booking follow-up:

```text
https://www.realhibachi.com/quoteA?utm_source=email&utm_medium=email&utm_campaign=owned_2026_booking&utm_content=booking_followup
```

Google Ads final URL or final URL suffix pattern:

```text
https://www.realhibachi.com/quoteA?utm_source=google&utm_medium=cpc&utm_campaign=la_search_clean_leads&utm_term={keyword}&utm_content={creative}
```

Partner link template:

```text
https://www.realhibachi.com/quoteA?utm_source=partner_{partner_slug}&utm_medium=referral&utm_campaign=partner_2026_booking&utm_content={placement}
```

## Reporting Rules

True direct traffic should mean: the session is Direct and there is no `utm_source`, `utm_medium`, `utm_campaign`, `gclid`, `wbraid`, or `gbraid` attached to the session or conversion.

Weekly reports should break traffic into:

- True direct
- Owned tagged traffic: Instagram, SMS, live chat, email
- Paid search: Google Ads
- Organic search: Google, Bing, and other engines
- AI referral: `chatgpt.com / referral` and similar answer-engine referrals
- Partner referral

## Operating Notes

Do not change historical UTM names after launch unless there is a real reporting problem. If a new channel is needed, add it to `config/utm-rules.json` first, then use that exact source, medium, campaign, and content pattern in the live link.

Google Ads auto-tagging can still use `gclid`. The UTM pattern above is for readable reporting and cross-system consistency. If Google Ads final URL suffix is used instead of putting UTMs directly in the landing URL, keep the same parameter names and values.
