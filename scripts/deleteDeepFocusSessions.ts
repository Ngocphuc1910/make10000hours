/**
 * Bulk delete all deepFocusSessions data from Firebase
 * Run: npx ts-node scripts/deleteDeepFocusSessions.ts
 */

import { db } from '../src/api/firebase';
import { collection, getDocs, writeBatch, query, limit, where } from 'firebase/firestore';

async function deleteCollectionInBatches(collectionPath: string, batchSize = 100) {
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

async function deleteUserDeepFocusSessions(userId?: string) {
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
  console.log('Usage: npx ts-node scripts/deleteDeepFocusSessions.ts [userId]');
  console.log('Proceeding with full deletion in 3 seconds...');
  
  setTimeout(() => {
    deleteUserDeepFocusSessions();
  }, 3000);
} 