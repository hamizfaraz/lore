'use client';
import { Search, X } from 'lucide-react';
import { forwardRef } from 'react';
import { cn } from '@/lib/cn';

export const SearchField = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { onClear?: () => void }
>(({ className, value, onClear, ...props }, ref) => (
  <label
    className={cn('flex h-[44px] items-center gap-2 rounded-[10px] bg-surface-2 px-3 text-ink-2', className)}
  >
    <Search size={16} strokeWidth={2} aria-hidden />
    <input
      ref={ref}
      type="search"
      value={value}
      placeholder="Search"
      className="h-full min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-ink-2"
      {...props}
    />
    {value && onClear && (
      <button type="button" onClick={onClear} aria-label="Clear" className="press">
        <X size={16} />
      </button>
    )}
  </label>
));
SearchField.displayName = 'SearchField';
