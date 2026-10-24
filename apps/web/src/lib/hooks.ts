'use client';
import type { MeDTO } from '@lore/shared/dto/users';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from './api';
import { qk } from './query-keys';

export function useMe() {
  return useQuery({
    queryKey: qk.me,
    queryFn: () => api.get<MeDTO>('/v1/me'),
    staleTime: 60_000,
    retry: false,
  });
}

/** Track the visual viewport so composers sit exactly on top of the iOS keyboard (section 9.3). */
export function useKeyboardInset() {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setInset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);
  return inset;
}

export function useStandalone() {
  const [standalone, setStandalone] = useState(true);
  useEffect(() => {
    setStandalone(
      window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true,
    );
  }, []);
  return standalone;
}

export function useIsDesktop() {
  const [d, setD] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const f = () => setD(mq.matches);
    f();
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  return d;
}
