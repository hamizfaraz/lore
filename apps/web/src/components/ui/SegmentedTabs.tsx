'use client';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

/** Refreshed segmented pill tabs (profile/feed). */
export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
}: { tabs: { key: T; icon: LucideIcon; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="chrome flex p-1 mx-3 my-2 rounded-xl bg-surface-2 border border-line/40" role="tablist">
      {tabs.map(({ key, icon: I, label }) => {
        const on = value === key;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={on}
            aria-label={label}
            onClick={() => onChange(key)}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all duration-150',
              on ? 'bg-elevated shadow-sm text-action' : 'text-ink-2 hover:text-ink',
            )}
          >
            <I size={20} strokeWidth={on ? 2.2 : 1.75} />
            <span className="hidden sm:inline capitalize">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
