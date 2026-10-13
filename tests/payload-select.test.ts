import assert from "node:assert/strict"
import test from "node:test"
import { payloadColumns, payloadFrom } from "../lib/payload-select"

test("select fragment aliases each key and keeps its case", () => {
  assert.equal(payloadColumns(["Body", "NumMedia"]), "pl_Body:raw_payload_json->Body, pl_NumMedia:raw_payload_json->NumMedia")
  assert.equal(payloadColumns(["note"], "meta"), "pl_note:meta->note")
})

test("a key that could change the query is refused", () => {
  assert.throws(() => payloadColumns(["body,raw_payload_json"]))
  assert.throws(() => payloadColumns(["a->b"]))
  assert.throws(() => payloadColumns([""]))
})

test("the payload comes back with only the keys that had a value, types kept", () => {
  const row = { lead_id: "x", pl_Body: "It's at a park ", pl_NumMedia: "0", pl_tent10x10: true, pl_subject: null }
  assert.deepEqual(payloadFrom(row, ["Body", "NumMedia", "tent10x10", "subject", "snippet"]), {
    Body: "It's at a park ",
    NumMedia: "0",
    tent10x10: true,
  })
  assert.deepEqual(payloadFrom(null, ["Body"]), {})
})
