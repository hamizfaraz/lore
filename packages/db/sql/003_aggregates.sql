-- 003_aggregates.sql [C2] : drives Milo's proactivity and the impact page
CREATE MATERIALIZED VIEW IF NOT EXISTS conv_activity_5m
WITH (timescaledb.continuous, timescaledb.materialized_only = false) AS
SELECT time_bucket('5 minutes', created_at) AS bucket, conversation_id,
       count(*) FILTER (WHERE sender_type = 'human') AS human_msgs,
       count(*) FILTER (WHERE sender_type = 'ai')    AS ai_msgs,
       count(DISTINCT sender_user_id)                AS speakers,
       max(created_at)                                AS last_at
FROM messages GROUP BY 1, 2 WITH NO DATA;
SELECT add_continuous_aggregate_policy('conv_activity_5m',
  start_offset => INTERVAL '2 days', end_offset => INTERVAL '1 minute',
  schedule_interval => INTERVAL '1 minute', if_not_exists => true);

-- TimescaleDB 2.17 rejects a continuous aggregate containing unnest(). This derived view is small,
-- portable PostgreSQL, and is refreshed by the impact worker instead.
DROP MATERIALIZED VIEW IF EXISTS engagement_topics_1d;
CREATE MATERIALIZED VIEW engagement_topics_1d AS
SELECT date_trunc('day', e.at) AS bucket, e.actor_user_id, topic.tag,
       count(*) FILTER (WHERE e.kind IN ('like','save','share','view_3s')) AS signals
FROM engagement_events e
CROSS JOIN LATERAL unnest(e.topic_tags) AS topic(tag)
GROUP BY 1, 2, 3;
CREATE UNIQUE INDEX IF NOT EXISTS engagement_topics_1d_unique
  ON engagement_topics_1d (bucket, actor_user_id, tag);
