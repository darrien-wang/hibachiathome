import assert from "node:assert/strict"
import { test } from "node:test"

import { pickShareMedia, shareFileName, sharePlan } from "../lib/album-share"

const ctx = { title: "Tommy's Party", shareLink: "https://www.realhibachi.com/album/viewonly1234" }

test("Instagram and TikTok get the file, never a link", () => {
  for (const p of ["instagram", "tiktok"] as const) {
    const plan = sharePlan(p, ctx)
    assert.equal(plan.kind, "file")
    if (plan.kind === "file") {
      assert.equal(plan.prefer, "video")
      assert.ok(!plan.caption.includes("http"))
      assert.ok(plan.caption.startsWith("Tommy's Party"))
    }
  }
})

test("link platforms carry only the look-only link", () => {
  for (const p of ["facebook", "x", "whatsapp", "messages"] as const) {
    const plan = sharePlan(p, ctx)
    assert.equal(plan.kind, "open")
    if (plan.kind === "open") assert.ok(decodeURIComponent(plan.url).includes(ctx.shareLink), p)
  }
  assert.deepEqual(sharePlan("copy", ctx), { kind: "copy", text: ctx.shareLink })
  assert.ok(sharePlan("facebook", ctx).kind === "open" && (sharePlan("facebook", ctx) as { url: string }).url.startsWith("https://www.facebook.com/sharer/"))
})

test("media pick: party video, then first video, then first photo", () => {
  const items = [
    { kind: "photo" as const, url: "p1" },
    { kind: "video" as const, url: "v1" },
  ]
  assert.deepEqual(pickShareMedia(items, "party.mp4", "video"), { url: "party.mp4", kind: "video" })
  assert.deepEqual(pickShareMedia(items, null, "video"), { url: "v1", kind: "video" })
  assert.deepEqual(pickShareMedia([{ kind: "photo", url: "p1" }], null, "video"), { url: "p1", kind: "photo" })
  assert.equal(pickShareMedia([], null, "video"), null)
})

test("file names read like the party", () => {
  assert.equal(shareFileName("Tommy's Party", "video", "video/mp4"), "tommy-s-party.mp4")
  assert.equal(shareFileName("Sophia's Sweet 16", "photo", "image/jpeg"), "sophia-s-sweet-16.jpg")
})
