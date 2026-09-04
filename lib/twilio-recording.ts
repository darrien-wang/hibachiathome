// Call recording, gated behind an explicit opt-in env var.
//
// California is a two-party consent state (Penal Code 632): recording without
// telling every party is a crime as well as a civil liability. The notice and
// the recording are therefore produced by the same helper — if recording is
// off, the notice is empty; if it is on, callers always hear it first. Keeping
// them in one place is deliberate: they must never drift apart.

export const RECORDING_NOTICE =
  "Just so you know, this call may be recorded for quality and training purposes."

// Dual-channel keeps caller and agent on separate tracks, which is what makes a
// recording actually reviewable (and transcribable) afterwards.
export function recordingAttributes(): string {
  if (process.env.TWILIO_RECORD_CALLS !== "true") return ""
  const base = ` record="record-from-answer-dual"`
  const callback = process.env.NEXT_PUBLIC_BASE_URL
    ? ` recordingStatusCallback="${process.env.NEXT_PUBLIC_BASE_URL}/api/twilio/recording" recordingStatusCallbackMethod="POST"`
    : ""
  return base + callback
}

export function isRecordingEnabled(): boolean {
  return process.env.TWILIO_RECORD_CALLS === "true"
}
