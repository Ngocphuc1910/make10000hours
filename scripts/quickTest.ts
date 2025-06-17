// Quick component test - tests individual parts
import { HierarchicalChunker } from '../src/services/hierarchicalChunker';

async function quickComponentTest() {
  console.log('🔧 Quick Component Test...\n');

  const USER_ID = '7Y4oV5qJm4MFo0ZJBXkH0cJNk0z1';

  try {
    // Test 1: Can we create chunks?
    console.log('📦 Testing HierarchicalChunker...');
    const chunks = await HierarchicalChunker.createMultiLevelChunks(USER_ID);
    
    console.log(`✅ Generated ${chunks.length} chunks`);
    
    if (chunks.length > 0) {
      const sampleChunk = chunks[0];
      console.log(`📄 Sample chunk:`);
      console.log(`   Type: ${sampleChunk.metadata.chunkType}`);
      console.log(`   Level: ${sampleChunk.metadata.chunkLevel}`);
      console.log(`   Content: ${sampleChunk.content.substring(0, 100)}...`);
      console.log(`   Token Count: ${sampleChunk.tokenCount}`);
    }

    // Group by level
    const levelStats = chunks.reduce((acc, chunk) => {
      const level = chunk.metadata.chunkLevel;
      acc[level] = (acc[level] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    console.log('\n📊 Chunks by Level:');
    Object.entries(levelStats).forEach(([level, count]) => {
      console.log(`   Level ${level}: ${count} chunks`);
    });

  } catch (error) {
    console.error('❌ Component test failed:', error);
  }
}

quickComponentTest().catch(console.error); 