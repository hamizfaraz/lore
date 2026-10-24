'use client';
import { Drawer } from 'vaul';
import { cn } from '@/lib/cn';

/** vaul drawer with snap points (50% / 90%), rubber-band drag, background scale on iOS (section 9.3). */
export function Sheet({
  open,
  onOpenChange,
  title,
  children,
  snap = 'auto',
  className,
  footer,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  snap?: 'auto' | 'half' | 'full';
  className?: string;
  footer?: React.ReactNode;
}) {
  const snapPoints = snap === 'auto' ? undefined : snap === 'half' ? [0.5, 0.9] : [0.9];
  return (
    <Drawer.Root
      open={open}
      onOpenChange={onOpenChange}
      snapPoints={snapPoints as any}
      shouldScaleBackground
      repositionInputs={false}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-[var(--overlay)]" />
        <Drawer.Content
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] max-w-[640px] flex-col rounded-t-[14px] bg-elevated outline-none',
            snap === 'full' && 'h-[90dvh]',
            className,
          )}
          aria-describedby={undefined}
        >
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line" />
          {title ? (
            <Drawer.Title className="border-b hairline py-3 text-center text-[16px] font-semibold">
              {title}
            </Drawer.Title>
          ) : (
            <Drawer.Title className="sr-only">Sheet</Drawer.Title>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
          {footer && <div className="pb-safe">{footer}</div>}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

/** Instagram-style action list inside a sheet ("Report", "Copy link", ...). */
export function SheetAction({
  children,
  onClick,
  danger,
  icon,
}: { children: React.ReactNode; onClick?: () => void; danger?: boolean; icon?: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'press flex w-full items-center gap-3 px-5 py-3.5 text-left text-[15px]',
        danger && 'text-heart',
      )}
    >
      {icon}
      {children}
    </button>
  );
}
