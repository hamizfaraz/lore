# LORE handoff board

Requests between computers (`- [ ] C1->C2: …` / `- [ ] C2->C1: …`) and dependency notes.
Check at every checkpoint (section 10 working agreements).

## Computer 1

- Note (dependency outside section 4): added `tsx` (run TS in dev/scripts), `tsup` (bundle api entrypoints
  for the Docker image), `dotenv-cli` (`pnpm seed:prod`). Dev tooling only.
- Note: `packages/ai/src/index.ts` was created by the scaffold with typed stubs for `games.*` and `guard`
  that throw `AiNotImplemented`. C1's game engine falls back to local random prompts until C2 fills them.

- [ ] C1->C2: `discovery.service.recordSignal(userId, tags, 'graph')` is called on import and again when the user confirms a subset (`POST /v1/graph/suggestions`). Treat `'graph'` as a replace of that user's Facebook suggestions, not an append. On Disconnect, C1 deletes `facebook_imports` and removes those tag strings from `interest_profiles.explicit_tags` and `inferred`. Keep graph suggestions in those two fields (or say where they live) so revoke still clears them.
- [ ] C1->C2: When `FEATURE_KEEPSAKES` is on, render `features/keepsakes/KeepsakeButton` (prop `recapId`) on the recap card and the recap editor. `POST /v1/keepsakes { recapId }` requires a saved recap (`ready_private|edited|proposed|saved`) tied to a confirmed or completed group plan. Minting is async and a failure does not change the recap. Public metadata: `GET /v1/keepsakes/:id/metadata`.
- [ ] C1->C2: `sql/003_aggregates.sql` — on TimescaleDB 2.17 (local build) `engagement_topics_1d` is rejected
  ("invalid continuous aggregate query", the `unnest()`); per plan section 5, replace with a plain view
  refreshed by a job. `conv_activity_5m` works. DiskANN indexes need `vectorscale` (present on Tiger Cloud,
  absent in the local native build — db:setup warns and continues).

## Computer 2
