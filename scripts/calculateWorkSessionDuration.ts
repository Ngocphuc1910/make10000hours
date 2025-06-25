import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';

// Load environment variables
require('dotenv').config();

// Initialize Firebase
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function calculateWorkSessionDuration() {
  const userId = "4vGB2suNB8MW9ahD9gSlwywkFsk1";
  const targetDate = '2023-06-25'; // YYYY-MM-DD format

  try {
    console.log(`Fetching work sessions for user ${userId} on ${targetDate}...`);
    
    // Query work sessions directly instead of using the service
    const workSessionsCollection = collection(db, 'workSessions');
    const q = query(
      workSessionsCollection,
      where('userId', '==', userId),
      where('date', '==', targetDate)
    );

    const querySnapshot = await getDocs(q);
    const sessions = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        duration: data.duration || 0,
        sessionType: data.sessionType || 'manual'
      };
    });
    
    console.log(`Found ${sessions.length} sessions`);
    
    // Calculate total duration
    const totalDuration = sessions.reduce((total, session) => total + (session.duration || 0), 0);
    
    console.log('\nWork Sessions:');
    sessions.forEach(session => {
      console.log(`- Session ${session.id}: ${session.duration} minutes (${session.sessionType})`);
    });
    
    console.log(`\nTotal duration: ${totalDuration} minutes (${(totalDuration / 60).toFixed(2)} hours)`);
    
  } catch (error) {
    console.error('Error calculating work session duration:', error);
  }
}

calculateWorkSessionDuration(); 