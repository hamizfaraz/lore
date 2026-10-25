import {
  account,
  aiMemories,
  aiPersonas,
  comments,
  conversationMembers,
  conversations,
  createDb,
  engagementEvents,
  eq,
  follows,
  inArray,
  interestProfiles,
  mediaAssets,
  messageReactions,
  messages,
  postLikes,
  postMedia,
  posts,
  postSaves,
  publishingPolicies,
  socialAccounts,
  stories,
  storyViews,
  user,
} from '../packages/db/src/index';
import { hashPassword } from '../apps/api/node_modules/better-auth/dist/crypto/index.mjs';
import { uuidv7 } from '../packages/shared/src/ids';

type DemoDb = ReturnType<typeof createDb>['db'];

const uid = (section: number, index: number) =>
  `10000000-0000-7000-${section.toString(16).padStart(4, '0')}-${index.toString().padStart(12, '0')}`;

const BASE_USERS = Array.from(
  { length: 6 },
  (_, i) => `00000000-0000-7000-8000-0000000001${String(i + 1).padStart(2, '0')}`,
);
const BASE_ACCOUNTS = Array.from(
  { length: 6 },
  (_, i) => `00000000-0000-7000-8000-0000000003${String(i + 1).padStart(2, '0')}`,
);

export const RICH = {
  users: [...BASE_USERS, ...Array.from({ length: 24 }, (_, i) => uid(0x1100, i + 7))],
  accounts: [...BASE_ACCOUNTS, ...Array.from({ length: 24 }, (_, i) => uid(0x1200, i + 7))],
  groupAccounts: Array.from({ length: 12 }, (_, i) => uid(0x1300, i + 1)),
  groupConversations: Array.from({ length: 12 }, (_, i) => uid(0x1400, i + 1)),
  dmConversations: Array.from({ length: 60 }, (_, i) => uid(0x1500, i + 1)),
  media: Array.from({ length: 56 }, (_, i) => uid(0x1600, i + 1)),
} as const;

const people = [
  [
    'Ava Chen',
    'avachen',
    'Climber, film-camera optimist, tea person. Usually planning the next low-key Austin adventure.',
    ['climbing', 'film', 'tea'],
  ],
  [
    'Leo Martinez',
    'leom',
    'Bike mechanic by day, live-music regular by night. Vegetarian and always carrying a spare tube.',
    ['cycling', 'live music', 'food'],
  ],
  [
    'Mia Brooks',
    'miab',
    'Product designer collecting bookstores, clever signs, and excellent side quests.',
    ['design', 'books', 'hiking'],
  ],
  [
    'Noor Rahman',
    'noorr',
    'Community gardener, coffee nerd, and undefeated host of cozy game nights.',
    ['coffee', 'gardening', 'games'],
  ],
  [
    'Sam Rivera',
    'samrivera',
    'Bouldering, street food, indie movies, and saying yes to plans before checking the weather.',
    ['climbing', 'movies', 'tacos'],
  ],
  [
    'Laila Iqbal',
    'lailaiqbal',
    'Family recipes, oral histories, jasmine plants, and a camera roll full of everyone I love.',
    ['cooking', 'family', 'gardening'],
  ],
  [
    'Jordan Kim',
    'jordank',
    'Frontend engineer, weekend potter, and relentless seeker of Austin’s best breakfast taco.',
    ['technology', 'ceramics', 'food'],
  ],
  [
    'Priya Shah',
    'priyashah',
    'Resident physician learning to protect slow mornings. Runs, reads, and makes ambitious soups.',
    ['running', 'books', 'cooking'],
  ],
  [
    'Marcus Green',
    'marcusg',
    'Music producer and vinyl collector. I document tiny venues before they become big venues.',
    ['music', 'photography', 'vinyl'],
  ],
  [
    'Elena Torres',
    'elenat',
    'Elementary art teacher painting murals, growing herbs, and making ordinary Tuesdays colorful.',
    ['art', 'teaching', 'gardening'],
  ],
  [
    'Theo Nguyen',
    'theong',
    'Data scientist, amateur astronomer, and person most likely to bring a spreadsheet to vacation.',
    ['astronomy', 'technology', 'travel'],
  ],
  [
    'Zara Ali',
    'zaraali',
    'Thrift stylist and creative director. Outfits, portraits, and honest conversations about design.',
    ['fashion', 'photography', 'design'],
  ],
  [
    'Ben Carter',
    'benc',
    'Trail runner, dog dad, and breakfast enthusiast. Outside whenever Texas weather permits.',
    ['running', 'dogs', 'outdoors'],
  ],
  [
    'Sofia Ramirez',
    'sofiar',
    'Pastry cook sharing experiments, neighborhood gems, and the occasional beautifully failed croissant.',
    ['baking', 'food', 'community'],
  ],
  [
    'Owen Patel',
    'owenp',
    'Architect sketching buildings, public spaces, and places that make cities feel human.',
    ['architecture', 'drawing', 'cities'],
  ],
  [
    'Nia Williams',
    'niaw',
    'Dancer, choreographer, and playlist maker. Movement is how I remember a place.',
    ['dance', 'music', 'wellness'],
  ],
  [
    'Eli Cohen',
    'elic',
    'Teacher, trivia captain, and defender of the long-form group chat message.',
    ['history', 'trivia', 'education'],
  ],
  [
    'Camila Santos',
    'camilas',
    'UX researcher, plant rescuer, and fan of conversations that change your mind.',
    ['research', 'plants', 'design'],
  ],
  [
    'Devon Price',
    'devonp',
    'Documentary photographer focused on food, labor, and the people behind neighborhood institutions.',
    ['photography', 'food', 'stories'],
  ],
  [
    'Mei Lin',
    'meilin',
    'Cellist, tea obsessive, and quiet-morning advocate. Currently learning three film scores.',
    ['music', 'tea', 'movies'],
  ],
  [
    'Andre Johnson',
    'andrej',
    'Youth soccer coach and backyard barbecue student. Community first, always.',
    ['soccer', 'community', 'cooking'],
  ],
  [
    'Fatima Khan',
    'fatimak',
    'Climate researcher, bird watcher, and maker of very detailed weekend itineraries.',
    ['climate', 'birds', 'travel'],
  ],
  [
    'Lucas Silva',
    'lucass',
    'Software builder, pickup football regular, and hobbyist espresso tinkerer.',
    ['technology', 'soccer', 'coffee'],
  ],
  [
    'Grace Park',
    'gracep',
    'Book editor with a soft spot for essays, old cinemas, and handwritten menus.',
    ['books', 'film', 'food'],
  ],
  [
    'Malik Thompson',
    'malikt',
    'Personal trainer who believes rest days count. Hiking, hoops, and cooking for friends.',
    ['fitness', 'basketball', 'outdoors'],
  ],
  [
    'Isabella Rossi',
    'isabellar',
    'Museum educator translating big ideas into curious afternoons and chaotic craft tables.',
    ['museums', 'art', 'education'],
  ],
  [
    'Hassan Ahmed',
    'hassana',
    'Civil engineer, home cook, and collector of stories from long train rides.',
    ['engineering', 'cooking', 'travel'],
  ],
  [
    'Ruby Foster',
    'rubyf',
    'Florist, analog photographer, and early-morning market person.',
    ['flowers', 'photography', 'markets'],
  ],
  [
    'Diego Morales',
    'diegom',
    'Sound designer recording cities, storms, kitchens, and everything in between.',
    ['audio', 'cities', 'nature'],
  ],
  [
    'Amara Okafor',
    'amarao',
    'Nonprofit organizer, poet, and believer in dinners where everyone brings one story.',
    ['poetry', 'community', 'food'],
  ],
] as const;

const groupDefs = [
  [
    'Austin After Five',
    'austinafterfive',
    'Weeknight discoveries, tiny concerts, and plans that actually leave the group chat.',
    'city',
  ],
  [
    'Sunday Table',
    'sundaytable',
    'A rotating dinner club for recipes, restaurant finds, and generous second helpings.',
    'food',
  ],
  [
    'Trail Mix',
    'trailmixatx',
    'Hikes, swimming holes, sunrise walks, and realistic carpool coordination.',
    'outdoors',
  ],
  [
    'Frame by Frame',
    'framebyframe',
    'Film photos, movie nights, editing notes, and neighborhood photo walks.',
    'photo',
  ],
  [
    'Side Project Society',
    'sideprojects',
    'Builders and artists helping each other finish the thing.',
    'creative',
  ],
  [
    'Bookmarked',
    'bookmarkedatx',
    'A book club with strong opinions, gentle spoilers, and excellent snacks.',
    'books',
  ],
  [
    'Green Thumbs',
    'greenthumbsatx',
    'Balcony gardens, native plants, seed swaps, and collective troubleshooting.',
    'garden',
  ],
  ['Pickup People', 'pickuppeople', 'Casual basketball, soccer, running, and post-game tacos.', 'sport'],
  [
    'Soundcheck',
    'soundcheckatx',
    'Musicians and listeners sharing demos, show tips, and local lineups.',
    'music',
  ],
  [
    'Design for Humans',
    'designforhumans',
    'Design critique without the ego: products, spaces, posters, and public life.',
    'design',
  ],
  [
    'Passport Pending',
    'passportpending',
    'Past trips, future routes, fare alerts, and delightfully specific packing lists.',
    'travel',
  ],
  [
    'Neighbors Helping',
    'neighborshelping',
    'Mutual aid, volunteer days, local resources, and small acts that add up.',
    'community',
  ],
] as const;

const topics = {
  city: [
    'The light downtown did all the work tonight.',
    'A quiet corner hiding one block from the crowd.',
    'Weeknight plans are officially underrated.',
  ],
  food: [
    'Made enough for everyone and somehow still want seconds.',
    'The crispy edge deserves its own appreciation post.',
    'A very serious field study in neighborhood desserts.',
  ],
  outdoors: [
    'Worth waking up before the group chat did.',
    'Trail dust, cold water, and absolutely no complaints.',
    'Proof that we eventually left the parking lot.',
  ],
  photo: [
    'One roll, thirty-six chances, and this frame stayed with me.',
    'Color, shadow, and the five seconds before everyone noticed the camera.',
    'From today’s slow walk with no destination.',
  ],
  creative: [
    'The messy middle is starting to look like something.',
    'Made with too much coffee and exactly the right collaborators.',
    'Version seven, but who is counting?',
  ],
  books: [
    'Underlined half the chapter and texted everyone the other half.',
    'Current read, current snack, current refusal to move.',
    'This one changed the conversation.',
  ],
  garden: [
    'The balcony is doing its best impression of a jungle.',
    'First bloom after weeks of checking every morning.',
    'Seed swap success story.',
  ],
  sport: [
    'Close game, great people, elite post-game tacos.',
    'A little tired and a lot happier.',
    'The group showed up, which is the real win.',
  ],
  music: [
    'Still hearing the encore this morning.',
    'A rough mix with one moment I really love.',
    'Small room, enormous sound.',
  ],
  design: [
    'The best detail is the one you almost miss.',
    'A tiny usability win worth celebrating.',
    'Sketches from a place built for lingering.',
  ],
  travel: [
    'The detour became the whole story.',
    'Postcard evidence that the early train was worth it.',
    'A map, a snack, and no strict schedule.',
  ],
  community: [
    'A full table and a very short cleanup because everyone stayed.',
    'Small neighborhood win, big collective energy.',
    'People showed up for each other today.',
  ],
} as const;

const topicKeys = Object.keys(topics) as Array<keyof typeof topics>;
const postCounts = [
  12, 10, 9, 8, 8, 7, 7, 6, 6, 5, 5, 4, 4, 4, 3, 3, 3, 2, 2, 2, 2, 1, 1, 1, 1, 0, 0, 5, 8, 3,
];

const richUserIds = RICH.users.slice(6);
const richAccountIds = RICH.accounts.slice(6);
const allRichConversationIds = [...RICH.groupConversations, ...RICH.dmConversations];
const richPostIds = Array.from({ length: 220 }, (_, i) => uid(0x1700, i + 1));
const richStoryIds = Array.from({ length: 50 }, (_, i) => uid(0x1800, i + 1));

export async function clearRichDemo(db: DemoDb) {
  await db.delete(storyViews).where(inArray(storyViews.storyId, richStoryIds));
  await db.delete(stories).where(inArray(stories.id, richStoryIds));
  await db.delete(comments).where(inArray(comments.postId, richPostIds));
  await db.delete(postLikes).where(inArray(postLikes.postId, richPostIds));
  await db.delete(postSaves).where(inArray(postSaves.postId, richPostIds));
  await db.delete(engagementEvents).where(inArray(engagementEvents.targetId, richPostIds));
  await db.delete(postMedia).where(inArray(postMedia.postId, richPostIds));
  await db.delete(posts).where(inArray(posts.id, richPostIds));
  await db.delete(follows).where(inArray(follows.followerAccountId, [...RICH.accounts]));
  await db.delete(messageReactions).where(inArray(messageReactions.userId, [...RICH.users]));
  await db.delete(messages).where(inArray(messages.conversationId, allRichConversationIds));
  await db.delete(aiMemories).where(inArray(aiMemories.conversationId, [...RICH.groupConversations]));
  await db.delete(aiPersonas).where(inArray(aiPersonas.conversationId, [...RICH.groupConversations]));
  await db
    .delete(conversationMembers)
    .where(inArray(conversationMembers.conversationId, allRichConversationIds));
  await db.delete(publishingPolicies).where(inArray(publishingPolicies.accountId, [...RICH.groupAccounts]));
  await db.delete(socialAccounts).where(inArray(socialAccounts.id, [...RICH.groupAccounts]));
  await db.delete(conversations).where(inArray(conversations.id, allRichConversationIds));
  await db.delete(interestProfiles).where(inArray(interestProfiles.userId, richUserIds));
  await db.delete(socialAccounts).where(inArray(socialAccounts.id, richAccountIds));
  await db.delete(mediaAssets).where(inArray(mediaAssets.id, [...RICH.media]));
  await db.delete(user).where(inArray(user.id, richUserIds));
}

export async function seedRichDemo(db: DemoDb, now = new Date()) {
  const password = await hashPassword('password123');
  const newUsers = people.slice(6).map(([name, handle], i) => ({
    id: richUserIds[i]!,
    name,
    email: `${handle}.demo@ourlore.test`,
    emailVerified: true,
    image: `https://i.pravatar.cc/512?img=${i + 7}`,
    createdAt: new Date(now.getTime() - (180 - i * 3) * 86_400_000),
  }));
  await db.insert(user).values(newUsers);
  await db.insert(account).values(
    newUsers.map((row) => ({
      id: uuidv7(),
      accountId: row.id,
      providerId: 'credential',
      userId: row.id,
      password,
    })),
  );

  for (let i = 0; i < 6; i++) {
    await db
      .update(socialAccounts)
      .set({
        bio: people[i]![2],
        avatarUrl: `https://i.pravatar.cc/512?img=${i + 1}`,
      })
      .where(eq(socialAccounts.id, RICH.accounts[i]!));
  }
  await db.insert(socialAccounts).values(
    people.slice(6).map(([name, handle, bio], i) => ({
      id: richAccountIds[i]!,
      type: 'personal' as const,
      ownerUserId: richUserIds[i]!,
      handle,
      displayName: name,
      bio,
      avatarUrl: `https://i.pravatar.cc/512?img=${i + 7}`,
      visibility: 'public' as const,
      onboardedAt: new Date(now.getTime() - (170 - i * 2) * 86_400_000),
    })),
  );

  await db.insert(mediaAssets).values(
    RICH.media.map((id, i) => {
      const video = i >= 48;
      return {
        id,
        ownerUserId: RICH.users[i % 30]!,
        kind: video ? ('video' as const) : ('image' as const),
        storageKey: `demo/rich/${video ? `reel-${String(i - 47).padStart(2, '0')}.mp4` : `photo-${String(i + 1).padStart(2, '0')}.jpg`}`,
        mime: video ? 'video/mp4' : 'image/jpeg',
        bytes: video ? 1_200_000 : 220_000,
        width: 1080,
        height: 1350,
        durationMs: video ? 6_000 : null,
        captionAi: `${topicKeys[i % topicKeys.length]} lifestyle demo media`,
        consentScope: { publicDemo: true, source: 'Lorem Picsum / Unsplash' },
        completedAt: now,
        createdAt: new Date(now.getTime() - (60 - (i % 50)) * 86_400_000),
      };
    }),
  );

  await db.insert(conversations).values(
    groupDefs.map(([name], i) => ({
      id: RICH.groupConversations[i]!,
      kind: 'group' as const,
      title: name,
      createdByUserId: RICH.users[(i * 2) % 30]!,
      groupAccountId: RICH.groupAccounts[i]!,
      joinSlug: `demo-${groupDefs[i]![1]}`,
      joinCode: `LORE${String(i + 1).padStart(2, '0')}`,
      lastMessageAt: new Date(now.getTime() - (i % 4) * 3_600_000),
      createdAt: new Date(now.getTime() - (120 - i * 3) * 86_400_000),
    })),
  );
  await db.insert(socialAccounts).values(
    groupDefs.map(([name, handle, bio], i) => ({
      id: RICH.groupAccounts[i]!,
      type: 'group' as const,
      handle,
      displayName: name,
      bio,
      avatarUrl: `https://picsum.photos/seed/lore-group-${i + 1}/512/512`,
      visibility: 'public' as const,
      conversationId: RICH.groupConversations[i]!,
      primaryAdminUserId: RICH.users[(i * 2) % 30]!,
    })),
  );
  await db.insert(publishingPolicies).values(
    RICH.groupAccounts.map((accountId, i) => ({
      accountId,
      mode: i % 3 === 0 ? ('unanimous' as const) : ('threshold' as const),
      threshold: i % 3 === 0 ? null : 3,
      updatedBy: RICH.users[(i * 2) % 30]!,
    })),
  );

  const groupMemberships = groupDefs.flatMap((_, gi) =>
    Array.from({ length: 10 }, (_, offset) => {
      const personIndex = (gi * 5 + offset * 3) % 30;
      return {
        conversationId: RICH.groupConversations[gi]!,
        userId: RICH.users[personIndex]!,
        role:
          offset === 0 ? ('primary_admin' as const) : offset < 3 ? ('admin' as const) : ('member' as const),
        aiHistoryConsent: offset !== 9,
        joinedAt: new Date(now.getTime() - (100 - gi * 2 - offset) * 86_400_000),
      };
    }),
  );
  await db.insert(conversationMembers).values(groupMemberships);

  const dmPairs = Array.from({ length: 60 }, (_, i) => [i % 30, (i + (i < 30 ? 1 : 7)) % 30] as const);
  await db.insert(conversations).values(
    dmPairs.map((pair, i) => ({
      id: RICH.dmConversations[i]!,
      kind: 'dm' as const,
      createdByUserId: RICH.users[pair[0]]!,
      lastMessageAt: new Date(now.getTime() - (i % 36) * 3_600_000),
      createdAt: new Date(now.getTime() - (70 - (i % 20)) * 86_400_000),
    })),
  );
  await db.insert(conversationMembers).values(
    dmPairs.flatMap((pair, i) =>
      pair.map((pi) => ({
        conversationId: RICH.dmConversations[i]!,
        userId: RICH.users[pi]!,
        role: 'member' as const,
        aiHistoryConsent: true,
        joinedAt: new Date(now.getTime() - 65 * 86_400_000),
      })),
    ),
  );

  const chatLines = [
    'Are we still thinking Saturday afternoon?',
    'I can drive if everyone meets near me.',
    'That photo made me laugh all over again.',
    'I found a place with vegetarian options and a patio.',
    'Give me twenty minutes and I can be ready.',
    'Saving this idea for the next free weekend.',
    'I’m in, but I need to be home before nine.',
    'This reminds me of the trip where we missed the last bus.',
    'Can someone add the address to the plan?',
    'I’ll bring snacks if somebody else handles the playlist.',
    'The quieter table in the back would be perfect.',
    'We should take a group photo before everyone leaves.',
  ];
  const groupMessages = groupDefs.flatMap(([name, , , topic], gi) =>
    Array.from({ length: 100 }, (_, mi) => ({
      id: uid(0x1900 + gi, mi + 1),
      conversationId: RICH.groupConversations[gi]!,
      createdAt: new Date(now.getTime() - 45 * 86_400_000 + mi * 10.5 * 3_600_000),
      senderType: 'human' as const,
      senderUserId: groupMemberships[gi * 10 + (mi % 10)]!.userId,
      kind: 'text' as const,
      body:
        mi % 9 === 0
          ? `${name}: ${topics[topic as keyof typeof topics][mi % 3]}`
          : chatLines[(mi + gi) % chatLines.length]!,
      aiGenerated: false,
      meta: { demo: true, richContext: true },
    })),
  );
  const dmMessages = dmPairs.flatMap((pair, di) =>
    Array.from({ length: 28 }, (_, mi) => ({
      id: uid(0x1a00 + di, mi + 1),
      conversationId: RICH.dmConversations[di]!,
      createdAt: new Date(now.getTime() - 42 * 86_400_000 + mi * 34 * 3_600_000),
      senderType: 'human' as const,
      senderUserId: RICH.users[pair[mi % 2]]!,
      kind: 'text' as const,
      body: chatLines[(mi * 3 + di) % chatLines.length]!,
      aiGenerated: false,
      meta: { demo: true, directContext: true },
    })),
  );
  await db.insert(messages).values([...groupMessages, ...dmMessages]);

  await db.insert(aiPersonas).values(
    groupDefs.map(([name, , , topic], i) => ({
      id: uid(0x1b00, i + 1),
      conversationId: RICH.groupConversations[i]!,
      name: i % 2 ? 'Milo' : 'Mila',
      tone: ['warm', 'specific', i % 3 === 0 ? 'playful' : 'brief'],
      interests: [topic, name.toLowerCase()],
      boundaries:
        'Protect private constraints, avoid assumptions, and keep suggestions grounded in group history.',
      initiative: i % 4 === 0 ? 'proactive' : 'balanced',
      allowHistory: true,
      allowNews: true,
      allowImages: true,
      allowPlans: true,
      createdByUserId: RICH.users[(i * 2) % 30]!,
    })),
  );
  await db.insert(aiMemories).values(
    groupDefs.flatMap(([name, , , topic], gi) =>
      [0, 1, 2].map((m) => ({
        id: uid(0x1c00 + gi, m + 1),
        conversationId: RICH.groupConversations[gi]!,
        kind: m === 0 ? ('preference' as const) : m === 1 ? ('event' as const) : ('joke' as const),
        summary: [
          `${name} prefers plans that are affordable, nearby, and easy to coordinate.`,
          `The group’s last ${topic} outing became a favorite shared memory.`,
          'The group jokes that every simple plan eventually becomes a side quest.',
        ][m]!,
        sourceMessageIds: [uid(0x1900 + gi, 10 + m)],
        subjectUserIds: groupMemberships.slice(gi * 10, gi * 10 + 10).map((x) => x.userId),
        sensitivity: m === 0 ? ('medium' as const) : ('low' as const),
        confidence: 0.9 + m * 0.03,
      })),
    ),
  );

  const followRows = RICH.accounts.flatMap((from, i) =>
    RICH.accounts
      .filter((_, j) => i !== j)
      .map((to, j) => ({
        followerAccountId: from,
        targetAccountId: to,
        status: 'active' as const,
        createdAt: new Date(now.getTime() - ((i * 7 + j) % 120) * 86_400_000),
      })),
  );
  await db.insert(follows).values(followRows);

  let postIndex = 0;
  const postRows: Array<typeof posts.$inferInsert> = [];
  const mediaLinks: Array<typeof postMedia.$inferInsert> = [];
  const postTopic: Array<keyof typeof topics> = [];
  for (let pi = 0; pi < 30; pi++) {
    for (let p = 0; p < postCounts[pi]!; p++) {
      const id = richPostIds[postIndex]!;
      const topic = topicKeys[(pi + p) % topicKeys.length]!;
      const reel = (p + pi) % 6 === 0;
      const carousel = !reel && (p + pi) % 4 === 0;
      postRows.push({
        id,
        authorAccountId: RICH.accounts[pi]!,
        createdByUserId: RICH.users[pi]!,
        kind: reel ? 'reel' : carousel ? 'carousel' : 'photo',
        caption: topics[topic][p % 3],
        altText: `Demo ${topic} moment`,
        visibility: 'public',
        locationLabel: p % 3 === 0 ? 'Austin, Texas' : null,
        topicTags: [topic, people[pi]![3][p % 3]!, p % 2 ? 'friends' : 'weekend'],
        publishedAt: new Date(now.getTime() - ((pi * 3 + p * 5) % 70) * 86_400_000 - p * 3_600_000),
      });
      const linkCount = carousel ? 3 : 1;
      for (let m = 0; m < linkCount; m++)
        mediaLinks.push({
          postId: id,
          mediaId: reel ? RICH.media[48 + ((pi + p) % 8)]! : RICH.media[(pi * 5 + p + m) % 48]!,
          sortOrder: m,
          altText: `${topic} demo ${m + 1}`,
        });
      postTopic.push(topic);
      postIndex++;
    }
  }
  for (let gi = 0; gi < 12; gi++) {
    for (let p = 0; p < 3; p++) {
      const id = richPostIds[postIndex]!;
      const topic = groupDefs[gi]![3] as keyof typeof topics;
      postRows.push({
        id,
        authorAccountId: RICH.groupAccounts[gi]!,
        createdByUserId: RICH.users[(gi * 2) % 30]!,
        kind: p === 2 ? 'reel' : p === 1 ? 'carousel' : 'photo',
        caption: topics[topic][p],
        altText: `${groupDefs[gi]![0]} demo post`,
        visibility: 'public',
        topicTags: [topic, 'group', 'friends'],
        likeCount: 0,
        commentCount: 0,
        publishedAt: new Date(now.getTime() - (gi * 2 + p * 6) * 86_400_000),
      });
      const count = p === 1 ? 3 : 1;
      for (let m = 0; m < count; m++)
        mediaLinks.push({
          postId: id,
          mediaId: p === 2 ? RICH.media[48 + (gi % 8)]! : RICH.media[(gi * 4 + p + m) % 48]!,
          sortOrder: m,
          altText: `${topic} group moment ${m + 1}`,
        });
      postTopic.push(topic);
      postIndex++;
    }
  }
  await db.insert(posts).values(postRows);
  await db.insert(postMedia).values(mediaLinks);

  const commentLines = [
    'This is exactly the energy I needed today.',
    'That last slide is perfect.',
    'Okay, adding this to our next plan.',
    'The colors in this are unreal.',
    'Still laughing about what happened five minutes later.',
    'You always find the best spots.',
    'This turned out so well!',
    'I can confirm it was even better in person.',
  ];
  const commentRows: Array<typeof comments.$inferInsert> = [];
  const likeRows: Array<typeof postLikes.$inferInsert> = [];
  const saveRows: Array<typeof postSaves.$inferInsert> = [];
  postRows.forEach((post, i) => {
    const commentsForPost = 2 + ((i * 7) % 7);
    const likesForPost = 6 + ((i * 11) % 22);
    for (let c = 0; c < commentsForPost; c++) {
      const author = (i + c * 5 + 3) % 30;
      commentRows.push({
        id: uid(0x1d00 + Math.floor(i / 100), i * 10 + c + 1),
        postId: post.id!,
        authorAccountId: RICH.accounts[author]!,
        body:
          c === 0
            ? `The ${postTopic[i]} details make this one.`
            : commentLines[(i + c) % commentLines.length]!,
        createdAt: new Date(new Date(post.publishedAt!).getTime() + (c + 1) * 43 * 60_000),
      });
    }
    const liked = new Set<number>();
    for (let l = 0; l < likesForPost; l++) liked.add((i * 3 + l * 7) % 30);
    for (const person of liked)
      likeRows.push({
        postId: post.id!,
        userId: RICH.users[person]!,
        createdAt: new Date(new Date(post.publishedAt!).getTime() + (person + 1) * 31 * 60_000),
      });
    for (let s = 0; s < i % 5; s++)
      saveRows.push({ postId: post.id!, userId: RICH.users[(i + s * 11) % 30]! });
    post.likeCount = liked.size;
    post.commentCount = commentsForPost;
  });
  // Counts are denormalized; update after engagement rows are prepared.
  await db.insert(comments).values(commentRows);
  await db.insert(postLikes).values(likeRows);
  if (saveRows.length) await db.insert(postSaves).values(saveRows);
  for (let i = 0; i < postRows.length; i++)
    await db
      .update(posts)
      .set({
        likeCount: postRows[i]!.likeCount,
        commentCount: postRows[i]!.commentCount,
      })
      .where(eq(posts.id, postRows[i]!.id!));

  const storyAccounts = [...RICH.accounts, ...RICH.groupAccounts];
  const storyNow = new Date();
  const storyRows = storyAccounts.map((authorAccountId, i) => ({
    id: richStoryIds[i]!,
    authorAccountId,
    createdByUserId: RICH.users[i % 30]!,
    mediaId: RICH.media[(i * 3) % 48]!,
    caption: i < 30 ? `Today with ${people[i]![0].split(' ')[0]}` : groupDefs[i - 30]![0],
    createdAt: new Date(storyNow.getTime() - (i % 18) * 3_600_000),
    expiresAt: new Date(storyNow.getTime() + (24 - (i % 18)) * 3_600_000),
  }));
  await db.insert(stories).values(storyRows);
  await db.insert(storyViews).values(
    storyRows.flatMap((story, i) =>
      Array.from({ length: 4 + (i % 8) }, (_, v) => ({
        storyId: story.id,
        viewerUserId: RICH.users[(i + v + 1) % 30]!,
        viewedAt: new Date(story.createdAt.getTime() + (v + 1) * 12 * 60_000),
      })),
    ),
  );

  await db.insert(interestProfiles).values(
    people.slice(6).map(([, , , tags], i) => ({
      userId: richUserIds[i]!,
      explicitTags: [...tags],
      inferred: { [tags[0]]: 0.85, [tags[1]]: 0.65 },
      inferredTouched: {},
      graphTags: [],
      discoverable: i % 7 !== 0,
      bioSnippet: people[i + 6]![2].slice(0, 90),
    })),
  );

  return {
    richUsers: 24,
    totalPeople: 30,
    richGroups: 12,
    richPosts: postRows.length,
    richComments: commentRows.length,
    richLikes: likeRows.length,
    richStories: storyRows.length,
    richConversations: allRichConversationIds.length,
    richMessages: groupMessages.length + dmMessages.length,
    follows: followRows.length,
    richMedia: RICH.media.length,
  };
}
