import { Check, ExternalLink, Sparkles } from 'lucide-react';
import { cn } from '@/lib/cn';
import { ago } from '@/lib/time';

/** The three-label rule (section 9.4): AI suggestion, verified Source, human Confirmed. */
export function AiPill({ className, label = 'AI' }: { className?: string; label?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full bg-ai px-1.5 py-[1px] text-[10px] font-semibold uppercase leading-4 tracking-wide text-white',
        className,
      )}
    >
      <Sparkles size={10} strokeWidth={2.25} aria-hidden />
      {label}
    </span>
  );
}

export function SourceLine({
  domain,
  url,
  verifiedAt,
  className,
}: { domain: string; url?: string | null; verifiedAt?: string | null; className?: string }) {
  const text = `Source · ${domain}${verifiedAt ? ` · ${ago(verifiedAt)}` : ''}`;
  return url ? (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className={cn('inline-flex items-center gap-1 text-[12px] text-verified', className)}
    >
      {text}
      <ExternalLink size={11} aria-hidden />
    </a>
  ) : (
    <span className={cn('text-[12px] text-verified', className)}>{text}</span>
  );
}

export function ConfirmedPill({
  name,
  className,
  text,
}: { name?: string; className?: string; text?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-ink px-2 py-0.5 text-[11px] font-semibold text-bg',
        className,
      )}
    >
      <Check size={11} strokeWidth={2.5} aria-hidden />
      {text ?? (name ? `Confirmed by ${name}` : 'Confirmed')}
    </span>
  );
}

export function Chip({
  children,
  className,
  tone = 'default',
}: { children: React.ReactNode; className?: string; tone?: 'default' | 'warn' | 'ai' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
        tone === 'warn'
          ? 'bg-ring-b/20 text-ink'
          : tone === 'ai'
            ? 'bg-ai-tint text-ai'
            : 'bg-surface-2 text-ink-2',
        className,
      )}
    >
      {children}
    </span>
  );
}
