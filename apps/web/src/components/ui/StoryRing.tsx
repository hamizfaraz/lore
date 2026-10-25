import { cn } from '@/lib/cn';
import { Avatar } from './Avatar';

/** 2 px gradient ring + 2 px gap around a 64 px avatar (section 9.1). Group stories use the green ring. */
export function StoryRing({
  src,
  name,
  size = 64,
  state = 'unseen',
  group,
  onClick,
  className,
}: {
  src?: string | null;
  name?: string | null;
  size?: number;
  state?: 'unseen' | 'seen' | 'none';
  group?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const ring =
    state === 'none' ? '' : state === 'seen' ? 'story-ring-seen' : group ? 'story-ring-group' : 'story-ring';
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'press inline-flex shrink-0 rounded-full p-[2.5px] transition-transform active:scale-95',
        ring,
        className,
      )}
      aria-label={name ? `${name}'s story` : 'story'}
    >
      <span className="rounded-full bg-bg p-[2px]">
        <Avatar src={src} name={name} size={size - 8} />
      </span>
    </button>
  );
}
