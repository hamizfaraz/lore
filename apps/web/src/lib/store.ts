'use client';
import { create } from 'zustand';

export type TabKey = 'home' | 'explore' | 'create' | 'reels' | 'profile';

/** UI state only (server state lives in TanStack Query). */
type UiState = {
  lastPathByTab: Partial<Record<TabKey, string>>;
  setLastPath: (tab: TabKey, path: string) => void;
  actingAccountId: string | null;
  setActingAccount: (id: string | null) => void;
  toasts: { id: number; text: string; tone?: 'default' | 'error' }[];
  toast: (text: string, tone?: 'default' | 'error') => void;
  dismissToast: (id: number) => void;
};

let toastId = 0;
export const useUi = create<UiState>((set) => ({
  lastPathByTab: {},
  setLastPath: (tab, path) => set((s) => ({ lastPathByTab: { ...s.lastPathByTab, [tab]: path } })),
  actingAccountId: null,
  setActingAccount: (id) => set({ actingAccountId: id }),
  toasts: [],
  toast: (text, tone = 'default') => {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts, { id, text, tone }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3200);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = (text: string, tone?: 'default' | 'error') => useUi.getState().toast(text, tone);
