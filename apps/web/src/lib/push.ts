'use client';
import { api } from './api';

/** Ask for notification permission only after a meaningful action (never at launch), section 8.3. */
export async function enablePush(): Promise<string> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window))
    return 'Install LORE to your home screen to get notifications';
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return 'Notifications are off';
  const { publicKey } = await api.get<{ publicKey: string | null }>('/v1/notifications/push-key');
  if (!publicKey) return 'Push is not configured on this server';
  const reg = await navigator.serviceWorker.ready;
  const key = Uint8Array.from(
    atob(publicKey.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (publicKey.length % 4)) % 4)),
    (c) => c.charCodeAt(0),
  );
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  await api.post('/v1/notifications/push-subscriptions', sub.toJSON());
  return 'Notifications on';
}
