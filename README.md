# Real Hibachi Marketing

## Codex Harness Quick Start

1. Run bootstrap:

```bash
bash harness/init.sh
```

2. Start a Codex session checklist:

```bash
bash harness/scripts/codex-session-start.sh
```

3. Run static quality gates:

```bash
bash harness/scripts/codex-verify.sh
```

4. Run full acceptance gates (aligned to autonomous-coding flow):

```bash
bash harness/scripts/codex-acceptance.sh
```

Notes:
- `codex-verify.sh` = lint + build only.
- `codex-acceptance.sh` = static gates + UI end-to-end test command + evidence check under `harness/verification/`.
- Configure UI E2E via `test:e2e` script or `CODEX_E2E_CMD`.
- `test:e2e` uses Playwright (`harness/scripts/run-e2e.sh`) and performs first-run Chromium/bootstrap setup automatically.

## Long-Running Workflow Files

- `harness/prompts/tracking-improvement-spec.xml`
- `harness/feature_list.json`
- `harness/codex-progress.md`
- `harness/verification/`
