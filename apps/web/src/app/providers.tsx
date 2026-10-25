'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Toaster } from '@/components/ui/Toast';

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 15_000, refetchOnWindowFocus: false, retry: 1 },
          mutations: { retry: 0 },
        },
      }),
  );
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    // A production service worker can survive a previous local production build and keep serving
    // stale feed/inbox responses even though Serwist is disabled in development. Keep localhost
    // deterministic by removing registrations and origin-scoped caches whenever the dev UI loads.
    void navigator.serviceWorker
      ?.getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())));
    if ('caches' in window)
      void caches.keys().then((names) => Promise.all(names.map((name) => caches.delete(name))));
  }, []);
  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster />
    </QueryClientProvider>
  );
}
