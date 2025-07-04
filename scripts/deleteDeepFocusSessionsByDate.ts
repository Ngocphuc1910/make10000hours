/**
 * Delete deepFocusSessions for a specific date
 * Run: npx ts-node scripts/deleteDeepFocusSessionsByDate.ts
 */

import * as admin from 'firebase-admin';
import * as path from 'path';

// Load service account
const serviceAccount = require('../make10000hours-firebase-adminsdk-fbsvc-ef16bec846.json');

// Initialize Firebase Admin
const app = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: "make10000hours"
});

const db = admin.firestore();

async function deleteDeepFocusSessionsByDate(targetDate: Date) {
  const collectionRef = db.collection('deepFocusSessions');
  let deletedCount = 0;
  const batchSize = 100;

  try {
    // Create start and end timestamps for the target date
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    console.log(`🗑️ Deleting deepFocusSessions for date: ${targetDate.toISOString().split('T')[0]}`);
    console.log(`Time range: ${startOfDay.toISOString()} to ${endOfDay.toISOString()}`);

    // Query for documents within the date range
    const snapshot = await collectionRef
      .where('createdAt', '>=', startOfDay)
      .where('createdAt', '<=', endOfDay)
      .get();

    if (snapshot.empty) {
      console.log('✅ No documents found for the specified date');
      return 0;
    }

    // Create a batch
    let batch = db.batch();
    let batchCount = 0;

    // Add delete operations to batch
    for (const doc of snapshot.docs) {
      batch.delete(doc.ref);
      batchCount++;
      deletedCount++;

      // If batch is full, commit it and start a new one
      if (batchCount >= batchSize) {
        await batch.commit();
        console.log(`🔥 Deleted batch of ${batchCount} documents. Total: ${deletedCount}`);
        
        // Create new batch
        batch = db.batch();
        batchCount = 0;
        
        // Small delay to avoid overwhelming Firebase
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // Commit any remaining documents in the final batch
    if (batchCount > 0) {
      await batch.commit();
      console.log(`🔥 Deleted final batch of ${batchCount} documents. Total: ${deletedCount}`);
    }

    console.log(`✅ Successfully deleted ${deletedCount} documents for ${targetDate.toISOString().split('T')[0]}`);
    return deletedCount;

  } catch (error) {
    console.error('❌ Error deleting deepFocusSessions:', error);
    throw error;
  }
}

// Parse the target date
const targetDate = new Date('2025-07-03');

// Execute the deletion
console.log('⚠️ This will delete ALL deepFocusSessions for July 3, 2025!');
console.log('Proceeding with deletion in 3 seconds...');

setTimeout(() => {
  deleteDeepFocusSessionsByDate(targetDate)
    .then(count => {
      console.log('🎉 Operation completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Operation failed:', error);
      process.exit(1);
    });
}, 3000); 