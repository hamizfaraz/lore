import {
  aiMemories,
  aiPersonas,
  candidates,
  conversationMembers,
  conversations,
  createDb,
  eq,
  eventCandidates,
  familyStories,
  familyStoryContributions,
  groupPlans,
  groupPreferences,
  inArray,
  interestProfiles,
  mediaAssets,
  messages,
  planProposals,
  planRsvps,
  planVotes,
  postMedia,
  podcastShows,
  podcastStations,
  posts,
  publishingPolicies,
  recapMediaConsents,
  recaps,
  recommendationTriggers,
  socialAccounts,
  user,
  voiceContributions,
} from '../packages/db/src/index';

export const DEMO = {
  users: {
    ava: '00000000-0000-7000-8000-000000000101',
    leo: '00000000-0000-7000-8000-000000000102',
    mia: '00000000-0000-7000-8000-000000000103',
    noor: '00000000-0000-7000-8000-000000000104',
    sam: '00000000-0000-7000-8000-000000000105',
    laila: '00000000-0000-7000-8000-000000000106',
  },
  conversations: {
    weekend: '00000000-0000-7000-8000-000000000201',
    family: '00000000-0000-7000-8000-000000000202',
  },
  accounts: {
    ava: '00000000-0000-7000-8000-000000000301',
    leo: '00000000-0000-7000-8000-000000000302',
    mia: '00000000-0000-7000-8000-000000000303',
    noor: '00000000-0000-7000-8000-000000000304',
    sam: '00000000-0000-7000-8000-000000000305',
    laila: '00000000-0000-7000-8000-000000000306',
    weekend: '00000000-0000-7000-8000-000000000311',
    family: '00000000-0000-7000-8000-000000000312',
  },
  persona: '00000000-0000-7000-8000-000000000401',
  event: '00000000-0000-7000-8000-000000000501',
  trigger: '00000000-0000-7000-8000-000000000502',
  proposal: '00000000-0000-7000-8000-000000000503',
  plan: '00000000-0000-7000-8000-000000000504',
  recap: '00000000-0000-7000-8000-000000000505',
  podcast: {
    show: '00000000-0000-7000-8000-000000000901',
    rootStation: '00000000-0000-7000-8000-000000000902',
    contributions: [
      '00000000-0000-7000-8000-000000000911',
      '00000000-0000-7000-8000-000000000912',
      '00000000-0000-7000-8000-000000000913',
    ],
  },
  candidates: [
    '00000000-0000-7000-8000-000000000601',
    '00000000-0000-7000-8000-000000000602',
    '00000000-0000-7000-8000-000000000603',
    '00000000-0000-7000-8000-000000000604',
  ],
  media: [
    '00000000-0000-7000-8000-000000000701',
    '00000000-0000-7000-8000-000000000702',
    '00000000-0000-7000-8000-000000000703',
    '00000000-0000-7000-8000-000000000704',
    '00000000-0000-7000-8000-000000000705',
    '00000000-0000-7000-8000-000000000706',
    '00000000-0000-7000-8000-000000000707',
    '00000000-0000-7000-8000-000000000708',
    '00000000-0000-7000-8000-000000000709',
  ],
  posts: [
    '00000000-0000-7000-8000-000000000801',
    '00000000-0000-7000-8000-000000000802',
    '00000000-0000-7000-8000-000000000803',
  ],
} as const;

const memberUsers = [DEMO.users.ava, DEMO.users.leo, DEMO.users.mia, DEMO.users.noor];
const allUsers = Object.values(DEMO.users);
const allAccounts = Object.values(DEMO.accounts);

const historyLines = [
  'Saturday after eleven works for me, and I would rather stay under $30.',
  'Remember when the picnic blanket escaped down the hill at Zilker?',
  'Noor’s birthday is November 8—we should keep that weekend open.',
  'I am always up for climbing, live music, or a slow coffee crawl.',
  'Twenty-five minutes of driving is my comfortable maximum.',
  'The waffle-maker game night was honestly our best low-key plan.',
  'Mia calls every ambitious itinerary “the side quest.”',
  'Leo needs vegetarian options, and quieter seating helps Ava.',
  'The outdoor movie was fun even though we forgot half the snacks.',
  'Could our next thing be inexpensive and somewhere around central Austin?',
];

function messageId(index: number, family = false) {
  return `00000000-0000-7000-${family ? '8100' : '8000'}-${String(index + 1).padStart(12, '0')}`;
}

type DemoDb = ReturnType<typeof createDb>['db'];

export async function clearDemo(db: DemoDb): Promise<void> {
  const stationRows = await db
    .select({ id: podcastStations.id })
    .from(podcastStations)
    .where(eq(podcastStations.showId, DEMO.podcast.show));
  if (stationRows.length) {
    await db.delete(voiceContributions).where(
      inArray(
        voiceContributions.stationId,
        stationRows.map((row) => row.id),
      ),
    );
  }
  await db.delete(podcastStations).where(eq(podcastStations.showId, DEMO.podcast.show));
  await db.delete(podcastShows).where(eq(podcastShows.id, DEMO.podcast.show));
  const storyRows = await db
    .select({ id: familyStories.id })
    .from(familyStories)
    .where(inArray(familyStories.conversationId, Object.values(DEMO.conversations)));
  if (storyRows.length) {
    const storyIds = storyRows.map((row) => row.id);
    await db.delete(familyStoryContributions).where(inArray(familyStoryContributions.storyId, storyIds));
    await db.delete(familyStories).where(inArray(familyStories.id, storyIds));
  }
  await db.delete(planRsvps).where(eq(planRsvps.planId, DEMO.plan));
  await db.delete(planVotes).where(eq(planVotes.proposalId, DEMO.proposal));
  await db.delete(groupPlans).where(eq(groupPlans.id, DEMO.plan));
  await db.delete(planProposals).where(eq(planProposals.id, DEMO.proposal));
  await db.delete(recommendationTriggers).where(eq(recommendationTriggers.id, DEMO.trigger));
  await db.delete(recapMediaConsents).where(eq(recapMediaConsents.recapId, DEMO.recap));
  await db.delete(recaps).where(eq(recaps.id, DEMO.recap));
  await db.delete(postMedia).where(inArray(postMedia.postId, [...DEMO.posts]));
  await db.delete(posts).where(inArray(posts.id, [...DEMO.posts]));
  await db.delete(mediaAssets).where(inArray(mediaAssets.id, [...DEMO.media]));
  await db.delete(candidates).where(inArray(candidates.id, [...DEMO.candidates]));
  await db.delete(eventCandidates).where(eq(eventCandidates.id, DEMO.event));
  await db.delete(aiMemories).where(inArray(aiMemories.conversationId, Object.values(DEMO.conversations)));
  await db
    .delete(groupPreferences)
    .where(inArray(groupPreferences.conversationId, Object.values(DEMO.conversations)));
  await db.delete(aiPersonas).where(eq(aiPersonas.id, DEMO.persona));
  await db.delete(publishingPolicies).where(inArray(publishingPolicies.accountId, allAccounts));
  await db
    .delete(conversationMembers)
    .where(inArray(conversationMembers.conversationId, Object.values(DEMO.conversations)));
  await db.delete(messages).where(inArray(messages.conversationId, Object.values(DEMO.conversations)));
  await db.delete(conversations).where(inArray(conversations.id, Object.values(DEMO.conversations)));
  await db.delete(interestProfiles).where(inArray(interestProfiles.userId, allUsers));
  await db.delete(socialAccounts).where(inArray(socialAccounts.id, allAccounts));
  await db.delete(user).where(inArray(user.id, allUsers));
}

export async function seedDemo(db: DemoDb): Promise<Record<string, number>> {
  await clearDemo(db);
  const now = new Date('2026-10-24T17:00:00-05:00');
  const userRows = [
    [DEMO.users.ava, 'Ava Chen', 'ava.demo@ourlore.test'],
    [DEMO.users.leo, 'Leo Martinez', 'leo.demo@ourlore.test'],
    [DEMO.users.mia, 'Mia Brooks', 'mia.demo@ourlore.test'],
    [DEMO.users.noor, 'Noor Rahman', 'noor.demo@ourlore.test'],
    [DEMO.users.sam, 'Sam Rivera', 'sam.demo@ourlore.test'],
    [DEMO.users.laila, 'Laila Iqbal', 'laila.demo@ourlore.test'],
  ].map(([id, name, email]) => ({ id: id!, name: name!, email: email!, emailVerified: true }));
  await db.insert(user).values(userRows);

  const personal = [
    [DEMO.accounts.ava, DEMO.users.ava, 'avachen', 'Ava Chen', 'Climber, film-camera optimist, tea person.'],
    [
      DEMO.accounts.leo,
      DEMO.users.leo,
      'leom',
      'Leo Martinez',
      'Live music, vegetarian food, and long bike rides.',
    ],
    [
      DEMO.accounts.mia,
      DEMO.users.mia,
      'miab',
      'Mia Brooks',
      'Design, bookstores, and finding the good side quest.',
    ],
    [
      DEMO.accounts.noor,
      DEMO.users.noor,
      'noorr',
      'Noor Rahman',
      'Coffee, community gardens, and cozy game nights.',
    ],
    [
      DEMO.accounts.sam,
      DEMO.users.sam,
      'samrivera',
      'Sam Rivera',
      'Bouldering, street food, and indie movies.',
    ],
    [
      DEMO.accounts.laila,
      DEMO.users.laila,
      'lailaiqbal',
      'Laila Iqbal',
      'Family recipes, oral histories, and gardening.',
    ],
  ].map(([id, ownerUserId, handle, displayName, bio]) => ({
    id: id!,
    type: 'personal' as const,
    ownerUserId: ownerUserId!,
    handle: handle!,
    displayName: displayName!,
    bio: bio!,
    visibility: 'public' as const,
    onboardedAt: now,
  }));
  await db.insert(socialAccounts).values([
    ...personal,
    {
      id: DEMO.accounts.weekend,
      type: 'group',
      handle: 'weekendcrew',
      displayName: 'Weekend Crew',
      bio: 'Four friends making Austin weekends count.',
      visibility: 'public',
      conversationId: DEMO.conversations.weekend,
      primaryAdminUserId: DEMO.users.ava,
    },
    {
      id: DEMO.accounts.family,
      type: 'group',
      handle: 'theiqbals',
      displayName: 'The Iqbals',
      bio: 'Recipes, stories, and the people who keep them alive.',
      visibility: 'private',
      conversationId: DEMO.conversations.family,
      primaryAdminUserId: DEMO.users.noor,
    },
  ]);
  await db.insert(conversations).values([
    {
      id: DEMO.conversations.weekend,
      kind: 'group',
      title: 'Weekend Crew',
      createdByUserId: DEMO.users.ava,
      groupAccountId: DEMO.accounts.weekend,
      joinSlug: 'weekendcrew-demo',
      joinCode: 'WEEKEND',
      lastMessageAt: now,
    },
    {
      id: DEMO.conversations.family,
      kind: 'group',
      title: 'The Iqbals',
      createdByUserId: DEMO.users.noor,
      groupAccountId: DEMO.accounts.family,
      joinSlug: 'iqbals-demo',
      joinCode: 'FAMILY',
      lastMessageAt: now,
    },
  ]);
  await db.insert(conversationMembers).values([
    ...memberUsers.map((userId, index) => ({
      conversationId: DEMO.conversations.weekend,
      userId,
      role: index === 0 ? ('primary_admin' as const) : ('member' as const),
      aiHistoryConsent: true,
    })),
    ...[DEMO.users.noor, DEMO.users.laila, DEMO.users.ava].map((userId, index) => ({
      conversationId: DEMO.conversations.family,
      userId,
      role: index === 0 ? ('primary_admin' as const) : ('member' as const),
      aiHistoryConsent: true,
    })),
  ]);
  await db.insert(publishingPolicies).values([
    { accountId: DEMO.accounts.weekend, mode: 'threshold', threshold: 2, updatedBy: DEMO.users.ava },
    { accountId: DEMO.accounts.family, mode: 'unanimous', updatedBy: DEMO.users.noor },
  ]);
  await db.insert(aiPersonas).values({
    id: DEMO.persona,
    conversationId: DEMO.conversations.weekend,
    name: 'Milo',
    tone: ['warm', 'witty', 'brief'],
    interests: ['Austin weekends', 'shared memories', 'fair plans'],
    boundaries: 'Never expose private constraints or embarrass a member.',
    initiative: 'balanced',
    allowHistory: true,
    allowNews: true,
    allowImages: true,
    allowPlans: true,
    createdByUserId: DEMO.users.ava,
  });

  const weekendMessages = Array.from({ length: 80 }, (_, index) => ({
    id: messageId(index),
    conversationId: DEMO.conversations.weekend,
    createdAt: new Date(Date.UTC(2026, 8, 1, 14 + index)),
    senderType: 'human' as const,
    senderUserId: memberUsers[index % memberUsers.length]!,
    kind: 'text' as const,
    body: historyLines[index % historyLines.length]!,
    aiGenerated: false,
    meta: { demo: true },
  }));
  const familyLines = [
    'Grandma Farah taught us the cardamom tea by smell, never by measuring.',
    'The blue recipe notebook came with the family to Texas in 1998.',
    'Uncle Omar planted the first jasmine beside the apartment steps.',
    'We should check the year before putting the Lahore chapter in the story.',
    'Laila has the photograph from the first Eid picnic in Austin.',
    'Please include my tea story, but leave out the school anecdote.',
    'Noor remembers everyone laughing when the samosas ran out in ten minutes.',
    'The Sunday calls started during the move and somehow never stopped.',
    'Ava can scan the recipe page as long as the family reviews it first.',
    'Let’s keep the draft private until every contributor approves it.',
  ];
  const familyMessages = familyLines.map((body, index) => ({
    id: messageId(index, true),
    conversationId: DEMO.conversations.family,
    createdAt: new Date(Date.UTC(2026, 9, 10, 16 + index)),
    senderType: 'human' as const,
    senderUserId: [DEMO.users.noor, DEMO.users.laila, DEMO.users.ava][index % 3]!,
    kind: 'text' as const,
    body,
    aiGenerated: false,
    meta: { demo: true, familyStoryInput: true },
  }));
  await db.insert(messages).values([...weekendMessages, ...familyMessages]);

  await db.insert(groupPreferences).values([
    {
      id: '00000000-0000-7000-8200-000000000001',
      conversationId: DEMO.conversations.weekend,
      userId: DEMO.users.ava,
      key: 'budget_max',
      value: 30,
      visibility: 'ai_only',
    },
    {
      id: '00000000-0000-7000-8200-000000000002',
      conversationId: DEMO.conversations.weekend,
      userId: DEMO.users.leo,
      key: 'dietary',
      value: ['vegetarian'],
      visibility: 'ai_only',
    },
    {
      id: '00000000-0000-7000-8200-000000000003',
      conversationId: DEMO.conversations.weekend,
      userId: DEMO.users.mia,
      key: 'likes',
      value: ['bookstores', 'design', 'outdoors'],
      visibility: 'group',
    },
    {
      id: '00000000-0000-7000-8200-000000000004',
      conversationId: DEMO.conversations.weekend,
      userId: DEMO.users.noor,
      key: 'travel_minutes',
      value: 25,
      visibility: 'ai_only',
    },
  ]);
  await db.insert(aiMemories).values([
    {
      id: '00000000-0000-7000-8300-000000000001',
      conversationId: DEMO.conversations.weekend,
      kind: 'joke',
      summary: 'The group calls ambitious itineraries “the side quest.”',
      sourceMessageIds: [messageId(6)],
      subjectUserIds: memberUsers,
      sensitivity: 'low',
      confidence: 0.98,
    },
    {
      id: '00000000-0000-7000-8300-000000000002',
      conversationId: DEMO.conversations.weekend,
      kind: 'event',
      summary: 'The waffle-maker game night was a favorite low-key activity.',
      sourceMessageIds: [messageId(5)],
      subjectUserIds: memberUsers,
      sensitivity: 'low',
      confidence: 0.95,
    },
    {
      id: '00000000-0000-7000-8300-000000000003',
      conversationId: DEMO.conversations.weekend,
      kind: 'preference',
      summary: 'The group often prefers central Austin and low-cost plans.',
      sourceMessageIds: [messageId(9)],
      subjectUserIds: memberUsers,
      sensitivity: 'medium',
      confidence: 0.9,
    },
  ]);

  await db.insert(mediaAssets).values([
    {
      id: DEMO.media[0],
      ownerUserId: DEMO.users.ava,
      kind: 'image',
      storageKey: 'demo/zilker-picnic.png',
      mime: 'image/png',
      width: 1080,
      height: 1350,
      captionAi: 'Consented demo photo: friends at a park picnic',
      consentScope: { conversations: [DEMO.conversations.weekend], demo: true },
      completedAt: now,
    },
    {
      id: DEMO.media[1],
      ownerUserId: DEMO.users.leo,
      kind: 'image',
      storageKey: 'demo/game-night.png',
      mime: 'image/png',
      width: 1080,
      height: 1350,
      captionAi: 'Consented demo photo: board-game table and snacks',
      consentScope: { conversations: [DEMO.conversations.weekend], demo: true },
      completedAt: now,
    },
    {
      id: DEMO.media[2],
      ownerUserId: DEMO.users.noor,
      kind: 'audio',
      storageKey: 'demo/waffle-maker.wav',
      mime: 'audio/wav',
      durationMs: 1700,
      transcript: "i'm bringing the waffle maker",
      transcriptStatus: 'done',
      consentScope: { conversations: [DEMO.conversations.weekend], demo: true },
      completedAt: now,
    },
    {
      id: DEMO.media[3],
      ownerUserId: DEMO.users.mia,
      kind: 'generated_image',
      storageKey: 'demo/weekend-art.png',
      mime: 'image/png',
      width: 1080,
      height: 1350,
      aiGenerated: true,
      generator: 'muse-image-demo-fixture',
      captionAi: 'AI illustration: warm Austin weekend still life',
      consentScope: { conversations: [DEMO.conversations.weekend], demo: true },
      completedAt: now,
    },
    {
      id: DEMO.media[4],
      ownerUserId: DEMO.users.laila,
      kind: 'generated_image',
      storageKey: 'demo/family-art.png',
      mime: 'image/png',
      width: 1080,
      height: 1350,
      aiGenerated: true,
      generator: 'muse-image-demo-fixture',
      captionAi: 'AI illustration: recipe notebook, tea, and jasmine',
      consentScope: { conversations: [DEMO.conversations.family], demo: true },
      completedAt: now,
    },
    ...[
      [DEMO.media[5], DEMO.users.ava, 'ava'],
      [DEMO.media[6], DEMO.users.leo, 'leo'],
      [DEMO.media[7], DEMO.users.mia, 'mia'],
      [DEMO.media[8], DEMO.users.noor, 'noor'],
    ].map(([id, ownerUserId, speaker]) => ({
      id: id!,
      ownerUserId: ownerUserId!,
      kind: 'audio' as const,
      storageKey: `demo/podcast-${speaker}.wav`,
      mime: 'audio/wav',
      durationMs: 20_000,
      transcript: `${speaker} shares one twenty-second moment for the weekend show.`,
      transcriptStatus: 'done' as const,
      consentScope: { conversations: [DEMO.conversations.weekend], podcast: true, demo: true },
      completedAt: now,
    })),
  ]);
  await db.insert(podcastShows).values({
    id: DEMO.podcast.show,
    conversationId: DEMO.conversations.weekend,
    title: 'Weekend Crew Radio',
    requiredParticipantIds: memberUsers,
    hostUserId: DEMO.users.ava,
  });
  await db.insert(podcastStations).values({
    id: DEMO.podcast.rootStation,
    showId: DEMO.podcast.show,
    topic: 'One small win from this week',
    participantIds: memberUsers,
  });
  await db.insert(voiceContributions).values(
    [DEMO.users.ava, DEMO.users.leo, DEMO.users.mia].map((userId, index) => ({
      id: DEMO.podcast.contributions[index]!,
      stationId: DEMO.podcast.rootStation,
      userId,
      mediaId: DEMO.media[index + 5]!,
      durationMs: 20_000,
      day: '2026-10-24',
      transcript: `${['Ava', 'Leo', 'Mia'][index]} shares one twenty-second moment for the weekend show.`,
    })),
  );
  await db.insert(posts).values([
    {
      id: DEMO.posts[0],
      authorAccountId: DEMO.accounts.ava,
      createdByUserId: DEMO.users.ava,
      kind: 'photo',
      caption: 'Saturday bouldering, followed by tacos.',
      topicTags: ['climbing', 'tacos', 'austin'],
      visibility: 'public',
    },
    {
      id: DEMO.posts[1],
      authorAccountId: DEMO.accounts.sam,
      createdByUserId: DEMO.users.sam,
      kind: 'photo',
      caption: 'Found a new wall and a new favorite route.',
      topicTags: ['climbing', 'outdoors', 'austin'],
      visibility: 'public',
    },
    {
      id: DEMO.posts[2],
      authorAccountId: DEMO.accounts.weekend,
      createdByUserId: DEMO.users.ava,
      kind: 'photo',
      caption: 'Our weekend mood, illustrated by Muse.',
      topicTags: ['friends', 'weekend', 'austin'],
      visibility: 'public',
      sourceKind: 'recap',
    },
  ]);
  await db.insert(postMedia).values([
    {
      postId: DEMO.posts[0],
      mediaId: DEMO.media[0],
      sortOrder: 0,
      altText: 'Demo climbing-day picnic photo',
    },
    { postId: DEMO.posts[1], mediaId: DEMO.media[1], sortOrder: 0, altText: 'Demo bouldering meetup photo' },
    {
      postId: DEMO.posts[2],
      mediaId: DEMO.media[3],
      sortOrder: 0,
      altText: 'AI-generated Austin weekend illustration',
    },
  ]);

  await db.insert(interestProfiles).values([
    {
      userId: DEMO.users.ava,
      explicitTags: ['climbing', 'film', 'tea'],
      inferred: { outdoors: 0.7 },
      discoverable: true,
      bioSnippet: 'Climber and film-camera optimist.',
    },
    {
      userId: DEMO.users.leo,
      explicitTags: ['live music', 'cycling', 'vegetarian food'],
      inferred: { concerts: 0.8 },
      discoverable: true,
      bioSnippet: 'Live music and long bike rides.',
    },
    {
      userId: DEMO.users.mia,
      explicitTags: ['design', 'bookstores', 'hiking'],
      inferred: { art: 0.65 },
      discoverable: true,
      bioSnippet: 'Design, books, and side quests.',
    },
    {
      userId: DEMO.users.noor,
      explicitTags: ['coffee', 'gardening', 'board games'],
      inferred: { community: 0.6 },
      discoverable: true,
      bioSnippet: 'Coffee, gardens, and cozy games.',
    },
    {
      userId: DEMO.users.sam,
      explicitTags: ['climbing', 'indie movies', 'tacos'],
      inferred: { outdoors: 0.8 },
      discoverable: true,
      bioSnippet: 'Bouldering and indie movies.',
    },
    {
      userId: DEMO.users.laila,
      explicitTags: ['family stories', 'gardening', 'cooking'],
      inferred: {},
      discoverable: false,
      bioSnippet: 'Recipes, stories, and jasmine.',
    },
  ]);

  const candidateRows = [
    [
      DEMO.candidates[0],
      'Barton Springs sunset picnic',
      'place',
      'https://www.austintexas.gov/department/barton-springs-pool',
      '2201 Barton Springs Rd, Austin',
      'Free park access',
    ],
    [
      DEMO.candidates[1],
      'Austin Bouldering Project session',
      'place',
      'https://austinboulderingproject.com/',
      '979 Springdale Rd, Austin',
      '$18–24',
    ],
    [DEMO.candidates[2], 'Board-game and waffle night', 'at_home', null, null, '$0–10'],
    [
      DEMO.candidates[3],
      'Virtual co-op game night',
      'online',
      'https://en.wikipedia.org/wiki/Cooperative_video_game',
      null,
      'Free options',
    ],
  ].map(([id, name, category, url, address, priceText], index) => ({
    id: id!,
    source: 'seed' as const,
    category: category as 'place' | 'at_home' | 'online',
    name: name!,
    url,
    address,
    priceText: priceText!,
    rating: index < 2 ? 4.7 : null,
    raw: { demo: true, priceAmount: [0, 24, 10, 0][index], travelMinutes: [18, 20, 0, 0][index] },
    lastVerifiedAt: now,
    dedupeKey: `demo-austin-${index + 1}`,
  }));
  await db.insert(candidates).values(candidateRows);
  await db.insert(recommendationTriggers).values({
    id: DEMO.trigger,
    conversationId: DEMO.conversations.weekend,
    kind: 'request',
    sourceMessageIds: [messageId(79)],
    confidence: 1,
  });
  await db.insert(planProposals).values({
    id: DEMO.proposal,
    conversationId: DEMO.conversations.weekend,
    triggerId: DEMO.trigger,
    brief: {
      goal: 'something fun together this weekend',
      whenText: 'Saturday',
      mode: 'either',
      categories: ['place', 'at_home', 'online'],
      hardConstraints: [],
      softPreferences: [],
      unknowns: [],
      searchQueries: [],
    },
    options: {
      options: candidateRows.slice(0, 3).map((candidate) => ({
        candidateId: candidate.id,
        headline: candidate.name,
        why: 'Fits the group’s shared interests and stated limits.',
        fitByMember: memberUsers.map((userId) => ({ userId, fit: 'great', note: 'within stated limits' })),
        logistics: { priceText: candidate.priceText },
      })),
      compromiseNote: 'Balances cost, travel, and variety.',
      noFeasibleOption: false,
      degraded: false,
    },
    version: 1,
    status: 'voting',
    createdBy: 'ai',
  });
  await db.insert(planVotes).values([
    {
      proposalId: DEMO.proposal,
      version: 1,
      userId: DEMO.users.ava,
      candidateId: DEMO.candidates[0],
      response: 'yes',
    },
    {
      proposalId: DEMO.proposal,
      version: 1,
      userId: DEMO.users.leo,
      candidateId: DEMO.candidates[0],
      response: 'flexible',
    },
  ]);
  await db.insert(groupPlans).values({
    id: DEMO.plan,
    proposalId: DEMO.proposal,
    conversationId: DEMO.conversations.weekend,
    candidateId: DEMO.candidates[2],
    title: 'Waffle-maker game night',
    startsAt: new Date('2026-09-12T19:00:00-05:00'),
    tz: 'America/Chicago',
    regionLabel: 'At home',
    confirmedByUserId: DEMO.users.ava,
    state: 'completed',
  });
  await db
    .insert(planRsvps)
    .values(memberUsers.map((userId) => ({ planId: DEMO.plan, userId, status: 'going' as const })));
  await db.insert(eventCandidates).values({
    id: DEMO.event,
    conversationId: DEMO.conversations.weekend,
    title: 'Waffle-maker game night',
    kind: 'game_night',
    startsAt: new Date('2026-09-12T19:00:00-05:00'),
    endsAt: new Date('2026-09-12T22:00:00-05:00'),
    confidence: 1,
    sourceMessageIds: [messageId(5)],
    planId: DEMO.plan,
    state: 'confirmed',
  });
  await db.insert(recaps).values({
    id: DEMO.recap,
    conversationId: DEMO.conversations.weekend,
    eventId: DEMO.event,
    planId: DEMO.plan,
    title: 'Waffles, games, and one dramatic comeback',
    caption: 'A private demo recap grounded in the group’s shared night.',
    layout: 'collage',
    mediaIds: [DEMO.media[0], DEMO.media[1]],
    coverMediaId: DEMO.media[0],
    musicLabel: 'warm and playful',
    factsUsed: [{ claim: 'The waffle-maker game night was a favorite.', sourceMessageId: messageId(5) }],
    state: 'ready_private',
    createdByAi: true,
  });
  await db.insert(recapMediaConsents).values([
    { recapId: DEMO.recap, mediaId: DEMO.media[0], ownerUserId: DEMO.users.ava, include: true },
    { recapId: DEMO.recap, mediaId: DEMO.media[1], ownerUserId: DEMO.users.leo, include: true },
  ]);

  return {
    users: userRows.length,
    groups: 2,
    messages: weekendMessages.length + familyMessages.length,
    media: DEMO.media.length,
    posts: DEMO.posts.length,
    candidates: DEMO.candidates.length,
    profiles: allUsers.length,
  };
}
