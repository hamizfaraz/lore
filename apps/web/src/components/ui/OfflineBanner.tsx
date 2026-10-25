'use client';
import { useEffect, useState } from 'react';

/** In-app offline notice (section 9.3). The service worker still serves /offline for full document failures. */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);
  if (!offline) return null;
  return (
    <output className="fixed inset-x-0 top-0 z-[60] block bg-ink px-4 py-2 pt-safe text-center text-[13px] font-semibold text-bg">
      You're offline. We'll keep what's already open and retry when you're back.
    </output>
  );
}
