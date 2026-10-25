'use client';
import { BookHeart, Bot, Mic2, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { C2_DEMO_USERS } from './demo-user';

const WEEKEND = '00000000-0000-7000-8000-000000000201';
const FAMILY = '00000000-0000-7000-8000-000000000202';
const PODCAST = '00000000-0000-7000-8000-000000000901';

const features = [
  {
    icon: BookHeart,
    eyebrow: 'Milestone 10',
    title: 'Family Story',
    detail:
      'Choose dates, review consented sources, generate a cited private story, resolve a flag, and share privately.',
    href: `/family/${FAMILY}?demoUser=${C2_DEMO_USERS.noor}`,
    action: 'Test as Noor',
  },
  {
    icon: Mic2,
    eyebrow: 'Milestone 11',
    title: 'Weekend Crew Radio',
    detail: 'Add Noor’s missing 20-second clip, switch to Ava, wrap the cast, render the MP3, and listen.',
    href: `/podcast/${PODCAST}?demoUser=${C2_DEMO_USERS.noor}`,
    action: 'Complete the cast',
  },
  {
    icon: Bot,
    eyebrow: 'Milestone 12',
    title: 'Advanced AI Studio',
    detail:
      'Generate four avatars, tune personality and quiet hours, then preview three situations without joining the chat.',
    href: `/c/${WEEKEND}/ai?demoUser=${C2_DEMO_USERS.ava}`,
    action: 'Open as Ava',
  },
] as const;

export function C2LabPage() {
  return (
    <main className="min-h-dvh bg-bg px-4 pb-12 pt-safe text-ink">
      <div className="mx-auto max-w-[720px] pt-8">
        <header className="rounded-[28px] bg-gradient-to-br from-[#17233a] to-[#684d8f] p-7 text-white shadow-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/70">LORE · Computer 2</p>
          <h1 className="mt-3 font-display text-4xl font-semibold leading-tight">Three new things to try</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-white/80">
            This local test lobby uses seeded people and content. It is isolated from production and does not
            need a provider key.
          </p>
          <div className="mt-5 flex items-center gap-2 text-xs text-white/75">
            <ShieldCheck size={16} /> Demo identity is disabled automatically in production.
          </div>
        </header>

        <section className="mt-5 grid gap-4 md:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <article
                key={feature.title}
                className="flex min-h-[260px] flex-col rounded-3xl bg-surface-2 p-5"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-ai-tint text-ai">
                  <Icon size={23} />
                </span>
                <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-ai">
                  {feature.eyebrow}
                </p>
                <h2 className="mt-1 font-display text-xl font-semibold">{feature.title}</h2>
                <p className="mt-2 flex-1 text-sm leading-5 text-ink-2">{feature.detail}</p>
                <Link
                  href={feature.href}
                  className="press-btn mt-5 block rounded-xl bg-action px-4 py-3 text-center font-semibold text-white"
                >
                  {feature.action}
                </Link>
              </article>
            );
          })}
        </section>

        <aside className="mt-5 rounded-2xl border p-4 text-sm text-ink-2 hairline">
          The seeded podcast starts with one missing participant on purpose. Add Noor’s clip first, then use
          the in-page “Ava (host)” switch to wrap and finish it.
        </aside>
      </div>
    </main>
  );
}
