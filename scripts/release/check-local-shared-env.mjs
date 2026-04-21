import {
  loadTopology,
  loadEnvContract,
  readEnvFile,
  formatList,
} from "./_lib.mjs"

const topology = await loadTopology()
const contract = await loadEnvContract()

const failures = []
const envByCodebase = new Map()

for (const codebase of topology.codebases) {
  const envFile = await readEnvFile(codebase.localRepoPath, codebase.localEnvFile)
  envByCodebase.set(codebase.id, envFile)

  const requiredKeys = contract.localRequiredKeys[codebase.id] ?? []
  const missingKeys = requiredKeys.filter((key) => !envFile.values[key])

  if (missingKeys.length > 0) {
    failures.push(
      `${codebase.id}: missing local keys in ${envFile.path}: ${formatList(missingKeys)}`
    )
  } else {
    console.log(`[ok] ${codebase.id}: local required keys present`)
  }
}

for (const group of contract.localSharedGroups) {
  for (const key of group.keys) {
    const values = group.targets.map((targetId) => {
      const envFile = envByCodebase.get(targetId)
      return {
        targetId,
        value: envFile?.values[key] ?? null,
      }
    })

    const missingTargets = values.filter((entry) => !entry.value).map((entry) => entry.targetId)
    if (missingTargets.length > 0) {
      failures.push(`${group.id}: ${key} missing on ${formatList(missingTargets)}`)
      continue
    }

    const distinctValues = new Set(values.map((entry) => entry.value))
    if (distinctValues.size > 1) {
      failures.push(
        `${group.id}: ${key} differs across ${formatList(values.map((entry) => entry.targetId))}`
      )
      continue
    }

    console.log(`[ok] ${group.id}: ${key} matches across ${formatList(group.targets)}`)
  }
}

if (failures.length > 0) {
  console.error("\nLocal env contract failed:")
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log("\nLocal env contract passed.")
