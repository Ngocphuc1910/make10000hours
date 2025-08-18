/**
 * Debug Firebase Write Issues
 * Test direct Firebase writes to identify the problem
 */

import { collection, doc, setDoc, addDoc } from 'firebase/firestore';
import { db } from '../api/firebase';
import { SiteUsageSession } from '../utils/SessionManager';

declare global {
  interface Window {
    testFirebaseWrite: () => Promise<void>;
    testSessionWrite: () => Promise<void>;
    debugFirebaseConnection: () => void;
  }
}

// Test basic Firebase write
window.testFirebaseWrite = async () => {
  console.log('🔥 ===========================');
  console.log('🔥 TESTING FIREBASE WRITE');
  console.log('🔥 ===========================');
  
  try {
    // Test basic document write
    const testDoc = {
      test: true,
      timestamp: new Date().toISOString(),
      message: 'Firebase write test'
    };
    
    console.log('📝 Writing test document...');
    const docRef = await addDoc(collection(db, 'test-collection'), testDoc);
    console.log('✅ Test document written with ID:', docRef.id);
    
  } catch (error) {
    console.error('❌ Firebase write failed:', error);
  }
};

// Test session-specific write
window.testSessionWrite = async () => {
  console.log('🔥 ===============================');
  console.log('🔥 TESTING SESSION WRITE');
  console.log('🔥 ===============================');
  
  try {
    // Get current user
    const { useUserStore } = await import('../store/userStore');
    const user = useUserStore.getState().user;
    
    if (!user?.uid) {
      console.error('❌ No authenticated user');
      return;
    }
    
    // Create a simple test session
    const testSession: SiteUsageSession = {
      id: 'test-session-' + Date.now(),
      userId: user.uid,
      domain: 'test.com',
      startTimeUTC: new Date().toISOString(),
      endTimeUTC: new Date(Date.now() + 300000).toISOString(),
      duration: 300,
      utcDate: new Date().toISOString().split('T')[0],
      status: 'completed',
      createdAt: new Date().toISOString()
    };
    
    console.log('📝 Test session data:', testSession);
    
    // Try direct Firebase write
    console.log('📝 Writing directly to siteUsageSessions...');
    const docRef = doc(collection(db, 'siteUsageSessions'));
    await setDoc(docRef, testSession);
    console.log('✅ Direct write successful, document ID:', docRef.id);
    
    // Try using our service
    console.log('📝 Writing via siteUsageSessionService...');
    const { siteUsageSessionService } = await import('../api/siteUsageSessionService');
    await siteUsageSessionService.batchSaveSessions([testSession]);
    console.log('✅ Service write successful');
    
  } catch (error) {
    console.error('❌ Session write failed:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
  }
};

// Debug Firebase connection
window.debugFirebaseConnection = () => {
  console.log('🔥 ===============================');
  console.log('🔥 FIREBASE CONNECTION DEBUG');
  console.log('🔥 ===============================');
  
  console.log('📊 Firebase app:', !!db);
  console.log('📊 Database instance:', db);
  console.log('📊 Collection function:', typeof collection);
  console.log('📊 Doc function:', typeof doc);
  console.log('📊 SetDoc function:', typeof setDoc);
  
  // Test collection reference
  try {
    const testCollection = collection(db, 'siteUsageSessions');
    console.log('✅ Collection reference created:', testCollection);
  } catch (error) {
    console.error('❌ Collection reference failed:', error);
  }
};

export {};