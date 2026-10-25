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

- Phase: C2-10 through C2-12 are implementation-green on the C2 branch. Final whole-workspace
  verification and the phone test run are in progress.
  C1 merge and live-provider acceptance remain open for the complete C2 P0 chain.
  C2-1's paid live smoke remains blocked on human-owned C2-0 credentials.
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
- C2-2 now includes the Milo/persona decision engine, deterministic hard gates and scoring, quiet
  hours and budgets, privacy-redacted prompt assembly, grounded structured decisions, guarded and
  labeled output, low/medium-sensitivity memory capture, tentative event capture, decision logs,
  explanation data, delayed message and repeating tick jobs, member/admin-scoped APIs, and the basic
  persona studio with disclosure, mute/remove, preview, memory controls, and explanation UI.
- C2-3 now includes idempotent/retryable batch voice jobs, signed-media download, real ffmpeg
  normalization to metadata-free mono 24 kHz PCM16 WAV, a six-second deadline, grounded member and
  persona keywords, transcript persistence and message refresh, degraded/failure metadata, audit
  records, an authenticated and membership-scoped realtime proxy, exact 80 ms frame enforcement,
  cumulative transcript relay, and browser-side resampling/caption UI with no provider secret.
- C2-4 supplies grounded fair plans, voting, confirmation, RSVP/calendar behavior, and Plans UI.
  C2-5 supplies consent-aware, grounded, private-by-default recaps, metadata-free Sharp layouts,
  recap editing/sharing/proposal behavior, and Memories UI.
- C2-6 supplies one-time-reveal, SHA-256-only scoped PATs; token management and Connect Muse UI;
  a stateless Streamable HTTP MCP server; all 11 required model-readable tools; explicit write
  confirmation; actor-safe plan votes; membership-scoped reads; and sanitized success/denial/error
  audits. Unavailable C1/later-C2 tool integrations fail closed.
- C2-7 supplies explicitly targeted, deterministic seed/reset tooling with six demo users, two
  governed groups, Milo, 90 grounded messages, preferences/memories, consent-scoped media, social
  posts, a plan/event/private recap, Austin candidates, discovery matches, and family-story inputs.
  Paid seed-image and live Serp refresh commands require dedicated confirmation.
- C2-8 supplies a skippable eight-question quiz, default-off discovery profile, safe public signal
  inference with 14-day decay/removal/freeze, embeddings and top-30 reranking, permitted-tag-only
  cached reasons, match cards, editable intro requests, recipient accept/decline, and a proposal-only
  MCP action. It never accepts private chat content and does not open a DM before C1 integration.
- C2-9 supplies allowlisted pseudonymous product events, composite cursor sync in batches of 500,
  idempotent Snowflake SQL API v2 `MERGE`, six aggregate views, optional aggregate-only Cortex pulse,
  cached/local degradation, the public summary route, metric cards, and two small charts.
- C2-10 supplies date-scoped, consent-only source selection; contributor-owned exclusion and
  correction; grounded private story composition; visible sentence/source/contributor links;
  unresolved-flag blocking; private sharing; and a governed C1 draft handoff with no direct public
  publish path. A production-disabled demo identity bridge lets the seeded local UI work before C1
  auth lands.
- C2-11 supplies a frozen current-member cast, root and child stations, exactly-20-second owned
  voice submissions, one clip per person/station/day, transcript/uploader attribution, engagement
  and missing-member state, host wrap/finish gates, and MP3 composition in station order with
  300 ms gaps and intro/outro tones. The optional MP4 render was deliberately cut. Seeded exact
  clips and a mobile recorder make the flow testable before C1's upload/storage implementation.
- C2-12 supplies four distinct Muse Image house-style avatar choices, selected-only C1 media
  persistence, tone/interests/boundaries, time-zone-aware quiet hours, permission controls, and
  exactly three preview-only scenarios with no join or memory write. Loading, empty, degraded,
  error, dark, mobile, accessibility, reduced-motion, and the three required AI labels are present.
  `/c2-lab` links Family, Podcast, and Advanced Persona into one seeded test lobby.
- Full verification passes: six workspace typechecks and 110 tests across 28 files, whole-workspace
  Biome over 444 files, mock smoke, production web/API builds, and a direct
  browser-bundle provider-secret scan, and `git diff --check`.
  The mock smoke validates 11 JSON fixtures, 6 images, 2 voice fixtures, 5 choices, 3 prompts, guard,
  and budget paths without credentials or network calls.
- The temporary `packages/ai` dev watcher is removed. Root `pnpm dev` uses C1's actual web, API,
  worker, and MCP processes. Rootless Podman can provide isolated PostgreSQL and Redis-compatible
  test containers even though the Docker daemon socket remains unavailable. The local image lacks
  TimescaleDB/Vectorscale, so hypertable, aggregate, and DiskANN setup warnings remain expected.
  A real SDK client listed all 11 MCP tools, ran an authenticated read, verified its audit row, and
  received HTTP 401 immediately after revocation. No development process or temporary container
  should be assumed to survive an agent handoff.
- `docs/IMPLEMENTATION_PLAN.md` is now the single active plan and covers C2-0 through C2-12, exact
  ownership, dependencies, acceptance tests, merge rules, cut lines, and recovery. The previous
  broad plan and `docs/C2_NOW.md` workflow were removed from the working tree and remain only in git
  history. C2-10 is the next ordered milestone and requires a new human continuation instruction.

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
| C2-2 | Milo persona, proactivity, memory, basic studio | integration pending | Implementation and local checks pass; requires C1-4 hook plus live DB/Valkey acceptance |
| C2-3 | Voice transcription and live captions | integration pending | Implementation and local checks pass; requires C1 auth/media/chat merge and live Muse acceptance |
| C2-4 | Concierge and plans | integration pending | Core service, routes, UI, realtime, calendar, and seven focused tests pass; C1 chat/auth merge and live providers remain |
| C2-5 | Shared memories and recaps | integration pending | Service, grounding, consent, Sharp layouts, editor/cards, and ten focused tests pass; C1 media/chat/group/story integration remains |
| C2-6 | Muse MCP connector | integration pending | PATs, UI, 11 tools, confirmation/scopes/audits, SDK smoke, and immediate revocation pass; C1 game/approval plus later C2 services remain |
| C2-7 | Seed and demo reset | integration pending | Seed 382 ms, reset 201 ms, consent/secret audits pass; C1 demo auth/media and browser chain remain |
| C2-8 | Find Friends and Common Ground | integration pending | Seven focused tests and typechecks pass; C1 public-signal/block/DM hooks remain |
| C2-9 | Snowflake impact | live verification pending | Service, sync, six views, route/UI, six tests, and local smoke pass; live Snowflake/Cortex awaits C2-0 |
| C2-10 | Family story | implementation complete | C1 draft/media integration remains |
| C2-11 | Podcast stations and render | implementation complete | Audio retained; MP4 cut; C1 media integration remains |
| C2-12 | Advanced persona studio and AI polish | implementation complete | C1 selected-avatar media persistence remains |

## Things that need a human (cannot be done by the agent)

- Add the teammate (Computer 2) as a collaborator on `hamizfaraz/lore` — GitHub username not known to the agent.
- Complete C2-0 from plan section 7: Meta Model API key and HackTX credit, Meta developer app
  and Tester accounts, Muse app sign-in, SerpAPI credits, Gemini key, a Computer 2 Tiger Data dev
  service, Snowflake trial/PAT/network policy, Vultr account/Object Storage, and `ourlore.tech`.
- Share C2-0 secrets through a password manager only. Do not paste them into chat or commit them.

## Deviations from the plan

_Record every deviation in `docs/IMPLEMENTATION_PLAN.md` and in the log below so the plan stays true._

- On October 24, 2026, the human explicitly authorized starting the next milestone while C2-1's paid
  live smoke remained blocked on C2-0 credentials. C2-2 was implemented under section 6's explicit
  human-change exception; the outstanding C2-1 live check remains required.
- On October 24, 2026, the human again explicitly authorized the next milestone while C2-2 integrated
  acceptance remained open. C2-3 was implemented under section 6's exception; neither C2-2 nor
  C2-3 integration acceptance is waived.
- On October 24, 2026, the human explicitly authorized the next three milestones (C2-4 through
  C2-6) while prior integrated/live acceptance remained open. Work proceeds under section 6's
  exception without waiving any prior acceptance check.

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
- **2026-10-24 · Local test run** — Started the rebased application with `AI_MODE=mock` and verified
  the web server returns HTTP 200 at `http://localhost:3000`; opened the visible `/login` scaffold
  for the human to test. The API, worker, and MCP initially listen but exit after ioredis exhausts
  retries because Valkey is unavailable. Docker cannot be used by the current user due daemon-socket
  permissions. The web process remains running, and the separate AI mock smoke is fully green.
- **2026-10-24 · C2-2 explicitly authorized** — The human instructed Computer 2 to start the next
  milestone. Recorded this as the section 6 exception because the C2-1 paid live smoke is still
  blocked on human-owned provider credentials. Fetched `origin/main` and confirmed it remains at
  `73814e9`; no C1 branch or `main` was modified.
- **2026-10-24 · C2-2 persona engine** — Implemented the C2-owned persona policy, repository, service,
  routes, jobs, typing event, and shared request/response contracts. The engine applies disclosure,
  consent redaction, conversation isolation, quiet/mute/spacing/typing/budget gates, deterministic
  scoring, grounded news and references, guard checks, low/medium-sensitivity memory persistence,
  tentative event persistence, rare-image limits, decision logging, and C1 chat/media integration
  interfaces. Added a C1 handoff for the post-commit human-message hook.
- **2026-10-24 · C2-2 studio and verification** — Implemented the basic persona studio, preview and
  join controls, mute/remove UI, memory correction/deletion, explanation sheet, and AI-illustration
  label. Added 23 focused persona tests. The full workspace passes typecheck, 51 tests (17 AI, 14
  shared, 20 API), Biome over 404 files, production web/API build, and `git diff --check`. Integrated
  acceptance remains open until C1-4 supplies the hook and PostgreSQL/Timescale plus Valkey are
  reachable; C2-3 has not started.
- **2026-10-24 · C2-3 explicitly authorized** — The human instructed Computer 2 to implement the
  next milestone while C2-2 integration remained pending. Fetched the agreed checkpoints:
  `origin/main` remains `73814e9`; `origin/c1/platform` is `f610144` and contains the in-progress
  recording/media/chat hooks needed at merge. C2 remained based only on `main`, and no C1 branch or
  `main` was modified.
- **2026-10-24 · C2-3 voice runtime** — Implemented the batch transcription service/route/job,
  C2-owned voice repository and privacy-safe audit record, signed-media download, real ffmpeg
  normalization, retries and terminal failure handling, degraded labels, message refresh, six-second
  deadline, authenticated/membership-scoped raw WebSocket proxy, exact 80 ms PCM framing, server-side
  Muse handshake, cumulative partial/final relay, uploader attribution, clean shutdown, and the
  browser `LiveCaption` client. Added merge handoffs for C1's existing media/recorder hooks and
  degraded transcript rendering.
- **2026-10-24 · C2-3 verification** — Added 18 focused tests, including a real ffmpeg conversion.
  Full verification passes 69 tests (18 AI, 16 shared, 32 API, 3 web), six typechecks, Biome over 414
  files, mock provider smoke, production web/API build, browser-bundle provider-secret scan, and
  `git diff --check`. Live batch/realtime acceptance remains blocked on C2-0 Muse credentials and the
  C1 auth/media/chat merge; C2-4 has not started.
- **2026-10-24 · C2-4 concierge/plans** — Implemented membership-scoped preferences, grounded
  candidate discovery and persistence, embeddings, hard filters, unknown-price handling, an
  at-home guarantee, maximin/diverse ranking, proposal/version/vote/refine/confirm/RSVP behavior,
  calendar output, `plan.updated`, source labels, fair-fit cards, confirmed cards, and the Plans
  surface. Seven focused tests plus shared/API/web typechecks pass. Chat-card integration remains
  pending on C1's frozen service implementations; C2-5 is next.
- **2026-10-24 · C2-4 checkpoint** — Committed and pushed the resumable plans milestone as
  `1c5b015` on `c2/intelligence`; `main` and C1 branches were untouched.
- **2026-10-24 · C2-5 memories/recaps** — Implemented confirmed-plan event creation, proximity
  clustering, pHash duplicate removal, consent propagation, real 1024 px signed-photo review,
  grounded recap composition, four metadata-free 1080×1350 Sharp layouts, private recap storage,
  AI labels, editor/list/card UI, owner revocation, private save/chat share, and governed C1 draft
  handoff. Ten focused tests and API/web typechecks pass. C1's unprovided story-creation interface
  remains a fail-closed handoff; C2-6 is next.
- **2026-10-24 · C2-5 checkpoint** — Committed and pushed the resumable memories milestone as
  `8c2fc25` on `c2/intelligence`; no other branch was modified.
- **2026-10-24 · C2-6 scoped MCP connector** — Implemented unbiased base62 PAT generation,
  SHA-256-only persistence, one-time UI reveal, session-authenticated token management, immediate
  revoke, the Connect Muse surface, and a stateless Streamable HTTP MCP server. All 11 required
  tools are advertised with use/non-action descriptions. Every valid call is scope checked and
  audited; writes additionally require explicit confirmation; plan votes use only the PAT owner;
  private recap and unavailable family operations cannot publish directly. C1-owned approval/game
  and later-C2 family/discovery integrations fail closed and are recorded in the handoff.
- **2026-10-24 · C2-6 verification** — Added 11 focused policy/service tests. Full verification
  passes six typechecks, 97 tests (18 AI, 16 shared, 60 API, 3 web), Biome over 428 files, mock AI
  smoke, production web/API builds, and `git diff --check`. Against the isolated local PostgreSQL
  and Valkey containers, an actual SDK client completed the Streamable HTTP handshake, listed all
  11 tools, executed `list_groups`, and produced a credential-free audit row. Revoking the
  disposable PAT caused the next request to return HTTP 401 immediately. A live plan-vote UI smoke
  remains gated on C1 auth/chat implementation and C2-7 demo seed data.
- **2026-10-24 · C2-7 deterministic demo world** — Added target-safe seed/reset tooling, explicit
  live candidate refresh, and paid seed-art generation. The dataset creates six demo users,
  `@weekendcrew`, `The Iqbals`, governance, Milo, 90 grounded messages, stated constraints, memories,
  consent-scoped image/voice rows, labeled AI art, posts, candidates, a voting proposal, a completed
  plan/event/private recap, discovery profiles, and family-story inputs. Ambiguous/default database
  selection and unconfirmed live/paid commands are rejected.
- **2026-10-24 · C2-7 verification** — Against only the explicitly selected `127.0.0.1/lore`
  container, seed completed in 382 ms and the documented reset reproduced it in 201 ms. Consent
  audit totals were 90 messages, seven opted-in memberships, two included recap media, and five
  explicitly scoped assets; the seed-source secret scan and `git diff --check` pass. C1 demo login,
  physical media materialization, and the three-minute browser chain remain an integration handoff.
- **2026-10-24 · C2-8 Common Ground** — Implemented the optional interest quiz, default-off
  discoverability, safe caption tags, five public signal kinds, 14-day decay, explicit removal and
  freeze, profile embeddings, existing-follow exclusion, top-30 Jaccard/cosine/serendipity ranking,
  24-hour pair reasons restricted to shared tags, match UI, and editable consent-gated introductions.
  Declines have no side effect and accepted state does not create a DM until C1 supplies that hook.
- **2026-10-24 · C2-8 verification** — Seven focused policy/service tests and shared/API/web
  typechecks pass. The MCP Common Ground tool now prepares an unsent editable proposal after explicit
  confirmation. C1 public-action signals, block exclusion, and post-accept DM creation are recorded
  as merge handoffs; C2-9 is next.
- **2026-10-24 · C2-9 impact analytics** — Added a fixed event allowlist, SHA-256 hashes for
  group/actor/object identities, strict coarse-property sanitization, random event ids, and a
  timestamp/event-id sync cursor. The 60-second worker sends at most 500 rows through Snowflake SQL
  API v2 using PAT auth, bounded retries, stable request ids, and idempotent `MERGE`; six secure views
  drive the required metrics. Cortex sees only aggregate metric keys and numbers.
- **2026-10-24 · C2-9 local acceptance** — Applied the two analytics cursor columns to the isolated
  local database. A 90-second intent-to-confirm pair appeared immediately as one confirmed plan per
  active group and a 1.5-minute median; the public DTO contained no raw group id. Snowflake correctly
  reported unconfigured without advancing its cursor. Six focused tests and affected typechecks pass;
  live Snowflake/Cortex verification remains blocked on human-owned C2-0 credentials.
- **2026-10-24 · Three-milestone verification** — C2-7, C2-8, and C2-9 now pass all six workspace
  typechecks, 110 tests across 28 files, Biome over 444 files, mock provider smoke, production API
  and web builds, and `git diff --check`. The impact and Find Friends routes are present in the
  production route manifest. Paid-provider, live Snowflake, and C1 merge acceptance remain explicit.
- **2026-10-24 · Pre-checkpoint remote audit** — A read-only fetch confirmed `origin/main` remains
  `73814e9`. `origin/c1/platform` advanced independently to `14fe779`; C2 did not merge, copy, or
  modify that branch, preserving the agreed integration boundary.
- **2026-10-24 · C2-10 Family Story** — Implemented consented date-range collection, per-contributor
  source control, media transcript/caption context, strictly grounded structured composition,
  source-visible private review, correction-based flag resolution, share blocking while any flag is
  open, private sharing, and governed public-draft delegation. Added the mobile review/generate/share
  UI plus a non-production seeded-demo identity bridge because C1 authentication is still a stub.
  Shared/API/web typechecks and three grounding tests pass. C1 media URLs/covers and the group draft
  service remain merge-time integrations; C2-11 is next.
- **2026-10-24 · C2-11 Podcast Stations** — Implemented show/cast freeze, root and branch stations,
  exact 20-second owned voice validation, database daily uniqueness, voice-only APIs, visible
  uploader attribution, host wrap and missing-participant finish gates, ordered ffmpeg MP3 output,
  300 ms gaps, and intro/outro tones. Added the mobile 20-second recorder and a deterministic seeded
  show with three submitted clips plus Noor's missing clip for the end-to-end gate demo. Reset the
  isolated local database in 237 ms; it now contains nine consent-scoped media rows. Focused policy
  tests and affected typechecks pass. Optional MP4 is cut; C1 signed-media/storage remains the final
  production integration. C2-12 is next.
- **2026-10-24 · C2-12 Advanced Persona Studio** — Added four distinct house-style Muse Image
  avatar choices, a selected-only storage boundary, editable tone/interests/boundaries, quiet hours
  in the browser's IANA time zone, existing permission controls, and exactly three preview-only
  scenarios that never join the chat or write memories. Applied AI assistant, Generated with AI,
  and Why labels to every preview; completed loading/empty/degraded/error/mobile/dark/reduced-motion
  states. Added `/c2-lab` as a single seeded launcher for milestones 10–12 and extended the local
  demo identity bridge to the persona routes. Focused shared/AI/API tests and affected typechecks
  pass; final whole-workspace verification and phone smoke are next.
