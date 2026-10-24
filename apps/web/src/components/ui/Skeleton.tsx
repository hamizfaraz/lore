import { cn } from '@/lib/cn';

/** Instagram-style gray placeholder blocks. */
export function Skeleton({ className, round }: { className?: string; round?: boolean }) {
  return <div className={cn('skeleton', round ? 'rounded-full' : 'rounded-md', className)} />;
}

export function PostSkeleton() {
  return (
    <div className="pb-4">
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <Skeleton round className="h-8 w-8" />
        <Skeleton className="h-3 w-28" />
      </div>
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="space-y-2 px-3 pt-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-3/4" />
      </div>
    </div>
  );
}

export function RowSkeleton({ avatar = 56 }: { avatar?: number }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2">
      <div style={{ width: avatar, height: avatar }} className="skeleton shrink-0 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-48" />
      </div>
    </div>
  );
}
