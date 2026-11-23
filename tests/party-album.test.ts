import assert from "node:assert/strict"
import { test } from "node:test"

import { albumMediaType, albumPhone, albumTitle, couponExpiry, newAlbumToken, newCouponCode, DEVICE_RE } from "../lib/party-album"

test("album title uses the host's first name", () => {
  assert.equal(albumTitle("Lisa Ramirez"), "Lisa's party")
  assert.equal(albumTitle("james smith"), "James' party")
  assert.equal(albumTitle("  "), "Your party")
  assert.equal(albumTitle(null), "Your party")
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
