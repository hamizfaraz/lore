'use client';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

/** Grid / Reels / Tagged icon tabs (profile). */
export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
}: { tabs: { key: T; icon: LucideIcon; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="chrome flex border-t hairline" role="tablist">
      {tabs.map(({ key, icon: I, label }) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={value === key}
          aria-label={label}
          onClick={() => onChange(key)}
          className={cn(
            'flex flex-1 justify-center py-2.5',
            value === key ? 'border-b border-ink text-ink' : 'text-ink-2',
          )}
        >
          <I size={24} strokeWidth={1.75} />
        </button>
      ))}
    </div>
  );
}
