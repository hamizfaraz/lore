'use client';
export type ThemePref = 'system' | 'light' | 'dark';

export function getTheme(): ThemePref {
  try {
    return (localStorage.getItem('lore.theme') as ThemePref) || 'system';
  } catch {
    return 'system';
  }
}

/** Follows system light/dark instantly; an explicit choice sets [data-theme] and the status bar color. */
export function applyTheme(t: ThemePref) {
  try {
    localStorage.setItem('lore.theme', t);
  } catch {}
  const root = document.documentElement;
  if (t === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', t);
  const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((m) => m.setAttribute('content', dark ? '#000000' : '#ffffff'));
}

export const THEME_BOOT = `try{var t=localStorage.getItem('lore.theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}`;
