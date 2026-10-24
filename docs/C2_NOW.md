# LORE — Computer 2: What Must Be Built Now

## Purpose

This file is the immediate execution boundary for Computer 2. It translates the supplied full
implementation plan into the work that is eligible **now**, based on the repository's actual state.
It is a planning artifact only and does not authorize feature implementation by itself.

**Current decision:** finish C2-0 and C2-1 only. Do not begin C2-2 or any later feature yet.

## Source and current-state assumptions

- Source: `/home/shreekar/Downloads/LORE — Full Implementation Plan (HackTX 2026 · Meta Track).md`
  (SHA-256 `15023d900f450ee1ba7c4303ba7300f0ff4fa1db8de1e111e18361dd2b28c231`).
- The supplied file is identical to the repository's original implementation plan through section
  17. The repository copy additionally contains section 18 implementation notes.
- As verified on October 24, 2026, `origin/main` is still `136e13f` (C1-0a only). C1-0b's shared
  contracts, schemas, module stubs, application shell, and runtime entrypoints have not landed.
- Computer 2 works only on `c2/intelligence`. The branch head before this document is `86ea924`.
- C2-1 has a substantial partial implementation in `packages/ai`: provider adapters, structured
  output handling, mock fixtures, budgets, guardrails, game helpers, anti-hallucination filters,
  tests, smoke command, and a temporary mock watch harness.
- C2-0 external accounts and live credentials have not been confirmed. No secret belongs in git,
  this file, or chat.

## Build now

### 1. C2-0 — human provisioning

The human owner must provision and securely share every required value before C2-1 can pass live:

- Meta Model API key, HackTX credit, and a successful model listing to confirm `MUSE_TEXT_MODEL`.
- Meta developer app, Facebook Login configuration, and teammate/demo Tester accounts.
- Muse app access on the presenter's phone.
- SerpAPI HackTX credits and key.
- Gemini API key plus the current Flash model id for `GEMINI_GUARD_MODEL`.
- A Computer 2 Tiger Data development service and `DATABASE_URL`.
- Snowflake trial, PAT, role, warehouse, database, Cortex model, and network policy.
- Vultr account/Object Storage, `ourlore.tech`, and the remaining section 14 infrastructure values.

Completion evidence: the section 14 variables exist in a local environment or password-manager
share, and a secret scan confirms none were committed.

### 2. C2-1 — finish `packages/ai`

The current code is not allowed to be called complete until all of the following are done:

1. **Wait for C1-0b on `main`, then rebase.** Run the section 12 resume procedure. Do not copy or
   recreate C1's scaffold on this branch.
2. **Reconcile with shared contracts.** Use C1-0b's schemas from `@lore/shared`, especially
   `SpeakDecision`, `GroupIntentBrief`, `PlanRanking`, `PhotoNotes`, `RecapDraftSpec`,
   `FiveWordChoices`, `GamePrompt`, `MemeEntrySpec`, `FamilyStorySpec`, `CommonGroundReason`, and
   `GuardVerdict`. Remove duplicate local schema authority while preserving C2-owned behavior. Any
   necessary shared change must be additive and logged under Computer 2 in `docs/CONTRACTS.md`.
3. **Finish realistic mock assets.** The branch currently has six valid but identical 1×1 PNG
   buffers and two silent WAV containers. Replace them with six representative pre-rendered mock
   images and two short spoken WAV fixtures/transcripts, while keeping them safe and license-free.
4. **Run and correct the live clients.** With C2-0 credentials, execute `pnpm ai:smoke` once against
   Muse Spark, Muse Image, Muse Voice batch transcription, Gemini embeddings/guard, and SerpAPI.
   Confirm the actual Meta model ids with the live model list. Fix only C2-owned adapter code.
5. **Connect infrastructure through C1's stubs.** After the scaffold exists, verify that the SerpAPI
   six-hour cache and AI budgets can use C1's Valkey client through the existing injected interfaces.
   Request any C1-owned wiring in `docs/HANDOFF.md`; do not implement C1's Redis/runtime library.
6. **Prove mock and degraded behavior.** Every structured fixture must validate against the shared
   schema. Invalid output must produce one repair attempt and then a schema-valid mock fallback with
   `degraded: true`. Model-supplied ids outside the input sets must be dropped or rejected exactly as
   section 7 requires.
7. **Preserve C1-facing game exports.** `ai.games.*` must provide prompt generation, five distinct
   single-word choices, meme entries, lore eligibility rules, and the random fallback when fewer
   than three safe memories exist.
8. **Reconcile the temporary runner.** `packages/ai/src/dev.ts` exists only so current C2 code can
   run before C1-0b. When C1's real web/API/worker `dev` scripts arrive, keep, adapt, or remove this
   harness based on the integrated toolchain. It must never replace the actual application runtime.

### Files in immediate C2 scope

- `packages/ai/**`
- `pnpm-lock.yaml` only as produced by dependency installation; merge rule M2 applies
- `docs/CONTRACTS.md` under `## Computer 2`, only for additive contract changes
- `docs/HANDOFF.md` under `## Computer 2`, for requests to C1
- `docs/PROJECT_CONTEXT_LOG.md`, `docs/IMPLEMENTATION_PLAN.md`, and this file for status only

Do not create application modules, route files, database schema files, or UI feature files before
C1-0b creates the named scaffold.

## Do not build yet

- **C2-2 Milo/persona:** blocked until C2-1 is complete and C1-4 provides the
  `persona.service.onMessage` chat hook.
- **C2-3 voice feature integration:** do not skip ahead even though its direct dependency is C2-1;
  the Computer 2 task list is explicitly ordered.
- **C2-4 through C2-12:** plans, memories, MCP, seed data, discovery, impact, family story, podcast,
  and advanced persona studio all remain out of scope for the current gate.
- Do not modify C1-owned root configuration, infrastructure, tokens, server entrypoints, runtime
  libraries, platform modules, UI primitives, platform features, route wrappers, or frozen
  registries.
- Do not implement a substitute web app or API merely to make the current branch look runnable.

## Dependencies and blockers

| Blocker | Owner | What unblocks C2 |
| --- | --- | --- |
| C1-0b is absent from `main` | C1 | Full scaffold merged to `main`; C2 rebases before continuing |
| C2-0 accounts and credentials are unconfirmed | Human/C2 | Values supplied through a password manager/local environment |
| C1-4 chat hook is absent | C1 | `persona.service.onMessage` call after human message insertion |
| Root `biome.json` formatting fails workspace lint | C1 | C1 formats its owned file; existing handoff item is resolved |
| Shared schemas do not exist yet | C1-0b | C2 consumes them after rebase; additive fixes use contract protocol |

Do not inspect, copy from, or merge the in-progress C1 feature branch. The synchronization point is
the plan-defined C1-0b commit on `main`.

## Required verification

Before C2-1 can be marked done:

- `pnpm --filter @lore/ai typecheck`
- `pnpm --filter @lore/ai test`
- `pnpm exec biome check packages/ai`
- `AI_MODE=mock pnpm ai:smoke`
- `AI_MODE=live pnpm ai:smoke` with every required provider called once
- Whole-workspace `pnpm typecheck`, `pnpm lint`, and `pnpm test` after rebasing on C1-0b
- Secret scan and `git diff --check`
- Conventional C2 commit, pushed to `origin/c2/intelligence`
- Context log and implementation notes updated with exact results and remaining blockers

## Definition of this handoff

This file has done its job when another developer can open the repository and immediately know:

1. only C2-0/C2-1 are eligible now;
2. what already exists in C2-1;
3. what must still be made or verified before C2-1 is complete;
4. which work is blocked on C1 or human credentials; and
5. that no C2 product feature should begin until the ordered dependency gate is satisfied.
