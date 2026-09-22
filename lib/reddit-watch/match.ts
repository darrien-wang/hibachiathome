// 判断一条 Reddit 帖子值不值得人去回。
//
//   tier 1  直接的需求：hibachi / teppanyaki / 私厨 / "有没有厨师能来家里做"
//   tier 2  相邻的需求：在找派对餐饮（catering + 生日/后院/单身派对…），
//           或"派对怎么办才有意思"；以及只聊餐厅的 hibachi 帖（可看可不回）
//   tier 0  无关
//
// 规则是纯正则，故意保守：宁可多进列表让人跳过，也不要漏掉一条真询问。

export type MatchTier = 0 | 1 | 2
export type MatchResult = { tier: MatchTier; keywords: string[] }

const TIER1: Array<[string, RegExp]> = [
  ["hibachi", /\bh[ia]bachi\b/i],
  ["teppanyaki", /\btepp?anyaki\b/i],
  ["private chef", /\bprivate chef\b/i],
  ["personal chef", /\bpersonal chef\b/i],
  ["home chef", /\b(?:in|at)[- ]?home chef\b/i],
  ["mobile chef", /\bmobile chef\b/i],
  ["chef come", /\bchef (?:who |that |to )?(?:can |could |will |would )?(?:come|cook)s? (?:to|at|over|out|in)\b/i],
]

// "best hibachi restaurant in OC?" 是餐厅话题，不是上门需求。
const RESTAURANT_TALK = /\b(restaurant|steakhouse|benihana|shogun|buffet|sushi|happy hour|dine[- ]in|takeout|delivery)\b/i
const AT_HOME = /\b(home|house|backyard|back yard|patio|airbnb|vrbo|rental|cabin|come to|comes to|come out|mobile|private|cater\w*|party|event|hire|book)\b/i

const TIER2_FOOD = /\b(cater(?:ing|er|ers|ed)?|food truck|taquiza|taco (?:cart|guy|man|lady|truck)|paella|pizza truck|food for (?:a|the|my|our|about|around)|feed(?:ing)? (?:about |around |like )?\d+)\b/i
const TIER2_OCCASION = /\b(birthday|b-?day|party|parties|backyard|bachelorette|bachelor|graduation|anniversary|reunion|baby shower|bridal shower|quincea\w*|wedding|rehearsal dinner|retirement|celebrat\w*|dinner for \d+|\d{1,3} (?:people|guests|ppl|adults))\b/i
const TIER2_IDEAS = /\b(party ideas|dinner ideas|fun ideas|something (?:fun|different) (?:to do|for)|what (?:to|should (?:i|we)) do for (?:a|my|our|his|her|dad'?s|mom'?s|wife'?s|husband'?s)\b[^.?!\n]{0,40}(?:birthday|anniversary|party))\b/i
const EXCLUDE = /\b(for sale|selling my|hiring|now hiring|job (?:opening|posting|listing)|recipe|griddle|blackstone|health inspection|got sick|food poisoning)\b/i
// "Reception dinner for 45", "group of 20 looking for a spot": a big group
// wanting one meal is our customer even when nobody typed "catering".
const GROUP_MEAL = /\b(?:dinner|lunch|brunch|meal|reservation|table|spot|place)\s+for\s+(?:~|about |around |like |roughly |up to )?(\d{1,3})\b|\b(?:group|party) of\s+(?:~|about |around |up to )?(\d{1,3})\b/i
const MIN_GROUP = 8

const SOCAL = /\b(los angeles|l\.a\.|socal|southern california|california|orange county|san diego|inland empire|riverside|san bernardino|palm springs|coachella|joshua tree|big bear|temecula|santa barbara|ventura|malibu|pasadena|long beach|irvine|anaheim|huntington beach|torrance|burbank|glendale|santa monica|hollywood|san gabriel|san fernando|idyllwild|la quinta|palm desert)\b/i

export function classifyPost(title: string, body: string): MatchResult {
  const text = `${title}\n${body}`.slice(0, 6000)
  // Job ads, gear for sale and recipes mention hibachi all the time; none of
  // them is someone looking to hire a chef, so they lose before tier 1 wins.
  if (EXCLUDE.test(text)) return { tier: 0, keywords: [] }
  const hits = TIER1.filter(([, re]) => re.test(text)).map(([label]) => label)
  if (hits.length) {
    if (RESTAURANT_TALK.test(text) && !AT_HOME.test(text)) return { tier: 2, keywords: [...hits, "restaurant talk"] }
    return { tier: 1, keywords: hits }
  }
  const food = TIER2_FOOD.exec(text)?.[0]
  const occasion = TIER2_OCCASION.exec(text)?.[0]
  if (food && occasion) return { tier: 2, keywords: [food.toLowerCase(), occasion.toLowerCase()] }
  const group = GROUP_MEAL.exec(text)
  const groupSize = group ? Number(group[1] ?? group[2]) : 0
  if (groupSize >= MIN_GROUP) return { tier: 2, keywords: [`group of ${groupSize}`, ...(occasion ? [occasion.toLowerCase()] : [])] }
  const ideas = TIER2_IDEAS.exec(text)?.[0]
  if (ideas) return { tier: 2, keywords: [ideas.toLowerCase().slice(0, 40)] }
  return { tier: 0, keywords: [] }
}

/** 全站搜索命中的帖子只有提到南加地名（或发在南加版块）才留。 */
export function looksSoCal(subreddit: string, title: string, body: string, knownSubs: Set<string>): boolean {
  if (knownSubs.has(subreddit.toLowerCase())) return true
  return SOCAL.test(`${subreddit} ${title}\n${body}`)
}
