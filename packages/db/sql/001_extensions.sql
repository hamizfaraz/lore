-- 001_extensions.sql [C1]
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS vectorscale CASCADE;   -- pulls in pgvector
CREATE EXTENSION IF NOT EXISTS citext;
