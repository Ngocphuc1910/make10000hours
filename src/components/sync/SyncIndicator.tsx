import React from 'react';
import { Calendar, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { Task } from '../../types/models';

interface SyncIndicatorProps {
  task: Task;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

const SyncIndicator: React.FC<SyncIndicatorProps> = ({
  task,
  size = 'sm',
  showText = false,
  className = ''
}) => {
  // Only show sync indicator for scheduled tasks
  if (!task.scheduledDate) {
    return null;
  }

  const getSyncIcon = () => {
    const iconSize = size === 'sm' ? 'w-3 h-3' : size === 'md' ? 'w-4 h-4' : 'w-5 h-5';
    
    switch (task.syncStatus) {
      case 'pending':
        return <Loader2 className={`${iconSize} animate-spin text-blue-500`} />;
      case 'synced':
        return <CheckCircle className={`${iconSize} text-green-500`} />;
      case 'error':
        return <AlertCircle className={`${iconSize} text-red-500`} />;
      case 'disabled':
        return <Calendar className={`${iconSize} text-gray-400`} />;
      default:
        return <Calendar className={`${iconSize} text-gray-400`} />;
    }
  };

  const getSyncText = () => {
    switch (task.syncStatus) {
      case 'pending':
        return 'Syncing...';
      case 'synced':
        return 'Synced';
      case 'error':
        return 'Sync failed';
      case 'disabled':
        return 'Not synced';
      default:
        return 'Not synced';
    }
  };

  const getSyncTitle = () => {
    switch (task.syncStatus) {
      case 'pending':
        return 'Syncing to Google Calendar...';
      case 'synced':
        return `Synced to Google Calendar${task.lastSyncedAt ? ` at ${task.lastSyncedAt.toLocaleString()}` : ''}`;
      case 'error':
        return `Sync failed: ${task.syncError || 'Unknown error'}`;
      case 'disabled':
        return 'Google Calendar sync is disabled';
      default:
        return 'Not synced to Google Calendar';
    }
  };

  return (
    <div 
      className={`flex items-center gap-1 ${className}`}
      title={getSyncTitle()}
    >
      {getSyncIcon()}
      {showText && (
        <span className={`text-xs ${
          task.syncStatus === 'error' ? 'text-red-600' : 
          task.syncStatus === 'synced' ? 'text-green-600' : 
          task.syncStatus === 'pending' ? 'text-blue-600' : 
          'text-gray-500'
        }`}>
          {getSyncText()}
        </span>
      )}
    </div>
  );
};

export default SyncIndicator;