# LORE product demo video

The repository includes a directed Playwright walkthrough that records the whole product story at
1280×720 in under three minutes. It uses the deterministic rich demo world, local media, mock AI,
compact feature captions, click ripples, smooth scrolling, and a visible eased cursor. Navigation
stays inside the running app, so the recording has no loading-screen pauses or full-screen title cards.

## Record it

Start the local PostgreSQL and Valkey services, then run:

```bash
pnpm demo:record
```

The command safely refuses to reset a non-local database. By default it uses:

```text
postgres://postgres:postgres@127.0.0.1:5432/lore
```

To use a different local database:

```bash
LORE_DEMO_DATABASE_URL='postgres://user:password@localhost:5432/lore' pnpm demo:record
```

The recorder will:

1. Materialize the demo photos and reels if they are missing.
2. Reset the deterministic demo dataset.
3. Start the API, background worker, MCP endpoint, and web app with every feature flag enabled.
4. Sign in as Ava and run the complete directed tour.
5. Save the original Playwright recording and make a shareable MP4 with the best available local
   H.264/MPEG-4 encoder.

Finished files are written to:

```text
artifacts/demo-video/lore-product-demo.webm
artifacts/demo-video/lore-product-demo.mp4
```

The recording is deterministic and can be regenerated at any time. The tour itself lives in
`e2e/demo-video.spec.ts`; its server and video settings live in `e2e/demo-video.config.ts`.
The verified reference recording is 2:05, leaving 55 seconds of headroom under a three-minute limit.

## What the tour shows

- Login, feed, stories, reactions, Explore, search, Reels, and the post/story/reel composer
- Personal profiles, shared group profiles, inbox, group chat, voice notes, media, and AI help
- In-chat games, fair plan suggestions, voting preferences, confirmed events, and private constraints
- Consent-aware memory recaps, editing, sharing, and optional Solana devnet keepsakes
- AI member personality, initiative, quiet hours, permissions, boundaries, memory controls, and preview
- Opt-in Common Ground matching and editable introductions
- Source-reviewed Family Stories with contributor control
- Asynchronous podcast stations with cast completion gates
- Group roles, publishing policy, approvals, and shared-account governance
- Scoped Muse/MCP connection keys and the aggregate privacy-safe impact dashboard

No paid AI key is needed. The recording runs against the local mock provider and seeded local media.
