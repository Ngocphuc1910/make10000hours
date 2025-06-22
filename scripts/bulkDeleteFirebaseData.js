const admin = require('firebase-admin');
const serviceAccount = require('../firebase-admin-key.json'); // You'll need this

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Bulk delete function
async function bulkDelete(collectionPath, batchSize = 100) {
  const collectionRef = db.collection(collectionPath);
  const query = collectionRef.limit(batchSize);

  return new Promise((resolve, reject) => {
    deleteQueryBatch(db, query, resolve).catch(reject);
  });
}

async function deleteQueryBatch(db, query, resolve) {
  const snapshot = await query.get();

  const batchSize = snapshot.size;
  if (batchSize === 0) {
    resolve();
    return;
  }

  // Delete documents in a batch
  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  await batch.commit();
  console.log(`Deleted ${batchSize} documents`);

  // Recurse on the next batch
  process.nextTick(() => {
    deleteQueryBatch(db, query, resolve);
  });
}

// Delete data for specific user
async function deleteUserData(userId) {
  console.log(`🗑️ Deleting all data for user: ${userId}`);
  
  try {
    // Delete deep focus sessions
    await bulkDelete(`users/${userId}/deepFocusSessions`);
    console.log('✅ Deleted deep focus sessions');
    
    // Delete work sessions  
    await bulkDelete(`users/${userId}/workSessions`);
    console.log('✅ Deleted work sessions');
    
    // Delete override sessions
    await bulkDelete(`users/${userId}/overrideSessions`);
    console.log('✅ Deleted override sessions');
    
    // Delete site usage data
    await bulkDelete(`users/${userId}/siteUsage`);
    console.log('✅ Deleted site usage data');
    
    // Delete backup data
    await bulkDelete(`users/${userId}/backups`);
    console.log('✅ Deleted backup data');
    
    console.log('🎉 All user data deleted successfully');
  } catch (error) {
    console.error('❌ Error deleting data:', error);
  }
}

// Usage
const userId = process.argv[2];
if (!userId) {
  console.error('Usage: node bulkDeleteFirebaseData.js <userId>');
  process.exit(1);
}

deleteUserData(userId); 