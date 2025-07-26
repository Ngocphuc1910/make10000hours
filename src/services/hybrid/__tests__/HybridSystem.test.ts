import { QueryClassifier } from '../QueryClassifier';
import { HybridChatService } from '../HybridChatService';
import { QueryType } from '../types';

// Mock Firebase and Supabase to avoid actual database calls during testing
jest.mock('../../firebase', () => ({
  db: {
    collection: jest.fn(() => ({
      where: jest.fn(() => ({
        where: jest.fn(() => ({
          get: jest.fn(() => Promise.resolve({ size: 5, docs: [] }))
        }))
      }))
    }))
  }
}));

jest.mock('../../supabase', () => ({
  supabase: {
    rpc: jest.fn(() => Promise.resolve({ data: [], error: null }))
  }
}));

jest.mock('../../openai', () => ({
  OpenAIService: {
    generateEmbedding: jest.fn(() => Promise.resolve([0.1, 0.2, 0.3])),
    generateChatResponse: jest.fn(() => Promise.resolve({ content: 'Test response' }))
  }
}));

describe('Hybrid System Integration Tests', () => {
  
  describe('QueryClassifier', () => {
    test('should classify count queries correctly', () => {
      const query = "How many tasks do I have in project make10000hours?";
      const classification = QueryClassifier.classify(query);
      
      expect(classification.type).toBe(QueryType.OPERATIONAL_COUNT);
      expect(classification.confidence).toBeGreaterThan(0.8);
      expect(classification.entities).toHaveLength(1);
      expect(classification.entities[0].type).toBe('project');
      expect(classification.entities[0].value).toBe('make10000hours');
    });

    test('should classify list queries correctly', () => {
      const query = "Give me the list of tasks I created for so long but did not work yet";
      const classification = QueryClassifier.classify(query);
      
      expect(classification.type).toBe(QueryType.OPERATIONAL_LIST);
      expect(classification.confidence).toBeGreaterThan(0.8);
    });

    test('should classify comparison queries correctly', () => {
      const query = "Compare me which project I spent most of my time in the last 2 weeks";
      const classification = QueryClassifier.classify(query);
      
      expect(classification.type).toBe(QueryType.OPERATIONAL_ANALYSIS);
      expect(classification.confidence).toBeGreaterThan(0.8);
      expect(classification.temporalFilter).toBeDefined();
      expect(classification.temporalFilter?.period).toBe('2 weeks');
    });

    test('should extract helper entities correctly', () => {
      const query = "Tell me which task that I noted I need Khanh help me";
      const classification = QueryClassifier.classify(query);
      
      expect(classification.entities.some(e => e.type === 'person' && e.value === 'Khanh')).toBe(true);
    });

    test('should handle analytical queries', () => {
      const query = "What are the common productivity patterns in my work habits?";
      const classification = QueryClassifier.classify(query);
      
      expect(classification.type).toBe(QueryType.ANALYTICAL);
      expect(classification.requiresVector).toBe(true);
    });
  });

  describe('HybridChatService Integration', () => {
    let hybridService: HybridChatService;

    beforeEach(() => {
      hybridService = HybridChatService.getInstance();
    });

    test('should identify hybrid-suitable queries', () => {
      const hybridQueries = [
        "How many tasks do I have in project A?",
        "List all incomplete tasks",
        "Which project did I spend most time on?",
        "Find tasks that need Khanh's help"
      ];

      hybridQueries.forEach(query => {
        // Access private method for testing
        const shouldUse = (hybridService as any).shouldUseHybridProcessing(query);
        expect(shouldUse).toBe(true);
      });
    });

    test('should identify non-hybrid queries', () => {
      const traditionalQueries = [
        "What's the weather today?",
        "Explain productivity concepts",
        "How do I improve focus?",
        "Tell me a joke"
      ];

      traditionalQueries.forEach(query => {
        const shouldUse = (hybridService as any).shouldUseHybridProcessing(query);
        expect(shouldUse).toBe(false);
      });
    });

    test('should handle errors gracefully', async () => {
      // Mock an error in the parallel execution
      const originalExecute = require('../ParallelExecutionEngine').ParallelExecutionEngine.executeHybridQuery;
      require('../ParallelExecutionEngine').ParallelExecutionEngine.executeHybridQuery = 
        jest.fn(() => Promise.reject(new Error('Test error')));

      const result = await hybridService.processMessage(
        "How many tasks do I have?",
        "test-user-id"
      );

      expect(result.useHybrid).toBe(false);
      expect(result.fallbackReason).toContain('Hybrid system unavailable');
      expect(result.response).toBeDefined();

      // Restore original function
      require('../ParallelExecutionEngine').ParallelExecutionEngine.executeHybridQuery = originalExecute;
    });
  });

  describe('End-to-End Validation', () => {
    test('should handle the 6 critical questions', async () => {
      const criticalQuestions = [
        "Tell me how many task I have in project like make10000hours",
        "How many incompleted task in project A",
        "Compare me which project I spent most of my time in the last 2 week",
        "Give me the list of task I created for so long but did not work yet",
        "Tell me which task that I noted I need Khanh help me",
        "Retrieve all task in Project A, read description and tell me which feature I did not build yet needed to build, which bug I have to fix?"
      ];

      const hybridService = HybridChatService.getInstance();

      for (const question of criticalQuestions) {
        const classification = QueryClassifier.classify(question);
        expect(classification.type).not.toBe(QueryType.ANALYTICAL); // Should be operational
        expect(classification.confidence).toBeGreaterThan(0.7);
        
        // Should be identified as hybrid-suitable
        const shouldUse = (hybridService as any).shouldUseHybridProcessing(question);
        expect(shouldUse).toBe(true);
      }
    });

    test('should provide high confidence for operational queries', () => {
      const operationalQueries = [
        "Count my tasks in project X",
        "List incomplete tasks",
        "Show tasks created last week"
      ];

      operationalQueries.forEach(query => {
        const classification = QueryClassifier.classify(query);
        expect(classification.confidence).toBeGreaterThan(0.8);
        expect([
          QueryType.OPERATIONAL_COUNT,
          QueryType.OPERATIONAL_LIST,
          QueryType.OPERATIONAL_SEARCH
        ]).toContain(classification.type);
      });
    });
  });

  describe('Performance and Reliability', () => {
    test('should handle concurrent requests', async () => {
      const hybridService = HybridChatService.getInstance();
      const queries = Array(5).fill("How many tasks do I have?");
      
      const promises = queries.map((query, index) => 
        hybridService.processMessage(query, `user-${index}`)
      );

      const results = await Promise.all(promises);
      results.forEach(result => {
        expect(result.response).toBeDefined();
      });
    });

    test('should provide system health information', async () => {
      const hybridService = HybridChatService.getInstance();
      const health = await hybridService.getSystemHealth();
      
      expect(health.circuitBreakerState).toBeDefined();
      expect(typeof health.recentErrors).toBe('number');
    });
  });
});

// Utility function for manual testing
export const testCriticalQuestions = async () => {
  const hybridService = HybridChatService.getInstance();
  const testUserId = 'test-user-manual';
  
  const questions = [
    "Tell me how many task I have in project like make10000hours",
    "How many incompleted task in project A", 
    "Compare me which project I spent most of my time in the last 2 week",
    "Give me the list of task I created for so long but did not work yet",
    "Tell me which task that I noted I need Khanh help me",
    "Retrieve all task in Project A, read description and tell me which feature I did not build yet needed to build, which bug I have to fix?"
  ];

  console.log('Testing critical questions...\n');
  
  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    console.log(`Question ${i + 1}: ${question}`);
    
    try {
      const result = await hybridService.processMessage(question, testUserId);
      console.log(`Response: ${result.response}`);
      console.log(`Used Hybrid: ${result.useHybrid}`);
      console.log(`Confidence: ${result.confidence || 'N/A'}`);
      console.log(`Sources: ${result.sources?.length || 0} sources`);
      console.log('---\n');
    } catch (error) {
      console.error(`Error processing question ${i + 1}:`, error);
      console.log('---\n');
    }
  }
};