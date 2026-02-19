# Codex Agent Workflow

This repository uses a long-running Codex workflow. Treat each session as resumable and auditable.

## Required Files

- `prompts/tracking-improvement-spec.xml`: source specification
- `feature_list.json`: prioritized testable backlog (single source of truth)
- `codex-progress.md`: session handoff log
- `init.sh`: environment bootstrap
- `verification/`: screenshots and verification evidence

## Session Rules

1. Start by running `bash scripts/codex-session-start.sh`.
2. Verify at least one previously passing core flow before new feature work.
3. Implement one highest-priority failing feature at a time.
4. Capture verification evidence in `verification/`.
5. Update `feature_list.json` and `codex-progress.md` before ending the session.
6. Keep commits small and scoped to one feature or fix.

## Change Policy for `feature_list.json`

- Do not remove existing test items.
- Status transitions must be explicit (`passes: false -> true` or rollback to `false`).
- If a test definition must change, append a note in `codex-progress.md` explaining why.
