import { createClient } from '@supabase/supabase-js';

// Supabase configuration from environment variables only - no hardcoded secrets  
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Debug environment variables in development
if (import.meta.env.DEV) {
  console.log('🔍 Supabase Environment Check:');
  console.log('VITE_SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
  console.log('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅ Set' : '❌ Missing');
  console.log('All env vars:', Object.keys(import.meta.env).filter(key => key.startsWith('VITE_')));
}

if (!supabaseUrl || !supabaseAnonKey) {
  const errorMsg = `Missing Supabase environment variables:
    - VITE_SUPABASE_URL: ${supabaseUrl ? '✅' : '❌ Missing'}
    - VITE_SUPABASE_ANON_KEY: ${supabaseAnonKey ? '✅' : '❌ Missing'}
    
    For production: Add these as GitHub repository secrets
    For development: Create a .env file in project root with these values`;
  
  console.error('🚨 Supabase Configuration Error:', errorMsg);
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // Use Firebase auth instead
  },
});

// Database table definitions (for TypeScript)
export interface Database {
  public: {
    Tables: {
      user_productivity_documents: {
        Row: {
          id: string;
          user_id: string;
          content_type: string;
          content: string;
          embedding: number[] | null;
          metadata: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['user_productivity_documents']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['user_productivity_documents']['Insert']>;
      };
      chat_messages: {
        Row: {
          id: string;
          conversation_id: string;
          user_id: string;
          role: 'user' | 'assistant';
          content: string;
          sources: any[] | null;
          metadata: Record<string, any> | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['chat_messages']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['chat_messages']['Insert']>;
      };
      conversations: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['conversations']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['conversations']['Insert']>;
      };
      embedding_jobs: {
        Row: {
          id: string;
          user_id: string;
          content_type: string;
          content_ids: string[];
          status: 'pending' | 'processing' | 'completed' | 'failed';
          progress: number;
          error: string | null;
          created_at: string;
          completed_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['embedding_jobs']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['embedding_jobs']['Insert']>;
      };
    };
  };
} 