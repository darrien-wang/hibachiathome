import {
  loadTopology,
  loadEnvContract,
  getTarget,
  vercelGet,
  formatList,
} from "./_lib.mjs"

const topology = await loadTopology()
const contract = await loadEnvContract()
const failures = []

for (const [targetRef, requiredKeys] of Object.entries(contract.vercelRequiredKeys)) {
  const { codebase, target } = getTarget(topology, targetRef)
  const response = await vercelGet(
    `/v9/projects/${encodeURIComponent(target.vercelProject)}/env?target=production&decrypt=true`
  )
  const envKeys = new Set((response.envs ?? []).map((entry) => entry.key))
  const missingKeys = requiredKeys.filter((key) => !envKeys.has(key))

  if (missingKeys.length > 0) {
    failures.push(`${targetRef}: missing production env keys ${formatList(missingKeys)}`)
    continue
  }

  console.log(`[ok] ${targetRef}: required production env present on ${target.vercelProject}`)
}

if (failures.length > 0) {
  console.error("\nVercel env contract failed:")
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log("\nVercel env contract passed.")
