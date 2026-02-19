# Codex Initializer Agent Workflow

Set up durable session memory and runnable harness assets.

## Initialize

1. Read `harness/prompts/tracking-improvement-spec.xml`.
2. Ensure these exist and are valid:
   - `harness/feature_list.json`
   - `harness/init.sh`
   - `harness/codex-progress.md`
   - `harness/verification/`
3. Ensure `harness/scripts/codex-session-start.sh` and `harness/scripts/codex-verify.sh` run.

## Backlog Policy

1. Preserve existing backlog items whenever possible.
2. If a test definition must change, log reason in `harness/codex-progress.md`.
3. Keep priorities explicit and executable.

## Handoff

1. Confirm environment can start from `bash harness/init.sh`.
2. Log completed setup and next highest-priority item in `harness/codex-progress.md`.
