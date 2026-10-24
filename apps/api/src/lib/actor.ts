/** Who performs a service call. REST → user, Milo → ai, MCP → agent (acting for a user), jobs → system. */
export type Actor =
  | { type: 'user'; userId: string }
  | { type: 'agent'; userId: string; tokenId: string }
  | { type: 'ai'; personaId: string; conversationId: string }
  | { type: 'system' };

export const userActor = (userId: string): Actor => ({ type: 'user', userId });
export const systemActor: Actor = { type: 'system' };
export const actorUserId = (a: Actor): string | null =>
  a.type === 'user' || a.type === 'agent' ? a.userId : null;
