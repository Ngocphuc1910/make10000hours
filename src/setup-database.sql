-- Minimal database setup for AI chatbot - Updated version
-- Run this in your Supabase SQL editor

-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Drop existing policy if it exists to avoid conflicts
DROP POLICY IF EXISTS "Users can only access their own documents" ON user_productivity_documents;

-- Create user_productivity_documents table
CREATE TABLE IF NOT EXISTS user_productivity_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  content_type text NOT NULL,
  content text NOT NULL,
  embedding vector(1536),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance (IF NOT EXISTS handles duplicates)
CREATE INDEX IF NOT EXISTS user_productivity_documents_user_id_idx 
ON user_productivity_documents (user_id);

CREATE INDEX IF NOT EXISTS user_productivity_documents_content_type_idx 
ON user_productivity_documents (user_id, content_type);

CREATE INDEX IF NOT EXISTS user_productivity_documents_created_at_idx 
ON user_productivity_documents (created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE user_productivity_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policy - users can only access their own documents
CREATE POLICY "Users can only access their own documents" 
ON user_productivity_documents
FOR ALL 
USING (user_id = auth.uid()::text);

-- Drop existing function if it exists to avoid conflicts
DROP FUNCTION IF EXISTS match_user_documents(vector, float, int, text);

-- Create simple match function for vector similarity
CREATE OR REPLACE FUNCTION match_user_documents(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 10,
  filter_user_id text DEFAULT NULL
)
RETURNS table (
  id uuid,
  content text,
  metadata jsonb,
  content_type text,
  created_at timestamptz,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    upd.id,
    upd.content,
    upd.metadata,
    upd.content_type,
    upd.created_at,
    1 - (upd.embedding <=> query_embedding) as similarity
  FROM user_productivity_documents upd
  WHERE 
    (filter_user_id IS NULL OR upd.user_id = filter_user_id)
    AND upd.embedding IS NOT NULL
    AND 1 - (upd.embedding <=> query_embedding) >= match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- Verify setup
SELECT 'Database setup completed successfully!' as status; 