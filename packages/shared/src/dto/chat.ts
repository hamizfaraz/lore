import { z } from 'zod';
import { zConversationKind, zMemberRole, zMessageKind, zMuteScope, zSenderType } from '../enums';
import { zMediaDTO } from './media';
import { zAccountSummary } from './users';

export const zQuickReply = z.object({ label: z.string(), value: z.string() });
export type QuickReply = z.infer<typeof zQuickReply>;

export const zMessageDTO = z.object({
  id: z.string(),
  conversationId: z.string(),
  clientId: z.string().nullable(),
  createdAt: z.string(),
  senderType: zSenderType,
  sender: z.object({ userId: z.string(), displayName: z.string(), handle: z.string().nullable(), avatarUrl: z.string().nullable() }).nullable(),
  persona: z.object({ id: z.string(), name: z.string(), avatarUrl: z.string().nullable() }).nullable(),
  kind: zMessageKind,
  body: z.string().nullable(),
  media: z.array(zMediaDTO),
  cardKind: z.string().nullable(),
  cardRefId: z.string().nullable(),
  /** card payload, validated per kind with `cards.ts` schemas on the client */
  card: z.unknown().optional(),
  replyTo: z.object({ id: z.string(), body: z.string().nullable(), senderName: z.string() }).nullable(),
  aiGenerated: z.boolean(),
  meta: z
    .object({
      quickReplies: z.array(zQuickReply).optional(),
      reason: z.string().optional(),
      memoryIdsUsed: z.array(z.string()).optional(),
      degraded: z.boolean().optional(),
      demoTiming: z.boolean().optional(),
      waveform: z.array(z.number()).optional(),
      storyId: z.string().optional(),
      postId: z.string().optional(),
    })
    .catchall(z.unknown()),
  reactions: z.array(z.object({ emoji: z.string(), userIds: z.array(z.string()) })),
  editedAt: z.string().nullable(),
  deletedAt: z.string().nullable(),
});
export type MessageDTO = z.infer<typeof zMessageDTO>;

export const zSendMessageBody = z.object({
  clientId: z.string(),
  kind: z.enum(['text', 'media', 'voice', 'card']),
  body: z.string().max(4000).optional(),
  mediaIds: z.array(z.string()).max(10).optional(),
  replyToId: z.string().optional(),
  cardKind: z.string().optional(),
  cardRefId: z.string().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});
export type SendMessageBody = z.infer<typeof zSendMessageBody>;

export const zMemberDTO = z.object({
  userId: z.string(),
  displayName: z.string(),
  handle: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  role: zMemberRole,
  muteScope: zMuteScope.nullable(),
  muteUntil: z.string().nullable(),
  aiHistoryConsent: z.boolean(),
  lastReadAt: z.string().nullable(),
});
export type MemberDTO = z.infer<typeof zMemberDTO>;

export const zConversationRow = z.object({
  id: z.string(),
  kind: zConversationKind,
  title: z.string(),
  avatars: z.array(z.string().nullable()),
  lastMessage: z
    .object({ preview: z.string(), at: z.string(), senderName: z.string().nullable(), isAi: z.boolean() })
    .nullable(),
  unreadCount: z.number(),
  pinned: z.boolean(),
  updatedAt: z.string(),
});
export type ConversationRowDTO = z.infer<typeof zConversationRow>;

export const zConversationDTO = z.object({
  id: z.string(),
  kind: zConversationKind,
  title: z.string(),
  avatarUrl: z.string().nullable(),
  members: z.array(zMemberDTO),
  myRole: zMemberRole,
  persona: z.object({ id: z.string(), name: z.string(), avatarUrl: z.string().nullable(), enabled: z.boolean() }).nullable(),
  groupAccount: zAccountSummary.nullable(),
  createdAt: z.string(),
});
export type ConversationDTO = z.infer<typeof zConversationDTO>;

export const zCreateConversationBody = z.object({
  kind: zConversationKind,
  memberUserIds: z.array(z.string()).min(1).max(50),
  title: z.string().max(60).optional(),
});
export type CreateConversationBody = z.infer<typeof zCreateConversationBody>;

export const zAddMembersBody = z.object({ userIds: z.array(z.string()).min(1) });
export const zMuteBody = z.object({
  userId: z.string().optional(),
  scope: zMuteScope.nullable(),
  minutes: z.number().int().positive().nullable(),
});
export type MuteBody = z.infer<typeof zMuteBody>;
export const zRoleBody = z.object({ role: zMemberRole });
export const zReactionBody = z.object({ emoji: z.string().min(1).max(8) });
