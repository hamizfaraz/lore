export const C2_DEMO_USERS = {
  ava: '00000000-0000-7000-8000-000000000101',
  leo: '00000000-0000-7000-8000-000000000102',
  mia: '00000000-0000-7000-8000-000000000103',
  noor: '00000000-0000-7000-8000-000000000104',
  sam: '00000000-0000-7000-8000-000000000105',
  laila: '00000000-0000-7000-8000-000000000106',
} as const;

export function c2DemoUserId(): string {
  if (typeof window === 'undefined') return C2_DEMO_USERS.ava;
  return new URLSearchParams(window.location.search).get('demoUser') ?? C2_DEMO_USERS.ava;
}

export function c2DemoHeaders(): Record<string, string> {
  return { 'x-lore-demo-user': c2DemoUserId() };
}

export const C2_DEMO_AUDIO: Partial<Record<string, string>> = {
  [C2_DEMO_USERS.ava]: '00000000-0000-7000-8000-000000000706',
  [C2_DEMO_USERS.leo]: '00000000-0000-7000-8000-000000000707',
  [C2_DEMO_USERS.mia]: '00000000-0000-7000-8000-000000000708',
  [C2_DEMO_USERS.noor]: '00000000-0000-7000-8000-000000000709',
};
