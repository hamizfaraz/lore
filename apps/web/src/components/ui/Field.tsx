import { forwardRef } from 'react';
import { cn } from '@/lib/cn';

/** Instagram login-style text field (16 px so iOS never zooms). */
export const Field = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { error?: string }
>(({ className, error, ...props }, ref) => (
  <div className="w-full">
    <input
      ref={ref}
      className={cn(
        'h-[44px] w-full rounded-[6px] border border-line bg-surface-2/40 px-3 text-[16px] outline-none placeholder:text-ink-2 focus:border-ink-2',
        error && 'border-heart',
        className,
      )}
      {...props}
    />
    {error && <p className="mt-1 text-[12px] text-heart">{error}</p>}
  </div>
));
Field.displayName = 'Field';

export const TextArea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'w-full resize-none bg-transparent text-[16px] outline-none placeholder:text-ink-2',
        className,
      )}
      {...props}
    />
  ),
);
TextArea.displayName = 'TextArea';

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors disabled:opacity-40',
        checked ? 'bg-ink' : 'bg-surface-2',
      )}
    >
      <span
        className={cn(
          'absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-[22px]' : 'translate-x-[2px]',
        )}
      />
    </button>
  );
}
