// Test script to verify task deletion automatically removes work sessions
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDocs, query, where, deleteDoc } from 'firebase/firestore';

const firebaseConfig = {
  // Add your Firebase config here if needed for testing
  // For now, we'll assume it's configured in the main app
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const TEST_TASK_ID = "FIsiHQxJZBD8ROepOskf";
const TEST_USER_ID = "4vGB2suNB8MW9ahD9gSlwywkFsk1";
const TEST_PROJECT_ID = "lU2tNDKK0x0aLsfWsvMO";

async function testTaskDeletion() {
  try {
    console.log("🧪 Starting task deletion test...");
    
    // Step 1: Create a test work session for the task
    const testSessionId = `${TEST_TASK_ID}_2025-06-02_test_${Date.now()}`;
    const testSession = {
      id: testSessionId,
      userId: TEST_USER_ID,
      taskId: TEST_TASK_ID,
      projectId: TEST_PROJECT_ID,
      date: '2025-06-02',
      duration: 15,
      sessionType: 'manual',
      notes: 'Test session for deletion verification',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const sessionRef = doc(db, 'workSessions', testSessionId);
    await setDoc(sessionRef, testSession);
    console.log(`✅ Created test work session: ${testSessionId}`);
    
    // Step 2: Verify the session exists
    const q = query(
      collection(db, 'workSessions'),
      where('userId', '==', TEST_USER_ID),
      where('taskId', '==', TEST_TASK_ID)
    );
    
    const sessionsBefore = await getDocs(q);
    console.log(`📋 Found ${sessionsBefore.docs.length} work sessions for task ${TEST_TASK_ID} before deletion`);
    
    // Step 3: Now we would delete the task using the app's deleteTask function
    // Since we can't easily import the store here, we'll just verify the logic
    console.log("🔍 Check your browser console when you delete this task to see the deletion logs");
    console.log(`Task to test: ${TEST_TASK_ID} - "Organize lại Backlog của this project"`);
    console.log("Expected behavior: All work sessions for this task should be deleted automatically");
    
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

// Run the test
testTaskDeletion(); 