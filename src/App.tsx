import React, { useEffect, useRef, useCallback } from 'react';
import './App.css';
import './typography.css';
import './styles.css';
import ExtensionDebugger from './utils/extensionDebugger';
import { Routes, Route, Navigate, Link, HashRouter as Router, useLocation, useNavigate } from 'react-router-dom';
import PomodoroPage from './components/pages/PomodoroPage';
import DashboardPage from './components/pages/DashboardPage';
import MainLayout from './components/layout/MainLayout';
import { useTimerStore } from './store/timerStore';
import TaskList from './components/tasks/TaskList';
import { Sidebar } from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';
import { ProjectsPage } from './components/dashboard/ProjectsPage';
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

// Debug imports (remove in production)
import { timezoneUtils } from './utils/timezoneUtils';
import { workSessionService } from './api/workSessionService';
import { format } from 'date-fns';

// Worker-timers import for background-safe timing
import { setInterval as workerSetInterval, clearInterval as workerClearInterval } from 'worker-timers';
import CalendarPage from './features/calendar/CalendarPage';
import DeepFocusPage from './components/pages/DeepFocusPage';
import { LoadingScreen } from './components/ui/LoadingScreen';
import { ChatButton } from './components/chat/ChatButton';
import DataSyncPage from './components/pages/DataSyncPage';
import PrivacyPolicyPage from './components/pages/PrivacyPolicyPage';
import { PricingModal } from './components/pricing/PricingModal';
import { ChatIntegrationService } from './services/chatIntegration';
import { DebugMarkdown } from './debug-markdown';
// LemonSqueezyClient removed - checkout now handled securely server-side
import { usePricingStore } from './store/pricingStore';
import { useDeepFocusStore } from './store/deepFocusStore';
import { DeepFocusProvider, useDeepFocusContext } from './contexts/DeepFocusContext';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import SettingsDialogWrapper from './components/settings/SettingsDialogWrapper';
import { testDeepFocusFixes } from './utils/testDeepFocusFix';
import DeepFocusCleanup from './utils/deepFocusCleanup';
import { useSimpleGoogleCalendarAuth } from './hooks/useSimpleGoogleCalendarAuth';
import './utils/resetMonitoring'; // Make resetUTCMonitoring available globally

// Import test utilities in development mode
if (process.env.NODE_ENV === 'development') {
  import('./utils/testTaskDeletion');
  import('./utils/authDebug'); // Import auth debugging utilities
  import('./utils/debugTransitionService'); // Import transition service debugging
  import('./utils/testEnhancedLegacySystem'); // Import enhanced legacy system testing
}

// Import cleanup utility for orphaned sessions
import('./utils/cleanupSessions');

// Import debug utilities in development
if (process.env.NODE_ENV === 'development') {
  import('./utils/debugCheckout');
  import('./utils/testFirebaseFunction');
}

// Import auth guard test utilities in development mode
if (process.env.NODE_ENV === 'development') {
  import('./utils/testAuthGuard');
}

// Feature flag controlled timer implementation
const USE_WORKER_TIMERS = process.env.REACT_APP_USE_WORKER_TIMERS !== 'false';

// Select timer implementation based on feature flag
const [setIntervalFn, clearIntervalFn] = (() => {
  if (USE_WORKER_TIMERS) {
    try {
      console.log('✅ Using worker-timers for background-safe timing');
      return [workerSetInterval, workerClearInterval];
    } catch (error) {
      console.warn('⚠️ worker-timers not available, falling back to standard timers:', error);
      return [window.setInterval, window.clearInterval];
    }
  } else {
    console.log('⚠️ worker-timers disabled via environment variable');
    return [window.setInterval, window.clearInterval];
  }
})();

// Global tab title component - isolated to prevent parent re-renders
const GlobalTabTitleUpdater: React.FC = () => {
  const isRunning = useTimerStore(state => state.isRunning);
  const currentTime = useTimerStore(state => state.currentTime);
  const currentTask = useTimerStore(state => state.currentTask);
  const originalTitleRef = useRef<string>('');

  // Store original title on mount
  useEffect(() => {
    originalTitleRef.current = document.title;
    
    // Expose debugging modules to window (remove in production)
    if (process.env.NODE_ENV === 'development') {
      window.timezoneUtils = timezoneUtils;
      window.workSessionService = workSessionService;
      window.useUserStore = useUserStore;
      window.useTaskStore = useTaskStore;
      window.format = format;
      console.log('🔧 Debug modules exposed to window for timezone debugging');
    }
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
            <div className="bg-background-secondary rounded-lg border border-border p-4">
              <h3 className="font-medium text-text-primary mb-2">Privacy Policy</h3>
              <p className="text-sm text-text-secondary">Learn how we protect your data and privacy</p>
            </div>
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
              <strong>Email:</strong> support@app.make10000hours.com
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
  const { openSettings } = useSettings();

  // Memoize navigation functions to prevent unnecessary re-renders
  const navigateToRoute = useCallback((route: string) => {
    navigate(route);
  }, [navigate]);

  const handleNewTask = useCallback(async () => {
    // Import auth guard dynamically to avoid circular dependencies
    const { checkAuthenticationStatus, triggerAuthenticationFlow } = await import('./utils/authGuard');
    const authStatus = checkAuthenticationStatus();
    
    if (!authStatus.isAuthenticated && authStatus.shouldShowAuth) {
      triggerAuthenticationFlow();
      return;
    }
    
    if (!isRightSidebarOpen) {
      toggleRightSidebar();
    }
    setIsAddingTask(true);
  }, [isRightSidebarOpen, toggleRightSidebar, setIsAddingTask]);

  const handleTimerToggle = useCallback(() => {
    // Get the current state directly from the store to avoid stale state issues
    const currentState = useTimerStore.getState();
    
    if (currentState.isRunning) {
      pause();
    } else {
      start();
    }
  }, [pause, start]); // Removed isRunning from dependencies to avoid stale state

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
      
      // Navigation shortcuts (only if not typing in form elements and no modifier keys)
      if (!isTypingInFormElement && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey) {
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
        
        // Check for S to open Settings
        if ((event.key === 'S' || event.key === 's')) {
          console.log('🔑 S detected - opening Settings');
          event.preventDefault();
          openSettings();
        }
        
        // Check for D to navigate to Calendar Day view
        if ((event.key === 'D' || event.key === 'd')) {
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
  const { initializeTheme, setMode } = useThemeStore();

  // Global user sync with extension
  useUserSync();
  
  // Initialize Google Calendar sync monitoring for authenticated users
  useSimpleGoogleCalendarAuth();

  // Global Deep Focus sync now handled by DeepFocusProvider context

  // Global timer interval - simple and reliable
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    let lastTickTime = Date.now();
    let sessionStartTime: number | null = null;
    let sessionStartTimerValue: number | null = null;

    // Simple tick function
    const tick = () => {
      const state = useTimerStore.getState();
      if (state.isRunning && state.isActiveDevice) {
        state.tick();
        lastTickTime = Date.now();
      }
    };

    // Manage single interval
    const manageInterval = () => {
      const { isRunning, isActiveDevice, currentTime } = useTimerStore.getState();
      
      // Clear existing interval
      if (intervalId) {
        clearIntervalFn(intervalId);
        intervalId = null;
      }

      if (isRunning && isActiveDevice) {
        // Record session start for accurate time tracking
        if (!sessionStartTime) {
          sessionStartTime = Date.now();
          sessionStartTimerValue = currentTime;
          console.log('⏱️ Timer started:', { time: currentTime });
        }
        
        // Single interval - worker-timers prevents browser throttling
        intervalId = setIntervalFn(tick, 1000);
      } else {
        sessionStartTime = null;
        sessionStartTimerValue = null;
      }
    };

    // Handle visibility changes for time correction
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const state = useTimerStore.getState();
        
        if (state.isRunning && state.isActiveDevice && sessionStartTime && sessionStartTimerValue !== null) {
          const now = Date.now();
          const realElapsed = Math.floor((now - sessionStartTime) / 1000);
          const expectedTime = Math.max(0, sessionStartTimerValue - realElapsed);
          const currentTime = state.currentTime;
          const drift = currentTime - expectedTime;
          
          // Apply correction for any drift (even 1 second matters for accuracy)
          if (Math.abs(drift) > 0) {
            console.log(`📱 Tab visible - correcting time drift: ${drift} seconds`);
            console.log(`⏰ Current: ${currentTime}, Expected: ${expectedTime}, Correcting to: ${expectedTime}`);
            
            // CRITICAL FIX: Apply time-based correction to compensate for browser throttling
            state.setCurrentTime(expectedTime);
            
            // If we missed significant time, update the session
            if (drift > 60 && state.activeSession) {
              const missedMinutes = Math.floor(drift / 60);
              console.log(`📊 Updating session with ${missedMinutes} missed minutes`);
              // The updateActiveSession will handle incrementing duration
              for (let i = 0; i < missedMinutes; i++) {
                state.updateActiveSession().catch(error => {
                  console.error('Failed to update missed minutes:', error);
                });
              }
            }
          }
          
          lastTickTime = now;
        }
      } else {
        // Tab going to background - log for debugging
        console.log('📴 Tab hidden at', new Date().toISOString(), '- timer may be throttled');
      }
    };

    // Initial setup
    manageInterval();

    // Single visibility change listener
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Subscribe to timer state changes
    const unsubscribe = useTimerStore.subscribe((state, prevState) => {
      // Reset session tracking when timer starts/stops
      if (state.isRunning && !prevState.isRunning) {
        sessionStartTime = Date.now();
        sessionStartTimerValue = state.currentTime;
      } else if (!state.isRunning && prevState.isRunning) {
        sessionStartTime = null;
        sessionStartTimerValue = null;
      }
      
      // Restart interval on state change
      setTimeout(manageInterval, 0);
    });

    // Cleanup function
    return () => {
      if (intervalId) clearIntervalFn(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      unsubscribe();
      ChatIntegrationService.cleanup();
    };
  }, []); 

  // Sync theme store when user settings change
  useEffect(() => {
    if (user?.settings?.theme) {
      console.log('🔄 App: Syncing theme from user settings:', user.settings.theme);
      setMode(user.settings.theme);
    }
  }, [user?.settings?.theme, setMode]);

  // Handle authentication URL parameters for landing page flow - detect and store intent immediately
  useEffect(() => {
    // HashRouter puts everything after # symbol, so we need to parse the hash
    const hash = window.location.hash;
    let urlParams: URLSearchParams;
    
    if (hash.includes('?')) {
      // Extract query string from hash (e.g., #/?action=login -> ?action=login)
      const queryString = hash.substring(hash.indexOf('?'));
      urlParams = new URLSearchParams(queryString);
    } else {
      // Fallback: also check regular search params in case of direct URL access
      urlParams = new URLSearchParams(window.location.search);
    }
    
    const authParam = urlParams.get('action') || urlParams.get('auth');
    
    if (authParam === 'login' || authParam === 'required') {
      console.log('🔗 Authentication requested via URL parameter');
      console.log('🔗 Detected from:', hash.includes('?') ? 'hash parameters' : 'search parameters');
      
      // Set global flags to prevent any authentication modals and store intent
      (window as any).__SKIP_AUTH_MODALS__ = true;
      (window as any).__AUTH_INTENT__ = true;
      
      // Clean up URL parameters immediately to prevent re-triggering
      if (hash.includes('?')) {
        // For HashRouter: clean hash parameters
        const baseHash = hash.substring(0, hash.indexOf('?'));
        window.location.hash = baseHash;
      } else {
        // For regular URLs: clean search parameters
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('action');
        newUrl.searchParams.delete('auth');
        window.history.replaceState({}, '', newUrl.toString());
      }
      
      console.log('🔗 URL cleaned up, auth intent stored globally');
    }
  }, []); // Run only once on mount

  // Handle authentication flow once user store is initialized
  useEffect(() => {
    if (isInitialized && (window as any).__AUTH_INTENT__) {
      if (!user) {
        console.log('🔐 User not authenticated, triggering direct Google auth...');
        
        // Clear the auth intent since we're handling it now
        (window as any).__AUTH_INTENT__ = false;
        
        // Trigger auth immediately
        import('./utils/authGuard').then(({ directGoogleAuth }) => {
          directGoogleAuth();
        });
      } else {
        console.log('✅ User already authenticated, proceeding to app');
        // Clear both flags since user is already authenticated
        (window as any).__SKIP_AUTH_MODALS__ = false;
        (window as any).__AUTH_INTENT__ = false;
      }
    }
  }, [isInitialized, user]);

  // Initialize user store on app start
  useEffect(() => {
    // TODO: fix the problem that this runs twice on initial load. Check for React.StrictMode
    initialize();
    initializeTheme();
    
    // Initialize chat integration
    ChatIntegrationService.initialize();
    
    // Initialize Lemon Squeezy client
    // LemonSqueezyClient.initialize() - removed, checkout now server-side
    
    // Set up Lemon Squeezy event listeners
    const handleLemonCheckoutSuccess = (event: CustomEvent) => {
      console.log('🍋 Checkout success:', event.detail);
      // Close pricing modal
      usePricingStore.getState().closeModal();
      // The webhook will handle the actual subscription update
    };
    
    const handleLemonPaymentUpdated = (event: CustomEvent) => {
      console.log('🍋 Payment method updated:', event.detail);
    };
    
    window.addEventListener('lemon-checkout-success', handleLemonCheckoutSuccess as EventListener);
    window.addEventListener('lemon-payment-updated', handleLemonPaymentUpdated as EventListener);

    // Setup extension debugger for console access
    (window as any).debugExtension = async () => {
      const extDebugger = new ExtensionDebugger();
      return await extDebugger.runAllTests();
    };
    
    // Setup Deep Focus cleanup utilities
    (window as any).cleanupDuplicates = async () => {
      try {
        const { DeepFocusSync } = await import('./services/deepFocusSync');
        const { useUserStore } = await import('./store/userStore');
        const user = useUserStore.getState().user;
        
        if (!user?.uid) {
          console.error('❌ User not authenticated');
          return { success: false, error: 'User not authenticated' };
        }
        
        console.log('🧹 Starting duplicate cleanup...');
        const result = await DeepFocusSync.removeDuplicateSessions(user.uid);
        
        if (result.success) {
          console.log(`✅ Cleanup completed: ${result.removedCount} duplicate sessions removed`);
        } else {
          console.error('❌ Cleanup failed:', result.error);
        }
        
        return result;
      } catch (error) {
        console.error('❌ Cleanup error:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    };

    // Debug Deep Focus sessions count
    (window as any).checkDeepFocusSessions = async () => {
      try {
        const { deepFocusSessionService } = await import('./api/deepFocusSessionService');
        const { useUserStore } = await import('./store/userStore');
        const user = useUserStore.getState().user;
        
        if (!user?.uid) {
          console.error('❌ User not authenticated');
          return;
        }
        
        console.log('🔍 Checking Deep Focus sessions...');
        
        // Get today's sessions
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
        
        const todaySessions = await deepFocusSessionService.getUserSessions(user.uid, todayStart, todayEnd);
        
        console.log(`📊 Today's Deep Focus sessions: ${todaySessions.length}`);
        console.log('Sessions:', todaySessions.map(s => ({ 
          id: s.id.substring(0, 8), 
          extensionId: s.extensionSessionId?.substring(0, 8) || 'none',
          duration: s.duration, 
          status: s.status,
          createdAt: s.createdAt.toISOString()
        })));
        
        // Calculate total time
        const totalTime = todaySessions
          .filter(s => s.status === 'completed' && s.duration)
          .reduce((total, s) => total + (s.duration || 0), 0);
        
        console.log(`⏱️ Total Deep Focus time: ${Math.floor(totalTime / 60)}h ${totalTime % 60}m`);
        
        // Check for duplicates
        const grouped = todaySessions.reduce((acc, session) => {
          if (session.extensionSessionId) {
            if (!acc[session.extensionSessionId]) {
              acc[session.extensionSessionId] = [];
            }
            acc[session.extensionSessionId].push(session);
          }
          return acc;
        }, {});
        
        const duplicates = Object.keys(grouped).filter(key => grouped[key].length > 1);
        
        if (duplicates.length > 0) {
          console.log('⚠️ Found duplicates:', duplicates.length);
          duplicates.forEach(extId => {
            console.log(`🔍 Extension ID ${extId.substring(0, 8)}:`, grouped[extId].map(s => ({ 
              id: s.id.substring(0, 8), 
              duration: s.duration, 
              status: s.status 
            })));
          });
        } else {
          console.log('✅ No duplicates found');
        }
        
        return { sessions: todaySessions, totalTime, duplicates: duplicates.length };
      } catch (error) {
        console.error('❌ Check sessions error:', error);
        return { error: error instanceof Error ? error.message : String(error) };
      }
    };
    
    (window as any).testDeepFocusSync = async () => {
      try {
        const { DeepFocusSync } = await import('./services/deepFocusSync');
        const { useUserStore } = await import('./store/userStore');
        const user = useUserStore.getState().user;
        
        if (!user?.uid) {
          console.error('❌ User not authenticated');
          return;
        }
        
        console.log('🧪 Testing Deep Focus sync process...');
        const result = await DeepFocusSync.syncTodaySessionsFromExtension(user.uid);
        console.log('🔄 Sync result:', result);
        
        if (result.success) {
          console.log(`✅ Sync test passed: ${result.synced} sessions synced`);
        } else {
          console.error('❌ Sync test failed:', result.error);
        }
        
        return result;
      } catch (error) {
        console.error('❌ Sync test error:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    };
    
    // Log debug instructions
    console.log('🔧 Extension Debug Available:');
    console.log('  Run debugExtension() in console to test extension communication');
    console.log('  Run cleanupDuplicates() in console to remove duplicate sessions');
    console.log('  Run testDeepFocusSync() in console to test sync process');
    console.log('  Run checkDeepFocusSessions() in console to check session count and duplicates');

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
      
      // Check if we've already tried to reload recently to prevent infinite loops
      const lastReloadTime = sessionStorage.getItem('app-localStorage-reload');
      const now = Date.now();
      
      if (!lastReloadTime || (now - parseInt(lastReloadTime)) > 30000) { // 30 second cooldown
        sessionStorage.setItem('app-localStorage-reload', now.toString());
        console.log('Reloading page due to localStorage corruption...');
        window.location.reload();
      } else {
        console.warn('Skipping reload to prevent infinite loop - localStorage will be empty');
      }
    }
    
    // Clear skip auth modals flag when user becomes authenticated
    const clearAuthModalFlag = () => {
      if (user && (window as any).__SKIP_AUTH_MODALS__) {
        console.log('✅ User authenticated, clearing skip auth modals flag');
        (window as any).__SKIP_AUTH_MODALS__ = false;
      }
    };
    
    // Check authentication state changes
    clearAuthModalFlag();
    
    // Cleanup event listeners
    return () => {
      window.removeEventListener('lemon-checkout-success', handleLemonCheckoutSuccess as EventListener);
      window.removeEventListener('lemon-payment-updated', handleLemonPaymentUpdated as EventListener);
    };
  }, []);

  // NOTE: Google Calendar webhook monitoring is now handled by useSimpleGoogleCalendarAuth hook
  // This ensures proper timing and avoids race conditions with sync state initialization

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

  // Support page with custom layout (no right sidebar)
  const SupportPageWithLayout = () => {
    const { isLeftSidebarOpen } = useUIStore();
    
    return (
      <div className="min-h-screen bg-background-primary">
        <div className="flex h-screen overflow-hidden">
          {/* Left Sidebar */}
          <div className={`${isLeftSidebarOpen ? 'w-64' : 'w-0'} transition-all duration-300 overflow-hidden`}>
            <Sidebar />
          </div>
          
          {/* Main Content Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <TopBar />
            <div className="flex-1 overflow-auto">
              <SupportPage />
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Privacy Policy page with custom layout (no right sidebar)
  const PrivacyPolicyPageWithLayout = () => {
    const { isLeftSidebarOpen } = useUIStore();
    
    return (
      <div className="min-h-screen bg-background-primary">
        <div className="flex h-screen overflow-hidden">
          {/* Left Sidebar */}
          <div className={`${isLeftSidebarOpen ? 'w-64' : 'w-0'} transition-all duration-300 overflow-hidden`}>
            <Sidebar />
          </div>
          
          {/* Main Content Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <TopBar />
            <div className="flex-1 overflow-auto">
              <PrivacyPolicyPage />
            </div>
          </div>
        </div>
      </div>
    );
  };


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

  // Make test utility available globally for console debugging in development only
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    (window as any).testDeepFocusFixes = testDeepFocusFixes;
    
    // Import debug functions and make them available globally in development
    import('./utils/checkoutDebugger').then(({ debugCheckoutIssues, quickAuthCheck, manualCheckoutTest }) => {
      (window as any).debugCheckout = debugCheckoutIssues;
      (window as any).quickAuthCheck = quickAuthCheck;
      (window as any).manualCheckoutTest = manualCheckoutTest;
      console.log('🔍 Debug functions loaded! Try: debugCheckout(), quickAuthCheck(), or manualCheckoutTest()');
    });
  }

  return (
    <SettingsProvider>
      <DeepFocusProvider>
        <Router>
          <GlobalTabTitleUpdater />
          <GlobalKeyboardShortcuts key="global-shortcuts" />
          <AnalyticsWrapper>
            <Routes>
              <Route path="/" element={<Navigate to="/pomodoro" replace />} />
              <Route path="pomodoro" element={<PomodoroPageWithLayout />} />
              <Route path="projects" element={<ProjectsPage />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="dashboard/settings" element={<SettingsPage />} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="deep-focus" element={<DeepFocusPage />} />
              <Route path="data-sync" element={<DataSyncPageWithLayout />} />
              <Route path="support" element={<SupportPageWithLayout />} />
              <Route path="privacy-policy" element={<PrivacyPolicyPageWithLayout />} />
              <Route path="debug-markdown" element={<DebugMarkdown />} />
            </Routes>
          </AnalyticsWrapper>
          <ToastContainer />
          <ChatButton />
          <PricingModal />
          <SettingsDialogWrapper />
        </Router>
      </DeepFocusProvider>
    </SettingsProvider>
  );
}

export default App;