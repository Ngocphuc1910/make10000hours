import { create } from 'zustand';
import { createSyncManager } from '../services/sync/syncManager';
import { useUserStore } from './userStore';
import { useTaskStore } from './taskStore';
import { Task, Project } from '../types/models';

interface SyncState {
  syncEnabled: boolean;
  syncInProgress: boolean;
  lastSyncTime: Date | null;
  syncError: string | null;
  pendingTasks: Set<string>;
  errorTasks: Set<string>;
  
  // Actions
  initializeSync: () => Promise<void>;
  enableSync: () => Promise<void>;
  disableSync: () => Promise<void>;
  syncTask: (taskId: string) => Promise<void>;
  syncTaskDeletion: (taskId: string) => Promise<void>;
  performManualSync: () => Promise<void>;
  clearSyncError: () => void;
  getSyncManager: () => any;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  syncEnabled: false,
  syncInProgress: false,
  lastSyncTime: null,
  syncError: null,
  pendingTasks: new Set(),
  errorTasks: new Set(),

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