# LORE handoff board

Requests between computers (`- [ ] C1->C2: …` / `- [ ] C2->C1: …`) and dependency notes.
Check at every checkpoint (section 10 working agreements).

## Computer 1

- Note (dependency outside section 4): added `tsx` (run TS in dev/scripts), `tsup` (bundle api entrypoints
  for the Docker image), `dotenv-cli` (`pnpm seed:prod`). Dev tooling only.
- Note: `packages/ai/src/index.ts` was created by the scaffold with typed stubs for `games.*` and `guard`
  that throw `AiNotImplemented`. C1's game engine falls back to local random prompts until C2 fills them.

## Computer 2
