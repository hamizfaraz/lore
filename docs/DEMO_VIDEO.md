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
The verified group-first reference recording is 1:46, leaving more than a minute of headroom under a
three-minute limit.

## Record the games-focused cut

To keep the same group-first story while spending more time on the games, run:

```bash
pnpm demo:record:games
```

This alternate cut compares One-Word Story, Meme Battle, and Pictionary; selects group-lore prompts;
opens an opt-in lobby; plays three real One-Word Story turns; and reopens the attached group chat. It
writes separate files so the standard group-first recording is not replaced:

```text
artifacts/demo-video/lore-games-demo.webm
artifacts/demo-video/lore-games-demo.mp4
```

The verified games-focused recording is 2:15 at 1280×720, leaving 45 seconds of headroom under the
three-minute limit.

## Record the games cut with the refreshed UI

After the `feat/ui-refresh` merge, the same games-focused walkthrough can be written to a separate
artifact with:

```bash
LORE_DEMO_GAMES_FOCUS=1 LORE_DEMO_OUTPUT=lore-games-ui-refresh pnpm demo:record
```

Finished files are written to:

```text
artifacts/demo-video/lore-games-ui-refresh.webm
artifacts/demo-video/lore-games-ui-refresh.mp4
```

The verified refreshed-UI recording is 2:16 at 1280×720. It preserves the group-first narrative and
expanded games chapter while showing the refreshed card architecture, navigation, spacing, and communal
design tokens.

## What the tour shows

- Login and a group-first feed where shared posts are visibly authored by `@weekendcrew`
- The Weekend Crew profile and a real **Post as group → Submit for approval** composer flow
- Group inbox, chat, voice notes, media, and the central Details hub for group features
- In-chat games (with a deeper playable sequence in the games-focused cut), fair plan suggestions,
  voting preferences, confirmed events, and private constraints
- Consent-aware memory recaps that can become governed group posts, plus optional Solana devnet keepsakes
- AI member personality, initiative, quiet hours, permissions, boundaries, memory controls, and preview
- Asynchronous podcast stations with cast completion gates
- Group roles, publishing policy, approvals, and shared-account governance
- Scoped Muse/MCP connection keys and the aggregate privacy-safe impact dashboard

Explore, Reels, personal-profile discovery, and other individual-first surfaces are intentionally left out
of this cut so the demo stays focused on LORE's main differentiator: groups acting together.

No paid AI key is needed. The recording runs against the local mock provider and seeded local media.
