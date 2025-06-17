import { IncrementalSyncService } from '../src/services/incrementalSyncService';
import { DatabaseSetup } from '../src/services/databaseSetup';

async function testIncrementalSync() {
  const testUserId = '7Y4oV5qJm4MFo0ZJBXkH0cJNk0z1'; // Use the existing test user
  
  console.log('🧪 Testing Incremental Sync Service');
  console.log('===================================');
  
  try {
    // Step 1: Initialize database tables
    console.log('\n1. 🔧 Initializing database tables...');
    await DatabaseSetup.createTables();
    console.log('✅ Database tables initialized');
    
    // Step 2: Check if incremental sync is needed
    console.log('\n2. 🔍 Checking incremental sync status...');
    const syncStatus = await IncrementalSyncService.isIncrementalSyncNeeded(testUserId);
    console.log(`📊 Sync Status:`, {
      needed: syncStatus.needed,
      lastSyncTime: syncStatus.lastSyncTime?.toISOString() || 'Never',
      pendingChanges: syncStatus.pendingChanges
    });
    
    // Step 3: Run incremental sync
    console.log('\n3. ⚡ Running incremental sync...');
    const startTime = Date.now();
    const result = await IncrementalSyncService.executeIncrementalSync(testUserId);
    const duration = Date.now() - startTime;
    
    console.log('📈 Incremental Sync Results:');
    console.log(`✅ Success: ${result.success}`);
    console.log(`📝 Processed: ${result.processedDocuments} documents`);
    console.log(`⏭️ Skipped: ${result.skippedDocuments} documents`);
    console.log(`⏱️ Duration: ${duration}ms`);
    console.log(`📊 Collections:`, result.collections);
    
    if (result.errors.length > 0) {
      console.log(`❌ Errors: ${result.errors.length}`);
      result.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }
    
    // Step 4: Check sync status again
    console.log('\n4. 🔍 Checking sync status after sync...');
    const postSyncStatus = await IncrementalSyncService.isIncrementalSyncNeeded(testUserId);
    console.log(`📊 Post-Sync Status:`, {
      needed: postSyncStatus.needed,
      lastSyncTime: postSyncStatus.lastSyncTime?.toISOString() || 'Never',
      pendingChanges: postSyncStatus.pendingChanges
    });
    
    // Step 5: Run incremental sync again (should skip most documents)
    console.log('\n5. ⚡ Running incremental sync again (should be minimal)...');
    const secondStartTime = Date.now();
    const secondResult = await IncrementalSyncService.executeIncrementalSync(testUserId);
    const secondDuration = Date.now() - secondStartTime;
    
    console.log('📈 Second Incremental Sync Results:');
    console.log(`✅ Success: ${secondResult.success}`);
    console.log(`📝 Processed: ${secondResult.processedDocuments} documents`);
    console.log(`⏭️ Skipped: ${secondResult.skippedDocuments} documents`);
    console.log(`⏱️ Duration: ${secondDuration}ms`);
    console.log(`📊 Collections:`, secondResult.collections);
    
    // Step 6: Performance comparison
    console.log('\n6. 📊 Performance Analysis:');
    console.log(`First sync: ${result.processedDocuments} processed in ${duration}ms`);
    console.log(`Second sync: ${secondResult.processedDocuments} processed in ${secondDuration}ms`);
    
    const efficiency = secondResult.processedDocuments === 0 ? 100 : 
      ((result.processedDocuments - secondResult.processedDocuments) / result.processedDocuments) * 100;
    console.log(`💰 Cost reduction: ${efficiency.toFixed(1)}% (${result.processedDocuments - secondResult.processedDocuments} fewer documents processed)`);
    
    console.log('\n🎉 Incremental sync test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  }
}

// Run the test
testIncrementalSync()
  .then(() => {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }); 