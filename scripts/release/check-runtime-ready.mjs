import { getTarget, loadTopology, readJson } from "./_lib.mjs"

const topology = await loadTopology()
const runtimeContract = await readJson("release/contracts/runtime-contract.json")
const failures = []
const responses = new Map()

function getByPath(value, path) {
  return path.split(".").reduce((current, segment) => {
    if (current && typeof current === "object" && segment in current) {
      return current[segment]
    }
    return undefined
  }, value)
}

function pickPrimaryAlias(target) {
  return (
    target.productionAliases.find((alias) => !alias.endsWith(".vercel.app")) ||
    target.productionAliases[0] ||
    null
  )
}

async function fetchRuntimeReady(url) {
  let response

  try {
    response = await fetch(url, {
      headers: {
        "Cache-Control": "no-cache",
      },
      redirect: "follow",
    })
  } catch (error) {
    return {
      ok: false,
      status: null,
      payload: null,
      error: error instanceof Error ? error.message : String(error),
    }
  }

  let payload = null
  try {
    payload = await response.json()
  } catch (error) {
    return {
      ok: false,
      status: response.status,
      payload: null,
      error: `Invalid JSON response: ${error instanceof Error ? error.message : String(error)}`,
    }
  }

  return {
    ok: response.ok,
    status: response.status,
    payload,
    error: null,
  }
}

for (const targetRef of runtimeContract.requiredTargets) {
  const { target } = getTarget(topology, targetRef)
  const alias = pickPrimaryAlias(target)

  if (!alias) {
    failures.push(`${targetRef}: no production alias declared for runtime verification`)
    continue
  }

  const url = `https://${alias}${runtimeContract.readyPath}`
  const result = await fetchRuntimeReady(url)

  if (!result.payload) {
    failures.push(`${targetRef}: ${url} did not return a valid JSON payload (${result.error || `status ${result.status}`})`)
    continue
  }

  responses.set(targetRef, {
    url,
    status: result.status,
    payload: result.payload,
  })

  if (result.payload.contractVersion !== runtimeContract.contractVersion) {
    failures.push(
      `${targetRef}: runtime contract version mismatch (expected ${runtimeContract.contractVersion}, got ${result.payload.contractVersion || "missing"})`,
    )
    continue
  }

  if (result.payload.service?.codebase !== targetRef.split("/")[0]) {
    failures.push(`${targetRef}: payload reported unexpected codebase ${result.payload.service?.codebase || "missing"}`)
    continue
  }

  if (result.payload.service?.target !== targetRef.split("/")[1]) {
    failures.push(`${targetRef}: payload reported unexpected target ${result.payload.service?.target || "missing"}`)
    continue
  }

  if (result.payload.deployment?.requestedHost !== alias) {
    failures.push(
      `${targetRef}: payload host mismatch (expected ${alias}, got ${result.payload.deployment?.requestedHost || "missing"})`,
    )
    continue
  }

  if (!result.payload.ok) {
    const failedChecks = Array.isArray(result.payload.checks)
      ? result.payload.checks.filter((entry) => !entry.ok).map((entry) => `${entry.id} (${entry.detail})`)
      : []
    failures.push(
      `${targetRef}: runtime ready check failed${failedChecks.length > 0 ? `: ${failedChecks.join(", ")}` : ""}`,
    )
    continue
  }

  console.log(
    `[ok] ${targetRef}: runtime ready on ${url} (supabase=${result.payload.dependencies?.sharedSupabase?.projectRef || "n/a"}, commit=${result.payload.deployment?.gitCommitSha || "unknown"})`,
  )
}

for (const comparison of runtimeContract.sharedComparisons) {
  const values = []

  for (const targetRef of comparison.targets) {
    const entry = responses.get(targetRef)
    if (!entry?.payload?.ok) {
      continue
    }

    const value = getByPath(entry.payload, comparison.field)
    if (!value) {
      failures.push(`${comparison.service}: ${targetRef} missing ${comparison.field}`)
      continue
    }

    values.push({ targetRef, value })
  }

  if (values.length === 0) {
    continue
  }

  const uniqueValues = [...new Set(values.map((entry) => entry.value))]
  if (uniqueValues.length > 1) {
    failures.push(
      `${comparison.service}: mismatch across targets ${values.map((entry) => `${entry.targetRef}=${entry.value}`).join(", ")}`,
    )
    continue
  }

  console.log(`[ok] ${comparison.service}: ${uniqueValues[0]}`)
}

if (failures.length > 0) {
  console.error("\nRuntime release contract failed:")
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log("\nRuntime release contract passed.")
