// Simple test script for advanced sync logic
import { AdvancedDataSyncService } from '../src/services/advancedDataSyncService';
import { EnhancedRAGService } from '../src/services/enhancedRAGService';

const USER_ID = '7Y4oV5qJm4MFo0ZJBXkH0cJNk0z1';

async function testAdvancedSync() {
  console.log('🧪 Testing Advanced Sync Logic...\n');

  try {
    // Test 1: Check if services are properly imported
    console.log('✅ Step 1: Service imports successful');

    // Test 2: Execute sync (this will test the full pipeline)
    console.log('🚀 Step 2: Executing complete sync...');
    const syncResult = await AdvancedDataSyncService.executeCompleteSync(USER_ID);
    
    console.log('📊 Sync Results:');
    console.log(`   Success: ${syncResult.success}`);
    console.log(`   Total Chunks: ${syncResult.totalChunks}`);
    console.log(`   Processing Time: ${syncResult.processingTime}ms`);
    
    if (syncResult.errors.length > 0) {
      console.log('   ⚠️ Errors:', syncResult.errors.slice(0, 3));
    }

    // Test 3: Test RAG queries
    if (syncResult.success) {
      console.log('\n🔍 Step 3: Testing RAG queries...');
      const testQueries = [
        "What did I work on recently?",
        "How productive was I this week?"
      ];

      for (const query of testQueries) {
        try {
          const response = await EnhancedRAGService.queryWithHybridSearch(query, USER_ID);
          console.log(`✅ Query: "${query}"`);
          console.log(`   Retrieved: ${response.metadata.retrievedDocuments} docs`);
          console.log(`   Response: ${response.response.substring(0, 100)}...`);
        } catch (error) {
          console.log(`❌ Query failed: "${query}" - ${error}`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    
    // Provide debugging hints
    console.log('\n🔧 Debug checklist:');
    console.log('1. Check .env file has OPENAI_API_KEY');
    console.log('2. Verify Firebase credentials are set');
    console.log('3. Ensure Supabase connection works');
    console.log('4. Check user has data in Firebase');
  }
}

testAdvancedSync().catch(console.error); 