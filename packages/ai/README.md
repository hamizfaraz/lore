# @lore/ai

Server-only adapters for Muse Spark, Muse Image, Muse Voice Transcribe, Gemini, and SerpAPI. All
feature code imports these providers through `@lore/ai`; provider SDKs do not leak into apps.

## Modes

- `AI_MODE=mock` is the default. Structured calls return schema-validated fixtures without keys.
- `AI_MODE=live` requires the environment variables in `docs/IMPLEMENTATION_PLAN.md` section 14.

`pnpm --filter @lore/ai smoke` validates all mock fixtures by default. A live smoke intentionally
calls every paid provider once and additionally requires `AI_SMOKE_WAV_PATH` to point to a short,
spoken mono PCM16 WAV. The path is local-only and must not be committed.

Until the Computer 1 application scaffold is merged, `pnpm dev` runs this package's mock smoke in
watch mode. It is a development harness only: it exposes no web page or product API and adds no
product behavior.
