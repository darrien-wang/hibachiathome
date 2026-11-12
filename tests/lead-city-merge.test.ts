// Layer-2 self-test: a lead keeps the first city it was given, unless that was only the landing
// page's region label and the customer has since typed a town or a ZIP.
// 2026-11-12 Victoria left her number on the home estimator ("Southern California") and wrote the
// contact form 95 seconds later with 90275; the lead kept the label and the desk card read
// "路费未算: 线索无 zip".
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { mergeCityOrZip } from "../lib/leads"

test("lead city · a typed ZIP or town replaces the landing page's region label", () => {
  assert.equal(mergeCityOrZip("Southern California", "90275"), "90275")
  assert.equal(mergeCityOrZip("LA & Orange County", "Tustin"), "Tustin")
  assert.equal(mergeCityOrZip("socal", " 92590 "), "92590")
})

test("lead city · everything else keeps the first value", () => {
  // A town the customer typed first is theirs: a later page's label or another town does not replace it.
  assert.equal(mergeCityOrZip("Palm Springs", "92262"), "Palm Springs")
  assert.equal(mergeCityOrZip("91748", "Southern California"), "91748")
  assert.equal(mergeCityOrZip("Temecula", "LA & Orange County"), "Temecula")
  // One region label does not replace another, and nothing typed does not blank what is there.
  assert.equal(mergeCityOrZip("Southern California", "LA & Orange County"), "Southern California")
  assert.equal(mergeCityOrZip("Southern California", undefined), "Southern California")
  assert.equal(mergeCityOrZip("Southern California", "   "), "Southern California")
})

test("lead city · an empty lead takes what arrives", () => {
  assert.equal(mergeCityOrZip(null, "90275"), "90275")
  assert.equal(mergeCityOrZip("  ", "Southern California"), "Southern California")
  assert.equal(mergeCityOrZip(undefined, undefined), undefined)
})
