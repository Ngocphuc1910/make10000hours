import React, { useState, useEffect } from 'react';
import { Calendar, Settings, AlertCircle, CheckCircle, Clock, Loader2 } from 'lucide-react';
import { useUserStore } from '../../store/userStore';
import { createSyncManager } from '../../services/sync/syncManager';
import useGoogleCalendarAuth from '../../hooks/useGoogleCalendarAuth';
import GoogleCalendarDemo from '../sync/GoogleCalendarDemo';

interface SyncStatus {
  isEnabled: boolean;
  lastSync: Date;
  pendingTasks: number;
  errorTasks: number;
}

interface WebhookStatus {
  isActive: boolean;
  channelId?: string;
  expirationTime?: Date;
  timeUntilExpiration?: string;
}

const GoogleCalendarSync: React.FC = () => {
  const { user } = useUserStore();
  const { hasCalendarAccess, isCheckingAccess, error: authError, requestCalendarAccess } = useGoogleCalendarAuth();
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [webhookStatus, setWebhookStatus] = useState<WebhookStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user && hasCalendarAccess) {
      loadSyncStatus();
    }
  }, [user, hasCalendarAccess]);

  const loadSyncStatus = async () => {
    if (!user) return;

    try {
      const syncManager = createSyncManager(user.uid);
      const [status, webhookStat] = await Promise.all([
        syncManager.getSyncStatus(),
        syncManager.getWebhookStatus()
      ]);
      setSyncStatus(status);
      setWebhookStatus(webhookStat);
    } catch (err) {
      console.error('Error loading sync status:', err);
      setError(err instanceof Error ? err.message : 'Failed to load sync status');
    }
  };

  const handleEnableSync = async () => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      if (!hasCalendarAccess) {
        await requestCalendarAccess();
      }

      const syncManager = createSyncManager(user.uid);
      await syncManager.initializeSync();
      await syncManager.toggleSync(true);
      
      // Try to set up webhook for real-time sync
      try {
        await syncManager.setupWebhook();
        console.log('✅ Webhook setup successful');
      } catch (webhookError) {
        console.warn('⚠️ Webhook setup failed, falling back to polling:', webhookError);
        // Don't throw error - sync will work with polling
      }
      
      await loadSyncStatus();
      console.log('✅ Google Calendar sync enabled');
    } catch (err) {
      console.error('Error enabling sync:', err);
      setError(err instanceof Error ? err.message : 'Failed to enable sync');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisableSync = async () => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      const syncManager = createSyncManager(user.uid);
      
      // Stop webhook if active
      try {
        await syncManager.stopWebhook();
        console.log('✅ Webhook stopped');
      } catch (webhookError) {
        console.warn('⚠️ Error stopping webhook:', webhookError);
        // Don't throw error - continue with disable
      }
      
      await syncManager.toggleSync(false);
      
      await loadSyncStatus();
      console.log('✅ Google Calendar sync disabled');
    } catch (err) {
      console.error('Error disabling sync:', err);
      setError(err instanceof Error ? err.message : 'Failed to disable sync');
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualSync = async () => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      const syncManager = createSyncManager(user.uid);
      await syncManager.performFullSync();
      
      await loadSyncStatus();
      console.log('✅ Manual sync completed');
    } catch (err) {
      console.error('Error performing manual sync:', err);
      setError(err instanceof Error ? err.message : 'Manual sync failed');
    } finally {
      setIsLoading(false);
    }
  };

  const formatLastSync = (date: Date) => {
    try {
      // Handle Firebase Timestamp or Date objects
      const syncDate = date instanceof Date ? date : 
                      (date && typeof date === 'object' && 'toDate' in date) ? (date as any).toDate() : 
                      new Date(date);
      
      if (syncDate.getTime() === 0) return 'Never';
      
      const now = new Date();
      const diff = now.getTime() - syncDate.getTime();
      const minutes = Math.floor(diff / (1000 * 60));
      
      if (minutes < 1) return 'Just now';
      if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
      
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
      
      const days = Math.floor(hours / 24);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } catch (error) {
      console.error('Error formatting sync date:', error);
      return 'Unknown';
    }
  };

  if (isCheckingAccess) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-sm border">
        <div className="flex items-center gap-3 mb-4">
          <Calendar className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold">Google Calendar Sync</h3>
        </div>
        <div className="flex items-center gap-2 text-gray-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Checking calendar access...</span>
        </div>
      </div>
    );
  }

  if (!hasCalendarAccess) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-sm border">
        <div className="flex items-center gap-3 mb-4">
          <Calendar className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold">Google Calendar Sync</h3>
        </div>
        
        <div className="mb-4">
          <p className="text-gray-600 mb-2">
            Sync your tasks with Google Calendar to keep everything in sync across all your devices.
          </p>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-center gap-2 text-yellow-800">
              <AlertCircle className="w-4 h-4" />
              <span className="font-medium">Calendar access required</span>
            </div>
            <p className="text-sm text-yellow-700 mt-1">
              To enable sync, you'll need to grant access to your Google Calendar.
            </p>
          </div>
        </div>

        {authError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-800">
              <AlertCircle className="w-4 h-4" />
              <span className="font-medium">Error</span>
            </div>
            <p className="text-sm text-red-700 mt-1">{authError}</p>
          </div>
        )}

        <button
          onClick={requestCalendarAccess}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Requesting Access...</span>
            </>
          ) : (
            <>
              <Settings className="w-4 h-4" />
              <span>Grant Calendar Access</span>
            </>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm border">
      <div className="flex items-center gap-3 mb-4">
        <Calendar className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-semibold">Google Calendar Sync</h3>
      </div>

      {/* Sync Status */}
      {syncStatus && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            {syncStatus.isEnabled ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <AlertCircle className="w-5 h-5 text-gray-400" />
            )}
            <span className="font-medium">
              {syncStatus.isEnabled ? 'Sync Enabled' : 'Sync Disabled'}
            </span>
          </div>
          
          {syncStatus.isEnabled && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="flex items-center gap-2 text-gray-600 mb-1">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">Last Sync</span>
                </div>
                <p className="font-medium">{formatLastSync(syncStatus.lastSync)}</p>
              </div>
              
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="flex items-center gap-2 text-gray-600 mb-1">
                  <Loader2 className="w-4 h-4" />
                  <span className="text-sm">Pending</span>
                </div>
                <p className="font-medium">{syncStatus.pendingTasks} tasks</p>
              </div>
              
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="flex items-center gap-2 text-gray-600 mb-1">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">Errors</span>
                </div>
                <p className="font-medium text-red-600">{syncStatus.errorTasks} tasks</p>
              </div>
            </div>
          )}

          {/* Webhook Status */}
          {syncStatus.isEnabled && webhookStatus && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-2 h-2 rounded-full ${webhookStatus.isActive ? 'bg-green-500' : 'bg-orange-500'}`}></div>
                <span className="font-medium text-blue-900">
                  Real-time Sync: {webhookStatus.isActive ? 'Active' : 'Polling Mode'}
                </span>
              </div>
              
              {webhookStatus.isActive ? (
                <div className="text-sm text-blue-700">
                  <p>✅ Receiving real-time notifications from Google Calendar</p>
                  {webhookStatus.timeUntilExpiration && (
                    <p className="mt-1">🔄 Auto-renewal in {webhookStatus.timeUntilExpiration}</p>
                  )}
                </div>
              ) : (
                <div className="text-sm text-orange-700">
                  <p>📊 Using polling mode - changes may take up to 5 minutes to sync</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 text-red-800">
            <AlertCircle className="w-4 h-4" />
            <span className="font-medium">Error</span>
          </div>
          <p className="text-sm text-red-700 mt-1">{error}</p>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap gap-3">
        {syncStatus?.isEnabled ? (
          <>
            <button
              onClick={handleDisableSync}
              disabled={isLoading}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Settings className="w-4 h-4" />
              )}
              <span>Disable Sync</span>
            </button>
            
            <button
              onClick={handleManualSync}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Calendar className="w-4 h-4" />
              )}
              <span>Sync Now</span>
            </button>
          </>
        ) : (
          <button
            onClick={handleEnableSync}
            disabled={isLoading}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Settings className="w-4 h-4" />
            )}
            <span>Enable Sync</span>
          </button>
        )}
      </div>

      {/* Demo Mode Notice */}
      <GoogleCalendarDemo />

      {/* Help Text */}
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-700">
          <strong>How it works:</strong> When you schedule a task in Make10000hours, it will automatically appear in your Google Calendar. 
          Changes made in either app will sync to the other.
        </p>
      </div>
    </div>
  );
};

export default GoogleCalendarSync;