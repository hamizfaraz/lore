import { cn } from '@/lib/cn';

/**
 * Frame for plan/draft/recap/game cards in chat (section 9.5): header icon + title + labels, body, actions.
 * Editorial LORE cards title in Fraunces.
 */
export function CardShell({
  icon,
  title,
  labels,
  children,
  actions,
  className,
  ai,
  editorial = true,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  labels?: React.ReactNode;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  ai?: boolean;
  editorial?: boolean;
}) {
  return (
    <div
      className={cn(
        'w-[min(330px,84vw)] overflow-hidden rounded-2xl border border-line/80 bg-elevated shadow-md shadow-slate-900/5',
        ai && 'border-ai/30 shadow-ai/5',
        className,
      )}
    >
      <div className={cn('flex items-start gap-2 px-3.5 pb-2 pt-3', ai && 'bg-ai-tint/60')}>
        {icon && <span className="mt-0.5 shrink-0 text-ink">{icon}</span>}
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              'text-[16px] leading-tight',
              editorial ? 'font-display font-semibold' : 'font-semibold',
            )}
          >
            {title}
          </div>
          {labels && <div className="mt-1 flex flex-wrap items-center gap-1.5">{labels}</div>}
        </div>
      </div>
      {children && <div className="px-3.5 pb-3">{children}</div>}
      {actions && <div className="flex gap-2 border-t hairline px-3.5 py-2.5">{actions}</div>}
    </div>
  );
}
