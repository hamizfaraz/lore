import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/cn';

/** White list row with hairline divider (settings, details, C2 sub-screens). */
export function ListRow({
  icon,
  title,
  subtitle,
  right,
  href,
  onClick,
  chevron = true,
  danger,
  className,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  chevron?: boolean;
  danger?: boolean;
  className?: string;
}) {
  const inner = (
    <>
      {icon && <span className="flex w-7 shrink-0 justify-center text-ink">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-[15px]', danger && 'text-heart')}>{title}</span>
        {subtitle && <span className="block truncate text-[13px] text-ink-2">{subtitle}</span>}
      </span>
      {right}
      {chevron && (href || onClick) && <ChevronRight size={18} className="text-ink-2" />}
    </>
  );
  const cls = cn('press flex min-h-[48px] w-full items-center gap-3 px-4 py-2 text-left', className);
  if (href)
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cls}>
        {inner}
      </button>
    );
  return <div className={cls}>{inner}</div>;
}

export function SectionHeader({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 pb-1 pt-5">
      <h3 className="text-[16px] font-bold">{children}</h3>
      {action}
    </div>
  );
}
