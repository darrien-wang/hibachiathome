/**
 * Can this device actually act on an `sms:` / `tel:` link?
 *
 * A desktop browser with no handler registered swallows
 * `window.location.href = "sms:..."` in silence — no error, no prompt, no
 * navigation. Nothing on screen changes, so the visitor concludes the button
 * is broken, because it is.
 *
 * On 2026-09-07 that cost a 30-guest Temecula booking (~$1,800): the visitor
 * came in on `hibachi catering temecula`, built the quote, then tapped
 * "Text us this quote" three times. Clarity logged the last two as dead
 * clicks. They left. The SMS-intent ping still fired every time, so the
 * workbench recorded "tapped but never texted" — which reads like a customer
 * with no follow-through instead of a dead button. See decision log
 * D-0908-04.
 *
 * Detection is deliberately conservative: assume the link works unless the
 * device looks like a pointer-driven desktop. Guessing "can text" when it
 * cannot only reproduces the old behaviour; guessing "cannot text" when it
 * can would push phone users into a fallback panel they do not need, and
 * phones are ~85% of paid traffic.
 */
export function deviceCanOpenSms(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return true

  const ua = navigator.userAgent || ""
  // Phones and tablets that announce themselves. iPadOS in desktop mode does
  // not, which is what the pointer test below is for.
  if (/Android|iPhone|iPad|iPod|Windows Phone|IEMobile|Mobile Safari/i.test(ua)) return true

  const coarsePointer = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches
  const touchPoints = navigator.maxTouchPoints ?? 0

  // Both, not either: a Windows laptop with a touchscreen reports touch points
  // but keeps a fine pointer, and it has no SMS app either.
  return coarsePointer && touchPoints > 0
}

/** "mobile" | "desktop", for analytics payloads. Never throws. */
export function contactDeviceLabel(): "mobile" | "desktop" {
  return deviceCanOpenSms() ? "mobile" : "desktop"
}

/**
 * Copy text to the clipboard, resolving to whether it worked.
 *
 * The async Clipboard API needs a secure context and can still be denied, so
 * fall back to the old textarea trick rather than leaving the user with a
 * button that does nothing — the exact failure mode this file exists to fix.
 */
export async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
      return true
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const area = document.createElement("textarea")
    area.value = value
    area.setAttribute("readonly", "")
    area.style.position = "fixed"
    area.style.top = "-1000px"
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand("copy")
    document.body.removeChild(area)
    return ok
  } catch {
    return false
  }
}
