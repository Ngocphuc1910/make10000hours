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

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('your_supabase_project_url_here') || supabaseAnonKey.includes('your_supabase_anon_key_here')) {
  const errorMsg = `Missing or invalid Supabase environment variables:
    - VITE_SUPABASE_URL: ${supabaseUrl ? (supabaseUrl.includes('your_supabase_project_url_here') ? '❌ Placeholder value' : '✅') : '❌ Missing'}
    - VITE_SUPABASE_ANON_KEY: ${supabaseAnonKey ? (supabaseAnonKey.includes('your_supabase_anon_key_here') ? '❌ Placeholder value' : '✅') : '❌ Missing'}
    
    For production: Add these as GitHub repository secrets
    For development: Create a .env file in project root with these values`;
  
  console.warn('⚠️ Supabase Configuration Warning:', errorMsg);
  console.log('🔧 App will continue without Supabase features until configuration is complete');
}

// Only create Supabase client if we have valid configuration
const supabaseClient = (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('your_supabase_project_url_here') || supabaseAnonKey.includes('your_supabase_anon_key_here')) 
  ? null 
  : createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false, // Use Firebase auth instead
      },
    });

// Export with type assertion for deployment compatibility
// In production, environment variables should be properly configured
export const supabase = supabaseClient as any;

// Helper function to ensure supabase is configured
export function getSupabaseClient() {
  if (!supabase) {
    throw new Error('Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.');
  }
  return supabase;
}

// Helper function to check if supabase is available
export function isSupabaseConfigured(): boolean {
  return supabase !== null;
}

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