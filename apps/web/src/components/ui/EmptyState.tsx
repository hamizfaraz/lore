import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export function EmptyState({
  icon: I,
  title,
  body,
  action,
  className,
}: { icon?: LucideIcon; title: string; body?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center gap-2 px-10 py-16 text-center', className)}>
      {I && (
        <span className="mb-2 flex h-16 w-16 items-center justify-center rounded-full border-2 border-ink">
          <I size={30} strokeWidth={1.5} />
        </span>
      )}
      <h2 className="text-[20px] font-bold">{title}</h2>
      {body && <p className="text-ink-2">{body}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/** Failed load, distinct from an empty list. Retry stays a text button so it meets the 44px target. */
export function LoadError({
  title = "Couldn't load this",
  body = 'Check your connection and try again.',
  onRetry,
  className,
}: { title?: string; body?: string; onRetry?: () => void; className?: string }) {
  return (
    <EmptyState
      title={title}
      body={body}
      className={className}
      action={
        onRetry ? (
          <button
            type="button"
            className="press min-h-[44px] px-3 font-semibold text-action"
            onClick={onRetry}
          >
            Try again
          </button>
        ) : undefined
      }
    />
  );
}
