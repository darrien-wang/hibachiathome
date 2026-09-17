// Internal-traffic marker for GA4 (and Clarity).
//
// GA4 audit 2026-09-17: 54% of "Direct" sessions, 48 of the "Organic Search"
// sessions and 24 of the 54 Paid Search key events in a 28-day window came from
// the owner's own devices and from automated test browsers, so every channel
// conversion rate was being read off our own testing. GA4's built-in
// "Internal Traffic" data filter drops events whose traffic_type is "internal";
// this file is what sets that parameter.
//
// A browser counts as internal when any of these is true:
//   - it carries the rh_internal=1 cookie (set by any /admin page, or by
//     opening any page with ?rh_internal=1; ?rh_internal=0 clears it)
//   - the landing URL uses one of our test UTM sources, or utm_medium=test
//   - navigator.webdriver is true (Playwright / headless automation and most
//     JS-executing bots) - flagged for the page view only, no cookie written
//
// The snippet runs inline, ahead of the GTM bootstrap, so the gtag "set"
// command is already queued on dataLayer when GTM's Google tag starts up.
// rh_traffic_type is pushed as a plain dataLayer key too, for GTM variables.

export const INTERNAL_COOKIE_NAME = "rh_internal"
// Chrome caps cookie lifetime at 400 days.
export const INTERNAL_COOKIE_MAX_AGE_SECONDS = 400 * 24 * 60 * 60

export const INTERNAL_TEST_UTM_SOURCES = ["internal", "diag", "tagcheck", "e2e_test"] as const

export const INTERNAL_TRAFFIC_SNIPPET = `(function(){try{
var d=document,q=new URLSearchParams(location.search),p=q.get('${INTERNAL_COOKIE_NAME}');
if(p==='0'){d.cookie='${INTERNAL_COOKIE_NAME}=; Max-Age=0; path=/; SameSite=Lax';return}
var src=(q.get('utm_source')||'').toLowerCase(),med=(q.get('utm_medium')||'').toLowerCase();
var bot=navigator.webdriver===true;
var hit=p==='1'||/(?:^|; )${INTERNAL_COOKIE_NAME}=1/.test(d.cookie)||${JSON.stringify(INTERNAL_TEST_UTM_SOURCES)}.indexOf(src)>-1||med==='test'||bot;
if(!hit)return;
if(!bot)d.cookie='${INTERNAL_COOKIE_NAME}=1; Max-Age=${INTERNAL_COOKIE_MAX_AGE_SECONDS}; path=/; SameSite=Lax';
window.dataLayer=window.dataLayer||[];
(function(){window.dataLayer.push(arguments)})('set','traffic_type','internal');
window.dataLayer.push({rh_traffic_type:'internal'});
window.clarity=window.clarity||function(){(window.clarity.q=window.clarity.q||[]).push(arguments)};
window.clarity('set','traffic_type','internal');
}catch(e){}})();`
