import { create } from 'zustand';
import { createSyncManager } from '../services/sync/syncManager';
import { useUserStore } from './userStore';
import { useTaskStore } from './taskStore';
import { Task, Project } from '../types/models';
import { db } from '../api/firebase';
import { doc, onSnapshot, collection, query, where } from 'firebase/firestore';

interface SyncState {
  syncEnabled: boolean;
  syncInProgress: boolean;
  lastSyncTime: Date | null;
  syncError: string | null;
  pendingTasks: Set<string>;
  errorTasks: Set<string>;
  webhookMonitoringInterval: NodeJS.Timeout | null;
  syncStateListener: (() => void) | null;
  
  // Actions
  initializeSync: () => Promise<void>;
  enableSync: () => Promise<void>;
  disableSync: () => Promise<void>;
  syncTask: (taskId: string) => Promise<void>;
  syncTaskDeletion: (taskId: string) => Promise<void>;
  performManualSync: () => Promise<void>;
  clearSyncError: () => void;
  getSyncManager: () => any;
  // Webhook lifecycle actions
  setupWebhook: () => Promise<void>;
  checkWebhookStatus: () => Promise<any>;
  startWebhookMonitoring: () => void;
  stopWebhookMonitoring: () => void;
  // Real-time listener actions
  startSyncStateListener: () => void;
  stopSyncStateListener: () => void;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  syncEnabled: false,
  syncInProgress: false,
  lastSyncTime: null,
  syncError: null,
  pendingTasks: new Set(),
  errorTasks: new Set(),
  webhookMonitoringInterval: null,
  syncStateListener: null,

  getSyncManager: () => {
    const { user } = useUserStore.getState();
    if (!user) return null;
    return createSyncManager(user.uid);
  },

  initializeSync: async () => {
    try {
      const syncManager = get().getSyncManager();
      if (!syncManager) return;

      await syncManager.initializeSync();
      const status = await syncManager.getSyncStatus();
      
      set({
        syncEnabled: status.isEnabled,
        lastSyncTime: status.lastSync,
        pendingTasks: new Set(),
        errorTasks: new Set(),
      });
    } catch (error) {
      console.error('Error initializing sync:', error);
      set({ syncError: error.message });
    }
  },

  enableSync: async () => {
    try {
      set({ syncInProgress: true, syncError: null });
      
      const syncManager = get().getSyncManager();
      if (!syncManager) throw new Error('Sync manager not available');

      await syncManager.toggleSync(true);
      
      set({ 
        syncEnabled: true, 
        syncInProgress: false,
        lastSyncTime: new Date(),
      });
    } catch (error) {
      console.error('Error enabling sync:', error);
      set({ 
        syncError: error.message,
        syncInProgress: false,
      });
      throw error;
    }
  },

  disableSync: async () => {
    try {
      set({ syncInProgress: true, syncError: null });
      
      const syncManager = get().getSyncManager();
      if (!syncManager) throw new Error('Sync manager not available');

      await syncManager.toggleSync(false);
      
      set({ 
        syncEnabled: false,
        syncInProgress: false,
        pendingTasks: new Set(),
        errorTasks: new Set(),
      });
    } catch (error) {
      console.error('Error disabling sync:', error);
      set({ 
        syncError: error.message,
        syncInProgress: false,
      });
      throw error;
    }
  },

  syncTask: async (taskId: string) => {
    const { syncEnabled, pendingTasks, errorTasks } = get();
    if (!syncEnabled) {
      console.log('🔄 Sync not enabled, skipping task sync');
      return;
    }

    try {
      // Validate user first
      const { user } = useUserStore.getState();
      if (!user) {
        throw new Error('Firebase user undefined - user not authenticated');
      }

      console.log(`🔄 Syncing task ${taskId} for user ${user.uid}`);

      // Mark task as pending
      const newPendingTasks = new Set(pendingTasks);
      newPendingTasks.add(taskId);
      
      const newErrorTasks = new Set(errorTasks);
      newErrorTasks.delete(taskId);
      
      set({ 
        pendingTasks: newPendingTasks,
        errorTasks: newErrorTasks,
      });

      const syncManager = get().getSyncManager();
      if (!syncManager) {
        throw new Error('Sync manager not available - user may not be authenticated');
      }

      // Get task and project data
      const { tasks, projects } = useTaskStore.getState();
      const task = tasks.find(t => t.id === taskId);
      
      if (!task) {
        throw new Error(`Task with ID ${taskId} not found`);
      }

      // Find project, default to "No Project" if not found
      let project = task.projectId ? projects.find(p => p.id === task.projectId) : null;
      if (!project) {
        project = { id: 'no-project', name: 'No Project', userId: user.uid } as Project;
      }

      console.log(`📋 Task found: ${task.title}, Project: ${project.name}, Scheduled: ${task.scheduledDate}`);

      // Only sync if task has a scheduled date
      if (task.scheduledDate) {
        await syncManager.syncTaskToGoogle(task, project);
        console.log(`✅ Successfully synced task ${taskId} to Google Calendar`);
      } else {
        console.log(`⏭️ Task ${taskId} has no scheduled date, skipping sync`);
      }

      // Remove from pending tasks
      const updatedPendingTasks = new Set(pendingTasks);
      updatedPendingTasks.delete(taskId);
      
      set({ 
        pendingTasks: updatedPendingTasks,
        lastSyncTime: new Date(),
      });
    } catch (error) {
      console.error('Error syncing task:', error);
      
      // Mark task as error
      const newPendingTasks = new Set(pendingTasks);
      newPendingTasks.delete(taskId);
      
      const newErrorTasks = new Set(errorTasks);
      newErrorTasks.add(taskId);
      
      set({ 
        pendingTasks: newPendingTasks,
        errorTasks: newErrorTasks,
        syncError: error.message,
      });
    }
  },

  syncTaskDeletion: async (taskId: string) => {
    const { syncEnabled } = get();
    if (!syncEnabled) return;

    try {
      const syncManager = get().getSyncManager();
      if (!syncManager) throw new Error('Sync manager not available');

      // Get task data from store before deletion
      const { tasks } = useTaskStore.getState();
      const task = tasks.find(t => t.id === taskId);

      if (task && task.googleCalendarEventId) {
        await syncManager.deleteTaskFromGoogle(task);
      }

      set({ lastSyncTime: new Date() });
    } catch (error) {
      console.error('Error syncing task deletion:', error);
      set({ syncError: error.message });
    }
  },

  performManualSync: async () => {
    try {
      set({ syncInProgress: true, syncError: null });
      
      const syncManager = get().getSyncManager();
      if (!syncManager) throw new Error('Sync manager not available');

      await syncManager.performFullSync();
      
      set({ 
        syncInProgress: false,
        lastSyncTime: new Date(),
      });
    } catch (error) {
      console.error('Error performing manual sync:', error);
      set({ 
        syncError: error.message,
        syncInProgress: false,
      });
      throw error;
    }
  },

  clearSyncError: () => {
    set({ syncError: null });
  },

  // ================ WEBHOOK LIFECYCLE METHODS ================

  setupWebhook: async () => {
    try {
      set({ syncInProgress: true, syncError: null });
      
      const syncManager = get().getSyncManager();
      if (!syncManager) throw new Error('Sync manager not available');

      await syncManager.setupWebhook();
      
      set({ 
        syncInProgress: false,
        lastSyncTime: new Date(),
      });
    } catch (error) {
      console.error('Error setting up webhook:', error);
      set({ 
        syncError: error.message,
        syncInProgress: false,
      });
      // Don't throw - webhook failure should fall back to polling
    }
  },

  checkWebhookStatus: async () => {
    try {
      const syncManager = get().getSyncManager();
      if (!syncManager) return { isActive: false };

      return await syncManager.getWebhookStatus();
    } catch (error) {
      console.error('Error checking webhook status:', error);
      return { isActive: false };
    }
  },


  startWebhookMonitoring: () => {
    const store = get();
    
    // Stop existing monitoring
    if (store.webhookMonitoringInterval) {
      clearInterval(store.webhookMonitoringInterval);
    }

    console.log('🔔 Starting webhook monitoring');
    
    // Start real-time Firestore listener for immediate webhook detection
    store.startSyncStateListener();
    
    // Keep polling as backup (reduced frequency since we have real-time listeners)
    const monitoringInterval = setInterval(async () => {
      try {
        const syncManager = store.getSyncManager();
        if (!syncManager) return;

        // Check for webhook renewal (real-time listener handles sync triggers)
        await syncManager.checkWebhookRenewal();
        
      } catch (error) {
        console.error('Webhook monitoring error:', error);
      }
    }, 120000); // Check every 2 minutes (reduced from 30 seconds)

    set({ webhookMonitoringInterval: monitoringInterval });
  },

  stopWebhookMonitoring: () => {
    const store = get();
    const { webhookMonitoringInterval } = store;
    
    // Stop polling interval
    if (webhookMonitoringInterval) {
      clearInterval(webhookMonitoringInterval);
      set({ webhookMonitoringInterval: null });
    }
    
    // Stop real-time listener
    store.stopSyncStateListener();
    
    console.log('🔔 Webhook monitoring stopped');
  },

  // ================ REAL-TIME SYNC STATE LISTENERS ================

  startSyncStateListener: () => {
    const store = get();
    const { user } = useUserStore.getState();
    
    if (!user?.uid) {
      console.warn('⚠️ Cannot start sync state listener - no user');
      return;
    }

    // Stop existing listener
    if (store.syncStateListener) {
      store.syncStateListener();
    }

    console.log('🔄 Starting real-time sync state listener for user:', user.uid);

    try {
      // Listen to the user's sync state document for webhook-triggered sync flags
      const syncStateRef = doc(db, 'syncStates', user.uid);
      
      const unsubscribe = onSnapshot(syncStateRef, async (docSnapshot) => {
        console.log('🔄 Real-time sync state listener triggered:', {
          exists: docSnapshot.exists(),
          userId: user.uid,
          timestamp: new Date().toISOString()
        });
        
        if (!docSnapshot.exists()) {
          console.warn('⚠️ Sync state document does not exist for user:', user.uid);
          return;
        }
        
        const syncStateData = docSnapshot.data();
        console.log('📄 Sync state data received:', {
          webhookTriggeredSync: syncStateData?.webhookTriggeredSync,
          lastWebhookNotification: syncStateData?.lastWebhookNotification,
          isEnabled: syncStateData?.isEnabled
        });
        
        // Check if webhook triggered a sync
        if (syncStateData?.webhookTriggeredSync === true) {
          console.log('🚨 WEBHOOK-TRIGGERED SYNC DETECTED!');
          console.log('📡 Real-time listener is now triggering incremental sync...');
          
          try {
            const syncManager = store.getSyncManager();
            if (syncManager) {
              // Perform the sync with aggressive logging
              console.log('🔄 STARTING INCREMENTAL SYNC FROM WEBHOOK...');
              console.log('⏰ Sync timestamp:', new Date().toISOString());
              
              await syncManager.performIncrementalSync();
              
              console.log('🎉 WEBHOOK-TRIGGERED SYNC COMPLETED SUCCESSFULLY!');
              console.log('✅ Real-time webhook sync finished');
              
              // Reset the webhook flag after successful sync
              await syncManager.resetWebhookFlag();
              
              // Update last sync time
              set({ lastSyncTime: new Date() });
            } else {
              console.error('❌ Sync manager not available');
            }
          } catch (error) {
            console.error('❌ Real-time webhook sync failed:', error);
            
            // Don't reset webhook flag on failure so it can retry
            // But do clear any existing sync error since we handled it
            set({ syncError: null });
            
            // Note: performIncrementalSync should handle its own fallback to full sync
            // If it didn't work, the error will bubble up here
          }
        }
      }, (error) => {
        console.error('❌ Sync state listener error:', error);
        set({ syncError: 'Real-time sync monitoring failed' });
      });

      set({ syncStateListener: unsubscribe });
      console.log('✅ Real-time sync state listener started');
      
    } catch (error) {
      console.error('❌ Failed to start sync state listener:', error);
      set({ syncError: 'Failed to start real-time sync monitoring' });
    }
  },

  stopSyncStateListener: () => {
    const { syncStateListener } = get();
    
    if (syncStateListener) {
      syncStateListener();
      set({ syncStateListener: null });
      console.log('🔄 Real-time sync state listener stopped');
    }
  },
}));

// Hooks to integrate sync with task operations
export const useSyncIntegration = () => {
  const { syncTask, syncTaskDeletion } = useSyncStore();
  
  const syncTaskAfterUpdate = async (taskId: string) => {
    try {
      await syncTask(taskId);
    } catch (error) {
      console.error('Sync failed after task update:', error);
      // Don't throw error to avoid breaking the UI
    }
  };

  const syncTaskAfterDeletion = async (taskId: string) => {
    try {
      await syncTaskDeletion(taskId);
    } catch (error) {
      console.error('Sync failed after task deletion:', error);
    }
  };

  return {
    syncTaskAfterUpdate,
    syncTaskAfterDeletion,
  };
};

// Enhanced task store hooks that include sync
export const useTaskStoreWithSync = () => {
  const taskStore = useTaskStore();
  const { syncTaskAfterUpdate, syncTaskAfterDeletion } = useSyncIntegration();

  const addTask = async (taskData: Omit<Task, 'id' | 'order' | 'createdAt' | 'updatedAt'>) => {
    const taskId = await taskStore.addTask(taskData);
    
    // Note: taskStore.addTask already handles auto-sync for scheduled tasks
    // No need to sync again here to avoid duplicate calendar events
    
    return taskId;
  };

  const updateTask = async (taskId: string, taskData: Partial<Task>) => {
    await taskStore.updateTask(taskId, taskData);
    
    // Only sync if task has scheduling and sync-related fields changed
    const hasSchedulingChanges = taskData.scheduledDate !== undefined || 
                                 taskData.scheduledStartTime !== undefined ||
                                 taskData.scheduledEndTime !== undefined ||
                                 taskData.includeTime !== undefined;
    
    const hasContentChanges = taskData.title !== undefined ||
                             taskData.description !== undefined;
    
    // Only sync if there are relevant changes and the task will have a scheduled date
    if ((hasSchedulingChanges || hasContentChanges)) {
      // Get the updated task to check if it has a scheduled date
      const { tasks } = taskStore;
      const updatedTask = tasks.find(t => t.id === taskId);
      if (updatedTask && updatedTask.scheduledDate) {
        await syncTaskAfterUpdate(taskId);
      }
    }
  };

  const deleteTask = async (taskId: string) => {
    // Sync deletion before actually deleting
    await syncTaskAfterDeletion(taskId);
    await taskStore.deleteTask(taskId);
  };

  return {
    ...taskStore,
    addTask,
    updateTask,
    deleteTask,
  };
};