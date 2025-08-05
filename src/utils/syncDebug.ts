import { useTaskStore } from '../store/taskStore';
import { useSyncStore } from '../store/syncStore';
import { useUserStore } from '../store/userStore';
import { TaskDisplayService } from '../services/TaskDisplayService';
import { TaskNormalizationService } from '../services/TaskNormalizationService';
import { TaskDetectionService } from '../services/TaskDetectionService';
import { timezoneUtils } from './timezoneUtils';

export const debugSyncStatus = () => {
  const { tasks, projects } = useTaskStore.getState();
  const { syncEnabled, pendingTasks, errorTasks } = useSyncStore.getState();
  const { user } = useUserStore.getState();

  console.log('=== SYNC DEBUG INFO ===');
  console.log('User:', user?.uid);
  console.log('Sync enabled:', syncEnabled);
  console.log('Pending tasks:', pendingTasks.size);
  console.log('Error tasks:', errorTasks.size);
  console.log('Total tasks:', tasks.length);
  
  const scheduledTasks = tasks.filter(t => t.scheduledDate);
  console.log('Scheduled tasks:', scheduledTasks.length);
  
  scheduledTasks.forEach((task, index) => {
    const project = projects.find(p => p.id === task.projectId);
    console.log(`Task ${index + 1}:`, {
      id: task.id,
      title: task.title,
      scheduledDate: task.scheduledDate,
      syncStatus: task.syncStatus,
      googleCalendarEventId: task.googleCalendarEventId,
      project: project?.name,
      hasValidProject: !!project,
    });
  });

  // Check for tasks with missing projects
  const tasksWithMissingProjects = tasks.filter(t => {
    const project = projects.find(p => p.id === t.projectId);
    return !project;
  });
  
  if (tasksWithMissingProjects.length > 0) {
    console.warn('Tasks with missing projects:', tasksWithMissingProjects.map(t => ({
      id: t.id,
      title: t.title,
      projectId: t.projectId,
    })));
  }

  console.log('=== END SYNC DEBUG ===');
};

// Function to fix tasks with missing sync status
export const fixTaskSyncStatus = async () => {
  const { tasks } = useTaskStore.getState();
  const { updateTask } = useTaskStore.getState();
  
  for (const task of tasks) {
    if (task.scheduledDate && !task.syncStatus) {
      console.log(`Fixing sync status for task: ${task.title}`);
      try {
        await updateTask(task.id, {
          syncStatus: 'pending',
        });
      } catch (error) {
        console.error(`Failed to fix sync status for task ${task.id}:`, error);
      }
    }
  }
};

// Make functions available globally for browser console
if (typeof window !== 'undefined') {
  (window as any).debugSyncStatus = debugSyncStatus;
  (window as any).fixTaskSyncStatus = fixTaskSyncStatus;
  
  // Expose timezone services for debugging
  (window as any).TaskDisplayService = TaskDisplayService;
  (window as any).TaskNormalizationService = TaskNormalizationService;
  (window as any).TaskDetectionService = TaskDetectionService;
  (window as any).timezoneUtils = timezoneUtils;
  
  // Convenience access to stores
  (window as any).useTaskStore = useTaskStore;
  (window as any).useUserStore = useUserStore;
  
  console.log('🔧 Debug utilities and timezone services loaded');
}