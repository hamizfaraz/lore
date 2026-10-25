# LORE handoff board

Requests between computers (`- [ ] C1->C2: …` / `- [ ] C2->C1: …`) and dependency notes.
Check at every checkpoint (section 10 working agreements).

## Computer 1

- Note (dependency outside section 4): added `tsx` (run TS in dev/scripts), `tsup` (bundle api entrypoints
  for the Docker image), `dotenv-cli` (`pnpm seed:prod`). Dev tooling only.
- Note: `packages/ai/src/index.ts` was created by the scaffold with typed stubs for `games.*` and `guard`
  that throw `AiNotImplemented`. C1's game engine falls back to local random prompts until C2 fills them.

- [x] C1->C2: `discovery.service.recordSignal(userId, tags, 'graph')` is called on import and again when the user confirms a subset (`POST /v1/graph/suggestions`). Resolved with an explicit `graph_tags` source set, replacement semantics, legacy cleanup, and disconnect revocation tests.
- [x] C1->C2: When `FEATURE_KEEPSAKES` is on, render `features/keepsakes/KeepsakeButton` (prop `recapId`) on the recap card and the recap editor. Placed on the editor and the chat recap card. `POST /v1/keepsakes { recapId }` requires a saved recap (`ready_private|edited|proposed|saved`) tied to a confirmed or completed group plan. Minting is async and a failure does not change the recap. Public metadata: `GET /v1/keepsakes/:id/metadata`.
- [x] C1->C2: `sql/003_aggregates.sql` — replaced the Timescale-incompatible `unnest()` continuous
  aggregate with a standard materialized view, unique refresh index, and 15-minute Impact worker refresh.
  `conv_activity_5m` works. DiskANN indexes still need `vectorscale` (present on Tiger Cloud, absent in the
  local native build — db:setup warns and continues).

## Computer 2

- [x] C2->C1: Root `biome.json` is formatted on C1-0b. Whole-workspace `pnpm lint` now passes after
  rebasing C2 on `origin/main` at `73814e9`.
- [x] C2->C1: In C1-4 chat, call `persona.service.onMessage(message)` fire-and-forget immediately
  after each committed human message. C2 debounces by conversation and waits 20.5 seconds before
  evaluation; do not call it for AI or system messages.
- [x] C2->C1: In C1-4 chat/details UI, render C2's `AiMemberPanel`, and pass AI-bubble `onWhy` state
  into C2's `WhySheet` with the conversation id, message id, `meta.reason`, and
  `meta.memoryIdsUsed`. The components and explanation endpoint are ready on `c2/intelligence`.
- [x] C2->C1: Preserve the voice hooks already present on `origin/c1/platform` when merging C2-3:
  `media.service.complete` must call `voice.service.transcribeMedia(mediaId)` after an audio upload,
  C1's implemented `media.service.signedUrl` and `chat.service.updateMessage` satisfy C2's frozen
  calls, and `ChatPage`/`VoiceRecorder` must retain the C2 `LiveCaption` slot.
- [x] C2->C1: In `VoicePlayer`, label transcripts when message metadata contains
  `transcriptDegraded: true` (and distinguish `transcriptStatus: failed`). C2-3 emits the metadata;
  the saved media transcript remains authoritative and the uploader id, never diarization, is the
  speaker identity.
- [x] C2->C1: Preserve C2-4's `plan_card` / `plan_confirmed` renderers and Plans toolbar/space-tab
  routes. C2 best-effort calls `chat.service.postMessage` for a new plan card; after C1 merges its
  implementation, refresh `cardRefId` through the existing card payload path and retain C2's
  `plan.updated` realtime event.
- [x] C2->C1: C2-5 consumes `media.service.signedUrl` for 1024 px photo review,
  `media.service.createFromBuffer` for labeled collage/cover assets, `chat.service.postMessage` for
  private recap offer/share cards, and `groups.service.createDraft` for governed public proposals.
  Preserve those interfaces and the C2 `recap.updated` renderer/event when merging.
- [x] C2->C1: Provide a frozen story-creation service for the Recap editor. C2 exposes and validates
  the `target: story` action. Share to story now posts the collage, cover, or first still on the
  member's personal account. Chat share, private save, and the governed group draft remain.
- [x] C2->C1: Preserve `/settings/muse` and the MCP token REST routes when merging C2-6. Add frozen
  `groups.service.submit` and `games.service.create` so the approval-request and game-lobby MCP
  tools route through C1's authorization. Those tools no longer fail closed. Family story proposal
  calls the family service for the last 30 days and does not publish.
- [ ] C2->C1: Wire C2-7's deterministic demo users into C1's demo authentication path and map the
  stable `demo/*` media storage keys to the generated/uploaded seed assets. C2 seeds the complete
  consent/governance/history state. Seed now also inserts a credential password (`password123`) for
  each `*.demo@ourlore.test` user. It has not been run against the live local database, which already
  has `ava@ourlore.tech`. The three-minute browser smoke of a fresh reset is still open.
- [x] C2->C1: On public post publish, call C2-8 `tagCaption(caption)` and persist at most three
  returned `topicTags`; on public like/save/share/follow and approved Graph import, call
  `recordSignal(userId, tags, kind)`. Never pass private-message text to either interface.
- [x] C2->C1: Feed C1's authoritative blocked-user relation into C2-8 candidate exclusion when the
  social block schema lands. C2 currently excludes self and existing follows; it does not invent or
  write C1-owned block state.
- [x] C2->C1: After a C2-8 introduction changes to `accepted`, create/open the C1 direct conversation
  with the accepted editable starter. Never create a conversation on request or decline. Preserve
  the C2 match, intro, and default-off profile UI during merge.
- [x] C2->C1: After a governed recap draft is actually published, call C2-9
  `recordImpactEvent({ kind: 'recap_posted', groupId, actorId, objectId: recapId, props:
  { destination: 'group_post' } })`. Do not count C2's draft proposal as a publication and do not
  pass captions, handles, names, or raw ids through `props`; the impact service hashes identifiers.
- [x] C2->C1: C2-10 Family Story delegates every public proposal to
  `groups.service.createDraft` and never publishes directly. Preserve its `source.kind: family`,
  contributor/source attribution, and unresolved-flag gate when implementing the stub. Wire signed
  media URLs and optional generated cover storage through C1's media service.
- [x] C2->C1: Removed the production-disabled `x-lore-demo-user` bridge after deterministic reset
  and a successful Better Auth credential login plus authenticated `/v1/me` request for seeded Ava.
- [x] C2->C1: C2-11 validates and orders podcast voice clips, then consumes
  `media.service.signedUrl` for source bytes and `media.service.createFromBuffer` for the required
  MP3. Preserve duration/transcript/uploader metadata on media completion. The local mock build uses
  synthesized, clearly demo-only tones when physical seeded assets are absent; production fails
  closed until C1 storage is available. Optional MP4 is a speaker-labeled vertical video after the MP3; a failed encode leaves the audio episode.
- [x] C2->C1: C2-12 generates four ephemeral Muse Image avatar previews and calls
  `media.service.createFromBuffer` only for the selected style. Preserve the generated-image flag,
  model/generator label, 512×512 dimensions, owner id, and AI caption. Once C1 storage lands, expose
  the selected `ai_personas.avatar_media_id` through a signed `PersonaDTO.avatarUrl`.
