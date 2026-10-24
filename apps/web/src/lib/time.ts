/** Instagram-style relative time: "now", "5m", "3h", "2d", "4w", then "Mar 3". */
export function ago(iso: string | Date, now = Date.now()): string {
  const t = typeof iso === 'string' ? new Date(iso).getTime() : iso.getTime();
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 45) return 'now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d`;
  const w = Math.round(d / 7);
  if (w < 5) return `${w}w`;
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function longAgo(iso: string): string {
  const a = ago(iso);
  const map: Record<string, string> = { m: ' minutes ago', h: ' hours ago', d: ' days ago', w: ' weeks ago' };
  const unit = a.slice(-1);
  if (a === 'now') return 'Just now';
  return map[unit] ? `${a.slice(0, -1)}${map[unit]}` : a;
}

export function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date(today);
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

export const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

export const compact = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
    : n >= 10_000
      ? `${Math.round(n / 1000)}K`
      : n.toLocaleString();
