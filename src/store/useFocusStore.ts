import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { 
  User, 
  FocusSession, 
  Project, 
  Task, 
  FocusStreak,
  DateRange,
  TimeUnit
} from '../types';

// Generate mock data
import { generateMockData } from './mockData';

interface FocusState {
  user: User;
  focusSessions: FocusSession[];
  projects: Project[];
  tasks: Task[];
  focusStreak: FocusStreak;
  dateRange: DateRange;
  timeUnit: TimeUnit;
  selectedDate: Date | null;
  
  // Getters
  getTotalFocusTime: () => number;
  getAverageDailyFocusTime: () => number;
  getProjectById: (id: string) => Project | undefined;
  getTaskById: (id: string) => Task | undefined;
  getTasksByProjectId: (projectId: string) => Task[];
  getFocusSessionsByDateRange: (range: DateRange) => FocusSession[];
  getTasksByDate: (date: Date) => Task[];
  
  // Actions
  setDateRange: (range: DateRange) => void;
  setTimeUnit: (unit: TimeUnit) => void;
  setSelectedDate: (date: Date | null) => void;
  addFocusSession: (session: Omit<FocusSession, 'id'>) => void;
  updateFocusSession: (id: string, sessionData: Partial<FocusSession>) => void;
  deleteFocusSession: (id: string) => void;
  addProject: (project: Omit<Project, 'id' | 'createdAt' | 'totalFocusTime'>) => void;
  updateProject: (id: string, projectData: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'totalFocusTime'>) => void;
  updateTask: (id: string, taskData: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  toggleTaskCompletion: (id: string) => void;
  resetStore: () => void;
}

// Get initial mock data
const initialData = generateMockData();

// Helper function to revive dates in objects
const reviveDates = (key: string, value: any): any => {
  // Check if the value is an ISO date string (simplified check)
  if (typeof value === 'string' && 
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
    return new Date(value);
  }
  
  // Handle date objects in the FocusStreak.streakDates array
  if (key === 'streakDates' && Array.isArray(value)) {
    return value.map(item => ({
      ...item,
      date: item.date ? new Date(item.date) : item.date,
    }));
  }
  
  // For all other cases, including dates already parsed
  return value;
};

// Custom storage with date parsing
const customStorage = {
  getItem: (name: string): string | null => {
    const str = localStorage.getItem(name);
    if (!str) return str;
    
    try {
      // Parse the JSON with a reviver function to convert date strings to Date objects
      const parsed = JSON.parse(str, reviveDates);
      return JSON.stringify(parsed);
    } catch (e) {
      console.error('Error parsing stored state:', e);
      return str;
    }
  },
  setItem: (name: string, value: string): void => {
    localStorage.setItem(name, value);
  },
  removeItem: (name: string): void => {
    localStorage.removeItem(name);
  }
};

// Create store with persistence
export const useFocusStore = create<FocusState>()(
  persist(
    (set, get) => ({
      user: initialData.user,
      focusSessions: initialData.focusSessions,
      projects: initialData.projects,
      tasks: initialData.tasks,
      focusStreak: initialData.focusStreak,
      dateRange: {
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        endDate: new Date(),
        label: 'Last 7 Days'
      },
      timeUnit: 'daily' as TimeUnit,
      selectedDate: null,
      
      // Getters
      getTotalFocusTime: () => {
        return get().focusSessions.reduce((total, session) => total + session.duration, 0);
      },
      
      getAverageDailyFocusTime: () => {
        const sessions = get().focusSessions;
        if (sessions.length === 0) return 0;
        
        const totalMinutes = sessions.reduce((total, session) => total + session.duration, 0);
        
        // Get unique days
        const uniqueDays = new Set(
          sessions.map(session => new Date(session.startTime).toDateString())
        );
        
        return totalMinutes / uniqueDays.size;
      },
      
      getProjectById: (id: string) => {
        return get().projects.find(project => project.id === id);
      },
      
      getTaskById: (id: string) => {
        return get().tasks.find(task => task.id === id);
      },
      
      getTasksByProjectId: (projectId: string) => {
        return get().tasks.filter(task => task.projectId === projectId);
      },
      
      getFocusSessionsByDateRange: (range: DateRange) => {
        return get().focusSessions.filter(session => {
          const sessionDate = new Date(session.startTime);
          return sessionDate >= range.startDate && sessionDate <= range.endDate;
        });
      },
      
      getTasksByDate: (date: Date) => {
        if (!date) return [];
        
        // Find all sessions on this date
        const dateStr = date.toDateString();
        
        // Find tasks used in sessions on this date
        const sessionsOnDate = get().focusSessions.filter(
          session => new Date(session.startTime).toDateString() === dateStr
        );
        
        const taskIdsOnDate = new Set(
          sessionsOnDate
            .filter(session => session.taskId) // Filter out sessions without a task
            .map(session => session.taskId) 
        );
        
        // Get tasks used on this date, sorted by focus time
        return get().tasks
          .filter(task => taskIdsOnDate.has(task.id))
          .sort((a, b) => {
            // Calculate total focus time for just this date
            const aTimeOnDate = sessionsOnDate
              .filter(s => s.taskId === a.id)
              .reduce((total, s) => total + s.duration, 0);
              
            const bTimeOnDate = sessionsOnDate
              .filter(s => s.taskId === b.id)
              .reduce((total, s) => total + s.duration, 0);
              
            return bTimeOnDate - aTimeOnDate;
          });
      },
      
      // Actions
      setDateRange: (range) => set({ dateRange: range }),
      
      setTimeUnit: (unit) => set({ timeUnit: unit }),
      
      setSelectedDate: (date) => set({ selectedDate: date }),
      
      addFocusSession: (sessionData) => {
        const id = `session-${Date.now()}`;
        const newSession = { id, ...sessionData };
        
        set(state => ({
          focusSessions: [...state.focusSessions, newSession]
        }));
        
        // Update project total time
        set(state => {
          const updatedProjects = state.projects.map(project => {
            if (project.id === sessionData.projectId) {
              return {
                ...project,
                totalFocusTime: project.totalFocusTime + sessionData.duration
              };
            }
            return project;
          });
          
          return { projects: updatedProjects };
        });
        
        // Update task total time if taskId is provided
        if (sessionData.taskId) {
          set(state => {
            const updatedTasks = state.tasks.map(task => {
              if (task.id === sessionData.taskId) {
                return {
                  ...task,
                  totalFocusTime: task.totalFocusTime + sessionData.duration
                };
              }
              return task;
            });
            
            return { tasks: updatedTasks };
          });
        }
      },
      
      updateFocusSession: (id, sessionData) => {
        set(state => ({
          focusSessions: state.focusSessions.map(session => 
            session.id === id ? { ...session, ...sessionData } : session
          )
        }));
      },
      
      deleteFocusSession: (id) => {
        set(state => ({
          focusSessions: state.focusSessions.filter(session => session.id !== id)
        }));
      },
      
      addProject: (projectData) => {
        const id = `project-${Date.now()}`;
        const newProject = { 
          id, 
          ...projectData, 
          totalFocusTime: 0, 
          createdAt: new Date() 
        };
        
        set(state => ({
          projects: [...state.projects, newProject]
        }));
      },
      
      updateProject: (id, projectData) => {
        set(state => ({
          projects: state.projects.map(project => 
            project.id === id ? { ...project, ...projectData } : project
          )
        }));
      },
      
      deleteProject: (id) => {
        set(state => ({
          projects: state.projects.filter(project => project.id !== id),
          tasks: state.tasks.filter(task => task.projectId !== id),
          focusSessions: state.focusSessions.filter(session => session.projectId !== id)
        }));
      },
      
      addTask: (taskData) => {
        const id = `task-${Date.now()}`;
        const newTask = { 
          id, 
          ...taskData, 
          totalFocusTime: 0, 
          createdAt: new Date() 
        };
        
        set(state => ({
          tasks: [...state.tasks, newTask]
        }));
      },
      
      updateTask: (id, taskData) => {
        set(state => ({
          tasks: state.tasks.map(task => 
            task.id === id ? { ...task, ...taskData } : task
          )
        }));
      },
      
      deleteTask: (id) => {
        set(state => ({
          tasks: state.tasks.filter(task => task.id !== id),
          focusSessions: state.focusSessions.filter(session => session.taskId !== id)
        }));
      },
      
      toggleTaskCompletion: (id) => {
        set(state => ({
          tasks: state.tasks.map(task => 
            task.id === id ? { ...task, isCompleted: !task.isCompleted } : task
          )
        }));
      },
      
      resetStore: () => {
        const freshData = generateMockData();
        set({
          user: freshData.user,
          focusSessions: freshData.focusSessions,
          projects: freshData.projects,
          tasks: freshData.tasks,
          focusStreak: freshData.focusStreak
        });
      }
    }),
    {
      name: 'focus-time-storage',
      storage: createJSONStorage(() => customStorage),
      partialize: (state) => ({
        user: state.user,
        focusSessions: state.focusSessions,
        projects: state.projects,
        tasks: state.tasks,
        focusStreak: state.focusStreak,
      }),
    }
  )
); 