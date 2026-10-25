/// <reference lib="webworker" />
import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { NetworkFirst, Serwist } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope & WorkerGlobalScope;

/** Offline shell + last feed/inbox (section 9.3), and web push (section 8.3). */
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({ url }) => url.pathname === '/v1/feed' || url.pathname === '/v1/conversations',
      // Bump this when the bundled demo dataset changes so an installed app cannot keep serving
      // an older feed/inbox snapshot after a reset.
      handler: new NetworkFirst({ cacheName: 'lore-api-rich-demo-v1', networkTimeoutSeconds: 4 }),
    },
    ...defaultCache,
  ],
  fallbacks: { entries: [{ url: '/offline', matcher: ({ request }) => request.destination === 'document' }] },
});
serwist.addEventListeners();

self.addEventListener('push', (event) => {
  const data = (() => {
    try {
      return event.data?.json() ?? {};
    } catch {
      return { title: 'LORE', body: event.data?.text() };
    }
  })() as { title?: string; body?: string; href?: string };
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'LORE', {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      data: { href: data.href ?? '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const href = (event.notification.data as { href?: string })?.href ?? '/';
  event.waitUntil(self.clients.openWindow(href));
});
