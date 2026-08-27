// Quote builder feature flags.
//
// History: /quoteA and /quoteB used to be two routes rendering the same
// QuoteBuilderClient with a `variant` prop. The experiment behind them
// ("quote_route_split_v1") never actually ran:
//   - lib/ab-testing.ts never registered the experiment, so nothing assigned
//     visitors to a variant
//   - every internal link hardcoded /quoteA, so /quoteB got zero traffic
//   - the events it emitted used `quote_variant` while the funnel report reads
//     `variant_id`, so even the collected data was unreadable
//
// The routes are now consolidated into /quote. Variant B's only real feature
// was the scarcity block below, which survives here as a plain flag.

/**
 * Show the "Only N prime slots left for this date and time" block with an
 * inline booking-request button under the estimated total.
 */
export const QUOTE_SLOTS_URGENCY_ENABLED = true

/**
 * Attribution value written to `source` when the quote builder hands off to
 * the deposit flow. Must stay in the allowlists in lib/booking-number.ts and
 * app/api/deposit/start/route.ts.
 */
export const QUOTE_SOURCE = "quote"
