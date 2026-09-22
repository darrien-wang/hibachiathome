// 监听器自检（不联网）：npx tsx scripts/reddit-watch-selftest.ts [已存的 .rss 文件...]
// 1) 用一组已知帖子标题检查分级；2) 传入 .rss 文件时检查 Atom 解析。
import { readFileSync } from "node:fs"
import { classifyPost } from "@/lib/reddit-watch/match"
import { parseAtom } from "@/lib/reddit-watch/fetch"

const cases: Array<[number, string, string]> = [
  [1, "Anyone have recommendations on a private chef for a birthday?", "Looking for recommendations for a family birthday (my wife so it has gotta be good)"],
  [1, "Anyone tried the mobile backyard hibachi catering setups in HB", "Honest reviews wanted. I'm planning my husband's 40th birthday..."],
  [1, "Backyard Hibachi Vendors", ""],
  [1, "Taquizas or backyard hibachi services in the area?", ""],
  [1, "Looking for a chef who can come to our Airbnb in Palm Springs", "group of 12, one dinner"],
  [2, "Best hibachi restaurant in OC?", "want a good benihana style place for dinner"],
  [2, "catering for my daughter's quinceañera", "about 80 people in the backyard, any recs?"],
  [2, "What should I do for my wife's 40th birthday party", "something different, we've done restaurants"],
  [0, "Blackstone griddle for sale", "barely used"],
  [0, "Traffic on the 60 this morning", "what happened?"],
  [0, "Hibachi Express hiring cooks", "now hiring for our Lakewood location"],
]
let bad = 0
for (const [want, title, body] of cases) {
  const got = classifyPost(title, body)
  const ok = got.tier === want
  if (!ok) bad++
  console.log(`${ok ? "ok " : "BAD"} want=${want} got=${got.tier} [${got.keywords.join(",")}] ${title}`)
}
for (const file of process.argv.slice(2)) {
  const posts = parseAtom(readFileSync(file, "utf8"))
  const tiers = { 0: 0, 1: 0, 2: 0 } as Record<number, number>
  for (const p of posts) tiers[classifyPost(p.title, p.body).tier]++
  console.log(`\n${file}: ${posts.length} posts parsed, tiers=${JSON.stringify(tiers)}`)
  for (const p of posts.slice(0, 2)) console.log(JSON.stringify({ id: p.id, sub: p.subreddit, author: p.author, at: p.postedAt, url: p.url, title: p.title, body: p.body.slice(0, 120) }))
  for (const p of posts) { const m = classifyPost(p.title, p.body); if (m.tier) console.log(`  [tier ${m.tier}] r/${p.subreddit} · ${p.title} · ${m.keywords.join(",")}`) }
}
process.exit(bad ? 1 : 0)
