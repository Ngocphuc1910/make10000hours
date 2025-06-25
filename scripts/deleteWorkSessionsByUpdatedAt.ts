import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, WriteResult, Timestamp } from 'firebase-admin/firestore';
import * as admin from 'firebase-admin';
import * as path from 'path';

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '../make10000hours-firebase-adminsdk-fbsvc-4590536f61.json');

try {
  initializeApp({
    credential: cert(require(serviceAccountPath)),
    projectId: 'make10000hours'
  });
} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin:', error.message);
  console.log('💡 Make sure you have the Firebase Admin SDK credentials file in the root directory');
  process.exit(1);
}

const db = getFirestore();

async function deleteWorkSessionsByUpdatedAt() {
  try {
    console.log('🔍 Searching for documents with updatedAt timestamp...');
    
    // Get all documents from the workSessions collection
    const snapshot = await db.collection('workSessions').get();
    
    // Target timestamp range: June 25, 2025 at 9:56:50 AM UTC+7 to June 25, 2025 at 9:57:00 AM UTC+7
    const startDate = new Date('2025-06-25T09:56:50+07:00');
    const endDate = new Date('2025-06-25T09:57:00+07:00');
    const startSeconds = Math.floor(startDate.getTime() / 1000);
    const endSeconds = Math.floor(endDate.getTime() / 1000);
    
    console.log(`📅 Target timestamp range: 
    Start: ${startDate.toISOString()} (${startSeconds} seconds)
    End: ${endDate.toISOString()} (${endSeconds} seconds)`);
    
    // Filter documents with matching updatedAt timestamp within range
    const matchingDocs = snapshot.docs.filter(doc => {
      const data = doc.data();
      if (!data.updatedAt || !data.updatedAt._seconds) {
        return false;
      }
      const timestamp = data.updatedAt._seconds;
      return timestamp >= startSeconds && timestamp <= endSeconds;
    });
    
    if (matchingDocs.length === 0) {
      console.log('❌ No documents found within the specified timestamp range.');
      return;
    }
    
    console.log(`🎯 Found ${matchingDocs.length} documents to delete.`);
    
    // Delete documents in batches of 500 (Firestore limit)
    const batchSize = 500;
    const batches = [];
    let currentBatch = db.batch();
    let operationCount = 0;
    
    for (const doc of matchingDocs) {
      const data = doc.data();
      const timestamp = data.updatedAt._seconds;
      const date = new Date(timestamp * 1000);
      console.log(`📄 Deleting document with ID: ${doc.id} (updatedAt: ${date.toISOString()})`);
      currentBatch.delete(doc.ref);
      operationCount++;
      
      if (operationCount === batchSize) {
        batches.push(currentBatch.commit());
        currentBatch = db.batch();
        operationCount = 0;
      }
    }
    
    if (operationCount > 0) {
      batches.push(currentBatch.commit());
    }
    
    await Promise.all(batches);
    console.log(`✅ Successfully deleted ${matchingDocs.length} documents.`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

deleteWorkSessionsByUpdatedAt().then(() => process.exit(0)); 