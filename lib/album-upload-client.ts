"use client"

// Browser half of a party-album upload, shared by the guest page and the
// workbench (staff seeding): make a small JPEG preview on the device, then PUT
// the file and the preview straight to the signed storage URLs.

/** A 480px JPEG preview, so the album grid never pulls the full files. */
export async function makeThumb(file: Blob, kind: "photo" | "video"): Promise<Blob | null> {
  const draw = (src: CanvasImageSource, w: number, h: number) => {
    if (!w || !h) return null
    const scale = Math.min(1, 480 / Math.max(w, h))
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(w * scale)
    canvas.height = Math.round(h * scale)
    const ctx = canvas.getContext("2d")
    if (!ctx) return null
    ctx.drawImage(src, 0, 0, canvas.width, canvas.height)
    return new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.8))
  }
  const url = URL.createObjectURL(file)
  try {
    if (kind === "photo") {
      const img = new Image()
      img.decoding = "async"
      img.src = url
      await img.decode()
      return await draw(img, img.naturalWidth, img.naturalHeight)
    }
    const video = document.createElement("video")
    video.muted = true
    video.playsInline = true
    video.preload = "metadata"
    video.src = url
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve()
      video.onerror = () => reject(new Error("video"))
      setTimeout(() => reject(new Error("timeout")), 8000)
    })
    video.currentTime = Math.min(1, (video.duration || 2) / 2)
    await new Promise<void>((resolve, reject) => {
      video.onseeked = () => resolve()
      setTimeout(() => reject(new Error("timeout")), 8000)
    })
    return await draw(video, video.videoWidth, video.videoHeight)
  } catch {
    return null
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function putToSignedUrl(url: string, body: Blob, type: string, onProgress?: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("PUT", url)
    xhr.setRequestHeader("content-type", type)
    xhr.setRequestHeader("x-upsert", "false")
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total)
    }
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`upload ${xhr.status}`)))
    xhr.onerror = () => reject(new Error("network"))
    xhr.send(body)
  })
}

type Slot = { path: string; url: string; thumbPath: string | null; thumbUrl: string | null }

/**
 * One file end to end. `slot` and `done` are the two server calls (guest API or
 * admin API); returns the local preview URL the caller can show right away.
 */
export async function uploadAlbumFile(
  file: File,
  type: string,
  hooks: {
    slot: (args: { type: string; size: number; thumb: boolean }) => Promise<Slot>
    done: (args: { path: string; thumbPath: string | null }) => Promise<unknown>
    onPreview?: (url: string) => void
    onProgress?: (p: number) => void
  },
): Promise<void> {
  const kind = type.startsWith("video/") ? "video" : "photo"
  const thumb = await makeThumb(file, kind)
  if (hooks.onPreview) {
    if (thumb) hooks.onPreview(URL.createObjectURL(thumb))
    else if (kind === "photo") hooks.onPreview(URL.createObjectURL(file))
  }
  const slot = await hooks.slot({ type, size: file.size, thumb: !!thumb })
  await putToSignedUrl(slot.url, file, type, (p) => hooks.onProgress?.(Math.max(0.02, p * 0.97)))
  let thumbPath: string | null = null
  if (thumb && slot.thumbUrl && slot.thumbPath) {
    try {
      await putToSignedUrl(slot.thumbUrl, thumb, "image/jpeg")
      thumbPath = slot.thumbPath
    } catch {
      /* the full file made it; the grid falls back to it */
    }
  }
  await hooks.done({ path: slot.path, thumbPath })
  hooks.onProgress?.(1)
}
