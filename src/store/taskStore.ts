import { create } from 'zustand';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, orderBy, where, writeBatch, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../api/firebase';
import { useUserStore } from './userStore';
import type { Task, Project } from '../types/models';
import { trackTaskCreated, trackTaskCompleted, trackProjectCreated } from '../utils/analytics';
import { workSessionService } from '../api/workSessionService';

interface TaskState {
  tasks: Task[];
  projects: Project[];
  isAddingTask: boolean;
  editingTaskId: string | null;
  showDetailsMenu: boolean;
  isLoading: boolean;
  unsubscribe: (() => void) | null;
  
  // Actions
  initializeStore: () => Promise<void>;
  addTask: (taskData: Omit<Task, 'id' | 'order' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateTask: (taskId: string, taskData: Partial<Task>) => Promise<void>;
  updateTaskLocally: (taskIdx: number, updates: Partial<Task>) => void;
  deleteTask: (id: string) => Promise<void>;
  toggleTaskCompletion: (taskId: string, context?: string) => Promise<Task | null>;
  updateTaskStatus: (taskId: string, status: Task['status']) => Promise<void>;
  reorderTasks: (taskId: string, newIndex: number) => Promise<void>;
  moveTaskToStatusAndPosition: (taskId: string, newStatus: Task['status'], targetIndex: number) => Promise<void>;
  setIsAddingTask: (isAdding: boolean) => void;
  setEditingTaskId: (taskId: string | null) => void;
  setShowDetailsMenu: (show: boolean) => void;
  addProject: (project: Omit<Project, 'id' | 'userId'>) => Promise<string>;
  updateProject: (projectId: string, updates: Partial<Omit<Project, 'id' | 'userId'>>) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  timeSpentIncrement: (id: string, increment: number) => Promise<void>;
  handleMoveCompletedDown: () => Promise<void>;
  handleArchiveCompleted: () => Promise<void>;
  cleanupListeners: () => void;
  cleanupOrphanedWorkSessions: () => Promise<{ deletedCount: number; orphanedSessions: { id: string; taskId: string; duration: number; date: string; }[]; }>;
  getNextPomodoroTask: (currentTaskId: string) => Task | null;
}

const tasksCollection = collection(db, 'tasks');
const projectsCollection = collection(db, 'projects');

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  projects: [],
  isAddingTask: false,
  editingTaskId: null,
  showDetailsMenu: false,
  isLoading: false,
  unsubscribe: null,

  initializeStore: async () => {
    const { user, isAuthenticated } = useUserStore.getState();
    
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
    const tasksQuery = query(
      tasksCollection, 
      where('userId', '==', user.uid),
      orderBy('order', 'asc')
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
      console.log(`Fetched ${fetchedTasks.length} tasks for user ${user.uid}`);
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

      // Delete all work sessions for each task first
      if (taskIds.length > 0) {
        try {
          for (const taskId of taskIds) {
            const workSessions = await workSessionService.getWorkSessionsByTask(user.uid, taskId);
            console.log(`📋 Found ${workSessions.length} work sessions for task ${taskId}`);
            
            if (workSessions.length > 0) {
              const deletePromises = workSessions.map(session => 
                workSessionService.deleteWorkSession(session.id)
              );
              await Promise.all(deletePromises);
              console.log(`✅ Deleted ${workSessions.length} work sessions for task ${taskId}`);
            }
          }
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
      const { user } = useUserStore.getState();
      if (!user) throw new Error('No user found');
      console.log('User found:', user.uid);
      
      const tasksRef = collection(db, 'tasks');
      const { tasks } = get();
      console.log('Current tasks count:', tasks.length);
      
      // Add task with next order number (find max order + 1)
      const maxOrder = tasks.length > 0 ? Math.max(...tasks.map(t => t.order || 0)) : -1;
      const newTask = {
        ...taskData,
        userId: user.uid,
        order: maxOrder + 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Fire and forget - don't wait for addDoc to complete since it hangs
      // The real-time listener will update the UI when the task is created
      const docRef = await addDoc(tasksRef, newTask);
      console.log('Firestore addDoc completed, docRef:', docRef.id);
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
              await useSyncStore.getState().syncTask(docRef.id);
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
      return docRef.id; // Return the new task ID
    } catch (error) {
      console.error('Error adding task:', error);
      throw error;
    }
  },
  
  updateTask: async (id, updates) => {
    try {
      const { user } = useUserStore.getState();
      if (!user) throw new Error('No user found');

      // Get the current task to check for projectId changes
      const { tasks } = get();
      const currentTask = tasks.find(t => t.id === id);
      
      // Check if projectId is being updated
      const isProjectIdChanging = updates.projectId && currentTask && updates.projectId !== currentTask.projectId;
      
      // Filter out undefined values to prevent Firebase errors
      const filteredUpdates = Object.fromEntries(
        Object.entries(updates).filter(([_, value]) => value !== undefined)
      );

      // Update the task
      const taskRef = doc(db, 'tasks', id);
      await updateDoc(taskRef, {
        ...filteredUpdates,
        updatedAt: new Date()
      });

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

      // Auto-sync task to Google Calendar if it has scheduling information
      const updatedTask = { ...currentTask, ...updates };
      if (updatedTask.scheduledDate) {
        try {
          console.log('🔄 Auto-syncing updated task to Google Calendar...');
          const { useSyncStore } = await import('./syncStore');
          await useSyncStore.getState().syncTask(id);
          console.log('✅ Task update auto-synced to Google Calendar');
        } catch (syncError) {
          console.error('❌ Failed to auto-sync updated task to Google Calendar:', syncError);
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

      // First delete all related work sessions for this task
      try {
        const workSessions = await workSessionService.getWorkSessionsByTask(user.uid, id);
        console.log(`📋 Found ${workSessions.length} work sessions for task ${id}`);
        
        if (workSessions.length > 0) {
          // Delete each work session
          const deletePromises = workSessions.map(async (session) => {
            console.log(`🗑️ Deleting work session: ${session.id}`);
            return workSessionService.deleteWorkSession(session.id);
          });
          
          await Promise.all(deletePromises);
          console.log(`✅ Successfully deleted ${workSessions.length} work sessions for task ${id}`);
        } else {
          console.log(`ℹ️ No work sessions found for task ${id}`);
        }
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
            await timerState.setCurrentTask(null);
          }
        }
      }
      
      // Keep the original order when unchecking
      const taskRef = doc(db, 'tasks', id);
      await updateDoc(taskRef, {
        completed,
        status,
        updatedAt: new Date()
      });
      
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
  
  reorderTasks: async (taskId, newIndex) => {
    try {
      const { tasks } = get();
      const taskIndex = tasks.findIndex(t => t.id === taskId);
      
      if (taskIndex === -1) return;
      
      const updatedTasks = [...tasks];
      const [movedTask] = updatedTasks.splice(taskIndex, 1);
      updatedTasks.splice(newIndex, 0, movedTask);
      
      // Update order property for all tasks in Firestore
      const updatePromises = updatedTasks.map(async (task, index) => {
        const taskRef = doc(db, 'tasks', task.id);
        return updateDoc(taskRef, {
          order: index,
          updatedAt: task.id === taskId ? new Date() : task.updatedAt
        });
      });
      
      await Promise.all(updatePromises);
    } catch (error) {
      console.error('Error reordering tasks:', error);
      throw error;
    }
  },

  moveTaskToStatusAndPosition: async (taskId, newStatus, targetIndex) => {
    try {
      const { tasks } = get();
      const taskIndex = tasks.findIndex(t => t.id === taskId);
      
      if (taskIndex === -1) return;
      
      const task = tasks[taskIndex];
      const completed = newStatus === 'completed' ? true : 
                       (task.status === 'completed' ? false : task.completed);
      
      // Create a copy of tasks and update the task with new status
      const updatedTasks = [...tasks];
      updatedTasks[taskIndex] = {
        ...task,
        status: newStatus,
        completed,
        hideFromPomodoro: newStatus === 'pomodoro' ? false : task.hideFromPomodoro
      };
      
      // Remove the task from its current position
      const [movedTask] = updatedTasks.splice(taskIndex, 1);
      
      // Adjust target index if the moved task was before the target position
      const adjustedTargetIndex = taskIndex < targetIndex ? targetIndex - 1 : targetIndex;
      
      // Insert at the adjusted target position
      updatedTasks.splice(adjustedTargetIndex, 0, movedTask);
      
      // Optimized: Only update tasks that actually changed position or status
      const tasksToUpdate = [];
      
      // Always update the moved task (status + position change)
      const movedTaskRef = doc(db, 'tasks', taskId);
      tasksToUpdate.push(
        updateDoc(movedTaskRef, {
          status: newStatus,
          completed,
          hideFromPomodoro: newStatus === 'pomodoro' ? false : task.hideFromPomodoro,
          order: adjustedTargetIndex,
          updatedAt: new Date()
        })
      );
      
      // Only update tasks whose order actually changed
      const originalTasks = tasks;
      for (let i = 0; i < updatedTasks.length; i++) {
        const currentTask = updatedTasks[i];
        const originalTask = originalTasks.find(t => t.id === currentTask.id);
        
        // Skip the moved task (already handled above) and tasks with unchanged order
        if (currentTask.id === taskId || !originalTask || originalTask.order === i) {
          continue;
        }
        
        const taskRef = doc(db, 'tasks', currentTask.id);
        tasksToUpdate.push(
          updateDoc(taskRef, {
            order: i,
            updatedAt: new Date()
          })
        );
      }
      
      // Execute only necessary updates
      await Promise.all(tasksToUpdate);
    } catch (error) {
      console.error('Error moving task to status and position:', error);
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
    const newTimeSpent = task.timeSpent + increment;
    if (newTimeSpent < 0) {
      console.error('Time spent cannot be negative');
      throw new Error('Time spent cannot be negative');
    }
    try {
      // Update the main task timeSpent field
      const taskRef = doc(db, 'tasks', id);
      await updateDoc(taskRef, {
        timeSpent: newTimeSpent,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error incrementing time spent:', error);
      throw error;
    }
  },
  
  setIsAddingTask: (isAdding) => set({ isAddingTask: isAdding }),
  
  setEditingTaskId: (taskId) => set({ editingTaskId: taskId }),
  
  setShowDetailsMenu: (show) => set({ showDetailsMenu: show }),
  
  handleMoveCompletedDown: async () => {
    try {
      const { tasks } = get();
      const completedTasks = tasks.filter(t => t.completed);
      const incompleteTasks = tasks.filter(t => !t.completed);
      
      // Update order of tasks
      const updatedTasks = [...incompleteTasks, ...completedTasks];
      const batch = writeBatch(db);
      
      // Update order for each task
      updatedTasks.forEach((task, index) => {
        const taskRef = doc(db, 'tasks', task.id);
        batch.update(taskRef, { order: index });
      });
      
      await batch.commit();
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
    const pomodoroTasks = tasks
      .filter(task => task.status === 'pomodoro' && !task.completed && !task.hideFromPomodoro)
      .sort((a, b) => a.order - b.order);
    
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