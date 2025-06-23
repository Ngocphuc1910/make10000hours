import React, { useEffect, useRef } from 'react';
import './App.css';
import './typography.css';
import './styles.css';
import { Routes, Route, Navigate, Link, HashRouter as Router, useLocation, useNavigate } from 'react-router-dom';
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
import { useThemeStore } from './store/themeStore';
import { useUserSync } from './hooks/useUserSync';
import { useGlobalDeepFocusSync } from './hooks/useGlobalDeepFocusSync';
import SettingsPage from './components/pages/SettingsPage';
import { formatTime } from './utils/timeUtils';
import { trackPageView, setAnalyticsUserId } from './utils/analytics';
import { verifyAnalyticsSetup } from './utils/verifyAnalytics';
import CalendarPage from './features/calendar/CalendarPage';
import DeepFocusPage from './components/pages/DeepFocusPage';
import { LoadingScreen } from './components/ui/LoadingScreen';
import { ChatButton } from './components/chat/ChatButton';
import DataSyncPage from './components/pages/DataSyncPage';
import { ChatIntegrationService } from './services/chatIntegration';

// Import test utilities in development mode
if (process.env.NODE_ENV === 'development') {
  import('./utils/testTaskDeletion');
  import('./utils/authDebug'); // Import auth debugging utilities
}

// Import cleanup utility for orphaned sessions
import('./utils/cleanupSessions');

// Global tab title component - isolated to prevent parent re-renders
const GlobalTabTitleUpdater: React.FC = () => {
  const isRunning = useTimerStore(state => state.isRunning);
  const currentTime = useTimerStore(state => state.currentTime);
  const currentTask = useTimerStore(state => state.currentTask);
  const originalTitleRef = useRef<string>('');

  // Store original title on mount
  useEffect(() => {
    originalTitleRef.current = document.title;
  }, []);

  // Update browser tab title when timer is running
  useEffect(() => {
    if (isRunning) {
      const timeDisplay = formatTime(currentTime);
      const taskName = currentTask ? currentTask.title : 'Focus Session';
      document.title = `${timeDisplay} - ${taskName}`;
    } else {
      document.title = originalTitleRef.current;
    }
    
    // Cleanup: restore original title when component unmounts
    return () => {
      document.title = originalTitleRef.current;
    };
  }, [isRunning, currentTime, currentTask]);

  return null; // This component renders nothing
};

// Analytics wrapper component to track page views
const AnalyticsWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const { user } = useUserStore();

  // Track page views
  useEffect(() => {
    const pageName = location.pathname === '/' ? 'home' : location.pathname.replace('/', '');
    trackPageView(pageName);
  }, [location]);

  // Set user ID for analytics when user logs in
  useEffect(() => {
    if (user?.uid) {
      setAnalyticsUserId(user.uid);
    }
  }, [user]);

  return <>{children}</>;
};

// Keep the SupportPage component
const SupportPage = () => (
  <div className="w-full max-w-7xl mx-auto">
    <h1 className="text-2xl font-bold mb-4">Help & Support</h1>
    <p>This page is under construction</p>
  </div>
);

// Global keyboard shortcuts component - must be inside Router context
const GlobalKeyboardShortcuts: React.FC = () => {
  const setIsAddingTask = useTaskStore(state => state.setIsAddingTask);
  const { isRightSidebarOpen, toggleRightSidebar, toggleLeftSidebar } = useUIStore();
  const navigate = useNavigate();

  // Global keyboard shortcuts
  useEffect(() => {
    console.log('🔧 GlobalKeyboardShortcuts: Component mounted and event listener attached');
    
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if user is typing in a form element
      const target = event.target as HTMLElement;
      const isTypingInFormElement = target.tagName === 'INPUT' || 
                                   target.tagName === 'TEXTAREA' || 
                                   target.isContentEditable ||
                                   target.getAttribute('role') === 'textbox';
      
      // Debug logging for any key press
      console.log('🔑 Key pressed:', {
        key: event.key,
        code: event.code,
        target: target.tagName,
        isTypingInFormElement,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey
      });
      
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
      
      // Check for Shift + N to create new task (only if not typing in form elements)
      if (event.shiftKey && event.key === 'N' && !isTypingInFormElement) {
        console.log('🔑 Shift+N detected - creating new task');
        event.preventDefault();
        
        // Ensure the right sidebar is open to show tasks
        if (!isRightSidebarOpen) {
          toggleRightSidebar();
        }
        
        // Trigger new task creation
        setIsAddingTask(true);
      }
      
      // Check for Cmd + \ to toggle right sidebar
      if (event.metaKey && (event.key === '\\' || event.key === '|')) {
        console.log('🔑 Cmd+\\ detected - toggling right sidebar');
        event.preventDefault();
        toggleRightSidebar();
      }
      
      // Check for Alt/Option + \ to toggle left sidebar
      if (event.altKey && (event.key === '\\' || event.key === '|' || event.code === 'Backslash')) {
        console.log('🔑 Alt+\\ detected - toggling left sidebar');
        event.preventDefault();
        toggleLeftSidebar();
      }
      
      // Check for P to navigate to Pomodoro Timer (only if not typing in form elements)
      if ((event.key === 'P' || event.key === 'p') && !isTypingInFormElement) {
        console.log('🔑 P detected - navigating to Pomodoro Timer');
        event.preventDefault();
        navigate('/pomodoro');
      }
      
      // Check for C to navigate to Calendar (only if not typing in form elements)
      if ((event.key === 'C' || event.key === 'c') && !isTypingInFormElement) {
        console.log('🔑 C detected - navigating to Calendar');
        event.preventDefault();
        navigate('/calendar');
      }
      
      // Check for T to navigate to Task Management (only if not typing in form elements)
      if ((event.key === 'T' || event.key === 't') && !isTypingInFormElement) {
        console.log('🔑 T detected - navigating to Task Management');
        event.preventDefault();
        navigate('/projects');
      }
      
      // Check for I to navigate to Productivity Insights (only if not typing in form elements)
      if ((event.key === 'I' || event.key === 'i') && !isTypingInFormElement) {
        console.log('🔑 I detected - navigating to Productivity Insights');
        event.preventDefault();
        navigate('/dashboard');
      }
      
      // Check for F to navigate to Deep Focus (only if not typing in form elements)
      if ((event.key === 'F' || event.key === 'f') && !isTypingInFormElement) {
        console.log('🔑 F detected - navigating to Deep Focus');
        event.preventDefault();
        navigate('/deep-focus');
      }
      
      // Check for D to navigate to Calendar Day view (only if not typing in form elements)
      if ((event.key === 'D' || event.key === 'd') && !isTypingInFormElement) {
        console.log('🔑 D detected - navigating to Calendar Day view');
        event.preventDefault();
        navigate('/calendar?view=day');
      }
      
      // Check for W to navigate to Calendar Week view (only if not typing in form elements)
      if ((event.key === 'W' || event.key === 'w') && !isTypingInFormElement) {
        console.log('🔑 W detected - navigating to Calendar Week view');
        event.preventDefault();
        navigate('/calendar?view=week');
      }
      
      // Check for M to navigate to Calendar Month view (only if not typing in form elements)
      if ((event.key === 'M' || event.key === 'm') && !isTypingInFormElement) {
        console.log('🔑 M detected - navigating to Calendar Month view');
        event.preventDefault();
        navigate('/calendar?view=month');
      }
    };

    // Add event listener
    document.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isRightSidebarOpen, toggleRightSidebar, toggleLeftSidebar, setIsAddingTask, navigate]);

  return null; // This component renders nothing
};

const App: React.FC = () => {
  const { initialize, user, isLoading, isInitialized } = useUserStore();
  const { initializeTheme } = useThemeStore();

  // Global user sync with extension
  useUserSync();

  // Global Deep Focus sync for consistent state across all pages
  useGlobalDeepFocusSync();

  // Global timer interval - runs regardless of current page
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    const manageInterval = () => {
      // Get the latest state directly from the store
      const { isRunning, isActiveDevice } = useTimerStore.getState();

      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }

      if (isRunning && isActiveDevice) {
        intervalId = setInterval(() => {
          // Call tick using getState to ensure it's the most current version from the store
          useTimerStore.getState().tick();
        }, 1000);
      }
    };

    // Initial setup of the interval based on the current store state
    manageInterval();

    // Subscribe to changes in timer store state relevant to the interval
    const unsubscribe = useTimerStore.subscribe(
      (state, prevState) => {
        // Only re-evaluate the interval if isRunning or isActiveDevice changes
        if (state.isRunning !== prevState.isRunning || state.isActiveDevice !== prevState.isActiveDevice) {
          manageInterval();
        }
      }
    );

    // Cleanup function to clear interval and unsubscribe when App component unmounts
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
      unsubscribe();
      ChatIntegrationService.cleanup();
    };
  }, []); 

  // Initialize user store on app start
  useEffect(() => {
    // TODO: fix the problem that this runs twice on initial load. Check for React.StrictMode
    initialize();
    initializeTheme();
    
    // Initialize chat integration
    ChatIntegrationService.initialize();

    // Verify Analytics setup
    setTimeout(() => {
      verifyAnalyticsSetup();
    }, 2000); // Wait 2 seconds for Firebase to initialize

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

  // App component render tracking removed to reduce console noise

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

  // Data Sync page with layout
  const DataSyncPageWithLayout = () => (
    <MainLayout>
      <DataSyncPage />
    </MainLayout>
  );

  // CRITICAL: Don't render main app until user authentication is initialized
  // This prevents the brief "logged out" flash during Firebase auth restoration
  if (!isInitialized) {
    return <LoadingScreen title="Make10000hours" subtitle="Setting up your workspace..." />;
  }

  return (
    <Router>
      <GlobalTabTitleUpdater />
      <GlobalKeyboardShortcuts />
      <AnalyticsWrapper>
        <Routes>
          <Route path="/" element={<PomodoroPageWithLayout />} />
          <Route path="pomodoro" element={<PomodoroPageWithLayout />} />
          <Route path="projects" element={<ProjectsPageWithLayout />} />
          <Route path="dashboard/*" element={<DashboardLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="deep-focus" element={<DeepFocusPage />} />
          <Route path="data-sync" element={<DataSyncPageWithLayout />} />
          <Route path="support" element={<SupportPageWithLayout />} />
        </Routes>
      </AnalyticsWrapper>
      <ToastContainer />
      <ChatButton />
    </Router>
  );
}

export default App;