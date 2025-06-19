import React, { useState } from 'react';
import { RerankerService } from '../../services/rerankerService';
import { HybridSearchService } from '../../services/hybridSearchService';
// import { useAuthStore } from '../../stores/useAuthStore';

interface RerankingTestResult {
  originalResults: Array<{ document: any; score: number }>;
  rerankedResults: Array<{ document: any; originalScore: number; rerankScore: number; rank: number; confidence: number; explanation?: string }>;
  metadata: any;
  processingTime: number;
}

const RerankingTester: React.FC = () => {
  const [query, setQuery] = useState('');
  const [rerankingModel, setRerankingModel] = useState<'cross-encoder' | 'semantic-similarity' | 'hybrid'>('hybrid');
  const [results, setResults] = useState<RerankingTestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuthStore();

  const testQueries = [
    'How many projects do I have?',
    'What tasks am I working on?',
    'Show me my productivity summary',
    'Tell me about my recent work sessions',
    'What is my progress on current projects?',
    'How efficient have I been this week?'
  ];

  const performRerankingTest = async () => {
    if (!user?.uid || !query.trim()) return;

    setLoading(true);
    setError(null);
    
    try {
      const startTime = Date.now();
      
      // Step 1: Get initial results from hybrid search (without re-ranking)
      console.log('🔍 Getting initial hybrid search results...');
      const hybridResult = await HybridSearchService.performHybridSearch(
        query,
        user.uid,
        {
          enableReranking: false, // Disable for baseline
          maxResults: 20,
          vectorWeight: 1.0,
          keywordWeight: 1.0
        }
      );

      if (!hybridResult.fusedResults || hybridResult.fusedResults.length === 0) {
        setError('No initial results found for re-ranking test');
        return;
      }

      // Step 2: Prepare candidates for re-ranking
      const candidates = hybridResult.fusedResults.map(result => ({
        document: result.document,
        score: result.fusedScore
      }));

      console.log(`📊 Testing re-ranking with ${candidates.length} candidates`);

      // Step 3: Apply re-ranking
      const { rerankedResults, metadata } = await RerankerService.rerankDocuments(
        query,
        candidates,
        {
          model: rerankingModel,
          maxCandidates: 50,
          minRelevanceScore: 0.1,
          contextWindow: 512,
          diversityWeight: 0.1,
          recencyWeight: 0.05,
          contentTypeWeights: {
            'project_summary': 1.2,
            'task_aggregate': 1.1,
            'session': 1.0,
            'daily_summary': 0.9
          }
        }
      );

      const processingTime = Date.now() - startTime;

      setResults({
        originalResults: candidates,
        rerankedResults,
        metadata,
        processingTime
      });

    } catch (err) {
      console.error('❌ Re-ranking test failed:', err);
      setError(err instanceof Error ? err.message : 'Re-ranking test failed');
    } finally {
      setLoading(false);
    }
  };

  const renderScoreComparison = (original: number, reranked: number) => {
    const improvement = reranked - original;
    const improvementPercent = original > 0 ? ((improvement / original) * 100) : 0;
    
    return (
      <div className="flex items-center space-x-2">
        <span className="text-sm text-gray-600">
          {original.toFixed(3)} → {reranked.toFixed(3)}
        </span>
        <span className={`text-xs px-2 py-1 rounded ${
          improvement > 0 ? 'bg-green-100 text-green-700' : 
          improvement < 0 ? 'bg-red-100 text-red-700' : 
          'bg-gray-100 text-gray-600'
        }`}>
          {improvement > 0 ? '+' : ''}{improvementPercent.toFixed(1)}%
        </span>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">
          🔄 Re-ranking Testing Lab
        </h2>
        <div className="text-sm text-gray-500">
          Test and compare re-ranking strategies
        </div>
      </div>

      {/* Query Input */}
      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Test Query
          </label>
          <div className="flex space-x-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter your test query..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <select
              value={rerankingModel}
              onChange={(e) => setRerankingModel(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="hybrid">Hybrid Re-ranking</option>
              <option value="cross-encoder">Cross-Encoder</option>
              <option value="semantic-similarity">Semantic Similarity</option>
            </select>
            <button
              onClick={performRerankingTest}
              disabled={loading || !query.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Testing...' : 'Test Re-ranking'}
            </button>
          </div>
        </div>

        {/* Quick Test Queries */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Quick Test Queries
          </label>
          <div className="flex flex-wrap gap-2">
            {testQueries.map((testQuery, index) => (
              <button
                key={index}
                onClick={() => setQuery(testQuery)}
                className="px-3 py-1 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200"
              >
                {testQuery}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="text-red-800 text-sm">❌ {error}</div>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="space-y-6">
          {/* Metadata Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {results.originalResults.length}
              </div>
              <div className="text-sm text-gray-600">Original Results</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {results.rerankedResults.length}
              </div>
              <div className="text-sm text-gray-600">Re-ranked Results</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {results.metadata.averageConfidence.toFixed(3)}
              </div>
              <div className="text-sm text-gray-600">Avg Confidence</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {results.processingTime}ms
              </div>
              <div className="text-sm text-gray-600">Processing Time</div>
            </div>
          </div>

          {/* Score Distribution */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-3">
              📊 Score Distribution
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-xl font-bold text-green-600">
                  {results.metadata.scoreDistribution.high}
                </div>
                                 <div className="text-sm text-gray-600">High (&gt;0.8)</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-yellow-600">
                  {results.metadata.scoreDistribution.medium}
                </div>
                <div className="text-sm text-gray-600">Medium (0.4-0.8)</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-red-600">
                  {results.metadata.scoreDistribution.low}
                </div>
                                 <div className="text-sm text-gray-600">Low (&lt;0.4)</div>
              </div>
            </div>
          </div>

          {/* Results Comparison */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">
              📋 Results Comparison (Top 10)
            </h3>
            
            {results.rerankedResults.slice(0, 10).map((rerankedResult, index) => {
              const originalResult = results.originalResults.find(
                orig => orig.document.id === rerankedResult.document.id
              );
              const originalScore = originalResult?.score || 0;
              
              return (
                <div
                  key={index}
                  className="p-4 border border-gray-200 rounded-lg"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">
                        #{rerankedResult.rank} - {rerankedResult.document.content_type || 'Unknown'}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        {rerankedResult.document.content?.substring(0, 150)}...
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        Confidence: {(rerankedResult.confidence * 100).toFixed(1)}%
                      </div>
                      {renderScoreComparison(originalScore, rerankedResult.rerankScore)}
                    </div>
                  </div>
                  
                  {rerankedResult.explanation && (
                    <div className="mt-2 p-2 bg-blue-50 rounded text-sm text-blue-800">
                      💡 {rerankedResult.explanation}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Performance Analysis */}
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h3 className="text-lg font-medium text-yellow-800 mb-2">
              ⚡ Performance Analysis
            </h3>
            <div className="text-sm text-yellow-700 space-y-1">
              <div>• Strategy: {results.metadata.strategy}</div>
              <div>• Processing Time: {results.metadata.processingTime}ms</div>
              <div>• Candidates Processed: {results.metadata.totalCandidates}</div>
              <div>• Results Returned: {results.metadata.rerankedResults}</div>
              <div>• Average Confidence: {(results.metadata.averageConfidence * 100).toFixed(1)}%</div>
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="text-sm font-medium text-blue-800 mb-2">
          📖 How to Use This Tester
        </h3>
        <div className="text-sm text-blue-700 space-y-1">
          <div>1. Enter a test query or select from quick options</div>
          <div>2. Choose a re-ranking model (Hybrid recommended)</div>
          <div>3. Click "Test Re-ranking" to see how scores change</div>
          <div>4. Compare original vs re-ranked scores and confidence levels</div>
          <div>5. Green percentages indicate score improvements</div>
        </div>
      </div>
    </div>
  );
};

export default RerankingTester; 