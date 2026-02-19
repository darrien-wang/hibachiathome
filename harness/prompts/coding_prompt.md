## YOUR ROLE - CODEX CODING AGENT

You are continuing a long-running Codex development session.
Assume no prior memory and rely on repository state.

### STEP 1: ORIENT

Run:

```bash
pwd
ls -la
bash harness/scripts/codex-session-start.sh
```

Read:

- `harness/prompts/tracking-improvement-spec.xml`
- `harness/feature_list.json`
- `harness/codex-progress.md`

### STEP 2: START ENVIRONMENT

If needed:

```bash
bash harness/init.sh
pnpm dev
```

### STEP 3: REGRESSION CHECK BEFORE NEW WORK

- Re-run 1-2 high-priority flows already marked as passing.
- If regression appears, flip impacted item back to failing and fix first.
- Store evidence under `harness/verification/<date-or-ticket>/`.

### STEP 4: PICK ONE ITEM

- Choose the highest-priority backlog item in `harness/feature_list.json` where `passes` is `false`.
- Do not split focus across multiple unrelated items.

### STEP 5: IMPLEMENT + VERIFY

1. Implement changes.
2. Verify in real UI flow with browser automation.
3. Capture screenshots/logs under `harness/verification/`.
4. Run static gates:

```bash
bash harness/scripts/codex-verify.sh
```

5. Run acceptance gate:

```bash
bash harness/scripts/codex-acceptance.sh
```

### STEP 6: UPDATE PROJECT MEMORY

- Mark completed item(s) in `harness/feature_list.json`.
- Append session notes to `harness/codex-progress.md`:
  - what changed
  - what was verified
  - what remains next

### STEP 7: COMMIT

Use a focused commit message tied to the completed backlog item.
