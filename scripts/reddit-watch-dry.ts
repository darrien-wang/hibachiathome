// 本机干跑 Reddit 监听（不碰数据库、不发通知）：
//   npx tsx scripts/reddit-watch-dry.ts
// 有 REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET 环境变量就走官方 API，否则走公开 RSS。
import { collectCandidates } from "@/lib/reddit-watch/run"

async function main() {
  const r = await collectCandidates()
  console.log(`mode=${r.mode} fetched=${r.fetched} matched=${r.candidates.length} errors=${JSON.stringify(r.errors)}`)
  for (const c of r.candidates) {
    console.log(`[tier ${c.tier}] r/${c.subreddit} · ${c.postedAt.slice(0, 16)} · ${c.title}`)
    console.log(`         ${c.keywords.join(", ")} · ${c.url}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
