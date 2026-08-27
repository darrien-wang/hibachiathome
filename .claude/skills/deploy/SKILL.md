---
name: deploy
description: >-
  Deploy the realhibachi-marketing site to production (www.realhibachi.com via
  Vercel). Use this whenever the user asks to deploy, ship, release, push to
  production, publish changes, or "go live" for this marketing project — including
  phrasings like "部署", "上线", "发布", "推到线上". Covers the full workflow: verifying
  the Vercel deploy target, building locally (with the Windows SWC gotcha),
  committing, pushing to GitHub main to trigger Vercel, verifying the live site
  with curl, and the post-deploy Google Search Console steps.
---

# Deploy realhibachi-marketing to production

This project deploys via **Vercel's GitHub integration**: pushing to the `main`
branch of `github.com/darrien-wang/hibachiathome` triggers an automatic
production build that serves `www.realhibachi.com`. There is no `vercel deploy`
CLI step — the push *is* the deploy.

Work through the phases below in order. Each phase has a guard that catches the
specific ways this project has broken before, so don't skip the verification
steps even when the change looks trivial.

## Key facts

- **Canonical domain:** `https://www.realhibachi.com` (non-www and mirror hosts
  301 to it)
- **Vercel project:** `realhibachi-marketing`, id
  `prj_uq6V65eQcr9o6oIao946e8dPfR9o` (matches "Marketing Production" in the
  workspace `DEPLOY_TARGETS.md`)
- **Git remote:** `origin` → `https://github.com/darrien-wang/hibachiathome.git`
  (HTTPS, credentials cached in the git credential manager). The repo also has an
  SSH URL floating around, but the SSH key on this machine is **not** registered
  with GitHub — if a push fails with `Permission denied (publickey)`, the fix is
  to use the HTTPS remote, not to debug SSH.
- **Package manager:** pnpm
- **Platform note:** local dev is Windows; the build has a recurring SWC-binary
  quirk (see Phase 2).

## Phase 1 — Verify the deploy target

Before touching anything, confirm this working copy really points at the
production marketing project. Getting this wrong risks deploying to the wrong
Vercel project.

```bash
cat .vercel/project.json
```

Check `projectId` equals `prj_uq6V65eQcr9o6oIao946e8dPfR9o` and `projectName`
is `realhibachi-marketing`. There's also a workspace helper at
`../scripts/check-deploy-target.sh` (one level up from the repo), but it needs
the Vercel CLI installed — if the CLI is missing it exits `blocked
reason=vercel_cli_missing`, in which case the `project.json` match above is a
sufficient manual check.

## Phase 2 — Build locally and guard against the CSR regression

Always build before deploying so you catch failures locally instead of in
Vercel's queue.

```bash
pnpm build
```

**If the build dies with `Failed to load SWC binary for win32/x64`** (often with
`Assertion failed !(handle->flags & UV_HANDLE_CLOSING)`), the `node_modules` was
populated in a different environment and is missing the Windows SWC binary.
Refetch dependencies and rebuild:

```bash
CI=true pnpm install   # CI=true avoids the "no TTY" abort on module removal
pnpm build
```

**After a successful build, verify the homepage actually server-renders.** This
site's single worst regression was a client component calling `useSearchParams()`
high in the tree, which made the whole page bail out to client-side rendering and
ship an *empty* HTML body — invisible to Google and AI crawlers. Guard against it:

```bash
f=.next/server/app/index.html
echo "size: $(wc -c < $f) | h1: $(grep -o '<h1' $f | wc -l) | jsonld: $(grep -o 'application/ld+json' $f | wc -l)"
```

Expect **size > 100000**, **h1 ≥ 1**, and **jsonld ≥ 2**. If size is ~28KB with
0 h1, the page is bailing to CSR again — stop and fix the offending
`useSearchParams()`/Suspense boundary before deploying (see
`lib/use-active-region.ts` for the pattern that fixes it).

## Phase 3 — Commit

Stage only the files that belong to this change. Some tracked/untracked files in
this repo are local noise that should **not** ride along in a deploy commit —
notably `growth-task-list.json` and `config/utm-rules.json`. Review the staged
set explicitly:

```bash
git add <the files you changed>
git diff --cached --name-status
```

Then commit. Per this project's convention, end the message with the Claude
co-author trailer:

```
Co-Authored-By: Claude <noreply@anthropic.com>
```

Only commit and push when the user has asked to deploy (they have, if this skill
is running). You're already on `main`, which is the deploy branch for this repo.

## Phase 4 — Push to trigger the Vercel deploy

```bash
git push origin main
```

If this fails with `Permission denied (publickey)`, the remote is pointing at
SSH. Switch to HTTPS and retry:

```bash
git remote set-url origin https://github.com/darrien-wang/hibachiathome.git
git push origin main
```

The push kicks off Vercel's production build automatically. Give it roughly
60–90 seconds before verifying.

## Phase 5 — Verify the live site

Run the bundled verification script, which curls production and checks SSR
health, city pages, redirects, and the SEO endpoints in one shot:

```bash
bash .claude/skills/deploy/scripts/verify-live.sh
```

Read its output against these expectations:

- **Homepage:** size well over 100KB, `h1: 1`, `jsonld` ≥ 2, canonical =
  `https://www.realhibachi.com`
- **City pages** (`/hibachi-at-home/san-diego` etc.): `200`
- **Redirects:** `/locations/nyc-long-island` → 308 to
  `/locations/la-orange-county`; `https://realhibachi.com/...` (non-www) → 308 to
  the www host
- **`/llms.txt`:** `200`
- **`/sitemap.xml`:** ~33 `<loc>` entries

If the homepage still shows the *old* content, the CDN may not have flipped yet —
wait another 30–60s and re-run. If it shows a 28KB empty body, the CSR
regression shipped; roll back or fix and redeploy.

## Phase 6 — Post-deploy: Google Search Console (optional, on request)

These steps live outside the codebase and require a signed-in browser session, so
only do them when the user asks to "submit to Google" / "request indexing" and a
browser MCP is available.

1. **Submit the sitemap** (idempotent — re-submitting nudges a re-crawl): in GSC
   for the `realhibachi.com` domain property → **Sitemaps** → add
   `https://www.realhibachi.com/sitemap.xml`.
2. **Request indexing** for the highest-value pages via the top **URL inspection**
   box, one at a time (Google rate-limits this to ~10–20/day, so prioritize):
   the homepage `https://www.realhibachi.com/`, the hub
   `https://www.realhibachi.com/hibachi-at-home`, then a few top city pages
   (`san-diego`, `irvine`, `anaheim`, `long-beach`). The rest are discovered
   automatically via the sitemap — no need to submit all 16 city pages by hand.

Note: the GSC top search box occasionally triggers a browser-extension overlay
that blocks clicks/typing (`Cannot access a chrome-extension:// URL`). If that
happens repeatedly, an incognito window with extensions disabled clears it.
