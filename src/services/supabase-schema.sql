-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Create embeddings table with vector support
CREATE TABLE IF NOT EXISTS embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  content_type text NOT NULL CHECK (content_type IN ('task', 'project', 'session', 'insight')),
  content_id text NOT NULL,
  content text NOT NULL,
  embedding vector(1536) NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  title text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  sources jsonb,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create embedding_jobs table for tracking sync status
CREATE TABLE IF NOT EXISTS embedding_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  content_type text NOT NULL,
  content_ids text[] NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  progress integer DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  error text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Create optimized indexes for vector similarity search
CREATE INDEX IF NOT EXISTS embeddings_embedding_idx ON embeddings USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS embeddings_user_content_idx ON embeddings (user_id, content_type);
CREATE INDEX IF NOT EXISTS embeddings_created_at_idx ON embeddings (created_at DESC);

-- Create indexes for other tables
CREATE INDEX IF NOT EXISTS conversations_user_id_idx ON conversations (user_id);
CREATE INDEX IF NOT EXISTS chat_messages_conversation_id_idx ON chat_messages (conversation_id);
CREATE INDEX IF NOT EXISTS chat_messages_user_id_idx ON chat_messages (user_id);
CREATE INDEX IF NOT EXISTS embedding_jobs_user_id_idx ON embedding_jobs (user_id);
CREATE INDEX IF NOT EXISTS embedding_jobs_status_idx ON embedding_jobs (status);

-- Enable Row Level Security (RLS)
ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE embedding_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for embeddings table
CREATE POLICY "Users can only access their own embeddings" ON embeddings
  FOR ALL USING (user_id = auth.uid()::text);

-- RLS Policies for conversations table
CREATE POLICY "Users can only access their own conversations" ON conversations
  FOR ALL USING (user_id = auth.uid()::text);

-- RLS Policies for chat_messages table
CREATE POLICY "Users can only access their own chat messages" ON chat_messages
  FOR ALL USING (user_id = auth.uid()::text);

-- RLS Policies for embedding_jobs table
CREATE POLICY "Users can only access their own embedding jobs" ON embedding_jobs
  FOR ALL USING (user_id = auth.uid()::text);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at timestamps
CREATE TRIGGER update_embeddings_updated_at BEFORE UPDATE ON embeddings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 