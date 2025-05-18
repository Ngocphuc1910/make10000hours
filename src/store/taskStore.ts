import { create } from 'zustand';
import type { Task, Project } from '../types/models';

// Mock data for initial state
const MOCK_PROJECTS: Project[] = [
  { id: 'website', name: 'Website Redesign' },
  { id: 'mobile', name: 'Mobile App Redesign' },
  { id: 'marketing', name: 'Marketing Campaign' },
  { id: 'personal', name: 'Personal Development' }
];

const MOCK_TASKS: Task[] = [
  {
    id: '1',
    title: 'Create wireframes for homepage',
    description: 'Design and create detailed wireframes for the homepage layout, including responsive versions for desktop and mobile devices. Focus on user experience and clear content hierarchy.',
    projectId: 'website',
    completed: false,
    timeSpent: 30,
    timeEstimated: 70,
    order: 0,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '2',
    title: 'Design system components',
    description: 'Create a comprehensive design system including color palette, typography, spacing guidelines, and reusable components. Ensure consistency across all UI elements and prepare documentation for the development team.',
    projectId: 'mobile',
    completed: false,
    timeSpent: 45,
    timeEstimated: 90,
    order: 1,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '3',
    title: 'User research interviews',
    description: 'Conduct user interviews to gather feedback on the new dashboard interface. Prepare questions, schedule sessions, and document findings for the design team.',
    projectId: 'mobile',
    completed: false,
    timeSpent: 0,
    timeEstimated: 120,
    order: 2,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '4',
    title: 'Define app requirements and features',
    description: 'Document detailed requirements and feature specifications for the mobile app, including user stories, functional requirements, and technical specifications.',
    projectId: 'mobile',
    completed: false,
    timeSpent: 45,
    timeEstimated: 90,
    order: 3,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '5',
    title: 'Research competitor apps',
    description: 'Analyze competitor mobile applications to identify market trends, feature sets, and user experience patterns. Create a comprehensive report highlighting opportunities and potential differentiators.',
    projectId: 'mobile',
    completed: false,
    timeSpent: 20,
    timeEstimated: 60,
    order: 4,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

interface TaskState {
  tasks: Task[];
  projects: Project[];
  isAddingTask: boolean;
  editingTaskId: string | null;
  
  // Actions
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'order'>) => string;
  updateTask: (id: string, updates: Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>>) => void;
  deleteTask: (id: string) => void;
  toggleTaskCompletion: (id: string) => void;
  reorderTasks: (taskId: string, newOrder: number) => void;
  setIsAddingTask: (isAdding: boolean) => void;
  setEditingTaskId: (taskId: string | null) => void;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: MOCK_TASKS,
  projects: MOCK_PROJECTS,
  isAddingTask: false,
  editingTaskId: null,
  
  addTask: (taskData) => {
    const { tasks } = get();
    const newTaskId = Date.now().toString();
    const newTask: Task = {
      id: newTaskId,
      ...taskData,
      order: tasks.length,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    set(state => ({
      tasks: [...state.tasks, newTask],
      isAddingTask: false
    }));
    
    return newTaskId;
  },
  
  updateTask: (id, updates) => {
    set(state => ({
      tasks: state.tasks.map(task => 
        task.id === id 
          ? { ...task, ...updates, updatedAt: new Date() } 
          : task
      ),
      editingTaskId: null
    }));
  },
  
  deleteTask: (id) => {
    set(state => ({
      tasks: state.tasks.filter(task => task.id !== id)
    }));
  },
  
  toggleTaskCompletion: (id) => {
    set(state => ({
      tasks: state.tasks.map(task => 
        task.id === id 
          ? { ...task, completed: !task.completed, updatedAt: new Date() } 
          : task
      )
    }));
  },
  
  reorderTasks: (taskId, newOrder) => {
    const { tasks } = get();
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    
    if (taskIndex === -1) return;
    
    const updatedTasks = [...tasks];
    const [movedTask] = updatedTasks.splice(taskIndex, 1);
    updatedTasks.splice(newOrder, 0, movedTask);
    
    // Update order property for all tasks
    const tasksWithUpdatedOrder = updatedTasks.map((task, index) => ({
      ...task,
      order: index,
      updatedAt: task.id === taskId ? new Date() : task.updatedAt
    }));
    
    set({ tasks: tasksWithUpdatedOrder });
  },
  
  setIsAddingTask: (isAdding) => set({ isAddingTask: isAdding }),
  
  setEditingTaskId: (taskId) => set({ editingTaskId: taskId })
})); 