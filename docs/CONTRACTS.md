# LORE contract change log

Additive-only changes to `packages/shared` after the C1-0b scaffold (section 6, contract protocol).
Format: `- YYYY-MM-DD · file · change · reason`

## Computer 1

- 2026-10-24 · packages/shared (all) · initial contracts written in C1-0b scaffold · baseline
- 2026-10-24 · apps/api chat.service (C1 code, not shared pkg) · new exported helpers C2 may call: `transcriptForAi(convId, limit)`, `registerCardResolver(kind, fn)` (register in your module setup() to fill MessageDTO.card), `refreshCard(convId, kind, refId)`, `activeMembers(convId)`, `membership(convId, userId)` · Milo context + card payloads
- 2026-10-24 · apps/api media ffmpeg · `toWav24k(buf)` exported from `modules/media/ffmpeg.ts` for voice.transcribe · avoids duplicate ffmpeg code
- 2026-10-24 · packages/shared/src/dto/games.ts · `GameStateDTO.result.imageAiGenerated?: boolean` · show the AI label on Muse Image story endings
- 2026-10-24 · packages/shared/src/dto/graph.ts · optional `ConnectionsDTO.suggestedTags` and `friendsOnLore` (with `pending?`); `zConfirmGraphTagsBody` · Settings → Facebook and onboarding tag edits
- 2026-10-24 · apps/api graph routes (not shared pkg) · `GET /v1/graph/connections`, `POST /v1/graph/suggestions`, `POST /v1/graph/disconnect` beside `POST /v1/graph/import` · section 8.6 connections screen
- 2026-10-24 · packages/shared/src/dto/keepsakes.ts · `zCreateKeepsakeBody` · POST /v1/keepsakes
- 2026-10-24 · apps/api keepsakes routes (not shared pkg) · `POST /v1/keepsakes`, `GET /v1/keepsakes/:id`, `GET /v1/keepsakes/by-recap/:id`, public `GET /v1/keepsakes/:id/metadata` · section 8.15 mint + explorer metadata

## Computer 2

- 2026-10-24 · `packages/shared/src/dto/persona.ts` · added schemas for persona preview, mute,
  memory correction, and AI-message explanations · C2-2 routes and UI share one validated contract
- 2026-10-24 · `packages/shared/src/dto/voice.ts` · added explicit degraded batch state, exact
  3,840-byte live-frame constant, end-of-stream client message, and ready/transcript/error server
  messages with authenticated uploader attribution · C2-3 browser and API share one validated,
  credential-free live-caption contract
- 2026-10-24 · `packages/shared/src/dto/plans.ts` · added preference, overview, RSVP, and suggestion
  response contracts without changing the frozen plan card shapes · C2-4 REST and UI now share
  validated plan-list, clarifier, preference, and confirmation state
- 2026-10-24 · `packages/shared/src/dto/memories.ts` · added typed recap list and chat/story share
  contracts plus request type exports · C2-5 list/editor/card and REST mutations use the same
  private-by-default recap shapes
- 2026-10-24 · `packages/shared/src/dto/mcp.ts` · added typed token-create and token-list results,
  explicit create input type, and a non-empty default `read` scope · C2-6 REST and Connect Muse UI
  share the one-time credential response without ever persisting the raw token client-side
