// Live captions for the softphone.
//
// The customer's audio is already in the browser — WebRTC delivered it so the
// agent could hear it — so we tap that track directly instead of forking the
// audio at Twilio. That avoids a media-stream WebSocket server (which Vercel's
// serverless runtime cannot host anyway) and keeps the audio out of our
// infrastructure entirely: it goes browser -> OpenAI and nowhere else.
//
// An LLM-based model is the point here, not an implementation detail. Classic
// speech engines match phonemes and emit noise when the accent is unfamiliar;
// a model that carries the earlier turns as context can infer the word that was
// probably meant, which is the whole reason these captions exist.

export type CaptionLine = {
  id: string
  /** "them" is the customer; "you" is the agent. */
  speaker: "them" | "you"
  text: string
  translation?: string
  final: boolean
}

export type CaptionHandle = {
  stop: () => void
}

type StartOptions = {
  track: MediaStreamTrack
  speaker: CaptionLine["speaker"]
  adminKey: string
  onLine: (line: CaptionLine) => void
  onError: (message: string) => void
  /** Connection progress, so a silent panel can say which step it is stuck on. */
  onStatus?: (status: string) => void
}

// Utterance ids arrive from the API; prefix them so the two directions of a
// call cannot collide in the caption list.
function lineId(speaker: string, itemId: string): string {
  return `${speaker}:${itemId}`
}

export async function startLiveCaptions({
  track,
  speaker,
  adminKey,
  onLine,
  onError,
  onStatus,
}: StartOptions): Promise<CaptionHandle> {
  const label = speaker === "them" ? "客户" : "本机"
  const status = (text: string) => onStatus?.(`${label}：${text}`)

  status("取令牌…")
  const tokenRes = await fetch("/api/admin/realtime-token", {
    headers: { "x-admin-key": adminKey },
  })
  if (!tokenRes.ok) {
    const body = (await tokenRes.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? `令牌获取失败 (${tokenRes.status})`)
  }
  const { value: ephemeralKey, model } = (await tokenRes.json()) as {
    value: string
    model: string
  }

  const pc = new RTCPeerConnection()
  let stopped = false

  pc.addEventListener("connectionstatechange", () => {
    if (stopped) return
    status(`连接 ${pc.connectionState}`)
    if (pc.connectionState === "failed") {
      onError("字幕连接失败（WebRTC 未能建立）")
    }
  })

  // The mic/customer track is the only thing we send; nothing comes back as
  // audio, transcripts arrive on the data channel.
  pc.addTrack(track)

  const events = pc.createDataChannel("oai-events")

  events.addEventListener("open", () => {
    status("已连接，等待说话")
    // The session has to be told what to do once the channel is up. Configuring
    // it only when minting the token is not enough — without this the session
    // happily accepts audio and transcribes nothing, which looks exactly like a
    // broken microphone from the outside.
    events.send(
      JSON.stringify({
        type: "session.update",
        session: {
          type: "transcription",
          audio: {
            input: {
              // gpt-live-transcribe segments speech itself and rejects a
              // turn_detection block outright.
              transcription: { model },
            },
          },
        },
      })
    )
  })

  const partials = new Map<string, string>()

  const translate = async (id: string, text: string) => {
    try {
      const res = await fetch("/api/admin/translate", {
        method: "POST",
        headers: { "content-type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) return
      const { text: translation } = (await res.json()) as { text?: string }
      if (translation && !stopped) {
        onLine({ id, speaker, text, translation, final: true })
      }
    } catch {
      // A missing translation is survivable — the transcript is still on screen.
    }
  }

  events.addEventListener("message", (event) => {
    let payload: Record<string, any>
    try {
      payload = JSON.parse(event.data as string)
    } catch {
      return
    }

    const type = payload.type as string | undefined
    if (!type) return

    // Every event type is logged: when captions stay empty this is the only way
    // to tell "nothing arrived" from "something arrived under another name".
    if (typeof console !== "undefined") {
      console.debug("[captions]", speaker, type)
    }

    // Delta event names have moved between revisions of this API; match on the
    // shape that matters rather than one exact string.
    const isTranscript = type.includes("input_audio_transcription")
    if (isTranscript && type.endsWith(".delta")) {
      const itemId = String(payload.item_id ?? payload.id ?? "")
      const id = lineId(speaker, itemId)
      const next = (partials.get(id) ?? "") + String(payload.delta ?? "")
      partials.set(id, next)
      onLine({ id, speaker, text: next, final: false })
      return
    }

    if (isTranscript && (type.endsWith(".completed") || type.endsWith(".done"))) {
      const itemId = String(payload.item_id ?? payload.id ?? "")
      const id = lineId(speaker, itemId)
      const text = String(payload.transcript ?? payload.text ?? partials.get(id) ?? "").trim()
      partials.delete(id)
      if (!text) return
      onLine({ id, speaker, text, final: true })
      void translate(id, text)
      return
    }

    if (type === "error") {
      const detail = payload.error?.message ?? JSON.stringify(payload.error ?? payload)
      console.error("[captions] session error", detail)
      onError(`字幕出错：${detail}`)
    }
  })

  status("协商中…")
  const offer = await pc.createOffer()
  await pc.setLocalDescription(offer)

  const sdpRes = await fetch("https://api.openai.com/v1/realtime/calls", {
    method: "POST",
    body: offer.sdp,
    headers: {
      Authorization: `Bearer ${ephemeralKey}`,
      "Content-Type": "application/sdp",
    },
  })
  if (!sdpRes.ok) {
    const detail = await sdpRes.text().catch(() => "")
    pc.close()
    throw new Error(`字幕连接被拒绝 (${sdpRes.status}) ${detail.slice(0, 200)}`)
  }

  await pc.setRemoteDescription({ type: "answer", sdp: await sdpRes.text() })

  return {
    stop: () => {
      stopped = true
      try {
        events.close()
      } catch {
        // Already closed with the peer connection.
      }
      pc.close()
    },
  }
}
