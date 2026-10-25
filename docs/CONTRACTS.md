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

## Computer 2
