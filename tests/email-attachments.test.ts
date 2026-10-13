import assert from "node:assert/strict"
import test from "node:test"
import { MAX_ATTACHMENT_BASE64, parseAttachments } from "../lib/email/attachments"

const pdf = Buffer.from("%PDF-1.7 test").toString("base64")

test("no attachments is fine", () => {
  assert.deepEqual(parseAttachments(undefined), { ok: true, attachments: [] })
  assert.deepEqual(parseAttachments(null), { ok: true, attachments: [] })
})

test("a W-9 and an insurance certificate pass through", () => {
  const r = parseAttachments([
    { filename: "W-9 Real Hibachi LLC.pdf", content: pdf },
    { filename: "Proof of Insurance_N0276GL00000300-F409420.pdf", content: pdf },
  ])
  assert.equal(r.ok, true)
  if (r.ok) assert.deepEqual(r.attachments.map((a) => a.filename), ["W-9 Real Hibachi LLC.pdf", "Proof of Insurance_N0276GL00000300-F409420.pdf"])
})

test("names that are not plain pdf/png/jpg files are refused", () => {
  for (const filename of ["../etc/passwd.pdf", "invoice.exe", "x.pdf.js", "", "a/b.pdf"]) {
    assert.equal(parseAttachments([{ filename, content: pdf }]).ok, false, filename)
  }
})

test("content must be base64, and the total has to fit a request", () => {
  assert.equal(parseAttachments([{ filename: "a.pdf", content: "not base64!" }]).ok, false)
  assert.equal(parseAttachments([{ filename: "a.pdf", content: "A".repeat(MAX_ATTACHMENT_BASE64 + 4) }]).ok, false)
  assert.equal(parseAttachments([1, 2, 3, 4].map(() => ({ filename: "a.pdf", content: pdf }))).ok, false)
  assert.equal(parseAttachments({ filename: "a.pdf" }).ok, false)
})
