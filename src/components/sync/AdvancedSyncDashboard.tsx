import React, { useState } from 'react';
import { useUserStore } from '../../store/userStore';
import { AdvancedDataSyncService } from '../../services/advancedDataSyncService';

interface SyncResult {
  success: boolean;
  totalChunks: number;
  chunksByLevel: Record<number, number>;
  processingTime: number;
  errors: string[];
}

interface TestResult {
  success: boolean;
  results: Array<{
    query: string;
    responseTime: number;
    retrievedDocs: number;
    chunkLevels: number[];
    success: boolean;
  }>;
}

export const AdvancedSyncDashboard: React.FC = () => {
  const { user } = useUserStore();
  const [isRunning, setIsRunning] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<any>(null);

  const handleAdvancedSync = async () => {
    if (!user?.uid) return;

    setIsRunning(true);
    setSyncResult(null);

    try {
      const result = await AdvancedDataSyncService.executeCompleteSync(user.uid);
      setSyncResult(result);
    } catch (error) {
      console.error('Advanced sync failed:', error);
      setSyncResult({
        success: false,
        totalChunks: 0,
        chunksByLevel: {},
        processingTime: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      });
    } finally {
      setIsRunning(false);
    }
  };

  const testEnhancedRAG = async () => {
    if (!user?.uid) return;
    
    setIsTesting(true);
    setTestResult(null);
    
    try {
      const result = await AdvancedDataSyncService.testEnhancedRAG(user.uid);
      setTestResult(result);
    } catch (error) {
      console.error('RAG testing failed:', error);
    } finally {
      setIsTesting(false);
    }
  };

  const handleMigration = async () => {
    if (!user?.uid) return;

    setIsMigrating(true);
    setMigrationResult(null);

    try {
      const result = await AdvancedDataSyncService.migrateSyntheticChunks(user.uid);
      setMigrationResult(result);
    } catch (error) {
      console.error('Migration failed:', error);
      setMigrationResult({
        success: false,
        removedChunks: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      });
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-900">
        🚀 Advanced Multi-Level Chunking System
      </h2>
      
      <div className="space-y-6">
        {/* Phase 3 Status */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-green-800 mb-2">
            ✅ Phase 3: Multi-Level Chunking (Complete)
          </h3>
          <ul className="text-green-700 space-y-1">
            <li>• Synthetic text generation with 4 levels</li>
            <li>• Hybrid search with metadata filtering</li>
            <li>• Intelligent query routing and relevance ranking</li>
            <li>• Proper Firebase field mapping</li>
          </ul>
        </div>

        {/* Advanced Sync Section */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-3">Multi-Level Data Sync</h3>
          <p className="text-gray-600 mb-4">
            Generate synthetic text chunks across 4 levels: Sessions, Task Aggregates, Project Summaries, and Temporal Patterns.
          </p>
          
          <button
            onClick={handleAdvancedSync}
            disabled={isRunning || !user}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-md transition-colors"
          >
            {isRunning ? '🔄 Processing Multi-Level Chunks...' : '🚀 Execute Advanced Sync'}
          </button>

          {syncResult && (
            <div className="mt-4 p-4 bg-gray-50 rounded-md">
              <h4 className="font-semibold mb-2">
                {syncResult.success ? '✅ Sync Complete' : '❌ Sync Failed'}
              </h4>
              <div className="text-sm space-y-1">
                <p><strong>Total Chunks:</strong> {syncResult.totalChunks}</p>
                <p><strong>Processing Time:</strong> {syncResult.processingTime}ms</p>
                
                {Object.keys(syncResult.chunksByLevel).length > 0 && (
                  <div>
                    <strong>Chunks by Level:</strong>
                    <ul className="ml-4">
                      {Object.entries(syncResult.chunksByLevel).map(([level, count]) => (
                        <li key={level}>Level {level}: {count} chunks</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {syncResult.errors.length > 0 && (
                  <div>
                    <strong>Errors:</strong>
                    <ul className="ml-4 text-red-600">
                      {syncResult.errors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Enhanced RAG Testing */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-3">Enhanced RAG Testing</h3>
          <p className="text-gray-600 mb-4">
            Test hybrid search with intelligent chunk level selection across different query types.
          </p>
          
          <button
            onClick={testEnhancedRAG}
            disabled={isTesting || !user || !syncResult?.success}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-md transition-colors"
          >
            {isTesting ? '🧪 Testing Enhanced RAG...' : '🧪 Test Hybrid Search'}
          </button>

          {testResult && (
            <div className="mt-4 p-4 bg-gray-50 rounded-md">
              <h4 className="font-semibold mb-2">
                {testResult.success ? '✅ All Tests Passed' : '⚠️ Some Tests Failed'}
              </h4>
              <div className="space-y-2">
                {testResult.results.map((result, index) => (
                  <div key={index} className="text-sm border-l-4 border-gray-300 pl-3">
                    <p><strong>Query:</strong> "{result.query}"</p>
                    <p className="text-gray-600">
                      {result.success ? '✅' : '❌'} {result.responseTime}ms | 
                      {result.retrievedDocs} docs | 
                      Levels: [{result.chunkLevels.join(', ')}]
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Implementation Guide */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-blue-800 mb-2">
            📋 Implementation Complete
          </h3>
          <div className="text-blue-700 space-y-2">
            <p><strong>Services Created:</strong></p>
            <ul className="ml-4 space-y-1">
              <li>• SyntheticTextGenerator - Natural language conversion</li>
              <li>• HierarchicalChunker - Multi-level chunk generation</li>
              <li>• EnhancedRAGService - Hybrid search with filtering</li>
              <li>• AdvancedDataSyncService - Complete integration</li>
            </ul>
            
            <p className="mt-3"><strong>Next Steps:</strong></p>
            <ol className="ml-4 space-y-1">
              <li>1. Execute Advanced Sync to generate multi-level chunks</li>
              <li>2. Test Enhanced RAG to verify hybrid search functionality</li>
              <li>3. Update chat interface to use EnhancedRAGService</li>
              <li>4. Monitor performance and prepare for Phase 4 optimization</li>
            </ol>
          </div>
        </div>

        {/* Integration Code */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-2">🔗 Chat Interface Integration</h3>
          <pre className="text-sm bg-gray-800 text-green-400 p-3 rounded overflow-x-auto">
{`// Replace in your chat service:
import { EnhancedRAGService } from './services/enhancedRAGService';

const response = await EnhancedRAGService.queryWithHybridSearch(
  query, 
  userId, 
  { 
    timeframe: 'week', 
    chunkLevels: [2, 3] 
  }
);`}
          </pre>
        </div>

        {/* Migration Section */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-3">Data Migration</h3>
          <p className="text-gray-600 mb-4">
            Clean up redundant synthetic_chunk records and show the benefits of the optimization
          </p>
          
          <button
            onClick={handleMigration}
            disabled={isMigrating || !user || !syncResult?.success}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-md transition-colors"
          >
            {isMigrating ? '�� Migrating Data...' : '🚀 Migrate Data'}
          </button>

          {migrationResult && (
            <div className="mt-4 p-4 bg-gray-50 rounded-md">
              <h4 className="font-semibold mb-2">
                {migrationResult.success ? '✅ Migration Complete' : '❌ Migration Failed'}
              </h4>
              <div className="text-sm space-y-1">
                <p><strong>Removed Chunks:</strong> {migrationResult.removedChunks}</p>
                {migrationResult.errors.length > 0 && (
                  <div>
                    <strong>Errors:</strong>
                    <ul className="ml-4 text-red-600">
                                             {migrationResult.errors.map((error: string, index: number) => (
                         <li key={index}>{error}</li>
                       ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 