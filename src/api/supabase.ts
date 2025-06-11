import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types for TypeScript
export interface EmbeddingDocument {
  id: string;
  user_id: string;
  content: string;
  embedding: number[];
  metadata: {
    type: 'task' | 'project' | 'work_session';
    source_id: string;
    source_title: string;
    last_updated: string;
    project_name?: string;
    status?: string;
    time_spent?: number;
  };
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  user_id: string;
  content: string;
  role: 'user' | 'assistant';
  sources?: DocumentSource[];
  created_at: string;
}

export interface DocumentSource {
  id: string;
  type: 'task' | 'project' | 'work_session';
  title: string;
  relevance_score: number;
  snippet: string;
} 