/**
 * Test Firebase network connectivity
 */

import { enableNetwork, disableNetwork } from 'firebase/firestore';
import { db } from '../api/firebase';

declare global {
  interface Window {
    testFirebaseNetwork: () => Promise<void>;
    reconnectFirebase: () => Promise<void>;
    checkFirebaseSettings: () => void;
  }
}

// Test Firebase network connectivity
window.testFirebaseNetwork = async () => {
  console.log('🌐 =============================');
  console.log('🌐 FIREBASE NETWORK TEST');
  console.log('🌐 =============================');
  
  try {
    // Check if we can reach Firebase
    const response = await fetch('https://firestore.googleapis.com/');
    console.log('✅ Firebase API is reachable, status:', response.status);
    
    // Test basic connectivity
    const testResponse = await fetch('https://www.google.com', { mode: 'no-cors' });
    console.log('✅ Internet connectivity confirmed');
    
  } catch (error) {
    console.error('❌ Network connectivity test failed:', error);
  }
};

// Force Firebase to reconnect
window.reconnectFirebase = async () => {
  console.log('🔄 =============================');
  console.log('🔄 RECONNECTING FIREBASE');
  console.log('🔄 =============================');
  
  try {
    console.log('📡 Disabling Firebase network...');
    await disableNetwork(db);
    console.log('✅ Network disabled');
    
    console.log('📡 Re-enabling Firebase network...');
    await enableNetwork(db);
    console.log('✅ Network re-enabled');
    
    console.log('🔄 Firebase reconnection complete');
    
  } catch (error) {
    console.error('❌ Firebase reconnection failed:', error);
  }
};

// Check Firebase configuration
window.checkFirebaseSettings = () => {
  console.log('⚙️ =============================');
  console.log('⚙️ FIREBASE SETTINGS CHECK');
  console.log('⚙️ =============================');
  
  console.log('🔥 App configuration:');
  console.log('  Project ID:', db.app.options.projectId);
  console.log('  Auth Domain:', db.app.options.authDomain);
  console.log('  API Key:', db.app.options.apiKey ? 'Present' : 'Missing');
  
  console.log('📱 Firestore settings:');
  console.log('  App name:', db.app.name);
  console.log('  Database ID:', (db as any)._databaseId?.database);
  
  console.log('🌐 Network state:');
  console.log('  Client terminated?', (db as any)._terminated);
  console.log('  Is initialized?', (db as any)._initialized);
};

export {};