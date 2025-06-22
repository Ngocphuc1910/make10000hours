/**
 * Clean deepFocusSessions data (delete documents, keep schema)
 * Run: node scripts/cleanDeepFocusSessions.js [userId]
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, writeBatch, query, limit, where } = require('firebase/firestore');

// Firebase config for make10000hours project
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: "make10000hours.firebaseapp.com",
  projectId: "make10000hours",
  storageBucket: "make10000hours.firebasestorage.app",
  messagingSenderId: "496225832510",
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: "G-X6YHGN5WRS"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function cleanCollectionData(collectionPath, batchSize = 100) {
  const collectionRef = collection(db, collectionPath);
  let deletedCount = 0;
  
  console.log(`🧹 Cleaning data from collection: ${collectionPath}`);
  console.log(`📋 Note: This keeps the collection schema, only removes documents`);
  
  while (true) {
    // Get a batch of documents
    const q = query(collectionRef, limit(batchSize));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      console.log(`✅ Collection ${collectionPath} is now empty (schema preserved)`);
      break;
    }
    
    // Create a batch to delete documents
    const batch = writeBatch(db);
    
    // Add delete operations to batch
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    // Commit the batch
    await batch.commit();
    deletedCount += snapshot.docs.length;
    
    console.log(`🗑️ Removed ${snapshot.docs.length} documents. Total cleaned: ${deletedCount}`);
    
    // Small delay to avoid overwhelming Firebase
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  return deletedCount;
}

async function cleanUserDeepFocusSessions(userId) {
  try {
    let totalCleaned = 0;
    
    if (userId) {
      console.log(`🎯 Cleaning deepFocusSessions data for user: ${userId}`);
      
      // Clean nested user collection data
      const userSessionsPath = `users/${userId}/deepFocusSessions`;
      const userCleaned = await cleanCollectionData(userSessionsPath);
      totalCleaned += userCleaned;
      
      // Clean from main collection where userId matches
      const collectionRef = collection(db, 'deepFocusSessions');
      const q = query(collectionRef, where('userId', '==', userId));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const batch = writeBatch(db);
        snapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        totalCleaned += snapshot.docs.length;
        console.log(`🗑️ Removed ${snapshot.docs.length} user documents from main deepFocusSessions`);
      }
      
    } else {
      console.log('🧹 Cleaning ALL deepFocusSessions data (keeping schema)...');
      
      // Clean all data from main collection
      const mainCleaned = await cleanCollectionData('deepFocusSessions');
      totalCleaned += mainCleaned;
    }
    
    console.log(`✅ Successfully cleaned ${totalCleaned} deepFocusSessions documents`);
    console.log(`📋 Collection schema preserved - ready for new data`);
    
  } catch (error) {
    console.error('❌ Error cleaning deepFocusSessions:', error);
  }
}

// Get userId from command line
const userId = process.argv[2];

if (userId) {
  console.log(`🎯 Cleaning data for specific user: ${userId}`);
  cleanUserDeepFocusSessions(userId);
} else {
  console.log('⚠️ No userId provided. This will clean ALL deepFocusSessions data!');
  console.log('Usage: node scripts/cleanDeepFocusSessions.js [userId]');
  console.log('📋 Collection schema will be preserved');
  console.log('Starting cleanup in 3 seconds...');
  
  setTimeout(() => {
    cleanUserDeepFocusSessions();
  }, 3000);
} 