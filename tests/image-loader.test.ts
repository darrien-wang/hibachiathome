import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import imageLoader, { LADDER, OPTIMIZED_DIRS } from "../lib/image-loader"

test("image loader: small requests get small rungs, not the 640 file", () => {
  assert.equal(imageLoader({ src: "/gallery/party.jpg", width: 96 }), "/_opt/gallery/party-160.webp")
  assert.equal(imageLoader({ src: "/images/menu/shrimp.jpg", width: 256 }), "/_opt/images/menu/shrimp-320.webp")
  assert.equal(imageLoader({ src: "/images/menu/shrimp.jpg", width: 384 }), "/_opt/images/menu/shrimp-480.webp")
  assert.equal(imageLoader({ src: "/images/hero/fire-show-hero.jpg", width: 640 }), "/_opt/images/hero/fire-show-hero-640.webp")
  assert.equal(imageLoader({ src: "/images/hero/fire-show-hero.jpg", width: 828 }), "/_opt/images/hero/fire-show-hero-960.webp")
  assert.equal(imageLoader({ src: "/images/hero/fire-show-hero.jpg", width: 3840 }), "/_opt/images/hero/fire-show-hero-1920.webp")
})

test("image loader: anything outside the three directories passes through", () => {
  assert.equal(imageLoader({ src: "/images/brand/flame.png", width: 64 }), "/images/brand/flame.png")
  assert.equal(imageLoader({ src: "https://example.com/a.jpg", width: 640 }), "https://example.com/a.jpg")
})

test("image loader: every source image has every rung on disk (a missing file is a broken image in production)", () => {
  const pub = path.join(process.cwd(), "public")
  const missing: string[] = []
  let sources = 0
  for (const dir of OPTIMIZED_DIRS) {
    for (const name of fs.readdirSync(path.join(pub, dir))) {
      const m = /^(.+)\.(?:jpe?g|png)$/i.exec(name)
      if (!m) continue
      sources++
      for (const w of LADDER) {
        const file = path.join(pub, "_opt", dir, `${m[1]}-${w}.webp`)
        if (!fs.existsSync(file)) missing.push(path.relative(pub, file))
      }
    }
  }
  assert.ok(sources > 0, "no source images found - is the test running from the repo root?")
  assert.deepEqual(missing, [], "run: python scripts/gen-opt-images.py")
})
