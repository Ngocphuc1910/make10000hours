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

async function deleteWorkSessionsByUpdatedAt(userId?: string) {
  try {
    console.log('🔍 Searching for documents...');
    
    // Get all documents from the workSessions collection
    const snapshot = await db.collection('workSessions').get();
    
    // Target timestamp range: June 29, 2025 at 4:15:18 PM UTC+7 (with 10 second window)
    const startDate = new Date('2025-06-29T16:15:08+07:00');
    const endDate = new Date('2025-06-29T16:15:28+07:00');
    const startSeconds = Math.floor(startDate.getTime() / 1000);
    const endSeconds = Math.floor(endDate.getTime() / 1000);
    
    if (userId) {
      console.log(`👤 Filtering by user ID: ${userId}`);
    }
    
    console.log(`📅 Target timestamp range: 
    Start: ${startDate.toISOString()} (${startSeconds} seconds)
    End: ${endDate.toISOString()} (${endSeconds} seconds)`);
    
    // Filter documents with matching criteria
    const matchingDocs = snapshot.docs.filter(doc => {
      const data = doc.data();
      
      // If userId is provided, filter by it
      if (userId && data.userId !== userId) {
        return false;
      }
      
      // Check timestamp
      if (!data.updatedAt || !data.updatedAt._seconds) {
        return false;
      }
      const timestamp = data.updatedAt._seconds;
      return timestamp >= startSeconds && timestamp <= endSeconds;
    });
    
    if (matchingDocs.length === 0) {
      console.log('❌ No documents found matching the criteria.');
      return;
    }
    
    console.log(`🎯 Found ${matchingDocs.length} documents to delete.`);
    
    // Delete documents in batches of 500 (Firestore limit)
    const batchSize = 500;
    const batches: Promise<WriteResult[]>[] = [];
    let currentBatch = db.batch();
    let operationCount = 0;
    
    for (const doc of matchingDocs) {
      const data = doc.data();
      const timestamp = data.updatedAt._seconds;
      const date = new Date(timestamp * 1000);
      const userInfo = userId ? ` (userId: ${data.userId})` : '';
      console.log(`📄 Deleting document with ID: ${doc.id} (updatedAt: ${date.toISOString()})${userInfo}`);
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

// To filter by user ID, pass the userId parameter:
deleteWorkSessionsByUpdatedAt('2pDFCR6kHrVOjIgIJ5LHexXjZOv1').then(() => process.exit(0));

// Or to delete by timestamp only (current behavior):
// deleteWorkSessionsByUpdatedAt().then(() => process.exit(0)); 