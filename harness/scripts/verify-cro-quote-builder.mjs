#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { resolve } from "node:path"
import assert from "node:assert/strict"
import vm from "node:vm"
import { createRequire } from "node:module"
import ts from "typescript"

const require = createRequire(import.meta.url)

function loadQuoteBuilderModule() {
  const quoteBuilderPath = resolve("lib/quote-builder.ts")
  const source = readFileSync(quoteBuilderPath, "utf-8")
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: quoteBuilderPath,
  }).outputText

  const sandbox = {
    module: { exports: {} },
    exports: {},
    require,
    console,
    Intl,
  }
  sandbox.exports = sandbox.module.exports

  vm.createContext(sandbox)
  vm.runInContext(transpiled, sandbox, { filename: quoteBuilderPath })
  return sandbox.module.exports
}

function main() {
  const evidenceDir = process.argv[2]
    ? resolve(process.argv[2])
    : resolve("harness/verification/2026-02-20-cro-quote-001")
  mkdirSync(evidenceDir, { recursive: true })

  const { calculateQuote, buildSmsBody, buildEmailPayload, buildCallScript } = loadQuoteBuilderModule()

  const input = {
    eventDate: "2026-04-20",
    location: "Irvine 92620",
    adults: 12,
    kids: 4,
    tablewareRental: true,
    budget: 1800,
    addOns: {
      steak: true,
      shrimp: false,
      lobster: true,
    },
  }

  const result = calculateQuote(input)
  const smsBody = buildSmsBody(input, result)
  const emailPayload = buildEmailPayload(input, result)
  const callScript = buildCallScript(input, result)

  assert.equal(result.hasCoreInputs, true, "Quote should be considered complete with core inputs.")
  assert.equal(result.minimumSpend, 599, "Minimum spend must remain consistent with pricing rules.")
  assert.ok(result.totalRange.high >= result.totalRange.low, "Total range must be valid.")
  assert.ok(result.travelFeeRange.low >= 0, "Travel fee lower bound must be non-negative.")
  assert.ok(result.tablewareFee > 0, "Tableware fee should apply when rental is selected.")

  assert.ok(smsBody.includes("Irvine"), "SMS template must include location.")
  assert.ok(smsBody.includes("2026-04-20"), "SMS template must include event date.")
  assert.ok(emailPayload.body.includes("Estimated total range"), "Email template must include estimate range.")
  assert.ok(callScript.includes("16 guests"), "Call script must include guest count.")

  const evidence = {
    checks: {
      quote_calculation_core: "pass",
      minimum_spend_logic: "pass",
      travel_fee_range: "pass",
      contact_template_prefill: "pass",
    },
    sample_input: input,
    sample_result: result,
    sample_templates: {
      smsBody,
      emailSubject: emailPayload.subject,
      emailBody: emailPayload.body,
      callScript,
    },
  }

  const outputPath = resolve(evidenceDir, "cro-quote-001-quote-builder-evidence.json")
  writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf-8")
  console.log(`Wrote evidence: ${outputPath}`)
}

main()
