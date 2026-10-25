import { expect, type Locator, type Page, test } from '@playwright/test';
import { join } from 'node:path';

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
        #lore-demo-caption { position: fixed; right: 34px; bottom: 30px; display: none; width: 390px; padding: 18px 20px; border-radius: 18px; color: #18131f; background: rgba(255,255,255,.94); border: 1px solid rgba(124,58,237,.14); box-shadow: 0 22px 70px rgba(18,13,28,.24); backdrop-filter: blur(18px); }
        #lore-demo-caption.show { display: block; }
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
        <div id="lore-demo-caption"><div class="kicker"></div><h3></h3><p></p></div>
        <div id="lore-demo-focus"></div>
        <div id="lore-demo-cursor"></div>
      `;
      document.body.append(stage);
    });
    this.cursor = { x: 88, y: 650 };
  }

  async caption(kicker: string, title: string, body: string, hold = 900) {
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
    await sleep(80);
  }

  async visit(path: string, ready: Locator) {
    await expect
      .poll(() =>
        this.page.evaluate(
          () =>
            typeof (window as Window & { __loreDemoNavigate?: (path: string) => void }).__loreDemoNavigate ===
            'function',
        ),
      )
      .toBe(true);
    await this.page.evaluate((nextPath) => {
      const navigate = (window as Window & { __loreDemoNavigate?: (path: string) => void })
        .__loreDemoNavigate;
      if (!navigate) throw new Error('Demo navigation bridge is unavailable.');
      navigate(nextPath);
    }, path);
    const expectedUrl = new URL(path, this.page.url());
    await this.page.waitForURL(
      (url) => `${url.pathname}${url.search}` === `${expectedUrl.pathname}${expectedUrl.search}`,
    );
    await expect(ready).toBeVisible();
    await this.mount();
    await sleep(180);
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
      await sleep(10);
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
    await sleep(280);
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
    await sleep(Math.min(hold, 650));
  }

  async scrollElement(locator: Locator, y: number, hold = 900) {
    await locator.evaluate((element, top) => element.scrollTo({ top, behavior: 'smooth' }), y);
    await sleep(Math.min(hold, 650));
  }
}

test('group-first product walkthrough', async ({ page }) => {
  test.slow();
  const d = new Director(page);

  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'lore' })).toBeVisible();
  await d.mount();
  await d.type(page.getByPlaceholder('Email'), 'ava.demo@ourlore.test', 24);
  await d.type(page.getByPlaceholder('Password'), 'password123', 35);
  await Promise.all([
    page.waitForURL((url) => url.pathname === '/', { timeout: 25_000 }),
    d.click(page.getByRole('button', { name: 'Log in' })),
  ]);
  await expect(page.getByRole('link', { name: 'Home' })).toBeVisible();
  await d.mount();
  const groupPost = page.locator('article[aria-label="Post by weekendcrew"]');
  await expect(groupPost).toBeVisible();
  const groupMedia = groupPost.getByRole('img', { name: 'A green view from a Weekend Crew day outside' });
  await expect(groupMedia).toBeVisible();
  await expect
    .poll(() => groupMedia.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0))
    .toBe(true);
  await sleep(400);
  await d.focus(groupPost);
  await d.caption(
    'GROUP-FIRST FEED',
    'The group is the account',
    '@weekendcrew publishes shared posts and stories under one identity—not through a single member’s profile.',
  );
  const groupLike = groupPost.getByRole('button', { name: 'Like' });
  if (await groupLike.isVisible().catch(() => false)) await d.click(groupLike);
  await d.clearFocus();
  await d.hideCaption();

  await d.visit('/g/weekendcrew', page.getByRole('button', { name: 'Members' }));
  await d.caption(
    'GROUP PROFILE',
    'One profile for the whole group',
    'Members, shared posts, and group history live together while every contribution keeps clear authorship.',
  );
  await d.scrollPage(250, 650);
  await d.hideCaption();

  await d.visit('/create', page.getByRole('heading', { name: 'New post' }));
  await page
    .locator('input[type="file"]')
    .setInputFiles(join(process.cwd(), '.data/media/demo/rich/photo-24.jpg'));
  await d.click(page.getByRole('button', { name: 'Next' }));
  await expect(page.getByRole('heading', { name: 'Edit' })).toBeVisible();
  await d.click(page.getByRole('button', { name: 'Next' }));
  await expect(page.getByText('Post as', { exact: true })).toBeVisible();
  await d.click(page.getByText('Post as', { exact: true }));
  await d.click(page.getByRole('button', { name: /weekendcrew Group account/ }));
  await expect(page.getByText(/Needs 2 approvals/)).toBeVisible();
  await d.caption(
    'POST AS A GROUP',
    'Shared voice, shared approval',
    'A member creates the post as @weekendcrew, and the group’s policy decides when it can publish.',
  );
  const submitForApproval = page.getByRole('button', { name: 'Submit for approval' });
  await d.focus(submitForApproval);
  await sleep(700);
  await d.clearFocus();
  await d.hideCaption();

  await d.visit('/inbox', page.getByText('Requests', { exact: true }));
  await d.caption(
    'GROUP INBOX',
    'The group chat is home base',
    'Plans, memories, games, publishing, and the AI member all start from the same conversation.',
  );
  const firstThread = page.locator('a[href^="/c/"]').first();
  if (await firstThread.isVisible().catch(() => false)) await d.focus(firstThread);
  await sleep(900);
  await d.clearFocus();
  await d.hideCaption();

  await d.visit(`/c/${WEEKEND}`, page.getByRole('textbox', { name: 'Message' }));
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

  await d.click(page.getByRole('button', { name: 'Games' }));
  await expect(page.getByText('Play a game', { exact: true })).toBeVisible();
  await d.caption(
    'GROUP GAMES',
    'Built for the people already here',
    'Choose a format, tune the pace, and invite friends without auto-enrolling anyone.',
  );
  const oneWordStory = page.getByRole('button', { name: /One-Word Story/ });
  const memeBattle = page.getByRole('button', { name: /Meme Battle/ });
  const pictionary = page.getByRole('button', { name: /Pictionary/ });
  await d.click(memeBattle);
  await sleep(550);

  if (process.env.LORE_DEMO_GAMES_FOCUS === '1') {
    await d.focus(page.getByText('AI competitor', { exact: true }));
    await sleep(650);
    await d.clearFocus();
    await d.click(pictionary);
    await d.focus(page.getByText('Teams', { exact: true }).first());
    await sleep(650);
    await d.clearFocus();
    await d.click(oneWordStory);
    await d.click(page.getByRole('button', { name: 'Group lore' }));
    await d.caption(
      'THREE WAYS TO PLAY',
      'Stories, memes, or drawing',
      'Each format has its own rounds, timer, and team controls—and prompts can come from memories the group already shares.',
      1100,
    );
    await d.click(page.getByRole('button', { name: 'Open lobby' }));
    await expect(page.getByText('1 player in the lobby', { exact: true })).toBeVisible();
    await d.mount();
    await d.caption(
      'OPT-IN LOBBY',
      'Nobody gets pulled in automatically',
      'The host opens the room, friends choose to join, and this round is grounded in Weekend Crew lore.',
      1000,
    );
    const startGame = page.getByRole('button', { name: 'Start', exact: true });
    await d.focus(startGame);
    await sleep(550);
    await d.clearFocus();
    await d.click(startGame);
    await expect(page.getByText('Your turn — pick one word', { exact: true })).toBeVisible();
    const wordChoices = page.locator('div.grid.grid-cols-2.gap-2 button');
    await expect(wordChoices).toHaveCount(5);
    await d.caption(
      'ONE-WORD STORY',
      'Five choices keep every turn moving',
      'Players build one shared story a word at a time. LORE supplies exactly five choices, then illustrates the ending.',
      1000,
    );
    await d.click(wordChoices.first());
    await expect(page.getByText('1 / 24 words', { exact: true })).toBeVisible();
    await expect(wordChoices).toHaveCount(5);
    await d.click(wordChoices.nth(2));
    await expect(page.getByText('2 / 24 words', { exact: true })).toBeVisible();
    await expect(wordChoices).toHaveCount(5);
    await d.click(wordChoices.last());
    await expect(page.getByText('3 / 24 words', { exact: true })).toBeVisible();
    await d.caption(
      'CHAT STAYS ATTACHED',
      'The game never leaves the group behind',
      'Players can reopen the group conversation without losing the round or moving to a separate game network.',
      1000,
    );
    await d.click(page.getByRole('button', { name: 'Chat', exact: true }));
    await expect(page.getByPlaceholder('Message the group')).toBeVisible();
    await d.focus(page.getByPlaceholder('Message the group'));
    await sleep(650);
    await d.clearFocus();
  } else {
    await sleep(850);
  }
  await d.hideCaption();

  await d.visit(`/c/${WEEKEND}/details`, page.getByText('Group account', { exact: true }));
  await d.caption(
    'GROUP HUB',
    'Everything the group can do',
    'Plans, memories, games, the shared page, AI controls, member roles, publishing, and podcast live here.',
  );
  await d.scrollPage(330, 650);
  await d.hideCaption();

  await d.visit(`/c/${WEEKEND}/plans`, page.getByRole('heading', { name: 'What should we do?' }));
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

  await d.visit(`/c/${WEEKEND}/memories`, page.getByRole('heading', { name: /Turn shared moments/ }));
  await d.caption(
    'MEMORIES',
    'Private by default',
    'LORE can arrange recent moments into an editable recap, a story, or an optional on-chain keepsake.',
  );
  await d.scrollPage(520, 1000);
  await d.hideCaption();

  await d.visit(`/recap/${RECAP}`, page.getByText('Recap editor', { exact: true }));
  await d.caption(
    'RECAP EDITOR',
    'A group memory becomes a group post',
    'Members control their media, edit the recap together, then send it through the same group approval flow.',
  );
  await d.scrollPage(560, 1050);
  const keepsake = page.getByRole('button', { name: 'Make it a keepsake' });
  if (await keepsake.isVisible().catch(() => false)) await d.focus(keepsake);
  await sleep(850);
  await d.clearFocus();
  await d.hideCaption();

  await d.visit(`/c/${WEEKEND}/ai`, page.getByRole('heading', { name: 'Milo' }));
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

  await d.visit(`/podcast/${PODCAST}`, page.getByText('Voice-only group show', { exact: true }));
  await d.caption(
    'PODCAST STATIONS',
    'Asynchronous, but still together',
    'Branch topics, visible attribution, transcript status, and a hard all-cast completion gate keep it accountable.',
  );
  await d.scrollPage(450, 1100);
  await d.hideCaption();

  await d.visit(`/c/${WEEKEND}/settings#group-account`, page.getByText('Publishing policy', { exact: true }));
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

  await d.visit('/settings/muse', page.getByRole('heading', { name: 'Use LORE from Muse' }));
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

  await d.visit('/impact', page.getByRole('heading', { name: /More time together/ }));
  await d.caption(
    'PRIVACY-SAFE IMPACT',
    'Know whether the product helps',
    'Aggregate metrics reveal plans made, time together, and participation without exposing private content.',
  );
  await d.scrollPage(360, 1150);
  await d.hideCaption();

  await sleep(700);
});
