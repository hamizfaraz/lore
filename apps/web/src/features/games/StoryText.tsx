import type { GameStateDTO } from '@lore/shared/dto/games';

/** The story with each word tinted by its author's color (section 8.5). */
export function StoryText({
  words,
  participants,
  big,
}: { words: { word: string; userId: string }[]; participants: GameStateDTO['participants']; big?: boolean }) {
  const color = new Map(participants.map((p) => [p.userId, p.color]));
  return (
    <p className={big ? 'font-display text-[26px] leading-snug' : 'font-display text-[17px] leading-snug'}>
      {words.map((w, i) => (
        <span key={i} style={{ color: color.get(w.userId) }}>
          {w.word}{' '}
        </span>
      ))}
    </p>
  );
}
