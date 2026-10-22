// Layer-2 self-test: Reddit through Monid and the Facebook public-post slot
// (2026-10-21). A Monid listing row becomes the same post the RSS path makes;
// on Facebook a person asking stays and a business selling goes.
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { facebookCandidates, facebookDropReason, facebookToPost } from "../lib/reddit-watch/facebook"
import { postsFromMonid } from "../lib/reddit-watch/fetch"

test("reddit via monid · listing rows become the posts the rest of the pipeline knows", () => {
  const posts = postsFromMonid({
    data: {
      nextCursor: "cur_x",
      posts: [
        { author: "a1", createdUtc: 1792645855, id: "1xc9pw1", nsfw: false, permalink: "/r/orangecounty/comments/1xc9pw1/x/", selftext: "", subreddit: "orangecounty", title: "7 Orange County parents charged", url: "https://ktla.com/news/x" },
        { author: "a2", createdUtc: 1792645000, id: "1xc9pw2", nsfw: true, permalink: "/r/LosAngeles/comments/1xc9pw2/y/", subreddit: "LosAngeles", title: "nsfw thing" },
        { author: "a3", createdUtc: 1792645000, id: "t3_1xc9pw3", permalink: "https://www.reddit.com/r/sgv/comments/1xc9pw3/z/", subreddit: "sgv", title: "hibachi at home?", selftext: "anyone know a chef who comes to the house in Arcadia?" },
        { author: "a4", createdUtc: 1792645000, id: "1xc9pw4", subreddit: "sgv" },
      ],
    },
  })
  assert.deepEqual(posts.map((p) => p.id), ["t3_1xc9pw1", "t3_1xc9pw3"])
  assert.equal(posts[0].url, "https://www.reddit.com/r/orangecounty/comments/1xc9pw1/x/", "the permalink, not the linked article")
  assert.equal(posts[0].postedAt, "2026-10-22T05:10:55.000Z")
  assert.equal(posts[0].body, "")
  assert.equal(posts[1].url, "https://www.reddit.com/r/sgv/comments/1xc9pw3/z/")
  assert.equal(posts[1].body, "anyone know a chef who comes to the house in Arcadia?")
  assert.deepEqual(postsFromMonid({ found: false, data: null }), [])
})

test("facebook · a person asking stays, a business selling goes", () => {
  const now = Date.parse("2026-10-22T06:00:00Z")
  const fresh = 1792645855
  const promo = facebookToPost({
    id: "1571031045063475",
    authorName: "Let's Hibachi",
    authorUrl: "https://www.facebook.com/letshibachi",
    createdUtc: fresh,
    url: "https://www.facebook.com/letshibachi/posts/x",
    text: "Office holiday party still on the to-do list? A Let's Hibachi chef brings the grill and cooks live for your team. We serve Los Angeles and 30+ other US cities. What date is your team aiming for?\nhttps://letshibachi.com/x\n#losangeles #hibachicatering #hibachichef",
  })
  assert.ok(promo)
  assert.equal(promo.id, "fb_1571031045063475")
  assert.equal(promo.subreddit, "facebook")
  assert.equal(promo.author, "Let's Hibachi")
  assert.ok(promo.title.startsWith("Office holiday party") && !promo.title.includes("\n"), "title is the first line")
  assert.equal(promo.postedAt, "2026-10-22T05:10:55.000Z")
  assert.equal(facebookDropReason(promo, now), "competitor")

  const biz = { ...promo, id: "fb_2", author: "Sunset Hibachi Catering", title: "Backyard hibachi parties in Pasadena", body: "Backyard hibachi parties in Pasadena, message us for a quote" }
  assert.equal(facebookDropReason(biz, now), "business")
  const link = { ...promo, id: "fb_3", author: "Maria Lopez", title: "Loved our chef!", body: "Loved our chef! Book at https://example.com" }
  assert.equal(facebookDropReason(link, now), "promo")
  const statement = { ...promo, id: "fb_4", author: "Maria Lopez", title: "We had hibachi at home in Pasadena last night", body: "We had hibachi at home in Pasadena last night and it was amazing" }
  assert.equal(facebookDropReason(statement, now), "not_ask")
  const ask = { ...promo, id: "fb_5", author: "Maria Lopez", title: "Anyone know a hibachi chef that comes to your house?", body: "Anyone know a hibachi chef that comes to your house? Birthday in Pasadena next month" }
  assert.equal(facebookDropReason(ask, now), null)
  const elsewhere = { ...ask, id: "fb_6", body: "Anyone know a hibachi chef that comes to your house? Birthday in Boston next month" }
  assert.equal(facebookDropReason(elsewhere, now), "geo")
  const old = { ...ask, id: "fb_7", postedAt: "2026-10-10T00:00:00.000Z" }
  assert.equal(facebookDropReason(old, now), "old")
  const unrelated = { ...promo, id: "fb_8", author: "Maria Lopez", title: "Anyone know a good plumber in Pasadena?", body: "Anyone know a good plumber in Pasadena?" }
  assert.equal(facebookDropReason(unrelated, now), "offtopic")

  const picked = facebookCandidates([promo, biz, link, statement, ask, elsewhere, old, unrelated], now)
  assert.deepEqual(picked.candidates.map((c) => c.id), ["fb_5"])
  assert.equal(picked.candidates[0].source, "facebook")
  assert.equal(picked.candidates[0].tier, 1)
  assert.deepEqual(picked.dropped, { competitor: 1, business: 1, promo: 1, not_ask: 1, geo: 1, old: 1, offtopic: 1 })
  assert.equal(facebookToPost({ id: "9", text: "", url: "https://www.facebook.com/x" }), null, "no text, nothing to classify")
})
