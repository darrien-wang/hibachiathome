#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import ts from 'typescript'

const require = createRequire(import.meta.url)

class MemoryStorage {
  constructor() {
    this.store = new Map()
  }

  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null
  }

  setItem(key, value) {
    this.store.set(key, String(value))
  }
}

function createCookieDocument(initialTitle = 'Real Hibachi') {
  const cookies = new Map()
  let pageTitle = initialTitle

  return {
    get title() {
      return pageTitle
    },
    set title(value) {
      pageTitle = String(value)
    },
    get cookie() {
      return [...cookies.entries()].map(([key, value]) => `${key}=${value}`).join('; ')
    },
    set cookie(rawValue) {
      const firstSegment = String(rawValue).split(';')[0] ?? ''
      const separatorIndex = firstSegment.indexOf('=')
      if (separatorIndex <= 0) {
        return
      }

      const key = firstSegment.slice(0, separatorIndex)
      const value = firstSegment.slice(separatorIndex + 1)
      cookies.set(key, value)
    },
  }
}

function loadTrackingModule({ window, document, env }) {
  const trackingPath = resolve('lib/tracking.ts')
  const source = readFileSync(trackingPath, 'utf-8')
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: trackingPath,
  }).outputText

  const sandbox = {
    module: { exports: {} },
    exports: {},
    require,
    window,
    document,
    URLSearchParams,
    JSON,
    Date,
    console,
    process: { env },
  }
  sandbox.exports = sandbox.module.exports

  vm.createContext(sandbox)
  vm.runInContext(transpiled, sandbox, { filename: trackingPath })

  return sandbox.module.exports
}

function main() {
  const evidenceDir = process.argv[2] ? resolve(process.argv[2]) : resolve('harness/verification/2026-02-19-trk-002')
  mkdirSync(evidenceDir, { recursive: true })

  const dataLayer = []
  const memoryStorage = new MemoryStorage()
  const document = createCookieDocument('Real Hibachi | Home')
  const window = {
    dataLayer,
    location: {
      pathname: '/',
      search: '?utm_source=google&utm_medium=cpc',
    },
    localStorage: memoryStorage,
  }

  const { captureAttributionOnLanding, trackEvent } = loadTrackingModule({
    window,
    document,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      NEXT_PUBLIC_TRACKING_DEBUG: 'false',
    },
  })

  captureAttributionOnLanding(window.location.search)
  trackEvent('page_view')

  assert.equal(dataLayer.length, 1, 'TRK-001 baseline check failed: expected exactly one page_view after one home load intent')
  assert.equal(dataLayer[0].event, 'page_view', 'TRK-001 baseline check failed: expected page_view event name')
  assert.equal(dataLayer[0].page_path, '/', 'TRK-001 baseline check failed: expected / page path on home load')
  assert.ok(typeof dataLayer[0].page_title === 'string' && dataLayer[0].page_title.length > 0, 'TRK-001 baseline check failed: expected non-empty page_title')

  window.location.pathname = '/book'
  window.location.search = '?utm_source=google&utm_medium=cpc&utm_campaign=winter-sale'
  document.title = '   Book Real Hibachi   '
  trackEvent('page_view')

  assert.equal(dataLayer.length, 2, 'TRK-002 check failed: expected second page_view entry after route change intent')
  assert.equal(dataLayer[1].page_path, '/book', 'TRK-002 check failed: page_path must be canonical route path without query params')
  assert.equal(dataLayer[1].page_title, 'Book Real Hibachi', 'TRK-002 check failed: page_title should be trimmed and non-empty')
  assert.equal(dataLayer[1].utm_source, 'google', 'TRK-002 check failed: expected persisted attribution in payload')
  assert.equal(dataLayer[1].utm_medium, 'cpc', 'TRK-002 check failed: expected persisted attribution in payload')

  const evidencePayload = {
    checks: {
      trk_001_reverify: 'pass',
      trk_002: 'pass',
    },
    events: dataLayer,
  }

  const outputPath = resolve(evidenceDir, 'trk-001-trk-002-tracking-lib-evidence.json')
  writeFileSync(outputPath, `${JSON.stringify(evidencePayload, null, 2)}\n`, 'utf-8')
  console.log(`Wrote evidence: ${outputPath}`)
}

main()
