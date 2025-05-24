import { create } from 'zustand';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { db } from '../api/firebase';
import { useUserStore } from './userStore';
import type { Task, Project } from '../types/models';

interface TaskState {
  tasks: Task[];
  projects: Project[];
  isAddingTask: boolean;
  editingTaskId: string | null;
  isLoading: boolean;
  unsubscribeTasks: (() => void) | null;
  unsubscribeProjects: (() => void) | null;
  
  // Actions
  initializeStore: () => void;
  cleanupListeners: () => void;
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'order' | 'userId'>) => Promise<string>;
  updateTask: (id: string, updates: Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  toggleTaskCompletion: (id: string) => Promise<void>;
  updateTaskStatus: (id: string, status: Task['status']) => Promise<void>;
  reorderTasks: (taskId: string, newOrder: number) => Promise<void>;
  setIsAddingTask: (isAdding: boolean) => void;
  setEditingTaskId: (taskId: string | null) => void;
  addProject: (project: Omit<Project, 'id' | 'userId'>) => Promise<string>;
}

const tasksCollection = collection(db, 'tasks');
const projectsCollection = collection(db, 'projects');

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  projects: [],
  isAddingTask: false,
  editingTaskId: null,
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
      
      const docRef = await addDoc(projectsCollection, newProject);
      return docRef.id;
    } catch (error) {
      console.error('Error adding project:', error);
      throw error;
    }
  },
  
  addTask: async (taskData) => {
    try {
      const { user } = useUserStore.getState();
      const { tasks } = get();
      
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      const maxOrder = tasks.length > 0 ? Math.max(...tasks.map(t => t.order)) : -1;
      
      const newTask = {
        ...taskData,
        userId: user.uid,
        order: maxOrder + 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const docRef = await addDoc(tasksCollection, newTask);
      
      set(state => ({ isAddingTask: false }));
      
      return docRef.id;
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
      const status = completed ? 'completed' : 'todo';
      
      let newOrder = task.order;
      if (task.status === 'completed' && !completed) {
        const todoTasks = tasks.filter(t => t.status === 'todo');
        newOrder = todoTasks.length > 0 
          ? Math.max(...todoTasks.map(t => t.order)) + 1 
          : 0;
      }
      
      const taskRef = doc(db, 'tasks', id);
      await updateDoc(taskRef, {
        completed,
        status,
        order: newOrder,
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
      
      let newOrder = task.order;
      if (task.status === 'completed' && status === 'todo') {
        const todoTasks = tasks.filter(t => t.status === 'todo');
        newOrder = todoTasks.length > 0 
          ? Math.max(...todoTasks.map(t => t.order)) + 1 
          : 0;
      }
      
      const taskRef = doc(db, 'tasks', id);
      await updateDoc(taskRef, {
        status,
        completed,
        order: newOrder,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating task status:', error);
      throw error;
    }
  },
  
  reorderTasks: async (taskId, newOrder) => {
    try {
      const { tasks } = get();
      const taskIndex = tasks.findIndex(t => t.id === taskId);
      
      if (taskIndex === -1) return;
      
      const updatedTasks = [...tasks];
      const [movedTask] = updatedTasks.splice(taskIndex, 1);
      updatedTasks.splice(newOrder, 0, movedTask);
      
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
  
  setIsAddingTask: (isAdding) => set({ isAddingTask: isAdding }),
  
  setEditingTaskId: (taskId) => set({ editingTaskId: taskId })
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