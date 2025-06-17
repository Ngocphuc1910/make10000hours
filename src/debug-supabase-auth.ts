// Debug Supabase authentication and RLS
import { supabase } from './services/supabase';
import { auth } from './api/firebase';

export async function debugSupabaseAuth() {
  console.log('🔍 Debugging Supabase Authentication...');
  
  // Check Firebase auth
  const firebaseUser = auth.currentUser;
  console.log('👤 Firebase user:', firebaseUser?.uid);
  
  // Check Supabase session
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  console.log('🔐 Supabase session:', session?.user?.id, sessionError);
  
  // Test basic Supabase query
  try {
    const { data, error } = await supabase
      .from('user_productivity_documents')
      .select('count(*)')
      .limit(1);
    
    console.log('📊 Basic query result:', data, error);
  } catch (error) {
    console.error('❌ Basic query failed:', error);
  }
  
  // Test RLS context
  try {
    const { data, error } = await supabase.rpc('auth.uid');
    console.log('🔑 Current auth.uid():', data, error);
  } catch (error) {
    console.error('❌ auth.uid() failed:', error);
  }
  
  // Test insert with explicit user_id
  if (firebaseUser?.uid) {
    try {
      const { data, error } = await supabase
        .from('user_productivity_documents')
        .insert({
          user_id: firebaseUser.uid,
          content_type: 'test',
          content: 'Test document for debugging',
          metadata: { test: true },
          embedding: new Array(1536).fill(0) // Dummy embedding
        })
        .select();
      
      console.log('🧪 Test insert result:', data, error);
      
      // Clean up test document
      if (data?.[0]?.id) {
        await supabase
          .from('user_productivity_documents')
          .delete()
          .eq('id', data[0].id);
        console.log('🧹 Cleaned up test document');
      }
    } catch (error) {
      console.error('❌ Test insert failed:', error);
    }
  }
}

// Export for global access
if (typeof window !== 'undefined') {
  (window as any).debugSupabaseAuth = debugSupabaseAuth;
} 