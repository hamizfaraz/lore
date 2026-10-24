/** Design tokens as TS (plan section 9.1). CSS variables live in tokens.css. */
export const colors = {
  light: {
    bg: '#FFFFFF',
    surface2: '#EFEFEF',
    ink: '#000000',
    ink2: '#737373',
    line: '#DBDBDB',
    action: '#1A8CFF',
    heart: '#FF3040',
    ringA: '#FF5A4E',
    ringB: '#F6B94A',
    ringGroup: '#2F8F5B',
    ai: '#6C5CE7',
    aiTint: '#EFEBFF',
    verified: '#2F8F5B',
  },
  dark: {
    bg: '#000000',
    surface2: '#262626',
    ink: '#F5F5F5',
    ink2: '#A8A8A8',
    line: '#262626',
    action: '#1A8CFF',
    heart: '#FF3040',
    ringA: '#FF5A4E',
    ringB: '#F6B94A',
    ringGroup: '#5CC48A',
    ai: '#9C8CFF',
    aiTint: '#221D3D',
    verified: '#5CC48A',
  },
} as const;

/** Sizes in CSS px matching Instagram's iOS metrics (section 9.1). */
export const sizes = {
  topBar: 44,
  tabBar: 49,
  storyAvatar: 64,
  storyRing: 2,
  storyGap: 2,
  feedAvatar: 32,
  dmRowAvatar: 56,
  chatHeaderAvatar: 32,
  profileAvatar: 86,
  icon: 24,
  iconStroke: 1.75,
  actionGap: 16,
  feedColumn: 470,
} as const;

export const type = {
  body: 14,
  caption: 14,
  timestamp: 12,
  title: 16,
  wordmark: 26,
  handleWeight: 600,
} as const;

export const motion = {
  pushMs: 300,
  easeIos: [0.32, 0.72, 0, 1] as const,
  parallax: 0.3,
} as const;

/** Distinct colors per game player / story author tint. */
export const playerColors = ['#FF5A4E', '#1A8CFF', '#2F8F5B', '#F6B94A', '#6C5CE7', '#E84393', '#00B894', '#E17055'];
