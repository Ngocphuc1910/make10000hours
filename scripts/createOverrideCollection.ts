import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || '',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.VITE_FIREBASE_APP_ID || ''
};

// Validate Firebase configuration
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('❌ Firebase configuration incomplete. Please check environment variables.');
  console.error('Required: VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID, etc.');
  process.exit(1);
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function createOverrideCollection() {
  console.log('🔄 Creating overrideSessions collection...');
  
  // Sample user ID - replace with actual user ID
  const sampleUserId = 'sample-user-123';
  
  const testOverrideSessions = [
    {
      userId: sampleUserId,
      domain: 'facebook.com',
      url: 'https://facebook.com/feed',
      duration: 5,
      reason: 'manual_override',
      extensionSessionId: `override_${Date.now()}_test_facebook`, // NEW FORMAT REQUIREMENT
      startTimeUTC: new Date().toISOString(), // NEW FORMAT REQUIREMENT
      createdAt: serverTimestamp(),
      metadata: {
        extensionVersion: '1.0.0',
        overrideCount: 1
      }
    },
    {
      userId: sampleUserId,
      domain: 'instagram.com',
      url: 'https://instagram.com/explore',
      duration: 3,
      reason: 'break_time',
      extensionSessionId: `override_${Date.now() + 1}_test_instagram`, // NEW FORMAT REQUIREMENT
      startTimeUTC: new Date().toISOString(), // NEW FORMAT REQUIREMENT
      createdAt: serverTimestamp(),
      metadata: {
        extensionVersion: '1.0.0',
        overrideCount: 1
      }
    },
    {
      userId: sampleUserId,
      domain: 'youtube.com',
      url: 'https://youtube.com/watch',
      duration: 10,
      reason: 'emergency',
      extensionSessionId: `override_${Date.now() + 2}_test_youtube`, // NEW FORMAT REQUIREMENT
      startTimeUTC: new Date().toISOString(), // NEW FORMAT REQUIREMENT
      createdAt: serverTimestamp(),
      metadata: {
        extensionVersion: '1.0.0',
        overrideCount: 1
      }
    }
  ];

  console.log('⚠️ WARNING: This script bypasses service layer protection!');
  console.log('🚫 DEPRECATED: Use overrideSessionService.createOverrideSession() instead');
  
  try {
    // TEMPORARY: Still use direct addDoc but with new format validation
    for (const session of testOverrideSessions) {
      if (!session.extensionSessionId || !session.startTimeUTC) {
        console.error('❌ BLOCKED: Session missing required new format fields:', session.domain);
        continue;
      }
      
      const docRef = await addDoc(collection(db, 'overrideSessions'), session);
      console.log('✅ Created NEW FORMAT override session:', {
        id: docRef.id,
        domain: session.domain,
        duration: session.duration + 'min',
        reason: session.reason,
        extensionSessionId: session.extensionSessionId
      });
    }
    
    console.log('🎉 Successfully created overrideSessions collection with test data!');
    console.log('📋 You should now see the collection in your Firebase console');
    
  } catch (error) {
    console.error('❌ Error creating override sessions:', error);
  }
}

// Run the script
createOverrideCollection()
  .then(() => {
    console.log('✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }); 