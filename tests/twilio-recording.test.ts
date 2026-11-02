import assert from "node:assert/strict"
import { test } from "node:test"

import { recordingAttributes } from "../lib/twilio-recording"

// Every route plays the notice only when this returns attributes, so an empty
// answer means no recording and no notice, which is what the customer asked for.
test("recording: ordinary calls are recorded, a customer who asked for confidentiality is not", () => {
  const was = process.env.TWILIO_RECORD_CALLS
  process.env.TWILIO_RECORD_CALLS = "true"
  try {
    assert.match(recordingAttributes("+12135550100"), /record="record-from-answer-dual"/)
    assert.match(recordingAttributes(), /record="record-from-answer-dual"/)
    assert.equal(recordingAttributes("+15037564281"), "")
    assert.equal(recordingAttributes(" +15037564281 "), "")
  } finally {
    if (was === undefined) delete process.env.TWILIO_RECORD_CALLS
    else process.env.TWILIO_RECORD_CALLS = was
  }
})
