import { twMerge } from 'tailwind-merge';

type ClassValue =
  | string
  | number
  | null
  | undefined
  | false
  | ClassValue[]
  | Record<string, boolean | undefined>;

function flat(v: ClassValue, out: string[]) {
  if (!v) return;
  if (typeof v === 'string' || typeof v === 'number') out.push(String(v));
  else if (Array.isArray(v)) for (const x of v) flat(x, out);
  else for (const [k, on] of Object.entries(v)) if (on) out.push(k);
}

/** shadcn-style class merge without clsx (tailwind-merge only, per section 4). */
export function cn(...inputs: ClassValue[]) {
  const out: string[] = [];
  flat(inputs, out);
  return twMerge(out.join(' '));
}
