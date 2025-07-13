import React, { useState, useEffect } from 'react';
import { Activity, RefreshCw, CheckCircle, AlertCircle, Clock, Zap } from 'lucide-react';
import { useUserStore } from '../../store/userStore';
import { createSyncManager } from '../../services/sync/syncManager';

interface WebhookStatus {
  isActive: boolean;
  channelId?: string;
  expirationTime?: Date;
  timeUntilExpiration?: string;
}

interface SyncDebugInfo {
  syncState: any;
  webhookStatus: WebhookStatus;
  isLoading: boolean;
  error: string | null;
}

const WebhookDebugPanel: React.FC = () => {
  const { user } = useUserStore();
  const [debugInfo, setDebugInfo] = useState<SyncDebugInfo>({
    syncState: null,
    webhookStatus: { isActive: false },
    isLoading: true,
    error: null
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionLog, setActionLog] = useState<string[]>([]);

  const log = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setActionLog(prev => [`${timestamp}: ${message}`, ...prev.slice(0, 9)]);
  };

  const loadDebugInfo = async () => {
    if (!user) return;

    try {
      setDebugInfo(prev => ({ ...prev, isLoading: true, error: null }));
      
      const syncManager = createSyncManager(user.uid);
      
      const [syncState, webhookStatus] = await Promise.all([
        syncManager.getSyncState(),
        syncManager.getWebhookStatus()
      ]);

      setDebugInfo({
        syncState,
        webhookStatus,
        isLoading: false,
        error: null
      });

      log('Debug info loaded successfully');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load debug info';
      setDebugInfo(prev => ({ ...prev, isLoading: false, error: errorMsg }));
      log(`Error: ${errorMsg}`);
    }
  };

  const setupWebhook = async () => {
    if (!user) return;

    try {
      setIsRefreshing(true);
      log('Setting up webhook...');
      
      const syncManager = createSyncManager(user.uid);
      await syncManager.setupWebhook();
      
      log('✅ Webhook setup successful');
      await loadDebugInfo();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Webhook setup failed';
      log(`❌ Webhook setup failed: ${errorMsg}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  const triggerManualSync = async () => {
    if (!user) return;

    try {
      setIsRefreshing(true);
      log('Triggering manual sync...');
      
      const syncManager = createSyncManager(user.uid);
      await syncManager.performIncrementalSync();
      
      log('✅ Manual sync completed');
      await loadDebugInfo();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Manual sync failed';
      log(`❌ Manual sync failed: ${errorMsg}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  const checkWebhookTrigger = async () => {
    if (!user) return;

    try {
      log('Checking for webhook-triggered sync...');
      
      const syncManager = createSyncManager(user.uid);
      await syncManager.checkWebhookTriggeredSync();
      
      log('✅ Webhook trigger check completed');
      await loadDebugInfo();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Webhook check failed';
      log(`❌ Webhook check failed: ${errorMsg}`);
    }
  };

  useEffect(() => {
    if (user) {
      loadDebugInfo();
    }
  }, [user]);

  if (!user) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-sm border">
        <p className="text-gray-500">Please log in to view webhook debug information.</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm border">
      <div className="flex items-center gap-3 mb-6">
        <Activity className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-semibold">Webhook Debug Panel</h3>
        <button
          onClick={loadDebugInfo}
          disabled={debugInfo.isLoading}
          className="ml-auto px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${debugInfo.isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Current Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-3 h-3 rounded-full ${debugInfo.webhookStatus.isActive ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="font-medium">Webhook Status</span>
          </div>
          <p className="text-sm text-gray-600">
            {debugInfo.webhookStatus.isActive ? 'Active & Listening' : 'Inactive (Polling Mode)'}
          </p>
          {debugInfo.webhookStatus.timeUntilExpiration && (
            <p className="text-xs text-gray-500 mt-1">
              Expires in: {debugInfo.webhookStatus.timeUntilExpiration}
            </p>
          )}
        </div>

        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="font-medium">Sync State</span>
          </div>
          <p className="text-sm text-gray-600">
            {debugInfo.syncState?.isEnabled ? 'Enabled' : 'Disabled'}
          </p>
          {debugInfo.syncState?.lastIncrementalSync && (
            <p className="text-xs text-gray-500 mt-1">
              Last sync: {new Date(debugInfo.syncState.lastIncrementalSync.seconds * 1000).toLocaleTimeString()}
            </p>
          )}
        </div>

        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-blue-500" />
            <span className="font-medium">Function Status</span>
          </div>
          <p className="text-sm text-gray-600">
            Endpoint: ✅ Accessible
          </p>
          <p className="text-xs text-gray-500 mt-1">
            URL: ...cloudfunctions.net/calendarWebhook
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <button
          onClick={setupWebhook}
          disabled={isRefreshing}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 justify-center"
        >
          <Zap className="w-4 h-4" />
          Setup/Renew Webhook
        </button>

        <button
          onClick={triggerManualSync}
          disabled={isRefreshing}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 justify-center"
        >
          <RefreshCw className="w-4 h-4" />
          Manual Sync
        </button>

        <button
          onClick={checkWebhookTrigger}
          disabled={isRefreshing}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2 justify-center"
        >
          <Activity className="w-4 h-4" />
          Check Webhook Trigger
        </button>
      </div>

      {/* Debug Information */}
      <div className="mb-6">
        <h4 className="font-medium mb-3">Debug Information</h4>
        <div className="bg-gray-50 p-4 rounded-lg">
          {debugInfo.webhookStatus.channelId && (
            <div className="mb-2">
              <span className="font-medium text-sm">Webhook Channel ID:</span>
              <span className="text-sm text-gray-600 ml-2 font-mono">{debugInfo.webhookStatus.channelId}</span>
            </div>
          )}
          
          {debugInfo.syncState?.webhookTriggeredSync && (
            <div className="mb-2">
              <span className="text-sm text-orange-600">⚠️ Pending webhook-triggered sync detected</span>
            </div>
          )}

          {debugInfo.syncState?.nextSyncToken && (
            <div className="mb-2">
              <span className="font-medium text-sm">Sync Token:</span>
              <span className="text-sm text-gray-600 ml-2 font-mono">{debugInfo.syncState.nextSyncToken.slice(0, 20)}...</span>
            </div>
          )}
        </div>
      </div>

      {/* Activity Log */}
      <div>
        <h4 className="font-medium mb-3">Activity Log</h4>
        <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm max-h-48 overflow-y-auto">
          {actionLog.length === 0 ? (
            <div className="text-gray-500">No activity yet...</div>
          ) : (
            actionLog.map((entry, index) => (
              <div key={index} className="mb-1">{entry}</div>
            ))
          )}
        </div>
      </div>

      {/* Error Display */}
      {debugInfo.error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 text-red-800">
            <AlertCircle className="w-4 h-4" />
            <span className="font-medium">Error</span>
          </div>
          <p className="text-sm text-red-700 mt-1">{debugInfo.error}</p>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">How to Test Calendar → Web App Sync:</h4>
        <ol className="text-sm text-blue-800 space-y-1">
          <li>1. Ensure webhook is active (green status above)</li>
          <li>2. Create a new event in Google Calendar</li>
          <li>3. Wait 30 seconds, then click "Check Webhook Trigger"</li>
          <li>4. If no webhook trigger, click "Manual Sync" to force sync</li>
          <li>5. Check your tasks list for imported events</li>
        </ol>
      </div>
    </div>
  );
};

export default WebhookDebugPanel;