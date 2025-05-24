import { create } from 'zustand';
import type { Task, Project } from '../types/models';

// Mock data for initial state
const MOCK_PROJECTS: Project[] = [
  { id: 'website', name: 'Website Redesign', color: '#4f46e5' },
  { id: 'mobile', name: 'Mobile App Redesign', color: '#10b981' },
  { id: 'marketing', name: 'Marketing Campaign', color: '#f59e0b' },
  { id: 'personal', name: 'Personal Development', color: '#ef4444' }
];

const MOCK_TASKS: Task[] = [
  {
    id: '1',
    title: 'Create wireframes for homepage',
    description: 'Design and create detailed wireframes for the homepage layout, including responsive versions for desktop and mobile devices. Focus on user experience and clear content hierarchy.',
    projectId: 'website',
    completed: false,
    status: 'pomodoro', // Task in Pomodoro
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
    status: 'todo', // Task in Todo
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
    status: 'todo', // Task in Todo
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
    status: 'todo', // Task in Todo
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
    status: 'pomodoro', // Task in Pomodoro
    timeSpent: 20,
    timeEstimated: 60,
    order: 4,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '6',
    title: 'Initial project planning meeting',
    description: 'Kickoff meeting with the development team to discuss project scope, timeline, resource allocation, and initial technical requirements.',
    projectId: 'mobile',
    completed: true,
    status: 'completed', // Task completed
    timeSpent: 60,
    timeEstimated: 60,
    order: 5,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '7',
    title: 'Define campaign goals and KPIs',
    description: 'Established clear campaign objectives, success metrics, and key performance indicators. Created tracking framework and reporting templates.',
    projectId: 'marketing',
    completed: true,
    status: 'completed', // Task completed
    timeSpent: 90,
    timeEstimated: 90,
    order: 6,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '8',
    title: 'Design email newsletter templates',
    description: 'Created responsive email newsletter templates that align with brand guidelines. Included multiple layouts for different content types.',
    projectId: 'marketing',
    completed: true,
    status: 'completed', // Task completed
    timeSpent: 75,
    timeEstimated: 120,
    order: 7,
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
  updateTaskStatus: (id: string, status: Task['status']) => void;
  reorderTasks: (taskId: string, newOrder: number) => void;
  setIsAddingTask: (isAdding: boolean) => void;
  setEditingTaskId: (taskId: string | null) => void;
  addProject: (project: Omit<Project, 'id'>) => string;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: MOCK_TASKS,
  projects: MOCK_PROJECTS,
  isAddingTask: false,
  editingTaskId: null,
  
  addProject: (projectData) => {
    const newProjectId = `project-${Date.now()}`;
    const newProject: Project = {
      id: newProjectId,
      ...projectData
    };
    
    set(state => ({
      projects: [...state.projects, newProject]
    }));
    
    return newProjectId;
  },
  
  addTask: (taskData) => {
    const { tasks } = get();
    const newTaskId = Date.now().toString();
    
    // Find the highest order among all tasks to place new task at the end
    const maxOrder = tasks.length > 0 ? Math.max(...tasks.map(t => t.order)) : -1;
    
    const newTask: Task = {
      id: newTaskId,
      ...taskData,
      order: maxOrder + 1,
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
    const { tasks } = get();
    const taskIndex = tasks.findIndex(task => task.id === id);
    
    if (taskIndex === -1) return;
    
    const task = tasks[taskIndex];
    const completed = !task.completed;
    // Update status to 'completed' when task is marked as complete
    // or to 'todo' when unmarked
    const status = completed ? 'completed' : 'todo';
    
    // Calculate new order if the task is being marked as incomplete (from completed)
    let newOrder = task.order;
    if (task.status === 'completed' && !completed) {
      // Find the highest order number among todo tasks
      const todoTasks = tasks.filter(t => t.status === 'todo');
      newOrder = todoTasks.length > 0 
        ? Math.max(...todoTasks.map(t => t.order)) + 1 
        : 0;
    }
    
    set(state => ({
      tasks: state.tasks.map(t => {
        if (t.id !== id) return t;
        
        return { 
          ...t, 
          completed, 
          status,
          order: newOrder,
          updatedAt: new Date() 
        };
      })
    }));
  },
  
  updateTaskStatus: (id, status) => {
    const { tasks } = get();
    const taskIndex = tasks.findIndex(task => task.id === id);
    
    if (taskIndex === -1) return;
    
    const task = tasks[taskIndex];
    
    // If status is completed, also mark completed flag as true
    // If moving from completed, mark as not completed
    const completed = status === 'completed' ? true : 
                     (task.status === 'completed' ? false : task.completed);
    
    // Calculate new order if the task is being moved from completed to todo
    let newOrder = task.order;
    if (task.status === 'completed' && status === 'todo') {
      // Find the highest order number among todo tasks
      const todoTasks = tasks.filter(t => t.status === 'todo');
      newOrder = todoTasks.length > 0 
        ? Math.max(...todoTasks.map(t => t.order)) + 1 
        : 0;
    }
    
    set(state => ({
      tasks: state.tasks.map(t => {
        if (t.id !== id) return t;
        
        return { 
          ...t, 
          status,
          completed,
          order: newOrder,
          updatedAt: new Date() 
        };
      })
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