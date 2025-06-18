import React, { useState } from 'react';
import { useUserStore } from '../../store/userStore';
import { AdvancedDataSyncService } from '../../services/advancedDataSyncService';
import { IncrementalSyncService } from '../../services/incrementalSyncService';

interface SyncResult {
  success: boolean;
  totalChunks: number;
  chunksByLevel: Record<number, number>;
  processingTime: number;
  errors: string[];
}

interface TestResult {
  success: boolean;
  queryResults: any[];
  processingTime: number;
  errors: string[];
}

export const AdvancedSyncDashboard: React.FC = () => {
  const { user } = useUserStore();
  const [isRunning, setIsRunning] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isWeeklySync, setIsWeeklySync] = useState(false);
  const [isMonthlySync, setIsMonthlySync] = useState(false);
  const [isProjectSync, setIsProjectSync] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<any>(null);
  const [projectSyncResult, setProjectSyncResult] = useState<any>(null);

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

  const handleWeeklySync = async () => {
    if (!user?.uid) return;

    setIsWeeklySync(true);
    setSyncResult(null);

    try {
      const result = await AdvancedDataSyncService.executeWeeklySync(user.uid);
      setSyncResult(result);
    } catch (error) {
      console.error('Weekly sync failed:', error);
      setSyncResult({
        success: false,
        totalChunks: 0,
        chunksByLevel: {},
        processingTime: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      });
    } finally {
      setIsWeeklySync(false);
    }
  };

  const handleMonthlySync = async () => {
    if (!user?.uid) return;

    setIsMonthlySync(true);
    setSyncResult(null);

    try {
      const result = await AdvancedDataSyncService.executeMonthlySync(user.uid);
      setSyncResult(result);
    } catch (error) {
      console.error('Monthly sync failed:', error);
      setSyncResult({
        success: false,
        totalChunks: 0,
        chunksByLevel: {},
        processingTime: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      });
    } finally {
      setIsMonthlySync(false);
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

  const handleProjectSync = async () => {
    if (!user?.uid) return;

    setIsProjectSync(true);
    setProjectSyncResult(null);

    try {
      const result = await IncrementalSyncService.executeProjectSync(user.uid);
      setProjectSyncResult(result);
    } catch (error) {
      console.error('Project sync failed:', error);
      setProjectSyncResult({
        success: false,
        processedDocuments: 0,
        skippedDocuments: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        executionTime: 0,
        collections: { tasks: 0, projects: 0, workSessions: 0 }
      });
    } finally {
      setIsProjectSync(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-wrap gap-4">
          <button
            onClick={handleAdvancedSync}
            disabled={isRunning || isTesting || isMigrating || isWeeklySync || isMonthlySync || isProjectSync}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <span>{isRunning ? 'Running Full Sync...' : 'Run Full Sync'}</span>
          </button>

          <button
            onClick={handleWeeklySync}
            disabled={isRunning || isTesting || isMigrating || isWeeklySync || isMonthlySync || isProjectSync}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            <span>{isWeeklySync ? 'Syncing Weekly Summary...' : 'Sync Weekly Summary'}</span>
          </button>

          <button
            onClick={handleMonthlySync}
            disabled={isRunning || isTesting || isMigrating || isWeeklySync || isMonthlySync || isProjectSync}
            className="flex items-center space-x-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
          >
            <span>{isMonthlySync ? 'Syncing Monthly Summary...' : 'Sync Monthly Summary'}</span>
          </button>

          <button
            onClick={testEnhancedRAG}
            disabled={isRunning || isTesting || isMigrating || isWeeklySync || isMonthlySync || isProjectSync}
            className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            <span>{isTesting ? 'Testing...' : 'Test RAG'}</span>
          </button>

          <button
            onClick={handleMigration}
            disabled={isRunning || isTesting || isMigrating || isWeeklySync || isMonthlySync || isProjectSync}
            className="flex items-center space-x-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
          >
            <span>{isMigrating ? 'Migrating...' : 'Run Migration'}</span>
          </button>

          <button
            onClick={handleProjectSync}
            disabled={isRunning || isTesting || isMigrating || isWeeklySync || isMonthlySync || isProjectSync}
            className="flex items-center space-x-2 px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:opacity-50"
          >
            <span>{isProjectSync ? 'Syncing Projects...' : 'Sync Project Chunks'}</span>
          </button>
        </div>

        {/* Results Display */}
        {syncResult && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {isWeeklySync ? 'Weekly Summary Sync Results' : isMonthlySync ? 'Monthly Summary Sync Results' : 'Sync Results'}
            </h3>
            <div className="space-y-2 text-sm text-gray-600">
              <p>Status: {syncResult.success ? '✅ Success' : '❌ Failed'}</p>
              <p>Total Chunks: {syncResult.totalChunks}</p>
              <p>Processing Time: {syncResult.processingTime}ms</p>
              {syncResult.errors.length > 0 && (
                <div className="text-red-600">
                  <p>Errors:</p>
                  <ul className="list-disc list-inside">
                    {syncResult.errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {testResult && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-2">RAG Test Results</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <p>Status: {testResult.success ? '✅ Success' : '❌ Failed'}</p>
              <p>Processing Time: {testResult.processingTime}ms</p>
              <p>Results Found: {testResult.queryResults.length}</p>
              {testResult.errors.length > 0 && (
                <div className="text-red-600">
                  <p>Errors:</p>
                  <ul className="list-disc list-inside">
                    {testResult.errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {migrationResult && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Migration Results</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <p>Status: {migrationResult.success ? '✅ Success' : '❌ Failed'}</p>
              <p>Removed Chunks: {migrationResult.removedChunks}</p>
              {migrationResult.errors?.length > 0 && (
                <div className="text-red-600">
                  <p>Errors:</p>
                  <ul className="list-disc list-inside">
                    {migrationResult.errors.map((error: string, index: number) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {projectSyncResult && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Project Sync Results</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <p>Status: {projectSyncResult.success ? '✅ Success' : '❌ Failed'}</p>
              <p>Processed Documents: {projectSyncResult.processedDocuments}</p>
              <p>Skipped Documents: {projectSyncResult.skippedDocuments}</p>
              <p>Execution Time: {projectSyncResult.executionTime}ms</p>
              <p>Collections: Tasks - {projectSyncResult.collections.tasks}, Projects - {projectSyncResult.collections.projects}, Work Sessions - {projectSyncResult.collections.workSessions}</p>
              {projectSyncResult.errors.length > 0 && (
                <div className="text-red-600">
                  <p>Errors:</p>
                  <ul className="list-disc list-inside">
                    {projectSyncResult.errors.map((error: string, index: number) => (
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
  );
}; 