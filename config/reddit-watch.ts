// Reddit 监听（/api/admin/reddit-watch）的配置：抓哪些版块、全站搜什么词。
// 只有"发现"，没有任何自动回帖——命中的帖子进 reddit_mentions，人看了再回。
//
// 版块按组合并成一次请求（Reddit 支持 r/a+b+c 多版块流），每组一次请求拿最新
// 100 帖。组别别拆太细：请求越少越不容易被 Reddit 限流。

export type RedditWatchGroup = { name: string; label: string; subs: string[] }

export const REDDIT_WATCH_GROUPS: RedditWatchGroup[] = [
  {
    // 投放城市：LA 县 + 橙县。合并流最新 100 帖约覆盖 12 小时（2026-09-22 实测）。
    name: "la-oc",
    label: "洛杉矶+橙县",
    subs: [
      "LosAngeles",
      "AskLosAngeles",
      "sgv",
      "SanFernandoValley",
      "longbeach",
      "pasadena",
      "torrance",
      "burbank",
      "santaclarita",
      "orangecounty",
      "irvine",
      "huntingtonbeach",
      "anaheim",
      "CostaMesa",
      "newportbeach",
    ],
  },
  {
    // 内陆帝国 + Ventura + 度假目的地 + 场合类版块。最新 100 帖约覆盖 25 小时。
    name: "ie-destinations-occasions",
    label: "内陆帝国+度假地+婚礼派对",
    subs: [
      "InlandEmpire",
      "Riverside",
      "Temecula",
      "venturacounty",
      "palmsprings",
      "JoshuaTree",
      "BigBear",
      "SantaBarbara",
      // r/weddingplanning 一个版就占合并流的一半且全国性，故意不收；
      // r/bachelorette 是电视节目的版，也不收。
      "Weddingsunder10k",
      "partyplanning",
      "EventPlanners",
      "catering",
    ],
  },
]

/**
 * 全国性的版块：帖子得提到南加地名才算数（"Birthday in Boston" 这种不要）。
 * 其余版块本身就是南加本地版，不用再看地名。
 */
export const REDDIT_NATIONAL_SUBS = ["Weddingsunder10k", "partyplanning", "EventPlanners", "catering"]

/**
 * 公开 RSS 模式下，线上每轮只抓"最久没抓的那一组"（一次请求）：未登录时同一 IP
 * 连发第二个请求，间隔 8 秒也会被限流（2026-09-22 实测），45–70 秒才稳。两组轮流，
 * 每组每 40 分钟抓一次，远小于它们 12/25 小时的覆盖窗口。
 * 某组连续失败这么多次（约 4 小时活跃时段）就提醒一次；夜里不跑，不算失败。
 */
export const REDDIT_FAIL_ALERT_STREAK = 6
/** 提醒之后，每再连续失败这么多次（约 12 小时）再提醒一次。 */
export const REDDIT_FAIL_REALERT_EVERY = 18
/** 本机干跑一次抓全部组时，组与组之间歇多久。 */
export const REDDIT_RSS_GAP_MS = 45_000

/** 全站搜索（只在有 Reddit API 凭据时跑）：抓不在名单里的版块，再用南加地名过滤。 */
export const REDDIT_GLOBAL_SEARCH = { query: "hibachi", limit: 50 }

/** 超过这个时长的旧帖不再入库（首次跑不会把一个月的旧帖全倒进来）。 */
export const REDDIT_MAX_POST_AGE_HOURS = 72

/** Reddit 要求可辨识的 UA；拿 API 凭据后也不用改。 */
export const REDDIT_USER_AGENT = "web:com.realhibachi.reddit-watch:v1.0 (by Real Hibachi, support@realhibachi.com)"
