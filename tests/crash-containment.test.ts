// On 2026-10-27 Google rendered the global crash screen as the homepage and used
// its apology as the search snippet. A widget failing must not reach that screen,
// and if a crash does, it gets one reload and stays out of the snippet.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { reloadOnceAfterCrash } from "../lib/report-client-error"
import { QuietBoundary } from "../components/quiet-boundary"

function fakeWindow(storage: Map<string, string> | null) {
  const timers: Array<() => void> = []
  let reloads = 0
  const win = {
    location: { pathname: "/", reload: () => { reloads += 1 } },
    setTimeout: (fn: () => void) => { timers.push(fn); return 0 },
    get sessionStorage() {
      if (!storage) throw new Error("blocked")
      return { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v) }
    },
  }
  return { win, run: () => timers.forEach((fn) => fn()), reloads: () => reloads }
}

function withWindow<T>(win: unknown, fn: () => T): T {
  const scope = globalThis as { window?: unknown }
  const before = scope.window
  scope.window = win
  try {
    return fn()
  } finally {
    scope.window = before
  }
}

test("a crash reloads once for a path, then leaves the screen up", () => {
  const storage = new Map<string, string>()
  const { win, run, reloads } = fakeWindow(storage)
  assert.equal(withWindow(win, reloadOnceAfterCrash), true)
  withWindow(win, run)
  assert.equal(reloads(), 1)
  assert.equal(withWindow(win, reloadOnceAfterCrash), false)
})

test("another path gets its own reload", () => {
  const storage = new Map<string, string>([["rh_crash_reload:/quote", "1"]])
  const { win } = fakeWindow(storage)
  assert.equal(withWindow(win, reloadOnceAfterCrash), true)
})

test("no sessionStorage, no reload: nothing could stop a loop", () => {
  const { win, run, reloads } = fakeWindow(null)
  assert.equal(withWindow(win, reloadOnceAfterCrash), false)
  run()
  assert.equal(reloads(), 0)
})

test("a failed widget renders nothing", () => {
  assert.deepEqual(QuietBoundary.getDerivedStateFromError(), { failed: true })
  const boundary = new QuietBoundary({ children: "widget" })
  assert.equal(boundary.render(), "widget")
  boundary.state = { failed: true }
  assert.equal(boundary.render(), null)
})

test("everything in the root layout outside <main> sits behind a boundary", () => {
  const layout = readFileSync("app/layout.tsx", "utf8")
  const body = layout.slice(layout.indexOf("Keep client-only trackers"), layout.indexOf("</body>"))
  for (const widget of ["TrackingBootstrap", "LanguageSuggestBanner", "Header", "Footer", "Analytics"]) {
    const at = body.indexOf(`<${widget} />`)
    assert.ok(at > 0, `${widget} is in the layout`)
    assert.ok(body.lastIndexOf("<QuietBoundary>", at) > body.lastIndexOf("</QuietBoundary>", at), `${widget} is inside a QuietBoundary`)
  }
})

test("the crash screens keep a title and stay out of the snippet", () => {
  const global = readFileSync("app/global-error.tsx", "utf8")
  assert.match(global, /<title>Hibachi at Home/)
  assert.match(global, /name="description"/)
  assert.match(global, /data-nosnippet/)
  assert.match(readFileSync("app/error.tsx", "utf8"), /data-nosnippet/)
})
