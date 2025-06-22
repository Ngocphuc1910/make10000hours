import React, { useState, useEffect } from 'react';
import { useDeepFocusStore } from '../../store/deepFocusStore';

interface BackupStatusIndicatorProps {
  isBackingUp?: boolean;
  lastBackupTime?: Date | null;
  backupError?: string | null;
  onRetryBackup?: () => void;
}

const BackupStatusIndicator: React.FC<BackupStatusIndicatorProps> = ({ 
  isBackingUp, 
  lastBackupTime, 
  backupError, 
  onRetryBackup 
}) => {
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const { getSyncStatus, retryBackup } = useDeepFocusStore();

  // Use props if provided, otherwise fall back to store
  const currentIsBackingUp = isBackingUp !== undefined ? isBackingUp : syncStatus?.isBackingUp;
  const currentLastBackupTime = lastBackupTime !== undefined ? lastBackupTime : syncStatus?.lastBackupTime;
  const currentBackupError = backupError !== undefined ? backupError : syncStatus?.backupError;

  useEffect(() => {
    // Only use store if props aren't provided
    if (isBackingUp === undefined && lastBackupTime === undefined && backupError === undefined) {
      const updateStatus = () => {
        setSyncStatus(getSyncStatus());
      };

      updateStatus();
      const interval = setInterval(updateStatus, 5000); // Update every 5 seconds

      return () => clearInterval(interval);
    }
  }, [getSyncStatus, isBackingUp, lastBackupTime, backupError]);

  const getStatusIcon = () => {
    if (currentIsBackingUp) return '⏳';
    if (currentBackupError) return '❌';
    if (currentLastBackupTime) return '✅';
    return '🔄';
  };

  const getStatusText = () => {
    if (currentIsBackingUp) return 'Syncing...';
    if (currentBackupError) return `Error: ${currentBackupError}`;
    if (currentLastBackupTime) {
      const time = new Date(currentLastBackupTime).toLocaleTimeString();
      return `Last sync: ${time}`;
    }
    return 'No sync yet';
  };

  const handleRetry = () => {
    if (onRetryBackup) {
      onRetryBackup();
    } else {
      retryBackup();
    }
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-lg">{getStatusIcon()}</span>
      <span className="text-gray-600 dark:text-gray-400">{getStatusText()}</span>
      
      {currentBackupError && (
        <button
          onClick={handleRetry}
          className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          Retry
        </button>
      )}
      
      {syncStatus?.circuitBreaker?.state === 'OPEN' && (
        <span className="text-xs text-orange-500">
          Cooling down... ({Math.ceil(syncStatus.circuitBreaker.timeUntilRetry / 1000)}s)
        </span>
      )}
    </div>
  );
};

export default BackupStatusIndicator; 