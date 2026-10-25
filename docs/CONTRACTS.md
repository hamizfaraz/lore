# LORE contract change log

Additive-only changes to `packages/shared` after the C1-0b scaffold (section 6, contract protocol).
Format: `- YYYY-MM-DD · file · change · reason`

## Computer 1

- 2026-10-24 · packages/shared (all) · initial contracts written in C1-0b scaffold · baseline

## Computer 2

- 2026-10-24 · `packages/shared/src/dto/persona.ts` · added schemas for persona preview, mute,
  memory correction, and AI-message explanations · C2-2 routes and UI share one validated contract
- 2026-10-24 · `packages/shared/src/dto/voice.ts` · added explicit degraded batch state, exact
  3,840-byte live-frame constant, end-of-stream client message, and ready/transcript/error server
  messages with authenticated uploader attribution · C2-3 browser and API share one validated,
  credential-free live-caption contract
