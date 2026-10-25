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

- Phase: C2-1 implementation and local integration are complete; paid live smoke remains blocked on
  human-owned C2-0 credentials.
- Active Computer 2 branch: `c2/intelligence`, in a dedicated worktree. All implementation changes
  in this run are confined to this branch; the original checkout remains clean on `main`.
- `origin/main` is commit `73814e9` (`feat(c1-0b): full scaffold`). C2 has rebased onto it and
  reconciled `packages/ai` with the authoritative shared AI schemas and frozen game/guard interface.
- C2-0 external account provisioning is a human-owned prerequisite. No credentials are present in
  the repo, and no live provider smoke tests have run.
- C2-1 currently includes Muse text/image/voice adapters, Gemini embeddings and safety, cached
  SerpAPI access, schema-validated structured output with one repair and mock fallback, Valkey-ready
  budgets, retryable-provider backoff, prompt rules, six distinct 128x128 mock images, two spoken
  mono PCM16 24 kHz WAV fixtures, and game prompt helpers matching C1's service contract.
  Every provider path now honors `AI_MODE=mock`. Server-side reference filters remove model-supplied
  memory, candidate, message, media, and user ids that were not in the input, force unverified news
  to silence, and reject unsupported recap citations. The retry policy is immediate attempt plus
  0.5 s, 1 s, and 2 s retries for 429/5xx responses only; provider exhaustion degrades to valid
  mock output.
- Full verification passes: six workspace typechecks, 17 C2 unit tests, 11 shared policy tests,
  whole-workspace Biome over 399 files, mock smoke, production web/API builds, and `git diff --check`.
  The mock smoke validates 11 JSON fixtures, 6 images, 2 voice fixtures, 5 choices, 3 prompts, guard,
  and budget paths without credentials or network calls.
- The temporary `packages/ai` dev watcher is removed. Root `pnpm dev` now uses C1's actual web, API,
  worker, and MCP processes. The local app is run with `AI_MODE=mock`; absent database/Valkey values
  affect readiness and unfinished C1 features, not the C2-1 package smoke.
- `docs/IMPLEMENTATION_PLAN.md` is now the single active plan and covers C2-0 through C2-12, exact
  ownership, dependencies, acceptance tests, merge rules, cut lines, and recovery. The previous
  broad plan and `docs/C2_NOW.md` workflow were removed from the working tree and remain only in git
  history. Product implementation remains paused pending a new instruction.

## Computer 1 task tracker

| ID | Task | Status | Notes |
| --- | --- | --- | --- |
| C1-0a | Bootstrap repo | done | Landed on `main` at `136e13f` |
| C1-0b | Full scaffold on main | done | Landed on `main` at `73814e9` |
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
| C2-0 | Provision accounts and keys | human action required | Section 7 checklist; secrets must use a password manager, never git/chat |
| C2-1 | AI package, mocks, guard, budget, game prompts, smoke script | live verification pending | Implementation, C1-0b reconciliation, and all local checks pass; paid live smoke awaits C2-0 |
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
- **2026-10-24 · C1-0b integration** — Fetched `origin/main` at `73814e9` and rebased only
  `c2/intelligence` onto it. Resolved the scaffold conflicts by retaining C1's shared schemas and
  frozen public interface while preserving the C2 implementation behind them. Regenerated the
  dependency lockfile during the rebase; no C1 branch or `main` was modified.
- **2026-10-24 · C2-1 completion pass** — Replaced local schema authority with `@lore/shared`,
  completed all frozen game and guard methods, added retry/fallback behavior for Muse, Gemini, and
  SerpAPI, connected SerpAPI cache calls to C1's ioredis-compatible shape, and made degraded state
  explicit. Added six distinct image fixtures, two synthesized spoken WAV fixtures, schema checks
  for every structured fixture, media validation tests, and stricter live smoke failure detection.
  Removed the temporary AI-only dev watcher now that C1's real processes exist.
- **2026-10-24 · C2-1 integrated verification** — Repository typecheck, tests, lint, build, mock
  smoke, and `git diff --check` all pass. C2 has 17 passing tests across six files; shared policy has
  11 passing tests. Local configuration contains none of the required Meta, Gemini, or SerpAPI
  credentials, so the paid live smoke was not attempted and remains the only C2-1 done-condition
  outstanding.
