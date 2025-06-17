import React, { useState, useEffect } from 'react';
import { RefreshCw, Database, CheckCircle, AlertTriangle, XCircle, FileText, Users, Clock, Activity, TrendingUp } from 'lucide-react';
import { useUserStore } from '../../store/userStore';
import { TestUserSync } from '../../services/testUserSync';
import { FirebaseToSupabaseEmbedder } from '../../services/firebaseToSupabaseEmbedder';
import { UserDataValidator } from '../../services/userDataValidator';

interface SyncStatus {
  status: 'loading' | 'success' | 'warning' | 'error';
  message: string;
  lastSync?: Date;
  details?: any;
}

export const DataSyncDashboard: React.FC = () => {
  const { user } = useUserStore();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ status: 'loading', message: 'Checking sync status...' });
  const [isRunningSync, setIsRunningSync] = useState(false);
  const [isRunningEmbeddings, setIsRunningEmbeddings] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number; status: string } | null>(null);
  const [comprehensiveReport, setComprehensiveReport] = useState<any>(null);
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    if (user?.uid) {
      checkSyncStatus();
    }
  }, [user]);

  const checkSyncStatus = async () => {
    if (!user?.uid) return;

    try {
      setSyncStatus({ status: 'loading', message: 'Checking sync status...' });
      
      const healthCheck = await UserDataValidator.quickHealthCheck(user.uid);
      const testResult = await TestUserSync.testUserSync(user.uid);
      
      let status: 'success' | 'warning' | 'error';
      let message: string;

      if (healthCheck.status === 'healthy') {
        status = 'success';
        message = `✅ Sync healthy - ${healthCheck.embeddingCoverage}% coverage`;
      } else if (healthCheck.status === 'warning') {
        status = 'warning';
        message = `⚠️ Sync needs attention - ${healthCheck.embeddingCoverage}% coverage`;
      } else {
        status = 'error';
        message = `❌ ${healthCheck.message}`;
      }

      setSyncStatus({
        status,
        message,
        lastSync: new Date(),
        details: { healthCheck, testResult }
      });

    } catch (error) {
      console.error('Error checking sync status:', error);
      setSyncStatus({
        status: 'error',
        message: `Failed to check sync status: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  };

  const runComprehensiveSync = async () => {
    if (!user?.uid) return;

    try {
      setIsRunningSync(true);
      setSyncProgress({ current: 0, total: 100, status: 'Starting comprehensive sync...' });

      const result = await FirebaseToSupabaseEmbedder.syncAllUserData(
        user.uid,
        (progress) => setSyncProgress(progress)
      );

      if (result.errors.length > 0) {
        setSyncStatus({
          status: 'warning',
          message: `Sync completed with ${result.errors.length} errors`,
          lastSync: new Date(),
          details: result
        });
      } else {
        setSyncStatus({
          status: 'success',
          message: `✅ Successfully synced ${result.synced} documents`,
          lastSync: new Date(),
          details: result
        });
      }

      // Refresh status after sync
      setTimeout(checkSyncStatus, 1000);

    } catch (error) {
      console.error('Error running comprehensive sync:', error);
      setSyncStatus({
        status: 'error',
        message: `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsRunningSync(false);
      setSyncProgress(null);
    }
  };

  const generateMissingEmbeddings = async () => {
    if (!user?.uid) return;

    try {
      setIsRunningEmbeddings(true);
      setSyncProgress({ current: 0, total: 100, status: 'Generating missing embeddings...' });

      const processed = await FirebaseToSupabaseEmbedder.generateMissingEmbeddings(
        user.uid,
        (progress) => setSyncProgress(progress)
      );

      setSyncStatus({
        status: 'success',
        message: `✅ Generated embeddings for ${processed} documents`,
        lastSync: new Date()
      });

      // Refresh status after embedding generation
      setTimeout(checkSyncStatus, 1000);

    } catch (error) {
      console.error('Error generating embeddings:', error);
      setSyncStatus({
        status: 'error',
        message: `Embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsRunningEmbeddings(false);
      setSyncProgress(null);
    }
  };

  const generateComprehensiveReport = async () => {
    if (!user?.uid) return;

    try {
      const report = await UserDataValidator.generateComprehensiveReport(user.uid);
      setComprehensiveReport(report);
      setShowReport(true);
    } catch (error) {
      console.error('Error generating report:', error);
      alert(`Failed to generate report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const getStatusIcon = () => {
    switch (syncStatus.status) {
      case 'loading':
        return <RefreshCw className="w-5 h-5 text-gray-500 animate-spin" />;
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
    }
  };

  const getStatusColor = () => {
    switch (syncStatus.status) {
      case 'loading':
        return 'border-gray-300 bg-gray-50';
      case 'success':
        return 'border-green-300 bg-green-50';
      case 'warning':
        return 'border-yellow-300 bg-yellow-50';
      case 'error':
        return 'border-red-300 bg-red-50';
    }
  };

  if (!user) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Login Required</h3>
          <p className="text-gray-500">Please log in to view data sync dashboard</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Data Sync Dashboard</h2>
            <p className="text-gray-500 mt-1">
              Monitor and manage Firebase to Supabase data synchronization
            </p>
          </div>
          <button
            onClick={checkSyncStatus}
            disabled={syncStatus.status === 'loading'}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncStatus.status === 'loading' ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Status Card */}
      <div className={`border rounded-lg p-6 ${getStatusColor()}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {getStatusIcon()}
            <div>
              <h3 className="font-medium text-gray-900">Sync Status</h3>
              <p className="text-sm text-gray-600">{syncStatus.message}</p>
              {syncStatus.lastSync && (
                <p className="text-xs text-gray-500 mt-1">
                  Last checked: {syncStatus.lastSync.toLocaleString()}
                </p>
              )}
            </div>
          </div>
          {syncStatus.details && (
            <div className="text-right">
              <div className="text-sm text-gray-600">
                <div>Firebase: {syncStatus.details.testResult?.firebaseData ? 
                  Object.values(syncStatus.details.testResult.firebaseData).reduce((a: any, b: any) => a + b, 0) : 0} items</div>
                <div>Supabase: {syncStatus.details.testResult?.supabaseData?.documents || 0} docs</div>
                <div>With embeddings: {syncStatus.details.testResult?.supabaseData?.withEmbeddings || 0}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {syncProgress && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-gray-900">Sync Progress</h3>
            <span className="text-sm text-gray-500">
              {syncProgress.current}/{syncProgress.total}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(syncProgress.current / syncProgress.total) * 100}%` }}
            />
          </div>
          <p className="text-sm text-gray-600">{syncProgress.status}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={runComprehensiveSync}
          disabled={isRunningSync || isRunningEmbeddings}
          className="flex items-center justify-center space-x-2 p-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <Database className="w-5 h-5" />
          <span>{isRunningSync ? 'Syncing...' : 'Run Full Sync'}</span>
        </button>

        <button
          onClick={generateMissingEmbeddings}
          disabled={isRunningSync || isRunningEmbeddings}
          className="flex items-center justify-center space-x-2 p-4 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          <Activity className="w-5 h-5" />
          <span>{isRunningEmbeddings ? 'Generating...' : 'Fix Embeddings'}</span>
        </button>

        <button
          onClick={generateComprehensiveReport}
          className="flex items-center justify-center space-x-2 p-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          <TrendingUp className="w-5 h-5" />
          <span>Full Report</span>
        </button>
      </div>

      {/* Quick Stats */}
      {syncStatus.details?.testResult && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Stats</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {syncStatus.details.testResult.firebaseData?.tasks || 0}
              </div>
              <div className="text-sm text-gray-500">Tasks</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {syncStatus.details.testResult.firebaseData?.projects || 0}
              </div>
              <div className="text-sm text-gray-500">Projects</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {syncStatus.details.testResult.firebaseData?.workSessions || 0}
              </div>
              <div className="text-sm text-gray-500">Sessions</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {syncStatus.details.testResult.supabaseData?.withEmbeddings || 0}
              </div>
              <div className="text-sm text-gray-500">With Embeddings</div>
            </div>
          </div>
        </div>
      )}

      {/* Recommendations */}
      {syncStatus.details?.testResult?.recommendations && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Recommendations</h3>
          <div className="space-y-2">
            {syncStatus.details.testResult.recommendations.map((rec: string, index: number) => (
              <div key={index} className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                <p className="text-sm text-gray-700">{rec}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comprehensive Report Modal */}
      {showReport && comprehensiveReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Comprehensive Data Report</h2>
              <button
                onClick={() => setShowReport(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Summary */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="text-sm text-gray-500">Firebase Items</div>
                    <div className="text-xl font-bold">{comprehensiveReport.summary.totalFirebaseItems}</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="text-sm text-gray-500">Supabase Docs</div>
                    <div className="text-xl font-bold">{comprehensiveReport.summary.totalSupabaseDocuments}</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="text-sm text-gray-500">Embedding Coverage</div>
                    <div className="text-xl font-bold">{comprehensiveReport.summary.embeddingCoverage}%</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="text-sm text-gray-500">Health</div>
                    <div className={`text-xl font-bold ${
                      comprehensiveReport.summary.syncHealth === 'excellent' ? 'text-green-600' :
                      comprehensiveReport.summary.syncHealth === 'good' ? 'text-blue-600' :
                      comprehensiveReport.summary.syncHealth === 'poor' ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {comprehensiveReport.summary.syncHealth}
                    </div>
                  </div>
                </div>
              </div>

              {/* Recommendations */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">Recommendations</h3>
                <div className="space-y-2">
                  {comprehensiveReport.analysis.recommendations.map((rec: string, index: number) => (
                    <div key={index} className="flex items-start space-x-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                      <p className="text-sm text-gray-700">{rec}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Technical Details */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">Technical Details</h3>
                <div className="bg-gray-50 p-4 rounded">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Average Document Size:</span>
                      <span className="ml-2 font-medium">{comprehensiveReport.technicalDetails.avgDocumentSize} chars</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Duplicate Risk:</span>
                      <span className="ml-2 font-medium">{comprehensiveReport.technicalDetails.duplicateRisk}</span>
                    </div>
                    {comprehensiveReport.technicalDetails.oldestDocument && (
                      <div>
                        <span className="text-gray-500">Oldest Document:</span>
                        <span className="ml-2 font-medium">
                          {new Date(comprehensiveReport.technicalDetails.oldestDocument).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    {comprehensiveReport.technicalDetails.newestDocument && (
                      <div>
                        <span className="text-gray-500">Newest Document:</span>
                        <span className="ml-2 font-medium">
                          {new Date(comprehensiveReport.technicalDetails.newestDocument).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
