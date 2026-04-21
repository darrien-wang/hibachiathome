import fs from "node:fs/promises"
import path from "node:path"
import dns from "node:dns/promises"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const REPO_ROOT = path.resolve(__dirname, "..", "..")

export function resolveFromRepo(...parts) {
  return path.resolve(REPO_ROOT, ...parts)
}

export async function readJson(relativePath) {
  const absolutePath = resolveFromRepo(relativePath)
  const raw = await fs.readFile(absolutePath, "utf8")
  return JSON.parse(raw)
}

export async function fileExists(absolutePath) {
  try {
    await fs.access(absolutePath)
    return true
  } catch {
    return false
  }
}

export async function readOptionalEnvFile(absolutePath) {
  if (!(await fileExists(absolutePath))) {
    return {}
  }

  const raw = await fs.readFile(absolutePath, "utf8")
  return parseDotEnv(raw)
}

export function parseDotEnv(raw) {
  const values = {}

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue

    const withoutExport = trimmed.startsWith("export ") ? trimmed.slice(7) : trimmed
    const separatorIndex = withoutExport.indexOf("=")
    if (separatorIndex === -1) continue

    const key = withoutExport.slice(0, separatorIndex).trim()
    const value = withoutExport.slice(separatorIndex + 1).trim()
    if (!key) continue

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      values[key] = value.slice(1, -1)
      continue
    }

    values[key] = value
  }

  return values
}

export async function readEnvFile(relativeRepoPath, envFileName) {
  const absolutePath = resolveFromRepo(relativeRepoPath, envFileName)
  const raw = await fs.readFile(absolutePath, "utf8")
  return {
    path: absolutePath,
    values: parseDotEnv(raw),
  }
}

export async function lookupDomain(domain) {
  try {
    const result = await dns.lookup(domain)
    return { ok: true, address: result.address, family: result.family }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function headRequest(url) {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
    })
    return { ok: true, status: response.status, finalUrl: response.url }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function requireToken() {
  const directToken = process.env.VERCEL_TOKEN?.trim()
  if (directToken) {
    return directToken
  }

  const fallbackEnv = await readOptionalEnvFile(resolveFromRepo("..", ".env"))
  const fallbackToken = fallbackEnv.VERCEL_TOKEN?.trim()
  if (fallbackToken) {
    return fallbackToken
  }

  const token = process.env.VERCEL_TOKEN?.trim()
  if (!token) {
    throw new Error(
      "VERCEL_TOKEN is required. Export it directly, or place it in ../.env relative to this repo."
    )
  }
  return token
}

export async function vercelGet(pathname) {
  const token = await requireToken()
  const response = await fetch(`https://api.vercel.com${pathname}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Vercel API ${pathname} failed with ${response.status} ${response.statusText}`)
  }

  return response.json()
}

export async function loadTopology() {
  return readJson("release/contracts/topology.json")
}

export async function loadEnvContract() {
  return readJson("release/contracts/env-contract.json")
}

export async function loadSchemaContract() {
  return readJson("release/contracts/schema-contract.json")
}

export function getCodebase(topology, codebaseId) {
  const codebase = topology.codebases.find((item) => item.id === codebaseId)
  if (!codebase) {
    throw new Error(`Unknown codebase: ${codebaseId}`)
  }
  return codebase
}

export function getTarget(topology, targetRef) {
  const [codebaseId, targetId] = targetRef.split("/")
  const codebase = getCodebase(topology, codebaseId)
  const target = codebase.deployTargets.find((item) => item.id === targetId)
  if (!target) {
    throw new Error(`Unknown target: ${targetRef}`)
  }
  return { codebase, target }
}

export function formatList(values) {
  return values.join(", ")
}
