'use client';
/**
 * Chat card registry — FROZEN after C1-0b (plan section 6). Owners replace the stub files this points to.
 */
import type { CardKind } from '@lore/shared/cards';
import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import type { CardProps } from './types';

export const cardRegistry: Record<CardKind, ComponentType<CardProps<any>>> = {
  draft_card: dynamic(() => import('@/features/groups/cards/DraftCard')), // C1
  game_invite: dynamic(() => import('@/features/games/cards/GameInviteCard')), // C1
  game_result: dynamic(() => import('@/features/games/cards/GameResultCard')), // C1
  post_share: dynamic(() => import('@/features/feed/cards/PostShareCard')), // C1
  plan_card: dynamic(() => import('@/features/plans/cards/PlanCard')), // C2
  plan_confirmed: dynamic(() => import('@/features/plans/cards/PlanConfirmedCard')), // C2
  recap_card: dynamic(() => import('@/features/memories/cards/RecapCard')), // C2
  family_story_card: dynamic(() => import('@/features/family/cards/FamilyStoryCard')), // C2
  podcast_invite: dynamic(() => import('@/features/podcast/cards/PodcastInviteCard')), // C2
  ai_image: dynamic(() => import('@/features/persona/cards/AiImageCard')), // C2
  intro_card: dynamic(() => import('@/features/discovery/cards/IntroCard')), // C2
};
