# LORE — Computer 2 Full Implementation Plan

## 1. Purpose and Authority

This document is the complete and sole operational implementation plan for Computer 2. It is
self-contained so another developer or coding agent can resume without reconstructing ownership,
dependencies, acceptance criteria, or branch state from an older workflow.

Authority order:

1. The human's direct instructions in the current conversation.
2. This implementation plan.
3. `docs/CONTRACTS.md`, `docs/HANDOFF.md`, and `docs/PROJECT_CONTEXT_LOG.md` as supporting records.

The previous broad/two-lane planning workflow and the temporary `C2_NOW.md` workflow are retired.
They are available only through git history and must not be treated as active instructions. If a
supporting record conflicts with this file, this file controls unless the human says otherwise.
Creating or editing this planning artifact does not authorize product implementation on its own.

## 2. Computer 2 Mission

Computer 2 builds LORE's intelligence layer:

- Provider abstraction and deterministic AI behavior.
- Milo's persona, memory, proactivity, explainability, and controls.
- Voice transcription and live captions.
- Group Concierge recommendations and collaborative planning.
- Shared memories, recaps, and family stories.
- The Muse MCP connector and personal access tokens.
- Demo seed/reset tooling.
- Find Friends and Common Ground.
- Privacy-safe Snowflake impact analytics.
- Voice-only podcast stations and rendering.
- Advanced persona-studio polish.

C2 must make the AI useful, honest, private, source-grounded, and degradable. C2 does not own the
social platform, chat engine, group approval engine, infrastructure, shared UI primitives, or root
tooling.

## 3. Ownership Boundaries

### C2-owned paths

- `packages/ai/**`
- `packages/db/src/schema/{persona,plans,memories,family,podcast,discovery,integrations}.ts`
- `packages/db/sql/003-005*`
- `apps/api/src/modules/{persona,plans,memories,family,podcast,discovery,impact,mcp,voice}/**`
- `apps/web/src/features/{persona,plans,memories,family,podcast,discovery,impact,connect-muse,voice}/**`
- Thin route wrappers that render C2-owned feature pages from the scaffolded app route map
- `scripts/**`

### Shared paths with strict rules

- `packages/shared/**`: additive changes only after C1-0b; log every change under
  `## Computer 2` in `docs/CONTRACTS.md`.
- `docs/CONTRACTS.md`, `docs/HANDOFF.md`, and `.env.example`: append or edit only the C2 section;
  do not rewrite C1 entries.
- `pnpm-lock.yaml`: change only through dependency installation; regenerate it after merge conflicts.
- `docs/IMPLEMENTATION_PLAN.md` and `docs/PROJECT_CONTEXT_LOG.md`: keep the plan checklist and current
  state accurate after every meaningful pass.

### C1-owned or frozen paths

C2 must not modify root config, `.github/**`, `infra/**`, `packages/tokens/**`, C1 schema/SQL files,
C1 API modules, C1 web features, shared UI/lib folders, entrypoints, or frozen registries and index
files. Specifically, do not edit:

- `apps/api/src/{server,mcp,worker}.ts`
- `apps/api/src/lib/**`
- `apps/api/src/modules/index.ts`
- `packages/db/src/schema/index.ts`
- `apps/web/src/features/chat/cards/registry.tsx`
- `apps/web/src/features/chat/toolbar/registry.ts`
- `apps/web/src/features/groups/space/tabs.ts`

If C2 needs a change in one of those paths, add a precise `C2->C1` request to `docs/HANDOFF.md` and
continue against the existing typed stub or a local test fake.

## 4. Cross-Computer Coordination Rules

1. Work only on `c2/intelligence`. Never commit C2 work to `main`, `c1/platform`, or another branch.
2. Rebase only from the agreed `origin/main` checkpoint; never copy from C1's in-progress branch.
3. Execute C2-0 through C2-12 in table order. Do not skip ahead because a later direct dependency
   happens to be available.
4. Use C1's typed service stubs; never implement the C1 side of a cross-owner call.
5. Check `docs/HANDOFF.md` before each task and checkpoint. Record new requests immediately.
6. Push small Conventional Commits using the C2 scope, ideally at least every 45 minutes.
7. Before every push: run the relevant package checks, whole-workspace typecheck/tests when the
   scaffold supports them, and `git diff --check`.
8. Never store secrets in git, docs, terminal transcripts intended for sharing, or chat. Secrets
   belong in a password-manager share and ignored local environment files.
9. AI-generated, cached, or degraded content must be labeled honestly in data and UI.
10. Update this plan's checklist plus the project context log after every meaningful step.

## 5. Current Repository Baseline

Status as last verified on October 24, 2026:

- C2 is isolated in a dedicated worktree on `c2/intelligence`.
- `origin/main` is at C1-0b commit `73814e9`, and `c2/intelligence` has been rebased onto it.
- C2-0 external access and credentials are not confirmed.
- C2-1 is implemented in `packages/ai` against C1's shared schemas and frozen game/guard interface:
  provider adapters, structured-output repair/fallback, retry policy, deterministic mocks, budgets,
  guard and reference validation, prompts, game helpers, and live/mock smoke coverage.
- Mock fixtures now include six distinct 128x128 images and two short spoken mono PCM16 24 kHz WAV
  samples. The temporary AI watch harness has been removed in favor of C1's real dev processes.
- All repository verification passes: six workspace typechecks, Biome over 414 files, 69 tests,
  mock smoke, and the production web/API build.
- C2-1 is awaiting only the paid live smoke required by its done condition. That is blocked on the
  human-owned C2-0 provider credentials and model ids, which are not present locally.
- The web scaffold runs at `http://localhost:3000` in mock-AI mode. On this machine the API, worker,
  and MCP processes require Valkey and exit because no local Valkey is running and the current user
  cannot access the Docker daemon; this is an environment prerequisite, not a C2-1 package failure.
- At the human's explicit direction, C2-2 implementation began before the C2-1 paid live smoke.
  The persona engine, APIs, jobs, basic studio, explanations, memory controls, and focused tests are
  implemented on the C2 branch. Integrated acceptance still requires C1-4's committed-message hook
  plus a reachable database and Valkey runtime.
- At the human's explicit direction, C2-3 implementation also began before C2-2 integrated
  acceptance. Batch voice jobs, ffmpeg normalization, transcript persistence/update behavior, the
  authenticated live proxy, browser PCM framing/captions, and the required test matrix are green.
  End-to-end acceptance still requires C1's auth/media/chat work to merge and C2-0 live Muse access.

Before resuming implementation, fetch `origin/main` and compare its head with this baseline. Do not
begin C2-4 until C2-2 and C2-3 are integrated and accepted, unless the human explicitly changes the
plan.

## 6. Dependencies and Execution Order

| Order | Task | Tier | Depends on | Current state |
| --- | --- | --- | --- | --- |
| 0 | C2-0 provisioning | P0 | — | Human action required |
| 1 | C2-1 AI provider core | P0 | C1-0a; rebase on C1-0b | Implementation green; live smoke blocked on C2-0 |
| 2 | C2-2 Milo/persona | P0 | C2-1, C1-4 hook | Implementation green; integration pending |
| 3 | C2-3 voice | P0 | C2-1 | Implementation green; C1 merge/live acceptance pending |
| 4 | C2-4 Concierge/plans | P0 | C2-2 | Implementation green; C1 integration pending |
| 5 | C2-5 memories/recaps | P0 | C2-1, C1-2, C1-5 stub | Pending |
| 6 | C2-6 MCP connector | P0 | C2-4 | Pending |
| 7 | C2-7 demo seed/reset | P0 | C2-2, C2-4 | Pending |
| 8 | C2-8 discovery | P1 | C2-1 | Pending |
| 9 | C2-9 impact | P1 | C2-4 | Pending |
| 10 | C2-10 family story | P1 | C2-5 | Pending |
| 11 | C2-11 podcast | P2 | C2-3 | Pending |
| 12 | C2-12 advanced persona | P2 | C2-2 | Pending |

Task order is binding. A task starts only after its dependencies and the previous C2 task are done
or the human explicitly changes the plan. P0 is the protected demo chain; P1 follows only after P0
is stable; P2 is cut first.

## 7. C2-0 — Human Provisioning and Access

### Objective

Make every external service available early so provider details, credits, and deployment settings
cannot block integration. The human creates accounts; the agent may provide steps and verify local
configuration without exposing secret values.

### Provisioning checklist

- Meta Model API: account, HackTX $50 credit request, API key, successful `/v1/models` call, chosen
  `MUSE_TEXT_MODEL`, confirmed image and voice model ids.
- Meta for Developers: Consumer app, Facebook Login, redirect URIs, teammates and demo accounts as
  Testers, current Graph version.
- Muse app: presenter signed in on the demo phone and eligible for custom integrations.
- SerpAPI: HackTX credits redeemed and API key available.
- Gemini: API key, `gemini-embedding-001`, and a verified current Flash guard model id.
- Tiger Data: separate C2 development service with vector extensions and a private `DATABASE_URL`.
- Snowflake: trial, `LORE` database, `LORE_WH` XS warehouse with auto-suspend, role, PAT, Cortex
  model, and network policy for the Vultr IP.
- Vultr: account/credits and Object Storage credentials. C1 owns VM creation/deployment.
- `.TECH`: `ourlore.tech` registration and DNS inputs for C1.
- GitHub: both teammates have repository access and Actions can run.
- Optional P2: Solana devnet information, only if the team keeps keepsakes in scope.

### Required local configuration

| Area | Variables |
| --- | --- |
| Runtime | `AI_MODE`, `DEMO_FAST_PROACTIVE`, C2 feature flags |
| Data | `DATABASE_URL`, `VALKEY_URL` |
| Media | `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` |
| Meta AI | `META_API_KEY`, `META_API_BASE`, `MUSE_TEXT_MODEL`, `MUSE_IMAGE_MODEL`, `MUSE_VOICE_MODEL` |
| Facebook | `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET`, `FB_GRAPH_VERSION` |
| Gemini/SerpAPI | `GEMINI_API_KEY`, `GEMINI_EMBED_MODEL`, `GEMINI_GUARD_MODEL`, `SERPAPI_KEY` |
| Snowflake | `SNOWFLAKE_ACCOUNT`, `SNOWFLAKE_PAT`, `SNOWFLAKE_ROLE`, `SNOWFLAKE_WAREHOUSE`, `SNOWFLAKE_DATABASE`, `SNOWFLAKE_CORTEX_MODEL` |
| Production handoff | `APP_URL`, `MCP_URL`, `VULTR_VM_IP` |

Defaults that are safe to commit belong in C1's `.env.example`; all real values remain local or in
the password manager. C2 requests additions through `docs/HANDOFF.md` instead of editing a C1-owned
environment file outside the shared C2 section.

### Completion evidence

- Every variable in the configuration table has a value in the password manager or ignored local
  environment when its feature is enabled.
- `GET /v1/models` confirms actual Meta model ids.
- No secret appears in git status, committed files, docs, logs, fixtures, or chat.
- C2's Tiger connection works with pool size at most five per process.

## 8. C2-1 — AI Provider Core and Mock Runtime

### Objective

Provide the only supported interface to Muse Spark, Muse Image, Muse Voice, Gemini, and SerpAPI,
with schema validation, budgets, retries, grounded-reference checks, deterministic mocks, and live
smoke coverage.

### Implementation status

The branch contains the provider clients, `callStructured`, mock mode, 11 structured JSON fixtures,
representative mock media, guard/budget helpers, prompts, anti-hallucination validation, C1-facing
game helpers, tests, and a live smoke entrypoint. All implementation and local integration work is
complete; only credential-gated live provider verification remains.

### Implementation sequence and progress

- [x] Rebase on C1-0b after it lands on `main`; run install and all checks before editing.
- [x] Replace local schema authority with the shared schemas exported by `@lore/shared`, preserving
   C2 behavior and using only additive contract changes if a gap exists.
- [x] Verify `packages/ai/src/index.ts` is the sole public import surface.
- [x] Verify every provider supports `AI_MODE=mock` without keys or network access.
- [x] Keep one validation repair attempt, then a schema-valid mock fallback marked `degraded: true`.
- [x] Enforce timeouts/backoff and the documented limits: 60 Spark calls per conversation/hour and
   40 images globally/hour through Valkey-compatible counters.
- [x] Connect SerpAPI's six-hour cache and budgets through C1's injected Valkey interface without
   implementing C1 runtime infrastructure.
- [x] Enforce reference integrity for memory, candidate, message, media, and user ids; force silence
   for unverified news; discard ranking options outside the retrieved candidate set.
- [x] Replace placeholder image/voice media with six representative, license-safe image fixtures and
   two short spoken WAV fixtures plus transcripts.
- [x] Preserve C1-facing game functions: five distinct one-word choices, game/lore prompts, meme
    entries, safety regeneration, and random fallback when fewer than three safe memories exist.
- [ ] With C2-0 credentials, run one paid live call for Spark, Image, batch Voice, Gemini embedding,
    Gemini guard, and SerpAPI. Test realtime Voice separately when its proxy exists.
- [x] Reconcile or remove the temporary `packages/ai/src/dev.ts` harness after C1's real web/API/
    worker dev scripts arrive.

### Provider and output matrix

| Capability | Provider/model | Structured output | Timeout |
| --- | --- | --- | --- |
| Milo decision, reply, memory/event extraction | Muse Spark, minimal | `SpeakDecision` | 8 s |
| Intent brief | Muse Spark, low | `GroupIntentBrief` | 10 s |
| Candidate ranking | Muse Spark, medium | `PlanRanking` | 15 s |
| Photo understanding | Muse Spark image input, minimal | `PhotoNotes[]` | 12 s |
| Recap composition | Muse Spark, low | `RecapDraftSpec` | 12 s |
| Game choices/prompts/memes | Muse Spark, minimal | `FiveWordChoices`, `GamePrompt`, `MemeEntrySpec` | 4–6 s |
| Family story | Muse Spark, medium | `FamilyStorySpec` | 20 s |
| Match explanation | Muse Spark, minimal | `CommonGroundReason` | 6 s |
| Images/covers/B-roll | Muse Image | bytes | 30 s |
| Batch/realtime transcription | Muse Voice | transcript events | 20 s/stream |
| Embeddings | Gemini `gemini-embedding-001`, 768 dimensions | vectors | 5 s |
| Safety | Current Gemini Flash | `GuardVerdict` | 3 s in parallel |
| Real-world retrieval | SerpAPI | normalized candidates | provider timeout + cache |

### Required verification

- Mock mode validates every shared output schema and uses no provider credential.
- Invalid JSON causes exactly one repair attempt, then a valid degraded fallback.
- Live smoke identifies the exact model ids and succeeds once per provider path.
- Provider 429/5xx behavior follows 0.5 s, 1 s, and 2 s backoff before degradation.
- Package typecheck, Biome, unit tests, mock smoke, whole-workspace typecheck/test/build, and
  `git diff --check` pass.

### Done when

`pnpm ai:smoke` passes live, mock mode returns valid deterministic fixtures for every schema and
provider, shared contracts are authoritative, C1 can import game helpers only from `@lore/ai`, and
the full integrated workspace is green.

## 9. C2-2 — Persona Engine and Milo

### Objective

Implement Milo as an openly disclosed AI member that can decide to speak, remember permitted facts,
explain itself, and remain silent when privacy, timing, safety, or group settings require it.

### Backend and data work

- Implement C2-owned persona schema behavior for `ai_personas`, `ai_memories`, and hypertabled
  `ai_decisions`; preserve the frozen schema index.
- Implement persona GET/PUT/test routes, service, policy, jobs, events, and tests.
- Implement `persona.service.onMessage(msg)` for C1's chat hook and repeatable `persona.tick` every
  120 seconds.
- Assemble prompts in the fixed order: persona, group, top six relevant memories, activity, last
  40 transcript messages. Replace non-consenting history with `[message hidden from AI]`.
- Apply deterministic prefilter triggers and hard gates before any model call.
- Apply the initiative thresholds and final score calculation specified in this task section.
- Emit `ai.typing`, use the human-like delay, post through C1's `chat.service.postMessage`, store
  the decision, and decrement budget.
- Embed low/medium-sensitivity extracted memories; discard high sensitivity. Never use deleted or
  expired memories.
- Upsert events with confidence at least 0.6; treat them as tentative until the memories workflow.
- Enforce rare-image permissions and one-per-week default.

### Proactivity specification

- Prefilter candidates: persona name/reply, a group question, plan/watch/meet/birthday/bored intent,
  photo/voice input, or a tick with a relevant opportunity after prolonged silence. Lively mode may
  sample 15% of other human messages.
- Hard-stop before the model when disabled/muted, in quiet hours, over the daily budget, within ten
  minutes of another AI message unless directly invoked, or within twenty seconds of a human
  message. Daily messages: quiet 3, balanced 8, lively 15.
- Model thresholds: quiet 0.80, balanced 0.65, lively 0.50; direct name/reply threshold 0.30.
- Final score: `0.45*model + 0.20*novelty + 0.20*receptivity + 0.15*timing - penalties`.
- Penalties: 0.30 for guard severity at least one; 0.20 for a surprise image after weekly budget.
- Typing delay: `1500 + 30 ms * characters`, capped at six seconds.
- The house rules require disclosure, human leadership, useful silence, grounding to supplied
  memories/candidates, private-preference protection, no sensitive inference, messages at most 280
  characters, no hashtags, and at most one emoji.

### UI work

- Basic persona studio: preset, custom name, initiative, permissions, boundaries, and join action.
- Post the full disclosure system message on join.
- Add mute for 1 hour, 8 hours, or until unmuted; remove persona.
- Add the "Why did Milo say this?" sheet using logged reason and permitted memory summaries.
- Add memory list/correct/delete controls.
- Fill only the C2 persona feature stubs and C2-owned route wrappers.

### Required tests

- Quiet hours, mute, budget, ten-minute spacing, named/reply override, and twenty-second typing gate.
- Initiative thresholds and deterministic score behavior.
- News without an input candidate forces silence.
- Cross-conversation messages and opted-out history are never exposed.
- Deleted/high-sensitivity memories cannot be used.
- Surprise-image weekly budget and permission gates.

### Done when

Milo can reply without an @mention when useful, stays silent while muted/quiet/ineligible, discloses
its permissions, never crosses conversation/privacy boundaries, and every AI message offers a
working explanation.

### Current implementation status

- Implemented the deterministic prefilter, hard gates, thresholds, scoring, quiet hours, budgets,
  typing delay, message-style rules, privacy filtering, grounded decisions, and image permission
  checks.
- Implemented member/admin-scoped persona, mute, test, memory, and explanation APIs; decision logs;
  low/medium-sensitivity memory persistence; grounded tentative event persistence; the 120-second
  tick; and the delayed human-message hook entry point.
- Implemented the basic persona studio, join disclosure, mute/remove controls, memory correction and
  deletion, explanation sheet, and labeled AI-image card.
- Focused persona coverage passes 23 tests; full workspace verification passes 51 tests, typecheck,
  lint, production build, and `git diff --check`.
- Acceptance remains open until C1-4 calls `persona.service.onMessage` after committing each eligible
  human message and the flow is exercised against reachable PostgreSQL/Timescale and Valkey services.

### Recorded plan deviation

On October 24, 2026, the human explicitly instructed Computer 2 to start the next milestone. Under
the execution-order exception in section 6, C2-2 work therefore began while C2-1's paid live smoke
remained blocked on human-owned C2-0 credentials. This does not waive either live verification or
C2-2 integrated acceptance.

## 10. C2-3 — Voice Runtime

### Objective

Provide authoritative batch transcription for voice notes and optional realtime captions without
ever exposing the Meta key to the browser.

### Implementation sequence

1. Implement `voice.service.transcribeMedia(mediaId)` for C1 callers.
2. Read the signed media, convert it with ffmpeg to 24 kHz mono PCM16 WAV with metadata removed,
   and call Muse batch transcription with member/persona keywords.
3. Store the transcript on media and update the chat message through C1's service.
4. Implement the `voice.transcribe` job with idempotency, retry, degraded state, and audit logging.
5. Implement the `/v1/voice/live` WebSocket proxy: authenticated browser frames to Meta realtime,
   80 ms PCM16 frames, correct handshake, `endStream`, cumulative transcript relay, clean close.
6. Build `LiveCaption` and its C2 voice client logic against the C1 recording UI hook/stub.
7. Always attribute the speaker from the authenticated uploader, never diarization.

### Required tests

- Conversion arguments and metadata stripping.
- Batch transcript persistence and `message.updated` behavior.
- Idempotent retry after job failure.
- WebSocket authentication, framing, end-of-stream, partial/final relay, and provider disconnect.
- No API key in browser bundles or payloads.

### Done when

A voice note gains its transcript within the performance budget, live captions stream during
recording, and the authenticated uploader remains the authoritative speaker identity.

### Current implementation status

- `voice.service.transcribeMedia` idempotently queues a three-attempt `voice.transcribe` job; manual
  retry after terminal failure gets a fresh job id, while completed media is never retranscribed.
- Batch processing downloads a signed voice object, enforces the 15 MB limit, converts through
  ffmpeg to metadata-free mono 24 kHz PCM16 WAV, supplies member/persona keywords to Muse, enforces a
  six-second processing deadline, persists status/transcript, emits `message.updated` through C1's
  frozen service, and writes privacy-safe audit metadata.
- `/v1/voice/live` authenticates the Better Auth session, verifies conversation membership and
  origin, permits one live session per user, accepts only 3,840-byte 80 ms PCM16 frames, performs the
  server-side Muse handshake, relays cumulative partial/final text, handles `endStream` and provider
  disconnects, and attributes every transcript to the authenticated uploader.
- `LiveCaption` resamples the C1 recorder stream in-browser, frames PCM without provider credentials,
  renders cumulative captions, and degrades without blocking the saved voice note.
- Eighteen new focused tests cover contracts, real ffmpeg output, persistence/update behavior,
  retry/failure semantics, authentication, framing, partial/final relay, provider disconnect,
  handshake order, browser framing, and credential isolation. Full workspace verification passes
  69 tests, typecheck, Biome over 414 files, mock smoke, production build, browser-bundle secret
  scan, and `git diff --check`.
- Integrated acceptance remains open until C1 auth/media/chat is merged from its branch and a live
  Muse Voice batch/realtime run succeeds with the human-owned C2-0 credentials.

### Recorded plan deviation

On October 24, 2026, the human explicitly instructed Computer 2 to implement the next milestone.
Under the execution-order exception in section 6, C2-3 work therefore began while C2-2 integrated
acceptance remained open. This does not waive C2-2 acceptance or C2-3's C1/live integration checks.

## 11. C2-4 — Concierge

### Objective

Turn group conversation into fair, sourced, human-controlled plan suggestions without booking or
sending anything outside LORE.

### Backend sequence

1. Implement preferences, trigger, candidate, proposal, vote, plan, and RSVP data behavior.
2. Trigger from Milo intent, the Plans surface, or MCP.
3. Generate `GroupIntentBrief`; ask at most one quick-reply question when a hard constraint is
   unknown, then persist its answer with the requested visibility.
4. Run at most four SerpAPI queries; normalize/dedupe/cache candidates and embed them.
5. Always include at least one at-home/online or media option.
6. Hard-filter by budget, travel, and time. Allow unknown price only with "price unverified".
7. Generate `PlanRanking`, discard unknown ids, re-sort by maximin fit, enforce category diversity,
   and keep three options.
8. Post a `plan_card`; votes and refine create realtime `plan.updated` events. Refinement increments
   proposal version and makes prior votes stale.
9. Permit only a human to confirm. Create the confirmed plan/event, RSVP state, and `.ics` output.
10. Implement all plan endpoints listed in this document's section 20 with membership, idempotency,
    privacy, and source enforcement.

### UI sequence

- `PlanCard` with three snap-row tiles, fit dots, source/freshness, vote, veto, alternative, refine,
  and live tallies. Never expose private preference text.
- Clarifier quick replies and a visible looking/loading state.
- `PlanConfirmedCard` with time, source/place link, RSVP chips, and calendar download.
- Plans tab for proposals/confirmed plans and status pills.
- Per-group preference sheet with explicit `ai_only` versus group visibility.

### Required tests

- Hard budget/travel/time filters, unknown price, at-home guarantee, maximin ordering, diversity.
- Candidate-id grounding and venue source requirement.
- Private preference redaction.
- Vote idempotency, stale versions, refine, human-only confirmation, and no external booking.

### Done when

A normal meeting-up chat can produce a sourced three-option card, members can vote/refine
independently, all hard constraints are honored or infeasibility is explicit, and a human can
confirm the final plan.

### Current implementation status

- The C2 branch now implements membership-scoped plan preferences, source normalization/cache use,
  embeddings, budget/travel/time filters, unknown-price labels, guaranteed at-home/online fallback,
  grounded ranking, maximin fairness, category diversity, proposal persistence, idempotent current-
  version voting, refinement/version invalidation, human confirmation, RSVP, calendar output, and
  `plan.updated` events.
- The Plans surface, fair three-option card, source/freshness labels, fit dots, independent voting,
  refine/confirm controls, confirmed card, and private/group preference sheet replace the scaffold
  placeholders. Seven focused policy/service tests and API/web/shared typechecks pass.
- End-to-end chat-card acceptance remains dependent on C1's chat/auth/group implementation merging;
  live Serp/Muse verification still requires the human-owned C2-0 credentials.

### Recorded plan deviation

On October 24, 2026, the human explicitly instructed Computer 2 to implement the next three
milestones and then run them. C2-4 through C2-6 are therefore authorized under section 6's explicit
human-change exception while earlier integrated acceptance remains open. Those acceptance checks
are not waived.

## 12. C2-5 — Memories

### Objective

Create private, source-grounded recaps from group media and conversation, with per-owner consent and
an explicit handoff into C1's governed group-draft workflow.

### Implementation sequence

1. Create/update event candidates from Milo extraction and confirmed plans.
2. Cluster three or more media items by event window or six-hour proximity; split on gaps over
   90 minutes and associate the nearest event.
3. Describe 1024 px signed photos with `PhotoNotes`; store captions and deprioritize low-quality or
   near-duplicate shots with perceptual-hash distance at most six.
4. Compose `RecapDraftSpec` from event context, surrounding 30 messages, and PhotoNotes.
5. Reject facts without valid source message ids and media not supplied to the model.
6. Render 1080×1350 collages in the documented layouts using sharp. Generate or edit an optional
   Muse Image cover only when permissions allow reference photos.
7. Store generated assets through C1's `media.service.createFromBuffer` and label them.
8. Start recaps as `ready_private`; post the offer card without publishing.
9. Implement editor, order/remove/consent, title/caption/layout, cover regeneration, private save,
   chat share, story creation, and propose-to-group-account actions.
10. Call C1's `groups.service.createDraft`; never bypass approval policy.

### Required tests

- Excluded/owner-revoked media never appear in recaps or later drafts.
- Every factual claim cites a valid source message from this conversation.
- Cluster boundaries, duplicate handling, and collage layouts.
- Private default, correct generated labels, and governed draft handoff.

### Done when

The recap card/editor works end to end, captions are grounded, consent changes propagate, private
content remains private by default, and proposing a post creates a C1-owned approval draft.

## 13. C2-6 — MCP Integrations

### Objective

Expose LORE safely to Muse through a stateless Streamable HTTP MCP server that reuses REST service
logic, requires scoped PATs, confirms writes, and audits every action.

### Implementation sequence

1. Implement PAT create/list/revoke APIs and Settings → Connect Muse. Generate
  `lore_pat_<32 random base62 bytes>`, show once, store SHA-256 only, and support scopes.
2. Fill the C2 MCP module and the scaffolded `apps/api/src/mcp.ts` integration only through its
   agreed stub/handoff; do not independently rewrite the C1-owned entrypoint.
3. Implement all required tools: groups, plans, plan vote, events, private recap proposal, group
   draft, approval request, games lobby, podcast status, family-story proposal, and Common Ground
   introduction proposal.
4. Route each tool through the same service/policy function as REST.
5. Require `confirm: true` for every write and scope checks for every call.
6. Record actor, tool, sanitized input, outcome, and detail in `agent_action_audit`.
7. Write model-readable tool descriptions that state purpose, appropriate use, and non-actions.
8. Test locally with MCP Inspector, then connect the Muse app using its secure credential flow.

### Required tests

- Missing/invalid/revoked token returns 401.
- Scope violations and writes without `confirm: true` are rejected.
- Votes use only the token's user identity.
- Private recap/family tools never publish directly.
- Audit rows exist for success, denial, and error without exposing token material.

### Done when

Muse or Inspector lists all tools, a confirmed plan vote appears live in LORE, token revocation is
immediate, and every write is confirmed, authorized, and audited.

## 14. C2-7 — Seed Data and Demo Fixtures

### Objective

Build a repeatable, consent-safe demo world that exercises the protected P0 chain and can be reset
on any database in under two minutes.

### Seed contents

- Four consented demo users: Ava, Leo, Mia, and Noor.
- `@weekendcrew`, its group chat, governance settings, and Milo persona.
- Roughly 80 historical messages with birthdays, inside jokes, budget/travel constraints, interests,
  a prior activity, and enough context for grounded memories.
- Relevant preferences, AI memories, event candidates, and one seeded past event with consented
  photos/voice where required.
- Social posts and pre-generated Muse Image house-style art, clearly labeled AI-generated.
- Two users suitable for Find Friends matching.
- `The Iqbals` family group with inputs for the family-story flow.
- Cached Austin weekend candidates refreshed before judging.

### Tooling

- `scripts/seed.ts`: deterministic, idempotent, accepts the selected database, prints a summary.
- `scripts/generate-seed-images.ts`: paid generation is explicit and reusable; generated assets are
  stored once rather than regenerated on every seed.
- `scripts/reset-demo.ts` / `pnpm demo:reset`: restores exact demo state in under two
  minutes without touching an unintended database.
- Candidate refresh command for the hour before judging.

### Required tests and safety

- Abort unless the target database is explicitly selected and not an ambiguous production target.
- Run twice to prove idempotency and timing.
- Secret scan and media-consent audit.
- Run the three-minute demo chain in mock mode and once live before a checkpoint.

### Done when

`pnpm seed` creates the complete demo world on any intended database in under two minutes and
`pnpm demo:reset` reliably restores it.

## 15. C2-8 — Discovery

### Objective

Offer opt-in Find Friends matches based on explicit and public engagement signals, never private
chat content, and open a DM only after mutual acceptance.

### Implementation sequence

1. Build the optional eight-question quiz and interest profile. Keep `discoverable` off by default.
2. Implement `discovery.service.recordSignal(userId, tags, kind)` for C1 calls.
3. Tag publish captions with at most three safe topic tags through Muse Spark.
4. Recompute inferred interests with 14-day decay; explicit dislikes/removals override; freeze stops
   changes.
5. Embed explicit/top inferred tags plus bio, retrieve the top 30 discoverable candidates, exclude
   blocked/existing-follow users, and rerank with the documented Jaccard/cosine/serendipity formula.
6. Generate a grounded `CommonGroundReason` from permitted tags only and cache by pair for 24 hours.
7. Build match cards, explanation, intro request, accept/decline, and editable starter flow.
8. Call the C1 DM service only after recipient acceptance.

### Required tests

- Quiz can be skipped and discovery remains opt-in.
- Five climbing-tagged engagements affect inferred tags; freeze and removal work.
- Private-chat text never enters tags, embeddings, reasons, or prompts.
- Declines are silent and no DM opens before acceptance.

### Done when

Matches appear immediately after opt-in, explanations are based only on allowed signals, and an
accepted introduction opens the first editable conversation.

## 16. C2-9 — Impact

### Objective

Produce a public, demo-safe view of connection outcomes using pseudonymous event aggregates in
Snowflake, with no message text or real identifiers.

### Implementation sequence

1. Record the required product event kinds to the Tiger `analytics_events` hypertable using
   SHA-256 group and actor hashes and sanitized props only.
2. Implement the 60-second `impact.sync` cursor job; batch at most 500 JSON rows through Snowflake
   SQL API v2 with PAT auth and retry/idempotency.
3. Create views for confirmed plans/active group, suggestions with two or more votes, recap-to-post
   conversion, intro acceptance, AI mute rate, and median intent-to-confirm time.
4. Build `GET /impact/summary` and the public `/impact` C2 route/feature with metric cards and two
   small charts.
5. Generate an optional three-sentence Cortex pulse from aggregates only. Cache aggregates/pulse
   so the page still works when Snowflake/Cortex is unavailable.

### Required tests

- Event allowlist and removal of raw ids/text.
- Cursor retry without duplicates or gaps.
- No PII in Snowflake payload snapshots.
- Confirmed plan visible within two minutes.

### Done when

The impact page updates within two minutes of a plan confirmation, works in degraded cached mode,
and Snowflake contains no raw text or real ids.

## 17. C2-10 — Family

### Objective

Turn consented group history into a private, attributed family story whose claims link back to
source material and whose contributors control inclusion.

### Implementation sequence

1. Date-range selection from Group Space → Memories.
2. Gather only history from members with AI-history consent.
3. Give contributors item-level include/exclude review for their own text, photo, and voice items.
4. Generate `FamilyStorySpec`; reject unknown source/contributor ids.
5. Render an editorial story with chapters, original media, transcripts, contributor avatars, and
   source links for every sentence.
6. Require unclear/unsupported/sensitive flags to be corrected or removed before sharing.
7. Generate an optional labeled illustration cover; default sharing remains private to the group.
8. Any public proposal must enter C1's governed draft flow.

### Required tests

- Excluded/non-consenting inputs never appear.
- Every sentence has a valid source.
- Unresolved flags block sharing.
- No direct public-publish path exists.

### Done when

The story can be reviewed and shared privately with full attribution and consent, and public use
requires a separate approved draft.

## 18. C2-11 — Podcast

### Objective

Build a voice-only branching podcast experience whose finish gate requires every original
participant to contribute and whose final media preserves real uploader identity.

### Implementation sequence

1. Create a show from a chat with all current members frozen as required participants and a root
   station.
2. Implement one clip per person/station/day, strict exactly-20-second submission, auto-stop, and
   re-record only before submit. Provide no text-reply path.
3. Add voice-only replies and child-station branching by topic.
4. Reuse C2-3 for batch transcripts and live captions; label with authenticated uploader.
5. Show engagement status and allow the host to mark wrapped.
6. Enforce `canFinishPodcast = wrapped && every required participant has a valid clip` in shared
   policy, API, and UI. Return 409 when ineligible.
7. Render ordered MP3 with 300 ms gaps and generated intro/outro tone.
8. If not cut, render 1080×1920 MP4 with labeled Muse Image B-roll and burned-in speaker captions.

### Required tests

- A 19-second clip fails strict mode; duplicate daily clip fails.
- No text input or text-reply API path.
- Missing participant disables UI and returns 409 from API.
- Correct station order, gaps, speaker labels, and upload identity.

### Done when

The show cannot finish early, every participant's engagement is visible, and the rendered episode
correctly attributes all clips. If the video render is cut, audio-only finish must remain working.

## 19. C2-12 — Advanced Persona Features

### Objective

Finish the persona studio and AI-facing polish only after the P0 chain is stable.

### Implementation sequence

- Generate four house-style avatar options with Muse Image and store selected assets through C1
  media service.
- Complete tone/interests/boundaries controls, quiet-hours timezone UI, and permission toggles.
- Generate three preview messages through `/persona/test` without joining or storing memories.
- Polish the preview pane, disclosure copy, AI/degraded/demo-timing labels, loading/empty/error
  states, accessibility, reduced motion, mobile overflow, and dark mode.
- Review every AI card for the three-label rule: suggestion, verified fact/source, human decision.
- Run the native-feel check using C1 primitives on iPhone and Android installed PWAs.

### Done when

The full avatar/settings/preview studio is complete, permission consequences are clear before
join, generated assets are labeled, and all AI surfaces meet the final polish checklist.

## 20. Shared Contracts and Integration Surface

### C2 data ownership

| Schema file | Tables | Critical invariants |
| --- | --- | --- |
| `persona.ts` | `ai_personas`, `ai_memories`, `ai_decisions` | One persona per conversation; 768-d embeddings; deleted/expired memories excluded; decisions hypertabled |
| `plans.ts` | `group_preferences`, `recommendation_triggers`, `candidates`, `plan_proposals`, `plan_votes`, `group_plans`, `plan_rsvps` | Preference visibility enforced; candidate source/freshness retained; votes keyed by proposal version |
| `memories.ts` | `event_candidates`, `recaps`, `recap_media_consents` | Recaps private by default; per-owner media consent controls downstream use |
| `family.ts` | `family_stories`, `family_story_contributions` | Contributor/source attribution and item-level inclusion |
| `podcast.ts` | `podcast_shows`, `podcast_stations`, `voice_contributions` | Required participants frozen; one clip per user/station/day |
| `discovery.ts` | `interest_profiles`, `quiz_answers`, `introductions` | Discoverability opt-in; freeze respected; introduction precedes DM |
| `integrations.ts` | `personal_access_tokens`, `agent_action_audit`, `analytics_events`, `sync_cursors` | PAT hashes only; every MCP write audited; analytics contains no raw ids/text |

C2 owns the activity/search SQL needed by these features in `packages/db/sql/003-005*`, including
the conversation activity aggregate, topic aggregate/fallback view, DiskANN indexes for memories,
interests, and candidates, plus supporting indexes. SQL must be idempotent.

### Required C2 REST and realtime surface

| Area | Endpoints/events |
| --- | --- |
| Persona | `GET/PUT /v1/conversations/:id/persona`, `POST /v1/conversations/:id/persona/test`, memory list/patch/delete |
| Plans | suggest, preferences, vote, refine, confirm, dismiss, and conversation plan list under `/v1` |
| Memories | conversation recap list/create plus recap patch, consent, and propose-post |
| Family | create, patch, contributor review, and share |
| Podcast | show create/get/status/finish/wrap plus station voice and branch operations |
| Discovery | quiz, profile, matches, introduction create/accept/decline |
| Voice | `POST /v1/voice/transcribe`, `WS /v1/voice/live` |
| Tokens/MCP | token list/create/delete; `POST /mcp` on the MCP host |
| Impact | `GET /v1/impact/summary` |
| Realtime | `plan.updated`, `recap.updated`, `family_story.updated`, `podcast.updated`, `intro.updated`, `ai.typing` |

All routes declare shared zod request/response schemas, authenticate, check membership/ownership,
accept idempotency keys for mutations, and return the shared error envelope.

### C2 chat and navigation components

- `plan_card`, `plan_confirmed`, `recap_card`, `family_story_card`, `podcast_invite`, `ai_image`, and
  `intro_card` components fill the pre-registered C2 stubs.
- Plans, Memories, and AI fill the pre-registered chat-toolbar actions.
- Plans and Memories fill the pre-registered Group Space tabs.
- C2 uses C1's StackNavigator, Sheet, TopBar, list-row, token, and motion primitives without editing
  their registries or shared implementations.

### C2 consumes these C1 services

| Service | C2 use |
| --- | --- |
| `chat.service.postMessage` | Milo, plan, recap, family, podcast, and intro cards |
| `chat.service.updateMessage` | Transcripts and live card refresh |
| `groups.service.createDraft` | Recap/family public proposals |
| `media.service.createFromBuffer` | Muse images, collages, podcast renders |
| `media.service.signedUrl` | AI vision, media processing, downloads |

### C2 provides these services to C1

| Service | C1 use |
| --- | --- |
| `voice.service.transcribeMedia` | Chat voice notes |
| `persona.service.onMessage` | Enqueue proactivity after human messages |
| `ai.games.*` | Game prompts, choices, captions, judging helpers |
| `discovery.service.recordSignal` | Public engagement signals |

C2 also owns `plan.updated`, `recap.updated`, `family_story.updated`, `podcast.updated`, and
`intro.updated` event production plus the C2 chat card components already registered by C1-0b.

Contract changes must be additive. Add the schema/event/DTO change, add tests, log it in
`docs/CONTRACTS.md`, notify C1, and do not edit a frozen registry merely to expose it.

### Shared structured-output contracts

- `SpeakDecision`: speak/intent/score/reason/message, grounded memory/candidate references, optional
  plan/image request, extracted memories, and grounded events.
- `GroupIntentBrief`: goal/time/mode/categories, hard constraints, soft preferences, at most one
  hard-constraint question, and at most four search queries.
- `PlanRanking`: two to four grounded options, per-member fit, logistics, compromise/infeasibility.
- `PhotoNotes` and `RecapDraftSpec`: grounded media ordering, layout/cover, music label, cited facts.
- `FiveWordChoices`, `GamePrompt`, and `MemeEntrySpec`: C1-facing game generation.
- `FamilyStorySpec`: attributed chapters, source-linked items, flags, cover prompt.
- `CommonGroundReason`: permitted shared tags, reason, starter, optional activity.
- `GuardVerdict`: allow/category/severity.

## 21. Data, Privacy, Safety, and Anti-Hallucination Requirements

- Scope every data read by the authenticated user and current conversation/group membership.
- Replace opted-out history before prompt construction; private chat is never a discovery signal.
- Never reveal an individual's `ai_only` preference; summarize as "some of you".
- Discard high-sensitivity extracted memories and honor correction, deletion, expiry, and consent.
- Validate structured output with zod and then validate all referenced ids against model inputs.
- Venues/events require real source URLs and freshness. Unknown price is explicitly unverified.
- Recap and family claims require source message ids. Excluded media never reappears downstream.
- AI messages/cards/images carry `ai_generated`; Muse images identify the generator and render an
  AI/illustration label. Cached, mock, demo-timed, and degraded states are never presented as live.
- Run the Gemini guard in parallel for outbound AI messages, lore prompts, meme captions, and
  family stories. Suppress unsafe Milo output; games may regenerate once.
- Humans alone confirm plans and group publishing. MCP writes require explicit confirmation.
- PATs and provider keys are never returned after creation or sent to browsers.
- Analytics use hashes and aggregate props only—no message text or raw identity.

## 22. Testing and Verification Strategy

### Per-task baseline

- Unit tests for policy, transformation, and failure behavior.
- Route/service tests for auth, membership, idempotency, and privacy.
- Component tests only for high-risk UI state and gates.
- `AI_MODE=mock` for CI and ordinary development; paid live calls only in explicit smoke runs.
- Typecheck, Biome, tests, build, and `git diff --check` before handoff.

### Required C2 unit suites

- `ai/structured.test.ts`: repair once, then degraded valid fallback.
- `persona/gates.test.ts`: quiet hours, mute, budget, spacing, mention override, grounded news.
- `plans/filter.test.ts`: hard constraints, unknown price, at-home inclusion, maximin, candidate ids.
- `memories/compose.test.ts`: consent and factual source validation.
- `mcp/tools.test.ts`: revoked token, confirmation, actor identity.
- Podcast finish policy: wrapping and every required participant.

### Integrated smoke

In two browser contexts: send the plan trigger, receive Milo/plan card, vote, confirm, create recap,
propose group draft, approve/publish, transcribe a voice note, and call `list_group_plans` over MCP.
Run mock first, then live at checkpoints.

### Performance targets owned or influenced by C2

- Milo decision-to-message under eight seconds live, including typing delay.
- Plan card within 20 seconds live; looking placeholder at one second.
- Twenty-second voice-note transcript within six seconds after upload.
- Impact confirmation visible within two minutes.

## 23. Merge and Handoff Protocol

### Checkpoints and cut order

| Gate | Target | C2 evidence |
| --- | --- | --- |
| Checkpoint A, about 30% of remaining time | Signup/chat integration, Milo response, voice transcript, HTTPS | C2-1/2/3 relevant checks, mock/live provider status, handoffs current |
| Checkpoint B, about 60% | Full chat → Milo → plan → vote → confirm → recap → approved group post plus MCP | C2 P0 chain and seeded production smoke |
| Final, about 85% | Every retained P0/P1 works; unfinished work dark | Full checks, reseed, production smoke, recovery log |

Cut in this order when time requires it: podcast video render before audio-only finish, then advanced
persona studio, then family story, then the Cortex narrative while retaining metrics. Never cut the
P0 AI chain, honest labels, MCP connector, or voice transcription.

Thirty minutes before Checkpoints A, B, and Final:

1. Stop starting new work; finish or safely defer the current task.
2. Ensure no half-written code is committed.
3. Run typecheck, lint, tests, build, and the relevant smoke.
4. Update this file, `docs/PROJECT_CONTEXT_LOG.md`, and C2's `docs/HANDOFF.md` entries.
5. Push `c2/intelligence` and report the exact head commit.
6. Let the designated merge machine create `integrate/*`; never merge directly into `main` from
   the C2 worktree.

Conflict handling uses these rules: take the owner version for an owned path; regenerate the
lockfile after choosing either side; union additive shared contracts; preserve both computers'
handoff/contract entries; restore frozen files unless an agreed handoff says otherwise; snapshot
and apply database changes safely; and stop for genuinely contradictory behavior.

After each checkpoint, rebase C2 from the newly merged `origin/main`, reinstall, rerun checks, then
continue the first incomplete C2 task. During the first C1 integration, explicitly reconcile the
temporary C2 dev harness with the real app processes.

## 24. Project Logging and Recovery Requirements

After every meaningful pass:

- Rewrite `docs/PROJECT_CONTEXT_LOG.md` Current state so it reflects the actual branch and blockers.
- Append a dated log entry with files changed, behavior added, checks run, results, and next step.
- Update the C2 tracker status and notes.
- Record deviations in this plan and in the project context log.
- Record cross-owner requests in `docs/HANDOFF.md` and additive contracts in `docs/CONTRACTS.md`.
- Commit and push a resumable checkpoint; do not leave completed work only in an unpushed worktree.

A replacement agent resumes by reading this plan, Current state, the last log entries, contracts,
and handoffs; then it verifies branch/status and runs the last recorded green checks before editing.

## 25. Definition of Done

Computer 2 is complete only when:

- Every retained C2 task meets its task-specific done condition; any cut task is feature-flagged
  off and documented, not left visibly broken.
- The protected P0 chain works on production: chat → Milo → plan → vote/refine → human confirm →
  recap → C1 draft/approval/publish, plus Voice and MCP.
- All C2 structured outputs are schema-valid and reference-grounded.
- AI, source, cache, mock, degraded, illustration, and human-decision labels are honest.
- Required privacy/negative tests and integrated smoke pass in mock mode and at least once live.
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, and production smoke pass after merge.
- C2-owned schemas, services, routes, jobs, features, scripts, contracts, and logs are complete.
- No secret or non-consented demo media is committed.
- Demo reset works twice, the backup demo is recorded, and remaining handoff items are explicit.

## 26. Execution Checklist

- [ ] C2-0 external services provisioned and shared securely.
- [ ] C2-1 rebased on C1-0b, reconciled, live-smoked, and complete.
- [ ] C2-2 Milo/persona behavior and basic studio accepted.
- [ ] C2-3 batch voice and realtime captions accepted.
- [ ] C2-4 Concierge and plans accepted.
- [ ] C2-5 memories and recaps accepted.
- [ ] C2-6 MCP connector accepted from Muse or Inspector.
- [ ] C2-7 seed/reset completes in under two minutes.
- [ ] Checkpoint A passes or unfinished work is safely flag-off.
- [ ] Checkpoint B full P0 demo chain passes in production.
- [ ] C2-8 discovery accepted or deliberately cut/flagged off.
- [ ] C2-9 impact accepted or Cortex portion deliberately cut.
- [ ] C2-10 family accepted or deliberately cut/flagged off.
- [ ] C2-11 podcast accepted, or video cut with audio-only finish retained.
- [ ] C2-12 advanced persona accepted or deliberately cut/flagged off.
- [ ] Final privacy, labels, native-feel, performance, and live-provider checks pass.
- [ ] Final branch pushed; plans, contracts, handoffs, and recovery log are current.
