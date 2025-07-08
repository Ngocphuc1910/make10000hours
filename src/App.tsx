import React, { useEffect, useRef, useCallback } from 'react';
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
import SettingsPage from './components/pages/SettingsPage';
import { formatTime } from './utils/timeUtils';
import { trackPageView, setAnalyticsUserId } from './utils/analytics';
import { verifyAnalyticsSetup } from './utils/verifyAnalytics';
import CalendarPage from './features/calendar/CalendarPage';
import DeepFocusPage from './components/pages/DeepFocusPage';
import { LoadingScreen } from './components/ui/LoadingScreen';
import { ChatButton } from './components/chat/ChatButton';
import DataSyncPage from './components/pages/DataSyncPage';
import PrivacyPolicyPage from './components/pages/PrivacyPolicyPage';
import { ChatIntegrationService } from './services/chatIntegration';
import { useDeepFocusStore } from './store/deepFocusStore';
import { DeepFocusProvider, useDeepFocusContext } from './contexts/DeepFocusContext';
import { testDeepFocusFixes } from './utils/testDeepFocusFix';

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
  <div className="w-full max-w-7xl mx-auto px-6 py-8">
    <div className="bg-background-primary rounded-lg border border-border p-8">
      <h1 className="text-3xl font-bold text-text-primary mb-8">Help & Support</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Documentation Section */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-text-primary">Documentation</h2>
          <div className="space-y-3">
            <a 
              href="/privacy-policy.html" 
              className="block p-4 bg-background-secondary rounded-lg border border-border hover:bg-background-container transition-colors"
            >
              <h3 className="font-medium text-text-primary">Privacy Policy</h3>
              <p className="text-sm text-text-secondary">Learn how we protect your data and privacy</p>
            </a>
          </div>
        </div>

        {/* Contact Section */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-text-primary">Contact Us</h2>
          <div className="bg-background-secondary rounded-lg border border-border p-4">
            <p className="text-text-secondary mb-2">
              For support, feedback, or questions about the Focus Time Tracker extension:
            </p>
            <p className="text-text-primary">
              <strong>Email:</strong> support@make10000hours.com
            </p>
          </div>
        </div>
      </div>

      {/* Extension Information */}
      <div className="mt-8 pt-8 border-t border-border">
        <h2 className="text-xl font-semibold text-text-primary mb-4">About Focus Time Tracker</h2>
        <p className="text-text-secondary">
          Focus Time Tracker is a Chrome extension designed to help you track your website usage time and maintain focus during work sessions. 
          All your data is stored locally on your device for maximum privacy and security.
        </p>
      </div>
    </div>
  </div>
);

// Global keyboard shortcuts component - must be inside Router context
let isGlobalShortcutsInitialized = false;
let globalCleanupFn: (() => void) | null = null;

const GlobalKeyboardShortcuts: React.FC = React.memo(() => {
  const location = useLocation();
  const navigate = useNavigate();
  const { 
    isRightSidebarOpen, 
    toggleRightSidebar, 
    toggleLeftSidebar 
  } = useUIStore();
  const { setIsAddingTask } = useTaskStore();
  const { toggleDeepFocus } = useDeepFocusContext();
  const { start, pause, isRunning } = useTimerStore();
  const enableStartPauseBtn = useTimerStore(state => state.enableStartPauseBtn);

  // Memoize navigation functions to prevent unnecessary re-renders
  const navigateToRoute = useCallback((route: string) => {
    navigate(route);
  }, [navigate]);

  const handleNewTask = useCallback(() => {
    if (!isRightSidebarOpen) {
      toggleRightSidebar();
    }
    setIsAddingTask(true);
  }, [isRightSidebarOpen, toggleRightSidebar, setIsAddingTask]);

  const handleTimerToggle = useCallback(() => {
    if (isRunning) {
      pause();
    } else {
      start();
    }
  }, [isRunning, pause, start]);

  useEffect(() => {
    if (isGlobalShortcutsInitialized) {
      return globalCleanupFn || undefined;
    }
    
    isGlobalShortcutsInitialized = true;
    console.log('🔧 GlobalKeyboardShortcuts: Component mounted and event listener attached');
    
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if user is typing in a form element
      const target = event.target as HTMLElement;
      const isTypingInFormElement = target.tagName === 'INPUT' || 
                                   target.tagName === 'TEXTAREA' || 
                                   target.isContentEditable ||
                                   target.getAttribute('role') === 'textbox';
      
      // Handle space bar for Pomodoro Timer start/pause
      if (event.code === 'Space' && !isTypingInFormElement) {
        // Only handle space if we're on the pomodoro page and start/pause is enabled
        const isPomodoroPage = location.pathname === '/pomodoro' || location.pathname === '/';
        if (isPomodoroPage && enableStartPauseBtn) {
          event.preventDefault();
          console.log('🔑 Space detected - toggling pomodoro timer');
          handleTimerToggle();
          return;
        }
      }
      
      // Check for Shift + D to toggle deep focus mode (only if not typing in form elements)
      if (event.shiftKey && (event.key === 'D' || event.key === 'd') && !isTypingInFormElement) {
        console.log('🔑 Shift+D detected - toggling deep focus mode');
        event.preventDefault();
        toggleDeepFocus();
        return;
      }
      
      // Check for Shift + N to create new task (only if not typing in form elements)
      if (event.shiftKey && event.key === 'N' && !isTypingInFormElement) {
        console.log('🔑 Shift+N detected - creating new task');
        event.preventDefault();
        handleNewTask();
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
      
      // Navigation shortcuts (only if not typing in form elements)
      if (!isTypingInFormElement) {
        // Check for P to navigate to Pomodoro Timer
        if ((event.key === 'P' || event.key === 'p')) {
          console.log('🔑 P detected - navigating to Pomodoro Timer');
          event.preventDefault();
          navigateToRoute('/pomodoro');
        }
        
        // Check for C to navigate to Calendar
        if ((event.key === 'C' || event.key === 'c')) {
          console.log('🔑 C detected - navigating to Calendar');
          event.preventDefault();
          navigateToRoute('/calendar');
        }
        
        // Check for T to navigate to Task Management
        if ((event.key === 'T' || event.key === 't')) {
          console.log('🔑 T detected - navigating to Task Management');
          event.preventDefault();
          navigateToRoute('/projects');
        }
        
        // Check for I to navigate to Productivity Insights
        if ((event.key === 'I' || event.key === 'i')) {
          console.log('🔑 I detected - navigating to Productivity Insights');
          event.preventDefault();
          navigateToRoute('/dashboard');
        }
        
        // Check for F to navigate to Deep Focus
        if ((event.key === 'F' || event.key === 'f')) {
          console.log('🔑 F detected - navigating to Deep Focus');
          event.preventDefault();
          navigateToRoute('/deep-focus');
        }
        
        // Check for D to navigate to Calendar Day view (only if not Shift+D)
        if ((event.key === 'D' || event.key === 'd') && !event.shiftKey) {
          console.log('🔑 D detected - navigating to Calendar Day view');
          event.preventDefault();
          navigateToRoute('/calendar?view=day');
        }
        
        // Check for W to navigate to Calendar Week view
        if ((event.key === 'W' || event.key === 'w')) {
          console.log('🔑 W detected - navigating to Calendar Week view');
          event.preventDefault();
          navigateToRoute('/calendar?view=week');
        }
        
        // Check for M to navigate to Calendar Month view
        if ((event.key === 'M' || event.key === 'm')) {
          console.log('🔑 M detected - navigating to Calendar Month view');
          event.preventDefault();
          navigateToRoute('/calendar?view=month');
        }
      }
    };

    // Add event listener
    document.addEventListener('keydown', handleKeyDown);

    // Cleanup
    const cleanup = () => {
      document.removeEventListener('keydown', handleKeyDown);
      isGlobalShortcutsInitialized = false; // Reset flag on cleanup
      globalCleanupFn = null;
    };
    globalCleanupFn = cleanup;
    return cleanup;
  }, [
    // Only include essential dependencies that should trigger re-initialization
    location.pathname,
    enableStartPauseBtn,
    toggleDeepFocus,
    // Remove other memoized functions to prevent unnecessary re-renders
    // They're already memoized and stable, so no need to include as dependencies
  ]);

  return null;
});

// Add display name for debugging
GlobalKeyboardShortcuts.displayName = 'GlobalKeyboardShortcuts';

const App: React.FC = () => {
  const { initialize, user, isLoading, isInitialized } = useUserStore();
  const { initializeTheme } = useThemeStore();

  // Global user sync with extension
  useUserSync();

  // Global Deep Focus sync now handled by DeepFocusProvider context

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

  // Handle tab/browser closure for deep focus sessions
  useEffect(() => {
    const handleBeforeUnload = async (event: BeforeUnloadEvent) => {
      const deepFocusStore = useDeepFocusStore.getState();
      if (deepFocusStore.isDeepFocusActive) {
        // Set reloading flag based on navigation type
        const isReloading = window.performance?.navigation?.type === 1 || 
          (window.performance?.getEntriesByType('navigation')[0] as PerformanceNavigationTiming)?.type === 'reload';
        
        deepFocusStore.setReloading(isReloading);
        
        // Only complete session if actually closing (not reloading)
        if (!isReloading) {
          event.preventDefault();
          event.returnValue = '';
          await deepFocusStore.disableDeepFocus();
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
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



  // Global shortcuts now handled by GlobalKeyboardShortcuts component inside DeepFocusProvider

  // CRITICAL: Don't render main app until user authentication is initialized
  // This prevents the brief "logged out" flash during Firebase auth restoration
  if (!isInitialized) {
    return <LoadingScreen title="Make10000hours" subtitle="Setting up your workspace..." />;
  }

  // Make test utility available globally for console debugging
  if (typeof window !== 'undefined') {
    (window as any).testDeepFocusFixes = testDeepFocusFixes;
  }

  return (
    <DeepFocusProvider>
      <Router>
        <GlobalTabTitleUpdater />
        <GlobalKeyboardShortcuts key="global-shortcuts" />
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
            <Route path="privacy-policy" element={<PrivacyPolicyPage />} />
            <Route path="privacy-policy.html" element={<PrivacyPolicyPage />} />
          </Routes>
        </AnalyticsWrapper>
        <ToastContainer />
        <ChatButton />
      </Router>
    </DeepFocusProvider>
  );
}

export default App;