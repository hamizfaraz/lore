# LORE — Project Context Log

> **Purpose.** A running, always-current record of everything done on this repo, the exact current
> state, and the context a new person or coding agent needs to resume work mid-stream. Update it at
> the end of every task and at every meaningful step. Newest log entries go at the **bottom** of the
> log section; the "Current state" section is rewritten in place.

## How to resume (read this first)

1. Read `docs/IMPLEMENTATION_PLAN.md` (the source of truth; sections 1–9 shared, 10 task list, 13 merge).
2. Read the **Current state** section below, then the last few **Log** entries.
3. Check `docs/HANDOFF.md` (cross-computer requests) and `docs/CONTRACTS.md` (contract changes).
4. Toolchain on the original machine: Node 22 is installed user-local at `~/.local/node/bin`
   (added to `~/.zshrc`); pnpm 9 is installed globally in that Node. Run
   `export PATH="$HOME/.local/node/bin:$PATH"` in non-login shells.
5. `pnpm install`, then continue the first unchecked task in the task tracker below.

## Repo + branches

- GitHub: `hamizfaraz/lore` (private).
- `main` — C1-0a and C1-0b land here directly (per plan). After that, `main` moves only via merges (section 13).
- `c1/platform` — Computer 1 (this machine's agent) works here from C1-1 on.
- `c2/intelligence` — Computer 2's branch (created by Computer 2).

## Current state

_Rewritten after each step._

- Phase: **C1-13 code done** (empty/error states, 44px targets, desktop feed column, offline banner, home swipe). Phone side-by-side with Instagram, Facebook Tester login, Vultr deploy, VAPID keys, and the Solana vault key still need a human. Computer 1's task list is otherwise complete.
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
| C1-13 | Polish | code done; phone QA needs a human | error states, 44px targets, desktop column, offline banner, home swipe |

## Things that need a human (cannot be done by the agent)

- **First deploy (C1-6)**: follow `infra/README.md` checklist — create Vultr VM + Object Storage, DNS A records
  (`@`, `www`, `mcp`), prod Tiger service, `.env.prod` on the VM, then `VULTR_VM_IP=… ./infra/deploy.sh`.
- Facebook app credentials + Tester accounts to verify Facebook login (C1-1) and Graph import (C1-10).
- Generate VAPID keys for web push: `npx web-push generate-vapid-keys` → `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` (+ `NEXT_PUBLIC_VAPID_PUBLIC_KEY`).
- Solana devnet vault for keepsakes: `solana-keygen new` → base58 secret in `SOLANA_VAULT_SECRET`, then `FEATURE_KEEPSAKES=1`. The worker airdrops when the balance is low.

- Computer 2 is a write collaborator: `shreekardittakavi` (added 2026-10-24).
- Accounts/keys from plan section 14 (C2-0 provisions them): Meta API, Facebook app, Tiger Data, Vultr, domain, etc.

## Deviations from the plan

_Every deviation is also recorded in `docs/IMPLEMENTATION_PLAN.md` (section 18, "Implementation notes") so the plan stays the truth._

- `mayPublish`: AI drafts under direct/courtesy publish after >= 1 valid approval (the plan's snippet
  returned false forever, contradicting 8.4 acceptance "still requires an approval").
- Extra C1-owned tables/columns: `post_likes`, `post_saves`, `push_subscriptions`, `user_wallets`,
  `social_accounts.avatar_url/show_on_profile/onboarded_at`, `user.guest_expires_at`,
  `posts.draft_id/topic_tags/deleted_at`, `post_media.alt_text`, `media_assets.thumb_key/bytes/completed_at`,
  `conversations.join_slug/join_code/last_message_at`, `conversation_members.pinned_at/removed_at`,
  `messages.client_id`, `post_drafts.message_id/created_at`, `game_sessions.last_action_at`, `keepsakes.status/created_at`.
- C2-owned files got small scaffold additions they need: `ai_personas.muted_until`, `recaps.facts_used`.
- Message idempotency uses a plain index + Valkey key (hypertable unique indexes must include `created_at`).
- Added dev tooling deps outside section 4: `tsx` (run TS), `tsup` (bundle api), `dotenv-cli`; logged in HANDOFF.
- Icons/splash via a sharp script instead of `pwa-asset-generator` (needs headless Chrome).
- Extra route `/p/[id]` (post detail, Grid3 tiles link there) and `/offline` (service-worker fallback).
- Profile tab root = `/u/<my handle>`; AppShell keeps Home/Search/Reels/Profile roots mounted; Inbox and
  Notifications are pushed screens (as in Instagram).

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
