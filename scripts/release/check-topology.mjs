import {
  loadTopology,
  vercelGet,
  lookupDomain,
  headRequest,
  formatList,
} from "./_lib.mjs"

const topology = await loadTopology()
const failures = []

for (const codebase of topology.codebases) {
  console.log(`\n[codebase] ${codebase.id}`)

  for (const deployTarget of codebase.deployTargets) {
    const project = await vercelGet(`/v9/projects/${encodeURIComponent(deployTarget.vercelProject)}`)
    const expectedRepo = codebase.gitRepo.split("/").at(-1)
    const actualRepo = project.link?.repo ?? null

    if (expectedRepo && actualRepo !== expectedRepo) {
      failures.push(
        `${codebase.id}/${deployTarget.id}: expected git repo ${expectedRepo}, got ${actualRepo || "none"}`
      )
    } else {
      console.log(`[ok] ${codebase.id}/${deployTarget.id}: linked repo ${actualRepo}`)
    }

    const productionAliases = new Set([
      ...(project.targets?.production?.alias ?? []),
      ...(project.latestDeployments?.[0]?.alias ?? []),
    ])
    const previewAliases = new Set([
      ...(project.targets?.preview?.alias ?? []),
    ])

    const missingProdAliases = (deployTarget.productionAliases ?? [])
      .filter((alias) => alias.endsWith(".vercel.app"))
      .filter(
      (alias) => !productionAliases.has(alias)
    )
    if (missingProdAliases.length > 0) {
      failures.push(
        `${codebase.id}/${deployTarget.id}: missing production aliases ${formatList(missingProdAliases)}`
      )
    } else {
      console.log(
        `[ok] ${codebase.id}/${deployTarget.id}: production aliases present`
      )
    }

    const missingPreviewAliases = (deployTarget.previewAliases ?? []).filter(
      (alias) => !previewAliases.has(alias)
    )
    if (missingPreviewAliases.length > 0) {
      failures.push(
        `${codebase.id}/${deployTarget.id}: missing preview aliases ${formatList(missingPreviewAliases)}`
      )
    } else if ((deployTarget.previewAliases ?? []).length > 0) {
      console.log(`[ok] ${codebase.id}/${deployTarget.id}: preview aliases present`)
    }

    const customDomains = (deployTarget.productionAliases ?? []).filter(
      (alias) => !alias.endsWith(".vercel.app")
    )

    for (const domain of customDomains) {
      const dnsResult = await lookupDomain(domain)
      if (!dnsResult.ok) {
        failures.push(`${codebase.id}/${deployTarget.id}: ${domain} DNS lookup failed: ${dnsResult.error}`)
        continue
      }

      const headResult = await headRequest(`https://${domain}`)
      if (!headResult.ok) {
        failures.push(`${codebase.id}/${deployTarget.id}: ${domain} HTTP check failed: ${headResult.error}`)
        continue
      }

      if (headResult.status < 200 || headResult.status >= 400) {
        failures.push(
          `${codebase.id}/${deployTarget.id}: ${domain} returned unexpected HTTP status ${headResult.status}`
        )
        continue
      }

      console.log(
        `[ok] ${codebase.id}/${deployTarget.id}: ${domain} resolves and answers HTTPS`
      )
    }
  }
}

if (failures.length > 0) {
  console.error("\nTopology contract failed:")
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log("\nTopology contract passed.")
