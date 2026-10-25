import postgres from '../packages/db/node_modules/postgres/src/index.js';

const database =
  process.argv.find((arg) => arg.startsWith('--database='))?.slice('--database='.length) ??
  process.env.LORE_SEED_DATABASE_URL ??
  process.env.DATABASE_URL;

if (!database) throw new Error('Pass --database=postgres://… or set LORE_SEED_DATABASE_URL.');

const sql = postgres(database, { max: 1 });

const [summary] = await sql<
  Array<{
    people: number;
    complete_profiles: number;
    follows: number;
    all_follows: number;
    active_stories: number;
    groups: number;
    group_stories: number;
    posts: number;
    posts_with_media: number;
    posts_with_comments: number;
    posts_with_likes: number;
    reels: number;
    carousels: number;
    group_posts: number;
    group_conversations: number;
    dm_conversations: number;
    messages: number;
  }>
>`
  with demo_users as (
    select id from "user" where email like '%.demo@ourlore.test' or email = 'ava.demo@ourlore.test'
  ), people as (
    select sa.* from social_accounts sa join demo_users du on du.id = sa.owner_user_id
    where sa.type = 'personal'
  ), demo_groups as (
    select * from social_accounts where id::text like '10000000-0000-7000-8000-1300%'
  ), demo_posts as (
    select * from posts where id::text like '10000000-0000-7000-8000-1700%'
  )
  select
    (select count(*)::int from people) people,
    (select count(*)::int from people where bio is not null and length(bio) >= 30 and avatar_url is not null) complete_profiles,
    (select count(*)::int from follows f join people a on a.id=f.follower_account_id
      join people b on b.id=f.target_account_id where f.status='active' and a.id<>b.id) follows,
    (select count(*)::int from follows f
      where f.status='active'
        and f.follower_account_id in (select id from people union select id from demo_groups)
        and f.target_account_id in (select id from people union select id from demo_groups)
        and f.follower_account_id<>f.target_account_id) all_follows,
    (select count(*)::int from stories s join people p on p.id=s.author_account_id where s.expires_at > now()) active_stories,
    (select count(*)::int from demo_groups) groups,
    (select count(*)::int from stories s join demo_groups g on g.id=s.author_account_id where s.expires_at > now()) group_stories,
    (select count(*)::int from demo_posts) posts,
    (select count(distinct dp.id)::int from demo_posts dp join post_media pm on pm.post_id=dp.id) posts_with_media,
    (select count(distinct dp.id)::int from demo_posts dp join comments c on c.post_id=dp.id) posts_with_comments,
    (select count(distinct dp.id)::int from demo_posts dp join post_likes pl on pl.post_id=dp.id) posts_with_likes,
    (select count(*)::int from demo_posts where kind='reel') reels,
    (select count(*)::int from demo_posts where kind='carousel') carousels,
    (select count(*)::int from demo_posts dp join demo_groups g on g.id=dp.author_account_id) group_posts,
    (select count(*)::int from conversations where id::text like '10000000-0000-7000-8000-1400%') group_conversations,
    (select count(*)::int from conversations where id::text like '10000000-0000-7000-8000-1500%') dm_conversations,
    (select count(*)::int from messages where meta->>'demo'='true') messages
`;

const membership = await sql<
  Array<{ min_groups: number; max_groups: number; min_dms: number; max_dms: number }>
>`
  with demo_users as (
    select id from "user" where email like '%.demo@ourlore.test' or email = 'ava.demo@ourlore.test'
  ), per_user as (
    select du.id,
      count(distinct cm.conversation_id) filter (where c.id::text like '10000000-0000-7000-8000-1400%')::int groups,
      count(distinct cm.conversation_id) filter (where c.id::text like '10000000-0000-7000-8000-1500%')::int dms
    from demo_users du
    left join conversation_members cm on cm.user_id=du.id and cm.removed_at is null
    left join conversations c on c.id=cm.conversation_id
    group by du.id
  )
  select min(groups)::int min_groups, max(groups)::int max_groups,
    min(dms)::int min_dms, max(dms)::int max_dms from per_user
`;

const [distribution] = await sql<Array<{ min_posts: number; max_posts: number; zero_post_accounts: number }>>`
  with demo_users as (
    select id from "user" where email like '%.demo@ourlore.test' or email = 'ava.demo@ourlore.test'
  ), people as (
    select sa.id from social_accounts sa join demo_users du on du.id=sa.owner_user_id where sa.type='personal'
  ), totals as (
    select p.id, count(dp.id)::int posts from people p left join posts dp on dp.author_account_id=p.id
      and dp.id::text like '10000000-0000-7000-8000-1700%' group by p.id
  )
  select min(posts)::int min_posts, max(posts)::int max_posts,
    count(*) filter (where posts=0)::int zero_post_accounts from totals
`;

const [history] = await sql<Array<{ oldest: Date; newest: Date }>>`
  select min(created_at) oldest, max(created_at) newest from messages where meta->>'demo'='true'
`;

const checks: Record<string, boolean> = {
  people: summary.people === 30,
  completeProfiles: summary.complete_profiles === 30,
  mutualFollowGraph: summary.follows === 30 * 29,
  everyIdentityFollowsEveryOther: summary.all_follows === 42 * 41,
  personalStories: summary.active_stories === 30,
  groupAccounts: summary.groups === 12,
  groupStories: summary.group_stories === 12,
  richPosts: summary.posts === 168,
  everyPostHasMedia: summary.posts_with_media === summary.posts,
  everyPostHasComments: summary.posts_with_comments === summary.posts,
  everyPostHasLikes: summary.posts_with_likes === summary.posts,
  mixedMedia: summary.reels > 0 && summary.carousels > 0,
  groupPosts: summary.group_posts === 36,
  groupChats: summary.group_conversations === 12,
  directMessages: summary.dm_conversations === 60,
  messageContext: summary.messages >= 2880,
  groupMembershipRange: membership[0]!.min_groups >= 3 && membership[0]!.max_groups <= 8,
  everyAccountHasDms: membership[0]!.min_dms > 0,
  variedPostCounts: distribution.min_posts === 0 && distribution.max_posts >= 10,
  monthOfHistory: history.oldest.getTime() <= Date.now() - 30 * 86_400_000,
};

console.log(
  JSON.stringify(
    {
      ok: Object.values(checks).every(Boolean),
      checks,
      summary,
      membership: membership[0],
      distribution,
      history,
    },
    null,
    2,
  ),
);
await sql.end();
if (!Object.values(checks).every(Boolean)) process.exitCode = 1;
