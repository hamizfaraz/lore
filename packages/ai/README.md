# @lore/ai

Server-only adapters for Muse Spark, Muse Image, Muse Voice Transcribe, Gemini, and SerpAPI. All
feature code imports these providers through `@lore/ai`; provider SDKs do not leak into apps.

## Modes

- `AI_MODE=mock` is the default. Structured calls return schema-validated fixtures without keys.
- `AI_MODE=live` requires the environment variables in `docs/IMPLEMENTATION_PLAN.md` section 7.

`pnpm --filter @lore/ai smoke` validates all mock fixtures by default. A live smoke intentionally
calls every paid provider once and additionally requires `AI_SMOKE_WAV_PATH` to point to a short,
spoken mono PCM16 WAV. The path is local-only and must not be committed.

The application scaffold is now present. Run `pnpm dev` from the repository root to start the web,
API, worker, and MCP processes. The AI package is exercised through those consumers and through its
explicit smoke command; it does not start a separate watch process.
