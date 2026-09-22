// Reddit 监听（/api/admin/reddit-watch）的配置：抓哪些版块、全站搜什么词。
// 只有"发现"，没有任何自动回帖——命中的帖子进 reddit_mentions，人看了再回。
//
// 版块按组合并成一次请求（Reddit 支持 r/a+b+c 多版块流），每组一次请求拿最新
// 100 帖。组别别拆太细：请求越少越不容易被 Reddit 限流。

export type RedditWatchGroup = { name: string; subs: string[] }

export const REDDIT_WATCH_GROUPS: RedditWatchGroup[] = [
  {
    // 投放城市：LA 县 + 橙县
    name: "la-oc",
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
    // 内陆帝国 + Ventura + 度假目的地 + 场合类版块
    name: "ie-destinations-occasions",
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

/** 全站搜索（只在有 Reddit API 凭据时跑）：抓不在名单里的版块，再用南加地名过滤。 */
export const REDDIT_GLOBAL_SEARCH = { query: "hibachi", limit: 50 }

/** 超过这个时长的旧帖不再入库（首次跑不会把一个月的旧帖全倒进来）。 */
export const REDDIT_MAX_POST_AGE_HOURS = 72

/** Reddit 要求可辨识的 UA；拿 API 凭据后也不用改。 */
export const REDDIT_USER_AGENT = "web:com.realhibachi.reddit-watch:v1.0 (by Real Hibachi, support@realhibachi.com)"
