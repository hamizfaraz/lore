# LORE — Project Context Log

> **Purpose.** A running, always-current record of everything done on this repo, the exact current
> state, and the context a new person or coding agent needs to resume work mid-stream. Update it at
> the end of every task and at every meaningful step. Newest log entries go at the **bottom** of the
> log section; the "Current state" section is rewritten in place.

## How to resume (read this first)

1. Read `docs/IMPLEMENTATION_PLAN.md`; it is the sole active implementation plan for Computer 2.
2. Read the **Current state** section below, then the last few **Log** entries.
3. Check `docs/HANDOFF.md` (cross-computer requests) and `docs/CONTRACTS.md` (contract changes).
4. Toolchain on the original machine: Node 22 is installed user-local at `~/.local/node/bin`
   (added to `~/.zshrc`); pnpm 9 is installed globally in that Node. Run
   `export PATH="$HOME/.local/node/bin:$PATH"` in non-login shells.
5. `pnpm install`, then continue the first unchecked task in the task tracker below.

## Repo + branches

- GitHub: `hamizfaraz/lore` (private).
- `main` — C1-0a and C1-0b land here directly. After that, `main` moves only through checkpoint merges.
- `c1/platform` — Computer 1 (this machine's agent) works here from C1-1 on.
- `c2/intelligence` — Computer 2's branch (created by Computer 2).

## Current state

_Rewritten after each step._

- Phase: **Local app is feature-complete except human accounts.** Branch `integrate/final-2227`. The integration work is local and uncommitted. `origin/main` is still `73814e9`. Web is http://localhost:3000 (Ava: `ava@ourlore.tech` / `password123`). API is http://127.0.0.1:4000. `ffmpeg` and `ffprobe` are on `~/.local/node/bin`. Find Friends, Meme Battle, Pictionary, and keepsakes are on in the local env. VAPID keys and a devnet vault (`6PQKFHXa3x3rUrf6cqdM42aHFmxcTKGufZ7CCy962dka`, balance 0) are in `.env`. AI mode is still `mock`. Still needs a person: Facebook app, Meta/SerpAPI/Gemini/Snowflake keys, Vultr, registering `ourlore.tech` (NXDOMAIN), production database and object storage, then funding the vault if the devnet faucet stays dry.

### Computer 1 state at merge

- Phase: **C1-13 done.** Phone side-by-side with Instagram was completed by the presenter on 2026-10-24; no mismatches were sent back. Still need a human: Facebook Tester login, Vultr deploy, VAPID keys, and the Solana vault key.
- C1-12: keepsakes flag-gated (`FEATURE_KEEPSAKES`, default off). `POST /v1/keepsakes { recapId }` for a member, recap state in ready_private|edited|proposed|saved, tied to a confirmed/completed `group_plans` row (matched on plan id, proposal id, or recap id). One row per recap (`keepsakes_recap_uq`). Worker `keepsakes.mint` mints a Metaplex Core asset on devnet to `SOLANA_VAULT_SECRET` (base58), airdrops 1 SOL if the vault is under 0.05, URI is `GET /v1/keepsakes/:id/metadata` (public). Failure sets `status=failed` and does not touch the recap; a second POST retries. Signup creates `user_wallets.pubkey` only (secret discarded). UI: `features/keepsakes/KeepsakeButton` — C2 must place it on the recap card/editor (HANDOFF). Tests: `keepsakes/service.test.ts` (4) with an injected minter, no devnet. NOT verified: a live devnet signature (no vault key).
- C1-10: `POST /v1/graph/import` reads the Better Auth Facebook token and calls Graph `/me`, `/me/permissions`, `/me/likes?limit=100`, `/me/friends`. Declined `user_likes` / `user_friends` (Graph error 200/10) still imports. Likes map through `modules/graph/categories.ts` (Movie/TV Show → film-tv, Musician/Band → live-music, …). Tags go to `discovery.recordSignal(..., 'graph')` (NotImplemented is ignored). Friends on LORE = personal accounts whose fb id is in my friend list, who logged in with Facebook, or who listed me. `GET /v1/graph/connections`, `POST /v1/graph/suggestions` (onboarding keeps a subset), `POST /v1/graph/disconnect` (deletes import, facebook `account` row, and those tags on `interest_profiles`). Web: onboarding chips marked "from Facebook", Settings → Facebook (`/settings?section=facebook`), Explore section "Friends on LORE". Tests: `graph/categories.test.ts`, `graph/service.test.ts` (4). NOT verified: live Facebook (no app credentials).
- C1-9: `GET /v1/explore?q=` (accounts+group accounts by handle/name, posts via `search_tsv @@ websearch_to_tsquery`,
  engagement-ranked grid; private accounts hidden), Explore tab root (search, recent searches, Find Friends/Discover
  tiles behind FEATURE_FIND_FRIENDS, masonry grid with tall reels), Reels tab root (snap pager, single playing video,
  mute toggle, action rail), Notifications screen (Today/This week/This month, Review button for approvals),
  `maybeAskPush()` after approving a draft or sharing a post (never at launch).
- Games: `modules/games/{engine,meme,pictionary,prompts,words,service,routes,jobs,module}.ts` — pure engine (tested),
  runtime in Valkey `game:{id}` under a SET-NX lock, mirrored to `game_sessions.result.runtime` on every change,
  caller-filtered `game.state` per member user room, BullMQ `games.tick` (turn/phase timers, abandon) + `games.sweep`,
  prompts via `@lore/ai` games.* with local fallback + lore notice (<3 permitted memories), five-word prefetch for the
  next player, result illustration (Muse Image or a typographic sharp card, labeled only if AI), game_invite /
  game_result cards, share to story / propose to group (draft). Meme: private submissions, AI entry, shuffled anon
  slots, one vote each, self-vote blocked, reveal scoring. Pictionary: private prompt, socket strokes (not persisted),
  normalized + Levenshtein ≤1 guesses. Web: GamesSheet launcher, GamePage (lobby/OWS/meme/pictionary/end), cards.
  Flags: meme/pictionary need FEATURE_GAMES_MEME / FEATURE_GAMES_PICTIONARY=1 (enabled in local .env only).
- C1-6: `infra/{api,web}.Dockerfile`, `docker-compose.yml` (caddy, web, api, mcp, worker, valkey), `Caddyfile`
  (ourlore.tech + mcp.ourlore.tech), `deploy.sh`, `vm-bootstrap.sh`, `s3-setup.sh` + `s3-cors.json`, `infra/README.md`
  (first-deploy checklist), root `.dockerignore`. Verified locally: api tsup bundle runs from `dist/` with /v1/ready ok,
  bundled db-setup runs, Next standalone layout matches the web Dockerfile. NOT verified: docker builds (no Docker here).
- C1-5: groups module — create group account (admin; handle, avatar, visibility, policy), GET/PUT policy (admin, audited,
  system message), drafts (createDraft cross-boundary DONE, submit freezes snapshot, human author auto-approves on submit,
  edits bump version + void approvals, approve/request changes, explicit publish for direct/courtesy, cancel),
  `tryPublish` = mayPublish under `SELECT … FOR UPDATE`, auto-publish on last approval, effective voters = snapshot ∩
  current eligible members, group stories via `post_drafts.target='story'` + story_mode, `postFromComposer`/`storyFromComposer`,
  draft_card resolver, notifications (draft_needs_approval, post_published). Web: DraftCard (live), GroupAccountSection
  (create + policy editor). Tests: `groups/service.test.ts` (5) — all pass.
- C1-4: chat module — inbox (lateral last-message + unread), DM dedupe, group create, messages (cursor in SQL for µs
  precision), idempotent send by clientId, postMessage/updateMessage (cross-boundary, done), refreshCard, card resolver
  registry (`registerCardResolver`), reactions, unsend, read state, members add/remove/roles/mute (scope+duration), AI
  history consent, pin, rename, shared media, invite link + guest join (2 h guests, `chat.expireGuests` every 10 min),
  `transcriptForAi()` for C2 (hidden-consent members → "[message hidden from AI]"), persona.onMessage hook after human
  messages, socket room guard + typing relay. Web: Inbox, New message sheet, Chat (virtualized, grouping, day/time
  separators, Seen, typing, long-press reactions, swipe reply, double-tap ❤️, optimistic send + retry, media send,
  hold-to-record voice + LiveCaption slot + VoicePlayer, ✦ sparkle menu, header Plans/Games from toolbar registry, card
  registry slot, Why sheet), Details, Settings (roles/mutes/rename), Join page. Tests: `apps/api/src/modules/chat/service.test.ts` (DB).
- C1-3: social module (profiles, follow incl. private→pending, feed, account posts, reels list, posts create/get/delete,
  likes, saves, share, comments with @mention notifications, stories rail/by-account/create/view, `/accounts/:id/owner`),
  notifications module (notify() + realtime + web push, list/read, push subscriptions). Web: Home (stories rail, feed,
  optimistic like/save, comments/share sheets), Profile (own tab root + others + group, switcher, edit profile, members),
  Post detail, Create (POST/STORY/REEL, crop/filters, Post as, policy-aware button), Story viewer + camera, Settings
  (theme, privacy, push, connections, log out). Verified 8.1 acceptance via `flow.mjs` API script (see Log).
- C1-2: `lib/storage.ts` (S3 when S3_* set, else signed local disk under `.data/media` served by
  `/v1/media/local/{upload,file}`), `POST /v1/media/presign`, `POST /v1/media/:id/complete` (sharp 480px webp thumb,
  blurhash, dims; ffprobe/ffmpeg for video/audio when installed — not installed on this Mac), `createFromBuffer`,
  `signedUrl`, `mediaDTOs`, `assertUsable`, `setTranscript`, `ffmpeg.toWav24k` (for C2 voice). Verified upload flow.
- C1-1: Better Auth at `/api/auth/*` (modules/auth), personal account auto-created on signup (users.setup hook),
  `GET /v1/me`, `PATCH /v1/me/profile`, `GET /v1/handles/:h/available`, `GET /v1/users/search`; web Login,
  Signup, Facebook consent sheet + button, 4-step Onboarding. Verified: signup → /me → profile update → UI login.
  NOT verified: Facebook login (needs FACEBOOK_CLIENT_ID/SECRET + a Tester account).
- Testing helpers: start web with the browser-pane launch config `.claude/launch.json` ("web", port 3000);
  start api+worker with `npx tsx --env-file=../../.env src/server.ts` in apps/api. Local test user: ava@ourlore.tech / password123.
- Verified locally: `pnpm lint`, `pnpm typecheck`, `pnpm test` (11 policy tests), `next build` (31 routes),
  `pnpm --filter api build` (tsup), api/worker/mcp boot; `/health` ok; `/v1/ready` → database ok, valkey ok.
- Local services (no Docker on this Mac): natively built Postgres 17 + TimescaleDB 2.17 + pgvector 0.8 in
  `~/.local/pgsql` and Valkey 8 in `~/.local/valkey`. Start both with `./infra/dev-native.sh`
  (data dir `~/.local/lore-pgdata`). `.env` (git-ignored) points at `postgres://postgres@localhost:5432/lore`.
  Schema applied with `drizzle-kit push` + `pnpm db:setup` (vectorscale/DiskANN and `engagement_topics_1d`
  fail locally, see HANDOFF; both are C2-owned SQL).
- What exists (scaffold): see "Scaffold map" below.
- Cross-boundary C1 functions are still `NotImplemented` stubs: `chat.service.postMessage/updateMessage`,
  `groups.service.createDraft`, `media.service.createFromBuffer/signedUrl` (implemented in C1-2/4/5).

## Scaffold map (C1-0b)

- `packages/shared/src`: ids, enums, ai (all section 7 schemas), policy (+test), flags, events (+rooms,
  client socket events), cards (kinds + payload schemas + owners), errors, `dto/*` (one per module).
- `packages/db`: `src/schema/{social,chat,groups,games,persona,plans,memories,family,podcast,discovery,integrations}.ts`,
  frozen `schema/index.ts`, `client.ts` (postgres.js, max 5), `sql/001-005`, `scripts/setup.ts` (`SQL_DIR` env override).
- `packages/tokens`: `tokens.css` (light/dark vars), `index.ts`.
- `packages/ai/src/index.ts`: typed stubs `games.*`, `guard` (C2 implements).
- `apps/api/src`: `server.ts`, `worker.ts`, `mcp.ts` (frozen), `app.ts` (buildApp + /health + /v1/ready),
  `dev.ts`, `lib/{env,errors,logger,db,redis,s3,auth,actor,queues,socket,idempotency,module}.ts`,
  `modules/index.ts` (frozen registry) and 19 module folders each with `module.ts, routes.ts, service.ts,
  jobs.ts, events.ts, policy.ts`. Cross-boundary stubs in chat/groups/media (C1) and voice/persona/discovery (C2);
  `modules/mcp/server.ts` stub plugin.
- `apps/web/src`: root layout (viewport, apple web app, splash links), providers, manifest, `sw.ts` (serwist
  offline + push), `(app)/layout.tsx` (AppShell keeps tab roots mounted), `(auth)/layout.tsx`, every route in
  section 9.6 (+ `/p/[id]`, `/offline`), `components/ui/*` (all of section 9.5), `lib/*`, every feature folder
  with placeholder pages, card stubs, and the 3 frozen registries (`features/chat/cards/registry.tsx`,
  `features/chat/toolbar/registry.ts`, `features/groups/space/tabs.ts`), C2 stubs (`LiveCaption`,
  `InterestsStep`, `FindFriendsEntry`, `DiscoverTogetherEntry`, `AiMemberPanel`, `WhySheet`, `MuteMiloSheet`).
- Icons/splash generated by `apps/web/scripts/generate-icons.mjs` (sharp).
- `infra/dev-native.sh`, `docker-compose.dev.yml`, `.github/workflows/ci.yml`, `e2e/` (Playwright skeleton),
  `.env.example` (section 14 + `## Computer 1` additions).

### Computer 2 state at merge

- Phase: C2-10 through C2-12 are implementation-green on the C2 branch. Whole-workspace and local
  end-to-end verification pass; the seeded phone test lobby is ready. C1 merge and live-provider
  acceptance remain open.
  C1 merge and live-provider acceptance remain open for the complete C2 P0 chain.
  C2-1's paid live smoke remains blocked on human-owned C2-0 credentials.
- Active Computer 2 branch: `c2/intelligence`, in a dedicated worktree. All implementation changes
  in this run are confined to this branch; the original checkout remains clean on `main`.
- `origin/main` is commit `73814e9` (`feat(c1-0b): full scaffold`). C2 has rebased onto it and
  reconciled `packages/ai` with the authoritative shared AI schemas and frozen game/guard interface.
- C2-0 external account provisioning is a human-owned prerequisite. No credentials are present in
  the repo, and no live provider smoke tests have run.
- C2-1 currently includes Muse text/image/voice adapters, Gemini embeddings and safety, cached
  SerpAPI access, schema-validated structured output with one repair and mock fallback, Valkey-ready
  budgets, retryable-provider backoff, prompt rules, six distinct 128x128 mock images, two spoken
  mono PCM16 24 kHz WAV fixtures, and game prompt helpers matching C1's service contract.
  Every provider path now honors `AI_MODE=mock`. Server-side reference filters remove model-supplied
  memory, candidate, message, media, and user ids that were not in the input, force unverified news
  to silence, and reject unsupported recap citations. The retry policy is immediate attempt plus
  0.5 s, 1 s, and 2 s retries for 429/5xx responses only; provider exhaustion degrades to valid
  mock output.
- C2-2 now includes the Milo/persona decision engine, deterministic hard gates and scoring, quiet
  hours and budgets, privacy-redacted prompt assembly, grounded structured decisions, guarded and
  labeled output, low/medium-sensitivity memory capture, tentative event capture, decision logs,
  explanation data, delayed message and repeating tick jobs, member/admin-scoped APIs, and the basic
  persona studio with disclosure, mute/remove, preview, memory controls, and explanation UI.
- C2-3 now includes idempotent/retryable batch voice jobs, signed-media download, real ffmpeg
  normalization to metadata-free mono 24 kHz PCM16 WAV, a six-second deadline, grounded member and
  persona keywords, transcript persistence and message refresh, degraded/failure metadata, audit
  records, an authenticated and membership-scoped realtime proxy, exact 80 ms frame enforcement,
  cumulative transcript relay, and browser-side resampling/caption UI with no provider secret.
- C2-4 supplies grounded fair plans, voting, confirmation, RSVP/calendar behavior, and Plans UI.
  C2-5 supplies consent-aware, grounded, private-by-default recaps, metadata-free Sharp layouts,
  recap editing/sharing/proposal behavior, and Memories UI.
- C2-6 supplies one-time-reveal, SHA-256-only scoped PATs; token management and Connect Muse UI;
  a stateless Streamable HTTP MCP server; all 11 required model-readable tools; explicit write
  confirmation; actor-safe plan votes; membership-scoped reads; and sanitized success/denial/error
  audits. Unavailable C1/later-C2 tool integrations fail closed.
- C2-7 supplies explicitly targeted, deterministic seed/reset tooling with six demo users, two
  governed groups, Milo, 90 grounded messages, preferences/memories, consent-scoped media, social
  posts, a plan/event/private recap, Austin candidates, discovery matches, and family-story inputs.
  Paid seed-image and live Serp refresh commands require dedicated confirmation.
- C2-8 supplies a skippable eight-question quiz, default-off discovery profile, safe public signal
  inference with 14-day decay/removal/freeze, embeddings and top-30 reranking, permitted-tag-only
  cached reasons, match cards, editable intro requests, recipient accept/decline, and a proposal-only
  MCP action. It never accepts private chat content and does not open a DM before C1 integration.
- C2-9 supplies allowlisted pseudonymous product events, composite cursor sync in batches of 500,
  idempotent Snowflake SQL API v2 `MERGE`, six aggregate views, optional aggregate-only Cortex pulse,
  cached/local degradation, the public summary route, metric cards, and two small charts.
- C2-10 supplies date-scoped, consent-only source selection; contributor-owned exclusion and
  correction; grounded private story composition; visible sentence/source/contributor links;
  unresolved-flag blocking; private sharing; and a governed C1 draft handoff with no direct public
  publish path. A production-disabled demo identity bridge lets the seeded local UI work before C1
  auth lands.
- C2-11 supplies a frozen current-member cast, root and child stations, exactly-20-second owned
  voice submissions, one clip per person/station/day, transcript/uploader attribution, engagement
  and missing-member state, host wrap/finish gates, and MP3 composition in station order with
  300 ms gaps and intro/outro tones. The optional MP4 render was deliberately cut. Seeded exact
  clips and a mobile recorder make the flow testable before C1's upload/storage implementation.
- C2-12 supplies four distinct Muse Image house-style avatar choices, selected-only C1 media
  persistence, tone/interests/boundaries, time-zone-aware quiet hours, permission controls, and
  exactly three preview-only scenarios with no join or memory write. Loading, empty, degraded,
  error, dark, mobile, accessibility, reduced-motion, and the three required AI labels are present.
  `/c2-lab` links Family, Podcast, and Advanced Persona into one seeded test lobby.
- Full verification passes: six workspace typechecks and 119 tests across 30 files, whole-workspace
  Biome over 453 files, mock smoke, production web/API builds, and a direct
  browser-bundle provider-secret scan, and `git diff --check`.
  The mock smoke validates 11 JSON fixtures, 6 images, 2 voice fixtures, 5 choices, 3 prompts, guard,
  and budget paths without credentials or network calls.
- The temporary `packages/ai` dev watcher is removed. Root `pnpm dev` uses C1's actual web, API,
  worker, and MCP processes. Rootless Podman can provide isolated PostgreSQL and Redis-compatible
  test containers even though the Docker daemon socket remains unavailable. The local image lacks
  TimescaleDB/Vectorscale, so hypertable, aggregate, and DiskANN setup warnings remain expected.
  A real SDK client listed all 11 MCP tools, ran an authenticated read, verified its audit row, and
  received HTTP 401 immediately after revocation. No development process or temporary container
  should be assumed to survive an agent handoff.
- `docs/IMPLEMENTATION_PLAN.md` is now the single active plan and covers C2-0 through C2-12, exact
  ownership, dependencies, acceptance tests, merge rules, cut lines, and recovery. The previous
  broad plan and `docs/C2_NOW.md` workflow were removed from the working tree and remain only in git
  history. C2-10 is the next ordered milestone and requires a new human continuation instruction.

## Computer 1 task tracker

| ID | Task | Status | Notes |
| --- | --- | --- | --- |
| C1-0a | Bootstrap repo | done | private repo hamizfaraz/lore, main pushed |
| C1-0b | Full scaffold on main | done | main == c1/platform at scaffold commit |
| C1-1 | Auth | done (FB login unverified: no creds) | |
| C1-2 | Media pipeline | done | local disk fallback when no S3 |
| C1-3 | Social core | done | group posting via groups.service in C1-5 |
| C1-4 | Chat | done | 8.2 acceptance verified via scratch socket script |
| C1-5 | Group accounts | done | 8.4 acceptance verified (tests + HTTP flow) |
| C1-6 | Infra | code done; deploy blocked | needs Vultr VM, Object Storage keys, DNS, prod Tiger |
| C1-7 | Game engine + One-Word Story | done | engine tests + HTTP flow |
| C1-8 | Meme Battle | done | flag FEATURE_GAMES_MEME |
| C1-9 | Reels, Explore, notifications | done | web push needs VAPID keys |
| C1-10 | Graph import | done (live FB unverified: no app creds) | friends match both ways |
| C1-11 | Pictionary | done (live strokes not browser-tested) | flag FEATURE_GAMES_PICTIONARY |
| C1-12 | Solana keepsakes | done (flag off; live devnet unverified) | button placement is a C2 handoff |
| C1-13 | Polish | done | phone side-by-side finished 2026-10-24; no mismatches reported |

## Computer 2 task tracker

| ID | Task | Status | Notes |
| --- | --- | --- | --- |
| C2-0 | Provision accounts and keys | human action required | Section 7 checklist; secrets must use a password manager, never git/chat |
| C2-1 | AI package, mocks, guard, budget, game prompts, smoke script | live verification pending | Implementation, C1-0b reconciliation, and all local checks pass; paid live smoke awaits C2-0 |
| C2-2 | Milo persona, proactivity, memory, basic studio | integration pending | Implementation and local checks pass; requires C1-4 hook plus live DB/Valkey acceptance |
| C2-3 | Voice transcription and live captions | integration pending | Implementation and local checks pass; requires C1 auth/media/chat merge and live Muse acceptance |
| C2-4 | Concierge and plans | integration pending | Core service, routes, UI, realtime, calendar, and seven focused tests pass; C1 chat/auth merge and live providers remain |
| C2-5 | Shared memories and recaps | integration pending | Service, grounding, consent, Sharp layouts, editor/cards, and ten focused tests pass; C1 media/chat/group/story integration remains |
| C2-6 | Muse MCP connector | integration pending | PATs, UI, 11 tools, confirmation/scopes/audits, SDK smoke, and immediate revocation pass; C1 game/approval plus later C2 services remain |
| C2-7 | Seed and demo reset | integration pending | Seed 382 ms, reset 201 ms, consent/secret audits pass; C1 demo auth/media and browser chain remain |
| C2-8 | Find Friends and Common Ground | integration pending | Seven focused tests and typechecks pass; C1 public-signal/block/DM hooks remain |
| C2-9 | Snowflake impact | live verification pending | Service, sync, six views, route/UI, six tests, and local smoke pass; live Snowflake/Cortex awaits C2-0 |
| C2-10 | Family story | implementation complete | C1 draft/media integration remains |
| C2-11 | Podcast stations and render | implementation complete | Audio retained; MP4 cut; C1 media integration remains |
| C2-12 | Advanced persona studio and AI polish | implementation complete | C1 selected-avatar media persistence remains |

## Things that need a human (cannot be done by the agent)

- Phone side-by-side with Instagram (C1-13, section 9.7): done by the presenter on 2026-10-24. No layout mismatches were reported.
- **First deploy (C1-6)**: follow `infra/README.md` checklist — create Vultr VM + Object Storage, DNS A records
  (`@`, `www`, `mcp`), prod Tiger service, `.env.prod` on the VM, then `VULTR_VM_IP=… ./infra/deploy.sh`.
- Facebook app credentials + Tester accounts to verify Facebook login (C1-1) and Graph import (C1-10).
- Generate VAPID keys for web push: `npx web-push generate-vapid-keys` → `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` (+ `NEXT_PUBLIC_VAPID_PUBLIC_KEY`).
- Solana devnet vault for keepsakes: `solana-keygen new` → base58 secret in `SOLANA_VAULT_SECRET`, then `FEATURE_KEEPSAKES=1`. The worker airdrops when the balance is low.

- Computer 2 is a write collaborator: `shreekardittakavi` (added 2026-10-24).
- Accounts/keys from plan section 14 (C2-0 provisions them): Meta API, Facebook app, Tiger Data, Vultr, domain, etc.
- Complete C2-0 from plan section 7: Meta Model API key and HackTX credit, Meta developer app
  and Tester accounts, Muse app sign-in, SerpAPI credits, Gemini key, a Computer 2 Tiger Data dev
  service, Snowflake trial/PAT/network policy, Vultr account/Object Storage, and `ourlore.tech`.
- Share C2-0 secrets through a password manager only. Do not paste them into chat or commit them.

## Deviations from the plan

_Record every deviation in `docs/IMPLEMENTATION_PLAN.md` and in the log below so the plan stays true._

- On October 24, 2026, the human explicitly authorized starting the next milestone while C2-1's paid
  live smoke remained blocked on C2-0 credentials. C2-2 was implemented under section 6's explicit
  human-change exception; the outstanding C2-1 live check remains required.
- On October 24, 2026, the human again explicitly authorized the next milestone while C2-2 integrated
  acceptance remained open. C2-3 was implemented under section 6's exception; neither C2-2 nor
  C2-3 integration acceptance is waived.
- On October 24, 2026, the human explicitly authorized the next three milestones (C2-4 through
  C2-6) while prior integrated/live acceptance remained open. Work proceeds under section 6's
  exception without waiving any prior acceptance check.

## Log

- **2026-10-24 · C1-0a** — Installed Node 22 (official nodejs.org tarball, checksum verified) to
  `~/.local/node` and pnpm 9.15.9 because the machine had no Node. Initialized git repo at
  `/Users/hamiziqbal/Documents/hack_tx_project` (repo root = `lore/` in the plan). Wrote root config
  (`package.json`, `pnpm-workspace.yaml`, `turbo.json`, `biome.json`, `tsconfig.base.json`,
  `lefthook.yml`, `.gitignore`, `.nvmrc`), empty workspace packages, and docs
  (`IMPLEMENTATION_PLAN.md`, `CONTRACTS.md`, `HANDOFF.md`, this log).
- **2026-10-24 · C1-0a done** — `gh repo create hamizfaraz/lore --private`, pushed `main`.
- **2026-10-24 · C1-0b (partial)** — Wrote shared contracts, db schema + SQL, tokens, ai stubs, api
  package config. Library versions pinned to plan majors (Next 15, BullMQ 5, motion 12, Fastify 5,
  Socket.IO 4, TS 5, Tailwind 4); zod 4 chosen (required by fastify-type-provider-zod ≥6).
  Deviations recorded in plan section 18. Pushed WIP to `c1/platform`.
- **2026-10-24 · C1-0b done** — api lib + registry + 19 module stubs + entrypoints; web shell,
  components, all routes, registries, C2 stubs; icons; dev compose; CI; e2e skeleton. Built Valkey,
  Postgres 17, TimescaleDB, pgvector from source into `~/.local` (no Docker/Homebrew on this Mac) and
  verified schema push, hypertables, `/v1/ready`. Fast-forwarded `main` to the scaffold and pushed.
- **2026-10-24 · C1-1 done** — Better Auth email/password + Facebook provider, users module, auth screens, onboarding.
- **2026-10-24 · C1-2 done** — media pipeline with S3 + signed local fallback; verified presign/PUT/complete/thumb.
- **2026-10-24 · C1-3 done** — social core API + screens. API acceptance run: carousel visible on own feed in 17 ms,
  follower sees it, likes/comments/mention notifications, private account hidden (feed/profile/direct), story in
  follower rail. Socket.IO client now uses default transports (polling→upgrade) because Next dev rewrites don't proxy WS.
- **2026-10-24 · C1-4 done** — chat API/realtime/screens. Socket acceptance: 5 ms delivery, idempotent clientId, reconnect
  backfill without duplicates (fixed µs-vs-ms cursor bug), typing relay, removed member 403 + no events, guest join.
  CI now runs a Timescale Postgres + Valkey service, `db:push` + `db:setup`, then DB-backed tests. Added `pgArray()` in
  @lore/db for binding arrays as one parameter.
- **2026-10-24 · C1-5 done** — group accounts, 4 policies, drafts/approvals/publish with row lock, DraftCard, policy UI.
  Added `post_drafts.target` (post|story). Decision: the human author's submit counts as their approval (matches the
  section 16 e2e "Ava proposes; Leo approves; a third approval injected"); edits void ALL approvals incl. the author's
  (matches "editing after 2 approvals resets the count to 0").
- **2026-10-24 · C1-6 (code) done** — prod Docker/Caddy/compose/deploy/bootstrap/S3 scripts. Deploy itself awaits accounts.
- **2026-10-24 · C1-7/8/11 done** — game engine, One-Word Story, Meme Battle, Pictionary (API + UI + 10 engine tests).
  HTTP flows verified: OWS (choices only to active player, lore notice, result card, share to story, abandoned lobby
  can't share), Meme (anonymous gallery incl. AI entry, no author ids leak, self-vote blocked, reveal), Pictionary
  (prompt hidden from guesser, case/punctuation-insensitive guess). Built ahead of C1-9 because the shared engine
  needed all three rule sets.
- **2026-10-24 · C1-9 done** — explore API (verified search, groups in results, private hidden) + Explore/Reels/Notifications screens.
- **2026-10-24 · C1-10 done** — Graph import, category map, Friends on LORE, connections settings, disconnect clears graph tags. 5 graph tests pass. Live Facebook login still needs Tester credentials.
- **2026-10-24 · C1-12 done** — Devnet keepsake mint (Metaplex Core), public metadata, wallet pubkeys at signup, flag off. 4 service tests with a fake minter. Live explorer link needs `SOLANA_VAULT_SECRET`. C2 still has to render `KeepsakeButton` on the recap.
- **2026-10-24 · C1-13 done (code)** — LoadError on Home, Inbox, Activity, Reels, Explore, and profile grids. Offline banner. Desktop home is a 470px column plus a suggestions aside at xl; the phone top bar hides from md up. Home swipe left opens inbox and right opens the story camera, and ignores carousels. Tap targets that were `h-11` under the 14px root font are now 44px. Explore search no longer shares the grid query key (that crashed search on the first keystroke). Browser-checked on the local app: desktop column, phone home, explore search, inbox, notifications, profile. Not checked on a physical phone.
- **2026-10-24 · collaborator** — `shreekardittakavi` has write access on `hamizfaraz/lore` and can clone and push `c2/intelligence`.
- **2026-10-24 · C1-13 phone check** — Presenter finished the side-by-side with Instagram. No mismatches were reported, so C1-13 is closed.
- **2026-10-24 · Computer 2 kickoff** — Cloned `hamizfaraz/lore`, verified the original checkout is
  clean on `main`, created the isolated Computer 2 branch before any file changes, and aligned its
  name to the plan-required `c2/intelligence`. Created a dedicated worktree for that branch.
- **2026-10-24 · Main scan** — Read the implementation plan, contracts, handoff board, context log,
  root configuration, and existing package stubs directly from `main`. Fetched `origin`; both local
  and remote `main` remain at `136e13f`, so the required C1-0b scaffold is not available yet.
- **2026-10-24 · C2-1 provider core** — Added only plan-approved dependencies to `packages/ai` and
  implemented provider adapters for Muse Spark/Image/Voice, Gemini embeddings/guard, and cached
  SerpAPI searches. Added `callStructured` with zod validation, one schema-repair attempt, provider
  backoff, and an explicit degraded mock fallback; Valkey-compatible AI budgets; safety helpers;
  locked persona/concierge/recap/game/family/discovery/image-style prompts; C1-facing game helpers;
  11 JSON fixtures, 6 image fixtures, and 2 WAV/transcript fixtures; and a paid-provider live smoke
  entrypoint that requires `AI_MODE=live` plus `AI_SMOKE_WAV_PATH`.
- **2026-10-24 · C2-1 verification** — `@lore/ai` typecheck and Biome pass; Vitest passes 6 tests
  across structured repair/fallback, budgets, and game prompt fallback; mock smoke validates all 11
  JSON fixtures and reports the expected six image and two voice fixtures. No live provider call was
  attempted because C2-0 credentials have not been supplied.
- **2026-10-24 · Workspace verification** — Whole-workspace typecheck and tests pass. Workspace
  lint has one failure in C1-owned root `biome.json` (formatter output only); C2 did not modify that
  owned path and added a C2->C1 item to `docs/HANDOFF.md`. `git diff --check` passes.
- **2026-10-24 · C2-1 mock/provider hardening** — Extended `AI_MODE=mock` across Muse Image, Muse
  Voice batch/realtime, Gemini embeddings/safety, and SerpAPI so no runtime provider adapter needs a
  key during development. Added anti-hallucination reference enforcement for SpeakDecision,
  PlanRanking, and RecapDraftSpec. C2-1 verification now passes 13 tests across 5 files, package
  typecheck/lint, and mock smoke.
- **2026-10-24 · C2 checkpoint pushed** — Pushed `c2/intelligence` through commit `2c43f97` to
  GitHub. A post-push fetch confirmed `origin/main` is still `136e13f` (C1-0a only). Per the ordered
  dependency rules, do not start C2-2 until C1-0b is merged to `main`, this branch is rebased, and
  C2-1 is reconciled with the shared contracts. Live C2-1 smoke also remains blocked on the
  human-owned C2-0 credentials and a local spoken WAV path.
- **2026-10-24 · Local run requested** — Fetched `origin/main` and confirmed it remains at
  `136e13f`. Ran the C2 AI runtime with `AI_MODE=mock`: all 11 JSON fixtures, 6 image fixtures, 2
  voice fixtures, five-word choices, game prompts, guard, and budget smoke passed. Ran the root
  `pnpm dev` command in mock mode; Turborepo exited successfully with zero tasks because no package
  has a `dev` script until C1-0b lands. No application server or browser URL exists yet.
- **2026-10-24 · Minimal run harness** — At the human's request, added only a C2-owned development
  harness: `packages/ai` now has a `dev` script that runs the existing mock smoke under `tsx watch`.
  No product feature, web page, API endpoint, database module, or C1-owned file was implemented.
  Package typecheck, lint, and all 13 tests pass; root `pnpm dev` now remains running with the C2
  smoke green. During the C1 merge, reconcile or remove this temporary harness after the real
  web/API/worker dev scripts are present.
- **2026-10-24 · C2 immediate-scope file** — Verified the newly supplied full implementation plan is
  identical to the repo's original plan through section 17 and re-checked `origin/main` at
  `136e13f`. Added `docs/C2_NOW.md`, which identifies C2-0/C2-1 as the only current work, inventories
  the existing C2-1 partial implementation, lists the remaining live/shared-contract/mock-asset
  work, records merge-time runner reconciliation, and explicitly blocks C2-2 through C2-12. No
  product code was changed.
- **2026-10-24 · Full C2 plan replaces immediate scope** — Removed `docs/C2_NOW.md` at the human's
  request and added `docs/C2_IMPLEMENTATION_PLAN.md`, a complete C2-0 through C2-12 execution plan.
  It records ownership boundaries, ordered dependency gates, current C2-1 state, per-task backend,
  UI, test, and completion requirements, cross-computer contracts, privacy rules, checkpoints, cut
  order, merge protocol, and recovery steps. No product code was changed.
- **2026-10-24 · Single-plan reset** — Retired the old broad implementation workflow and promoted
  the complete C2 plan to `docs/IMPLEMENTATION_PLAN.md`, the only active implementation plan. The
  previous plan and temporary `C2_NOW.md` remain recoverable through git history but are no longer
  instructions. Updated the recovery path and the AI package README's environment reference
  accordingly; no product code was changed.
- **2026-10-24 · C1-0b integration** — Fetched `origin/main` at `73814e9` and rebased only
  `c2/intelligence` onto it. Resolved the scaffold conflicts by retaining C1's shared schemas and
  frozen public interface while preserving the C2 implementation behind them. Regenerated the
  dependency lockfile during the rebase; no C1 branch or `main` was modified.
- **2026-10-24 · C2-1 completion pass** — Replaced local schema authority with `@lore/shared`,
  completed all frozen game and guard methods, added retry/fallback behavior for Muse, Gemini, and
  SerpAPI, connected SerpAPI cache calls to C1's ioredis-compatible shape, and made degraded state
  explicit. Added six distinct image fixtures, two synthesized spoken WAV fixtures, schema checks
  for every structured fixture, media validation tests, and stricter live smoke failure detection.
  Removed the temporary AI-only dev watcher now that C1's real processes exist.
- **2026-10-24 · C2-1 integrated verification** — Repository typecheck, tests, lint, build, mock
  smoke, and `git diff --check` all pass. C2 has 17 passing tests across six files; shared policy has
  11 passing tests. Local configuration contains none of the required Meta, Gemini, or SerpAPI
  credentials, so the paid live smoke was not attempted and remains the only C2-1 done-condition
  outstanding.
- **2026-10-24 · Local test run** — Started the rebased application with `AI_MODE=mock` and verified
  the web server returns HTTP 200 at `http://localhost:3000`; opened the visible `/login` scaffold
  for the human to test. The API, worker, and MCP initially listen but exit after ioredis exhausts
  retries because Valkey is unavailable. Docker cannot be used by the current user due daemon-socket
  permissions. The web process remains running, and the separate AI mock smoke is fully green.
- **2026-10-24 · C2-2 explicitly authorized** — The human instructed Computer 2 to start the next
  milestone. Recorded this as the section 6 exception because the C2-1 paid live smoke is still
  blocked on human-owned provider credentials. Fetched `origin/main` and confirmed it remains at
  `73814e9`; no C1 branch or `main` was modified.
- **2026-10-24 · C2-2 persona engine** — Implemented the C2-owned persona policy, repository, service,
  routes, jobs, typing event, and shared request/response contracts. The engine applies disclosure,
  consent redaction, conversation isolation, quiet/mute/spacing/typing/budget gates, deterministic
  scoring, grounded news and references, guard checks, low/medium-sensitivity memory persistence,
  tentative event persistence, rare-image limits, decision logging, and C1 chat/media integration
  interfaces. Added a C1 handoff for the post-commit human-message hook.
- **2026-10-24 · C2-2 studio and verification** — Implemented the basic persona studio, preview and
  join controls, mute/remove UI, memory correction/deletion, explanation sheet, and AI-illustration
  label. Added 23 focused persona tests. The full workspace passes typecheck, 51 tests (17 AI, 14
  shared, 20 API), Biome over 404 files, production web/API build, and `git diff --check`. Integrated
  acceptance remains open until C1-4 supplies the hook and PostgreSQL/Timescale plus Valkey are
  reachable; C2-3 has not started.
- **2026-10-24 · C2-3 explicitly authorized** — The human instructed Computer 2 to implement the
  next milestone while C2-2 integration remained pending. Fetched the agreed checkpoints:
  `origin/main` remains `73814e9`; `origin/c1/platform` is `f610144` and contains the in-progress
  recording/media/chat hooks needed at merge. C2 remained based only on `main`, and no C1 branch or
  `main` was modified.
- **2026-10-24 · C2-3 voice runtime** — Implemented the batch transcription service/route/job,
  C2-owned voice repository and privacy-safe audit record, signed-media download, real ffmpeg
  normalization, retries and terminal failure handling, degraded labels, message refresh, six-second
  deadline, authenticated/membership-scoped raw WebSocket proxy, exact 80 ms PCM framing, server-side
  Muse handshake, cumulative partial/final relay, uploader attribution, clean shutdown, and the
  browser `LiveCaption` client. Added merge handoffs for C1's existing media/recorder hooks and
  degraded transcript rendering.
- **2026-10-24 · C2-3 verification** — Added 18 focused tests, including a real ffmpeg conversion.
  Full verification passes 69 tests (18 AI, 16 shared, 32 API, 3 web), six typechecks, Biome over 414
  files, mock provider smoke, production web/API build, browser-bundle provider-secret scan, and
  `git diff --check`. Live batch/realtime acceptance remains blocked on C2-0 Muse credentials and the
  C1 auth/media/chat merge; C2-4 has not started.
- **2026-10-24 · C2-4 concierge/plans** — Implemented membership-scoped preferences, grounded
  candidate discovery and persistence, embeddings, hard filters, unknown-price handling, an
  at-home guarantee, maximin/diverse ranking, proposal/version/vote/refine/confirm/RSVP behavior,
  calendar output, `plan.updated`, source labels, fair-fit cards, confirmed cards, and the Plans
  surface. Seven focused tests plus shared/API/web typechecks pass. Chat-card integration remains
  pending on C1's frozen service implementations; C2-5 is next.
- **2026-10-24 · C2-4 checkpoint** — Committed and pushed the resumable plans milestone as
  `1c5b015` on `c2/intelligence`; `main` and C1 branches were untouched.
- **2026-10-24 · C2-5 memories/recaps** — Implemented confirmed-plan event creation, proximity
  clustering, pHash duplicate removal, consent propagation, real 1024 px signed-photo review,
  grounded recap composition, four metadata-free 1080×1350 Sharp layouts, private recap storage,
  AI labels, editor/list/card UI, owner revocation, private save/chat share, and governed C1 draft
  handoff. Ten focused tests and API/web typechecks pass. C1's unprovided story-creation interface
  remains a fail-closed handoff; C2-6 is next.
- **2026-10-24 · C2-5 checkpoint** — Committed and pushed the resumable memories milestone as
  `8c2fc25` on `c2/intelligence`; no other branch was modified.
- **2026-10-24 · C2-6 scoped MCP connector** — Implemented unbiased base62 PAT generation,
  SHA-256-only persistence, one-time UI reveal, session-authenticated token management, immediate
  revoke, the Connect Muse surface, and a stateless Streamable HTTP MCP server. All 11 required
  tools are advertised with use/non-action descriptions. Every valid call is scope checked and
  audited; writes additionally require explicit confirmation; plan votes use only the PAT owner;
  private recap and unavailable family operations cannot publish directly. C1-owned approval/game
  and later-C2 family/discovery integrations fail closed and are recorded in the handoff.
- **2026-10-24 · C2-6 verification** — Added 11 focused policy/service tests. Full verification
  passes six typechecks, 97 tests (18 AI, 16 shared, 60 API, 3 web), Biome over 428 files, mock AI
  smoke, production web/API builds, and `git diff --check`. Against the isolated local PostgreSQL
  and Valkey containers, an actual SDK client completed the Streamable HTTP handshake, listed all
  11 tools, executed `list_groups`, and produced a credential-free audit row. Revoking the
  disposable PAT caused the next request to return HTTP 401 immediately. A live plan-vote UI smoke
  remains gated on C1 auth/chat implementation and C2-7 demo seed data.
- **2026-10-24 · C2-7 deterministic demo world** — Added target-safe seed/reset tooling, explicit
  live candidate refresh, and paid seed-art generation. The dataset creates six demo users,
  `@weekendcrew`, `The Iqbals`, governance, Milo, 90 grounded messages, stated constraints, memories,
  consent-scoped image/voice rows, labeled AI art, posts, candidates, a voting proposal, a completed
  plan/event/private recap, discovery profiles, and family-story inputs. Ambiguous/default database
  selection and unconfirmed live/paid commands are rejected.
- **2026-10-24 · C2-7 verification** — Against only the explicitly selected `127.0.0.1/lore`
  container, seed completed in 382 ms and the documented reset reproduced it in 201 ms. Consent
  audit totals were 90 messages, seven opted-in memberships, two included recap media, and five
  explicitly scoped assets; the seed-source secret scan and `git diff --check` pass. C1 demo login,
  physical media materialization, and the three-minute browser chain remain an integration handoff.
- **2026-10-24 · C2-8 Common Ground** — Implemented the optional interest quiz, default-off
  discoverability, safe caption tags, five public signal kinds, 14-day decay, explicit removal and
  freeze, profile embeddings, existing-follow exclusion, top-30 Jaccard/cosine/serendipity ranking,
  24-hour pair reasons restricted to shared tags, match UI, and editable consent-gated introductions.
  Declines have no side effect and accepted state does not create a DM until C1 supplies that hook.
- **2026-10-24 · C2-8 verification** — Seven focused policy/service tests and shared/API/web
  typechecks pass. The MCP Common Ground tool now prepares an unsent editable proposal after explicit
  confirmation. C1 public-action signals, block exclusion, and post-accept DM creation are recorded
  as merge handoffs; C2-9 is next.
- **2026-10-24 · C2-9 impact analytics** — Added a fixed event allowlist, SHA-256 hashes for
  group/actor/object identities, strict coarse-property sanitization, random event ids, and a
  timestamp/event-id sync cursor. The 60-second worker sends at most 500 rows through Snowflake SQL
  API v2 using PAT auth, bounded retries, stable request ids, and idempotent `MERGE`; six secure views
  drive the required metrics. Cortex sees only aggregate metric keys and numbers.
- **2026-10-24 · C2-9 local acceptance** — Applied the two analytics cursor columns to the isolated
  local database. A 90-second intent-to-confirm pair appeared immediately as one confirmed plan per
  active group and a 1.5-minute median; the public DTO contained no raw group id. Snowflake correctly
  reported unconfigured without advancing its cursor. Six focused tests and affected typechecks pass;
  live Snowflake/Cortex verification remains blocked on human-owned C2-0 credentials.
- **2026-10-24 · Three-milestone verification** — C2-7, C2-8, and C2-9 now pass all six workspace
  typechecks, 110 tests across 28 files, Biome over 444 files, mock provider smoke, production API
  and web builds, and `git diff --check`. The impact and Find Friends routes are present in the
  production route manifest. Paid-provider, live Snowflake, and C1 merge acceptance remain explicit.
- **2026-10-24 · Pre-checkpoint remote audit** — A read-only fetch confirmed `origin/main` remains
  `73814e9`. `origin/c1/platform` advanced independently to `14fe779`; C2 did not merge, copy, or
  modify that branch, preserving the agreed integration boundary.
- **2026-10-24 · C2-10 Family Story** — Implemented consented date-range collection, per-contributor
  source control, media transcript/caption context, strictly grounded structured composition,
  source-visible private review, correction-based flag resolution, share blocking while any flag is
  open, private sharing, and governed public-draft delegation. Added the mobile review/generate/share
  UI plus a non-production seeded-demo identity bridge because C1 authentication is still a stub.
  Shared/API/web typechecks and three grounding tests pass. C1 media URLs/covers and the group draft
  service remain merge-time integrations; C2-11 is next.
- **2026-10-24 · C2-11 Podcast Stations** — Implemented show/cast freeze, root and branch stations,
  exact 20-second owned voice validation, database daily uniqueness, voice-only APIs, visible
  uploader attribution, host wrap and missing-participant finish gates, ordered ffmpeg MP3 output,
  300 ms gaps, and intro/outro tones. Added the mobile 20-second recorder and a deterministic seeded
  show with three submitted clips plus Noor's missing clip for the end-to-end gate demo. Reset the
  isolated local database in 237 ms; it now contains nine consent-scoped media rows. Focused policy
  tests and affected typechecks pass. Optional MP4 is cut; C1 signed-media/storage remains the final
  production integration. C2-12 is next.
- **2026-10-24 · C2-12 Advanced Persona Studio** — Added four distinct house-style Muse Image
  avatar choices, a selected-only storage boundary, editable tone/interests/boundaries, quiet hours
  in the browser's IANA time zone, existing permission controls, and exactly three preview-only
  scenarios that never join the chat or write memories. Applied AI assistant, Generated with AI,
  and Why labels to every preview; completed loading/empty/degraded/error/mobile/dark/reduced-motion
  states. Added `/c2-lab` as a single seeded launcher for milestones 10–12 and extended the local
  demo identity bridge to the persona routes. Focused shared/AI/API tests and affected typechecks
  pass; final whole-workspace verification and phone smoke are next.
- **2026-10-24 · Final C2-10–12 verification and test lobby** — Moved only the three new feature
  wrappers and `/c2-lab` outside the unfinished C1 signed-in shell so the seeded local test does not
  stall on C1's unimplemented `/v1/me`. Strengthened demo reset to remove dynamically created family
  stories, podcast branches, and contributions. Six typechecks, 119 tests across 30 files, Biome over
  453 files, production API/web builds, mock AI smoke, and `git diff --check` pass. A real local API
  smoke collected 10 family sources and one grounded chapter with one blocked flag; advanced the
  podcast from one missing participant through four clips, wrap, and finish; ffprobe verified the
  required MP3 at 81.9 seconds; and returned four distinct avatar images plus exactly three persona
  previews. The isolated database was reset cleanly in 202 ms after the smoke. Both the hotspot and
  Tailscale lobby URLs returned HTTP 200 with the expected test UI.
- **2026-10-24 · Final C2 branch checkpoint** — Changed the Podcast Noor/Ava demo switch to a full
  page navigation so the selected local identity cannot remain stale in client state. Re-ran all six
  typechecks and pushed the complete C2 feature series through `466cfda` on `c2/intelligence`.
  The worktree is clean and synchronized with `origin/c2/intelligence`; the restored test lobby is
  running at the verified hotspot URL. Production C1 media/auth/chat integration and paid-provider
  acceptance remain explicit handoffs, not hidden completion claims.
- **2026-10-24 · final merge** — Combined `c1/platform` and `c2/intelligence` on `integrate/final-2227`. Conflicts: `docs/IMPLEMENTATION_PLAN.md` (M7, both records kept), `docs/PROJECT_CONTEXT_LOG.md` (M7, both records kept), `pnpm-lock.yaml` (M2, regenerated). Deploy and the remaining human keys are deferred.
- **2026-10-24 · local finish without external accounts** — Wired `recap_posted` onto an actual group-post publish, speaker-labeled podcast MP4 after the MP3, signed persona avatar URLs, voice transcript failed/approximate labels, and demo-seed credential passwords (`password123` on the `*.demo@ourlore.test` users). Extended `e2e/smoke.spec.ts` past `/v1/ready`. Did not register the domain, create cloud accounts, move `main`, or run the demo seed against the live local database.
- **2026-10-25 · essential completion pass** — Added source-tracked replacement/revocation semantics for Facebook discovery tags and covered replacement plus legacy disconnect cleanup. Replaced the unsupported Timescale `unnest()` continuous aggregate with a standard materialized view and a 15-minute worker refresh. Fixed Milo's invalid BullMQ deduplication id and handled chat fan-out promises cleanly. Removed the `x-lore-demo-user` bridge after two deterministic local resets (122 ms/98 ms) and successful Better Auth credential login plus `/v1/me`. Removed the Google Fonts build-time network dependency. Six workspace typechecks, Biome, mock AI smoke, API build, web production build, focused media/discovery tests, and all 112 API assertions pass; the native database lacks optional Vectorscale/DiskANN as documented.
- **2026-10-25 · reproducible product-demo recorder** — Added a separate Playwright video project and
  one-command recorder on `demo/playwright-video`. The directed 1280×720 tour signs in to the rich
  local demo world and stages every major product surface with branded transitions, explanatory
  lower-thirds, eased cursor motion, click ripples, and smooth scrolling. `pnpm demo:record` enforces
  a local-only database reset, materializes missing media, starts the complete local stack with all
  feature flags enabled, captures WebM, and exports a shareable MP4 using the best local encoder.
  The rich seed now uses a dense but intentionally incomplete social graph so Common Ground can show
  real unconnected matches instead of an empty state. The final 3:45 recording passed end-to-end and
  was visually checked at its feature chapters and closing card. `docs/DEMO_VIDEO.md` documents the
  flow and artifact paths; main remains untouched.
- **2026-10-25 · demo pacing revision** — Removed the full-screen chapter/title overlays and their
  fades, replaced full document reloads with a demo-only in-app navigation bridge, and tightened
  caption, cursor, and scroll timing so the complete feature walkthrough remains continuous and
  finishes below the three-minute limit. The regenerated 1280×720 H.264 recording passed the full
  Playwright flow at 2:05; a contact-sheet review confirmed continuous product frames with no
  interstitial title/loading screens.
- **2026-10-25 · group-first demo narrative** — Reframed the recording around the implementation
  plan's primary causal chain: a group-authored feed post and profile, posting as `@weekendcrew` under
  an approval policy, the group chat and Details hub, collective planning and games, a consent-aware
  recap becoming a group post, group-controlled AI, podcast, governance, Muse access, and impact.
  Explore, Reels, personal-profile discovery, Common Ground, and the family-story detour were removed
  from the recording so the shared group identity remains the main selling point throughout. Repointed
  the three core Weekend Crew seed posts and recap inputs to bundled local photography, removing gray
  media placeholders while keeping the demo deterministic and honestly labeled. The final 1280×720
  H.264 cut passed end-to-end at 1:46; opening-frame and full contact-sheet reviews confirmed the group
  post media, group composer, and remaining feature sequence render cleanly.
- **2026-10-25 · games-focused demo variant** — Added a second reproducible group-first recording
  path that keeps the original cut intact while expanding the games chapter. The alternate flow now
  compares One-Word Story, Meme Battle, and Pictionary controls; selects consented group-lore prompts;
  opens an opt-in lobby; plays three actual One-Word Story turns with the five-choice constraint; and
  shows the existing group chat attached to the active round. `pnpm demo:record:games` writes distinct
  `lore-games-demo` artifacts, while `pnpm demo:record` retains the standard group-first behavior. A
  third eligible low-sensitivity Weekend Crew memory was added to the deterministic seed so the
  selected group-lore mode is exercised honestly instead of visibly falling back to random prompts.
  The final 1280×720 H.264 cut passed end-to-end at 2:15. A focused contact-sheet review confirmed the
  three format controls, group-lore selection, lobby, live word choices, story progress, and attached
  chat all render cleanly with no fallback notice.
- **2026-10-25 · Playwright + UI refresh integration** — Merged `feat/ui-refresh` into
  `work/computer-2-next` without conflicts, leaving `main` untouched. The combined branch now contains
  the complete Playwright recording workflow, group-first and games-focused demo variants, refreshed
  card architecture, navigation, messaging surfaces, feed layout, and communal design tokens. All six
  workspace typechecks pass. The same expanded games walkthrough passed end-to-end against the merged UI
  and produced `lore-games-ui-refresh.mp4`: 1280×720 H.264, 2:16, with no Explore or Reels detour. Full
  and games-chapter contact-sheet reviews confirmed the refreshed feed, group composer, chat, three game
  modes, group-lore lobby, live turns, downstream feature screens, and captions render cleanly.
