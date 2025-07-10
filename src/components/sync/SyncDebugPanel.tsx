import React, { useState } from 'react';
import { Calendar, Play, Pause, AlertCircle, CheckCircle, Loader2, Settings, FileText } from 'lucide-react';
import { useSyncStore } from '../../store/syncStore';
import { useUserStore } from '../../store/userStore';
import { useTaskStore } from '../../store/taskStore';
import { createSyncManager } from '../../services/sync/syncManager';

const SyncDebugPanel: React.FC = () => {
  const { user } = useUserStore();
  const { tasks, projects } = useTaskStore();
  const { 
    syncEnabled, 
    syncInProgress, 
    syncError, 
    pendingTasks, 
    errorTasks,
    enableSync,
    disableSync,
    performManualSync,
    initializeSync,
    clearSyncError
  } = useSyncStore();
  
  const [isVisible, setIsVisible] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [isTestingSync, setIsTestingSync] = useState(false);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const handleTestSync = async () => {
    if (!user) {
      addLog('❌ No user authenticated');
      return;
    }

    setIsTestingSync(true);
    addLog('🔄 Starting sync test...');

    try {
      // Initialize sync
      await initializeSync();
      addLog('✅ Sync initialized');

      // Enable sync
      await enableSync();
      addLog('✅ Sync enabled');

      // Find a scheduled task to test with
      const scheduledTask = tasks.find(t => t.scheduledDate);
      if (scheduledTask) {
        addLog(`📅 Found scheduled task: ${scheduledTask.title}`);
        
        const project = projects.find(p => p.id === scheduledTask.projectId);
        if (project) {
          addLog(`📁 Task project: ${project.name}`);
          
          // Test sync
          const syncManager = createSyncManager(user.uid);
          await syncManager.syncTaskToGoogle(scheduledTask, project);
          addLog('✅ Task synced to Google Calendar (simulated)');
        } else {
          addLog('❌ Project not found for task');
        }
      } else {
        addLog('ℹ️ No scheduled tasks found to test with');
      }

      // Test manual sync
      await performManualSync();
      addLog('✅ Manual sync completed');

      addLog('🎉 Sync test completed successfully!');
    } catch (error) {
      addLog(`❌ Sync test failed: ${error.message}`);
    } finally {
      setIsTestingSync(false);
    }
  };

  const handleClearLogs = () => {
    setLogs([]);
  };

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsVisible(true)}
          className="bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
          title="Open Sync Debug Panel"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white border border-gray-300 rounded-lg shadow-xl w-96 max-h-96 overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-600" />
          <h3 className="font-semibold text-sm">Sync Debug Panel</h3>
        </div>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-500 hover:text-gray-700"
        >
          ×
        </button>
      </div>

      <div className="p-3 space-y-3">
        {/* Sync Status */}
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">Status:</span>
          {syncInProgress ? (
            <span className="flex items-center gap-1 text-blue-600">
              <Loader2 className="w-3 h-3 animate-spin" />
              Syncing...
            </span>
          ) : syncEnabled ? (
            <span className="flex items-center gap-1 text-green-600">
              <CheckCircle className="w-3 h-3" />
              Enabled
            </span>
          ) : (
            <span className="flex items-center gap-1 text-gray-600">
              <Pause className="w-3 h-3" />
              Disabled
            </span>
          )}
        </div>

        {/* Task Counts */}
        <div className="text-sm">
          <span className="font-medium">Tasks:</span>
          <span className="ml-2">
            {tasks.filter(t => t.scheduledDate).length} scheduled,
            {' '}{pendingTasks.size} pending,
            {' '}{errorTasks.size} errors
          </span>
        </div>

        {/* Error Display */}
        {syncError && (
          <div className="bg-red-50 border border-red-200 rounded p-2 text-sm">
            <div className="flex items-center gap-1 text-red-600">
              <AlertCircle className="w-3 h-3" />
              <span className="font-medium">Error:</span>
            </div>
            <p className="text-red-700 mt-1">{syncError}</p>
            <button
              onClick={clearSyncError}
              className="mt-1 text-red-600 hover:text-red-800 underline text-xs"
            >
              Clear
            </button>
          </div>
        )}

        {/* Controls */}
        <div className="flex gap-2">
          <button
            onClick={handleTestSync}
            disabled={isTestingSync || !user}
            className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          >
            {isTestingSync ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <Play className="w-3 h-3" />
                Test Sync
              </>
            )}
          </button>
          
          <button
            onClick={handleClearLogs}
            className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200 flex items-center gap-1"
          >
            <FileText className="w-3 h-3" />
            Clear Logs
          </button>
        </div>

        {/* Logs */}
        <div className="bg-gray-50 rounded border max-h-32 overflow-y-auto">
          <div className="p-2 text-xs font-mono">
            {logs.length === 0 ? (
              <p className="text-gray-500">No logs yet...</p>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="mb-1">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SyncDebugPanel;