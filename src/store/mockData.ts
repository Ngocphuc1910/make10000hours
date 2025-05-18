import {
  User,
  FocusSession,
  Project,
  Task,
  FocusStreak
} from '../types';

// Helper to create a date X days ago
const daysAgo = (days: number): Date => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

// Helper to create a random time on a specific date
const randomTimeOnDate = (date: Date): Date => {
  const result = new Date(date);
  result.setHours(Math.floor(Math.random() * 14) + 8); // Between 8 AM and 10 PM
  result.setMinutes(Math.floor(Math.random() * 60));
  return result;
};

// Generate mock projects
const generateProjects = (): Project[] => {
  return [
    {
      id: 'project-1',
      userId: 'user-1',
      name: 'React Development',
      description: 'Learning and building with React',
      color: '#3B82F6', // blue
      totalFocusTime: 645, // 10h 45m
      createdAt: daysAgo(30),
      isActive: true
    },
    {
      id: 'project-2',
      userId: 'user-1',
      name: 'UI/UX Design',
      description: 'Improving my design skills',
      color: '#10B981', // green
      totalFocusTime: 420, // 7h
      createdAt: daysAgo(25),
      isActive: true
    },
    {
      id: 'project-3',
      userId: 'user-1',
      name: 'TypeScript',
      description: 'Mastering TypeScript',
      color: '#6366F1', // indigo
      totalFocusTime: 180, // 3h
      createdAt: daysAgo(15),
      isActive: true
    },
    {
      id: 'project-4',
      userId: 'user-1',
      name: 'Creative Writing',
      description: 'Writing short stories and blog posts',
      color: '#F59E0B', // amber
      totalFocusTime: 150, // 2h 30m
      createdAt: daysAgo(10),
      isActive: true
    }
  ];
};

// Generate mock tasks
const generateTasks = (projects: Project[]): Task[] => {
  const tasks: Task[] = [];
  
  // Project 1 tasks
  tasks.push(
    {
      id: 'task-1',
      userId: 'user-1',
      projectId: 'project-1',
      name: 'Build a TODO app with React',
      description: 'Create a simple TODO app to practice React fundamentals',
      isCompleted: true,
      totalFocusTime: 180, // 3h
      createdAt: daysAgo(28)
    },
    {
      id: 'task-2',
      userId: 'user-1',
      projectId: 'project-1',
      name: 'Learn React hooks',
      description: 'Study and practice using React hooks',
      isCompleted: true,
      totalFocusTime: 240, // 4h
      createdAt: daysAgo(20)
    },
    {
      id: 'task-3',
      userId: 'user-1',
      projectId: 'project-1',
      name: 'Implement state management with Context',
      description: 'Practice using React Context for state management',
      isCompleted: false,
      dueDate: daysAgo(-5), // 5 days from now
      totalFocusTime: 120, // 2h
      createdAt: daysAgo(15)
    },
    {
      id: 'task-4',
      userId: 'user-1',
      projectId: 'project-1',
      name: 'Optimize app performance',
      description: 'Identify and fix performance issues',
      isCompleted: false,
      dueDate: daysAgo(-7), // 7 days from now
      totalFocusTime: 105, // 1h 45m
      createdAt: daysAgo(10)
    }
  );
  
  // Project 2 tasks
  tasks.push(
    {
      id: 'task-5',
      userId: 'user-1',
      projectId: 'project-2',
      name: 'Study color theory',
      description: 'Learn principles of color theory and application',
      isCompleted: true,
      totalFocusTime: 150, // 2h 30m
      createdAt: daysAgo(24)
    },
    {
      id: 'task-6',
      userId: 'user-1',
      projectId: 'project-2',
      name: 'Create a design system',
      description: 'Develop a consistent design system',
      isCompleted: false,
      dueDate: daysAgo(-3), // 3 days from now
      totalFocusTime: 180, // 3h
      createdAt: daysAgo(20)
    },
    {
      id: 'task-7',
      userId: 'user-1',
      projectId: 'project-2',
      name: 'Practice Figma prototyping',
      description: 'Create interactive prototypes in Figma',
      isCompleted: false,
      totalFocusTime: 90, // 1h 30m
      createdAt: daysAgo(15)
    }
  );
  
  // Project 3 & 4 tasks
  tasks.push(
    {
      id: 'task-8',
      userId: 'user-1',
      projectId: 'project-3',
      name: 'Learn TypeScript generics',
      description: 'Master TypeScript generic types',
      isCompleted: false,
      totalFocusTime: 120, // 2h
      createdAt: daysAgo(14)
    },
    {
      id: 'task-9',
      userId: 'user-1',
      projectId: 'project-3',
      name: 'TypeScript with React',
      description: 'Practice using TypeScript with React',
      isCompleted: false,
      totalFocusTime: 60, // 1h
      createdAt: daysAgo(10)
    },
    {
      id: 'task-10',
      userId: 'user-1',
      projectId: 'project-4',
      name: 'Write a short story',
      description: 'Write a 2000-word short story',
      isCompleted: true,
      totalFocusTime: 150, // 2h 30m
      createdAt: daysAgo(9)
    }
  );
  
  return tasks;
};

// Generate mock focus sessions
const generateFocusSessions = (projects: Project[], tasks: Task[]): FocusSession[] => {
  const sessions: FocusSession[] = [];
  
  // Generate mock sessions for the last 14 days
  for (let day = 0; day < 14; day++) {
    // Skip some days to make data more realistic
    if (day === 2 || day === 6) continue;
    
    const date = daysAgo(day);
    const numSessions = Math.floor(Math.random() * 3) + 1; // 1-3 sessions per day
    
    for (let i = 0; i < numSessions; i++) {
      // Select random project and related task
      const projectIndex = Math.floor(Math.random() * projects.length);
      const project = projects[projectIndex];
      
      const projectTasks = tasks.filter(task => task.projectId === project.id);
      const task = projectTasks.length > 0 && Math.random() > 0.3
        ? projectTasks[Math.floor(Math.random() * projectTasks.length)]
        : null;
      
      // Create random duration between 30-120 minutes
      const duration = Math.floor(Math.random() * 90) + 30;
      
      // Create start and end times
      const startTime = randomTimeOnDate(date);
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + duration);
      
      sessions.push({
        id: `session-${sessions.length + 1}`,
        userId: 'user-1',
        projectId: project.id,
        taskId: task?.id,
        startTime,
        endTime,
        duration,
        notes: Math.random() > 0.7 ? 'Sample note for this session' : undefined
      });
    }
  }
  
  return sessions;
};

// Generate mock focus streak data
const generateFocusStreak = (): FocusStreak => {
  const streakDates = [];
  
  // Generate data for the last 30 days
  for (let i = 0; i < 30; i++) {
    const date = daysAgo(i);
    
    // Skip some random days (0 = today, 6 = 6 days ago)
    const hasFocused = !(i === 9 || i === 16 || i === 17 || i === 25 || i > 27);
    
    streakDates.push({
      date,
      hasFocused
    });
  }
  
  return {
    currentStreak: 5, // Mock 5 days current streak
    longestStreak: 12, // Mock 12 days longest streak
    totalFocusDays: 87, // Mock 87 total days with focus
    streakDates
  };
};

export const generateMockData = () => {
  const user: User = {
    id: 'user-1',
    name: 'John Doe',
    role: 'Product Manager',
    goalHours: 10000,
    weeklyGoalHours: 25
  };
  
  const projects = generateProjects();
  const tasks = generateTasks(projects);
  const focusSessions = generateFocusSessions(projects, tasks);
  const focusStreak = generateFocusStreak();
  
  return {
    user,
    projects,
    tasks,
    focusSessions,
    focusStreak
  };
}; 