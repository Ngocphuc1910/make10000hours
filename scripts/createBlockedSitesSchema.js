const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin SDK
const serviceAccountPath = path.join(__dirname, '../firebase-service-account-key.json');

try {
  admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath)),
    projectId: 'make10000hours'
  });
} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin:', error.message);
  console.log('💡 Make sure you have firebase-service-account-key.json in the root directory');
  process.exit(1);
}

const db = admin.firestore();

async function createBlockedSitesSchema() {
  console.log('🚀 Creating blocked sites schema in Firebase...');
  
  // Sample user ID (replace with real user ID)
  const sampleUserId = '7Y4oV5qJm4MFo0ZJBXkH0cJNk0z1'; // Use existing user ID from your Firebase
  
  // Sample blocked sites data
  const sampleBlockedSitesDocument = {
    userId: sampleUserId,
    sites: [
      {
        id: 'site_1703123456789_abc123',
        name: 'Instagram',
        url: 'instagram.com',
        icon: 'ri-instagram-line',
        backgroundColor: '#E4405F',
        isActive: true,
        category: 'social'
      },
      {
        id: 'site_1703123456790_def456',
        name: 'YouTube',
        url: 'youtube.com',
        icon: 'ri-youtube-line',
        backgroundColor: '#FF0000',
        isActive: true,
        category: 'entertainment'
      },
      {
        id: 'site_1703123456791_ghi789',
        name: 'Facebook',
        url: 'facebook.com',
        icon: 'ri-facebook-line',
        backgroundColor: '#1877F2',
        isActive: false,
        category: 'social'
      }
    ],
    metadata: {
      totalSites: 3,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      syncedAt: admin.firestore.Timestamp.now(),
      version: '1.0'
    }
  };

  try {
    // Create the document in the userBlockedSites collection
    const docRef = db.collection('userBlockedSites').doc(sampleUserId);
    
    await docRef.set(sampleBlockedSitesDocument);
    
    console.log('✅ Successfully created blocked sites schema!');
    console.log('📊 Document created at: userBlockedSites/' + sampleUserId);
    console.log('🔍 Check your Firebase Console -> Firestore Database -> userBlockedSites collection');
    console.log('📝 Sample data includes:', sampleBlockedSitesDocument.sites.length, 'blocked sites');
    
    // Verify the document was created
    const createdDoc = await docRef.get();
    if (createdDoc.exists) {
      const data = createdDoc.data();
      console.log('✅ Verification successful - document contains', data.sites.length, 'sites');
    }
    
  } catch (error) {
    console.error('❌ Failed to create schema:', error);
    throw error;
  }
}

// Run the script
createBlockedSitesSchema()
  .then(() => {
    console.log('🎉 Schema creation complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  }); 