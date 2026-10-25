'use client';
import { Search, X } from 'lucide-react';
import { forwardRef } from 'react';
import { cn } from '@/lib/cn';

export const SearchField = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { onClear?: () => void }
>(({ className, value, onClear, ...props }, ref) => (
  <label
    className={cn(
      'flex h-[44px] items-center gap-2.5 rounded-xl border border-line/60 bg-surface-2/70 px-3.5 text-ink-2 focus-within:border-action/60 focus-within:bg-elevated focus-within:shadow-sm transition-all',
      className,
    )}
  >
    <Search size={17} strokeWidth={2.2} aria-hidden />
    <input
      ref={ref}
      type="search"
      value={value}
      placeholder="Search circles, friends, topics"
      className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-2 font-normal"
      {...props}
    />
    {value && onClear && (
      <button
        type="button"
        onClick={onClear}
        aria-label="Clear"
        className="press p-1 rounded-full hover:bg-surface-2 text-ink-2"
      >
        <X size={15} />
      </button>
    )}
  </label>
));
SearchField.displayName = 'SearchField';
