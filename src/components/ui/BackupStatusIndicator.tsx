import React from 'react';
import { Icon } from './Icon';

interface BackupStatusIndicatorProps {
  isBackingUp: boolean;
  lastBackupTime: Date | null;
  backupError: string | null;
  onRetryBackup?: () => void;
}

const BackupStatusIndicator: React.FC<BackupStatusIndicatorProps> = ({
  isBackingUp,
  lastBackupTime,
  backupError,
  onRetryBackup
}) => {
  const formatLastBackup = (date: Date | null): string => {
    if (!date) return 'Never';
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const getStatusIcon = () => {
    if (isBackingUp) {
      return (
        <div className="animate-spin">
          <Icon name="refresh-line" className="w-4 h-4 text-blue-500 animate-spin" />
        </div>
      );
    }
    
    if (backupError) {
      return <Icon name="error-warning-line" className="w-4 h-4 text-red-500" />;
    }
    
    if (lastBackupTime) {
      return <Icon name="check-line" className="w-4 h-4 text-green-500" />;
    }
    
    return <Icon name="time-line" className="w-4 h-4 text-gray-400" />;
  };

  const getStatusText = () => {
    if (isBackingUp) return 'Backing up...';
    if (backupError) return 'Backup failed';
    if (lastBackupTime) return 'Backed up';
    return 'Not backed up';
  };

  const getStatusColor = () => {
    if (isBackingUp) return 'text-blue-600';
    if (backupError) return 'text-red-600';
    if (lastBackupTime) return 'text-green-600';
    return 'text-gray-500';
  };

  return (
    <div className="flex items-center space-x-2 text-xs">
      {getStatusIcon()}
      <div className="flex flex-col">
        <span className={`font-medium ${getStatusColor()}`}>
          {getStatusText()}
        </span>
        <span className="text-gray-400">
          {formatLastBackup(lastBackupTime)}
        </span>
      </div>
      
      {backupError && onRetryBackup && (
        <button
          onClick={onRetryBackup}
          className="text-blue-500 hover:text-blue-600 transition-colors duration-200 ml-2"
          title="Retry backup"
        >
          <Icon name="refresh-line" className="w-3 h-3" />
        </button>
      )}
      
      {backupError && (
        <div className="ml-2 text-xs text-red-500 max-w-xs truncate" title={backupError}>
          {backupError}
        </div>
      )}
    </div>
  );
};

export default BackupStatusIndicator; 