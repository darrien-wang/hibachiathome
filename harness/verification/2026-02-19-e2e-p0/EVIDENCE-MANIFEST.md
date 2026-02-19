# Evidence Manifest (with commit hash)

- Generated at (UTC): `2026-02-19T01:03:32Z`
- Branch: `agent-work-sync`
- Baseline commit (HEAD): `5a64865c68708c053e954a9e4a884b328afc0aa5` (`5a64865`)
- Working tree state at generation: **dirty** (contains uncommitted changes)

## Scope

- Goal 1: Real Playwright E2E is connected and `test:e2e` runs.
- Goal 2: At least one P0 flow passes and is marked `passes: true` (TRK-001).

## Status checkpoints

- `harness/feature_list.json`: `TRK-001` is `passes: true`
- Acceptance gate: `bash harness/scripts/codex-acceptance.sh` => PASS

## Artifacts + SHA256

```text
45a4a87bd29292e2a4b5a75e9b177e8cf4a0bde857e4aa3ae2c74d348ee39621  harness/verification/2026-02-19-e2e-p0/trk-001-home.png
563c2557bade73e3be1ad64723c2a7372566591faff4efd89c3b31ee9dd03a68  harness/verification/2026-02-19-e2e-p0/trk-001-page-view-events.json
b08541da60bb3dc61f97ec52714597b0ea5cd152f594d9c36482607c148c0def  harness/verification/2026-02-19-e2e-p0/test-e2e.log
9a271f2a916b0b6ee6cecb2426f0b3206ef074578be55d9bc94f6f3fe3ab86aa  harness/verification/2026-02-19-e2e-p0/test-e2e.exit
8c0d25095267709e7b020e4217cdaf2434cfb3c3d1c824e191e697a183b3db4b  harness/verification/2026-02-19-e2e-p0/codex-verify.log
9a271f2a916b0b6ee6cecb2426f0b3206ef074578be55d9bc94f6f3fe3ab86aa  harness/verification/2026-02-19-e2e-p0/codex-verify.exit
6e3a5e7a7f026396875c9c8d0b36478b33d0ef98f619afa557d518452d3feb94  harness/verification/2026-02-19-e2e-p0/codex-acceptance.log
9a271f2a916b0b6ee6cecb2426f0b3206ef074578be55d9bc94f6f3fe3ab86aa  harness/verification/2026-02-19-e2e-p0/codex-acceptance.exit
```

## Quick verify commands

```bash
git rev-parse HEAD
sha256sum \
  harness/verification/2026-02-19-e2e-p0/trk-001-home.png \
  harness/verification/2026-02-19-e2e-p0/trk-001-page-view-events.json \
  harness/verification/2026-02-19-e2e-p0/test-e2e.log \
  harness/verification/2026-02-19-e2e-p0/test-e2e.exit \
  harness/verification/2026-02-19-e2e-p0/codex-verify.log \
  harness/verification/2026-02-19-e2e-p0/codex-verify.exit \
  harness/verification/2026-02-19-e2e-p0/codex-acceptance.log \
  harness/verification/2026-02-19-e2e-p0/codex-acceptance.exit
```
