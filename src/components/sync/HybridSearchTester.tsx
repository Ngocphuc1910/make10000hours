import React, { useState } from 'react';
import { HybridSearchService } from '../../services/hybridSearchService';

interface HybridSearchTesterProps {
  userId: string;
}

export const HybridSearchTester: React.FC<HybridSearchTesterProps> = ({ userId }) => {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const testQueries = [
    'productivity today',
    'tasks in progress',
    'project status',
    'deep focus sessions',
    'time spent coding',
    'meeting notes',
    'completed tasks'
  ];

  const handleSearch = async () => {
    if (!query.trim()) return;
    
    setIsSearching(true);
    setError(null);
    
    try {
      console.log(`🔍 Testing hybrid search: "${query}"`);
      
      const result = await HybridSearchService.performHybridSearch(query, userId, {
        maxResults: 10,
        vectorWeight: 1.0,
        keywordWeight: 1.0,
        enableEnhancedBM25: true,
        contentTypeBoosts: {
          'task': 1.2,
          'project': 1.1,
          'session': 1.0,
          'daily_summary': 1.0
        }
      });
      
      setResults(result);
      console.log('✅ Hybrid search result:', result);
      
    } catch (err) {
      console.error('❌ Hybrid search test failed:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSearching(false);
    }
  };

  const handleTestQuery = (testQuery: string) => {
    setQuery(testQuery);
  };

  const runAllTests = async () => {
    console.log('🧪 Running all hybrid search tests...');
    
    for (const testQuery of testQueries) {
      console.log(`\n🔍 Testing: "${testQuery}"`);
      try {
        const result = await HybridSearchService.performHybridSearch(testQuery, userId, {
          maxResults: 5,
          enableEnhancedBM25: true
        });
        console.log(`✅ ${testQuery}: ${result.documents.length} results in ${result.metadata.processingTime}ms`);
      } catch (err) {
        console.error(`❌ ${testQuery}: Failed -`, err);
      }
    }
    
    console.log('🏁 All tests completed');
  };

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        🔍 Hybrid Search Tester
      </h3>
      
      {/* Search Input */}
      <div className="mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter search query..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button
            onClick={handleSearch}
            disabled={isSearching || !query.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </div>
      </div>

      {/* Quick Test Queries */}
      <div className="mb-4">
        <p className="text-sm text-gray-600 mb-2">Quick test queries:</p>
        <div className="flex flex-wrap gap-2">
          {testQueries.map((testQuery) => (
            <button
              key={testQuery}
              onClick={() => handleTestQuery(testQuery)}
              className="px-3 py-1 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
            >
              {testQuery}
            </button>
          ))}
        </div>
      </div>

      {/* Run All Tests Button */}
      <div className="mb-4">
        <button
          onClick={runAllTests}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
        >
          🧪 Run All Tests (Check Console)
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800 text-sm">❌ Error: {error}</p>
        </div>
      )}

      {/* Results Display */}
      {results && (
        <div className="space-y-4">
          {/* Metadata */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
            <h4 className="font-medium text-blue-900 mb-2">Search Metadata</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="font-medium">Processing Time:</span> {results.metadata.processingTime}ms
              </div>
              <div>
                <span className="font-medium">Strategy:</span> {results.metadata.searchStrategy}
              </div>
              <div>
                <span className="font-medium">Vector Results:</span> {results.metadata.vectorResultCount}
              </div>
              <div>
                <span className="font-medium">Keyword Results:</span> {results.metadata.keywordResultCount}
              </div>
              <div>
                <span className="font-medium">Total Docs:</span> {results.metadata.totalDocuments}
              </div>
              <div>
                <span className="font-medium">Final Results:</span> {results.metadata.hybridResultCount}
              </div>
            </div>
          </div>

          {/* RRF Analysis */}
          {results.metadata.rrfAnalysis && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-md">
              <h4 className="font-medium text-green-900 mb-2">RRF Analysis</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="font-medium">Vector Only:</span> {results.metadata.rrfAnalysis.vectorOnlyResults}
                </div>
                <div>
                  <span className="font-medium">Keyword Only:</span> {results.metadata.rrfAnalysis.keywordOnlyResults}
                </div>
                <div>
                  <span className="font-medium">Hybrid:</span> {results.metadata.rrfAnalysis.hybridResults}
                </div>
                <div>
                  <span className="font-medium">Avg Score:</span> {results.metadata.rrfAnalysis.averageFusedScore.toFixed(4)}
                </div>
              </div>
            </div>
          )}

          {/* Document Results */}
          <div>
            <h4 className="font-medium text-gray-900 mb-2">
              Results ({results.documents.length})
            </h4>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {results.documents.map((doc: any, index: number) => (
                <div
                  key={doc.id || index}
                  className="p-3 bg-gray-50 border border-gray-200 rounded-md"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-sm font-medium text-gray-900">
                      {doc.content_type || 'Unknown Type'}
                    </span>
                    <div className="text-xs text-gray-500 space-x-2">
                      {doc.hybrid_score && (
                        <span>H: {doc.hybrid_score.toFixed(3)}</span>
                      )}
                      {doc.vector_score && (
                        <span>V: {doc.vector_score.toFixed(3)}</span>
                      )}
                      {doc.keyword_score && (
                        <span>K: {doc.keyword_score.toFixed(3)}</span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 line-clamp-3">
                    {doc.content.substring(0, 200)}
                    {doc.content.length > 200 && '...'}
                  </p>
                  {doc.metadata?.entities?.projectId && (
                    <p className="text-xs text-gray-500 mt-1">
                      Project: {doc.metadata.entities.projectId}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 