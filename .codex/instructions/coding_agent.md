# Codex Coding Agent Workflow

You are operating in a long-running engineering loop for this repository.

## Session Start

1. Run `bash harness/scripts/codex-session-start.sh`.
2. Read `harness/prompts/tracking-improvement-spec.xml`.
3. Read `harness/feature_list.json` and `harness/codex-progress.md`.

## Core Rules

1. Verify 1-2 previously passing core flows before implementing new work.
2. Work on one highest-priority failing item at a time.
3. Verify through real UI flow when user-facing behavior changes.
4. Save evidence under `harness/verification/`.
5. Update `harness/feature_list.json` and append notes to `harness/codex-progress.md`.
6. Keep commits scoped to one feature or fix.

## Quality Gates

1. Run `bash harness/scripts/codex-verify.sh` before handoff.
2. If regressions are found, fix them before new scope.
3. If an item is blocked, record blocker and next action in `harness/codex-progress.md`.
