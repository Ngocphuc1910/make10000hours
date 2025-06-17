import { createClient } from '@supabase/supabase-js';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { HierarchicalChunker } from '../src/services/hierarchicalChunker';
import { EnhancedRAGService } from '../src/services/enhancedRAGService';

// User ID for testing
const USER_ID = '7Y4oV5qJm4MFo0ZJBXkH0cJNk0z1';

// Supabase configuration (MUST use environment variables)
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing required environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Firebase configuration
let firestore: any;
try {
  const app = initializeApp({
    credential: cert({
      projectId: "hour10000-make",
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') || "",
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL || "",
    }),
  });
  firestore = getFirestore(app);
} catch (error) {
  console.log('Firebase already initialized, using existing instance');
  firestore = getFirestore();
}

interface TestResult {
  query: string;
  success: boolean;
  responseTime: number;
  retrievedDocs: number;
  chunkLevels: number[];
  response?: string;
  error?: string;
}

async function executeCompleteSync(userId: string) {
  const startTime = Date.now();
  console.log(`🚀 Starting complete sync for user ${userId}...`);

  try {
    // Step 1: Clear existing chunks
    console.log('🧹 Clearing existing chunks...');
    const { error: deleteError } = await supabase
      .from('user_productivity_documents')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      throw new Error(`Failed to clear existing chunks: ${deleteError.message}`);
    }

    // Step 2: Generate and store chunks using EnhancedRAGService
    console.log('🔄 Processing and storing chunks...');
    const result = await EnhancedRAGService.processAndStoreChunks(userId);

    const processingTime = Date.now() - startTime;

    return {
      success: result.success,
      totalChunks: result.chunksProcessed,
      processingTime,
      chunksByLevel: {}, // Will be populated from actual data
      errors: result.errors,
    };

  } catch (error) {
    return {
      success: false,
      totalChunks: 0,
      processingTime: Date.now() - startTime,
      chunksByLevel: {},
      errors: [`Sync failed: ${error}`],
    };
  }
}

async function testEnhancedRAG(userId: string) {
  console.log('🧪 Testing Enhanced RAG service...');

  const testQueries = [
    "How productive was I this week?",
    "What tasks am I working on?", 
    "Which project needs attention?",
    "Show me my morning productivity patterns"
  ];

  const results: TestResult[] = [];
  
  for (const query of testQueries) {
    const startTime = Date.now();
    try {
      const response = await EnhancedRAGService.queryWithHybridSearch(query, userId);
      const responseTime = Date.now() - startTime;

      results.push({
        query,
        success: true,
        responseTime,
        retrievedDocs: response.metadata.retrievedDocuments || 0,
        chunkLevels: response.metadata.chunkLevelsUsed || [],
        response: response.response.substring(0, 100) + '...',
      });
    } catch (error) {
      results.push({
        query,
        success: false,
        responseTime: Date.now() - startTime,
        retrievedDocs: 0,
        chunkLevels: [],
        error: `${error}`,
      });
    }
  }

  return {
    success: results.some(r => r.success),
    results,
  };
}

async function main() {
  console.log('🚀 Starting Advanced Multi-Level Sync...');
  console.log(`👤 User ID: ${USER_ID}`);
  console.log('');

  try {
    // Step 1: Execute complete sync
    console.log('📊 Step 1: Executing complete sync...');
    const syncResult = await executeCompleteSync(USER_ID);
    
    console.log('\n✅ Sync Results:');
    console.log(`   Success: ${syncResult.success}`);
    console.log(`   Total Chunks: ${syncResult.totalChunks}`);
    console.log(`   Processing Time: ${syncResult.processingTime}ms`);
    
    if (Object.keys(syncResult.chunksByLevel).length > 0) {
      console.log('   Chunks by Level:');
      Object.entries(syncResult.chunksByLevel).forEach(([level, count]) => {
        console.log(`     Level ${level}: ${count} chunks`);
      });
    }
    
    if (syncResult.errors.length > 0) {
      console.log('   ⚠️ Errors:');
      syncResult.errors.forEach(error => console.log(`     - ${error}`));
    }

    if (!syncResult.success) {
      console.log('❌ Sync failed, skipping RAG test');
      return;
    }

    // Step 2: Test Enhanced RAG
    console.log('\n🧪 Step 2: Testing Enhanced RAG...');
    const testResult = await testEnhancedRAG(USER_ID);
    
    console.log('\n🎯 RAG Test Results:');
    console.log(`   Overall Success: ${testResult.success}`);
    console.log('   Individual Tests:');
    
    testResult.results.forEach((result, index) => {
      const status = result.success ? '✅' : '❌';
      console.log(`     ${index + 1}. ${status} "${result.query}"`);
      console.log(`        Response Time: ${result.responseTime}ms`);
      console.log(`        Retrieved Docs: ${result.retrievedDocs}`);
      console.log(`        Chunk Levels: [${result.chunkLevels.join(', ')}]`);
    });

    // Summary
    console.log('\n🎉 Advanced Sync Complete!');
    console.log('');
    console.log('📋 Next Steps:');
    console.log('1. Update your chat interface to use EnhancedRAGService');
    console.log('2. Test queries like:');
    console.log('   - "How productive was I this week?"');
    console.log('   - "What tasks am I working on?"');
    console.log('   - "Which project needs attention?"');
    console.log('   - "Show me my morning productivity patterns"');

  } catch (error) {
    console.error('❌ Advanced sync failed:', error);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Check Firebase connection');
    console.log('2. Verify Supabase connection');
    console.log('3. Ensure OpenAI API key is valid');
    console.log('4. Check user has data in Firebase');
  }
}

// Run the script
main().catch(console.error); 