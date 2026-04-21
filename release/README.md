# Multi-Project Release Contract

Verified against the current local repos, Vercel project metadata, and live domains on 2026-04-20.

## Scope

This release contract covers the three operational codebases that currently share production data and can break each other during deployment:

- `marketing` codebase: local repo [`realhibachi-marketing`](/mnt/d/desktop/realhibachi/realhibachi-marketing)
- `ops` codebase: local repo [`realhibachi-order-management-system`](/mnt/d/desktop/realhibachi/realhibachi-order-management-system)
- `chef` codebase: local repo [`v0-chef-app-design`](/mnt/d/desktop/realhibachi/v0-chef-app-design)

It also captures one critical deployment detail that caused confusion during livechat rollout:

- The public customer site `realhibachi.com` is served by Vercel project `realhibachi`
- The repo behind that public site is still `hibachiathome`, which is also the repo behind the local `marketing` codebase
- The separate Vercel project `realhibachi-marketing` is an isolated deployment target for the same repo, but it is not the public custom-domain target

## Current Topology

```text
Customer browser
  -> realhibachi.com / www.realhibachi.com
  -> Vercel project: realhibachi
  -> repo: hibachiathome
  -> in-app livechat UI + /api/livechat/*
  -> shared Supabase
       - chat_sessions
       - chat_messages
       - orders
       - staff_members
       - staff_credentials
       - order_staff_assignments
  -> ops.realhibachi.com
       - Vercel project: v0-realhibachi-order-management-system
       - support workspace reads/writes the same chat tables
  -> chefs.realhibachi.com
       - Vercel project: v0-chef-app-design
       - chef workspace reads the same order/staff data
```

### Marketing

- Local repo: [`realhibachi-marketing`](/mnt/d/desktop/realhibachi/realhibachi-marketing)
- Upstream repo: `darrien-wang/hibachiathome`
- Real public production target: Vercel project `realhibachi`
- Public domains:
  - `realhibachi.com`
  - `www.realhibachi.com`
- Preview/custom domains:
  - `pre.realhibachi.com`
- Secondary isolated deployment target: Vercel project `realhibachi-marketing`
- Important distinction:
  - Shipping `realhibachi-marketing` repo code does not automatically mean the public site target is healthy unless Vercel project `realhibachi` is also checked
- Livechat path in current production code:
  - [`components/live-chat-loader.tsx`](/mnt/d/desktop/realhibachi/realhibachi-marketing/components/live-chat-loader.tsx)
  - [`app/api/livechat/session/route.ts`](/mnt/d/desktop/realhibachi/realhibachi-marketing/app/api/livechat/session/route.ts)
  - [`app/api/livechat/message/route.ts`](/mnt/d/desktop/realhibachi/realhibachi-marketing/app/api/livechat/message/route.ts)
  - [`app/api/livechat/session/read/route.ts`](/mnt/d/desktop/realhibachi/realhibachi-marketing/app/api/livechat/session/read/route.ts)
- Current non-path:
  - `live.realhibachi.com` is not part of the active marketing livechat path
  - `realhibachi-livechat` is a separate codebase, but it is not the main production chat path for `realhibachi.com`

### Ops

- Local repo: [`realhibachi-order-management-system`](/mnt/d/desktop/realhibachi/realhibachi-order-management-system)
- Upstream repo: `darrien-wang/realhibachi-order-management-system`
- Vercel project: `v0-realhibachi-order-management-system`
- Public domain:
  - `ops.realhibachi.com`
- Shared data path:
  - Reads and writes `chat_sessions` and `chat_messages`
  - Uses the same Supabase project as marketing and chef
- Key server entry points:
  - [`lib/support-chat-server.ts`](/mnt/d/desktop/realhibachi/realhibachi-order-management-system/lib/support-chat-server.ts)
  - [`app/api/admin/chat/messages/[sessionId]/route.ts`](/mnt/d/desktop/realhibachi/realhibachi-order-management-system/app/api/admin/chat/messages/[sessionId]/route.ts)
  - [`app/api/admin/chat/realtime/route.ts`](/mnt/d/desktop/realhibachi/realhibachi-order-management-system/app/api/admin/chat/realtime/route.ts)

### Chef

- Local repo: [`v0-chef-app-design`](/mnt/d/desktop/realhibachi/v0-chef-app-design)
- Upstream repo: `darrien-wang/v0-chef-app-design`
- Vercel project: `v0-chef-app-design`
- Real custom domain:
  - `chefs.realhibachi.com`
- Not in use:
  - `chef.realhibachi.com` does not currently resolve
- Current data path:
  - Reads `orders`, `order_staff_assignments`, and `staff_members`
  - Authenticates against `staff_credentials`
  - Writes `chef_feedback`
- Key server entry points:
  - [`lib/chef-app-data-server.ts`](/mnt/d/desktop/realhibachi/v0-chef-app-design/lib/chef-app-data-server.ts)
  - [`lib/supabase-admin.ts`](/mnt/d/desktop/realhibachi/v0-chef-app-design/lib/supabase-admin.ts)
  - [`app/api/auth/login/route.ts`](/mnt/d/desktop/realhibachi/v0-chef-app-design/app/api/auth/login/route.ts)

## Shared Release Risks

These are the exact failure modes this contract is meant to catch before `main` reaches production:

- A repo deploys successfully, but the actual public custom domain is attached to a different Vercel project
- One target has code, but production env is missing required shared secrets
- Marketing can create chat sessions, but ops cannot read them because one side points at a different or missing Supabase config
- Chef is deployed visually, but its production login/data path is unusable because shared data env is absent
- A shared table or migration exists locally but not in the real shared Supabase project

## Required Release Flow

Treat the release as a single multi-project release whenever a change touches any of the following:

- shared Supabase env or schema
- `/api/livechat/*`
- support/admin chat APIs
- staff / order assignment / chef login flow
- customer-to-ops handoff
- domains, Vercel project bindings, or production aliases

### Sequence

1. Run local contract checks.
2. Fix any local env drift before deploying anything.
3. Validate Vercel topology and required production env on every affected target.
4. Validate shared Supabase schema.
5. Deploy preview or isolated targets first.
6. Validate runtime release contract on every production target.
7. Run cross-project smoke tests:
   - customer chat create on public site
   - ops receives and can reply
   - chef login and order list load if the release touches chef data paths
8. Promote production only after all affected targets are green.
9. Production smoke test is verification only, not first-time integration.

## Executable Checks

Run from [`realhibachi-marketing`](/mnt/d/desktop/realhibachi/realhibachi-marketing):

```bash
pnpm release:check
pnpm release:check:runtime
pnpm release:gate
```

The Vercel checks read `VERCEL_TOKEN` from either:

- exported shell env, or
- the workspace root file [`../.env`](/mnt/d/desktop/realhibachi/.env)

Individual commands:

```bash
pnpm release:check:local-env
pnpm release:check:topology
pnpm release:check:vercel-env
pnpm release:check:schema
pnpm release:check:runtime
pnpm release:gate
```

What they do:

- `release:check:local-env`
  - compares local `.env.local` files across marketing, ops, and chef for shared keys
- `release:check:topology`
  - verifies Vercel project bindings, aliases, and domain resolution against the checked-in topology contract
- `release:check:vercel-env`
  - verifies required production env keys exist on every declared deployment target
- `release:check:schema`
  - verifies required shared Supabase tables exist before rollout
- `release:check:runtime`
  - calls each live deployment's `/_release/ready` endpoint and verifies the runtime contract, including shared Supabase identity consistency across marketing, ops, and chef
- `release:gate`
  - runs the static preflight checks first, then the runtime production gate

## Source of Truth Files

- [`release/contracts/topology.json`](/mnt/d/desktop/realhibachi/realhibachi-marketing/release/contracts/topology.json)
- [`release/contracts/env-contract.json`](/mnt/d/desktop/realhibachi/realhibachi-marketing/release/contracts/env-contract.json)
- [`release/contracts/schema-contract.json`](/mnt/d/desktop/realhibachi/realhibachi-marketing/release/contracts/schema-contract.json)
- [`release/contracts/runtime-contract.json`](/mnt/d/desktop/realhibachi/realhibachi-marketing/release/contracts/runtime-contract.json)
