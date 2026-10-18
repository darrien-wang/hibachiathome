// The quote wording and the staffing rule say the same number. The FAQ copy on
// the city and occasion pages spells out "one chef serves up to N guests";
// lib/dispatch-plan.ts plans chefs by GUESTS_PER_CHEF. One drifted to 20 and
// one to ~25 before this test existed.
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { GUESTS_PER_CHEF } from "../config/pricing-rules"

const FILES = ["config/city-pages.ts", "config/occasion-pages.ts", "config/occasion-city-pages.ts", "app/hibachi-catering/[city]/page.tsx"]
const PATTERNS = [
  /one chef[^.;"]{0,40}?\bup to (?:about |~)?(\d+) guests/gi,
  /second chef past (\d+) guests/gi,
  /one chef and grill per (\d+) guests/gi,
]

test(`wording · every "one chef serves up to N guests" says ${GUESTS_PER_CHEF}`, () => {
  let seen = 0
  for (const file of FILES) {
    const text = readFileSync(file, "utf8")
    for (const re of PATTERNS) {
      for (const m of text.matchAll(re)) {
        seen++
        assert.equal(Number(m[1]), GUESTS_PER_CHEF, `${file}: "${m[0]}"`)
      }
    }
  }
  assert.ok(seen >= 10, `expected the FAQ copy to state the threshold many times, found ${seen}`)
})
