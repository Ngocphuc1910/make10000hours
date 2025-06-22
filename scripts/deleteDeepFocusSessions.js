/**
 * Bulk delete all deepFocusSessions data from Firebase
 * Run: node scripts/deleteDeepFocusSessions.js
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, writeBatch, query, limit, where } = require('firebase/firestore');

// Firebase config from your project
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "AIzaSyCOoKYhGUVVDqztvH1f4wNfJQKzBV4Tk8w", // Replace with actual
  authDomain: "make10000hours.firebaseapp.com",
  projectId: "make10000hours",
  storageBucket: "make10000hours.firebasestorage.app",
  messagingSenderId: "496225832510",
  appId: process.env.VITE_FIREBASE_APP_ID || "1:496225832510:web:abc123" // Replace with actual
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function deleteCollectionInBatches(collectionPath, batchSize = 100) {
  const collectionRef = collection(db, collectionPath);
  let deletedCount = 0;
  
  console.log(`🗑️ Starting deletion of collection: ${collectionPath}`);
  
  while (true) {
    // Get a batch of documents
    const q = query(collectionRef, limit(batchSize));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      console.log(`✅ No more documents in ${collectionPath}`);
      break;
    }
    
    // Create a batch
    const batch = writeBatch(db);
    
    // Add delete operations to batch
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
      console.log(`📄 Queued for deletion: ${doc.id}`);
    });
    
    // Commit the batch
    await batch.commit();
    deletedCount += snapshot.docs.length;
    
    console.log(`🔥 Deleted ${snapshot.docs.length} documents. Total deleted: ${deletedCount}`);
    
    // Small delay to avoid overwhelming Firebase
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  return deletedCount;
}

async function deleteUserDeepFocusSessions(userId) {
  try {
    let totalDeleted = 0;
    
    if (userId) {
      console.log(`🗑️ Deleting deepFocusSessions for user: ${userId}`);
      
      // Delete from nested user collection
      const userSessionsPath = `users/${userId}/deepFocusSessions`;
      const userDeleted = await deleteCollectionInBatches(userSessionsPath);
      totalDeleted += userDeleted;
      
      // Also delete from main collection where userId matches
      const collectionRef = collection(db, 'deepFocusSessions');
      const q = query(collectionRef, where('userId', '==', userId));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const batch = writeBatch(db);
        snapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        totalDeleted += snapshot.docs.length;
        console.log(`🔥 Deleted ${snapshot.docs.length} documents from main deepFocusSessions collection`);
      }
      
    } else {
      console.log('🗑️ Deleting ALL deepFocusSessions data...');
      
      // Delete all from main collection
      const mainDeleted = await deleteCollectionInBatches('deepFocusSessions');
      totalDeleted += mainDeleted;
    }
    
    console.log(`✅ Successfully deleted ${totalDeleted} deepFocusSessions documents total`);
    
  } catch (error) {
    console.error('❌ Error deleting deepFocusSessions:', error);
  }
}

// Get userId from command line or delete all
const userId = process.argv[2];

if (userId) {
  console.log(`🎯 Targeting user: ${userId}`);
  deleteUserDeepFocusSessions(userId);
} else {
  console.log('⚠️ No userId provided. This will delete ALL deepFocusSessions data!');
  console.log('Usage: node scripts/deleteDeepFocusSessions.js [userId]');
  console.log('Proceeding with full deletion in 3 seconds...');
  
  setTimeout(() => {
    deleteUserDeepFocusSessions();
  }, 3000);
} 