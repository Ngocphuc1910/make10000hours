import React, { useState } from 'react';
import { FinalRAGDemo, type CompleteDemoResult } from './finalRAGDemo';

export const RAGOptimizationDemo: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<CompleteDemoResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runCompleteDemo = async () => {
    setIsRunning(true);
    setError(null);
    setResults(null);

    try {
      console.log('🚀 Starting 7-Step RAG Optimization Demo...');
      const demoResults = await FinalRAGDemo.executeCompleteDemo('demo-user');
      setResults(demoResults);
      console.log('✅ Demo completed successfully!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('❌ Demo failed:', errorMessage);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          🚀 7-Step RAG Optimization Demo
        </h2>
        <p className="text-gray-600">
          This demonstrates the complete implementation of advanced RAG optimizations
          across 4 weeks of development, including semantic chunking, HNSW indexing,
          intent classification, and production-ready enhancements.
        </p>
      </div>

      <div className="mb-6">
        <button
          onClick={runCompleteDemo}
          disabled={isRunning}
          className={`px-6 py-3 rounded-lg font-medium transition-colors ${
            isRunning
              ? 'bg-gray-400 cursor-not-allowed text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {isRunning ? '⏳ Running Demo...' : '🎬 Run Complete Demo'}
        </button>
      </div>

      {isRunning && (
        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-center mb-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            <span className="text-blue-800 font-medium">Running optimization demo...</span>
          </div>
          <p className="text-blue-700 text-sm">
            This will apply database optimizations, test all 4 weeks of enhancements,
            and measure performance improvements. Check the console for detailed progress.
          </p>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="text-red-800 font-medium mb-2">❌ Demo Failed</h3>
          <p className="text-red-700 text-sm">{error}</p>
          <p className="text-red-600 text-xs mt-2">
            Check the console for detailed error information.
          </p>
        </div>
      )}

      {results && (
        <div className="space-y-6">
          {/* Implementation Status */}
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <h3 className="text-green-800 font-medium mb-3">📊 Implementation Status</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="text-center">
                <div className={`text-2xl mb-1 ${results.implementationStatus.week1 ? 'text-green-600' : 'text-red-600'}`}>
                  {results.implementationStatus.week1 ? '✅' : '❌'}
                </div>
                <div className="text-sm font-medium">Week 1</div>
                <div className="text-xs text-gray-600">Chunking & Preprocessing</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl mb-1 ${results.implementationStatus.week2 ? 'text-green-600' : 'text-red-600'}`}>
                  {results.implementationStatus.week2 ? '✅' : '❌'}
                </div>
                <div className="text-sm font-medium">Week 2</div>
                <div className="text-xs text-gray-600">Database & HNSW</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl mb-1 ${results.implementationStatus.week3 ? 'text-green-600' : 'text-red-600'}`}>
                  {results.implementationStatus.week3 ? '✅' : '❌'}
                </div>
                <div className="text-sm font-medium">Week 3</div>
                <div className="text-xs text-gray-600">Intent & Context</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl mb-1 ${results.implementationStatus.week4 ? 'text-green-600' : 'text-red-600'}`}>
                  {results.implementationStatus.week4 ? '✅' : '❌'}
                </div>
                <div className="text-sm font-medium">Week 4</div>
                <div className="text-xs text-gray-600">Production Ready</div>
              </div>
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="text-blue-800 font-medium mb-3">📈 Performance Improvements</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600 mb-1">
                  {results.performanceMetrics.improvements.responseTimeReduction}
                </div>
                <div className="text-sm font-medium">Response Time</div>
                <div className="text-xs text-gray-600">
                  {results.performanceMetrics.beforeOptimization.averageResponseTime}ms → {results.performanceMetrics.afterOptimization.averageResponseTime}ms
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600 mb-1">
                  {results.performanceMetrics.improvements.accuracyImprovement}
                </div>
                <div className="text-sm font-medium">Search Accuracy</div>
                <div className="text-xs text-gray-600">
                  {results.performanceMetrics.beforeOptimization.searchAccuracy}% → {results.performanceMetrics.afterOptimization.searchAccuracy.toFixed(0)}%
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600 mb-1">
                  {results.performanceMetrics.improvements.contextImprovement}
                </div>
                <div className="text-sm font-medium">Context Relevance</div>
                <div className="text-xs text-gray-600">
                  {results.performanceMetrics.beforeOptimization.contextRelevance}% → {results.performanceMetrics.afterOptimization.contextRelevance}%
                </div>
              </div>
            </div>
          </div>

          {/* Production Readiness */}
          <div className={`p-4 border rounded-lg ${
            results.productionReadiness.isReady 
              ? 'bg-green-50 border-green-200' 
              : 'bg-yellow-50 border-yellow-200'
          }`}>
            <h3 className={`font-medium mb-3 ${
              results.productionReadiness.isReady ? 'text-green-800' : 'text-yellow-800'
            }`}>
              🏆 Production Readiness: {results.productionReadiness.score}/100
            </h3>
            <div className="space-y-2">
              {results.productionReadiness.checklist.map((item: string, index: number) => (
                <div key={index} className="text-sm">{item}</div>
              ))}
            </div>
            {results.productionReadiness.recommendations.length > 0 && (
              <div className="mt-3">
                <div className="text-sm font-medium mb-1">Recommendations:</div>
                {results.productionReadiness.recommendations.map((rec: string, index: number) => (
                  <div key={index} className="text-sm text-gray-700">• {rec}</div>
                ))}
              </div>
            )}
          </div>

          {/* Demo Queries */}
          {results.demoQueries.length > 0 && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <h3 className="text-gray-800 font-medium mb-3">🔍 Query Test Results</h3>
              <div className="space-y-3">
                {results.demoQueries.map((query: any, index: number) => (
                  <div key={index} className="bg-white p-3 rounded border">
                    <div className="font-medium text-sm mb-1">"{query.query}"</div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Response time: {query.executionTime}ms</span>
                      <span>Relevance: {(query.response.metadata.relevanceScore * 100).toFixed(1)}%</span>
                      <span>Documents: {query.response.metadata.retrievedDocuments}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-center text-green-600 font-medium">
            🎉 7-Step RAG Optimization Demo Complete!
          </div>
        </div>
      )}
    </div>
  );
}; 