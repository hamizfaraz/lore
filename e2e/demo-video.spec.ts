import { expect, type Locator, type Page, test } from '@playwright/test';

const WEEKEND = '00000000-0000-7000-8000-000000000201';
const RECAP = '00000000-0000-7000-8000-000000000505';
const PODCAST = '00000000-0000-7000-8000-000000000901';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

class Director {
  private cursor = { x: 88, y: 650 };

  constructor(private readonly page: Page) {}

  async mount() {
    await this.page.evaluate(() => {
      if (document.querySelector('#lore-demo-stage')) return;
      const style = document.createElement('style');
      style.id = 'lore-demo-style';
      style.textContent = `
        nextjs-portal { display: none !important; }
        #lore-demo-stage { position: fixed; inset: 0; z-index: 2147483600; pointer-events: none; font-family: Inter, ui-sans-serif, system-ui, -apple-system, sans-serif; }
        #lore-demo-cursor { position: fixed; left: 0; top: 0; width: 22px; height: 22px; transform: translate3d(88px,650px,0); transition: transform 28ms linear; filter: drop-shadow(0 3px 6px rgba(0,0,0,.32)); }
        #lore-demo-cursor::before { content: ''; position: absolute; inset: 0; border-radius: 999px; background: rgba(255,255,255,.94); border: 2px solid rgba(17,24,39,.92); }
        #lore-demo-cursor::after { content: ''; position: absolute; left: 7px; top: 7px; width: 8px; height: 8px; border-radius: 999px; background: #7c3aed; }
        #lore-demo-chapter { position: fixed; inset: 0; display: grid; place-items: center; padding: 80px; color: white; background: radial-gradient(circle at 72% 18%, rgba(124,58,237,.34), transparent 34%), linear-gradient(135deg, #111014, #1c1625 55%, #0b0a0d); opacity: 0; transform: scale(1.018); transition: opacity .42s ease, transform .7s cubic-bezier(.22,1,.36,1); }
        #lore-demo-chapter.show { opacity: 1; transform: scale(1); }
        #lore-demo-chapter .inner { max-width: 880px; text-align: center; }
        #lore-demo-chapter .mark { display: inline-flex; align-items: center; gap: 9px; font-size: 13px; font-weight: 800; letter-spacing: .18em; text-transform: uppercase; color: #c4b5fd; }
        #lore-demo-chapter .mark::before { content: ''; width: 28px; height: 2px; background: #8b5cf6; border-radius: 2px; }
        #lore-demo-chapter h2 { margin: 20px 0 10px; font-family: Georgia, ui-serif, serif; font-size: clamp(44px, 6vw, 76px); line-height: .98; letter-spacing: -.045em; }
        #lore-demo-chapter p { margin: 0 auto; max-width: 720px; color: rgba(255,255,255,.76); font-size: 20px; line-height: 1.48; }
        #lore-demo-caption { position: fixed; right: 34px; bottom: 30px; width: 390px; padding: 18px 20px; border-radius: 18px; color: #18131f; background: rgba(255,255,255,.94); border: 1px solid rgba(124,58,237,.14); box-shadow: 0 22px 70px rgba(18,13,28,.24); backdrop-filter: blur(18px); opacity: 0; transform: translateY(18px); transition: opacity .32s ease, transform .46s cubic-bezier(.22,1,.36,1); }
        #lore-demo-caption.show { opacity: 1; transform: translateY(0); }
        #lore-demo-caption .kicker { color: #7c3aed; font-size: 11px; font-weight: 850; letter-spacing: .15em; text-transform: uppercase; }
        #lore-demo-caption h3 { margin: 7px 0 5px; font-size: 20px; line-height: 1.15; letter-spacing: -.02em; }
        #lore-demo-caption p { margin: 0; color: #625a6d; font-size: 13px; line-height: 1.4; }
        #lore-demo-focus { position: fixed; display: none; border: 2px solid rgba(124,58,237,.9); border-radius: 16px; box-shadow: 0 0 0 5px rgba(124,58,237,.12), 0 12px 40px rgba(40,25,72,.18); transition: all .45s cubic-bezier(.22,1,.36,1); }
        .lore-demo-ripple { position: fixed; width: 18px; height: 18px; margin: -9px; border: 2px solid rgba(124,58,237,.8); border-radius: 999px; animation: lore-demo-ripple .58s ease-out forwards; }
        @keyframes lore-demo-ripple { to { opacity: 0; transform: scale(3.2); } }
      `;
      document.head.append(style);
      const stage = document.createElement('div');
      stage.id = 'lore-demo-stage';
      stage.innerHTML = `
        <div id="lore-demo-chapter"><div class="inner"><div class="mark">LORE</div><h2></h2><p></p></div></div>
        <div id="lore-demo-caption"><div class="kicker"></div><h3></h3><p></p></div>
        <div id="lore-demo-focus"></div>
        <div id="lore-demo-cursor"></div>
      `;
      document.body.append(stage);
    });
    this.cursor = { x: 88, y: 650 };
  }

  async chapter(title: string, subtitle: string, hold = 1450) {
    await this.mount();
    await this.page.evaluate(
      ({ title, subtitle }) => {
        const card = document.querySelector('#lore-demo-chapter')!;
        card.querySelector('h2')!.textContent = title;
        card.querySelector('p')!.textContent = subtitle;
        card.classList.add('show');
      },
      { title, subtitle },
    );
    await sleep(hold);
    await this.page.evaluate(() => document.querySelector('#lore-demo-chapter')?.classList.remove('show'));
    await sleep(520);
  }

  async caption(kicker: string, title: string, body: string, hold = 1500) {
    await this.mount();
    await this.page.evaluate(
      ({ kicker, title, body }) => {
        const card = document.querySelector('#lore-demo-caption')!;
        card.querySelector('.kicker')!.textContent = kicker;
        card.querySelector('h3')!.textContent = title;
        card.querySelector('p')!.textContent = body;
        card.classList.add('show');
      },
      { kicker, title, body },
    );
    await sleep(hold);
  }

  async hideCaption() {
    await this.page.evaluate(() => document.querySelector('#lore-demo-caption')?.classList.remove('show'));
    await sleep(360);
  }

  async visit(path: string, title: string, subtitle: string, ready: Locator) {
    await this.page.goto(path, { waitUntil: 'domcontentloaded' });
    await expect(ready).toBeVisible();
    await this.mount();
    await sleep(500);
    await this.chapter(title, subtitle);
  }

  async moveTo(locator: Locator, padding = 0) {
    await locator.scrollIntoViewIfNeeded();
    const box = await locator.boundingBox();
    if (!box) throw new Error('The demo cursor target is not visible.');
    const target = {
      x: Math.round(box.x + box.width / 2 + padding),
      y: Math.round(box.y + box.height / 2),
    };
    const start = { ...this.cursor };
    const distance = Math.hypot(target.x - start.x, target.y - start.y);
    const steps = Math.max(12, Math.min(34, Math.round(distance / 24)));
    for (let index = 1; index <= steps; index += 1) {
      const progress = index / steps;
      const eased = 1 - (1 - progress) ** 3;
      const x = start.x + (target.x - start.x) * eased;
      const y = start.y + (target.y - start.y) * eased;
      await this.page.mouse.move(x, y);
      await this.page.evaluate(
        ({ x, y }) => {
          const cursor = document.querySelector<HTMLElement>('#lore-demo-cursor');
          if (cursor) cursor.style.transform = `translate3d(${x - 11}px,${y - 11}px,0)`;
        },
        { x, y },
      );
      await sleep(14);
    }
    this.cursor = target;
  }

  async focus(locator: Locator) {
    await locator.scrollIntoViewIfNeeded();
    const box = await locator.boundingBox();
    if (!box) return;
    await this.page.evaluate(({ x, y, width, height }) => {
      const focus = document.querySelector<HTMLElement>('#lore-demo-focus');
      if (!focus) return;
      focus.style.display = 'block';
      focus.style.left = `${x - 7}px`;
      focus.style.top = `${y - 7}px`;
      focus.style.width = `${width + 14}px`;
      focus.style.height = `${height + 14}px`;
    }, box);
  }

  async clearFocus() {
    await this.page.evaluate(() => {
      const focus = document.querySelector<HTMLElement>('#lore-demo-focus');
      if (focus) focus.style.display = 'none';
    });
  }

  async click(locator: Locator) {
    await this.moveTo(locator);
    await this.page.evaluate(({ x, y }) => {
      const ripple = document.createElement('div');
      ripple.className = 'lore-demo-ripple';
      ripple.style.left = `${x}px`;
      ripple.style.top = `${y}px`;
      document.querySelector('#lore-demo-stage')?.append(ripple);
      setTimeout(() => ripple.remove(), 700);
    }, this.cursor);
    await locator.click();
    await sleep(420);
  }

  async type(locator: Locator, value: string, delay = 32) {
    await this.moveTo(locator);
    await locator.click();
    await locator.fill('');
    await locator.pressSequentially(value, { delay });
    await sleep(300);
  }

  async scrollPage(y: number, hold = 900) {
    await this.page.evaluate((top) => window.scrollTo({ top, behavior: 'smooth' }), y);
    await sleep(hold);
  }

  async scrollElement(locator: Locator, y: number, hold = 900) {
    await locator.evaluate((element, top) => element.scrollTo({ top, behavior: 'smooth' }), y);
    await sleep(hold);
  }
}

test('cinematic full-product walkthrough', async ({ page }) => {
  test.slow();
  const d = new Director(page);

  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'lore' })).toBeVisible();
  await d.mount();
  await d.chapter(
    'Meet LORE',
    'A private social space that helps real groups stay close and do more together.',
    2100,
  );
  await d.type(page.getByPlaceholder('Email'), 'ava.demo@ourlore.test', 24);
  await d.type(page.getByPlaceholder('Password'), 'password123', 35);
  await Promise.all([
    page.waitForURL((url) => url.pathname === '/', { timeout: 25_000 }),
    d.click(page.getByRole('button', { name: 'Log in' })),
  ]);
  await expect(page.getByRole('link', { name: 'Home' })).toBeVisible();
  await d.mount();
  await d.chapter(
    'Your people, in one place',
    'Stories and posts from friends and groups—without an algorithm pulling you away from them.',
  );
  await expect(page.locator('article[aria-label^="Post by"]').first()).toBeVisible();
  await d.caption(
    'FEED + STORIES',
    'A calmer social feed',
    'Catch up with people, respond to stories, and interact with familiar posts.',
  );
  const firstLike = page.getByRole('button', { name: 'Like' }).first();
  if (await firstLike.isVisible().catch(() => false)) await d.click(firstLike);
  await d.scrollPage(470, 1050);
  await d.scrollPage(0, 850);
  await d.hideCaption();

  await d.visit(
    '/explore',
    'Discover what matters',
    'Search across people, group accounts, and shared posts—or find friends already on LORE.',
    page.getByPlaceholder('Search'),
  );
  await d.caption(
    'EXPLORE',
    'Search with context',
    'A visual discovery grid and people search, with privacy-respecting paths into new connections.',
  );
  await d.type(page.getByPlaceholder('Search'), 'weekend', 55);
  await sleep(1000);
  await d.hideCaption();

  await d.visit(
    '/reels',
    'Reels, kept social',
    'Short video lives beside the rest of your relationships instead of becoming the whole experience.',
    page.getByText('Reels', { exact: true }).first(),
  );
  await d.caption(
    'REELS',
    'Full-screen, familiar, fast',
    'Vertical playback, reactions, comments, sharing, and saving are all here.',
  );
  const reelScroller = page.locator('[data-scroll]').first();
  if (await reelScroller.isVisible().catch(() => false)) await d.scrollElement(reelScroller, 720, 1150);
  await d.hideCaption();

  await d.visit(
    '/create',
    'Create once, share your way',
    'Publish a post, add to your story, or make a reel from one consistent composer.',
    page.getByRole('heading', { name: 'New post' }),
  );
  await d.caption(
    'CREATE',
    'Posts, stories, and reels',
    'The same flow also supports group identities and approval-aware publishing.',
  );
  await page.getByRole('button', { name: 'STORY' }).evaluate((button: HTMLElement) => button.click());
  await sleep(700);
  await page.getByRole('button', { name: 'REEL' }).evaluate((button: HTMLElement) => button.click());
  await sleep(700);
  await d.hideCaption();

  await d.visit(
    '/u/avachen',
    'Profiles feel like people',
    'Posts, reels, tagged media, shared groups, and direct messaging live on a familiar profile.',
    page.getByRole('button', { name: 'avachen' }),
  );
  await d.caption(
    'PERSONAL PROFILE',
    'Identity with useful context',
    'A profile shows who someone is and which shared spaces connect you.',
  );
  await d.scrollPage(270, 900);
  await d.hideCaption();

  await d.visit(
    '/g/weekendcrew',
    'Groups can have a voice',
    'A shared profile lets a group publish together while preserving clear authorship and approval rules.',
    page.getByRole('button', { name: 'Members' }),
  );
  await d.caption(
    'GROUP PROFILE',
    'Shared identity, shared control',
    'Group posts remain visibly collective—and members keep control over what represents them.',
  );
  await d.hideCaption();

  await d.visit(
    '/inbox',
    'Conversation is the center',
    'Direct messages and group chats connect the social surface to actual relationships.',
    page.getByText('Requests', { exact: true }),
  );
  await d.caption(
    'INBOX',
    'People and groups, together',
    'Search active threads, see unread conversations, and start a new message.',
  );
  const firstThread = page.locator('a[href^="/c/"]').first();
  if (await firstThread.isVisible().catch(() => false)) await d.focus(firstThread);
  await sleep(900);
  await d.clearFocus();
  await d.hideCaption();

  await d.visit(
    `/c/${WEEKEND}`,
    'A chat that can do more',
    'Messages, photos, voice notes, AI help, plans, memories, and games all stay inside the group.',
    page.getByRole('textbox', { name: 'Message' }),
  );
  await d.caption(
    'GROUP CHAT',
    'Conversation becomes action',
    'Write a message, hold for a voice note, share media, or ask the group’s AI member for help.',
  );
  await d.type(page.getByRole('textbox', { name: 'Message' }), 'Who is free Saturday?', 46);
  await page.getByRole('textbox', { name: 'Message' }).fill('');
  await d.moveTo(page.getByRole('button', { name: 'Hold to record a voice note' }));
  await sleep(700);
  await d.hideCaption();

  await d.visit(
    `/c/${WEEKEND}?games=1`,
    'Play without leaving the chat',
    'Start a shared story, meme battle, or Pictionary lobby using group lore or fresh prompts.',
    page.getByText('Play a game', { exact: true }),
  );
  await d.caption(
    'GROUP GAMES',
    'Built for the people already here',
    'Choose a format, tune the pace, and invite friends without auto-enrolling anyone.',
  );
  await d.click(page.getByRole('button', { name: /Meme Battle/ }));
  await sleep(850);
  await d.hideCaption();

  await d.visit(
    `/c/${WEEKEND}/plans`,
    'Make plans that fit everyone',
    'LORE compares sourced options, honors private constraints, and lets every member vote independently.',
    page.getByRole('heading', { name: 'What should we do?' }),
  );
  await d.caption(
    'FAIR PLANNING',
    'From “we should” to a real plan',
    'Suggestions explain their fit, votes stay independent, and confirmation creates a shared event.',
  );
  await d.click(page.getByRole('button', { name: 'Plan preferences' }));
  await expect(page.getByText('Your plan preferences', { exact: true })).toBeVisible();
  await sleep(1100);
  await page.keyboard.press('Escape');
  await d.hideCaption();

  await d.visit(
    `/c/${WEEKEND}/memories`,
    'Shared moments become memories',
    'Private recaps use only consented group media and remain unpublished until the group is ready.',
    page.getByRole('heading', { name: /Turn shared moments/ }),
  );
  await d.caption(
    'MEMORIES',
    'Private by default',
    'LORE can arrange recent moments into an editable recap, a story, or an optional on-chain keepsake.',
  );
  await d.scrollPage(520, 1000);
  await d.hideCaption();

  await d.visit(
    `/recap/${RECAP}`,
    'Edit before you share',
    'Every recap keeps its source media visible, removable, and under the group’s normal approval workflow.',
    page.getByText('Recap editor', { exact: true }),
  );
  await d.caption(
    'RECAP EDITOR',
    'Consent stays attached',
    'Choose a layout, edit the story, save privately, share to chat, or make a Solana devnet keepsake.',
  );
  await d.scrollPage(560, 1050);
  const keepsake = page.getByRole('button', { name: 'Make it a keepsake' });
  if (await keepsake.isVisible().catch(() => false)) await d.focus(keepsake);
  await sleep(850);
  await d.clearFocus();
  await d.hideCaption();

  await d.visit(
    `/c/${WEEKEND}/ai`,
    'An AI member the group controls',
    'Name it, shape its tone, set quiet hours, limit permissions, inspect memories, or remove it entirely.',
    page.getByRole('heading', { name: 'Milo' }),
  );
  await d.caption(
    'AI MEMBER',
    'Useful, labeled, and bounded',
    'The group controls initiative, source access, location, images, and the exact boundaries it must respect.',
  );
  await d.scrollPage(650, 1100);
  await d.hideCaption();
  await d.scrollPage(1800, 1100);
  const preview = page.getByRole('button', { name: 'Preview' });
  if (await preview.isVisible().catch(() => false)) {
    await d.click(preview);
    await expect(page.getByText('AI assistant', { exact: true }).first()).toBeVisible();
    await d.caption(
      'SAFE PREVIEW',
      'Try the personality first',
      'Three labeled examples show how the AI would respond without joining the chat or writing memory.',
    );
    await d.hideCaption();
  }

  await d.visit(
    '/find-friends?tab=together',
    'Meet through Common Ground',
    'Opt-in matching uses interests and public activity—not private chats—to explain why people may click.',
    page.locator('a:visible').filter({ hasText: 'Discover Together' }).first(),
  );
  await d.caption(
    'COMMON GROUND',
    'Discovery with an explanation',
    'Shared interests create a reason and an editable introduction; nothing is sent without your action.',
  );
  await d.scrollPage(250, 1000);
  await d.hideCaption();

  await d.visit(
    `/family/${WEEKEND}`,
    'Turn consented history into a story',
    'Pick a date range, review every source, and generate a grounded private narrative.',
    page.getByRole('heading', { name: 'Turn consented history into a story' }),
  );
  await d.caption(
    'FAMILY STORY',
    'Sources first, generation second',
    'Contributors keep control of their own messages, and unresolved corrections block sharing.',
  );
  await d.click(page.getByRole('button', { name: 'Review source material' }));
  await expect(page.getByText('Source review', { exact: true })).toBeVisible();
  await sleep(1300);
  await d.scrollPage(470, 950);
  await d.hideCaption();

  await d.visit(
    `/podcast/${PODCAST}`,
    'A podcast made in pieces',
    'Each cast member records one twenty-second voice clip; LORE assembles the episode only when everyone is in.',
    page.getByText('Voice-only group show', { exact: true }),
  );
  await d.caption(
    'PODCAST STATIONS',
    'Asynchronous, but still together',
    'Branch topics, visible attribution, transcript status, and a hard all-cast completion gate keep it accountable.',
  );
  await d.scrollPage(450, 1100);
  await d.hideCaption();

  await d.visit(
    `/c/${WEEKEND}/settings#group-account`,
    'Publishing without losing trust',
    'Roles and approval policies decide how a shared group account speaks in public.',
    page.getByText('Publishing policy', { exact: true }),
  );
  await d.caption(
    'GROUP GOVERNANCE',
    'No mystery admin behavior',
    'Choose direct publishing, a vote threshold, unanimous approval, or a courtesy review.',
  );
  const approvals = page.getByRole('button', { name: /Approvals/ });
  if (await approvals.isVisible().catch(() => false)) await d.focus(approvals);
  await sleep(900);
  await d.clearFocus();
  await d.hideCaption();

  await d.visit(
    '/settings/muse',
    'Bring LORE into Muse',
    'Create a scoped connection key so Muse can read context or prepare actions with explicit confirmation.',
    page.getByRole('heading', { name: 'Use LORE from Muse' }),
  );
  await d.caption(
    'CONNECT MUSE',
    'Capabilities stay scoped',
    'Read access is mandatory; voting, proposals, games, and introductions are granted separately and can be revoked.',
  );
  const proposalScope = page.getByText('Create proposals', { exact: true });
  if (await proposalScope.isVisible().catch(() => false)) await d.focus(proposalScope);
  await sleep(900);
  await d.clearFocus();
  await d.hideCaption();

  await d.visit(
    '/impact',
    'Measure connection, not conversations',
    'LORE tracks coarse outcomes—never message text, names, handles, or real IDs.',
    page.getByRole('heading', { name: /More time together/ }),
  );
  await d.caption(
    'PRIVACY-SAFE IMPACT',
    'Know whether the product helps',
    'Aggregate metrics reveal plans made, time together, and participation without exposing private content.',
  );
  await d.scrollPage(360, 1150);
  await d.hideCaption();

  await d.chapter(
    'LORE',
    'Less performing. More remembering, planning, playing, and showing up for the people in your life.',
    2600,
  );
});
