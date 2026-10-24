import { z } from 'zod';

/** Every enum from plan section 5 as `as const` arrays + zod enums. Additive changes only (section 6). */
const e = <const T extends readonly [string, ...string[]]>(values: T) => ({ values, schema: z.enum(values) });

// social.ts
export const ACCOUNT_TYPES = ['personal', 'group'] as const;
export const VISIBILITIES = ['public', 'private'] as const;
export const FOLLOW_STATUSES = ['active', 'pending'] as const;
export const MEDIA_KINDS = ['image', 'video', 'audio', 'generated_image', 'render'] as const;
export const TRANSCRIPT_STATUSES = ['none', 'pending', 'done', 'failed'] as const;
export const POST_KINDS = ['photo', 'carousel', 'reel'] as const;
export const POST_SOURCE_KINDS = ['manual', 'recap', 'game', 'family', 'plan'] as const;
export const ENGAGEMENT_KINDS = ['like', 'unlike', 'save', 'share', 'view_3s'] as const;

// chat.ts
export const CONVERSATION_KINDS = ['dm', 'group'] as const;
export const MEMBER_ROLES = ['primary_admin', 'admin', 'publisher', 'member'] as const;
export const SENDER_TYPES = ['human', 'ai', 'system'] as const;
export const MESSAGE_KINDS = ['text', 'media', 'voice', 'card', 'system'] as const;
export const MUTE_SCOPES = ['chat', 'games', 'publishing'] as const;

// groups.ts
export const POLICY_MODES = ['direct', 'threshold', 'unanimous', 'courtesy'] as const;
export const DRAFT_STATES = [
  'editing',
  'submitted',
  'changes_requested',
  'approved',
  'published',
  'rejected',
  'cancelled',
] as const;
export const APPROVAL_DECISIONS = ['approve', 'request_changes'] as const;
export const ACTOR_TYPES = ['user', 'ai', 'agent', 'system'] as const;

// games.ts
export const GAME_MODES = ['pictionary', 'meme_battle', 'one_word_story'] as const;
export const GAME_STATES = ['lobby', 'active_round', 'round_results', 'completed', 'abandoned'] as const;
export const CONTEXT_SOURCES = ['lore', 'random', 'hybrid'] as const;
export const MEME_CREATOR_TYPES = ['human', 'ai'] as const;

// persona.ts
export const INITIATIVES = ['quiet', 'balanced', 'lively'] as const;
export const MEMORY_KINDS = ['joke', 'preference', 'event', 'place', 'nickname', 'fact'] as const;
export const SENSITIVITIES = ['low', 'medium', 'high'] as const;
export const DECISION_TRIGGERS = ['message', 'tick', 'event', 'request'] as const;

// plans.ts
export const PREF_KEYS = [
  'budget_max',
  'region',
  'travel_minutes',
  'time_windows',
  'likes',
  'dislikes',
  'dietary',
  'accessibility',
] as const;
export const PREF_SOURCES = ['stated', 'onboarding', 'graph', 'inferred'] as const;
export const PREF_VISIBILITIES = ['group', 'ai_only'] as const;
export const CANDIDATE_SOURCES = ['serp_events', 'serp_maps', 'serp_kg', 'serp_news', 'seed'] as const;
export const CATEGORIES = ['place', 'event', 'movie', 'show', 'book', 'at_home', 'online'] as const;
export const PROPOSAL_STATUSES = [
  'suggested',
  'voting',
  'revised',
  'selected',
  'confirmed',
  'completed',
  'dismissed',
] as const;
export const CREATED_BY = ['ai', 'user'] as const;
export const VOTE_RESPONSES = ['yes', 'flexible', 'no', 'veto'] as const;
export const GROUP_PLAN_STATES = ['confirmed', 'completed', 'cancelled'] as const;
export const RSVP_STATUSES = ['going', 'maybe', 'no'] as const;

// memories.ts
export const EVENT_KINDS = ['birthday', 'outing', 'trip', 'game_night', 'other'] as const;
export const EVENT_CANDIDATE_STATES = ['tentative', 'confirmed', 'dismissed'] as const;
export const RECAP_LAYOUTS = ['grid', 'collage', 'carousel', 'story'] as const;
export const RECAP_STATES = [
  'candidate',
  'generating',
  'ready_private',
  'edited',
  'proposed',
  'saved',
] as const;

// family.ts
export const FAMILY_STORY_STATES = [
  'source_selection',
  'private_draft',
  'contributor_review',
  'approved',
  'shared_private',
] as const;

// podcast.ts
export const PODCAST_SHOW_STATES = ['collecting', 'eligible_to_finish', 'rendering', 'finished'] as const;
export const STATION_STATES = ['open', 'wrapped'] as const;

// discovery.ts
export const INTRO_STATES = ['requested', 'accepted', 'declined', 'expired'] as const;

// integrations.ts
export const AUDIT_OUTCOMES = ['ok', 'denied', 'error'] as const;
export const TOKEN_SCOPES = ['read', 'plans:write', 'drafts:write', 'games:write', 'intros:write'] as const;

// zod enums
export const zAccountType = e(ACCOUNT_TYPES).schema;
export const zVisibility = e(VISIBILITIES).schema;
export const zFollowStatus = e(FOLLOW_STATUSES).schema;
export const zMediaKind = e(MEDIA_KINDS).schema;
export const zTranscriptStatus = e(TRANSCRIPT_STATUSES).schema;
export const zPostKind = e(POST_KINDS).schema;
export const zPostSourceKind = e(POST_SOURCE_KINDS).schema;
export const zEngagementKind = e(ENGAGEMENT_KINDS).schema;
export const zConversationKind = e(CONVERSATION_KINDS).schema;
export const zMemberRole = e(MEMBER_ROLES).schema;
export const zSenderType = e(SENDER_TYPES).schema;
export const zMessageKind = e(MESSAGE_KINDS).schema;
export const zMuteScope = e(MUTE_SCOPES).schema;
export const zPolicyMode = e(POLICY_MODES).schema;
export const zDraftState = e(DRAFT_STATES).schema;
export const zApprovalDecision = e(APPROVAL_DECISIONS).schema;
export const zActorType = e(ACTOR_TYPES).schema;
export const zGameMode = e(GAME_MODES).schema;
export const zGameState = e(GAME_STATES).schema;
export const zContextSource = e(CONTEXT_SOURCES).schema;
export const zMemeCreatorType = e(MEME_CREATOR_TYPES).schema;
export const zInitiative = e(INITIATIVES).schema;
export const zMemoryKind = e(MEMORY_KINDS).schema;
export const zSensitivity = e(SENSITIVITIES).schema;
export const zDecisionTrigger = e(DECISION_TRIGGERS).schema;
export const zPrefKey = e(PREF_KEYS).schema;
export const zPrefSource = e(PREF_SOURCES).schema;
export const zPrefVisibility = e(PREF_VISIBILITIES).schema;
export const zCandidateSource = e(CANDIDATE_SOURCES).schema;
export const zCategory = e(CATEGORIES).schema;
export const zProposalStatus = e(PROPOSAL_STATUSES).schema;
export const zCreatedBy = e(CREATED_BY).schema;
export const zVoteResponse = e(VOTE_RESPONSES).schema;
export const zGroupPlanState = e(GROUP_PLAN_STATES).schema;
export const zRsvpStatus = e(RSVP_STATUSES).schema;
export const zEventKind = e(EVENT_KINDS).schema;
export const zEventCandidateState = e(EVENT_CANDIDATE_STATES).schema;
export const zRecapLayout = e(RECAP_LAYOUTS).schema;
export const zRecapState = e(RECAP_STATES).schema;
export const zFamilyStoryState = e(FAMILY_STORY_STATES).schema;
export const zPodcastShowState = e(PODCAST_SHOW_STATES).schema;
export const zStationState = e(STATION_STATES).schema;
export const zIntroState = e(INTRO_STATES).schema;
export const zAuditOutcome = e(AUDIT_OUTCOMES).schema;
export const zTokenScope = e(TOKEN_SCOPES).schema;

export type AccountType = (typeof ACCOUNT_TYPES)[number];
export type Visibility = (typeof VISIBILITIES)[number];
export type FollowStatus = (typeof FOLLOW_STATUSES)[number];
export type MediaKind = (typeof MEDIA_KINDS)[number];
export type TranscriptStatus = (typeof TRANSCRIPT_STATUSES)[number];
export type PostKind = (typeof POST_KINDS)[number];
export type PostSourceKind = (typeof POST_SOURCE_KINDS)[number];
export type EngagementKind = (typeof ENGAGEMENT_KINDS)[number];
export type ConversationKind = (typeof CONVERSATION_KINDS)[number];
export type MemberRole = (typeof MEMBER_ROLES)[number];
export type SenderType = (typeof SENDER_TYPES)[number];
export type MessageKind = (typeof MESSAGE_KINDS)[number];
export type MuteScope = (typeof MUTE_SCOPES)[number];
export type PolicyMode = (typeof POLICY_MODES)[number];
export type DraftState = (typeof DRAFT_STATES)[number];
export type ApprovalDecision = (typeof APPROVAL_DECISIONS)[number];
export type ActorType = (typeof ACTOR_TYPES)[number];
export type GameMode = (typeof GAME_MODES)[number];
export type GameState = (typeof GAME_STATES)[number];
export type ContextSource = (typeof CONTEXT_SOURCES)[number];
export type MemeCreatorType = (typeof MEME_CREATOR_TYPES)[number];
export type Initiative = (typeof INITIATIVES)[number];
export type MemoryKind = (typeof MEMORY_KINDS)[number];
export type Sensitivity = (typeof SENSITIVITIES)[number];
export type DecisionTrigger = (typeof DECISION_TRIGGERS)[number];
export type PrefKey = (typeof PREF_KEYS)[number];
export type PrefSource = (typeof PREF_SOURCES)[number];
export type PrefVisibility = (typeof PREF_VISIBILITIES)[number];
export type CandidateSource = (typeof CANDIDATE_SOURCES)[number];
export type Category = (typeof CATEGORIES)[number];
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];
export type CreatedBy = (typeof CREATED_BY)[number];
export type VoteResponse = (typeof VOTE_RESPONSES)[number];
export type GroupPlanState = (typeof GROUP_PLAN_STATES)[number];
export type RsvpStatus = (typeof RSVP_STATUSES)[number];
export type EventKind = (typeof EVENT_KINDS)[number];
export type EventCandidateState = (typeof EVENT_CANDIDATE_STATES)[number];
export type RecapLayout = (typeof RECAP_LAYOUTS)[number];
export type RecapState = (typeof RECAP_STATES)[number];
export type FamilyStoryState = (typeof FAMILY_STORY_STATES)[number];
export type PodcastShowState = (typeof PODCAST_SHOW_STATES)[number];
export type StationState = (typeof STATION_STATES)[number];
export type IntroState = (typeof INTRO_STATES)[number];
export type AuditOutcome = (typeof AUDIT_OUTCOMES)[number];
export type TokenScope = (typeof TOKEN_SCOPES)[number];
