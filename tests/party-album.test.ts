import assert from "node:assert/strict"
import { test } from "node:test"

import { seedRank, albumByLabel, albumMediaType, groupAlbumText, hostAlbumText, albumPhone, albumTitle, couponExpiry, newAlbumToken, newCouponCode, DEVICE_RE } from "../lib/party-album"

test("album title reads like a keepsake: Tommy's Party", () => {
  assert.equal(albumTitle("Tommy Lee"), "Tommy's Party")
  assert.equal(albumTitle("TOMMY"), "Tommy's Party")
  assert.equal(albumTitle("james smith"), "James' Party")
  assert.equal(albumTitle("  "), "Our Party")
  assert.equal(albumTitle(null), "Our Party")
})

test("seeds read as us, guests stay anonymous", () => {
  assert.equal(albumByLabel("staff", false), "Real Hibachi")
  assert.equal(albumByLabel("chef", false), "Real Hibachi")
  assert.equal(albumByLabel("guest", false), null)
  assert.equal(albumByLabel("guest", true), "You")
})

test("host and group texts never mention a coupon", () => {
  const link = "https://www.realhibachi.com/album/abc"
  for (const t of [hostAlbumText("Tommy", link), groupAlbumText(link)]) {
    assert.ok(t.includes(link))
    assert.ok(!/\$|coupon|off/i.test(t), t)
  }
})

test("phone: US 10-digit only", () => {
  assert.equal(albumPhone("(951) 207-0523"), "+19512070523")
  assert.equal(albumPhone("1-951-207-0523"), "+19512070523")
  assert.equal(albumPhone("123"), null)
  assert.equal(albumPhone("0512070523"), null)
})

test("media type falls back to the file extension", () => {
  assert.equal(albumMediaType("", "IMG_0001.HEIC"), "image/heic")
  assert.equal(albumMediaType("video/quicktime", "a.mov"), "video/quicktime")
  assert.equal(albumMediaType("application/pdf", "a.pdf"), null)
})

test("tokens and codes", () => {
  const t = newAlbumToken()
  assert.match(t, /^[a-z0-9]{12}$/)
  assert.match(newCouponCode(), /^RH50-[2-9A-HJ-NP-Z]{6}$/)
  assert.ok(DEVICE_RE.test("abc123def456ghi789"))
})

test("coupon lasts 12 months", () => {
  const d = couponExpiry(new Date("2026-11-23T12:00:00Z"))
  assert.equal(d.toISOString().slice(0, 10), "2027-11-23")
})

test("cover = this party's chef video (volcano first), then chef's others, then ours", () => {
  const rows = [
    { id: "staff", source: "staff", kind: "video", storage_path: "album/a/staff/1-x.mp4" },
    { id: "chefPhoto", source: "chef", kind: "photo", storage_path: "o/after-1-x.jpg" },
    { id: "chefAfter", source: "chef", kind: "video", storage_path: "o/after-2-v.mov" },
    { id: "volcano", source: "chef", kind: "video", storage_path: "o/volcano-3-v.mov" },
  ]
  assert.deepEqual(
    [...rows].sort((a, b) => seedRank(a) - seedRank(b)).map((r) => r.id),
    ["volcano", "chefAfter", "chefPhoto", "staff"],
  )
})
