import React, { useEffect, useRef } from 'react';
import './App.css';
import './typography.css';
import './styles.css';
import { Routes, Route, Navigate, Link, HashRouter as Router } from 'react-router-dom';
import PomodoroPage from './components/pages/PomodoroPage';
import DashboardPage from './components/pages/DashboardPage';
import MainLayout from './components/layout/MainLayout';
import { useTimerStore } from './store/timerStore';
import TaskList from './components/tasks/TaskList';
import { DashboardLayout } from './components/dashboard/layout/DashboardLayout';
import { ProjectsPage } from './components/dashboard/ProjectsPage';
import { Sidebar } from './components/layout/Sidebar';
import ProjectsLayout from './components/dashboard/ProjectsLayout';
import ToastContainer from './components/ui/ToastContainer';
import { auth } from './api/firebase';
import { useUserStore } from './store/userStore';
import { useTaskStore } from './store/taskStore';
import { useUIStore } from './store/uiStore';
import SettingsPage from './components/pages/SettingsPage';
import { formatTime } from './utils/timeUtils';

// Global tab title component - isolated to prevent parent re-renders
const GlobalTabTitleUpdater: React.FC = () => {
  const isRunning = useTimerStore(state => state.isRunning);
  const currentTime = useTimerStore(state => state.currentTime);
  const currentTaskId = useTimerStore(state => state.currentTaskId);
  const { tasks } = useTaskStore();
  const originalTitleRef = useRef<string>('');

  // Store original title on mount
  useEffect(() => {
    originalTitleRef.current = document.title;
  }, []);

  // Update browser tab title when timer is running
  useEffect(() => {
    if (isRunning) {
      const timeDisplay = formatTime(currentTime);
      const currentTask = currentTaskId 
        ? tasks.find(task => task.id === currentTaskId) 
        : null;
      const taskName = currentTask ? currentTask.title : 'Focus Session';
      document.title = `${timeDisplay} - ${taskName}`;
    } else {
      document.title = originalTitleRef.current;
    }
    
    // Cleanup: restore original title when component unmounts
    return () => {
      document.title = originalTitleRef.current;
    };
  }, [isRunning, currentTime, currentTaskId, tasks]);

  return null; // This component renders nothing
};

// Placeholder components for routes that don't have pages yet
const CalendarPage = () => (
  <div className="w-full max-w-7xl mx-auto">
    <h1 className="text-2xl font-bold mb-4">Calendar Page</h1>
    <p>This page is under construction</p>
  </div>
);

const SupportPage = () => (
  <div className="w-full max-w-7xl mx-auto">
    <h1 className="text-2xl font-bold mb-4">Help & Support</h1>
    <p>This page is under construction</p>
  </div>
);

const App = (): React.JSX.Element => {
  const { initialize } = useUserStore();
  const { setIsAddingTask } = useTaskStore();
  const { isRightSidebarOpen, toggleRightSidebar, toggleLeftSidebar } = useUIStore();
  
  // Global timer state for running timer across all pages
  const { isRunning, isActiveDevice, tick, currentTime, currentTaskId } = useTimerStore();
  const { tasks } = useTaskStore();

  // Global timer tick - runs on all pages
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (isRunning && isActiveDevice) {
      interval = setInterval(() => {
        tick();
      }, 1000);
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isRunning, isActiveDevice, tick]);

  // Global browser tab title update - works on all pages
  useEffect(() => {
    if (isRunning) {
      const formatTime = (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
      };
      
      const timeDisplay = formatTime(currentTime);
      const currentTask = currentTaskId ? tasks.find(task => task.id === currentTaskId) : null;
      const taskName = currentTask ? currentTask.title : 'Focus Session';
      document.title = `${timeDisplay} - ${taskName}`;
    } else {
      // Only reset to default when timer is actually stopped
      document.title = '10,000 Hours - Pomodoro Timer';
    }
  }, [isRunning, currentTime, currentTaskId, tasks]);

  useEffect(() => {
    // TODO: fix the problem that this runs twice on initial load. Check for React.StrictMode
    initialize();

    // Try to read the localStorage to check for data corruption
    try {
      // Get the stored data
      const storedData = localStorage.getItem('focus-time-storage');

      // If there's data, try to parse it
      if (storedData) {
        // Check if accessing date properties might cause issues
        const data = JSON.parse(storedData);
        if (data.state && data.state.focusStreak && data.state.focusStreak.streakDates) {
          // Test a date operation that would fail if dates are serialized incorrectly
          const testDate = data.state.focusStreak.streakDates[0]?.date;
          if (testDate && typeof testDate === 'string') {
            console.log('Converting date format in localStorage');
            // This is fine, our new code will handle it
          }
        }
      }
    } catch (error) {
      // If there's an error, clear the localStorage to start fresh
      console.error('Error with localStorage data, clearing storage:', error);
      localStorage.removeItem('focus-time-storage');
      // Force page reload to start with fresh data
      window.location.reload();
    }
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Debug logging for Alt key combinations
      if (event.altKey) {
        console.log('Alt key pressed with:', {
          key: event.key,
          code: event.code,
          keyCode: event.keyCode,
          altKey: event.altKey,
          shiftKey: event.shiftKey,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey
        });
      }
      
      // Check for Shift + N to create new task
      if (event.shiftKey && event.key === 'N') {
        event.preventDefault();
        
        // Ensure the right sidebar is open to show tasks
        if (!isRightSidebarOpen) {
          toggleRightSidebar();
        }
        
        // Trigger new task creation
        setIsAddingTask(true);
      }
      
      // Check for Shift + \ to toggle right sidebar
      if (event.shiftKey && (event.key === '\\' || event.key === '|')) {
        event.preventDefault();
        toggleRightSidebar();
      }
      
      // Check for Alt/Option + \ to toggle left sidebar
      if (event.altKey && (event.key === '\\' || event.key === '|' || event.code === 'Backslash')) {
        event.preventDefault();
        toggleLeftSidebar();
      }
    };

    // Add event listener
    document.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isRightSidebarOpen, toggleRightSidebar, toggleLeftSidebar, setIsAddingTask]);

  // Wrap PomodoroPage with MainLayout
  const PomodoroPageWithLayout = () => (
    <MainLayout rightSidebarContent={<TaskList />}>
      <PomodoroPage />
    </MainLayout>
  );

  // Support page with layout
  const SupportPageWithLayout = () => (
    <MainLayout>
      <SupportPage />
    </MainLayout>
  );

  // Projects page with its dedicated layout
  const ProjectsPageWithLayout = () => (
    <ProjectsLayout>
      <ProjectsPage />
    </ProjectsLayout>
  );

  return (
    <Router>
      <GlobalTabTitleUpdater />
      <Routes>
        <Route path="/" element={<PomodoroPageWithLayout />} />
        <Route path="pomodoro" element={<PomodoroPageWithLayout />} />
        <Route path="projects" element={<ProjectsPageWithLayout />} />
        <Route path="dashboard/*" element={<DashboardLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="support" element={<SupportPageWithLayout />} />
      </Routes>
      <ToastContainer />
    </Router>
  );
}

export default App;