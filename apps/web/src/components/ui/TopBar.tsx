'use client';
import { ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/cn';

/** Fixed top bar: 44 px + safe area (section 9.1). Centered title with back chevron for pushed screens. */
export function TopBar({
  title,
  left,
  right,
  back,
  onBack,
  className,
  border = true,
  large,
}: {
  title?: React.ReactNode;
  left?: React.ReactNode;
  right?: React.ReactNode;
  back?: boolean;
  onBack?: () => void;
  className?: string;
  border?: boolean;
  large?: boolean;
}) {
  const router = useRouter();
  return (
    <header
      className={cn(
        'chrome sticky top-0 z-30 bg-bg/95 backdrop-blur-md pt-safe',
        border && 'border-b border-line/70',
        className,
      )}
    >
      <div className="relative flex h-[50px] items-center px-3.5">
        <div className="z-10 flex min-w-10 items-center gap-1">
          {back && (
            <button
              type="button"
              aria-label="Back"
              className="press -ml-1 p-1.5 rounded-full hover:bg-surface-2 transition text-ink"
              onClick={() => (onBack ? onBack() : router.back())}
            >
              <ChevronLeft size={24} strokeWidth={2.2} />
            </button>
          )}
          {left}
        </div>
        {title !== undefined && (
          <div
            className={cn(
              'pointer-events-none absolute inset-x-14 truncate text-center text-[15px] font-bold text-ink tracking-tight',
              large && 'static ml-1 text-left text-[20px]',
            )}
          >
            {title}
          </div>
        )}
        <div className="z-10 ml-auto flex items-center gap-3">{right}</div>
      </div>
    </header>
  );
}
