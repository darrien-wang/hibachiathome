// 同一条评价换了个 key 进来时怎么认出来（2026-10-09 接 Google 商家资料 API 时抽出来）。
//
// 一条 Google 评价在台账里可能挂着三种 key：Maps 页面的 data-review-id（agent 拉的）、
// Places API 的 review id（g2_ 前缀）、商家资料 API 的 reviewId（gbp_ 前缀）。
// import / refresh 的 fuzzyFilter 和商家资料同步用的是同一套规则，台账不会因为
// 换了来源就多一行、多算一次钱：
//   · 同评价人 + 正文前 25 字相同（Google 一个账号只能评一家店一次，重名双评正文必不同）
//   · 没正文的：同评价人 + 日期相差 ≤ 3 天
// 商家资料 API 是全量的权威来源，同步时在前后各多一道（只在 planGbpSync 里用）：
//   · 最先：行上已经记着这条的 gbp_review_id，或者 external_key 就是这个 id
//   · 最后：名字唯一——Google 那边这个名字只出现一次、台账里也只剩一条没对上的同名行。
//     接住"日期是按 '3 个月前' 倒推出来的"老评价（±3 天对不上）。
// 这里只做纯计算，不碰数据库，测试直接喂数组。

export const normText = (v: string | null | undefined) => (v ?? "").toLowerCase().replace(/\s+/g, " ").trim()

/** 正文签名：评价人 + 正文前 25 字（规整过空白和大小写）。 */
export const bodySig = (reviewer: string | null | undefined, body: string | null | undefined) => `${normText(reviewer)}|${normText(body).slice(0, 25)}`

/** 两个 YYYY-MM-DD 相差不超过 days 天。 */
export const nearDays = (a: string | null | undefined, b: string | null | undefined, days = 3) =>
  !!a && !!b && Math.abs(Date.parse(a) - Date.parse(b)) <= days * 86400000

const dayGap = (a: string | null, b: string | null) => (a && b ? Math.abs(Date.parse(a) - Date.parse(b)) : Number.POSITIVE_INFINITY)

/** 匿名评价的名字不能当身份用。 */
const ANONYMOUS = new Set(["", "a google user", "google user", "anonymous"])

/**
 * Google 会把非英文评价写成 "(Translated by Google) <英文>\n\n(Original)\n<原文>"
 * （也见过原文在前的写法）。存原样；比对时三种写法都试。
 */
export function commentVariants(comment: string | null | undefined): string[] {
  const raw = (comment ?? "").trim()
  if (!raw) return []
  const out = [raw]
  const tFirst = /^\(Translated by Google\)\s*([\s\S]*?)\s*\(Original\)\s*([\s\S]*)$/i.exec(raw)
  if (tFirst) out.push(tFirst[1].trim(), tFirst[2].trim())
  else {
    const oFirst = /^([\s\S]*?)\s*\(Translated by Google\)\s*([\s\S]*)$/i.exec(raw)
    if (oFirst && oFirst[1].trim()) out.push(oFirst[1].trim(), oFirst[2].trim())
  }
  return [...new Set(out.filter(Boolean))]
}

export type LedgerRow = {
  id: string
  external_key: string
  gbp_review_id: string | null
  reviewer: string | null
  review_date: string | null
  body: string | null
  /** 挂着奖励的行优先对上：台账里万一已经有重复行，钱在哪行就认哪行 */
  bonus_id?: string | null
}

export type GbpLite = {
  reviewId: string
  reviewer: string | null
  /** createTime 换成洛杉矶日期 */
  date: string | null
  comment: string | null
}

export type LinkRule = "id" | "key" | "body" | "date" | "name"
export type GbpPlan = {
  links: Array<{ rowId: string; reviewId: string; rule: LinkRule }>
  /** Google 上有、台账里没有 */
  fresh: string[]
  /** 新的里面，台账恰好有没对上的同名行——多半真是新的（常见名），但预演时要人看一眼 */
  suspects: Array<{ reviewId: string; rowIds: string[] }>
  /** 台账里有、Google 上已经没有（被删了，或者当初抓错）——只报不删，上面可能挂着钱 */
  missing: string[]
}

/** 几行都对得上时取哪行：挂着钱的优先，其次日期最近的。 */
function best(hits: LedgerRow[], date: string | null): LedgerRow {
  return [...hits].sort((a, b) => Number(!!b.bonus_id) - Number(!!a.bonus_id) || dayGap(a.review_date, date) - dayGap(b.review_date, date))[0]
}

/**
 * 商家资料 API 拉回来的全部评价 vs 台账里的 Google 行。
 * 分轮做、强规则先：每一轮只看还没对上的，一行最多对一条，免得弱规则先把行抢走。
 */
export function planGbpSync(rows: LedgerRow[], reviews: GbpLite[]): GbpPlan {
  const links: GbpPlan["links"] = []
  const takenRows = new Set<string>()
  const doneReviews = new Set<string>()
  const link = (rowId: string, reviewId: string, rule: LinkRule) => {
    links.push({ rowId, reviewId, rule })
    takenRows.add(rowId)
    doneReviews.add(reviewId)
  }
  const openRows = () => rows.filter((r) => !takenRows.has(r.id))
  const openReviews = () => reviews.filter((v) => !doneReviews.has(v.reviewId))

  // 1) 早就对上过的：gbp_review_id 一致
  const byGbpId = new Map(rows.filter((r) => r.gbp_review_id).map((r) => [r.gbp_review_id as string, r]))
  for (const v of reviews) {
    const r = byGbpId.get(v.reviewId)
    if (r && !takenRows.has(r.id)) link(r.id, v.reviewId, "id")
  }
  // 已经挂了别的 gbp id 的行，不再参与模糊匹配（它对应的是另一条，那条要么在上面对上了，要么被删了）
  const fuzzyPool = () => openRows().filter((r) => !r.gbp_review_id)

  // 2) external_key 恰好就是这个 id（同一套 id 的话一步到位）
  for (const v of openReviews()) {
    const keys = new Set([v.reviewId, `g2_${v.reviewId}`, `gbp_${v.reviewId}`])
    const r = fuzzyPool().find((x) => keys.has(x.external_key))
    if (r) link(r.id, v.reviewId, "key")
  }

  // 3) 评价人 + 正文前 25 字（台账里万一有重复行，对上挂钱的那行，另一行进 missing 报出来）
  for (const v of openReviews()) {
    const sigs = new Set(commentVariants(v.comment).map((c) => bodySig(v.reviewer, c)))
    if (!sigs.size) continue
    const hits = fuzzyPool().filter((x) => x.body && sigs.has(bodySig(x.reviewer, x.body)))
    if (hits.length) link(best(hits, v.date).id, v.reviewId, "body")
  }

  // 4) 没正文：评价人 + 日期 ±3 天（取日期最近的那条）
  for (const v of openReviews()) {
    if (v.comment?.trim() || ANONYMOUS.has(normText(v.reviewer))) continue
    const hits = fuzzyPool().filter((x) => normText(x.reviewer) === normText(v.reviewer) && nearDays(x.review_date, v.date))
    if (hits.length) link(best(hits, v.date).id, v.reviewId, "date")
  }

  // 5) 名字唯一（两边都只有这一个人）
  const googleNames = new Map<string, number>()
  for (const v of reviews) googleNames.set(normText(v.reviewer), (googleNames.get(normText(v.reviewer)) ?? 0) + 1)
  for (const v of openReviews()) {
    const n = normText(v.reviewer)
    if (ANONYMOUS.has(n) || googleNames.get(n) !== 1) continue
    const hits = fuzzyPool().filter((x) => normText(x.reviewer) === n)
    if (hits.length === 1) link(hits[0].id, v.reviewId, "name")
  }

  const fresh = openReviews()
  return {
    links,
    fresh: fresh.map((v) => v.reviewId),
    suspects: fresh
      .map((v) => ({ reviewId: v.reviewId, rowIds: ANONYMOUS.has(normText(v.reviewer)) ? [] : fuzzyPool().filter((x) => normText(x.reviewer) === normText(v.reviewer)).map((x) => x.id) }))
      .filter((s) => s.rowIds.length > 0),
    missing: rows.filter((r) => !takenRows.has(r.id)).map((r) => r.id),
  }
}
