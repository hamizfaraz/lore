# LORE — Full Implementation Plan (HackTX 2026 · Meta Track)

Oct 24, 2026 · @Hamiz Iqbal

## 1. Executive summary and locked decisions

LORE ships as a mobile-first PWA (Next.js) backed by one Node API on Vultr, with Tiger Data Postgres as the single source of truth and the Meta Muse family doing every piece of reasoning, image, and voice work. Two coding agents build it in parallel on two branches that own disjoint folders, then merge through the protocol in section 13.

The winning demo is one unbroken causal chain judges can watch on real phones: **a group chat → Milo (the AI member) notices a plan forming → Muse Spark builds an inclusive shortlist from real SerpAPI results → two humans vote and a human confirms → photos from the outing become a recap with a Muse Image cover → the group approves a post to its shared account → the same plan is queried from the Muse personal agent via our MCP connector.** Every other feature in the spec is built, but ranked below that chain.

### How to use this document with coding agents

1. Both people read sections 1–9 once. They are the shared truth and every agent prompt points back to them.
2. Computer 1 pastes the Computer 1 prompt from section 12; Computer 2 pastes the Computer 2 prompt. Each agent reads the whole doc but only executes its own task list from section 10.
3. At each checkpoint in section 11, and at the end, one machine pastes the merge prompt from section 13 with both branch links.
4. Export this doc as Markdown (Export menu) and commit it to the repo as `docs/IMPLEMENTATION_PLAN.md` so agents can re-read it from disk.

### Locked decisions (do not re-litigate during the build)

| Decision | Choice | Why |
| --- | --- | --- |
| Product name and domain | LORE at **ourlore.tech** (fallbacks: getlore.tech, lorelife.tech) | Relationship-first wording; claims the .TECH prize |
| Client | Next.js 15 PWA installed to the home screen; behaves like a native app and mirrors Instagram's structure, flow, and UI screen for screen (section 9) | Demoed as a mobile app on phones; judges already know every gesture from Instagram; no app store needed |
| API | Node 22 + Fastify 5 + Socket.IO 4 + BullMQ workers, TypeScript everywhere | Realtime chat and games need WebSockets; workers absorb slow AI calls |
| Database | Tiger Data (Tiger Cloud Postgres + TimescaleDB + pgvector/pgvectorscale) via Drizzle ORM | One database for relational, time-series, and vector data |
| Cache and queues | Valkey (Redis-compatible) in Docker on the Vultr VM | Socket.IO adapter, BullMQ, rate budgets |
| Media | Vultr Object Storage (S3-compatible), presigned uploads, sharp + ffmpeg | Cheap, same provider as compute |
| Hosting | One Vultr Cloud Compute VM running Docker Compose behind Caddy (auto-HTTPS) | Simple, fast, and a clean Vultr story |
| Auth | Better Auth: email/password demo accounts + Facebook Login | Facebook Login is the Graph API entry point |
| Primary AI | Meta Model API: `muse-spark-1.1`, `muse-image-1.0`, `muse-voice-transcribe-1.0` | Meta track requires all of them; one key, one bill |
| Muse agent integration | Hosted MCP server at `https://mcp.ourlore.tech/mcp` (streamable HTTP, bearer token) | Muse custom connectors speak MCP to public HTTPS servers |
| Repo | pnpm workspaces + Turborepo monorepo on GitHub, branches `c1/platform` and `c2/intelligence` | Disjoint folder ownership makes the merge mechanical |
| Demo personas | Ava, Leo, Mia, Noor in group **Weekend Crew** with AI member **Milo**, region Austin, TX | Matches the spec's own examples; HackTX is in Austin |

### Build tiers

- **P0 (the demo chain, must ship):** native-feeling Instagram-structured app shell (section 9.3), auth, feed/posts/stories, group chat, Milo replies without @mention, proactive nudge, Concierge plan card with votes and confirm, recap with Muse Image cover, group account with approval policy, voice note transcription, MCP connector, deploy on ourlore.tech.
- **P1 (ships next, still in the demo if time allows):** One-Word Story, Meme Battle, Find Friends with Common Ground, family story, Snowflake impact page, reels, Explore search.
- **P2 (built last, cut first):** Pictionary, podcast stations with B-roll render, Solana keepsakes, AI personality studio advanced settings.

Every AI call goes through one adapter with a `AI_MODE=live|mock` switch. Mock mode returns schema-valid canned output, so neither computer is ever blocked on keys, credits, or the other computer's work. Anything mocked in the live demo is labeled on screen, as the spec requires.

## 2. Sponsor technology map

All five Meta technologies are load-bearing, and seven of the eight sponsor tracks get a role that improves the product rather than decorating it. SpaceXSI is a build-tool raffle, so it is satisfied by how you build, not by product code.

### Meta technologies (the judged track)

| Technology | Exact interface | What it does in LORE | Visible in demo | Owner |
| --- | --- | --- | --- | --- |
| **Muse Spark** | `POST https://api.meta.ai/v1/chat/completions`, model `muse-spark-1.1`, OpenAI SDK with `baseURL` set; tools, parallel tool calls, `response_format` JSON schema, `reasoning_effort` minimal→xhigh, image input | Milo's replies and proactivity scoring; Concierge intent brief and fair ranking; recap titles/captions from photo understanding; game prompts and five-word choices; family story chapters; Common Ground explanations; meme AI entry | Milo answers without @mention; plan card with "Why these?"; recap caption that references the actual party | C2 |
| **Muse Image** | `POST /v1/images/generations` and `POST /v1/images/edits`, model `muse-image-1.0`, returns `b64_json`; about $0.01 per image | Recap covers, One-Word Story final illustration, Meme Battle prompt images and AI entry, rare surprise images from Milo, plan-card decorative art (labeled), podcast B-roll stills, seed-content images | Story ending image renders live; recap cover labeled "AI illustration" | C2 |
| **Muse Voice Transcribe** | Batch: `POST /v1/asr/transcribe` (multipart, WAV mono PCM16 16/24 kHz). Realtime: `wss://api.meta.ai/v1/asr/realtime`, handshake frame with `authorization.accessToken`, binary PCM frames paced in real time, `endStream` | Voice notes in chat get transcripts; podcast clips get captions; live captions while recording; family voice memories become editable text | Record a voice note, live caption streams in, final transcript attached to the right author | C2 (service), C1 (recorder UI) |
| **Muse (personal agent) connector** | Our MCP server over streamable HTTP at `https://mcp.ourlore.tech/mcp`, `Authorization: Bearer lore_pat_…`; Muse builds a custom connector from one chat message | Muse can list a user's groups and plans, vote, propose a recap, check podcast status, draft an introduction | On a phone in the Muse app: "What is Weekend Crew doing Saturday? Vote for movie night." | C2 |
| **Facebook Graph API** | Facebook Login (OAuth) through Better Auth, then `GET graph.facebook.com/{version}/me?fields=id,name,picture`, `/me/likes`, `/me/friends` | One-tap signup with real name and photo; `user_likes` seeds Find Friends interests (with consent screen); `user_friends` shows which Facebook friends are already on LORE | "Continue with Facebook" → interests pre-filled → "2 friends are on LORE" | C1 |

Graph notes: in Development mode, people with a role on the app (admins, developers, testers) can grant `user_likes` and `user_friends` without App Review. Add both teammates and every demo account as Testers. Pin the version shown in App Dashboard → Settings → Advanced (use that exact `vNN.0` in every URL). `user_friends` only returns friends who also authorized the app, which is exactly the "friends already on LORE" feature.

### Sponsor tracks

| Track | Role in LORE | Why it is meaningful, not decorative | Owner |
| --- | --- | --- | --- |
| **SerpAPI** | Concierge candidate sourcing: `google_events` (local events), `google_maps` (places), `google` with knowledge-graph parsing for movies/shows/books, `google_news` for Milo's verified-news nudges | The spec forbids AI-invented venues or news. SerpAPI is the verification layer: every candidate card carries a source link and `lastVerifiedAt` | C2 |
| **Gemini API** | `gemini-embedding-001` (768-dim via `outputDimensionality`) for interest profiles, memories, and candidate dedupe; `gemini-3.5-flash` (verify exact id in AI Studio) as a fast safety classifier on game prompts and AI messages | Meta Model API has no embeddings endpoint we can rely on; matching and memory retrieval need vectors. The guardrail runs in parallel so it adds no latency | C2 |
| **Tiger Data** | The only database: hypertables for messages and events, a continuous aggregate of chat activity that drives Milo's silence and "hot thread" detection, pgvectorscale DiskANN indexes for vector search, BM25 (pg\_textsearch) for Explore | Time-series, relational, and vector workloads in one Postgres; proactivity is literally a query over a continuous aggregate | C1 (schema), C2 (vectors, aggregates) |
| **Snowflake** | Connection Impact warehouse: worker batches anonymized events to Snowflake via SQL API; Cortex REST (`/api/v2/cortex/v1/chat/completions`) writes a weekly "connection pulse" narrative over aggregates only | The spec says measure human connection, not session length. Snowflake holds the cross-group metrics (plans confirmed, intros accepted, games finished) shown on `/impact` | C2 |
| **Vultr** | Cloud Compute VM (Docker Compose: web, api, worker, mcp, valkey, caddy), Vultr Object Storage for all media | Entire production runs on Vultr; the MCP server must be public HTTPS for Muse to reach it | C1 |
| **.TECH domain** | `ourlore.tech`, `api` paths on the root, `mcp.ourlore.tech` subdomain | Real domain, real HTTPS, used in the demo | C1 |
| **Solana** | P2 "Lore Keepsakes": when a plan is completed and its recap is approved, mint one Metaplex Core asset on **devnet** to the group's vault address, with all member pubkeys and the recap hash in metadata | A shared, co-owned, tamper-evident memory fits the product; devnet keeps it free and risk-free. Cut first if behind | C1 |
| **SpaceXSI** | Build both branches in Cursor with a Grok model as one of the coding agents, and use the event's Grok Bot as instructed on the MLH page | The prize is a raffle for building with Cursor and Grok, not an API integration; do not put Grok in product code just to qualify | Both |

Credits: redeem the $50 Meta Model API credit (dev.meta.ai account + intake form) and the 1,000 SerpAPI searches (serpapi.com/hacktx2026) before H0. Budget: about 2,000 Muse Spark calls, 300 images ($3), and 2 hours of audio ($0.36) fit easily; SerpAPI calls are cached 6 hours per query to stay under 1,000.

## 3. System architecture

LORE is one TypeScript monorepo that deploys four processes (web, api, mcp, worker) plus Valkey behind Caddy on a single Vultr VM. Browsers and the Muse agent only ever talk to Caddy; only server processes hold API keys.

&#91;embedded content: LORE production topology · 1 VM, 2 managed stores, 6 external APIs\]

The api, mcp, and worker processes are three entrypoints of the same `apps/api` package, so REST routes, MCP tools, and background jobs call the exact same service functions and permission checks.

### Monorepo layout and ownership

```text
lore/
├─ apps/
│  ├─ web/                         Next.js 15 PWA
│  │  └─ src/
│  │     ├─ app/                   routes (route groups listed in section 9)
│  │     ├─ components/ui/         shadcn primitives + LORE components      [C1]
│  │     ├─ lib/                   api client, socket client, query keys    [C1]
│  │     └─ features/
│  │        ├─ auth feed stories reels explore create profile
│  │        │  chat groups games notifications keepsakes                   [C1]
│  │        └─ persona plans memories family podcast discovery
│  │           impact connect-muse voice                                   [C2]
│  └─ api/
│     └─ src/
│        ├─ server.ts  mcp.ts  worker.ts     three entrypoints             [C1 scaffold]
│        ├─ modules/index.ts                 static registry, frozen after scaffold
│        ├─ modules/{auth,users,social,media,chat,groups,games,
│        │          notifications,graph,keepsakes}/                         [C1]
│        ├─ modules/{persona,plans,memories,family,podcast,discovery,
│        │          impact,mcp,voice}/                                      [C2]
│        └─ lib/ (db, redis, s3, auth, errors, logger)                      [C1]
├─ packages/
│  ├─ shared/      zod contracts, event names, card kinds, enums  [scaffold; contract protocol]
│  ├─ db/          drizzle schema, one file per domain            [split by owner]
│  ├─ ai/          Muse, Gemini, SerpAPI clients, prompts, schemas, mocks   [C2]
│  └─ tokens/      design tokens (CSS variables + TS)                       [C1]
├─ infra/          docker-compose.yml, Caddyfile, deploy.sh                 [C1]
├─ scripts/        seed.ts, generate-seed-images.ts                         [C2]
└─ docs/           IMPLEMENTATION_PLAN.md, CONTRACTS.md, HANDOFF.md
```

Each module folder has the same shape: `routes.ts` (Fastify plugin), `service.ts` (business logic, the only place that touches the db), `jobs.ts` (BullMQ processors), `events.ts` (socket emits), `policy.ts` (authorization), `*.test.ts`.

### Key request flows

1. **Send a message.** Client `POST /v1/conversations/:id/messages` with an `Idempotency-Key` → api checks membership, inserts into the `messages` hypertable, emits `message.created` to room `conv:{id}`, enqueues `persona.consider` (debounced 4 s per conversation).
2. **Milo decides to speak.** Worker `persona.consider` builds context (last 40 messages, top 6 memories by vector search, persona config, activity stats from the continuous aggregate) → hard gates (muted, quiet hours, budget) → Muse Spark returns a `SpeakDecision` JSON → if `speak`, emit `ai.typing`, wait a human-like delay (1.5–6 s scaled by length), insert the AI message, emit `message.created`.
3. **Plan suggestion.** `SpeakDecision.intent = "plan"` or a member taps Plans → `plans.suggest` job → Muse Spark writes a `GroupIntentBrief` → SerpAPI queries per category → candidates upserted with source URLs → Muse Spark `PlanRanking` → `plan_proposals` row → message with card kind `plan_card` → votes via REST emit `plan.vote.updated`.
4. **Voice note.** Browser records Opus with MediaRecorder; optional live captions stream PCM16 over `/v1/voice/live` (api proxies to Meta realtime) → file uploads by presigned PUT → message created with `media_id` → `voice.transcribe` job converts to 24 kHz mono WAV with ffmpeg → `POST /v1/asr/transcribe` → transcript saved → `message.updated`.
5. **Group post approval.** Draft created (manual or from a recap) → policy snapshot frozen (mode, threshold, eligible voters) → card kind `draft_card` in the chat → approvals keyed by draft version → `mayPublish()` true → post inserted with `author_account_id` = the group account → `post.published`.
6. **Muse connector call.** Muse sends a JSON-RPC tool call to `mcp.ourlore.tech/mcp` with `Bearer lore_pat_…` → token resolved to a user → tool calls the same service function as REST → write tools require `confirm: true` and are audited in `agent_action_audit`.

## 4. Tech stack and conventions

Use exactly these libraries; an agent that wants to add a dependency outside this list writes the reason in `docs/HANDOFF.md` first. Pin major versions; let the package manager pick the latest minor.

| Layer | Library / tool | Notes |
| --- | --- | --- |
| Runtime | Node 22 LTS, pnpm 9, Turborepo 2, TypeScript 5 (strict) | `"type": "module"` everywhere; path alias `@lore/*` for packages |
| Web framework | Next.js 15 (App Router, React 19), Turbopack dev | `next.config.ts` rewrites `/api/*` and `/socket.io/*` to the api in dev; Caddy does it in prod, so the browser is always same-origin |
| Styling | Tailwind CSS v4, shadcn/ui (Radix), `class-variance-authority`, `tailwind-merge`, `lucide-react` icons | Tokens from `packages/tokens` as CSS variables; no other UI kit |
| Motion | `motion` (Framer Motion v12) | Card reveals, reaction bursts, story progress, game result reveal; honor `prefers-reduced-motion` |
| Client state | TanStack Query v5 (server state), Zustand (UI state), `socket.io-client` | Socket events call `queryClient.setQueryData` with typed reducers in `features/*/realtime.ts` |
| Forms and validation | `react-hook-form` + `zod` (schemas imported from `@lore/shared`) | Same zod schema validates client form, REST body, and MCP tool input |
| PWA | `@serwist/next` | Standalone install, offline shell, web push. Also approved: `vaul` (sheets), `@use-gesture/react` (edge-swipe back, swipe-down dismiss, pull to refresh, pinch zoom), `web-push` (server), `pwa-asset-generator` (icons, iOS splash screens) |
| Media in browser | `browser-image-compression`, MediaRecorder (Opus), AudioWorklet (PCM16 24 kHz for live captions), `react-easy-crop`, `embla-carousel-react` | Video upload capped at 60 s / 50 MB |
| Drawing (Pictionary) | `perfect-freehand` on a `<canvas>` | Strokes sent as point arrays, not images |
| API server | Fastify 5, `@fastify/cors`, `@fastify/rate-limit`, `@fastify/multipart`, `fastify-type-provider-zod` | Every route declares zod `body`/`params`/`response` |
| Realtime | Socket.IO 4 + `@socket.io/redis-adapter` | Auth via session cookie on handshake; rooms `user:{id}`, `conv:{id}`, `game:{id}`, `station:{id}` |
| Jobs | BullMQ 5 on Valkey 8 | One queue per module; repeatable `persona.tick` every 120 s |
| Database | Tiger Cloud (Postgres 17 + TimescaleDB + pgvector + pgvectorscale), Drizzle ORM + `drizzle-kit`, `postgres` (postgres.js) driver | Each computer uses its own free Tiger service during the build; one shared service for prod |
| Auth | Better Auth (Drizzle adapter), email+password and Facebook social provider | Cookie session on `.ourlore.tech`; personal access tokens (PATs) for MCP stored hashed |
| Object storage | `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` against Vultr Object Storage | Bucket `lore-media`, private; reads via 1-hour signed GET URLs |
| Media processing | `sharp` (thumbnails, collages), `ffmpeg` (static binary in the api image) via `execa` | Collage renderer composes up to 9 photos into 1080x1350 and 1080x1920 layouts |
| AI | `openai` SDK pointed at `https://api.meta.ai/v1` for Muse Spark and Muse Image; `ws` for Muse realtime voice; `fetch` multipart for batch voice; `@google/genai` for Gemini; `serpapi` npm | All wrapped in `packages/ai`; nothing else imports these SDKs directly |
| MCP | `@modelcontextprotocol/sdk` (TypeScript), `StreamableHTTPServerTransport` | Stateless mode, JSON responses enabled |
| Snowflake | Snowflake SQL API v2 (`POST /api/v2/statements`) and Cortex REST via `fetch` with a programmatic access token | No driver needed |
| Solana (P2) | `@solana/web3.js` 1.x, `@metaplex-foundation/umi`, `@metaplex-foundation/mpl-core` | Devnet only; server-held vault keypair |
| Logging and errors | `pino` (Fastify default), request ids, one `AppError` class with codes | Errors return `{ error: { code, message } }` |
| Testing | Vitest (unit), Playwright (two-context end-to-end), `@testing-library/react` sparingly | Section 16 lists required tests |
| Lint and format | Biome (lint + format, one config at root) | Pre-commit with `lefthook`: Biome + typecheck of changed packages |

### Conventions every agent follows

- **IDs:** UUIDv7 everywhere (`uuidv7` package), generated in the app, so messages sort by time and hypertables can partition cleanly.
- **Time:** store `timestamptz` in UTC; render in the viewer's zone; plan times carry an explicit IANA zone (`America/Chicago` for the demo).
- **API shape:** REST under `/v1`, JSON, cursor pagination `?cursor=&limit=` returning `{ items, nextCursor }`. Mutations accept `Idempotency-Key`; duplicate keys return the first result.
- **Realtime shape:** server emits only; clients mutate through REST. Every event payload is `{ type, at, data }` and is defined in `@lore/shared/events.ts`.
- **AI output:** every model call that feeds logic uses JSON-schema structured output validated by zod; on validation failure retry once with the error appended, then fall back to the mock fixture and mark the result `degraded: true`.
- **AI labeling:** every AI-authored message, image, or card carries `ai_generated = true` and renders the AI label; generated images also carry `generator = 'muse-image-1.0'`.
- **Feature flags:** `FEATURE_*` env vars (section 14) gate P1/P2 features so an unfinished feature can ship dark.
- **Commits:** Conventional Commits with the owner prefix, e.g. `feat(c2-plans): fair ranking`, small and frequent, pushed at least every 45 minutes.

## 5. Data model on Tiger Data

The schema lives in `packages/db/src/schema/` as one Drizzle file per domain; each file has exactly one owner, so the two branches never edit the same schema file. TimescaleDB and vector setup that Drizzle cannot express lives in `packages/db/sql/*.sql` and runs after every push with `pnpm db:setup`.

Rules: all ids are `uuid` (v7, app-generated); all times `timestamptz`; no foreign keys **into** hypertables (reference them by id only); soft deletes via `deleted_at`; every table has `created_at default now()`. During the build each computer runs `drizzle-kit push` against its own free Tiger service; one baseline migration is generated at the final merge (section 13).

### Tables by file and owner

```text
# social.ts  [C1]
user, session, account, verification        Better Auth tables (generate with its CLI)
social_accounts(id, type: personal|group, handle UNIQUE citext, display_name, bio,
  avatar_media_id, visibility: public|private, owner_user_id NULL, conversation_id NULL,
  primary_admin_user_id NULL, created_at)
follows(follower_account_id, target_account_id, status: active|pending, created_at) PK(pair)
media_assets(id, owner_user_id, kind: image|video|audio|generated_image|render, storage_key,
  mime, width, height, duration_ms, blurhash, ai_generated bool, generator NULL,
  transcript NULL, transcript_status: none|pending|done|failed, caption_ai NULL,
  consent_scope jsonb, created_at)
posts(id, author_account_id, created_by_user_id, kind: photo|carousel|reel, caption, alt_text,
  visibility, location_label, source_kind: manual|recap|game|family|plan, source_id,
  like_count, comment_count, published_at, search_tsv tsvector)
post_media(post_id, media_id, sort_order) PK(post_id, media_id)
stories(id, author_account_id, media_id, caption, created_at, expires_at)
story_views(story_id, viewer_user_id, viewed_at) PK(pair)
comments(id, post_id, author_account_id, body, created_at)
engagement_events  HYPERTABLE(at)  (at, actor_user_id, target_type, target_id,
  kind: like|unlike|save|share|view_3s, topic_tags text[])
notifications(id, user_id, kind, payload jsonb, read_at, created_at)
facebook_imports(user_id PK, fb_user_id, granted_scopes text[], likes jsonb,
  friend_fb_ids text[], imported_at)
keepsakes(id, recap_id, conversation_id, mint_address, tx_signature, network, metadata jsonb)

# chat.ts  [C1]
conversations(id, kind: dm|group, title, avatar_media_id, created_by_user_id,
  group_account_id NULL, created_at)
conversation_members(conversation_id, user_id, role: primary_admin|admin|publisher|member,
  mute_scope NULL, mute_until NULL, ai_history_consent bool default true,
  last_read_at, joined_at) PK(pair)
messages  HYPERTABLE(created_at, 7-day chunks)  PK(id, created_at)
  (id, conversation_id, created_at, sender_type: human|ai|system, sender_user_id NULL,
   persona_id NULL, kind: text|media|voice|card|system, body, media_ids uuid[],
   card_kind NULL, card_ref_id NULL, reply_to_id NULL, ai_generated bool,
   meta jsonb, edited_at, deleted_at)
  INDEX(conversation_id, created_at DESC)
message_reactions(message_id, user_id, emoji, created_at) PK(message_id, user_id, emoji)

# groups.ts  [C1]
publishing_policies(account_id PK, mode: direct|threshold|unanimous|courtesy,
  threshold int NULL, eligible_roles text[], story_mode NULL, updated_by, updated_at)
post_drafts(id, account_id, conversation_id, created_by_user_id NULL, created_by_ai bool,
  kind, caption, media_ids uuid[], audio_label, version int, content_hash,
  state: editing|submitted|changes_requested|approved|published|rejected|cancelled,
  policy_snapshot jsonb {mode, threshold, eligibleVoterIds[]}, source_kind, source_id,
  published_post_id NULL, updated_at)
approvals(draft_id, version, user_id, decision: approve|request_changes, note, decided_at)
  PK(draft_id, version, user_id)
audit_log(id, at, actor_type: user|ai|agent|system, actor_id, action, target_type,
  target_id, meta jsonb)

# games.ts  [C1]
game_sessions(id, conversation_id, mode: pictionary|meme_battle|one_word_story,
  state: lobby|active_round|round_results|completed|abandoned, config jsonb
  {rounds, timerSec, contextSource: lore|random|hybrid, teams, allowSelfVote, maxWords},
  current_round, host_user_id, result jsonb, result_media_id, created_at)
game_participants(session_id, user_id, team NULL, score int, ready bool) PK(pair)
game_turns(id, session_id, round, active_user_id, prompt jsonb, choices text[],
  answer, completed_at)
meme_entries(id, session_id, round, creator_type: human|ai, creator_user_id NULL,
  image_media_id, caption, anon_slot int)
meme_votes(session_id, round, voter_user_id, entry_id) PK(session_id, round, voter_user_id)

# persona.ts  [C2]
ai_personas(id, conversation_id UNIQUE, name, avatar_media_id, tone text[], interests text[],
  boundaries, initiative: quiet|balanced|lively, quiet_hours jsonb {start,end,tz},
  allow_history, allow_news, allow_images, allow_plans, allow_location bool,
  surprise_images_per_week int default 1, enabled bool, created_by_user_id)
ai_memories(id, conversation_id, kind: joke|preference|event|place|nickname|fact,
  summary, source_message_ids uuid[], subject_user_ids uuid[],
  sensitivity: low|medium|high, confidence real, last_confirmed_at, expires_at,
  embedding vector(768), deleted_at)
ai_decisions  HYPERTABLE(at)  (at, conversation_id, trigger: message|tick|event|request,
  speak bool, intent, score real, reason, model, latency_ms, input_tokens, output_tokens)

# plans.ts  [C2]
group_preferences(id, conversation_id, user_id, proposal_id NULL,
  key: budget_max|region|travel_minutes|time_windows|likes|dislikes|dietary|accessibility,
  value jsonb, source: stated|onboarding|graph|inferred, visibility: group|ai_only, expires_at)
recommendation_triggers(id, conversation_id, kind, source_message_ids uuid[], confidence,
  cooldown_until)
candidates(id, source: serp_events|serp_maps|serp_kg|serp_news|seed,
  category: place|event|movie|show|book|at_home|online, name, url, image_url, address,
  starts_at NULL, price_text, rating NULL, raw jsonb, last_verified_at,
  dedupe_key UNIQUE, embedding vector(768))
plan_proposals(id, conversation_id, trigger_id NULL, message_id, brief jsonb,
  options jsonb, version int, status: suggested|voting|revised|selected|confirmed|
  completed|dismissed, decorative_media_id NULL, created_by: ai|user, created_by_user_id)
plan_votes(proposal_id, version, user_id, candidate_id, response: yes|flexible|no|veto,
  voted_at) PK(proposal_id, version, user_id, candidate_id)
group_plans(id, proposal_id, conversation_id, candidate_id, title, starts_at, tz,
  region_label, confirmed_by_user_id, state: confirmed|completed|cancelled, recap_id NULL)
plan_rsvps(plan_id, user_id, status: going|maybe|no) PK(pair)

# memories.ts  [C2]
event_candidates(id, conversation_id, title, kind: birthday|outing|trip|game_night|other,
  starts_at, ends_at, confidence, source_message_ids uuid[], plan_id NULL,
  state: tentative|confirmed|dismissed)
recaps(id, conversation_id, event_id NULL, plan_id NULL, title, caption,
  layout: grid|collage|carousel|story, media_ids uuid[], cover_media_id NULL,
  collage_media_id NULL, music_label NULL,
  state: candidate|generating|ready_private|edited|proposed|saved, created_by_ai bool)
recap_media_consents(recap_id, media_id, owner_user_id, include bool) PK(recap_id, media_id)

# family.ts  [C2]
family_stories(id, conversation_id, title, period_label, chapters jsonb, cover_media_id,
  state: source_selection|private_draft|contributor_review|approved|shared_private,
  flags jsonb, created_at)
family_story_contributions(story_id, contributor_user_id, source_message_id,
  include bool, correction NULL) PK(story_id, source_message_id)

# podcast.ts  [C2]
podcast_shows(id, conversation_id, title, required_participant_ids uuid[],
  state: collecting|eligible_to_finish|rendering|finished, host_user_id, wrapped_at NULL,
  render_media_id NULL)
podcast_stations(id, show_id, parent_station_id NULL, topic, participant_ids uuid[],
  state: open|wrapped)
voice_contributions(id, station_id, user_id, media_id, reply_to_id NULL,
  duration_ms, day date, transcript, created_at) UNIQUE(station_id, user_id, day)

# discovery.ts  [C2]
interest_profiles(user_id PK, explicit_tags text[], inferred jsonb {tag: weight},
  frozen bool, discoverable bool default false, bio_snippet, embedding vector(768),
  updated_at)
quiz_answers(user_id, question_id, answer jsonb) PK(pair)
introductions(id, from_user_id, to_user_id, basis jsonb {sharedTags[], reason},
  first_message, state: requested|accepted|declined|expired, created_at)

# integrations.ts  [C2]
personal_access_tokens(id, user_id, name, token_hash, scopes text[], last_used_at,
  revoked_at, created_at)
agent_action_audit(id, at, user_id, tool, input jsonb, outcome: ok|denied|error, detail)
analytics_events  HYPERTABLE(at)  (at, kind, group_hash, actor_hash, props jsonb)
sync_cursors(name PK, last_at)
```

### Timescale, vector, and search setup (`packages/db/sql/`)

```sql
-- 001_extensions.sql
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS vectorscale CASCADE;   -- pulls in pgvector
CREATE EXTENSION IF NOT EXISTS citext;

-- 002_hypertables.sql  (idempotent: if_not_exists => true)
SELECT create_hypertable('messages', by_range('created_at', INTERVAL '7 days'), if_not_exists => true);
SELECT create_hypertable('engagement_events', by_range('at', INTERVAL '1 day'), if_not_exists => true);
SELECT create_hypertable('ai_decisions', by_range('at', INTERVAL '1 day'), if_not_exists => true);
SELECT create_hypertable('analytics_events', by_range('at', INTERVAL '1 day'), if_not_exists => true);
ALTER TABLE messages SET (timescaledb.compress, timescaledb.compress_segmentby = 'conversation_id');
SELECT add_compression_policy('messages', INTERVAL '30 days', if_not_exists => true);

-- 003_aggregates.sql : drives Milo's proactivity and the impact page
CREATE MATERIALIZED VIEW IF NOT EXISTS conv_activity_5m
WITH (timescaledb.continuous, timescaledb.materialized_only = false) AS
SELECT time_bucket('5 minutes', created_at) AS bucket, conversation_id,
       count(*) FILTER (WHERE sender_type = 'human') AS human_msgs,
       count(*) FILTER (WHERE sender_type = 'ai')    AS ai_msgs,
       count(DISTINCT sender_user_id)                AS speakers,
       max(created_at)                                AS last_at
FROM messages GROUP BY 1, 2 WITH NO DATA;
SELECT add_continuous_aggregate_policy('conv_activity_5m',
  start_offset => INTERVAL '2 days', end_offset => INTERVAL '1 minute',
  schedule_interval => INTERVAL '1 minute', if_not_exists => true);

CREATE MATERIALIZED VIEW IF NOT EXISTS engagement_topics_1d
WITH (timescaledb.continuous, timescaledb.materialized_only = false) AS
SELECT time_bucket('1 day', at) AS bucket, actor_user_id, unnest(topic_tags) AS tag,
       count(*) FILTER (WHERE kind IN ('like','save','share','view_3s')) AS signals
FROM engagement_events GROUP BY 1, 2, 3 WITH NO DATA;

-- 004_vectors.sql  (DiskANN, cosine)
CREATE INDEX IF NOT EXISTS ai_memories_emb ON ai_memories USING diskann (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS interest_profiles_emb ON interest_profiles USING diskann (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS candidates_emb ON candidates USING diskann (embedding vector_cosine_ops);

-- 005_search.sql : Explore. Prefer BM25 if pg_textsearch is available on the service;
-- otherwise this tsvector + GIN fallback is the shipped path.
CREATE INDEX IF NOT EXISTS posts_search ON posts USING gin (search_tsv);
```

If the continuous aggregate over `unnest()` is rejected by your TimescaleDB version, make `engagement_topics_1d` a plain view refreshed by a job; nothing else depends on it being continuous.

### Read patterns the agents should index for

| Query | Index / mechanism |
| --- | --- |
| Chat page: last 50 messages of a conversation | `messages(conversation_id, created_at DESC)` |
| Inbox: conversations with last message and unread count | lateral join on the messages index, `conversation_members.last_read_at` |
| Home feed: posts from followed accounts, newest first | `posts(author_account_id, published_at DESC)` + `follows(follower_account_id)` |
| Milo silence and hot-thread checks | `conv_activity_5m` last 12 buckets for the conversation |
| Memory recall for a reply | `ai_memories` DiskANN top 6 filtered by `conversation_id`, `deleted_at IS NULL` |
| Find Friends | `interest_profiles` DiskANN top 30 where `discoverable`, re-ranked in code |
| Plan candidate dedupe | `candidates.dedupe_key` = lowercased name + date + source |

## 6. Shared contracts

`packages/shared` is written in full by Computer 1 during the scaffold (task C1-0) from this section, before either branch writes feature code. After that, contracts change only through the contract protocol at the end of this section, which is what keeps two agents building against the same interfaces.

### Files in `packages/shared/src`

| File | Contents |
| --- | --- |
| `ids.ts` | `uuidv7()` re-export, branded id types (`UserId`, `ConversationId`, …) |
| `enums.ts` | Every enum in section 5 as `as const` arrays + zod enums |
| `dto/*.ts` | Zod schemas for request bodies and responses, one file per module name |
| `events.ts` | Socket event names and zod payloads (table below) |
| `cards.ts` | Card kinds that can appear inside a chat message, and their payload schemas |
| `ai.ts` | Structured-output schemas shared by api and web (`SpeakDecision`, `GroupIntentBrief`, `PlanRanking`, `RecapDraftSpec`, `FiveWordChoices`, `FamilyStorySpec`, `CommonGroundReason`) |
| `policy.ts` | Pure functions `mayPublish()` and `canFinishPodcast()` used by api, MCP, and UI (UI uses them only to grey out buttons) |
| `flags.ts` | Feature flag names |

### REST surface (`/v1`, all JSON)

```text
# C1
POST   /auth/*                                  Better Auth handler (email, facebook)
GET    /me                                      current user + personal account + group accounts I can act as
PATCH  /me/profile
GET    /accounts/:handle                        profile header + counts
GET    /accounts/:id/posts?tab=posts|reels
POST   /accounts/:id/follow   DELETE same
GET    /feed?cursor=                           home feed (posts from follows + own + group accounts I'm in)
GET    /reels?cursor=
GET    /stories/rail                            active stories grouped by author account
POST   /stories                                 { authorAccountId, mediaId, caption }  (group: goes through policy)
POST   /stories/:id/view
POST   /posts                                   personal publish OR group draft (server decides by policy)
POST   /posts/:id/like  DELETE same   POST /posts/:id/save   POST /posts/:id/comments
GET    /explore?q=&cursor=                      grid + account/group results
POST   /media/presign                           { kind, mime, bytes } -> { mediaId, uploadUrl, headers }
POST   /media/:id/complete                      server reads object, makes thumb/blurhash, queues transcribe if audio
GET    /conversations                           inbox
POST   /conversations                           { kind, memberUserIds[], title? }
GET    /conversations/:id                       header, members, persona summary, group account link
GET    /conversations/:id/messages?before=
POST   /conversations/:id/messages              { clientId, kind, body?, mediaIds?, replyToId? }
POST   /conversations/:id/read
POST   /conversations/:id/members   DELETE /conversations/:id/members/:userId   PATCH .../mute
POST   /conversations/:id/group-account         { handle, displayName, bio, avatarMediaId, visibility, policy }
GET    /accounts/:id/policy   PUT /accounts/:id/policy
POST   /drafts                                  { accountId, conversationId, kind, caption, mediaIds, source? }
PATCH  /drafts/:id                              edits bump version, clear approvals
POST   /drafts/:id/submit   POST /drafts/:id/approvals { decision, note? }   POST /drafts/:id/publish
POST   /games                                   { conversationId, mode, config }
POST   /games/:id/join   POST /games/:id/start   POST /games/:id/actions { type, payload }
GET    /games/:id                               state filtered for the caller (private prompts hidden)
POST   /graph/import                            pull likes/friends after Facebook login (consent screen first)
GET    /notifications   POST /notifications/read

# C2
GET    /conversations/:id/persona   PUT same    POST /conversations/:id/persona/test   (preview reply)
GET    /conversations/:id/memories  DELETE /memories/:id   PATCH /memories/:id
POST   /conversations/:id/plans/suggest         { request?: string }  -> 202, card arrives by socket
POST   /conversations/:id/preferences           { proposalId?, key, value, visibility }
POST   /plans/:proposalId/votes                 { candidateId, response }
POST   /plans/:proposalId/refine                { instruction }
POST   /plans/:proposalId/confirm               { candidateId, startsAt, tz }  (human only)
POST   /plans/:proposalId/dismiss
GET    /conversations/:id/plans                 Plans tab
GET    /conversations/:id/recaps   POST /conversations/:id/recaps { eventId? planId? mediaIds? }
PATCH  /recaps/:id   POST /recaps/:id/consents   POST /recaps/:id/propose-post  -> creates draft via C1 service
POST   /conversations/:id/family-stories         { from, to } ; PATCH /family-stories/:id ; POST .../review ; POST .../share
POST   /podcast/shows   GET /podcast/shows/:id   POST /podcast/stations/:id/voices { mediaId, replyToId? }
POST   /podcast/stations/:id/branch { topic }    POST /podcast/shows/:id/wrap    GET /podcast/shows/:id/status
POST   /podcast/shows/:id/finish                 rejects 409 unless canFinishPodcast()
GET    /discovery/quiz   POST /discovery/quiz   GET /discovery/profile   PATCH /discovery/profile
GET    /discovery/matches                       Common Ground cards
POST   /discovery/introductions   POST /discovery/introductions/:id/accept|decline
POST   /voice/transcribe                         { mediaId } (sync for <= 30 s clips)
WS     /v1/voice/live                            browser PCM16 24 kHz -> Meta realtime proxy
GET    /tokens   POST /tokens { name }  DELETE /tokens/:id     personal access tokens for Muse
GET    /impact/summary                          aggregates for /impact
POST   /mcp  (on mcp.ourlore.tech)              MCP streamable HTTP endpoint
```

Cross-owner calls happen in code, not HTTP: C2's `memories.service.proposePost()` imports C1's `groups.service.createDraft()`. The function signatures that cross the boundary are frozen in scaffold as typed stubs that throw `NotImplemented`, so each side can code against them on day one.

| Cross-boundary function | Implemented by | Called by |
| --- | --- | --- |
| `chat.service.postMessage(convId, input, actor)` | C1 | C2 (Milo, plan cards, recap cards) |
| `chat.service.updateMessage(id, patch)` | C1 | C2 (transcripts, card refresh) |
| `groups.service.createDraft(input, actor)` | C1 | C2 (recaps, family stories, game results) |
| `media.service.createFromBuffer(buf, meta)` | C1 | C2 (Muse Image outputs, collages, renders) |
| `media.service.signedUrl(mediaId)` | C1 | C2 |
| `voice.service.transcribeMedia(mediaId)` | C2 | C1 (voice notes in chat) |
| `persona.service.onMessage(msg)` | C2 | C1 (after every human message insert) |
| `ai.games.*` in `packages/ai` | C2 | C1 (game prompts, five-word choices, meme captions, judging help) |
| `discovery.service.recordSignal(userId, tags, kind)` | C2 | C1 (likes, saves, follows) |

### Realtime events (server → client)

| Event | Room | Payload (data) | Emitted by |
| --- | --- | --- | --- |
| `message.created` | `conv:{id}` | full `MessageDTO` | C1 |
| `message.updated` | `conv:{id}` | `{ id, patch }` (transcript, card refresh, edit) | C1 |
| `typing` / `ai.typing` | `conv:{id}` | `{ userId or personaId, on }` | C1 / C2 |
| `conversation.updated` | `user:{id}` | inbox row | C1 |
| `draft.updated` | `conv:{id}` | `DraftCardDTO` (state, version, approvals) | C1 |
| `post.published` | `user:{id}` of members | `{ postId, accountId }` | C1 |
| `game.state` | `game:{id}` | caller-filtered `GameStateDTO` | C1 |
| `game.stroke` | `game:{id}` | `{ points, color, size }` (not persisted) | C1 |
| `plan.updated` | `conv:{id}` | `PlanCardDTO` (options, votes tally, status, version) | C2 |
| `recap.updated` | `conv:{id}` | `RecapCardDTO` | C2 |
| `family_story.updated` | `conv:{id}` | `FamilyStoryCardDTO` | C2 |
| `podcast.updated` | `station:{id}` | `{ contributions, engaged, finishEnabled, missing[] }` | C2 |
| `notification.created` | `user:{id}` | `NotificationDTO` | C1 |
| `intro.updated` | `user:{id}` | `IntroductionDTO` | C2 |

### Chat card kinds (`message.kind = 'card'`)

Cards render through a registry in `apps/web/src/features/chat/cards/registry.tsx` that the scaffold creates with every entry already pointing at a stub component in the owner's feature folder. Owners replace their stub file's contents; nobody edits the registry after scaffold.

| `card_kind` | Component file | Owner |
| --- | --- | --- |
| `draft_card` | `features/groups/cards/DraftCard.tsx` | C1 |
| `game_invite` / `game_result` | `features/games/cards/GameInviteCard.tsx`, `GameResultCard.tsx` | C1 |
| `post_share` | `features/feed/cards/PostShareCard.tsx` | C1 |
| `plan_card` / `plan_confirmed` | `features/plans/cards/PlanCard.tsx`, `PlanConfirmedCard.tsx` | C2 |
| `recap_card` | `features/memories/cards/RecapCard.tsx` | C2 |
| `family_story_card` | `features/family/cards/FamilyStoryCard.tsx` | C2 |
| `podcast_invite` | `features/podcast/cards/PodcastInviteCard.tsx` | C2 |
| `ai_image` | `features/persona/cards/AiImageCard.tsx` | C2 |
| `intro_card` | `features/discovery/cards/IntroCard.tsx` | C2 |

The same registry pattern applies to two other shared surfaces: the chat toolbar actions (`features/chat/toolbar/registry.ts`: Media, Voice, Games \[C1\]; Plans, Memories, AI \[C2\]) and the Group Space tabs (`features/groups/space/tabs.ts`: Chat, Games, Group Page \[C1\]; Plans, Memories \[C2\]).

### Contract protocol (how a contract changes mid-build)

1. Only **additive** changes are allowed after scaffold: new optional fields, new events, new card kinds, new DTO files. Renames and removals wait for a merge checkpoint.
2. The agent adds the change to `packages/shared` on its own branch **and** appends a line to `docs/CONTRACTS.md` under its computer's heading: date, file, change, reason.
3. Additive edits to the same shared file from both branches merge cleanly in most cases; when they conflict, the merge agent keeps both sides (section 13 rule M3).
4. Each person tells the other in chat when they add a contract, so the other agent can use it after the next checkpoint merge.

## 7. AI system design

Every model call goes through `packages/ai`, returns zod-validated structured output, and is logged to `ai_decisions` or `audit_log`. Milo is one persona with several skills (talk, recall, plan, recap, play), not five chatbots, which is what makes the AI feel essential rather than bolted on.

### `packages/ai` layout (owned by C2, built first, mock mode on day one)

```text
packages/ai/src/
  clients/muse.ts         OpenAI SDK, baseURL https://api.meta.ai/v1, key META_API_KEY
  clients/museImage.ts    images.generate / images.edit, model muse-image-1.0, b64_json -> Buffer
  clients/museVoice.ts    batch transcribe (multipart) + realtime session factory (ws)
  clients/gemini.ts       embed(texts, 768) via gemini-embedding-001; classify(text) guard
  clients/serp.ts         events(), places(), mediaLookup(), news(); 6 h cache in Valkey
  structured.ts           callStructured(schema, messages, opts): json_schema output, 1 repair retry, mock fallback
  prompts/                persona.ts concierge.ts recap.ts games.ts family.ts discovery.ts imageStyle.ts
  mocks/                  one JSON fixture per schema + 6 pre-rendered images + 2 WAV transcripts
  budget.ts               per-conversation and global token/image budgets (Valkey counters)
  index.ts                the only exports other packages may import
```

At kickoff run `GET https://api.meta.ai/v1/models` once and set `MUSE_TEXT_MODEL` from the result; `muse-spark-1.1` is the documented id, but use a newer one if listed. Use Chat Completions for everything (it supports tools, structured output, and images); use the Responses API only if Muse Image multi-turn editing is needed for the recap cover.

### Model call matrix

| Task | Model | `reasoning_effort` | Output schema | Timeout | Called from |
| --- | --- | --- | --- | --- | --- |
| Milo speak/skip decision + reply + memory extraction | Muse Spark | minimal | `SpeakDecision` | 8 s | worker `persona.consider`, `persona.tick` |
| Group intent brief | Muse Spark | low | `GroupIntentBrief` | 10 s | worker `plans.suggest` |
| Fair ranking of real candidates | Muse Spark | medium | `PlanRanking` | 15 s | worker `plans.suggest`, `plans.refine` |
| Photo understanding for recaps | Muse Spark (image input) | minimal | `PhotoNotes[]` | 12 s | worker `memories.describe` |
| Recap title, caption, order, cover prompt | Muse Spark | low | `RecapDraftSpec` | 12 s | worker `memories.compose` |
| Event detection from chat | Muse Spark | minimal | part of `SpeakDecision.events[]` | — | same call as Milo |
| Five-word choices per story turn | Muse Spark | minimal | `FiveWordChoices` | 4 s | api (sync, prefetched) |
| Pictionary prompts, meme prompts, AI meme entry | Muse Spark | minimal | `GamePrompt`, `MemeEntrySpec` | 6 s | api (prefetched at lobby) |
| Family story chapters | Muse Spark | medium | `FamilyStorySpec` | 20 s | worker `family.compose` |
| Common Ground reason + starter | Muse Spark | minimal | `CommonGroundReason` | 6 s | api, cached per pair 24 h |
| Covers, story ending art, meme images, surprise image, B-roll | Muse Image | — | image bytes | 30 s | worker `image.generate` |
| Voice note / clip transcript | Muse Voice Transcribe (batch) | — | transcript | 20 s | worker `voice.transcribe` |
| Live captions while recording | Muse Voice Transcribe (realtime) | — | partials | stream | api WS proxy |
| Embeddings (memories, interests, candidates) | Gemini `gemini-embedding-001` @768 | — | float\[768\] | 5 s | worker `embed` |
| Safety guard on AI output and lore prompts | Gemini Flash (fast tier) | — | `GuardVerdict` | 3 s, parallel | `packages/ai/guard.ts` |

### Milo: context assembly

For each `persona.consider` run the worker builds one prompt from five blocks, in this order (stable prefix first so prompt caching helps):

1. **Persona block** (stable): name, tone, interests, boundaries, initiative level, permissions, house rules below.
2. **Group block** (stable per hour): member list with display names and user ids, each member's opted-in preferences, active plans, upcoming events.
3. **Memory block**: top 6 `ai_memories` by cosine similarity to the last 5 messages, each with its id.
4. **Activity block**: from `conv_activity_5m`: minutes since last human message, messages in the last hour, AI messages in the last hour, AI budget left today.
5. **Transcript block**: last 40 messages as `[time] Name (user|ai): text`, with photo captions inlined as `[photo: caption_ai]` and voice notes as `[voice: transcript]`. Messages from members with `ai_history_consent = false` are replaced with `[message hidden from AI]`.

House rules included in every persona prompt (verbatim):

```text
You are {name}, an AI member of this group chat. Everyone knows you are an AI; never claim to be human.
You help these people do more together. People lead; you suggest.
Speak only when it adds something: a genuinely funny or kind line, a relevant memory, a useful idea, or an answer to someone.
Often the right choice is silence. If humans are mid-conversation with each other, stay quiet unless asked.
Never invent facts, news, events, prices, or places. Only mention news or venues that appear in CANDIDATES with an id.
Only reference memories that appear in MEMORIES, and cite their ids in memoryIdsUsed.
Never reveal one member's private preference to the group; say "some of you" instead.
No sensitive guesses about health, money, religion, politics, or relationships. If the conversation is serious or someone is upset, be brief and supportive or stay silent.
Keep messages under 280 characters, casual, lowercase is fine if the group writes that way. No hashtags. At most one emoji.
Return JSON matching the SpeakDecision schema and nothing else.
```

### Structured output schemas (in `packages/shared/src/ai.ts`)

```ts
SpeakDecision = {
  speak: boolean,
  intent: 'reply'|'joke'|'recall'|'plan'|'news'|'recap_offer'|'image_surprise'|'support'|'none',
  score: number,                 // 0..1 model's own benefit estimate
  reason: string,                // <= 140 chars, logged, shown in "Why did Milo say this?"
  message?: string,              // <= 280 chars
  memoryIdsUsed: string[],
  candidateId?: string,          // required when intent = 'news'
  planRequest?: { categories: Category[], whenText?: string },
  imagePrompt?: string,          // only when intent = 'image_surprise'
  newMemories: { kind: MemoryKind, summary: string, subjectUserIds: string[], sensitivity: 'low'|'medium'|'high' }[],
  events: { title: string, kind: EventKind, whenText: string, startsAt?: string, confidence: number, sourceMessageIds: string[] }[]
}
GroupIntentBrief = {
  goal: string, whenText: string, startsAt?: string, endsAt?: string,
  mode: 'in_person'|'remote'|'either', categories: Category[],
  hardConstraints: { userId?: string, key: PrefKey, value: unknown }[],
  softPreferences: { userId: string, likes: string[], dislikes: string[] }[],
  unknowns: { key: PrefKey, question: string }[],          // max 1 is asked
  searchQueries: { engine: 'events'|'maps'|'media'|'news', q: string }[]   // max 4
}
PlanRanking = {
  options: { candidateId: string, headline: string, why: string,
    fitByMember: { userId: string, fit: 'great'|'ok'|'conflict', note: string }[],
    logistics: { priceText?: string, whenText?: string, travelText?: string } }[],   // 2..4
  compromiseNote?: string, noFeasibleOption: boolean, askToRelax?: string
}
PhotoNotes = { mediaId: string, caption: string, people: number, setting: string, mood: string, quality: number }
RecapDraftSpec = { title: string, caption: string, orderedMediaIds: string[], coverMediaId: string,
  layout: 'collage'|'carousel'|'story', coverPrompt: string, musicVibe: string,
  factsUsed: { claim: string, sourceMessageId: string }[] }
FiveWordChoices = { words: [string, string, string, string, string], loreTag?: string }
GamePrompt = { prompt: string, hint: string, source: 'lore'|'random', loreMemoryId?: string }
MemeEntrySpec = { caption: string, imagePrompt?: string }
FamilyStorySpec = { title: string, periodLabel: string,
  chapters: { heading: string, summary: string, items: { sourceMessageId: string, contributorUserId: string, text: string }[] }[],
  flags: { sourceMessageId: string, issue: 'date_unclear'|'unsupported_claim'|'sensitive' }[], coverPrompt: string }
CommonGroundReason = { sharedTags: string[], reason: string, starter: string, activityIdea?: string }
GuardVerdict = { allow: boolean, category: 'ok'|'harassment'|'sexual'|'self_harm'|'hate'|'private_info'|'humiliation', severity: 0|1|2|3 }
```

Server-side validation beyond zod (anti-hallucination): drop any `memoryIdsUsed`, `candidateId`, `sourceMessageId`, `mediaId`, or `userId` that was not in the input; if `intent = 'news'` without a valid `candidateId`, force `speak = false`; `FiveWordChoices` must be five distinct single words not already the last word in the story; `PlanRanking` options outside the candidate set are discarded and the card shows only real ones.

### Proactivity engine (Feature 1, the heart of "AI is essential")

Two stages so the model is called only when it could matter.

**Stage 1, deterministic pre-filter (no model call).** A message or tick becomes a candidate if any is true: the persona's name appears in the text; it replies to an AI message; it contains a question to the group; it matches plan/watch/meet/birthday/bored intent keywords; a photo or voice note was posted; a tick finds a conversation silent for at least `silenceHours` (3 h balanced) with an opportunity (an event within 48 h, an unconfirmed plan, a cached news item tagged with a group interest). In `lively` mode, 15% of other human messages are sampled too.

**Hard gates (stop, no model call):** persona disabled or muted; quiet hours in the group's zone; daily budget spent (quiet 3, balanced 8, lively 15); an AI message in the last 10 minutes unless the persona was named or replied to; a human message in the last 20 seconds (let people finish typing; the debounce re-queues).

**Stage 2, Muse Spark decides.** The model returns `SpeakDecision`. The server computes the final score and speaks only above the threshold for the initiative level (quiet 0.80, balanced 0.65, lively 0.50); named or replied-to messages use threshold 0.30.

```text
final = 0.45*model.score + 0.20*novelty + 0.20*receptivity + 0.15*timing - penalties
novelty     = 1 - max cosine similarity of message embedding vs last 20 AI messages
receptivity = share of the persona's last 10 messages that got a human reply or reaction within 10 min
timing      = 1.0 if silence >= silenceHours and intent in (plan, news, recap_offer); 0.5 normal; 0.2 if 3+ humans active in last 2 min
penalties   = 0.3 if guard severity >= 1; 0.2 if intent = image_surprise and weekly image budget used
```

After speaking: emit `ai.typing` for `1500 + 30 ms × characters` (capped at 6 s), insert the message, decrement the budget, embed and store `newMemories` (sensitivity `high` is discarded, never stored), upsert `events[]` into `event_candidates` when confidence ≥ 0.6, and log the decision. Every AI message has a "Why?" affordance that shows `reason` and the memory summaries used, which is the spec's explainability requirement.

**Rare surprise images:** allowed only when `allow_images`, weekly budget not used (default 1 per week), and the joke references a real memory. Milo posts the Muse Image result as an `ai_image` card labeled "AI image".

**Demo honesty switch:** `DEMO_FAST_PROACTIVE=1` shortens `silenceHours` to 60 seconds for the seeded Weekend Crew only; the UI shows a small "demo timing" chip on that message.

### Group Concierge pipeline (Feature 6)

1. **Trigger:** `SpeakDecision.intent = 'plan'`, or a member taps Plans → "Find something for us", or Muse calls `suggest_group_activities`.
2. **Brief:** Muse Spark writes `GroupIntentBrief` from the last 40 messages + stated preferences. If `unknowns` is non-empty and the unknown is a hard constraint (budget, region, date), Milo asks one compact question with quick-reply chips (`message.meta.quickReplies`), records answers into `group_preferences`, then continues.
3. **Retrieve real candidates (SerpAPI):** up to 4 queries from `searchQueries`: `google_events` with `q="events in Austin this weekend"` and `htichips=date:weekend`; `google_maps` with `type=search`, `ll` from the consented region centroid; `google` with the title to read the `knowledge_graph` for a movie/show/book (title, year, rating, where to watch); always add at least one `at_home` or `online` candidate (watch party, co-op game, shared book) so remote or low-budget members are never excluded. Normalize into `candidates`, dedupe, embed.
4. **Deterministic hard filter:** remove candidates over any member's `budget_max` (parse the lowest price; unknown price passes but is flagged "price unverified"), outside `travel_minutes` of the region centroid, or outside the time window.
5. **Fair ranking:** Muse Spark returns `PlanRanking`. The server then re-sorts by **maximin fit** (the option whose least-happy member is happiest wins ties), ensures category diversity (at most 2 of one category), and keeps 3 options.
6. **Card:** a `plan_card` message with 3 option tiles, each with source link, "verified 2 h ago" freshness, per-member fit dots (no private reasons shown), and buttons Vote / Not for me / Suggest alternative / Refine. A Muse Image decorative header is optional and labeled "illustration".
7. **Votes and refine:** each vote emits `plan.updated`. "Refine" sends a one-line instruction ("cheaper", "something indoors") → new version, previous votes marked stale.
8. **Confirm (human only):** any member can confirm a chosen option; the card becomes `plan_confirmed` with an Add-to-calendar `.ics` download and RSVP chips. Nothing is booked or sent outside LORE.
9. **After:** the plan creates an `event_candidate`; photos posted within the plan window are attached to it, and Milo offers a recap (Feature 2).

### Image style (`prompts/imageStyle.ts`)

```text
HOUSE STYLE: warm editorial illustration, soft paper grain, gentle risograph texture, limited palette of
coral, ink navy, cream and sage, friendly rounded shapes, generous negative space. No photorealistic faces of
real people. No logos, brands, or copyrighted characters. No text unless the prompt asks for a short title.
```

Recap covers use `images.edit` with up to 4 member photos as references only when every photo owner has `include = true`; otherwise `images.generate` from the text summary. Every generated asset is stored with `ai_generated = true` and shown with an "AI illustration" label.

### Voice (Muse Voice Transcribe)

- **Batch (authoritative):** ffmpeg `-ac 1 -ar 24000 -c:a pcm_s16le -map_metadata -1` → multipart `POST /v1/asr/transcribe?sessionId=<mediaId>` with `request={"mode":"PUSH_TO_TALK","model":"muse-voice-transcribe-1.0","audioEncoding":"WAV","keywords":[member names, persona name, "LORE"]}`. Store `transcript` on the media and the message.
- **Realtime (live captions):** browser AudioWorklet downsamples to 24 kHz PCM16 and sends 80 ms binary frames to our `/v1/voice/live` WebSocket; the api opens `wss://api.meta.ai/v1/asr/realtime?sessionId=…`, sends the handshake `{"authorization":{"accessToken":"Bearer <key>"},"audioEncoding":"PCM_24KHZ","model":"muse-voice-transcribe-1.0","mode":"PUSH_TO_TALK","partialMode":"CUMULATIVE","emitAudioProgress":false}`, waits for `{sessionId}`, then relays frames and relays `transcript` events back. On stop it sends `{"type":"endStream"}` and keeps reading until close code 1000. The key never reaches the browser.
- **Speaker identity** always comes from the authenticated uploader, never diarization, as the spec requires.

### Guardrails and degradation

- `guard.ts` runs the Gemini classifier in parallel with every outbound AI message, lore-based game prompt, meme caption, and family story; `allow = false` suppresses Milo silently or regenerates once for games.
- On 429 or 5xx from Meta: exponential backoff (0.5 s, 1 s, 2 s), then the mock fixture with `degraded: true` and a "degraded" chip in the UI. Core chat, feed, and posting never wait on AI.
- Budgets: 60 Muse Spark calls per conversation per hour, 40 images per hour globally, enforced in `budget.ts`.
- `AI_MODE=mock` returns fixtures instantly for development and tests; `AI_MODE=live` in production.

## 8. Feature implementation specs

Each feature below lists owner, tier, the build steps in order, and acceptance tests; an agent marks a feature done only when every acceptance line passes on the deployed site. Feature numbers match the LORE master spec (Features 1–6, Podcast) so the traceability table in the spec still applies.

### 8.1 Social core: accounts, feed, posts, stories, reels, explore, composer (C1 · P0, reels and explore P1)

1. **Accounts.** On signup create the user and a `social_accounts` row (`type = personal`, handle from email or Facebook name, deduped with a number). Onboarding: handle, display name, avatar (upload or Facebook picture), visibility, optional interests (stored by C2's `discovery.service`).
2. **Media upload.** `POST /media/presign` returns a 5-minute presigned PUT to Vultr Object Storage under `u/{userId}/{mediaId}.{ext}`; the browser compresses images to max 2048 px, JPEG/WebP 0.85; `POST /media/:id/complete` makes a 480 px thumbnail and blurhash with sharp, reads dimensions/duration, and queues transcription for audio.
3. **Posts.** Photo, carousel (up to 10), and reel (one video ≤ 60 s). Caption ≤ 2,200 chars, alt text per image, location label (free text, no GPS). `POST /posts` with a group `authorAccountId` is routed to `groups.service` (8.4) and returns a draft, never a post, unless policy allows direct publish.
4. **Home feed.** Stories rail on top; posts from followed accounts and group accounts the user belongs to, newest first, cursor-paged 10 at a time; optimistic like/save; double-tap like with heart burst. Group posts show the stacked-avatar badge and "Created from shared moments" when `source_kind` is recap.
5. **Stories.** 24 h expiry; full-screen viewer with progress bars, tap left/right, hold to pause, swipe down to close, private reply that opens a DM with the story attached. "Your story" composer accepts an image or a recap/game result. Group stories follow `publishing_policies.story_mode` (defaults to the post mode).
6. **Reels (P1).** Vertical snap-scroll, autoplay muted with tap to unmute, one video element mounted at a time (IntersectionObserver), like/comment/share/save rail.
7. **Explore (P1).** Search box (accounts, group accounts, posts by caption via `search_tsv`), 3-column grid of public posts ranked by recent engagement, and two entry tiles: **Find Friends** and **Discover Together** (C2 features).
8. **Profile.** Header (avatar, name, handle, bio, counts), Follow/Message buttons, tabs Posts / Reels, and a row of group accounts the user chose to show publicly. Group profiles use the same component plus a "Managed by 4 friends" chip and a Members sheet.

Acceptance: a new user signs up, posts a 3-photo carousel, and sees it on Home within 2 s; a second user follows them and sees it; a story disappears after its expiry (test with a 2-minute expiry flag); private accounts' posts are hidden from non-followers in feed, profile, and explore.

### 8.2 Messaging: inbox, DMs, group chats, voice notes (C1 · P0)

1. **Inbox** lists conversations ordered by last message, with avatars (stacked for groups), last-message preview ("Milo: …" for AI), unread badge, and pinned rows.
2. **Conversation view**: virtualized list (`@tanstack/react-virtual`), day separators, sender grouping, read receipts for DMs, typing indicators, reply-to, long-press reactions, image grids, and the card registry for rich cards. AI messages use the AI bubble style (section 9) with the persona avatar and an "AI" tag.
3. **Composer**: text, attach (photos/video), voice (hold to record, slide to cancel, max 60 s in chat), and the toolbar registry (Media · Voice · Games · Plans · Memories · AI).
4. **Send path**: optimistic message with `clientId`; server echo replaces it; failures show retry. After insert, `chat.service` calls `persona.service.onMessage(msg)` (C2) fire-and-forget.
5. **Voice notes**: upload the Opus file, post a `voice` message immediately with a waveform from the recorder, then `voice.service.transcribeMedia` fills the transcript; show "Transcribing…" then a collapsible transcript under the player. Live captions (C2 component `LiveCaption`) appear above the record button while recording.
6. **Group management**: Group Details sheet with members, roles, add/remove (admins), temporary mute with scope (chat, games, publishing) and duration, AI member panel (C2), link to the group account, and the Group Space tabs.

Acceptance: two browsers in the same group see each other's messages in under 500 ms; a dropped connection reconnects and backfills missed messages with no duplicates; a removed member gets 403 on the conversation and stops receiving events; a voice note shows its transcript under the right author.

### 8.3 Notifications (C1 · P1)

In-app on the Instagram-style Notifications screen (heart icon on Home): new follower, mention, draft needs your approval, post published to your group account, plan confirmed, introduction request, game invite. Each kind deep-links to its screen. Web push to installed apps (iOS 16.4+ and Android) uses VAPID keys and the `web-push` library; ask for permission only after the first meaningful action, never at launch.

### 8.4 Group accounts and approval workflow (Feature 4 · C1 · P0)

1. **Create** from Group Details → "Create group account": handle, name, bio, avatar, visibility, and the publishing policy. The conversation's creator becomes `primary_admin`; the group account row stores `conversation_id` and `primary_admin_user_id`. No second login: the account switcher in Create lists every group account where the user's role is in `eligible_roles`.
2. **Policies (all four from the source):** `direct` (eligible members publish immediately), `threshold` (N approvals), `unanimous` (every eligible voter), `courtesy` (direct allowed, but the author may choose "Send for courtesy review"). Policy editing is admin-only and logged.
3. **Drafts:** creating a draft freezes `policy_snapshot = { mode, threshold, eligibleVoterIds }` at submit time. Editing caption or media increments `version`, recomputes `content_hash`, and voids earlier approvals (they stay in the table under the old version). The draft card in chat shows preview, "2 of 3 approvals", voter avatars with check/empty states, Approve / Request changes / Discuss, and live updates.
4. **Publish** runs `mayPublish(draft, approvals, actor)` from `@lore/shared/policy.ts`, inside a transaction with `SELECT … FOR UPDATE` on the draft, so two simultaneous approvals cannot double-publish. Threshold and unanimous drafts auto-publish when the last needed approval lands; the audit log records who submitted and who approved, while the public sees only the group handle.
5. **AI drafts** (from recaps, game results, family stories) call the same `createDraft()` with `created_by_ai = true`, and are always `submitted`, never published directly, even under `direct` policy.

```ts
// packages/shared/src/policy.ts
export function mayPublish(d: DraftForPolicy, approvals: Approval[], actor: { userId: string; canDirect: boolean }) {
  const valid = new Set(approvals.filter(a => a.version === d.version && a.decision === 'approve'
    && d.policySnapshot.eligibleVoterIds.includes(a.userId)).map(a => a.userId));
  switch (d.policySnapshot.mode) {
    case 'direct': case 'courtesy': return !d.createdByAi && actor.canDirect;
    case 'threshold': return valid.size >= (d.policySnapshot.threshold ?? 1);
    case 'unanimous': return d.policySnapshot.eligibleVoterIds.every(id => valid.has(id));
  }
}
```

Acceptance: each of the four modes behaves as written (unit tests); editing after 2 approvals resets the count to 0; a removed member's approval no longer counts and they cannot publish; an AI-proposed recap under `direct` policy still requires an approval; the published group post appears in followers' feeds and on the group profile.

### 8.5 Games in DMs and group chats (Feature 5 · C1 builds game engine and UI; prompts come from C2's `packages/ai` · One-Word Story P0-stretch, Meme Battle P1, Pictionary P2)

**Shared engine.** Server-authoritative state machine per session in Valkey (`game:{id}` hash) mirrored to Postgres on every phase change; phases `lobby → active_round → round_results → completed`, plus `abandoned` after 10 minutes without actions. `GET /games/:id` and `game.state` events are filtered per caller (private prompts and anonymous authorship are never sent to the wrong client). Lobby settings: mode, rounds, timer, context source (Group lore / Random / Hybrid), teams, AI competitor on/off. Launch sheet slides over the chat; the chat collapses into a tray so people can keep talking. End screen offers Save to chat, Share to my story, or Propose to group account (draft flow).

**Prompt sourcing (spec fallback rule).** `ai.games.getPrompts({ conversationId, mode, contextSource })` uses permitted memories (low sensitivity, `kind` joke/event/place) when there are at least 3; otherwise it returns random prompts and the lobby shows "Not enough group lore yet, using random prompts". Prompts are prefetched at lobby creation so rounds never wait on the model.

**One-Word Story.** Turn order is the join order; each turn the active player sees exactly five word cards from `FiveWordChoices` (prefetched for the next player while the current one chooses) and taps one; the word is immutable once chosen; 20 s timer picks nothing and skips; the story ends at the configured word count (default 24) or when the host ends it. Muse Image renders the story in house style; Muse Spark writes a 6-word title. Result card shows the full story with each word tinted by its author.

**Meme Battle.** Each round is either image-prompt (Muse Image generates or picks a group photo with consent; players write captions) or caption-prompt (players pick one of 6 generated images for a given caption). Entries are submitted privately; the AI entry is generated in parallel and labeled "AI" only after reveal; the gallery is shuffled server-side with `anon_slot`; each player votes once, self-votes blocked if configured; tallies hidden until all votes or the timer; reveal animation shows winner and authors.

**Pictionary (P2).** Teams or free-for-all; the drawer gets a private prompt; strokes stream as `game.stroke` events (throttled to 30 Hz, simplified with perfect-freehand), never persisted; guesses go through `POST /games/:id/actions` and are matched after normalization (lowercase, strip punctuation, Levenshtein ≤ 1, synonyms from the prompt's `hint` list); spectators see the canvas but not the prompt; turns rotate; scoring 100 for the guesser, 50 for the drawer.

Acceptance: games launch without leaving the chat; one-word story always shows exactly five choices per turn; a new chat with no history gets random prompts; meme votes stay anonymous until reveal (verify the API response, not just the UI); abandoning a game publishes nothing; sharing to the group account creates a draft.

### 8.6 Facebook Login and Graph import (C1 · P0 login, P1 import)

1. Create a Meta developer app (type: Consumer), add **Facebook Login for Business** or Facebook Login, set Valid OAuth Redirect URIs to `https://ourlore.tech/api/auth/callback/facebook` and `http://localhost:3000/api/auth/callback/facebook`. Add both teammates and all demo accounts under App Roles → Testers.
2. Better Auth Facebook provider with scopes `public_profile`, `email`, `user_likes`, `user_friends`. Before the Facebook dialog, LORE shows its own consent screen: "We'll use your Page likes to suggest interests (you can edit them) and show which friends are already here. We never post to Facebook."
3. After login, `POST /graph/import` calls `GET /{ver}/me?fields=id,name,picture.width(400)`, `/me/likes?fields=name,category&limit=100`, `/me/friends`; stores them in `facebook_imports`; maps like categories to LORE interest tags with a static table (e.g., "Movie", "TV Show" → film-tv; "Musician/Band" → live-music); hands tags to `discovery.service.recordSignal(source = 'graph')` as suggestions the user confirms; auto-suggests following any friend whose `fb_user_id` matches a LORE user.
4. Settings → Connections shows granted scopes, "Re-import", and "Disconnect Facebook" (deletes `facebook_imports` and Graph-sourced tags).

Acceptance: Facebook login works for a Tester account on the prod domain; declining `user_likes` still logs in; the interests step shows Graph-suggested tags marked "from Facebook"; two teammates who both logged in with Facebook see each other under "Friends on LORE".

### 8.7 AI personality studio and Milo behavior (Feature 1 · C2 · P0 behavior, P2 advanced studio)

1. **Add AI member** from Group Details → AI: pick a preset (Milo the playful one, Juniper the calm planner, Sol the hype friend) or custom name, avatar (Muse Image generates 4 options in house style), tone chips, interests, boundaries text, initiative (quiet / balanced / lively), quiet hours, and permission toggles: read history, suggest plans, suggest news, surprise images, use approximate region.
2. A preview pane shows 3 sample messages generated from the current settings (`POST /persona/test`) before joining.
3. Joining posts a system message naming every permission ("Milo can read this chat's messages from now on, suggest plans, and very occasionally make an image. Anyone can mute or remove Milo.") — disclosure to all members is a spec requirement.
4. Behavior is section 7's proactivity engine. Members can mute Milo for 1 h / 8 h / until unmuted, remove Milo, open "Why did Milo say this?", and open Memories to view, correct, or delete what Milo remembers.

Acceptance: Milo replies to a relevant message without being mentioned; Milo stays silent during quiet hours and while muted; Milo never references another conversation's messages (test with two groups); a deleted memory is never used again; a surprise image appears at most once per week by default.

### 8.8 Group Concierge and plans UI (Feature 6 · C2 · P0)

Pipeline is section 7. UI pieces: `PlanCard` (3 option tiles in a horizontal snap row, header "Milo has 3 ideas for Saturday", evidence line "based on: under $20, close to campus, Sam likes films", per-member fit dots, vote buttons, live tally, Refine input, "Sources" footer with domains and freshness); quick-reply chips for the one clarifying question; `PlanConfirmedCard` (title, time, place link, RSVP chips, .ics download); **Plans** tab in Group Space listing proposals and confirmed plans with status pills; a "My preferences for this group" sheet (budget, region, travel time, likes/dislikes, "prefer not to share") whose items are visible only to the AI unless the member chooses "share with group".

Acceptance (from spec 31.10): a chat about meeting up produces a suggestion without an @mention; the shortlist includes at least one movie/show/book/at-home option; a member's hard budget is honored or the card says no feasible option was found; every venue or event tile links to its source; two people can vote differently and refine; only a human can confirm; nothing is booked or sent outside LORE.

### 8.9 Shared memories and recaps (Feature 2 · C2 · P0)

1. **Anticipate:** `SpeakDecision.events[]` and confirmed plans create `event_candidates` (tentative until confidence ≥ 0.8 or a member confirms in the Memories tab).
2. **Cluster:** when 3+ photos/videos are posted in a conversation within an event's window (or within 6 h of each other with no event), the `memories.cluster` job groups them by time gap (> 90 min splits a cluster) and links them to the nearest event.
3. **Describe:** `memories.describe` sends each photo (signed URL, 1024 px) to Muse Spark for `PhotoNotes`, stored in `media_assets.caption_ai`. Low-quality and near-duplicate shots (perceptual hash distance ≤ 6) are deprioritized.
4. **Compose:** `memories.compose` asks Muse Spark for `RecapDraftSpec` using event title, the surrounding 30 messages, and PhotoNotes; renders a 1080x1350 collage with sharp (layouts: 2x2, 1+3, 3x3), and, if enabled, a Muse Image cover. The recap starts `ready_private`.
5. **Offer:** Milo posts a `recap_card` ("I put together Saturday's movie night — want to see?"). The recap editor sheet lets members reorder, remove their own media (consent toggles per owner), edit title/caption, swap layout, regenerate the cover, and choose Save privately / Share in chat / Create story / Propose to group account.
6. **Propose** calls C1's `groups.service.createDraft` with the collage + selected photos as a carousel; the approval card takes over.

Acceptance: a recap's caption mentions only facts present in chat (each `factsUsed` cites a message); a member who toggles off their photo removes it from the recap and any draft built later; the recap stays private until someone chooses to share; music is a text label only ("vibe: cozy lo-fi"), no copyrighted audio.

### 8.10 Family story (Feature 6 mode · C2 · P1)

From Group Space → Memories → "Make a family story": choose a date range; the server gathers text, photo, and voice messages from members who have `ai_history_consent`; contributors get a review card to include/exclude each of their own items; Muse Spark returns `FamilyStorySpec` (chapters with attributed items, flags for unclear dates or unsupported claims); the story viewer is a vertical editorial page with chapter headings, original photos, voice clips with transcripts, contributor avatars on every item, flagged items highlighted for correction, and an optional Muse Image cover labeled "illustration". Sharing is private to the group by default; publishing elsewhere goes through the draft flow.

Acceptance: every sentence in the story links to its source message; excluded items never appear; flagged items must be resolved or removed before sharing; nothing becomes public without a separate approved draft.

### 8.11 Find Friends and Common Ground (Feature 3 · C2 · P1)

1. **Profile:** optional 8-question quiz (interests multi-select from 60 tags, activities, social energy, what you want to learn, conversation style) + Graph suggestions; `discoverable` is off until the user turns it on.
2. **Evolving interests:** C1 calls `recordSignal` on like/save/share/follow with the post's `topic_tags` (tags come from Muse Spark tagging the caption at publish, max 3 per post). A nightly-or-hourly job recomputes `inferred` weights with 14-day decay from `engagement_topics_1d`; explicit dislikes and removed tags always override; the profile page lists inferred tags with "Keep / Remove / Freeze" controls.
3. **Matching:** profile text = explicit tags + top inferred tags + bio snippet → Gemini embedding → DiskANN top 30 among discoverable users → re-rank `0.6 × weighted Jaccard + 0.3 × cosine + 0.1 × serendipity` (serendipity boosts one complementary tag the user marked "want to learn"), excluding existing follows and blocked users.
4. **Common Ground card:** profile preview, 2–3 shared tags, Muse Spark `CommonGroundReason` ("You both shoot street photography and go to local shows"), a starter line, and Request introduction / Not interested / Why this match?
5. **Introductions:** a request sends the recipient an `intro_card`; only on accept does a DM open, prefilled with the editable starter. Declines are silent to the requester.

Acceptance: quiz can be skipped; recommendations appear immediately after the quiz; liking 5 posts tagged `climbing` adds climbing to inferred interests; freezing stops changes; no DM opens without acceptance; private-chat content is never used for matching.

### 8.12 "We Should Start a Podcast" (C2 · P2, the finish gate is non-negotiable)

1. A show is created from a chat ("Start a podcast") with all current members as `required_participant_ids`; it has a root station.
2. Recording: one clip per person per station per day, hard-capped at exactly 20 s by the recorder (auto-stops), no trimming or editing UI, re-record allowed only before submit; replies are voice only (no text input exists on these screens); "Branch" creates a child station with a topic.
3. Each clip is transcribed (batch) and shown with the author's avatar; live captions appear while recording.
4. Status strip: avatars with checkmarks for who has engaged; host can mark the conversation "wrapped". `canFinishPodcast()` = wrapped AND every required participant has at least one valid clip across the show's stations. Until then the Finish button is disabled with "Waiting on Noor" text, and `POST /finish` returns 409.
5. Finish renders an episode: clips in station order with 300 ms gaps and an intro/outro sting (generated tone, no licensed music), an MP3 via ffmpeg, plus a 1080x1920 MP4 with Muse Image B-roll stills (one per clip, from its transcript) and burned-in speaker-labeled captions.

Acceptance: a 19-second clip cannot be submitted when strict mode is on; there is no text reply path; Finish is unavailable with even one missing participant (API and UI); captions are labeled with the real uploader.

### 8.13 Muse personal agent connector (MCP) (C2 · P0)

Server: `apps/api/src/mcp.ts` creates an `McpServer` with `StreamableHTTPServerTransport` in stateless mode, mounted at `POST /mcp` on `mcp.ourlore.tech`. Auth: `Authorization: Bearer lore_pat_<32 random bytes base62>`; tokens are created in Settings → Connect Muse, stored as SHA-256 hashes, scoped (`read`, `plans:write`, `drafts:write`, `games:write`, `intros:write`), revocable, and shown once.

| Tool | Input (zod) | Behavior |
| --- | --- | --- |
| `list_my_groups` | — | groups the user is in, with persona name and active plan count |
| `list_group_plans` | `groupId` | proposals and confirmed plans with options and tallies |
| `suggest_group_activities` | `groupId`, `request?` | enqueues the Concierge; returns proposal id; card appears in chat |
| `record_group_plan_vote` | `proposalId`, `candidateId`, `response`, `confirm: true` | votes as the token's user only |
| `list_group_events` | `groupId` | event candidates and confirmed plans |
| `suggest_memory_recap` | `groupId`, `eventId?` | creates a private recap; never publishes |
| `create_post_draft` | `accountId`, `recapId? or mediaIds`, `caption`, `confirm: true` | creates a submitted draft under the group policy |
| `request_group_approval` | `draftId` | re-posts the draft card to the chat |
| `list_active_games` / `create_game_lobby` | `conversationId`, `mode` | lobby only, nobody is auto-enrolled |
| `get_podcast_status` | `showId` | engaged, missing, finish eligibility; no audio |
| `propose_family_story` | `groupId`, `from`, `to` | private draft only |
| `propose_common_ground_intro` | `targetUserId` | creates an intro request needing acceptance |

Every write tool requires `confirm: true` (Muse also shows its own approval dialog), runs the same service function as REST, and writes `agent_action_audit`. Tool descriptions are written for a model: one sentence of purpose, when to use it, and what it will not do.

Demo setup (once, on the presenter's phone): in the Muse app, send: "Build a custom integration to LORE. Its MCP server is https://mcp.ourlore.tech/mcp over streamable HTTP and needs an Authorization: Bearer header. Connect, list the tools, test list\_my\_groups, and save it as a reusable skill. Ask me for the token through the secure credential flow." Paste the PAT into Muse's secure credential prompt, never into chat. Backup demo: MCP Inspector (`npx @modelcontextprotocol/inspector`) against the same URL.

Acceptance: Muse (or the Inspector) lists tools; a vote cast from Muse appears live on the plan card in the group chat; a revoked token gets 401; a write without `confirm: true` is rejected.

### 8.14 Connection Impact on Snowflake (C2 · P1)

1. Product events (`plan_suggested`, `plan_vote`, `plan_confirmed`, `recap_saved`, `draft_approved`, `game_completed`, `intro_accepted`, `ai_muted`, `podcast_finished`) are written to the `analytics_events` hypertable with SHA-256-hashed group and actor ids and no message text.
2. `impact.sync` job every 60 s reads rows after `sync_cursors.last_at` and inserts them via the Snowflake SQL API (`POST https://<account>.snowflakecomputing.com/api/v2/statements`, PAT auth, `INSERT INTO LORE.PUBLIC.EVENTS SELECT PARSE_JSON(...)` batches of 500).
3. Snowflake views compute: plans confirmed per active group, share of suggestions that got 2+ human votes, recap-to-post conversion, intro acceptance rate, AI mute rate, median time from "let's hang out" to confirmed plan.
4. `/impact` (public, demo-safe) shows those metrics as cards and two small charts, plus a 3-sentence "connection pulse" written by Cortex (`POST /api/v2/cortex/v1/chat/completions`, a Cortex-hosted model) from the aggregate rows only.

Acceptance: confirming a plan in the app shows up on `/impact` within 2 minutes; no raw text or real ids exist in Snowflake.

### 8.15 Lore Keepsakes on Solana devnet (C1 · P2, cut first)

When a recap tied to a confirmed plan is saved, the group may tap "Make it a keepsake". The worker mints one Metaplex Core asset on devnet to the server-held group vault keypair with metadata `{ name: recap title, image: collage URL, attributes: [plan date, member count], members: [per-user devnet pubkeys generated at signup] }` and a SHA-256 of the recap content; the card shows a "Keepsake on Solana devnet" link to Solana Explorer. Airdrop devnet SOL to the vault at deploy. No real money, no wallets required from users.

Acceptance: minting returns a signature viewable on the devnet explorer; failure never blocks saving the recap.

## 9. Design system, Instagram-identical structure, and native app feel

**Non-negotiable:** LORE is demoed as a mobile app. It is installed to the home screen on every demo phone, launches full-screen with no browser bar, and matches Instagram's navigation, screen structure, component layout, and gestures screen for screen. A judge who uses Instagram daily should be able to operate LORE without a single instruction.

What we mirror exactly: the tab bar and its order, every screen's layout and hierarchy, post/story/reel/DM anatomy, icon placement, spacing, sizes, the monochrome look, and all gestures. What stays LORE's own: the name and wordmark, the icon artwork (Lucide outline icons drawn at Instagram's weight), the story-ring gradient, and the AI violet. That keeps it reading as a Meta-family product rather than a counterfeit of a Meta product, which is also what Meta judges will want to see.

LORE's new features live exactly where Instagram would put the closest equivalent, so they feel native: plans, memories, and games open from the chat header and the chat's Details screen (where Instagram puts call, search, and media); rich cards render inside the message list like shared posts do; group accounts are profiles like any other.

### 9.1 Tokens (`packages/tokens`)

| Token | Light | Dark | Used for |
| --- | --- | --- | --- |
| `--bg` | #FFFFFF | #000000 | every screen background |
| `--surface-2` | #EFEFEF | #262626 | others' chat bubbles, search fields, secondary buttons |
| `--ink` | #000000 | #F5F5F5 | primary text and icons |
| `--ink-2` | #737373 | #A8A8A8 | timestamps, secondary text, inactive icons |
| `--line` | #DBDBDB | #262626 | hairline dividers (0.5 px on retina) |
| `--action` | #1A8CFF | #1A8CFF | primary buttons (Follow, Share, Send), links, own chat bubbles |
| `--heart` | #FF3040 | #FF3040 | liked heart, unread dots, notification badges |
| `--ring-a` → `--ring-b` | #FF5A4E → #F6B94A | same | LORE's story ring gradient (coral to amber) |
| `--ring-group` | #2F8F5B | #5CC48A | ring on group-account stories |
| `--ai` / `--ai-tint` | #6C5CE7 / #EFEBFF | #9C8CFF / #221D3D | AI label, AI bubbles, AI cards only |
| `--verified` | #2F8F5B | #5CC48A | "Source · 2 h ago" lines |

Type: the system stack (`-apple-system, "SF Pro Text", Roboto, "Segoe UI", sans-serif`), like Instagram: 14 px body and captions, 12 px timestamps, 16 px screen titles, handles at weight 600. The wordmark "lore" is set in Fraunces italic 600 at 26 px. Fraunces also titles editorial LORE cards (plans, recaps, family stories) so they stand out from regular posts.

Sizes (in CSS px, matching Instagram's iOS metrics): top bar 44 + safe area; tab bar 49 + home indicator; story avatars 64 with a 2 px ring and 2 px white gap; feed header avatar 32; DM row avatar 56; chat header avatar 32; profile avatar 86; icons 24 at stroke 1.75; feed action icons spaced 16; media full-bleed with aspect 1:1 default, 4:5 tallest, 1.91:1 widest; reels 9:16.

### 9.2 Screen-by-screen structure (mirror Instagram)

| Screen | Instagram structure to match | LORE additions (placed natively) |
| --- | --- | --- |
| **Tab bar** | 5 icons, no labels: Home, Search, Create (+ square), Reels, Profile (your avatar, ringed when active). Active = filled icon. Tapping the active tab scrolls to top, a second tap pops to root | Unread dot on Profile when a group draft awaits your approval |
| **Home** | Top bar: wordmark left; heart (Notifications) and messenger icon (DMs, red badge) right. Stories rail with "Your story" + blue plus. Feed of posts | Group stories with green ring and stacked avatars. A "Your plans" story bubble (violet sparkle) leads the rail when a plan is confirmed this week |
| **Post** | Header: avatar, handle, location line, ⋯. Full-bleed media with carousel dots below. Action row: heart, comment, share (paper plane) left; bookmark right. "Liked by …", caption with bold handle and "more", "View all N comments", relative time | Group posts show `@weekendcrew` with a stacked-avatar badge and "Approved by 3 members" in the caption footer; AI covers show the AI pill on the media corner |
| **Comments** | Bottom sheet, 90% height, drag to dismiss, emoji quick row, input pinned above keyboard | — |
| **Share sheet** | Bottom sheet: search, grid of recent chats/people, "Add to story", "Copy link" row | Groups appear in the grid; sharing a post into a group lets Milo react |
| **Story viewer** | Opens with a zoom from the tapped ring; segmented progress bars; avatar, handle, time; tap right/left; hold to pause; swipe down to close; swipe up / reply field "Send message"; heart and share at bottom | Story replies land in the DM or group chat as Instagram does |
| **Search / Explore** | Search field at top; masonry grid with reels as tall tiles; tapping search shows recent searches and account rows | Account results include group accounts (stacked badge); a "Find Friends" row appears at the top of the search results screen |
| **Reels** | Full-screen vertical pager; right rail: heart, comment, share, ⋯, audio thumbnail; bottom-left avatar, handle, Follow, caption, audio line | Recap reels show "Created from shared moments" |
| **Create** | Full-screen modal from the bottom; bottom mode switcher POST / STORY / REEL; gallery grid with a large preview on top; Next → edit (filters strip, crop) → "New post" screen: caption, Tag people, Add location, Audience, Share | One extra row on "New post": **Post as** (you or a group account). For group accounts the button reads Share / Submit for approval / Send for review per policy |
| **Profile** | Header: handle with chevron (account switcher) and ⊕, ☰ menu. Avatar left, stats Posts / Followers / Following right. Name, bio, link. Buttons Edit profile / Share profile (own) or Follow / Message (others). Highlights row. Grid / Reels / Tagged tabs. 3-column square grid with 1 px gaps | Group profiles: "Managed by 4 members" line and a Members button; own profile shows "Your groups" as a highlights-style row |
| **Notifications** | "Notifications" title, sections Today / This week / This month; rows: avatar, text with bold handle, time, thumbnail or Follow button | Approval requests ("Leo submitted a post for @weekendcrew — Review"), plan confirmations, intro requests |
| **DM inbox** | Header: your handle with chevron, compose icon. Search field. "Messages" / "Requests" header. Rows: avatar (56), name, last message + time, unread blue dot, camera icon on the right | Group rows use the stacked avatar; Milo previews read "Milo: …" with a tiny AI pill |
| **Chat** | Header: back, avatar, name, "Active now", two icons right. Bubbles: own on the right in `--action`, others on the left in `--surface-2`, sender avatar on the last bubble of a run, timestamps on long gaps, "Seen" under the last own message. Shared posts render as media cards. Composer: camera circle left, "Message…" pill, mic, gallery, sticker icons right; mic hold-to-record. Long-press a bubble for reactions + reply; swipe a bubble left to reply; double-tap to heart | The two header icons are **Plans** (calendar) and **Games** (dice) instead of call icons. The composer's sticker icon becomes a ✦ sparkle that opens "Ask Milo / Make a plan / Make a recap". AI bubbles: `--ai-tint` with the persona avatar and AI pill. Plan, draft, recap, and game cards render inline like shared posts |
| **Chat Details** | Tapping the header opens Instagram's Details screen: large avatar, name, a row of round action buttons, then sections (members, media, privacy, leave) | Round buttons: **Plans · Memories · Games · Group page · Mute**. Sections add "AI member (Milo)", "Publishing policy", and "Podcast". This screen replaces the old "Group Space strip" idea |

### 9.3 Native app feel (P0, built into the shell in C1-0b)

| Area | Requirement |
| --- | --- |
| Install | Web App Manifest with `display: standalone`, `orientation: portrait`, `theme_color`/`background_color` per theme, maskable icons; `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style: black-translucent`, apple-touch-icon, and iOS splash screens for current iPhone sizes generated by `pwa-asset-generator`. An "Install LORE" sheet appears in Safari/Chrome with a 2-step illustration |
| Viewport | `width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content`; heights use `100dvh`; top bar and tab bar pad with `env(safe-area-inset-*)`; every input is 16 px so iOS never zooms |
| App shell | Top bar and tab bar are fixed; only the content area scrolls; no page ever reloads; each tab keeps its own navigation stack and scroll position (tabs stay mounted, hidden with `display:none` or Activity), exactly like a native tab controller |
| Transitions | Push: new screen slides in from the right (300 ms, iOS curve) while the previous one shifts 30% left and dims; pop reverses. Modals (Create, Comments, Share) slide up. Story opens with a zoom from its ring. Use the View Transitions API where supported, `motion` otherwise |
| Gestures | Edge-swipe from the left 24 px to go back on any pushed screen; swipe left on Home opens DMs and swipe right opens the story camera, as Instagram does; swipe down to dismiss stories, sheets, and the media viewer; pull to refresh on Home, Inbox, Profile, Notifications; double-tap to like; long-press for reactions and previews; pinch to zoom a feed photo in an overlay (`@use-gesture/react`) |
| Sheets | `vaul` drawers with snap points (50% / 90%), rubber-band drag, background scale-down on iOS |
| Touch polish | `touch-action: manipulation`; `-webkit-tap-highlight-color: transparent`; `user-select: none` on chrome; `-webkit-touch-callout: none` on UI images; pressed state = opacity 0.6 on icons, scale 0.97 on buttons; no hover-only UI; hidden scrollbars; `overscroll-behavior: none` on the root so the shell never rubber-bands |
| Keyboard | Composer and comment inputs track `visualViewport` so they sit exactly on top of the keyboard on iOS; the message list stays pinned to the bottom while typing |
| Speed | Route prefetch on tab mount; optimistic likes, follows, sends, and votes; skeletons shaped like Instagram's gray placeholder blocks; blurhash placeholders; AVIF/WebP; one video element playing at a time; 60 fps scrolling; zero layout shift |
| Offline | Service worker caches the shell, fonts, icons, and the last loaded feed and inbox; an offline banner instead of a browser error page |
| Media capture | In-app story camera with `getUserMedia` (shutter, flip, flash), gallery picker via `<input type=file accept=image/*,video/*>`, hold-to-record voice with a waveform |
| Notifications | Web push to installed apps (iOS 16.4+ and Android) with VAPID and the `web-push` library: approval requests, plan confirmed, new messages. P1, but it makes a great demo moment on the lock screen |
| Feedback | `navigator.vibrate(10)` on like, long-press, and vote on Android; badges and red dots update in real time |
| Theme | Follows system light/dark instantly, including the status bar color |

Desktop and laptops: the same app renders in Instagram's desktop-web structure (left icon rail with labels, center feed column of 470 px, right column with your account and suggestions); it is P1 because the demo runs on phones. Never show a stretched phone layout on desktop.

### 9.4 The three-label rule (spec: distinguish AI suggestion, verified fact, human decision)

| Label | Look | Appears on |
| --- | --- | --- |
| **AI** | violet pill with a small sparkle | every AI message, AI image, AI-drafted card, AI meme entry after reveal |
| **Source** | green text "Source · fandango.com · 2 h ago" with a link | plan tiles, news nudges, candidate details |
| **Confirmed** | black pill with a check and the person's name | confirmed plans, approved drafts, "Approved by 3 members" on group posts |

### 9.5 Components (C1 builds in scaffold, both use)

TabBar, TopBar, StackNavigator (push/pop with gestures), Sheet (vaul), Avatar, AvatarStack, StoryRing, StoriesRail, PostCard, CarouselDots, ActionRow, LikeBurst (double-tap heart), CommentsSheet, ShareSheet, ReelPlayer, Grid3, ProfileHeader, HighlightsRow, SegmentedTabs (grid/reels/tagged icons), SearchField, NotificationRow, ThreadRow, MessageBubble (own/other/AI/system, grouped corners like Instagram), ChatComposer, ReactionBar, CardShell (frame for plan/draft/recap/game cards: header icon + title + labels, body, actions), Button (blue primary / gray secondary / text), Skeleton, EmptyState, Toast, PullToRefresh, InstallPrompt, ConfirmHold (press-and-hold for consequential actions).

### 9.6 Route map (`apps/web/src/app`)

| Route | Screen | Owner |
| --- | --- | --- |
| `/login`, `/signup`, `/onboarding` | Instagram-style login (wordmark, fields, blue Log in, "Continue with Facebook"), consent, handle/avatar, interests step (C2 component) | C1 |
| `/` | Home | C1 |
| `/explore`, `/reels`, `/create` | Search/Explore, Reels, Create modal | C1 |
| `/u/[handle]`, `/g/[handle]` | personal and group profiles | C1 |
| `/stories/[accountId]`, `/story-camera` | story viewer, in-app camera | C1 |
| `/activity` | Notifications | C1 |
| `/inbox`, `/c/[id]`, `/c/[id]/details` | DM inbox, chat, Details | C1 |
| `/c/[id]/settings` | members, roles, mutes, group account, policy (pushed from Details) | C1 |
| `/c/[id]/ai` | AI member studio and memories | C2 |
| `/c/[id]/plans`, `/c/[id]/memories` | Plans and Memories screens (pushed from the chat header or Details) | C2 |
| `/c/[id]/games/[gameId]` | game screen (full-screen modal) | C1 |
| `/join/[slug]` | guest join for judges | C1 |
| `/recap/[id]`, `/family/[id]` | recap editor, family story viewer | C2 |
| `/find-friends` | quiz, matches, introductions | C2 |
| `/podcast/[showId]` | stations, recorder, status, episode player | C2 |
| `/settings` | Instagram-style settings list: account, theme, connections (Facebook), privacy, notifications | C1 |
| `/settings/muse` | connect Muse: create/revoke tokens, copyable setup prompt | C2 |
| `/impact` | Connection Impact | C2 |

Computer 2's screens must use the same StackNavigator, Sheet, TopBar, and list-row components, so Plans, Memories, Find Friends, and Podcast feel like Instagram's own sub-screens (white list rows, hairline dividers, back chevron, centered title).

Accessibility: targets ≥ 44 px, `aria-live="polite"` on chat and game state, alt text on upload (AI-suggested default the user can edit), captions on voice and video, and color never the only signal.

### 9.7 Native-feel acceptance (run on one iPhone and one Android phone, launched from the home-screen icon)

1. No browser UI is ever visible; the status bar matches the theme; nothing sits under the notch or the home indicator.
2. Switching tabs preserves each tab's scroll position and stack; tapping the active tab scrolls to top.
3. Edge-swipe back works on every pushed screen; stories and sheets dismiss with a downward swipe.
4. Double-tap like shows the heart burst; long-press a message shows reactions; swipe-to-reply works.
5. Focusing the chat composer never zooms the page and keeps the input on top of the keyboard.
6. A side-by-side with Instagram on the same phone shows the same tab order, header layout, post anatomy, profile layout, DM list, and chat layout.

## 10. Two-computer split

**Computer 1 builds the platform** (social core, chat, group accounts, games, Graph, infra, Solana); **Computer 2 builds the intelligence** (the AI package, Milo, Concierge, memories, voice, MCP connector, discovery, Snowflake, family story, podcast, seed data). The split is by folder, so each branch only ever touches its own paths, and the few shared files follow additive-only rules.

### Ownership map

| Path | Owner | Rule for the other computer |
| --- | --- | --- |
| root config (`package.json`, `turbo.json`, `biome.json`, `tsconfig.base.json`, `.github/`) | C1 | Request changes in `docs/HANDOFF.md` |
| `infra/**` | C1 | Read only |
| `packages/tokens/**` | C1 | Read only |
| `packages/shared/**` | Shared (written by C1-0b) | Additive edits only + log in `docs/CONTRACTS.md` |
| `packages/db/src/schema/{social,chat,groups,games}.ts`, `packages/db/sql/001-002*` | C1 | Read only |
| `packages/db/src/schema/{persona,plans,memories,family,podcast,discovery,integrations}.ts`, `packages/db/sql/003-005*` | C2 | Read only |
| `packages/db/src/schema/index.ts` | Frozen after C1-0b (already exports every file) | Never edit |
| `packages/ai/**` | C2 | Import only from `@lore/ai` index |
| `apps/api/src/{server,mcp,worker}.ts`, `apps/api/src/lib/**`, `apps/api/src/modules/index.ts` | C1 (frozen after C1-0b except `lib`) | Request in HANDOFF |
| `apps/api/src/modules/{auth,users,social,media,chat,groups,games,notifications,graph,keepsakes}/**` | C1 | Call exported service functions only |
| `apps/api/src/modules/{persona,plans,memories,family,podcast,discovery,impact,mcp,voice}/**` | C2 | Call exported service functions only |
| `apps/web/src/{components,lib}/**`, `apps/web/src/app/layout.tsx`, `apps/web/src/app/(app)/layout.tsx` | C1 | Request in HANDOFF; use primitives freely |
| `apps/web/src/features/{auth,feed,stories,reels,explore,create,profile,chat,groups,games,notifications,keepsakes}/**` | C1 | Read only |
| `apps/web/src/features/{persona,plans,memories,family,podcast,discovery,impact,connect-muse,voice}/**` | C2 | Read only |
| Route files under `apps/web/src/app/**` | Owner per the route map in section 9 | Each route file is a thin wrapper that renders its feature's page component |
| Registries (`features/chat/cards/registry.tsx`, `features/chat/toolbar/registry.ts`, `features/groups/space/tabs.ts`) | Frozen after C1-0b | Owners fill the stub files the registries point to |
| `scripts/**` | C2 | — |
| `docs/CONTRACTS.md`, `docs/HANDOFF.md`, `.env.example` | Shared | Append under your own `## Computer N` heading only |

The trick that makes this work: in C1-0b, Computer 1 creates **every** file the other side will fill (schema files with all tables from section 5, module folders with stub plugins, feature folders with placeholder pages and cards, cross-boundary function stubs). After that, neither branch ever needs to create or edit a file in the other's space.

### Computer 1 task list (in order)

| ID | Task | Tier | Depends on | Done when |
| --- | --- | --- | --- | --- |
| C1-0a | Bootstrap repo: GitHub `lore` (private, add teammate), pnpm + Turborepo + Biome + base tsconfig, empty `apps/*` and `packages/*` with package.json, commit this plan to `docs/` | P0 | — | `main` pushed within 20 min; teammate can clone |
| C1-0b | Full scaffold on `main`: `packages/shared` (all of section 6), all schema files and SQL from section 5, `packages/tokens`, the native mobile app shell from section 9.3 (manifest, icons, splash, safe areas, tab bar with per-tab stacks, push/pop transitions, edge-swipe back, sheets, pull to refresh), every route as a placeholder, and the Instagram-structured components from section 9.5, registries with stubs, Fastify server + module registry + every module stub, cross-boundary stubs, Socket.IO with session auth, BullMQ worker + queue registry, `mcp.ts` stub, local `docker-compose.dev.yml` (Valkey), `.env.example`, CI workflow | P0 | C1-0a | `pnpm dev` runs web, api, worker; `/health` ok; CI green; pushed to `main`; tell C2 to rebase |
| C1-1 | Auth: Better Auth email/password + Facebook provider, session cookie, `/me`, onboarding (handle, avatar, visibility), personal account creation | P0 | C1-0b | Two users can sign up and see `/me`; Facebook login works locally with a Tester |
| C1-2 | Media pipeline: presign, complete, thumbnails, blurhash, signed GETs, `media.service.createFromBuffer` | P0 | C1-1 | Upload from phone works; C2 can save a generated image |
| C1-3 | Social core: profiles, follow, posts (photo, carousel), feed, likes, saves, comments, stories + viewer, composer with account switcher | P0 | C1-2 | Section 8.1 acceptance (minus reels/explore) |
| C1-4 | Chat: inbox, create DM/group, messages, realtime, typing, reactions, read state, voice notes UI, group details, member management, `persona.onMessage` hook | P0 | C1-1 | Section 8.2 acceptance |
| C1-5 | Group accounts: creation, policies (4 modes), drafts, `mayPublish`, approval card, publish, audit, `groups.service.createDraft` | P0 | C1-3, C1-4 | Section 8.4 acceptance + unit tests |
| C1-6 | Infra: Vultr VM, Docker images, Caddy, `ourlore.tech` + `mcp.ourlore.tech` DNS, prod Tiger service, Object Storage bucket + CORS, `deploy.sh`; first deploy | P0 | C1-0b | Site loads over HTTPS at Checkpoint A |
| C1-7 | Game engine + One-Word Story | P0-stretch | C1-4, C2-1 games prompts | Section 8.5 One-Word Story acceptance |
| C1-8 | Meme Battle | P1 | C1-7 | Section 8.5 Meme Battle acceptance |
| C1-9 | Reels, Explore search, notifications (in-app + web push to installed apps) | P1 | C1-3 | Sections 8.1 (reels/explore) and 8.3 |
| C1-10 | Graph import, "Friends on LORE", connections settings | P1 | C1-1 | Section 8.6 acceptance |
| C1-11 | Pictionary | P2 | C1-7 | Section 8.5 Pictionary acceptance |
| C1-12 | Solana keepsakes | P2 | C2-5 | Section 8.15 acceptance |
| C1-13 | Polish: section 9.7 native-feel acceptance on one iPhone and one Android phone, side-by-side check against Instagram, empty/loading/error states, a11y pass, desktop-web layout (P1) | P0 (last 2 h) | all | Section 16 checklist |

### Computer 2 task list (in order)

| ID | Task | Tier | Depends on | Done when |
| --- | --- | --- | --- | --- |
| C2-0 | Provision everything while C1 scaffolds (section 14 checklist): Meta Model API key + $50 credit form, SerpAPI credits, Gemini key, own Tiger free service, Snowflake trial + PAT + network policy, Vultr account + Object Storage, register `ourlore.tech`, create Meta developer app; share secrets via a password-manager share, never in git or chat | P0 | — | Every key in section 14 exists and is shared |
| C2-1 | `packages/ai`: all clients, `callStructured`, mocks for every schema, guard, budget, house style, **game prompt functions for C1**, `pnpm ai:smoke` that calls each live API once | P0 | C1-0a (repo), rebased on C1-0b | Smoke script passes live; mock mode returns valid fixtures |
| C2-2 | Milo: persona API + basic studio (preset, name, initiative, permissions), disclosure system message, `persona.consider` + `persona.tick`, memory extraction + embedding, "Why?" sheet, mute | P0 | C2-1, C1-4 hook | Section 8.7 acceptance |
| C2-3 | Voice: `voice.transcribe` job, `transcribeMedia` export, `/v1/voice/live` proxy, `LiveCaption` component | P0 | C2-1 | Voice note transcript appears in chat; live captions stream |
| C2-4 | Concierge: SerpAPI retrieval, brief, hard filter, ranking, `PlanCard`, votes, refine, confirm, Plans tab, preferences sheet, quick-reply clarifier | P0 | C2-2 | Section 8.8 acceptance |
| C2-5 | Memories: event candidates, clustering, PhotoNotes, compose, collage, Muse Image cover, recap card + editor, propose → draft | P0 | C2-1, C1-2, C1-5 stub | Section 8.9 acceptance |
| C2-6 | MCP connector: PATs + `/settings/muse`, MCP server with all tools, audit, Inspector test, Muse app connection | P0 | C2-4 | Section 8.13 acceptance |
| C2-7 | Seed: `scripts/seed.ts` (personas, Weekend Crew, history with inside jokes, preferences, posts with pre-generated Muse Image art, a past event with photos), `scripts/reset-demo.ts` | P0 | C2-2, C2-4 | `pnpm seed` builds the demo world on any database in < 2 min |
| C2-8 | Find Friends: quiz, interest tagging at publish, signals, matching, Common Ground cards, introductions | P1 | C2-1 | Section 8.11 acceptance |
| C2-9 | Snowflake impact: analytics events, sync job, views, Cortex pulse, `/impact` | P1 | C2-4 | Section 8.14 acceptance |
| C2-10 | Family story | P1 | C2-5 | Section 8.10 acceptance |
| C2-11 | Podcast stations and episode render | P2 | C2-3 | Section 8.12 acceptance |
| C2-12 | Persona studio advanced (avatars via Muse Image, preview pane, quiet hours UI), AI polish | P2 | C2-2 | Section 8.7 studio steps 1–2 |

### Working agreements

- **Branches:** C1 works on `c1/platform`, C2 on `c2/intelligence`. Only C1-0a and C1-0b commit directly to `main`; after that `main` changes only through the merge protocol.
- **Stubs before callers:** if your feature calls the other side's function that is still a stub, write against its typed signature and test with `AI_MODE=mock` or a local fake; never implement the other side's function yourself.
- **HANDOFF.md:** any request for the other computer goes there as `- [ ] C1→C2: …` with the reason; check it at every checkpoint.
- **Database:** each computer uses its own Tiger service (`DATABASE_URL` in its local `.env`); never point at prod until Checkpoint A deploys.
- **Pace:** push every 45 minutes; keep `pnpm typecheck` and `pnpm test` green on your branch before each push.

## 11. Timeline, checkpoints and cut lines

The plan assumes about 24 working hours from H0 (the moment both agents start); the P0 demo chain must be live on ourlore.tech by Checkpoint B at H14, which leaves six hours of buffer before the final merge. Grey items are P2 and are the first to go.

&#91;embedded content: build roadmap · 4 phases, 3 merge gates, 2 lanes\]

If you have fewer than 24 hours left, keep the gates at the same fractions (30%, 60%, 85% of your remaining time) and cut from the bottom of each list.

### What happens at each gate

| Gate | Merge | Must be true after the merge | If it is not |
| --- | --- | --- | --- |
| **Checkpoint A (H7)** | Both branches into `main` (section 13), deploy | Signup, group chat between two phones, Milo replies in mock or live mode, voice note transcript, site on HTTPS | Fix forward together for up to 45 min; anything still broken is flagged off |
| **Checkpoint B (H14)** | Both branches into `main`, deploy, run `pnpm seed` on prod | The full demo chain works end to end on prod: chat → Milo → plan card → votes → confirm → recap → group draft → approval → group post; MCP tool call from Inspector or Muse | Stop phase 3 work; both computers fix the chain until it passes |
| **Final merge (H20)** | Both branches into `main`, deploy, reseed, tag `v1.0-demo` | Every P0 and every finished P1 works on prod; unfinished features are flag-off | Flag off, do not debug past H22 |

### Cut lines (in order)

1. Pictionary, then podcast episode video render (keep audio-only finish), then Solana keepsakes, then advanced persona studio.
2. Then family story, then Snowflake Cortex pulse (keep the metrics), then Meme Battle.
3. Never cut: the P0 chain, the AI labels, the approval policies, the MCP connector, Facebook Login, voice transcription. Those carry the Meta judging criteria and all five Meta technologies.

### Communication rhythm

- Every 2 hours: a 3-line status in your team chat (done, next, blocked) and a glance at `docs/HANDOFF.md`.
- 30 minutes before each gate: both stop starting new tasks, finish and push what is open, and make sure `pnpm typecheck && pnpm test` pass on the branch.
- After each gate: both rebase their branch on the new `main` before continuing (`git fetch && git rebase origin/main`).

## 12. Kickoff prompts for the coding agents

Paste the matching prompt into each machine's coding agent at H0, after exporting this doc to Markdown and placing it at `docs/IMPLEMENTATION_PLAN.md` (Computer 1 commits it in C1-0a; Computer 2 can paste it into its agent directly until the repo exists). Each prompt makes the agent re-read the plan from disk, so later edits to this doc reach it after a re-export.

### Computer 1 prompt

```text
I am Computer 1. Do the tasks for Computer 1.

You are the lead engineer for the PLATFORM half of LORE, a relationship-first AI social app for the
HackTX 2026 Meta track. The complete implementation plan is in docs/IMPLEMENTATION_PLAN.md. Read the
whole file before writing code. Sections 1-9 are the shared truth; section 10 is your task list
(rows C1-0a through C1-13); section 13 is how merges work.

Rules you must follow:
1. Execute Computer 1 tasks in the order of the section 10 table. Do not start a task until its
   "Depends on" items are done. After each task, run `pnpm typecheck && pnpm test`, commit with a
   Conventional Commit prefixed `c1-`, and push.
2. C1-0a and C1-0b commit directly to `main`. Everything after that goes on branch `c1/platform`.
3. In C1-0b you create EVERY file both computers need (all schema files with every table from
   section 5, every module folder with a stub Fastify plugin, every feature folder with a placeholder
   page and stub cards, the three registries, and typed stubs for the cross-boundary functions in
   section 6 that throw NotImplemented). Computer 2 depends on these existing exactly as named.
4. Only edit paths the ownership map in section 10 assigns to C1. Shared files (packages/shared,
   docs/CONTRACTS.md, docs/HANDOFF.md, .env.example) are additive-only; log contract changes in
   docs/CONTRACTS.md under "## Computer 1". If you need something from Computer 2, add
   "- [ ] C1->C2: ..." to docs/HANDOFF.md and work against the typed stub meanwhile.
5. Use exactly the libraries in section 4. Use the design tokens and components in section 9 for
   every screen; the UI must look production-ready on a phone and a laptop, light and dark.
6. Never commit secrets. Read them from .env (keys listed in section 14).
7. Each task is done only when its "Done when" column and the matching section 8 acceptance lines
   pass. Write the unit tests section 16 lists for your modules.
8. Stop and tell me when you reach a checkpoint in section 11 (H7, H14, H20) so we can merge.

Start now with C1-0a. Before coding, print a short plan for C1-0a and C1-0b (files you will create),
then execute without waiting for approval.
```

### Computer 2 prompt

```text
I am Computer 2. Do the tasks for Computer 2.

You are the lead engineer for the INTELLIGENCE half of LORE, a relationship-first AI social app for
the HackTX 2026 Meta track. The complete implementation plan is in docs/IMPLEMENTATION_PLAN.md. Read
the whole file before writing code. Sections 1-9 are the shared truth; section 10 is your task list
(rows C2-0 through C2-12); section 13 is how merges work. Meta's Muse Spark, Muse Image, Muse Voice
Transcribe, the Muse agent connector (MCP), and the Facebook Graph API must all be used as section 2
and section 7 describe.

Rules you must follow:
1. C2-0 is account provisioning that I (the human) do while you wait; help me with exact steps from
   section 14 if I ask. Then clone the repo, create branch `c2/intelligence` from `main`, and start
   C2-1. When Computer 1 announces that C1-0b landed on main, run `git fetch && git rebase
   origin/main` before continuing.
2. Execute Computer 2 tasks in the order of the section 10 table. After each task, run
   `pnpm typecheck && pnpm test`, commit with a Conventional Commit prefixed `c2-`, and push.
3. Only edit paths the ownership map in section 10 assigns to C2. Do not create files in Computer 1's
   space; C1-0b already created your module folders, feature folders, schema files, card stubs, and
   the typed stubs you implement (transcribeMedia, persona.onMessage, recordSignal) or call
   (postMessage, updateMessage, createDraft, createFromBuffer, signedUrl). Shared files are
   additive-only; log contract changes in docs/CONTRACTS.md under "## Computer 2". Requests for
   Computer 1 go in docs/HANDOFF.md as "- [ ] C2->C1: ...".
4. Build packages/ai first with AI_MODE=mock fixtures for every schema in section 7, then the live
   clients. Include the game prompt functions Computer 1 needs. Every model output that drives logic
   uses structured output validated with zod plus the server-side anti-hallucination checks in
   section 7.
5. Every AI-generated message, image, or card must carry the AI label; every venue, event, or news
   item must carry its SerpAPI source link. Never let the AI book, RSVP, publish, or message anyone
   on its own.
6. Use exactly the libraries in section 4 and the design tokens/components in section 9 for every
   screen you build (Plans, Memories, AI studio, Find Friends, Podcast, Connect Muse, Impact).
7. Never commit secrets. Read them from .env (section 14).
8. Each task is done only when its "Done when" column and the matching section 8 acceptance lines
   pass. Write the unit tests section 16 lists for your modules.
9. Stop and tell me when you reach a checkpoint in section 11 (H7, H14, H20) so we can merge.

Start now: print the C2-0 provisioning checklist for me, then begin C2-1 in mock mode.
```

### After-checkpoint resume prompt (either computer)

```text
The checkpoint merge is done and main is deployed. Run `git fetch && git checkout <my branch> &&
git rebase origin/main`, resolve nothing outside my owned paths, run `pnpm install && pnpm typecheck
&& pnpm test`, read docs/HANDOFF.md and docs/CONTRACTS.md for anything addressed to me, then continue
with my next unfinished task in section 10. Re-read docs/IMPLEMENTATION_PLAN.md first in case it changed.
```

## 13. Merge protocol

Merges happen three times (H7, H14, H20) on Computer 1's machine by default, on a throwaway `integrate/*` branch, and `main` only moves after typecheck, tests, build, and the end-to-end smoke pass. Because each branch owns disjoint folders, conflicts should be limited to the lockfile and additive edits in shared files; the rules below resolve each kind mechanically.

### Before a merge (both computers, 30 minutes before the gate)

1. Finish or stash the task in progress; nothing half-written goes in.
2. `pnpm typecheck && pnpm lint && pnpm test` pass on your branch.
3. Push your branch; post the branch link in team chat, e.g. `https://github.com/<org>/lore/tree/c1/platform` and `…/tree/c2/intelligence`.
4. Update `docs/HANDOFF.md`: tick what you delivered, list what is still a stub.

### Conflict rules

| Rule | Applies to | Resolution |
| --- | --- | --- |
| **M1** | A path owned by one computer (section 10 map) | Take the owner's version entirely |
| **M2** | `pnpm-lock.yaml` | Take either side, then run `pnpm install` to regenerate; commit the result |
| **M3** | `packages/shared/**` | Keep the union of both sides' additions; if the same field was added with different types, make it a union type or two optional fields, and note it in `docs/CONTRACTS.md` |
| **M4** | `docs/CONTRACTS.md`, `docs/HANDOFF.md`, `.env.example` | Keep both computers' sections, in order |
| **M5** | Frozen files (registries, `modules/index.ts`, `schema/index.ts`, entrypoints) | Restore `main`'s version unless `docs/HANDOFF.md` records an agreed change; then apply that change |
| **M6** | Database schema | Checkpoints: fork the prod Tiger service first (`tiger service fork` or the console's Fork button) as a snapshot, then `pnpm db:push && pnpm db:setup` against prod. Final merge: also run `drizzle-kit generate` to produce one baseline migration in `packages/db/drizzle/` for the repo record |
| **M7** | Anything else | Keep both behaviors if possible; if they truly contradict, stop and show the human both hunks with a recommendation |

### The merge prompt (paste on the merging machine)

```text
It is time to merge the code from Computer 1 and Computer 2.
Computer 1 branch: <paste link to c1/platform>
Computer 2 branch: <paste link to c2/intelligence>
Checkpoint: <A | B | FINAL>

Follow section 13 of docs/IMPLEMENTATION_PLAN.md exactly:
1. git fetch --all --prune. Confirm both branches are pushed and report their head commits.
2. git checkout -b integrate/<checkpoint>-<HHMM> origin/main
3. git merge --no-ff origin/c1/platform -m "merge: c1/platform into <checkpoint>"
4. git merge --no-ff origin/c2/intelligence -m "merge: c2/intelligence into <checkpoint>"
   Resolve every conflict with rules M1-M7 from section 13. For each conflicted file, state which
   rule you applied. Never hand-edit code inside an owned path to "make it work"; if an owned file
   must change, list it as a follow-up for its owner in docs/HANDOFF.md.
5. pnpm install, then pnpm typecheck, pnpm lint, pnpm test, pnpm build. Fix only integration issues
   (imports, shared types, wiring). Report anything that needs an owner's fix.
6. Wiring audit: grep for NotImplemented in cross-boundary functions (section 6 table) and list any
   still unimplemented; confirm every card kind, toolbar action, and Group Space tab in the
   registries resolves to a real component; confirm persona.onMessage is called after human messages.
7. Start the local stack with AI_MODE=mock (docker compose -f docker-compose.dev.yml up -d, pnpm dev)
   and run pnpm e2e:smoke (Playwright, two browser contexts). Then run it once with AI_MODE=live.
8. If everything passes: push the integrate branch, fast-forward main to it
   (git checkout main && git merge --ff-only integrate/<...> && git push), and tag
   checkpoint-<A|B>-<HHMM> or v1.0-demo for FINAL.
9. Deploy (section 14): fork the prod Tiger service as a snapshot, run ./infra/deploy.sh, run
   pnpm db:push && pnpm db:setup against prod, and for B and FINAL run pnpm seed:prod. Run
   pnpm e2e:smoke against https://ourlore.tech.
10. Print a merge report: conflicts and the rule used for each, test results, remaining stubs,
    new HANDOFF items per computer, deploy status, and the exact command each computer should run
    to rebase (the after-checkpoint resume prompt in section 12).
If any step fails and cannot be fixed with integration-only changes within 30 minutes, stop, do not
move main, and print the failing output with a recommendation.
```

### After the merge

- Both computers paste the after-checkpoint resume prompt from section 12.
- Whoever did not merge checks the live site on their own phone within 10 minutes and reports anything broken.
- At the final merge, the team also freezes `main` at H23: only demo-blocking fixes after that, each one merged with the same steps 5–9.

## 14. Infrastructure, accounts and environment

Production is one Vultr VM in Dallas (closest region to Austin) running Docker Compose; Computer 2 provisions every account in C2-0 while Computer 1 scaffolds, and Computer 1 owns the VM, DNS, and deploys. Secrets move only through a password-manager share and live in `.env` files that are git-ignored.

### Accounts checklist (C2-0)

| Service | Where | Create | Env vars produced |
| --- | --- | --- | --- |
| Meta Model API | [dev.meta.ai](https://dev.meta.ai/) + the HackTX credit form (forms.gle/Vp192e4AQLYSuw3GA) | US account, API key, request the $50 credit; run `GET /v1/models` | `META_API_KEY`, `META_API_BASE=https://api.meta.ai/v1`, `MUSE_TEXT_MODEL`, `MUSE_IMAGE_MODEL=muse-image-1.0`, `MUSE_VOICE_MODEL=muse-voice-transcribe-1.0` |
| Meta for Developers app | developers.facebook.com | Consumer app with Facebook Login; redirect URIs from 8.6; add teammates and demo accounts as Testers | `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET`, `FB_GRAPH_VERSION` |
| Muse app (agent) | Muse on the presenter's phone | Sign in (US, adult; a payment card is required even on the free tier) | none (PAT is created inside LORE) |
| SerpAPI | serpapi.com/hacktx2026 | Redeem 1,000 credits | `SERPAPI_KEY` |
| Gemini | aistudio.google.com | API key | `GEMINI_API_KEY`, `GEMINI_EMBED_MODEL=gemini-embedding-001`, `GEMINI_GUARD_MODEL` (current Flash id) |
| Tiger Data | console.cloud.timescale.com (MLH link: mlh.link/tigerdata) | Each person: Free Plan, one service for dev. Computer 1's second free service is prod. Enable vector extensions | `DATABASE_URL` (per machine), `DATABASE_URL_PROD` |
| Snowflake | Snowflake trial from the MLH Snowflake page | Choose a cloud region where Cortex is available; database `LORE`, warehouse `LORE_WH` (XS, auto-suspend 60 s), role, programmatic access token, network policy allowing the Vultr VM IP | `SNOWFLAKE_ACCOUNT`, `SNOWFLAKE_PAT`, `SNOWFLAKE_ROLE`, `SNOWFLAKE_WAREHOUSE`, `SNOWFLAKE_DATABASE`, `SNOWFLAKE_CORTEX_MODEL` |
| Vultr | mlh.link/vultr (credits) | Cloud Compute VM: Ubuntu 24.04, 4 vCPU / 8 GB, Dallas; Firewall group (22 from team IPs, 80, 443); Object Storage + bucket `lore-media` | `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `VULTR_VM_IP` |
| .TECH domain | get.tech/mlh with the MLH code | Register `ourlore.tech`; DNS A records `@` and `mcp` → VM IP, TTL 300 | `APP_URL=https://ourlore.tech`, `MCP_URL=https://mcp.ourlore.tech` |
| Solana (P2) | none | `solana-keygen new` for the vault; `solana airdrop 2 --url devnet` | `SOLANA_RPC_URL=https://api.devnet.solana.com`, `SOLANA_VAULT_SECRET` (base58) |
| GitHub | github.com | Private repo `lore`, both members as collaborators, Actions on | — |
| SpaceXSI | the MLH SpaceXSI page | Cursor installed on both machines with a Grok model selectable; follow the Grok Bot instructions for the raffle | — |

The Tiger Free Plan has no connection pooler, so set the postgres.js pool to `max: 5` per process (4 processes, 20 connections).

### `.env.example` (complete)

```bash
# app
NODE_ENV=development
APP_URL=http://localhost:3000
API_PORT=4000
MCP_PORT=4100
MCP_URL=http://localhost:4100
SESSION_COOKIE_DOMAIN=localhost
BETTER_AUTH_SECRET=change-me-32-bytes
BETTER_AUTH_URL=http://localhost:3000
AI_MODE=mock                 # mock | live
DEMO_FAST_PROACTIVE=0
FEATURE_REELS=1
FEATURE_EXPLORE=1
FEATURE_GAMES_MEME=0
FEATURE_GAMES_PICTIONARY=0
FEATURE_FIND_FRIENDS=0
FEATURE_FAMILY_STORY=0
FEATURE_PODCAST=0
FEATURE_IMPACT=0
FEATURE_KEEPSAKES=0
# data
DATABASE_URL=postgres://...      # your own Tiger dev service
VALKEY_URL=redis://localhost:6379
S3_ENDPOINT=https://dfw.vultrobjects.com   # use the hostname Vultr shows for your bucket
S3_REGION=us-east-1
S3_BUCKET=lore-media
S3_ACCESS_KEY=
S3_SECRET_KEY=
# meta
META_API_KEY=
META_API_BASE=https://api.meta.ai/v1
MUSE_TEXT_MODEL=muse-spark-1.1
MUSE_IMAGE_MODEL=muse-image-1.0
MUSE_VOICE_MODEL=muse-voice-transcribe-1.0
FACEBOOK_CLIENT_ID=
FACEBOOK_CLIENT_SECRET=
FB_GRAPH_VERSION=v24.0          # replace with the version shown in your App Dashboard
# sponsors
SERPAPI_KEY=
GEMINI_API_KEY=
GEMINI_EMBED_MODEL=gemini-embedding-001
GEMINI_GUARD_MODEL=
SNOWFLAKE_ACCOUNT=
SNOWFLAKE_PAT=
SNOWFLAKE_ROLE=
SNOWFLAKE_WAREHOUSE=LORE_WH
SNOWFLAKE_DATABASE=LORE
SNOWFLAKE_CORTEX_MODEL=
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_VAULT_SECRET=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
```

### Production layout on the VM

```yaml
# infra/docker-compose.yml (abridged; C1 writes the full file)
services:
  caddy:  { image: caddy:2, ports: ["80:80", "443:443"], volumes: [./Caddyfile:/etc/caddy/Caddyfile, caddy_data:/data] }
  web:    { build: { context: .., dockerfile: infra/web.Dockerfile }, env_file: ../.env.prod, expose: ["3000"] }
  api:    { build: { context: .., dockerfile: infra/api.Dockerfile }, command: node dist/server.js, env_file: ../.env.prod, expose: ["4000"] }
  mcp:    { image: lore-api, command: node dist/mcp.js, env_file: ../.env.prod, expose: ["4100"] }
  worker: { image: lore-api, command: node dist/worker.js, env_file: ../.env.prod }
  valkey: { image: valkey/valkey:8, command: valkey-server --appendonly yes, volumes: [valkey:/data] }
```

```text
# infra/Caddyfile
ourlore.tech {
  encode zstd gzip
  @api path /v1/* /api/auth/* /socket.io/*
  handle @api { reverse_proxy api:4000 }
  handle { reverse_proxy web:3000 }
}
mcp.ourlore.tech {
  reverse_proxy mcp:4100
}
```

The api image is `node:22-bookworm-slim` with `apt-get install -y ffmpeg`, multi-stage (`pnpm deploy --filter api --prod`). The web image uses Next.js `output: 'standalone'`.

### Deploy (`infra/deploy.sh`, run from either laptop)

1. `ssh lore@$VULTR_VM_IP 'cd lore && git fetch && git checkout main && git pull'`
2. `docker compose -f infra/docker-compose.yml build && docker compose -f infra/docker-compose.yml up -d`
3. `docker compose exec api node dist/scripts/db-setup.js` (push schema + run `packages/db/sql`)
4. `curl -fsS https://ourlore.tech/v1/ready` — checks database, Valkey, object storage, and a 1-token Muse Spark call.

Object Storage CORS (once): allow `PUT, GET` from `https://ourlore.tech` and `http://localhost:3000` with header `Content-Type`. Before the demo, take a Vultr VM snapshot and fork the prod Tiger service so a broken last-minute change can be rolled back in minutes.

## 15. Seed data, demo script and fallbacks

The demo runs live on three phones, each with LORE installed to the home screen and launched from its icon, mirrored to the projector (iPhone: QuickTime over USB; Android: scrcpy), against the seeded Weekend Crew, and every judging criterion gets one visible moment in three minutes. A judge can also scan a QR code and join the group as a guest, which proves the chat is real and multi-user.

### Seed world (`pnpm seed`, owned by C2-7)

| Persona | Login | Preferences seeded (stated, not inferred) | Device in demo |
| --- | --- | --- | --- |
| Ava (organizer, loves indie film) | ava@ourlore.tech | likes film, food trucks; budget flexible | Phone A (presenter) |
| Leo (student budget) | leo@ourlore.tech | budget ≤ $20 hard; likes games, late nights | Phone B (teammate) |
| Mia (artist, no car) | mia@ourlore.tech | travel ≤ 15 min hard; likes galleries, sketching | Phone C (mirrored to the projector) |
| Noor (bookworm, low-key) | noor@ourlore.tech | dislikes loud venues; likes books, cozy | Seeded only, can be driven from a 4th tab |
| Milo (AI member) | — | balanced initiative, history on, plans on, images on, region Austin (UT campus) | — |

Also seeded: two weeks of Weekend Crew history with three safe inside jokes stored as memories ("Gerald the cactus", "the 3 a.m. waffle quest", "the kayak incident"); Noor's birthday last Saturday with 6 real photos the team takes at HackTX (with everyone's consent) and a ready recap; a `@weekendcrew` group account with policy **threshold 3 of 4**; 12 personal posts and 4 group posts with Muse Image house-style art generated by `scripts/generate-seed-images.ts` (labeled AI); two other users for Find Friends matches; a family group "The Iqbals" with a few updates for the family-story moment; cached SerpAPI results for "Austin this weekend" refreshed by `pnpm seed:refresh-candidates` 1 hour before judging. `pnpm demo:reset` restores this exact state in under 2 minutes.

### Three-minute demo script

| Time | Who / device | Action | Criterion it proves |
| --- | --- | --- | --- |
| 0:00–0:15 | Presenter, Phone A on camera | "Feeds show us other people's lives. LORE helps you make more life with yours." Scroll Home: stories, a `@weekendcrew` post marked "Approved by 3 members". | Familiar, polished product |
| 0:15–0:45 | Leo on Phone B, Ava on Phone A | Leo types "we should do something saturday, i'm broke tho". Without any @mention, Milo replies in the AI bubble: "I have 3 ideas all four of you might like — want them?" Ava taps the quick-reply "yes". Point at "Why?" (reason + memory used). | AI is essential, not tagged |
| 0:45–1:30 | Both phones + projector | The plan card arrives: a free outdoor film screening (Source link), a gallery night 10 min from campus (Source), and a cozy watch-party + board-game night (at-home). Fit dots show Leo's budget and Mia's travel limit are respected. Leo votes film, Mia vetoes the gallery as "too far by bus" (privately), the tally updates live on the projector. Ava taps Refine "something with snacks"; version 2 swaps one tile. Ava press-and-holds **Confirm**. | Strengthens human connection: a real group decision |
| 1:30–2:05 | Phone C (Mia), mirrored | Jump to the seeded birthday: Milo's recap card with collage and Muse Image cover ("AI illustration" label); caption cites real chat moments. Mia taps "Propose to group account" → draft card "needs 3 of 4" → Ava and Leo approve on phones → third approval lands → post appears on `@weekendcrew`. Edit caption once first to show approvals reset. | Originality: co-owned identity + governed AI |
| 2:05–2:25 | Phone B | Leo starts One-Word Story; each player taps one of five words for two turns; the ending illustration renders from Muse Image. | Delight, Muse Image live |
| 2:25–2:45 | Phone A | Hold-to-record a voice note "bringing the waffle maker"; live captions stream, then the transcript attaches under Ava. Open the Muse app: "What's Weekend Crew doing Saturday?" Muse calls `list_group_plans` on ourlore.tech and answers with the confirmed plan. | Muse Voice + Muse agent connector |
| 2:45–3:00 | Presenter | One slide or the `/impact` page: all five Meta technologies + sponsors in use, honest status (Graph in dev mode with testers). "A chat became a plan. A plan became a memory. A memory became something the group made together. That's LORE." | Working demo, honesty |

Judge interaction (for longer table visits): show a QR on the laptop that opens `ourlore.tech/join/weekend-crew?code=…`, creating a guest account in the group for 2 hours (route `/join/[slug]`, built by C1 inside C1-4; guest accounts and their messages expire automatically); ask the judge to say what they want to do this weekend and watch Milo fold them into a new plan.

### Fallbacks

| Failure | Fallback |
| --- | --- |
| Venue Wi-Fi drops | Phone hotspot on a separate carrier; both phones already logged in |
| Meta API slow or rate-limited | Pre-warmed: the demo plan and recap were generated live 20 min earlier and are shown from the database; a live call is still attempted for the story image. Degraded results show the "degraded" chip; never present cached output as live |
| SerpAPI quota exhausted | Cached candidates from the last refresh, with their real source links and "verified N h ago" |
| Muse app connector fails | MCP Inspector on the laptop calling the same tools against `mcp.ourlore.tech` |
| Facebook Login blocked for a judge | Email login; Graph shown with a Tester account |
| Everything is down | 3-minute screen recording of the full demo (recorded at H21), clearly called a recording |

### Submission checklist (Devpost)

- Select the Meta track and every sponsor prize the project uses: SerpAPI, Gemini, Tiger Data, Snowflake, Vultr, .TECH domain, Solana (only if keepsakes shipped), SpaceXSI raffle.
- Include a "How we used each technology" section mirroring section 2 of this plan, with screenshots.
- Link the live site, the repo, and the backup video; list demo logins.
- Publish a short DEV post for the DEV Writing Challenge after submission.

## 16. Testing, QA and definition of done

Tests target the rules that would embarrass the demo or break the spec's promises (approval policies, the podcast gate, anonymous votes, AI honesty), not coverage numbers. Every test runs in `AI_MODE=mock` so CI never spends credits.

### Required unit tests (Vitest)

| Owner | File | Cases |
| --- | --- | --- |
| Shared | `packages/shared/src/policy.test.ts` | `mayPublish` for direct, courtesy, threshold (below, at, above), unanimous (one missing, all present), stale version, non-eligible voter, AI-created draft under direct; `canFinishPodcast` with not wrapped, one missing participant, all engaged |
| C1 | `groups/service.test.ts` | edit bumps version and voids approvals; concurrent last approvals publish once; removed member's approval ignored |
| C1 | `games/engine.test.ts` | five choices per turn exactly; chosen word immutable; random fallback with fewer than 3 memories; meme vote anonymity in caller-filtered state; self-vote blocked; abandoned game publishes nothing |
| C1 | `chat/service.test.ts` | idempotent send with the same clientId; non-member gets 403; hidden-history members' text excluded from AI context builder |
| C2 | `persona/gates.test.ts` | quiet hours, mute, budget, 10-minute spacing, named-mention override, news without candidate forces silence |
| C2 | `plans/filter.test.ts` | budget and travel hard constraints remove candidates; unknown price flagged; maximin ordering; at least one at-home option; ranking ids outside the candidate set dropped |
| C2 | `memories/compose.test.ts` | excluded media never appear; `factsUsed` without a valid message id rejected |
| C2 | `mcp/tools.test.ts` | revoked token 401; write without `confirm` rejected; vote recorded as the token's user only |
| C2 | `ai/structured.test.ts` | invalid JSON triggers one repair then the mock fallback with `degraded: true` |

### End-to-end smoke (`pnpm e2e:smoke`, Playwright, two browser contexts)

1. Ava and Leo log in (seeded); both open Weekend Crew.
2. Leo sends the plan message; within 15 s a `plan_card` appears in both contexts (mock mode is instant).
3. Leo votes, Ava sees the tally change; Ava confirms; both see `plan_confirmed`.
4. Ava opens the seeded recap, proposes it to `@weekendcrew`; Leo approves; a third seeded approval is injected via API; the post appears on `/g/weekendcrew`.
5. Ava uploads a fixture voice note; a transcript appears under Ava.
6. An MCP client (SDK in the test) calls `list_group_plans` with a test PAT and gets the confirmed plan.

### Negative and privacy checks (from the master spec section 64)

- Private account posts never appear for non-followers (feed, profile, explore, search).
- A Pictionary spectator's `game.state` never contains the prompt.
- Milo never quotes a message from another conversation (two-group test).
- Common Ground reasons never contain text from private chats (matching uses only profile tags).
- Plan cards never show a venue without a source link, and never show another member's private preference text.
- Family stories stay private until a separate approved draft exists.
- Deleting a memory or revoking Facebook stops its future use.

### Performance budgets

| Metric | Budget |
| --- | --- |
| Message delivery, sender to other device | < 500 ms p95 on venue Wi-Fi |
| Home first contentful paint on a mid-range phone | < 2.0 s |
| Milo decision to message (live) | < 8 s including typing delay |
| Plan card from trigger (live) | < 20 s, with a "Milo is looking…" placeholder card at 1 s |
| Voice note transcript (20 s clip) | < 6 s after upload |

### Definition of done for the demo build (tick at H22)

- [ ] All P0 acceptance lines in section 8 pass on https://ourlore.tech
- [ ] `pnpm e2e:smoke` passes against prod
- [ ] All five Meta technologies produce a live result on prod (Spark reply, Image render, Voice transcript, Muse connector call, Facebook Login)
- [ ] Every AI output shows the AI label; every venue shows a source; mocked or cached items show their chip
- [ ] Light and dark mode reviewed on phone and desktop; no layout overflow at 360 px width
- [ ] Unfinished features are flag-off, not broken
- [ ] `pnpm demo:reset` tested twice; seed photos have everyone's consent
- [ ] Vultr snapshot and Tiger fork taken; backup video recorded
- [ ] Devpost submitted with every sponsor track selected

* [ ] Section 9.7 native-feel acceptance passes on one iPhone and one Android phone, launched from the home-screen icon, side by side with Instagram
* [ ] LORE is installed on every demo phone and the screen mirroring to the projector is tested in the actual room

## 17. Risks, mitigations and sources

The biggest risks are external access (Meta model ids, credits, the Muse app, Graph permissions) and two agents drifting apart; both are handled by verifying access at H0, isolating every provider behind `packages/ai`, and merging three times on fixed rules.

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| Muse model ids or endpoint details differ from this plan | Medium | `GET /v1/models` at H0 sets env vars; only `packages/ai` knows endpoints; `pnpm ai:smoke` proves every call before features depend on it |
| $50 Meta credit runs out | Low | Section 7 budgets; `reasoning_effort` minimal for chat; images cost about $0.01; dev uses mock mode |
| Muse realtime voice drops the stream | Medium | Proxy paces 80 ms frames, sends silence during pauses, sends `endStream`; batch transcription is the authoritative transcript |
| Muse app unavailable on the demo phone (US-only, adult, card on file) | Medium | Set up the connector the night before; MCP Inspector fallback hits the same server |
| Facebook permissions refused or app review needed | Low in dev mode | Every demo account is an app Tester; email login always works; consent screen explains scopes |
| Milo feels spammy or creepy | Medium | Two-stage gate, budgets, thresholds, quiet hours, "Why?", mute, disclosure message, no high-sensitivity memories |
| AI invents a venue, price, or memory | Medium | Candidates only from SerpAPI rows; server drops ids not in input; Source labels; `factsUsed` citations |
| SerpAPI 1,000-credit cap | Low | 6-hour cache per query, at most 4 queries per plan, seeded candidate refresh before judging |
| Snowflake PAT blocked by network policy | Medium | Trial account with admin role; add the Vultr VM IP to the policy at provisioning; impact page reads cached aggregates if sync fails |
| Tiger Free Plan limits (no pooler, small instance) | Low | Pool `max: 5` per process; compression policy; fork before every prod push |
| Scope explosion | High | P0/P1/P2 tiers, feature flags, cut lines in section 11 |
| Branches diverge or conflict | Medium | Folder ownership, scaffold-created stubs, additive-only shared files, merge rules M1–M7, three checkpoints |
| Coding agent ignores the plan | Medium | Prompts force a full read of `docs/IMPLEMENTATION_PLAN.md`, per-task "Done when" columns, checkpoint stops |
| Demo network fails | Medium | Hotspot, pre-warmed data, labeled degraded mode, backup video |
| Photos of real people without consent | Low | Only teammates' photos with consent; Muse Image never edits faces unless every owner opted in |

### Sources

Checked October 24, 2026; verify again at H0 because these products changed often in 2026.

- [Meta Model API docs: Speech to text](https://dev.meta.ai/docs/speech-to-text) — realtime and batch endpoints, handshake, pacing, pricing
- [Meta Model API docs overview](https://dev.meta.ai/docs/overview)
- [Build with Muse Spark on Meta Model API](https://developer.meta.com/ai/resources/blog/build-with-muse-spark/) — OpenAI-compatible base URL and model id
- [Build with Muse Image](https://developer.meta.com/ai/resources/blog/build-with-muse-Image/) — `/v1/images/generations`, `/v1/images/edits`, `muse-image-1.0`, $0.01/image
- [LiteLLM: Meta Model API provider](https://docs.litellm.ai/docs/providers/meta) — `muse-spark-1.1` capabilities, `reasoning_effort` values, voice model id
- [promptfoo: Meta Model API provider](https://www.promptfoo.dev/docs/providers/meta/) — Responses, Chat Completions, and Messages surfaces
- [Parallel: Meta Muse custom integrations](https://parallel.ai/articles/meta-muse-custom-integrations) — Muse custom connectors over MCP streamable HTTP, credential store, availability
- [Postiz: Meta Muse connectors explained](https://postiz.com/blog/meta-muse-ai-connectors-schedule-social-media-posts)
- [Facebook Login: handling declined permissions](https://developers.facebook.com/documentation/facebook-login/guides/permissions/handle-declined)
- [MLH: HackTX 26 prizes](https://www.mlh.com/events/hacktx-26/prizes) — the eight sponsor categories
- [Tiger Data: Free Plan announcement](https://www.tigerdata.com/blog/introducing-agentic-postgres-free-plan-experiment-ai-on-postgres) — 2 free services, pgvectorscale, hypertables, forks
- [MLH: Build with Tiger Data](https://www.mlh.com/partners/tigerdata)
- [Snowflake: Cortex REST API](https://docs.snowflake.com/user-guide/snowflake-cortex/cortex-rest-api) — chat completions endpoint and PAT auth
- [Google Cloud: Gemini model versions](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/model-versions) — `gemini-embedding-001`, Gemini 2.5 retirement on October 16, 2026
- [SerpAPI: Google Local API](https://serpapi.com/google-local-api) and [SerpAPI Python library](https://pypi.org/p/serpapi) — engines `google_events`, `google_maps`, `google_local`

## 18. Implementation notes (deviations recorded during the build)

Kept in sync with `docs/PROJECT_CONTEXT_LOG.md`. Each line: date · task · change · reason.

- 2026-10-24 · C1-0a · Repo is `hamizfaraz/lore` (private). Teammate must still be added as collaborator by a human.
- 2026-10-24 · C1-0b · zod 4 (fastify-type-provider-zod ≥6 requires it; MCP SDK and Better Auth support it).
- 2026-10-24 · C1-0b · `mayPublish`: AI drafts under `direct`/`courtesy` publish once ≥1 valid approval exists (matches 8.4 acceptance; the section 8.4 snippet never allowed it).
- 2026-10-24 · C1-0b · Extra C1 tables `post_likes`, `post_saves`, `push_subscriptions`, `user_wallets` and extra columns listed in the context log (state the section 5 tables could not hold).
- 2026-10-24 · C1-0b · Message idempotency: plain index on `(conversation_id, client_id)` + Valkey key, because hypertable unique indexes must include `created_at`.
- 2026-10-24 · C1-0b · Dev-only tooling added: `tsx`, `tsup`, `dotenv-cli` (reason in HANDOFF).
- 2026-10-24 · C1-0b · PWA icons/splash generated with a sharp script (`apps/web/scripts/generate-icons.mjs`) instead of `pwa-asset-generator` (headless Chrome unavailable).
- 2026-10-24 · C1-0b · Added routes `/p/[id]` (post detail) and `/offline` (SW fallback) [C1]. Profile tab root is `/u/<own handle>`.
- 2026-10-24 · C1-0b · `@lore/ai` scaffold index exports typed stubs `games.{getPrompts,fiveWordChoices,storyTitle,storyImage,memeEntry,memeImage}` and `guard()`; C2 keeps these signatures.
- 2026-10-24 · C1-2 · Dev without Vultr credentials stores media on disk (`LOCAL_MEDIA_DIR`) behind HMAC-signed expiring URLs served by the api; production uses presigned S3 exactly as planned.
- 2026-10-24 · C1-5 · `post_drafts.target` ('post'|'story') added so group stories go through `story_mode`.
- 2026-10-24 · C1-5 · A human author's submit counts as their own approval of that version; editing voids all approvals (incl. the author's). Effective voters = snapshot voters still active and eligible (removed/publishing-muted members stop counting).
- 2026-10-24 · C1-10 · Added `GET /graph/connections`, `POST /graph/suggestions`, `POST /graph/disconnect` (section 6 only listed `POST /graph/import`). Disconnect also deletes the Better Auth `account` row for provider `facebook` so the token cannot be reused; email login is unchanged. Friends match in both directions (my friend list, or theirs listing me) because `user_friends` only returns people who already authorized the app. On disconnect, C1 strips the imported tag strings from C2's `interest_profiles` until C2 owns that cleanup (see HANDOFF).
- 2026-10-24 · C1-12 · Unique index `keepsakes_recap_uq` on `recap_id` (one mint per recap). User wallets store the pubkey only; the secret is discarded. Devnet SOL is airdropped on mint when the vault is under 0.05 SOL, not only at deploy. `mpl-core` peers `@noble/hashes` 1.x while Better Auth pulls 2.x (no `./sha3`), so `apps/api` depends on `@noble/hashes@1.8.0` and the root `pnpm.overrides` pins that peer for mpl-core. The "Make it a keepsake" button is `features/keepsakes/KeepsakeButton`; the recap card is C2's, so placement is a HANDOFF. Flag stays off until `FEATURE_KEEPSAKES=1`.
