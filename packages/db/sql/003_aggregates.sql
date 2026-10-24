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

-- If the continuous aggregate over unnest() is rejected by your TimescaleDB version, C2 replaces this
-- with a plain view refreshed by a job (plan section 5).
CREATE MATERIALIZED VIEW IF NOT EXISTS engagement_topics_1d
WITH (timescaledb.continuous, timescaledb.materialized_only = false) AS
SELECT time_bucket('1 day', at) AS bucket, actor_user_id, unnest(topic_tags) AS tag,
       count(*) FILTER (WHERE kind IN ('like','save','share','view_3s')) AS signals
FROM engagement_events GROUP BY 1, 2, 3 WITH NO DATA;
