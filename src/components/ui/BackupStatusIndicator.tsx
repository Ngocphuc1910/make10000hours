import React, { useState, useEffect } from 'react';
import { useDeepFocusStore } from '../../store/deepFocusStore';

const BackupStatusIndicator: React.FC = () => {
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const { getSyncStatus, retryBackup } = useDeepFocusStore();

  useEffect(() => {
    const updateStatus = () => {
      setSyncStatus(getSyncStatus());
    };

    updateStatus();
    const interval = setInterval(updateStatus, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [getSyncStatus]);

  if (!syncStatus) return null;

  const getStatusIcon = () => {
    if (syncStatus.isBackingUp) return '⏳';
    if (syncStatus.backupError) return '❌';
    if (syncStatus.lastBackupTime) return '✅';
    return '🔄';
  };

  const getStatusText = () => {
    if (syncStatus.isBackingUp) return 'Syncing...';
    if (syncStatus.backupError) return `Error: ${syncStatus.backupError}`;
    if (syncStatus.lastBackupTime) {
      const time = new Date(syncStatus.lastBackupTime).toLocaleTimeString();
      return `Last sync: ${time}`;
    }
    return 'No sync yet';
  };

  const handleRetry = () => {
    retryBackup();
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-lg">{getStatusIcon()}</span>
      <span className="text-gray-600 dark:text-gray-400">{getStatusText()}</span>
      
      {syncStatus.canRetry && syncStatus.backupError && (
        <button
          onClick={handleRetry}
          className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          Retry
        </button>
      )}
      
      {syncStatus.circuitBreaker?.state === 'OPEN' && (
        <span className="text-xs text-orange-500">
          Cooling down... ({Math.ceil(syncStatus.circuitBreaker.timeUntilRetry / 1000)}s)
        </span>
      )}
    </div>
  );
};

export default BackupStatusIndicator; 