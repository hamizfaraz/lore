-- 002_hypertables.sql [C1] (idempotent: if_not_exists => true)
SELECT create_hypertable('messages', by_range('created_at', INTERVAL '7 days'), if_not_exists => true);
SELECT create_hypertable('engagement_events', by_range('at', INTERVAL '1 day'), if_not_exists => true);
SELECT create_hypertable('ai_decisions', by_range('at', INTERVAL '1 day'), if_not_exists => true);
SELECT create_hypertable('analytics_events', by_range('at', INTERVAL '1 day'), if_not_exists => true);
ALTER TABLE messages SET (timescaledb.compress, timescaledb.compress_segmentby = 'conversation_id');
SELECT add_compression_policy('messages', INTERVAL '30 days', if_not_exists => true);
