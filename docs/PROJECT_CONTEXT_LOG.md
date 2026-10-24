# LORE — Project Context Log

> **Purpose.** A running, always-current record of everything done on this repo, the exact current
> state, and the context a new person or coding agent needs to resume work mid-stream. Update it at
> the end of every task and at every meaningful step. Newest log entries go at the **bottom** of the
> log section; the "Current state" section is rewritten in place.

## How to resume (read this first)

1. Read `docs/IMPLEMENTATION_PLAN.md`; it is the sole active implementation plan for Computer 2.
2. Read the **Current state** section below, then the last few **Log** entries.
3. Check `docs/HANDOFF.md` (cross-computer requests) and `docs/CONTRACTS.md` (contract changes).
4. Toolchain on the original machine: Node 22 is installed user-local at `~/.local/node/bin`
   (added to `~/.zshrc`); pnpm 9 is installed globally in that Node. Run
   `export PATH="$HOME/.local/node/bin:$PATH"` in non-login shells.
5. `pnpm install`, then continue the first unchecked task in the task tracker below.

## Repo + branches

- GitHub: `hamizfaraz/lore` (private).
- `main` — C1-0a and C1-0b land here directly. After that, `main` moves only through checkpoint merges.
- `c1/platform` — Computer 1 (this machine's agent) works here from C1-1 on.
- `c2/intelligence` — Computer 2's branch (created by Computer 2).

## Current state

_Rewritten after each step._

- Phase: C2-1 in progress; provider core and mock runtime implemented and verified.
- Active Computer 2 branch: `c2/intelligence`, in a dedicated worktree. All implementation changes
  in this run are confined to this branch; the original checkout remains clean on `main`. The
  latest pushed implementation checkpoint is `2c43f97`.
- `origin/main` is still commit `136e13f` (`chore(c1-0a): bootstrap monorepo, commit implementation
  plan`). C1-0b's full scaffold has not landed yet, so C2 must not create or implement C1-owned
  scaffold paths. C2-1 may proceed inside `packages/ai` in mock mode and must rebase on C1-0b before
  it is considered complete.
- C2-0 external account provisioning is a human-owned prerequisite. No credentials are present in
  the repo, and no live provider smoke tests have run.
- C2-1 currently includes Muse text/image/voice adapters, Gemini embeddings and safety, cached
  SerpAPI access, schema-validated structured output with one repair and mock fallback, Valkey-ready
  budgets, prompt rules, six mock image assets, two mock voice assets, and game prompt helpers.
  Every provider path now honors `AI_MODE=mock`. Server-side reference filters remove model-supplied
  memory, candidate, message, media, and user ids that were not in the input, force unverified news
  to silence, and reject unsupported recap citations. Package typecheck, lint, 13 unit tests, and
  mock smoke pass. Remaining before C2-1 is done: rebase
  on C1-0b, consume its shared schemas, run whole-repo checks, and run the live provider smoke with
  C2-0 credentials plus a spoken WAV fixture.
- Whole-workspace typecheck and tests pass. Whole-workspace lint reaches all files but fails only
  because C1-owned root `biome.json` is not formatted; `packages/ai` lint passes. A C2->C1 handoff
  records the required owner fix.
- Latest run: the root `pnpm dev` command now keeps the existing C2 mock runtime alive through a
  temporary `packages/ai` watch-mode harness. It exposes no page, server, port, or product API. The
  harness must be reviewed against C1's real dev processes at merge time rather than carried over
  blindly.
- `docs/IMPLEMENTATION_PLAN.md` is now the single active plan and covers C2-0 through C2-12, exact
  ownership, dependencies, acceptance tests, merge rules, cut lines, and recovery. The previous
  broad plan and `docs/C2_NOW.md` workflow were removed from the working tree and remain only in git
  history. Product implementation remains paused pending a new instruction.

## Computer 1 task tracker

| ID | Task | Status | Notes |
| --- | --- | --- | --- |
| C1-0a | Bootstrap repo | done | Landed on `main` at `136e13f` |
| C1-0b | Full scaffold on main | pending | |
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

## Computer 2 task tracker

| ID | Task | Status | Notes |
| --- | --- | --- | --- |
| C2-0 | Provision accounts and keys | human action required | Section 14 checklist; secrets must use a password manager, never git/chat |
| C2-1 | AI package, mocks, guard, budget, game prompts, smoke script | in progress | Mock/provider core green; pending C1-0b rebase and live smoke |
| C2-2 | Milo persona, proactivity, memory, basic studio | pending | Depends on C2-1 and C1-4 hook |
| C2-3 | Voice transcription and live captions | pending | Depends on C2-1 |
| C2-4 | Concierge and plans | pending | Depends on C2-2 |
| C2-5 | Shared memories and recaps | pending | Depends on C2-1, C1-2, and C1-5 stub |
| C2-6 | Muse MCP connector | pending | Depends on C2-4 |
| C2-7 | Seed and demo reset | pending | Depends on C2-2 and C2-4 |
| C2-8 | Find Friends and Common Ground | pending | Depends on C2-1 |
| C2-9 | Snowflake impact | pending | Depends on C2-4 |
| C2-10 | Family story | pending | Depends on C2-5 |
| C2-11 | Podcast stations and render | pending | Depends on C2-3 |
| C2-12 | Advanced persona studio and AI polish | pending | Depends on C2-2 |

## Things that need a human (cannot be done by the agent)

- Add the teammate (Computer 2) as a collaborator on `hamizfaraz/lore` — GitHub username not known to the agent.
- Complete C2-0 from plan section 7: Meta Model API key and HackTX credit, Meta developer app
  and Tester accounts, Muse app sign-in, SerpAPI credits, Gemini key, a Computer 2 Tiger Data dev
  service, Snowflake trial/PAT/network policy, Vultr account/Object Storage, and `ourlore.tech`.
- Share C2-0 secrets through a password manager only. Do not paste them into chat or commit them.

## Deviations from the plan

_Record every deviation in `docs/IMPLEMENTATION_PLAN.md` and in the log below so the plan stays true._

## Log

- **2026-10-24 · C1-0a** — Installed Node 22 (official nodejs.org tarball, checksum verified) to
  `~/.local/node` and pnpm 9.15.9 because the machine had no Node. Initialized git repo at
  `/Users/hamiziqbal/Documents/hack_tx_project` (repo root = `lore/` in the plan). Wrote root config
  (`package.json`, `pnpm-workspace.yaml`, `turbo.json`, `biome.json`, `tsconfig.base.json`,
  `lefthook.yml`, `.gitignore`, `.nvmrc`), empty workspace packages, and docs
  (`IMPLEMENTATION_PLAN.md`, `CONTRACTS.md`, `HANDOFF.md`, this log).
- **2026-10-24 · Computer 2 kickoff** — Cloned `hamizfaraz/lore`, verified the original checkout is
  clean on `main`, created the isolated Computer 2 branch before any file changes, and aligned its
  name to the plan-required `c2/intelligence`. Created a dedicated worktree for that branch.
- **2026-10-24 · Main scan** — Read the implementation plan, contracts, handoff board, context log,
  root configuration, and existing package stubs directly from `main`. Fetched `origin`; both local
  and remote `main` remain at `136e13f`, so the required C1-0b scaffold is not available yet.
- **2026-10-24 · C2-1 provider core** — Added only plan-approved dependencies to `packages/ai` and
  implemented provider adapters for Muse Spark/Image/Voice, Gemini embeddings/guard, and cached
  SerpAPI searches. Added `callStructured` with zod validation, one schema-repair attempt, provider
  backoff, and an explicit degraded mock fallback; Valkey-compatible AI budgets; safety helpers;
  locked persona/concierge/recap/game/family/discovery/image-style prompts; C1-facing game helpers;
  11 JSON fixtures, 6 image fixtures, and 2 WAV/transcript fixtures; and a paid-provider live smoke
  entrypoint that requires `AI_MODE=live` plus `AI_SMOKE_WAV_PATH`.
- **2026-10-24 · C2-1 verification** — `@lore/ai` typecheck and Biome pass; Vitest passes 6 tests
  across structured repair/fallback, budgets, and game prompt fallback; mock smoke validates all 11
  JSON fixtures and reports the expected six image and two voice fixtures. No live provider call was
  attempted because C2-0 credentials have not been supplied.
- **2026-10-24 · Workspace verification** — Whole-workspace typecheck and tests pass. Workspace
  lint has one failure in C1-owned root `biome.json` (formatter output only); C2 did not modify that
  owned path and added a C2->C1 item to `docs/HANDOFF.md`. `git diff --check` passes.
- **2026-10-24 · C2-1 mock/provider hardening** — Extended `AI_MODE=mock` across Muse Image, Muse
  Voice batch/realtime, Gemini embeddings/safety, and SerpAPI so no runtime provider adapter needs a
  key during development. Added anti-hallucination reference enforcement for SpeakDecision,
  PlanRanking, and RecapDraftSpec. C2-1 verification now passes 13 tests across 5 files, package
  typecheck/lint, and mock smoke.
- **2026-10-24 · C2 checkpoint pushed** — Pushed `c2/intelligence` through commit `2c43f97` to
  GitHub. A post-push fetch confirmed `origin/main` is still `136e13f` (C1-0a only). Per the ordered
  dependency rules, do not start C2-2 until C1-0b is merged to `main`, this branch is rebased, and
  C2-1 is reconciled with the shared contracts. Live C2-1 smoke also remains blocked on the
  human-owned C2-0 credentials and a local spoken WAV path.
- **2026-10-24 · Local run requested** — Fetched `origin/main` and confirmed it remains at
  `136e13f`. Ran the C2 AI runtime with `AI_MODE=mock`: all 11 JSON fixtures, 6 image fixtures, 2
  voice fixtures, five-word choices, game prompts, guard, and budget smoke passed. Ran the root
  `pnpm dev` command in mock mode; Turborepo exited successfully with zero tasks because no package
  has a `dev` script until C1-0b lands. No application server or browser URL exists yet.
- **2026-10-24 · Minimal run harness** — At the human's request, added only a C2-owned development
  harness: `packages/ai` now has a `dev` script that runs the existing mock smoke under `tsx watch`.
  No product feature, web page, API endpoint, database module, or C1-owned file was implemented.
  Package typecheck, lint, and all 13 tests pass; root `pnpm dev` now remains running with the C2
  smoke green. During the C1 merge, reconcile or remove this temporary harness after the real
  web/API/worker dev scripts are present.
- **2026-10-24 · C2 immediate-scope file** — Verified the newly supplied full implementation plan is
  identical to the repo's original plan through section 17 and re-checked `origin/main` at
  `136e13f`. Added `docs/C2_NOW.md`, which identifies C2-0/C2-1 as the only current work, inventories
  the existing C2-1 partial implementation, lists the remaining live/shared-contract/mock-asset
  work, records merge-time runner reconciliation, and explicitly blocks C2-2 through C2-12. No
  product code was changed.
- **2026-10-24 · Full C2 plan replaces immediate scope** — Removed `docs/C2_NOW.md` at the human's
  request and added `docs/C2_IMPLEMENTATION_PLAN.md`, a complete C2-0 through C2-12 execution plan.
  It records ownership boundaries, ordered dependency gates, current C2-1 state, per-task backend,
  UI, test, and completion requirements, cross-computer contracts, privacy rules, checkpoints, cut
  order, merge protocol, and recovery steps. No product code was changed.
- **2026-10-24 · Single-plan reset** — Retired the old broad implementation workflow and promoted
  the complete C2 plan to `docs/IMPLEMENTATION_PLAN.md`, the only active implementation plan. The
  previous plan and temporary `C2_NOW.md` remain recoverable through git history but are no longer
  instructions. Updated the recovery path and the AI package README's environment reference
  accordingly; no product code was changed.
