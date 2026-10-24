import type { LucideIcon, LucideProps } from 'lucide-react';

/** Lucide outline icons drawn at Instagram's weight: 24 px, stroke 1.75 (section 9.1). */
export function Icon({
  icon: I,
  size = 24,
  filled,
  ...rest
}: { icon: LucideIcon; filled?: boolean } & LucideProps) {
  return (
    <I
      size={size}
      strokeWidth={filled ? 2 : 1.75}
      fill={filled ? 'currentColor' : 'none'}
      aria-hidden
      {...rest}
    />
  );
}
