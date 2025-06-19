// Test script for AI-powered content type selection
import { IntelligentQueryClassifier } from './src/services/intelligentQueryClassifier.js';

const testQueries = [
  "Give me the list of tasks in the 'AI' project",
  "How productive was I this month?", 
  "What were my work sessions today?",
  "Show me my task completion rate",
  "What projects did I work on this week?",
  "How much time did I spend on the Make10000hours project?",
  "What tasks are still incomplete?",
  "Show me my productivity patterns"
];

async function testAIContentSelection() {
  console.log('🧪 Testing AI-Powered Content Type Selection with Real Sample Data\n');
  
  for (const query of testQueries) {
    try {
      console.log(`\n📝 Query: "${query}"`);
      
      const result = await IntelligentQueryClassifier.selectBestContentTypesWithAI(query, 'test-user');
      
      console.log(`✅ Primary Types: ${result.primaryTypes.join(', ')}`);
      console.log(`➕ Secondary Types: ${result.secondaryTypes.join(', ')}`);
      console.log(`💭 Reasoning: ${result.reasoning}`);
      console.log(`🎯 Confidence: ${result.confidence}%`);
      console.log('---');
      
    } catch (error) {
      console.error(`❌ Error testing query "${query}":`, error.message);
    }
  }
}

// Run the test
testAIContentSelection().catch(console.error); 