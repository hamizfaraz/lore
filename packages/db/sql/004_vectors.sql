-- 004_vectors.sql [C2] (DiskANN, cosine)
CREATE INDEX IF NOT EXISTS ai_memories_emb ON ai_memories USING diskann (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS interest_profiles_emb ON interest_profiles USING diskann (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS candidates_emb ON candidates USING diskann (embedding vector_cosine_ops);
