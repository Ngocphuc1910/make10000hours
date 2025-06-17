// Debug script to test data pipeline
import { auth, db } from './api/firebase';
import { supabase } from './services/supabase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export async function debugDataPipeline() {
  console.log('🔍 Debugging Data Pipeline...');
  
  // Check current user
  const user = auth.currentUser;
  if (!user) {
    console.log('❌ No authenticated user');
    return;
  }
  
  console.log('👤 Current user:', user.uid);
  
  // Check Firebase data
  console.log('\n📊 Checking Firebase data...');
  
  try {
    // Check tasks
    const tasksQuery = query(collection(db, 'tasks'), where('userId', '==', user.uid));
    const tasksSnapshot = await getDocs(tasksQuery);
    console.log(`📝 Tasks found: ${tasksSnapshot.size}`);
    
    if (tasksSnapshot.size > 0) {
      tasksSnapshot.docs.slice(0, 2).forEach((doc: any) => {
        const data = doc.data();
        console.log(`  - Task: "${data.title}" (${data.status})`);
      });
    }
    
    // Check work sessions
    const sessionsQuery = query(collection(db, 'workSessions'), where('userId', '==', user.uid));
    const sessionsSnapshot = await getDocs(sessionsQuery);
    console.log(`⏱️ Work sessions found: ${sessionsSnapshot.size}`);
    
    // Check projects
    const projectsQuery = query(collection(db, 'projects'), where('userId', '==', user.uid));
    const projectsSnapshot = await getDocs(projectsQuery);
    console.log(`📁 Projects found: ${projectsSnapshot.size}`);
    
  } catch (error) {
    console.error('❌ Firebase data check failed:', error);
  }
  
  // Check Supabase documents
  console.log('\n🧠 Checking Supabase user_productivity_documents...');
  
  try {
    const { data: documents, error } = await supabase
      .from('user_productivity_documents')
      .select('id, content_type, created_at, content')
      .eq('user_id', user.uid);
    
    if (error) {
      console.error('❌ Supabase documents check failed:', error);
      console.log('💡 You need to run the database setup script in Supabase SQL editor');
    } else {
      console.log(`🎯 Documents found: ${documents?.length || 0}`);
      if (documents && documents.length > 0) {
        documents.forEach((doc: any) => {
          console.log(`  - ${doc.content_type} (${doc.created_at}): ${doc.content.substring(0, 50)}...`);
        });
      } else {
        console.log('📝 No documents found - data sync may not be working yet');
        console.log('💡 Try creating a task or starting a work session to test sync');
      }
    }
  } catch (error) {
    console.error('❌ Supabase connection failed:', error);
  }
  
  // Test vector search if documents exist
  console.log('\n🔍 Testing vector search...');
  try {
    const { data: searchTest, error: searchError } = await supabase
      .from('user_productivity_documents')
      .select('*')
      .eq('user_id', user.uid)
      .limit(1);
      
    if (searchError) {
      console.error('❌ Vector search test failed:', searchError);
    } else {
      console.log(`✅ Vector search working - found ${searchTest?.length || 0} documents`);
    }
  } catch (error) {
    console.error('❌ Vector search test error:', error);
  }
}

// Add to window for easy testing
if (typeof window !== 'undefined') {
  interface WindowWithDebug extends Window {
    debugDataPipeline?: typeof debugDataPipeline;
  }
  (window as unknown as WindowWithDebug).debugDataPipeline = debugDataPipeline;
} 