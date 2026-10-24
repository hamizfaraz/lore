-- 005_search.sql [C2] : Explore. Prefer BM25 if pg_textsearch is available on the service;
-- otherwise this tsvector + GIN fallback is the shipped path.
CREATE INDEX IF NOT EXISTS posts_search ON posts USING gin (search_tsv);
