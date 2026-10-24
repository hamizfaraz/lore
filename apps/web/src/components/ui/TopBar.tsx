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
      className={cn('chrome sticky top-0 z-30 bg-bg pt-safe', border && 'border-b hairline', className)}
    >
      <div className="relative flex h-[44px] items-center px-3">
        <div className="z-10 flex min-w-10 items-center gap-1">
          {back && (
            <button
              type="button"
              aria-label="Back"
              className="press -ml-1 p-1"
              onClick={() => (onBack ? onBack() : router.back())}
            >
              <ChevronLeft size={28} strokeWidth={1.75} />
            </button>
          )}
          {left}
        </div>
        {title !== undefined && (
          <div
            className={cn(
              'pointer-events-none absolute inset-x-14 truncate text-center text-[16px] font-semibold',
              large && 'static ml-1 text-left text-[22px] font-bold',
            )}
          >
            {title}
          </div>
        )}
        <div className="z-10 ml-auto flex items-center gap-4">{right}</div>
      </div>
    </header>
  );
}
