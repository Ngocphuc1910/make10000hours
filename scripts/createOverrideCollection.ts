import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';

// Firebase configuration (replace with your actual config)
const firebaseConfig = {
  apiKey: "AIzaSyC8qXdQpqvFqCUXfJLNBnmjDrYYzlJOJzw",
  authDomain: "make10000hours.firebaseapp.com",
  projectId: "make10000hours",
  storageBucket: "make10000hours.firebasestorage.app",
  messagingSenderId: "1074528721073",
  appId: "1:1074528721073:web:afc6b4c5b7b4e7e1a7b4c5"
};

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
      createdAt: serverTimestamp(),
      metadata: {
        extensionVersion: '1.0.0',
        overrideCount: 1
      }
    }
  ];

  try {
    for (const session of testOverrideSessions) {
      const docRef = await addDoc(collection(db, 'overrideSessions'), session);
      console.log('✅ Created override session:', {
        id: docRef.id,
        domain: session.domain,
        duration: session.duration + 'min',
        reason: session.reason
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