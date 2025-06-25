import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
const serviceAccount = require('../make10000hours-firebase-adminsdk-fbsvc-4590536f61.json');
initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

interface WorkSession {
  duration: number;
  startTime: FirebaseFirestore.Timestamp;
  endTime: FirebaseFirestore.Timestamp;
  sessionType: string;
  updatedAt: FirebaseFirestore.Timestamp;
}

interface ReversionResult {
  id: string;
  success: boolean;
  error?: string;
  previousVersion?: WorkSession;
  currentVersion?: WorkSession;
}

// Incident time: 8:43 AM today
const INCIDENT_TIMESTAMP = new Date();
INCIDENT_TIMESTAMP.setHours(8, 43, 0, 0);

async function findPreviousVersion(docId: string): Promise<WorkSession | null> {
  const workSessionsRef = db.collection('workSessions');
  
  try {
    // Get more documents than we need since we'll filter some out
    const snapshots = await workSessionsRef
      .where('updatedAt', '<', INCIDENT_TIMESTAMP)
      .orderBy('updatedAt', 'desc')
      .limit(10) // Get more docs since we'll filter some out
      .get();

    if (snapshots.empty) {
      console.log(`No previous versions found before ${INCIDENT_TIMESTAMP}`);
      return null;
    }

    // Find first valid version with non-zero duration
    for (const doc of snapshots.docs) {
      const version = doc.data() as WorkSession;
      if (version.duration > 0 && version.startTime && version.endTime) {
        return version;
      }
    }

    console.log('No valid previous versions found with non-zero duration');
    return null;
  } catch (error) {
    console.error('Error finding previous version:', error);
    return null;
  }
}

async function revertSpecificDocument(docId: string, execute: boolean = false) {
  const workSessionsRef = db.collection('workSessions');
  
  try {
    console.log(`Processing document: ${docId}`);
    console.log(`Mode: ${execute ? 'EXECUTION' : 'TEST'}`);

    // Get current version
    const docRef = workSessionsRef.doc(docId);
    const currentDoc = await docRef.get();
    
    if (!currentDoc.exists) {
      console.log(`Document ${docId} does not exist`);
      return {
        id: docId,
        success: false,
        error: 'Document does not exist'
      };
    }

    const currentVersion = currentDoc.data() as WorkSession;
    
    // Find the previous version
    const previousVersion = await findPreviousVersion(docId);
    
    if (!previousVersion) {
      return {
        id: docId,
        success: false,
        error: 'No previous version found before incident time'
      };
    }

    console.log('\nCurrent state:');
    console.log(`- Current duration: ${currentVersion.duration} minutes`);
    console.log(`- Current updatedAt: ${currentVersion.updatedAt.toDate()}`);
    console.log(`- Current startTime: ${currentVersion.startTime.toDate()}`);
    console.log(`- Current endTime: ${currentVersion.endTime.toDate()}`);
    
    console.log('\nPrevious state (reverting to this):');
    console.log(`- Previous duration: ${previousVersion.duration} minutes`);
    console.log(`- Previous updatedAt: ${previousVersion.updatedAt.toDate()}`);
    console.log(`- Previous startTime: ${previousVersion.startTime.toDate()}`);
    console.log(`- Previous endTime: ${previousVersion.endTime.toDate()}`);

    if (execute) {
      // Store current state as backup and revert
      const revertData = {
        duration: previousVersion.duration, // Explicitly set duration
        _reversion: {
          revertedAt: new Date(),
          reason: 'Manual reversion to pre-incident state',
          previousState: currentVersion
        }
      };

      await docRef.update(revertData);
      console.log(`\nDocument ${docId} has been reverted:`);
      console.log(`- Duration changed from ${currentVersion.duration} to ${previousVersion.duration} minutes`);
      console.log('- Original state preserved in _reversion field');
    } else {
      console.log('\nTest mode - no changes made');
      console.log('Run with --execute flag to apply changes');
    }

    return {
      id: docId,
      success: true,
      previousVersion,
      currentVersion
    };

  } catch (error) {
    console.error('Error during document reversion:', error);
    return {
      id: docId,
      success: false,
      error: error.message
    };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const executeMode = args.includes('--execute');
  const docsArg = args.find(arg => arg.startsWith('--docs='));
  
  if (!docsArg) {
    console.error('Please provide document ID with --docs=DOCUMENT_ID');
    process.exit(1);
  }

  const documentId = docsArg.split('=')[1];
  const result = await revertSpecificDocument(documentId, executeMode);
  
  console.log('\nExecution Summary:');
  console.log('=================');
  if (result.success) {
    console.log('Status: Success');
    if (executeMode) {
      console.log('Document has been reverted to previous state');
    }
  } else {
    console.log('Status: Failed');
    console.log(`Error: ${result.error}`);
  }
}

main().catch(console.error); 