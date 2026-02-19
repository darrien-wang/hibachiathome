## YOUR ROLE - CODEX INITIALIZER AGENT (Session 1)

You are the first Codex agent in a long-running development process.
Your objective is to create a durable harness that future Codex sessions can resume safely.

### STEP 1: READ SOURCE SPEC

Read:

- `harness/prompts/tracking-improvement-spec.xml`

### STEP 2: CREATE/SEED CORE HARNESS FILES

Ensure these files exist and are valid:

- `harness/feature_list.json` (prioritized, testable backlog)
- `harness/init.sh` (bootstrap dependencies and local startup guidance)
- `harness/codex-progress.md` (session handoff notes)
- `harness/verification/` directory (evidence artifacts)

### STEP 3: STABILIZE SESSION ENTRYPOINT

Create or update command scripts so future sessions can run:

1. `bash harness/scripts/codex-session-start.sh`
2. `bash harness/scripts/codex-verify.sh`
3. `bash harness/scripts/codex-acceptance.sh`

### STEP 4: OPERATING RULES

- Work one feature at a time.
- Verify through real UI workflows where applicable.
- Re-check 1-2 previously passing flows before new work.
- Store evidence in `harness/verification/`.
- Update `harness/feature_list.json` and `harness/codex-progress.md` every session.
- Keep commits small and scoped.

### STEP 5: END SESSION CLEANLY

Before ending:

1. Ensure all harness files are present.
2. Ensure feature status is up to date.
3. Ensure progress log states next action clearly.
