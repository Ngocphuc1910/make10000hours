import React from 'react';
import { Calendar, Loader2, AlertCircle, CheckCircle, Clock, Settings } from 'lucide-react';
import { useSyncStore } from '../../store/syncStore';
import { Link } from 'react-router-dom';

interface SyncStatusPanelProps {
  className?: string;
}

const SyncStatusPanel: React.FC<SyncStatusPanelProps> = ({ className = '' }) => {
  const { 
    syncEnabled, 
    syncInProgress, 
    lastSyncTime, 
    syncError, 
    pendingTasks, 
    errorTasks,
    performManualSync,
    clearSyncError
  } = useSyncStore();

  const formatLastSync = (date: Date | null) => {
    if (!date) return 'Never';
    
    try {
      // Handle Firebase Timestamp or Date objects
      const syncDate = date instanceof Date ? date : 
                      (date && typeof date === 'object' && 'toDate' in date) ? (date as any).toDate() : 
                      new Date(date);
      
      const now = new Date();
      const diff = now.getTime() - syncDate.getTime();
      const minutes = Math.floor(diff / (1000 * 60));
      
      if (minutes < 1) return 'Just now';
      if (minutes < 60) return `${minutes}m ago`;
      
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h ago`;
      
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    } catch (error) {
      console.error('Error formatting sync date:', error);
      return 'Unknown';
    }
  };

  const handleManualSync = async () => {
    try {
      await performManualSync();
    } catch (error) {
      console.error('Manual sync failed:', error);
    }
  };

  if (!syncEnabled) {
    return (
      <div className={`flex items-center gap-2 text-sm text-gray-500 ${className}`}>
        <Calendar className="w-4 h-4" />
        <span>Sync disabled</span>
        <Link 
          to="/settings"
          className="text-blue-600 hover:text-blue-800 underline"
        >
          Enable
        </Link>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 text-sm ${className}`}>
      {/* Sync Status Icon */}
      <div className="flex items-center gap-1">
        {syncInProgress ? (
          <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
        ) : syncError ? (
          <AlertCircle className="w-4 h-4 text-red-500" />
        ) : (
          <CheckCircle className="w-4 h-4 text-green-500" />
        )}
        
        <span className={`font-medium ${
          syncError ? 'text-red-600' : 
          syncInProgress ? 'text-blue-600' : 
          'text-green-600'
        }`}>
          {syncInProgress ? 'Syncing...' : 
           syncError ? 'Sync Error' : 
           'Synced'}
        </span>
      </div>

      {/* Last Sync Time */}
      <div className="flex items-center gap-1 text-gray-600">
        <Clock className="w-3 h-3" />
        <span>{formatLastSync(lastSyncTime)}</span>
      </div>

      {/* Pending/Error Tasks */}
      {(pendingTasks.size > 0 || errorTasks.size > 0) && (
        <div className="flex items-center gap-2 text-xs">
          {pendingTasks.size > 0 && (
            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
              {pendingTasks.size} pending
            </span>
          )}
          {errorTasks.size > 0 && (
            <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full">
              {errorTasks.size} errors
            </span>
          )}
        </div>
      )}

      {/* Manual Sync Button */}
      <button
        onClick={handleManualSync}
        disabled={syncInProgress}
        className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
        title="Sync now"
      >
        <Calendar className="w-3 h-3" />
        <span>Sync</span>
      </button>

      {/* Error Details */}
      {syncError && (
        <div className="relative">
          <div className="absolute top-full left-0 mt-1 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 shadow-lg z-10 whitespace-nowrap">
            <p className="font-medium">Sync Error:</p>
            <p>{syncError}</p>
            <button
              onClick={clearSyncError}
              className="mt-1 text-red-600 hover:text-red-800 underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Settings Link */}
      <Link
        to="/settings"
        className="text-gray-400 hover:text-gray-600"
        title="Sync settings"
      >
        <Settings className="w-4 h-4" />
      </Link>
    </div>
  );
};

export default SyncStatusPanel;