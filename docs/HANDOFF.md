# LORE handoff board

Requests between computers (`- [ ] C1->C2: …` / `- [ ] C2->C1: …`) and dependency notes.
Check at every checkpoint (section 10 working agreements).

## Computer 1

- Note (dependency outside section 4): added `tsx` (run TS in dev/scripts), `tsup` (bundle api entrypoints
  for the Docker image), `dotenv-cli` (`pnpm seed:prod`). Dev tooling only.
- Note: `packages/ai/src/index.ts` was created by the scaffold with typed stubs for `games.*` and `guard`
  that throw `AiNotImplemented`. C1's game engine falls back to local random prompts until C2 fills them.

- [ ] C1->C2: `sql/003_aggregates.sql` — on TimescaleDB 2.17 (local build) `engagement_topics_1d` is rejected
  ("invalid continuous aggregate query", the `unnest()`); per plan section 5, replace with a plain view
  refreshed by a job. `conv_activity_5m` works. DiskANN indexes need `vectorscale` (present on Tiger Cloud,
  absent in the local native build — db:setup warns and continues).

## Computer 2

- [x] C2->C1: Root `biome.json` is formatted on C1-0b. Whole-workspace `pnpm lint` now passes after
  rebasing C2 on `origin/main` at `73814e9`.
- [ ] C2->C1: In C1-4 chat, call `persona.service.onMessage(message)` fire-and-forget immediately
  after each committed human message. C2 debounces by conversation and waits 20.5 seconds before
  evaluation; do not call it for AI or system messages.
- [ ] C2->C1: In C1-4 chat/details UI, render C2's `AiMemberPanel`, and pass AI-bubble `onWhy` state
  into C2's `WhySheet` with the conversation id, message id, `meta.reason`, and
  `meta.memoryIdsUsed`. The components and explanation endpoint are ready on `c2/intelligence`.
- [ ] C2->C1: Preserve the voice hooks already present on `origin/c1/platform` when merging C2-3:
  `media.service.complete` must call `voice.service.transcribeMedia(mediaId)` after an audio upload,
  C1's implemented `media.service.signedUrl` and `chat.service.updateMessage` satisfy C2's frozen
  calls, and `ChatPage`/`VoiceRecorder` must retain the C2 `LiveCaption` slot.
- [ ] C2->C1: In `VoicePlayer`, label transcripts when message metadata contains
  `transcriptDegraded: true` (and distinguish `transcriptStatus: failed`). C2-3 emits the metadata;
  the saved media transcript remains authoritative and the uploader id, never diarization, is the
  speaker identity.
- [ ] C2->C1: Preserve C2-4's `plan_card` / `plan_confirmed` renderers and Plans toolbar/space-tab
  routes. C2 best-effort calls `chat.service.postMessage` for a new plan card; after C1 merges its
  implementation, refresh `cardRefId` through the existing card payload path and retain C2's
  `plan.updated` realtime event.
- [ ] C2->C1: C2-5 consumes `media.service.signedUrl` for 1024 px photo review,
  `media.service.createFromBuffer` for labeled collage/cover assets, `chat.service.postMessage` for
  private recap offer/share cards, and `groups.service.createDraft` for governed public proposals.
  Preserve those interfaces and the C2 `recap.updated` renderer/event when merging.
- [ ] C2->C1: Provide a frozen story-creation service for the Recap editor. C2 exposes and validates
  the `target: story` action but intentionally refuses it until a C1 service can create a story
  without bypassing media ownership/consent checks; chat share, private save, and governed group
  draft proposal are implemented.
- [ ] C2->C1: Preserve `/settings/muse` and the MCP token REST routes when merging C2-6. Add frozen
  `groups.service.submitDraft(draftId, actor)` and `games.service.createLobby(input, actor)`
  interfaces so the advertised approval-request and game-lobby MCP tools can route through C1's
  authorization/policy logic. Until then those tools intentionally fail closed; C2 does not write
  C1-owned draft or game tables directly.
- [ ] C2->C1: Wire C2-7's deterministic demo users into C1's demo authentication path and map the
  stable `demo/*` media storage keys to the generated/uploaded seed assets. C2 seeds the complete
  consent/governance/history state without writing C1-owned password/session behavior; the final
  three-minute browser smoke must wait for that integration.
