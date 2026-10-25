'use client';
import type { GameStateDTO } from '@lore/shared/dto/games';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api } from '@/lib/api';
import { qk } from '@/lib/query-keys';
import { joinRoom, onEvent } from '@/lib/socket';
import { toast } from '@/lib/store';

/** Game state: REST fetch + caller-filtered `game.state` pushes on the user room. */
export function useGame(gameId: string) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: qk.game(gameId),
    queryFn: () => api.get<GameStateDTO>(`/v1/games/${gameId}`),
  });
  useEffect(() => {
    const leave = joinRoom(`game:${gameId}`);
    const off = onEvent(
      'game.state',
      (e) => e.data.id === gameId && qc.setQueryData(qk.game(gameId), e.data),
    );
    return () => {
      leave();
      off();
    };
  }, [gameId, qc]);
  const act = async (type: string, payload: Record<string, unknown> = {}) => {
    try {
      const r = await api.post<GameStateDTO | { ok: boolean; draftId?: string }>(
        `/v1/games/${gameId}/actions`,
        { type, payload },
      );
      if ('id' in r) qc.setQueryData(qk.game(gameId), r);
      return r;
    } catch (e) {
      toast((e as Error).message, 'error');
      return null;
    }
  };
  const post = async (path: 'join' | 'start') => {
    try {
      qc.setQueryData(qk.game(gameId), await api.post<GameStateDTO>(`/v1/games/${gameId}/${path}`));
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  return { game: q.data, isLoading: q.isLoading, act, join: () => post('join'), start: () => post('start') };
}

export const MODE_LABEL = {
  one_word_story: 'One-Word Story',
  meme_battle: 'Meme Battle',
  pictionary: 'Pictionary',
} as const;
