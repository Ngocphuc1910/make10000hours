import { create } from 'zustand';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, orderBy, where, writeBatch, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../api/firebase';
import { useUserStore } from './userStore';
import type { Task, Project } from '../types/models';
import { trackTaskCreated, trackTaskCompleted, trackProjectCreated } from '../utils/analytics';
import { workSessionService } from '../api/workSessionService';
import { transitionQueryService } from '../services/transitionService';
import { TaskStorageService } from '../services/TaskStorageService';
import { timezoneUtils } from '../utils/timezoneUtils';
import { sortTasksByOrder, getTaskPosition } from '../utils/taskSorting';
import { FractionalOrderingService } from '../services/FractionalOrderingService';

interface TaskState {
  tasks: Task[];
  projects: Project[];
  isAddingTask: boolean;
  editingTaskId: string | null;
  showDetailsMenu: boolean;
  isLoading: boolean;
  unsubscribe: (() => void) | null;
  taskListViewMode: 'pomodoro' | 'today';
  columnOrder: Task['status'][];
  projectColumnOrder: string[];
  
  // Actions
  initializeStore: () => Promise<void>;
  addTask: (taskData: Omit<Task, 'id' | 'order' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateTask: (taskId: string, taskData: Partial<Task>) => Promise<void>;
  updateTaskLocally: (taskIdx: number, updates: Partial<Task>) => void;
  deleteTask: (id: string) => Promise<void>;
  toggleTaskCompletion: (taskId: string, context?: string) => Promise<Task | null>;
  updateTaskStatus: (taskId: string, status: Task['status']) => Promise<void>;
  reorderTasks: (taskId: string, newIndex: number) => Promise<void>;
  reorderTasksGlobal: (taskId: string, newIndex: number, visibleTasks: Task[]) => Promise<void>;
  moveTaskToStatusAndPosition: (taskId: string, newStatus: Task['status'], targetIndex: number) => Promise<void>;
  moveTaskToProject: (taskId: string, newProjectId: string | null, targetIndex?: number) => Promise<void>;
  setIsAddingTask: (isAdding: boolean) => void;
  setEditingTaskId: (taskId: string | null) => void;
  setShowDetailsMenu: (show: boolean) => void;
  setTaskListViewMode: (mode: 'pomodoro' | 'today') => Promise<void>;
  addProject: (project: Omit<Project, 'id' | 'userId'>) => Promise<string>;
  updateProject: (projectId: string, updates: Partial<Omit<Project, 'id' | 'userId'>>) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  timeSpentIncrement: (id: string, increment: number) => Promise<void>;
  handleMoveCompletedDown: () => Promise<void>;
  handleArchiveCompleted: () => Promise<void>;
  cleanupListeners: () => void;
  cleanupOrphanedWorkSessions: () => Promise<{ deletedCount: number; orphanedSessions: { id: string; taskId: string; duration: number; date: string; }[]; }>;
  getNextPomodoroTask: (currentTaskId: string) => Task | null;
  hasSchedulingChanges: (currentTask: Task | undefined, updates: Partial<Task>) => boolean;
  validateMultiDayTask: (taskData: Partial<Task>) => { isValid: boolean; errors: string[] };
  reorderColumns: (newOrder: Task['status'][]) => void;
  reorderProjectColumns: (newOrder: string[]) => void;
}

const tasksCollection = collection(db, 'tasks');
const projectsCollection = collection(db, 'projects');

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  projects: [],
  columnOrder: ['pomodoro', 'todo', 'completed'],
  projectColumnOrder: [],
  isAddingTask: false,
  editingTaskId: null,
  showDetailsMenu: false,
  isLoading: false,
  unsubscribe: null,
  taskListViewMode: 'today',

  initializeStore: async () => {
    const { user, isAuthenticated } = useUserStore.getState();
    
    // Set task list view mode from user settings
    if (user?.settings?.taskListViewMode) {
      set({ taskListViewMode: user.settings.taskListViewMode });
    }

    // Load persisted column order
    const savedColumnOrder = localStorage.getItem('taskColumnOrder');
    if (savedColumnOrder) {
      try {
        const columnOrder = JSON.parse(savedColumnOrder);
        set({ columnOrder });
      } catch (error) {
        console.warn('Failed to parse saved column order:', error);
      }
    }

    // Load persisted project column order
    const savedProjectColumnOrder = localStorage.getItem('projectColumnOrder');
    if (savedProjectColumnOrder) {
      try {
        const projectColumnOrder = JSON.parse(savedProjectColumnOrder);
        set({ projectColumnOrder });
      } catch (error) {
        console.warn('Failed to parse saved project column order:', error);
      }
    }
    
    if (!isAuthenticated || !user) {
      set({ tasks: [], projects: [], isLoading: false });
      return;
    }

    set({ isLoading: true });
    
    // Clean up existing listeners
    const { unsubscribe } = get();
    if (unsubscribe) {
      unsubscribe();
    }
    
    // Set up real-time listeners for tasks and projects
    // Note: No orderBy since we handle sorting in JavaScript with mixed integer/string ordering
    const tasksQuery = query(
      tasksCollection, 
      where('userId', '==', user.uid)
    );

    const projectsQuery = query(
      projectsCollection,
      where('userId', '==', user.uid)
    );
    
    // Subscribe to real-time updates for tasks
    const unsubscribeTasks = onSnapshot(tasksQuery, (snapshot) => {
      const fetchedTasks: Task[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Task[];
      
      // Only log on initial load or significant changes
      if (get().tasks.length === 0) {
        console.log(`Initial load: Fetched ${fetchedTasks.length} tasks for user ${user.uid}`);
      }
      
      set({ tasks: fetchedTasks });
    });
    
    // Subscribe to real-time updates for projects
    const unsubscribeProjects = onSnapshot(projectsQuery, (snapshot) => {
      const fetchedProjects: Project[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Project[];
      set({ projects: fetchedProjects, isLoading: false });
    });
    
    // Combine unsubscribe functions
    const combinedUnsubscribe = () => {
      unsubscribeTasks();
      unsubscribeProjects();
    };
    
    set({ unsubscribe: combinedUnsubscribe });
  },
  
  cleanupListeners: () => {
    const { unsubscribe } = get();
    if (unsubscribe) {
      unsubscribe();
      set({ unsubscribe: null, tasks: [], projects: [] });
    }
  },
  
  addProject: async (projectData) => {
    try {
      const { user } = useUserStore.getState();
      
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      const newProject = {
        ...projectData,
        userId: user.uid
      };
      
      // If this is the "No Project" project, use a fixed ID
      if (projectData.name === 'No Project') {
        const docRef = doc(db, 'projects', 'no-project');
        await setDoc(docRef, newProject);
        return 'no-project';
      }
      
      const docRef = await addDoc(projectsCollection, newProject);
      
      // Track project creation in Analytics
      trackProjectCreated(projectData.name);
      
      return docRef.id;
    } catch (error) {
      console.error('Error adding project:', error);
      throw error;
    }
  },

  updateProject: async (projectId, updates) => {
    try {
      const { user } = useUserStore.getState();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const projectRef = doc(db, 'projects', projectId);
      await updateDoc(projectRef, updates);
      
      console.log(`✅ Successfully updated project ${projectId}`);
    } catch (error) {
      console.error(`❌ Error updating project ${projectId}:`, error);
      throw error;
    }
  },
  
  deleteProject: async (projectId) => {
    try {
      const { user } = useUserStore.getState();
      if (!user) {
        throw new Error('User not authenticated');
      }

      console.log(`🗑️ Starting deletion of project ${projectId}...`);

      // Get all tasks associated with the project
      const tasksQuery = query(
        tasksCollection,
        where('userId', '==', user.uid),
        where('projectId', '==', projectId)
      );

      const tasksSnapshot = await getDocs(tasksQuery);
      const taskIds = tasksSnapshot.docs.map(doc => doc.id);
      
      console.log(`📋 Found ${taskIds.length} tasks in project ${projectId}`);

      // Delete all work sessions for each task first (both UTC and legacy)
      if (taskIds.length > 0) {
        try {
          let totalDeleted = 0;
          for (const taskId of taskIds) {
            const deletedCount = await transitionQueryService.deleteWorkSessionsByTask(user.uid, taskId);
            totalDeleted += deletedCount;
            console.log(`✅ CASCADE DELETE: Deleted ${deletedCount} work sessions (UTC + legacy) for task ${taskId}`);
          }
          console.log(`✅ Total sessions deleted for project ${projectId}: ${totalDeleted}`);
        } catch (workSessionError) {
          console.error('❌ Error deleting work sessions for project tasks:', workSessionError);
          console.warn(`⚠️ Work session cleanup failed for project ${projectId}, but continuing with deletion`);
        }
      }

      // Now delete all tasks and the project using batch
      const batch = writeBatch(db);

      // Add all task deletions to the batch
      tasksSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      // Add project deletion to the batch
      const projectRef = doc(db, 'projects', projectId);
      batch.delete(projectRef);

      // Execute all deletions
      await batch.commit();
      
      console.log(`✅ Successfully deleted project ${projectId}, ${taskIds.length} tasks, and all related work sessions`);
    } catch (error) {
      console.error(`❌ Error deleting project ${projectId}:`, error);
      throw error;
    }
  },
  
  addTask: async (taskData) => {
    try {
      console.log('addTask started');
      
      // Validate multi-day task data if feature is enabled
      if (taskData.scheduledEndDate) {
        const validation = get().validateMultiDayTask(taskData);
        if (!validation.isValid) {
          throw new Error(`Invalid multi-day task data: ${validation.errors.join(', ')}`);
        }
      }
      
      const { user } = useUserStore.getState();
      if (!user) throw new Error('No user found');
      console.log('User found:', user.uid);
      
      const { tasks } = get();
      console.log('Current tasks count:', tasks.length);
      
      // Generate proper fractional position for new task
      // Place new tasks at the END of their status group (most common UX pattern)
      const statusTasks = sortTasksByOrder(
        tasks.filter(t => t.status === (taskData.status || 'todo'))
      );
      
      // Generate position at the end of this status
      const lastTask = statusTasks.length > 0 ? statusTasks[statusTasks.length - 1] : null;
      const lastPosition = lastTask ? getTaskPosition(lastTask) : null;
      const newOrderString = FractionalOrderingService.generatePosition(lastPosition, null);
      
      console.log(`📍 New task "${taskData.title}" positioning:`, {
        status: taskData.status || 'todo',
        statusTasksCount: statusTasks.length,
        lastTask: lastTask?.title || 'none',
        lastPosition: lastPosition || 'none',
        newOrderString
      });
      
      // Add task with proper fractional ordering (keep legacy order for compatibility)
      const maxOrder = tasks.length > 0 ? Math.max(...tasks.map(t => t.order || 0)) : -1;
      const taskDataWithOrder = {
        ...taskData,
        userId: user.uid,
        order: maxOrder + 1, // Keep for legacy compatibility
        orderString: newOrderString // Primary ordering field
      };
      
      // Get user's timezone for UTC conversion
      const userTimezone = typeof user.settings?.timezone === 'string' 
        ? user.settings.timezone 
        : user.settings?.timezone?.current || timezoneUtils.getCurrentTimezone();
      
      // Use TaskStorageService for proper UTC handling
      const docId = await TaskStorageService.createTask(taskDataWithOrder, userTimezone);
      console.log('Task created with UTC fields, docId:', docId);
      // Track task creation in Analytics
      trackTaskCreated(taskData.projectId);
      
      // Auto-sync task to Google Calendar if it has a scheduled date
      if (taskData.scheduledDate) {
        try {
          console.log('🔄 Auto-syncing new task to Google Calendar...');
          const { useSyncStore } = await import('./syncStore');
          
          // Add a small delay to ensure task is in the store
          setTimeout(async () => {
            try {
              await useSyncStore.getState().syncTask(docId);
              console.log('✅ Task auto-synced to Google Calendar');
            } catch (syncError) {
              console.error('❌ Failed to auto-sync task to Google Calendar:', syncError);
            }
          }, 1000);
        } catch (syncError) {
          console.error('❌ Failed to setup auto-sync for task:', syncError);
          // Don't throw the error since task creation succeeded
        }
      }
      
      console.log('Task creation initiated successfully');
      return docId; // Return the new task ID
    } catch (error) {
      console.error('Error adding task:', error);
      throw error;
    }
  },
  
  // Helper function to validate multi-day task data
  validateMultiDayTask: (taskData: Partial<Task>): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    // If scheduledEndDate is provided, validate it
    if (taskData.scheduledEndDate) {
      // scheduledDate must be provided for multi-day tasks
      if (!taskData.scheduledDate) {
        errors.push('scheduledDate is required for multi-day tasks');
      } else {
        // scheduledEndDate must be after or equal to scheduledDate
        const startDate = new Date(taskData.scheduledDate);
        const endDate = new Date(taskData.scheduledEndDate);
        
        if (endDate < startDate) {
          errors.push('scheduledEndDate must be after or equal to scheduledDate');
        }
        
        // For now, limit to reasonable multi-day ranges (e.g., max 30 days)
        const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff > 30) {
          errors.push('Multi-day tasks cannot span more than 30 days');
        }
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  },

  // Helper function to detect if scheduling-related fields have changed
  hasSchedulingChanges: (currentTask: Task | undefined, updates: Partial<Task>): boolean => {
    if (!currentTask) return false;
    
    const schedulingFields = ['scheduledDate', 'scheduledEndDate', 'scheduledStartTime', 'scheduledEndTime', 'includeTime'];
    return schedulingFields.some(field => {
      const currentValue = currentTask[field as keyof Task];
      const newValue = updates[field as keyof Task];
      return newValue !== undefined && currentValue !== newValue;
    });
  },

  updateTask: async (id, updates) => {
    try {
      // Validate multi-day task data if feature is enabled and scheduledEndDate is being updated
      if (updates.scheduledEndDate !== undefined) {
        const { tasks } = get();
        const currentTask = tasks.find(t => t.id === id);
        const mergedTaskData = { ...currentTask, ...updates };
        
        const validation = get().validateMultiDayTask(mergedTaskData);
        if (!validation.isValid) {
          throw new Error(`Invalid multi-day task data: ${validation.errors.join(', ')}`);
        }
      }
      
      const { user } = useUserStore.getState();
      if (!user) throw new Error('No user found');

      // Get the current task to check for projectId changes
      const { tasks } = get();
      const currentTask = tasks.find(t => t.id === id);
      
      // Check if projectId is being updated (including null values)
      const isProjectIdChanging = updates.hasOwnProperty('projectId') && currentTask && updates.projectId !== currentTask.projectId;
      
      console.log(`🗺️ TaskStore updateTask for ${id}:`, {
        currentProjectId: currentTask?.projectId || 'no-project',
        newProjectId: updates.projectId || 'no-project',
        isProjectIdChanging,
        updates: Object.keys(updates)
      });
      
      // Check if scheduling-related fields are being updated
      const hasSchedulingChanges = get().hasSchedulingChanges(currentTask, updates);
      
      // Filter out undefined values to prevent Firebase errors
      const filteredUpdates = Object.fromEntries(
        Object.entries(updates).filter(([_, value]) => value !== undefined)
      );

      // Get user's timezone for UTC conversion
      const userTimezone = typeof user.settings?.timezone === 'string' 
        ? user.settings.timezone 
        : user.settings?.timezone?.current || timezoneUtils.getCurrentTimezone();

      // Use TaskStorageService for proper UTC handling
      await TaskStorageService.updateTask(id, filteredUpdates, userTimezone);

      // If projectId changed, update all related work sessions
      if (isProjectIdChanging && updates.projectId) {
        try {
          const updatedCount = await workSessionService.updateWorkSessionsProjectId(
            user.uid,
            id,
            updates.projectId
          );
          
          if (updatedCount > 0) {
            console.log(`🔄 Updated ${updatedCount} work sessions for task ${id} to project ${updates.projectId}`);
          }
        } catch (error) {
          console.error('❌ Failed to update work sessions project ID:', error);
          // Don't throw here - the task update succeeded, this is just cleanup
          console.warn('⚠️ Task was updated but work session project IDs may be inconsistent');
        }
      }

      // Only auto-sync to Google Calendar if scheduling information was modified
      const updatedTask = { ...currentTask, ...updates };
      if (hasSchedulingChanges && updatedTask.scheduledDate) {
        try {
          console.log('🔄 Auto-syncing task with scheduling changes to Google Calendar...');
          const { useSyncStore } = await import('./syncStore');
          await useSyncStore.getState().syncTask(id);
          console.log('✅ Task scheduling changes auto-synced to Google Calendar');
        } catch (syncError) {
          console.error('❌ Failed to auto-sync task scheduling changes to Google Calendar:', syncError);
          // Don't throw the error since task update succeeded
        }
      }
      
      set({ editingTaskId: null });
    } catch (error) {
      console.error('Error updating task:', error);
      throw error;
    }
  },

  updateTaskLocally: (taskIdx, updates) => {
    const { tasks } = get();
    tasks[taskIdx] = {
      ...tasks[taskIdx],
      ...updates,
      updatedAt: new Date()
    };
    set({ tasks: [...tasks] });
  },
  
  deleteTask: async (id) => {
    try {
      const { user } = useUserStore.getState();
      if (!user) throw new Error('No user found');

      console.log(`🗑️ Starting deletion of task ${id}...`);

      // First delete all related work sessions for this task (both UTC and legacy)
      try {
        const deletedCount = await transitionQueryService.deleteWorkSessionsByTask(user.uid, id);
        console.log(`✅ CASCADE DELETE: Successfully deleted ${deletedCount} work sessions (UTC + legacy) for task ${id}`);
      } catch (workSessionError) {
        console.error('❌ Error deleting work sessions for task:', workSessionError);
        // Don't throw here - we still want to delete the task even if work session cleanup fails
        // But log it clearly for debugging
        console.warn(`⚠️ Work session cleanup failed for task ${id}, but continuing with task deletion`);
      }

      // Then delete the task itself
      console.log(`🗑️ Deleting task ${id}...`);
      const taskRef = doc(db, 'tasks', id);
      await deleteDoc(taskRef);
      
      console.log(`✅ Successfully deleted task ${id} and all related work sessions`);
    } catch (error) {
      console.error(`❌ Error deleting task ${id}:`, error);
      throw error;
    }
  },
  
  toggleTaskCompletion: async (id, context = 'default') => {
    try {
      const { tasks } = get();
      const task = tasks.find(t => t.id === id);
      
      if (!task) return null;
      
      const completed = !task.completed;
      const status = completed ? 'completed' : 'pomodoro';
      let nextTask: Task | null = null;
      
      // If completing a task in Pomodoro context, find next task
      if (completed && context === 'pomodoro') {
        nextTask = get().getNextPomodoroTask(id);
      }
      
      // If completing a task that is currently active in the timer, handle timer state
      if (completed) {
        // Import timer store dynamically to avoid circular dependency
        const { useTimerStore } = await import('./timerStore');
        const timerState = useTimerStore.getState();
        
        // Check if this task is currently active in the timer
        if (timerState.currentTask && timerState.currentTask.id === id) {
          if (context === 'pomodoro' && nextTask) {
            // In Pomodoro context with next task available - switch without pausing
            await timerState.switchToNextPomodoroTask(nextTask);
          } else {
            // Regular completion or no next task - pause timer and clear task
            if (timerState.isRunning) {
              await timerState.pause();
            }
            timerState.setCurrentTask(null);
          }
        }
      }
      
      // Keep the original order when unchecking
      const taskRef = doc(db, 'tasks', id);
      const updateData: any = {
        completed,
        status,
        updatedAt: new Date()
      };
      
      // If completing a task from 'todo' column, hide it from pomodoro timer
      if (completed && context === 'todo') {
        updateData.hideFromPomodoro = true;
      }
      
      await updateDoc(taskRef, updateData);
      
      // Track task completion in Analytics
      if (completed) {
        trackTaskCompleted(id, task.timeSpent, task.projectId);
      }

      return nextTask; // Return next task for caller reference
    } catch (error) {
      console.error('Error toggling task completion:', error);
      throw error;
    }
  },
  
  updateTaskStatus: async (id, status) => {
    try {
      const { tasks } = get();
      const task = tasks.find(t => t.id === id);
      
      if (!task) return;
      
      const completed = status === 'completed' ? true : 
                       (task.status === 'completed' ? false : task.completed);
      
      // Prepare the update object
      const updateData: Partial<Task> = {
        status,
        completed,
        updatedAt: new Date()
      };
      
      // If moving to 'pomodoro' status, ensure it's not hidden from Pomodoro page
      if (status === 'pomodoro') {
        updateData.hideFromPomodoro = false;
      }
      
      // Keep the original order when moving between statuses
      const taskRef = doc(db, 'tasks', id);
      await updateDoc(taskRef, updateData);
    } catch (error) {
      console.error('Error updating task status:', error);
      throw error;
    }
  },
  
  // Global reordering for task list views (like pomodoro timer) where all visible tasks can be reordered together
  reorderTasksGlobal: async (taskId: string, newIndex: number, visibleTasks: Task[]) => {
    try {
      const { tasks } = get();
      const currentTask = tasks.find(t => t.id === taskId);
      if (!currentTask) return;
      
      // Get the visible tasks excluding the current task being moved
      const otherVisibleTasks = visibleTasks.filter(t => t.id !== taskId);
      
      // Sort the visible tasks to match UI display order
      const sortedVisibleTasks = sortTasksByOrder(otherVisibleTasks);
      
      // CRITICAL: Clamp the newIndex to valid bounds to prevent out-of-bounds errors
      const clampedIndex = Math.max(0, Math.min(newIndex, sortedVisibleTasks.length));
      
      // Get adjacent positions for fractional indexing
      const beforeTask = clampedIndex > 0 ? sortedVisibleTasks[clampedIndex - 1] : null;
      const afterTask = clampedIndex < sortedVisibleTasks.length ? sortedVisibleTasks[clampedIndex] : null;
      
      const beforePos = beforeTask ? getTaskPosition(beforeTask) : null;
      const afterPos = afterTask ? getTaskPosition(afterTask) : null;
      
      // Generate new fractional position
      const newOrderString = FractionalOrderingService.generatePosition(beforePos, afterPos);
      
      console.log(`🎯 GLOBAL REORDER ${currentTask.title} (${currentTask.status}):`, {
        requestedIndex: newIndex,
        clampedIndex,
        visibleTasksCount: sortedVisibleTasks.length,
        beforeTask: beforeTask?.title || 'START',
        afterTask: afterTask?.title || 'END', 
        beforePos: beforePos || 'null',
        afterPos: afterPos || 'null',
        newOrderString
      });
      
      // Update only the moved task - no other tasks need updating!
      const taskRef = doc(db, 'tasks', taskId);
      await updateDoc(taskRef, {
        orderString: newOrderString,
        updatedAt: new Date()
      });
      
      // Optimistic update for immediate UI response
      const updatedTasks = tasks.map(task => 
        task.id === taskId 
          ? { ...task, orderString: newOrderString }
          : task
      );
      set({ tasks: updatedTasks });
      
    } catch (error) {
      console.error('Error reordering task globally:', error);
      throw error;
    }
  },

  reorderTasks: async (taskId: string, newIndex: number) => {
    try {
      const { tasks } = get();
      const currentTask = tasks.find(t => t.id === taskId);
      if (!currentTask) return;
      
      // CRITICAL: Get tasks in same status, sorted EXACTLY like the UI displays them
      const statusTasks = sortTasksByOrder(
        tasks.filter(t => t.status === currentTask.status && t.id !== taskId)
      );
      
      // CRITICAL: Clamp the newIndex to valid bounds to prevent out-of-bounds errors
      const clampedIndex = Math.max(0, Math.min(newIndex, statusTasks.length));
      
      // Get adjacent positions for fractional indexing
      const beforeTask = clampedIndex > 0 ? statusTasks[clampedIndex - 1] : null;
      const afterTask = clampedIndex < statusTasks.length ? statusTasks[clampedIndex] : null;
      
      const beforePos = beforeTask ? getTaskPosition(beforeTask) : null;
      const afterPos = afterTask ? getTaskPosition(afterTask) : null;
      
      // Generate new fractional position
      const newOrderString = FractionalOrderingService.generatePosition(beforePos, afterPos);
      
      console.log(`🎯 REORDER ${currentTask.title} in ${currentTask.status}:`, {
        requestedIndex: newIndex,
        clampedIndex,
        statusTasksCount: statusTasks.length,
        beforeTask: beforeTask?.title || 'START',
        afterTask: afterTask?.title || 'END', 
        beforePos: beforePos || 'null',
        afterPos: afterPos || 'null',
        newOrderString
      });
      
      // Update only the moved task - no other tasks need updating!
      const taskRef = doc(db, 'tasks', taskId);
      await updateDoc(taskRef, {
        orderString: newOrderString,
        updatedAt: new Date()
      });
      
      // Optimistic update for immediate UI response
      const updatedTasks = tasks.map(task => 
        task.id === taskId 
          ? { ...task, orderString: newOrderString }
          : task
      );
      set({ tasks: updatedTasks });
      
    } catch (error) {
      console.error('Error reordering task:', error);
      throw error;
    }
  },

  moveTaskToStatusAndPosition: async (taskId: string, newStatus: string, targetIndex: number) => {
    try {
      const { tasks } = get();
      const task = tasks.find(t => t.id === taskId);
      if (!task) throw new Error('Task not found');
      
      // CRITICAL: Get tasks in destination status, sorted EXACTLY like the UI displays them
      const statusTasks = sortTasksByOrder(
        tasks.filter(t => t.status === newStatus && t.id !== taskId)
      );
      
      // CRITICAL: Clamp the targetIndex to valid bounds
      const clampedIndex = Math.max(0, Math.min(targetIndex, statusTasks.length));
      
      // Calculate new fractional position
      const beforeTask = clampedIndex > 0 ? statusTasks[clampedIndex - 1] : null;
      const afterTask = clampedIndex < statusTasks.length ? statusTasks[clampedIndex] : null;
      
      const beforePos = beforeTask ? getTaskPosition(beforeTask) : null;
      const afterPos = afterTask ? getTaskPosition(afterTask) : null;
      
      const newOrderString = FractionalOrderingService.generatePosition(beforePos, afterPos);
      
      console.log(`🏆 MOVE ${task.title} to ${newStatus}:`, {
        requestedIndex: targetIndex,
        clampedIndex,
        destinationTasksCount: statusTasks.length,
        beforeTask: beforeTask?.title || 'START',
        afterTask: afterTask?.title || 'END',
        beforePos: beforePos || 'null',
        afterPos: afterPos || 'null', 
        newOrderString
      });
      
      // Single document update - much more efficient!
      const taskRef = doc(db, 'tasks', taskId);
      await updateDoc(taskRef, {
        status: newStatus,
        completed: newStatus === 'completed' ? true : (task.status === 'completed' ? false : task.completed),
        hideFromPomodoro: newStatus === 'pomodoro' ? false : (task.hideFromPomodoro ?? false),
        orderString: newOrderString,
        updatedAt: new Date()
      });
      
      // Optimistic update
      const updatedTasks = tasks.map(t => 
        t.id === taskId 
          ? { 
              ...t, 
              status: newStatus, 
              completed: newStatus === 'completed' ? true : (task.status === 'completed' ? false : task.completed),
              hideFromPomodoro: newStatus === 'pomodoro' ? false : (task.hideFromPomodoro ?? false),
              orderString: newOrderString 
            }
          : t
      );
      set({ tasks: updatedTasks });
      
    } catch (error) {
      console.error('Error moving task to status and position:', error);
      throw error;
    }
  },

  moveTaskToProject: async (taskId: string, newProjectId: string | null, targetIndex?: number) => {
    try {
      const { tasks } = get();
      const task = tasks.find(t => t.id === taskId);
      if (!task) throw new Error('Task not found');
      
      // Normalize project IDs for comparison
      const currentProjectId = task.projectId || null;
      const finalProjectId = newProjectId === 'no-project' ? null : newProjectId;
      
      // If project hasn't changed, just do a reorder within the project
      if (currentProjectId === finalProjectId) {
        if (targetIndex !== undefined) {
          console.log(`🔄 Reordering task within same project: ${taskId}`);
          await get().reorderTasks(taskId, targetIndex);
        }
        return;
      }
      
      console.log(`🗺️ Moving task ${taskId} from project ${currentProjectId || 'no-project'} to ${finalProjectId || 'no-project'}`);
      
      // Get tasks in the target project for positioning
      const targetProjectTasks = sortTasksByOrder(
        tasks.filter(t => (t.projectId || null) === finalProjectId && t.id !== taskId)
      );
      
      let newOrderString: string;
      
      if (targetIndex !== undefined && targetIndex >= 0) {
        // Position at specific index within target project
        const clampedIndex = Math.max(0, Math.min(targetIndex, targetProjectTasks.length));
        
        const beforeTask = clampedIndex > 0 ? targetProjectTasks[clampedIndex - 1] : null;
        const afterTask = clampedIndex < targetProjectTasks.length ? targetProjectTasks[clampedIndex] : null;
        
        const beforePos = beforeTask ? getTaskPosition(beforeTask) : null;
        const afterPos = afterTask ? getTaskPosition(afterTask) : null;
        
        newOrderString = FractionalOrderingService.generatePosition(beforePos, afterPos);
        
        console.log(`🎯 PROJECT MOVE with positioning:`, {
          taskId,
          currentProject: currentProjectId || 'no-project',
          newProject: finalProjectId || 'no-project', 
          requestedIndex: targetIndex,
          clampedIndex,
          targetProjectTasksCount: targetProjectTasks.length,
          beforeTask: beforeTask?.title || 'START',
          afterTask: afterTask?.title || 'END',
          newOrderString
        });
      } else {
        // Add to end of target project
        const lastTask = targetProjectTasks[targetProjectTasks.length - 1];
        const lastPos = lastTask ? getTaskPosition(lastTask) : null;
        newOrderString = FractionalOrderingService.generatePosition(lastPos, null);
        
        console.log(`🎯 PROJECT MOVE to end:`, {
          taskId,
          currentProject: currentProjectId || 'no-project',
          newProject: finalProjectId || 'no-project',
          targetProjectTasksCount: targetProjectTasks.length,
          newOrderString
        });
      }
      
      // Update task with new project ID and position, preserving status
      const taskRef = doc(db, 'tasks', taskId);
      await updateDoc(taskRef, {
        projectId: finalProjectId,
        orderString: newOrderString,
        updatedAt: new Date()
      });
      
      // Optimistic update
      const updatedTasks = tasks.map(t => 
        t.id === taskId 
          ? { 
              ...t, 
              projectId: finalProjectId,
              orderString: newOrderString 
            }
          : t
      );
      set({ tasks: updatedTasks });
      
      // If moving to a new project, update all related work sessions
      if (finalProjectId) {
        try {
          const { user } = useUserStore.getState();
          if (user) {
            const updatedCount = await workSessionService.updateWorkSessionsProjectId(
              user.uid,
              taskId,
              finalProjectId
            );
            
            if (updatedCount > 0) {
              console.log(`🔄 Updated ${updatedCount} work sessions for task ${taskId} to project ${finalProjectId}`);
            }
          }
        } catch (error) {
          console.error('❌ Failed to update work sessions project ID:', error);
          // Don't throw here - the task update succeeded, this is just cleanup
        }
      }
      
    } catch (error) {
      console.error('Error moving task to project:', error);
      throw error;
    }
  },

  timeSpentIncrement: async (id, increment = 1) => {
    if (increment <= 0) {
      console.warn('Increment must be a positive number');
      return;
    }
    const { tasks } = get();
    const task = tasks.find(t => t.id === id);
    if (!task) {
      console.error('Task not found:', id);
      throw new Error('Task not found');
    }
    const oldTimeSpent = task.timeSpent;
    const newTimeSpent = task.timeSpent + increment;
    if (newTimeSpent < 0) {
      console.error('Time spent cannot be negative');
      throw new Error('Time spent cannot be negative');
    }
    try {
      console.log('💾 Writing timeSpent to Firebase:', { 
        taskId: id, 
        from: oldTimeSpent, 
        to: newTimeSpent, 
        increment 
      });
      
      // Update the main task timeSpent field
      const taskRef = doc(db, 'tasks', id);
      await updateDoc(taskRef, {
        timeSpent: newTimeSpent,
        updatedAt: new Date()
      });
      
      console.log('✅ Firebase write completed for task:', id);
    } catch (error) {
      console.error('❌ Error incrementing time spent:', error);
      throw error;
    }
  },
  
  setIsAddingTask: (isAdding) => set({ isAddingTask: isAdding }),
  
  setEditingTaskId: (taskId) => set({ editingTaskId: taskId }),
  
  setShowDetailsMenu: (show) => set({ showDetailsMenu: show }),
  
  setTaskListViewMode: async (mode) => {
    set({ taskListViewMode: mode });
    
    // Persist to user settings
    try {
      const { user, updateUserData } = useUserStore.getState();
      if (user) {
        // Only update the serializable user data, not the full Firebase Auth user
        const userData = {
          uid: user.uid,
          userName: user.userName,
          settings: {
            ...user.settings,
            taskListViewMode: mode
          }
        };
        await updateUserData(userData);
      }
    } catch (error) {
      console.error('Failed to persist task list view mode:', error);
    }
  },
  
  handleMoveCompletedDown: async () => {
    try {
      const { tasks, taskListViewMode } = get();
      
      // Get tasks visible in the current view mode (matching TaskListSorted filtering logic)
      const visibleTasks = tasks.filter(task => {
        // Don't show archived tasks (hidden from pomodoro)
        if (task.hideFromPomodoro) return false;
        
        // Apply view mode filtering
        if (taskListViewMode === 'pomodoro') {
          // For pomodoro view: show all tasks not hidden from pomodoro
          return true;
        } else {
          // For today view: show today's tasks (simplified - would need timezone logic)
          return true;
        }
      });
      
      // Sort tasks to match UI display order
      const sortedVisibleTasks = sortTasksByOrder(visibleTasks);
      const completedTasks = sortedVisibleTasks.filter(t => t.completed);
      const incompleteTasks = sortedVisibleTasks.filter(t => !t.completed);
      
      if (completedTasks.length === 0) {
        console.log('No completed tasks to move down');
        set({ showDetailsMenu: false });
        return;
      }
      
      console.log(`🔄 Moving ${completedTasks.length} completed tasks down in ${taskListViewMode} view`);
      
      // Create new order: incomplete tasks first, then completed tasks
      const reorderedTasks = [...incompleteTasks, ...completedTasks];
      
      // Generate new fractional positions for the reordered sequence
      const newPositions = FractionalOrderingService.generateSequence(reorderedTasks.length);
      
      const batch = writeBatch(db);
      
      // Update orderString for each task that needs repositioning
      reorderedTasks.forEach((task, index) => {
        const newOrderString = newPositions[index];
        // Only update tasks that actually changed position
        if (task.orderString !== newOrderString) {
          const taskRef = doc(db, 'tasks', task.id);
          batch.update(taskRef, { 
            orderString: newOrderString,
            updatedAt: new Date()
          });
          console.log(`📍 ${task.title} -> ${newOrderString}`);
        }
      });
      
      await batch.commit();
      console.log('✅ Successfully moved completed tasks down');
      set({ showDetailsMenu: false });
    } catch (error) {
      console.error('Error moving completed tasks:', error);
      throw error;
    }
  },
  
  handleArchiveCompleted: async () => {
    try {
      const { tasks } = get();
      const completedTasks = tasks.filter(t => t.completed);
      const batch = writeBatch(db);
      
      // Update completed tasks to be hidden from Pomodoro page
      completedTasks.forEach(task => {
        const taskRef = doc(db, 'tasks', task.id);
        batch.update(taskRef, { 
          hideFromPomodoro: true,
          updatedAt: new Date()
        });
      });
      
      await batch.commit();
      set({ showDetailsMenu: false });
    } catch (error) {
      console.error('Error archiving completed tasks:', error);
      throw error;
    }
  },

  // Utility function to clean up orphaned work sessions
  cleanupOrphanedWorkSessions: async () => {
    try {
      const { user } = useUserStore.getState();
      const { tasks } = get();
      
      if (!user) throw new Error('No user found');

      console.log('🧹 Starting cleanup of orphaned work sessions...');
      
      // Get all work sessions for the user
      const allWorkSessions = await workSessionService.getRecentWorkSessions(user.uid, 1000);
      console.log(`Found ${allWorkSessions.length} total work sessions`);
      
      // Get all current task IDs
      const currentTaskIds = new Set(tasks.map(task => task.id));
      console.log(`Found ${currentTaskIds.size} current tasks`);
      
      // Find orphaned work sessions (sessions with taskIds that don't exist anymore)
      const orphanedSessions = allWorkSessions.filter(session => 
        !currentTaskIds.has(session.taskId)
      );
      
      console.log(`Found ${orphanedSessions.length} orphaned work sessions to delete`);
      
      if (orphanedSessions.length === 0) {
        console.log('✅ No orphaned work sessions found');
        return { deletedCount: 0, orphanedSessions: [] };
      }
      
      // Delete orphaned work sessions
      const deletePromises = orphanedSessions.map(session => 
        workSessionService.deleteWorkSession(session.id)
      );
      
      await Promise.all(deletePromises);
      
      console.log(`✅ Successfully deleted ${orphanedSessions.length} orphaned work sessions`);
      
      return { 
        deletedCount: orphanedSessions.length, 
        orphanedSessions: orphanedSessions.map(s => ({ 
          id: s.id, 
          taskId: s.taskId, 
          duration: s.duration, 
          date: s.date 
        }))
      };
    } catch (error) {
      console.error('Error cleaning up orphaned work sessions:', error);
      throw error;
    }
  },

  // Find next task with 'pomodoro' status after current task
  getNextPomodoroTask: (currentTaskId: string): Task | null => {
    const { tasks } = get();
    
    // Get all pomodoro tasks after the current task (by order)
    const pomodoroTasks = sortTasksByOrder(
      tasks.filter(task => task.status === 'pomodoro' && !task.completed && !task.hideFromPomodoro)
    );
    
    console.log('Finding next Pomodoro task:', {
      currentTaskId,
      allPomodoroTasks: pomodoroTasks.map(t => ({ id: t.id, title: t.title, order: t.order }))
    });
    
    // Find current task position in pomodoro list
    const currentPomodoroIndex = pomodoroTasks.findIndex(t => t.id === currentTaskId);
    const nextTask = currentPomodoroIndex >= 0 && currentPomodoroIndex < pomodoroTasks.length - 1
      ? pomodoroTasks[currentPomodoroIndex + 1]
      : null;
    
    console.log('Next task result:', {
      currentIndex: currentPomodoroIndex,
      nextTask: nextTask ? { id: nextTask.id, title: nextTask.title } : null
    });
    
    // Return next task in pomodoro list, or null if none available
    return nextTask;
  },

  reorderColumns: (newOrder: Task['status'][]) => {
    set({ columnOrder: newOrder });
    // Persist to localStorage for user preference
    localStorage.setItem('taskColumnOrder', JSON.stringify(newOrder));
  },

  reorderProjectColumns: (newOrder: string[]) => {
    set({ projectColumnOrder: newOrder });
    // Persist to localStorage for user preference
    localStorage.setItem('projectColumnOrder', JSON.stringify(newOrder));
  },
}));

// Subscribe to user authentication changes
useUserStore.subscribe((state) => {
  const taskStore = useTaskStore.getState();
  
  // CRITICAL: Only react to auth changes after user store is initialized
  // This prevents cleanup during Firebase auth restoration on page reload
  if (!state.isInitialized) {
    console.log('TaskStore - User store not initialized yet, waiting...');
    return;
  }
  
  console.log('TaskStore - User state changed:', {
    isAuthenticated: state.isAuthenticated,
    hasUser: !!state.user,
    isInitialized: state.isInitialized
  });
  
  if (state.isAuthenticated && state.user) {
    // User logged in, initialize task store
    console.log('TaskStore - User authenticated, initializing...');
    taskStore.initializeStore();
  } else {
    // User logged out, cleanup and reset
    console.log('TaskStore - User not authenticated, cleaning up...');
    taskStore.cleanupListeners();
  }
});