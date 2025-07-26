import { createClient } from '@supabase/supabase-js';

// Supabase configuration from environment variables only - no hardcoded secrets  
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Debug environment variables in development
if (import.meta.env.DEV) {
  console.log('🔍 Supabase Environment Check:');
  console.log('VITE_SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
  console.log('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅ Set' : '❌ Missing');
  console.log('🔑 Key Details:');
  console.log('  URL:', supabaseUrl);
  console.log('  Anon Key (first 20 chars):', supabaseAnonKey?.substring(0, 20) + '...');
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

// Test function to verify Supabase connection
export async function testSupabaseConnection(): Promise<{ success: boolean; error?: string; details?: any }> {
  if (!supabase) {
    return { success: false, error: 'Supabase client not configured' };
  }

  try {
    console.log('🔍 Testing Supabase connection...');
    
    // Simple test query that should work with any project
    const { data, error } = await supabase
      .from('user_productivity_documents')
      .select('id')
      .limit(1);

    if (error) {
      console.error('❌ Supabase test query failed:', error);
      return { 
        success: false, 
        error: error.message,
        details: {
          code: error.code,
          hint: error.hint,
          details: error.details
        }
      };
    }

    console.log('✅ Supabase connection test successful');
    return { success: true, details: { recordCount: data?.length || 0 } };
  } catch (err) {
    console.error('❌ Supabase connection test error:', err);
    return { 
      success: false, 
      error: err instanceof Error ? err.message : String(err) 
    };
  }
}

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