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
