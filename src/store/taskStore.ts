import { create } from 'zustand';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, onSnapshot, query, orderBy, where, writeBatch, setDoc } from 'firebase/firestore';
import { db } from '../api/firebase';
import { useUserStore } from './userStore';
import { workSessionService } from '../api/workSessionService';
import type { Task, Project } from '../types/models';

interface TaskState {
  tasks: Task[];
  projects: Project[];
  isAddingTask: boolean;
  editingTaskId: string | null;
  showDetailsMenu: boolean;
  isLoading: boolean;
  unsubscribeTasks: (() => void) | null;
  unsubscribeProjects: (() => void) | null;
  
  // Actions
  initializeStore: () => void;
  cleanupListeners: () => void;
  addTask: (taskData: Omit<Task, 'id' | 'order' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateTask: (taskId: string, taskData: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  toggleTaskCompletion: (taskId: string) => Promise<void>;
  updateTaskStatus: (taskId: string, status: Task['status']) => Promise<void>;
  reorderTasks: (taskId: string, newIndex: number) => Promise<void>;
  setIsAddingTask: (isAdding: boolean) => void;
  setEditingTaskId: (taskId: string | null) => void;
  setShowDetailsMenu: (show: boolean) => void;
  addProject: (project: Omit<Project, 'id' | 'userId'>) => Promise<string>;
  deleteProject: (projectId: string) => Promise<void>;
  timeSpentIncrement: (id: string, increment: number) => Promise<void>;
  handleMoveCompletedDown: () => Promise<void>;
  handleArchiveCompleted: () => Promise<void>;
  
  // New function to get tasks with calculated timeSpent from WorkSessions
  getTasksWithCalculatedTime: () => Promise<Task[]>;
}

const tasksCollection = collection(db, 'tasks');
const projectsCollection = collection(db, 'projects');

// Helper function to calculate timeSpent from WorkSession data
const calculateTimeSpentFromSessions = async (taskId: string, userId: string): Promise<number> => {
  try {
    const sessions = await workSessionService.getWorkSessionsByTask(userId, taskId);
    return sessions.reduce((total, session) => total + session.duration, 0);
  } catch (error) {
    console.error('Error calculating time spent from sessions:', error);
    return 0; // Return 0 if we can't calculate from sessions
  }
};

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  projects: [],
  isAddingTask: false,
  editingTaskId: null,
  showDetailsMenu: false,
  isLoading: false,
  unsubscribeTasks: null,
  unsubscribeProjects: null,

  initializeStore: () => {
    const { user, isAuthenticated } = useUserStore.getState();
    
    if (!isAuthenticated || !user) {
      set({ tasks: [], projects: [], isLoading: false });
      return;
    }

    set({ isLoading: true });
    
    // Clean up existing listeners
    get().cleanupListeners();
    
    // Listen to user's tasks collection
    const tasksQuery = query(
      tasksCollection, 
      where('userId', '==', user.uid),
      orderBy('order', 'asc')
    );
    
    const unsubTasks = onSnapshot(tasksQuery, (snapshot) => {
      const tasks = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date()
      })) as Task[];
      
      set({ tasks, isLoading: false });
    });

    // Listen to user's projects collection
    const projectsQuery = query(
      projectsCollection,
      where('userId', '==', user.uid)
    );
    
    const unsubProjects = onSnapshot(projectsQuery, (snapshot) => {
      const projects = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Project[];
      
      set({ projects });
    });
    
    set({ 
      unsubscribeTasks: unsubTasks,
      unsubscribeProjects: unsubProjects 
    });
  },

  cleanupListeners: () => {
    const { unsubscribeTasks, unsubscribeProjects } = get();
    
    if (unsubscribeTasks) {
      unsubscribeTasks();
      set({ unsubscribeTasks: null });
    }
    
    if (unsubscribeProjects) {
      unsubscribeProjects();
      set({ unsubscribeProjects: null });
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
      return docRef.id;
    } catch (error) {
      console.error('Error adding project:', error);
      throw error;
    }
  },
  
  deleteProject: async (projectId) => {
    try {
      const { user } = useUserStore.getState();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Delete all tasks associated with the project first
      const tasksQuery = query(
        tasksCollection,
        where('userId', '==', user.uid),
        where('projectId', '==', projectId)
      );

      const tasksSnapshot = await getDocs(tasksQuery);
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
    } catch (error) {
      console.error('Error deleting project:', error);
      throw error;
    }
  },
  
  addTask: async (taskData) => {
    try {
      const { user } = useUserStore.getState();
      if (!user) throw new Error('No user found');
      
      const tasksRef = collection(db, 'tasks');
      const { tasks } = get();
      
      // Add task with next order number
      const newTask = {
        ...taskData,
        userId: user.uid,
        order: tasks.length,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await addDoc(tasksRef, newTask);
    } catch (error) {
      console.error('Error adding task:', error);
      throw error;
    }
  },
  
  updateTask: async (id, updates) => {
    try {
      const taskRef = doc(db, 'tasks', id);
      await updateDoc(taskRef, {
        ...updates,
        updatedAt: new Date()
      });
      
      set(state => ({ editingTaskId: null }));
    } catch (error) {
      console.error('Error updating task:', error);
      throw error;
    }
  },
  
  deleteTask: async (id) => {
    try {
      const taskRef = doc(db, 'tasks', id);
      await deleteDoc(taskRef);
    } catch (error) {
      console.error('Error deleting task:', error);
      throw error;
    }
  },
  
  toggleTaskCompletion: async (id) => {
    try {
      const { tasks } = get();
      const task = tasks.find(t => t.id === id);
      
      if (!task) return;
      
      const completed = !task.completed;
      const status = completed ? 'completed' : 'pomodoro';
      
      // Keep the original order when unchecking
      const taskRef = doc(db, 'tasks', id);
      await updateDoc(taskRef, {
        completed,
        status,
        updatedAt: new Date()
      });
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
      const updateData: any = {
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

      // Also track daily time spent for dashboard date filtering
      const { user } = useUserStore.getState();
      if (user) {
        const { dailyTimeSpentService } = await import('../api/dailyTimeSpentService');
        await dailyTimeSpentService.incrementTimeSpent(
          user.uid,
          task.id,
          task.projectId,
          increment
        );
      }
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

  getTasksWithCalculatedTime: async () => {
    const { tasks } = get();
    const calculatedTimeTasks = await Promise.all(tasks.map(async task => {
      const calculatedTime = await calculateTimeSpentFromSessions(task.id, task.userId);
      return {
        ...task,
        calculatedTime
      };
    }));
    return calculatedTimeTasks;
  },
}));

// Subscribe to user authentication changes
useUserStore.subscribe((state) => {
  const taskStore = useTaskStore.getState();
  
  if (state.isAuthenticated && state.user) {
    // User logged in, initialize task store
    taskStore.initializeStore();
  } else {
    // User logged out, cleanup and reset
    taskStore.cleanupListeners();
    useTaskStore.setState({ 
      tasks: [], 
      projects: [], 
      isLoading: false 
    });
  }
});