import { z } from 'zod';

export const NOTIFICATION_KINDS = [
  'follow',
  'follow_request',
  'mention',
  'like',
  'comment',
  'draft_needs_approval',
  'post_published',
  'plan_confirmed',
  'intro_request',
  'game_invite',
  'message',
] as const;
export const zNotificationKind = z.enum(NOTIFICATION_KINDS);
export type NotificationKind = z.infer<typeof zNotificationKind>;

export const zNotificationDTO = z.object({
  id: z.string(),
  kind: zNotificationKind,
  payload: z.object({
    actorName: z.string().optional(),
    actorHandle: z.string().optional(),
    actorAvatarUrl: z.string().nullable().optional(),
    text: z.string(),
    href: z.string(),
    thumbUrl: z.string().nullable().optional(),
    accountId: z.string().optional(),
  }).catchall(z.unknown()),
  readAt: z.string().nullable(),
  createdAt: z.string(),
});
export type NotificationDTO = z.infer<typeof zNotificationDTO>;

export const zPushSubscriptionBody = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
});
