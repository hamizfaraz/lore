# LORE — Project Context Log

> **Purpose.** A running, always-current record of everything done on this repo, the exact current
> state, and the context a new person or coding agent needs to resume work mid-stream. Update it at
> the end of every task and at every meaningful step. Newest log entries go at the **bottom** of the
> log section; the "Current state" section is rewritten in place.

## How to resume (read this first)

1. Read `docs/IMPLEMENTATION_PLAN.md` (the source of truth; sections 1–9 shared, 10 task list, 13 merge).
2. Read the **Current state** section below, then the last few **Log** entries.
3. Check `docs/HANDOFF.md` (cross-computer requests) and `docs/CONTRACTS.md` (contract changes).
4. Toolchain on the original machine: Node 22 is installed user-local at `~/.local/node/bin`
   (added to `~/.zshrc`); pnpm 9 is installed globally in that Node. Run
   `export PATH="$HOME/.local/node/bin:$PATH"` in non-login shells.
5. `pnpm install`, then continue the first unchecked task in the task tracker below.

## Repo + branches

- GitHub: `hamizfaraz/lore` (private).
- `main` — C1-0a and C1-0b land here directly (per plan). After that, `main` moves only via merges (section 13).
- `c1/platform` — Computer 1 (this machine's agent) works here from C1-1 on.
- `c2/intelligence` — Computer 2's branch (created by Computer 2).

## Current state

_Rewritten after each step._

- Phase: **C1-0b scaffold in progress** (C1-0a done, `main` pushed).
- Done in C1-0b so far: `packages/shared` (ids, enums, ai schemas, policy + 11 passing tests, flags,
  events, cards, errors, all DTOs), `packages/db` (all 11 schema files, client, sql/001-005,
  `scripts/setup.ts`, drizzle config), `packages/tokens` (CSS vars + TS), `packages/ai` typed stubs
  for `games.*` and `guard` (C2 replaces bodies), `apps/api` package.json/tsconfig/tsup config (deps installed).
- Next in C1-0b: `apps/api/src` (lib/, server.ts, mcp.ts, worker.ts, modules/index.ts + every module
  stub + cross-boundary stubs), `apps/web` (Next 15 PWA shell, components, all routes, features,
  registries), `infra/` dev compose, `.env.example`, CI workflow. Then fast-forward `main` to the scaffold.
- WIP of C1-0b is pushed to `c1/platform` so it survives an interruption; `main` gets C1-0b when complete.

## Computer 1 task tracker

| ID | Task | Status | Notes |
| --- | --- | --- | --- |
| C1-0a | Bootstrap repo | done | private repo hamizfaraz/lore, main pushed |
| C1-0b | Full scaffold on main | in progress | WIP on c1/platform |
| C1-1 | Auth | pending | |
| C1-2 | Media pipeline | pending | |
| C1-3 | Social core | pending | |
| C1-4 | Chat | pending | |
| C1-5 | Group accounts | pending | |
| C1-6 | Infra | pending | |
| C1-7 | Game engine + One-Word Story | pending | |
| C1-8 | Meme Battle | pending | |
| C1-9 | Reels, Explore, notifications | pending | |
| C1-10 | Graph import | pending | |
| C1-11 | Pictionary | pending | |
| C1-12 | Solana keepsakes | pending | |
| C1-13 | Polish | pending | |

## Things that need a human (cannot be done by the agent)

- Add the teammate (Computer 2) as a collaborator on `hamizfaraz/lore` — GitHub username not known to the agent.
- Accounts/keys from plan section 14 (C2-0 provisions them): Meta API, Facebook app, Tiger Data, Vultr, domain, etc.

## Deviations from the plan

_Every deviation is also recorded in `docs/IMPLEMENTATION_PLAN.md` (section 18, "Implementation notes") so the plan stays the truth._

- `mayPublish`: AI drafts under direct/courtesy publish after >= 1 valid approval (the plan's snippet
  returned false forever, contradicting 8.4 acceptance "still requires an approval").
- Extra C1-owned tables/columns: `post_likes`, `post_saves`, `push_subscriptions`, `user_wallets`,
  `social_accounts.avatar_url/show_on_profile/onboarded_at`, `user.guest_expires_at`,
  `posts.draft_id/topic_tags/deleted_at`, `post_media.alt_text`, `media_assets.thumb_key/bytes/completed_at`,
  `conversations.join_slug/join_code/last_message_at`, `conversation_members.pinned_at/removed_at`,
  `messages.client_id`, `post_drafts.message_id/created_at`, `game_sessions.last_action_at`, `keepsakes.status/created_at`.
- C2-owned files got small scaffold additions they need: `ai_personas.muted_until`, `recaps.facts_used`.
- Message idempotency uses a plain index + Valkey key (hypertable unique indexes must include `created_at`).
- Added dev tooling deps outside section 4: `tsx` (run TS), `tsup` (bundle api), `dotenv-cli`; logged in HANDOFF.

## Log

- **2026-10-24 · C1-0a** — Installed Node 22 (official nodejs.org tarball, checksum verified) to
  `~/.local/node` and pnpm 9.15.9 because the machine had no Node. Initialized git repo at
  `/Users/hamiziqbal/Documents/hack_tx_project` (repo root = `lore/` in the plan). Wrote root config
  (`package.json`, `pnpm-workspace.yaml`, `turbo.json`, `biome.json`, `tsconfig.base.json`,
  `lefthook.yml`, `.gitignore`, `.nvmrc`), empty workspace packages, and docs
  (`IMPLEMENTATION_PLAN.md`, `CONTRACTS.md`, `HANDOFF.md`, this log).
- **2026-10-24 · C1-0a done** — `gh repo create hamizfaraz/lore --private`, pushed `main`.
- **2026-10-24 · C1-0b (partial)** — Wrote shared contracts, db schema + SQL, tokens, ai stubs, api
  package config. Library versions pinned to plan majors (Next 15, BullMQ 5, motion 12, Fastify 5,
  Socket.IO 4, TS 5, Tailwind 4); zod 4 chosen (required by fastify-type-provider-zod ≥6).
  Deviations recorded in plan section 18. Pushed WIP to `c1/platform`.
