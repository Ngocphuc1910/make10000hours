import React, { useState, useEffect, useRef, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './styles/globals.css';
import { Play, Pause, RotateCcw, SkipForward, Plus, FolderPlus } from 'lucide-react';
import SessionsList from './components/SessionsList';
import Header from './components/Header';
import { AuthProvider, useAuth } from './hooks/useAuth';
import ResetPasswordForm from './components/ResetPasswordForm';
import AuthCallback from './components/AuthCallback';
import Achievements from './components/Achievements';
import { getUserSettings } from './lib/database';
import testSupabaseConnection from './lib/testSupabase';
import ThemeProvider from './components/ThemeProvider';

// Make test function available in the global scope for console debugging
window.testSupabaseConnection = testSupabaseConnection;

// Default timer settings
const defaultSettings = {
  pomodoroTime: 25,
  shortBreakTime: 5,
  shortBreakEnabled: true,
  longBreakTime: 15,
  longBreakEnabled: true,
  autoStartSessions: false
};

// Loading component
const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 dark:text-gray-100">
    <div className="text-center">
      <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-900 dark:border-white mb-4"></div>
      <p>Loading application...</p>
    </div>
  </div>
);

function MainApp() {
  const { currentUser, isAuthLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  // Get settings from localStorage or use defaults
  const [settings, setSettings] = useState(defaultSettings);
  const [time, setTime] = useState(settings.pomodoroTime * 60); // Convert minutes to seconds
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(true);
  const [mode, setMode] = useState('pomodoro'); // 'pomodoro', 'shortBreak', 'longBreak'
  // eslint-disable-next-line no-unused-vars
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  
  // Reference to the SessionsList component to access its methods
  const sessionsListRef = useRef(null);

  // Initial loading effect
  useEffect(() => {
    console.log("MainApp component mounted");
    const timer = setTimeout(() => {
      setLoading(false);
      console.log("MainApp finished loading");
    }, 500); // Short timeout to ensure UI is responsive

    return () => clearTimeout(timer);
  }, []);
  
  // Load settings from database if user is logged in, otherwise from localStorage
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // If still loading auth state, wait
        if (isAuthLoading) return;
        
        // If user is logged in, try to get settings from the database
        if (currentUser) {
          console.log("Loading settings from database for user:", currentUser.id);
          const userSettings = await getUserSettings(currentUser.id);
          
          if (userSettings) {
            console.log("User settings found in database:", userSettings);
            setSettings(userSettings);
            return;
          }
        }
        
        // Fallback to localStorage (for not logged in or no database settings)
        console.log("Loading settings from localStorage");
        const savedSettings = localStorage.getItem('timerSettings');
        if (savedSettings) {
          setSettings(JSON.parse(savedSettings));
        } else {
          setSettings(defaultSettings);
        }
      } catch (err) {
        console.error("Error loading settings:", err);
        
        // Fallback to localStorage on error
        const savedSettings = localStorage.getItem('timerSettings');
        if (savedSettings) {
          setSettings(JSON.parse(savedSettings));
        } else {
          setSettings(defaultSettings);
        }
      }
    };

    loadSettings();
  }, [currentUser, isAuthLoading]);
  
  // Effect to handle timer settings updates
  useEffect(() => {
    const handleSettingsUpdated = (event) => {
      const newSettings = event.detail;
      setSettings(newSettings);
      
      // Update timer based on mode and new settings
      if (mode === 'pomodoro') {
        setTime(newSettings.pomodoroTime * 60);
      } else if (mode === 'shortBreak' && newSettings.shortBreakEnabled) {
        setTime(newSettings.shortBreakTime * 60);
      } else if (mode === 'longBreak' && newSettings.longBreakEnabled) {
        setTime(newSettings.longBreakTime * 60);
      }
      
      // Reset active state to enforce the new settings
      setIsActive(false);
      setIsPaused(true);
    };

    window.addEventListener('timerSettingsUpdated', handleSettingsUpdated);
    
    return () => {
      window.removeEventListener('timerSettingsUpdated', handleSettingsUpdated);
    };
  }, [mode]);
  
  // Update time when mode changes
  useEffect(() => {
    if (mode === 'pomodoro') {
      setTime(settings.pomodoroTime * 60);
    } else if (mode === 'shortBreak') {
      setTime(settings.shortBreakTime * 60);
    } else if (mode === 'longBreak') {
      setTime(settings.longBreakTime * 60);
    }
    
    // Reset active state when changing modes
    setIsActive(false);
    setIsPaused(true);
  }, [mode, settings]);
  
  // Format time as MM:SS
  const formatTime = (timeInSeconds) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = timeInSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  // Timer functions
  const startTimer = () => {
    setIsActive(true);
    setIsPaused(false);
  };
  
  const pauseTimer = () => {
    setIsPaused(true);
  };
  
  const resetTimer = () => {
    if (mode === 'pomodoro') {
      setTime(settings.pomodoroTime * 60);
    } else if (mode === 'shortBreak') {
      setTime(settings.shortBreakTime * 60);
    } else if (mode === 'longBreak') {
      setTime(settings.longBreakTime * 60);
    }
    setIsActive(false);
    setIsPaused(true);
  };
  
  const skipTimer = () => {
    resetTimer();
    setSessionsCompleted(prev => prev + 1);
  };
  
  // Handle mode changes with respect to settings
  const handleModeChange = (newMode) => {
    if (newMode === 'shortBreak' && !settings.shortBreakEnabled) {
      return; // Do not change to short break if disabled
    }
    if (newMode === 'longBreak' && !settings.longBreakEnabled) {
      return; // Do not change to long break if disabled
    }
    setMode(newMode);
  };
  
  // Mock data
  const projects = [
    { id: 1, name: 'Work', tasks: 5, completedTasks: 2 },
    { id: 2, name: 'Personal', tasks: 3, completedTasks: 1 },
    { id: 3, name: 'Learning', tasks: 4, completedTasks: 0 },
  ];
  
  // Timer effect
  useEffect(() => {
    let interval = null;
    
    if (isActive && !isPaused) {
      interval = setInterval(() => {
        setTime((prevTime) => {
          if (prevTime <= 1) {
            clearInterval(interval);
            setIsActive(false);
            setSessionsCompleted(prev => prev + 1);
            
            // Auto-start next session if enabled
            if (settings.autoStartSessions) {
              // Determine next mode
              let nextMode;
              if (mode === 'pomodoro') {
                nextMode = settings.shortBreakEnabled ? 'shortBreak' : 
                          (settings.longBreakEnabled ? 'longBreak' : 'pomodoro');
              } else {
                nextMode = 'pomodoro';
              }
              
              // Change mode and start timer
              setTimeout(() => {
                setMode(nextMode);
                setTimeout(() => {
                  startTimer();
                }, 500);
              }, 500);
            }
            
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);
    } else {
      clearInterval(interval);
    }
    
    return () => clearInterval(interval);
  }, [isActive, isPaused, mode, settings]);
  
  // If still loading, show loading indicator
  if (loading) {
    return <LoadingFallback />;
  }
  
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 dark:text-gray-100">
      {/* Header */}
      <Header />
      
      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Left sidebar */}
          <div className="md:col-span-3 space-y-6">
            {/* Quick Actions */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
              <h2 className="font-semibold text-lg mb-4">Quick Actions</h2>
              
              <div className="space-y-2">
                <button 
                  className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 text-white p-3 rounded-md"
                  onClick={startTimer}
                >
                  <Play className="w-4 h-4" />
                  <span>Quick Start</span>
                </button>
                
                <button 
                  className="w-full flex items-center justify-center gap-2 border border-gray-300 dark:border-gray-700 p-3 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                  onClick={() => {
                    if (sessionsListRef.current) {
                      sessionsListRef.current.openTaskDialog();
                    }
                  }}
                >
                  <Plus className="w-4 h-4" />
                  <span>New Task</span>
                </button>
                
                <button className="w-full flex items-center justify-center gap-2 border border-gray-300 dark:border-gray-700 p-3 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700">
                  <FolderPlus className="w-4 h-4" />
                  <span>New Project</span>
                </button>
              </div>
            </div>
          </div>
          
          {/* Main content */}
          <div className="md:col-span-6">
            {/* Timer */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 text-center">
              <div className="flex justify-center space-x-2 mb-6">
                <button 
                  className={`px-4 py-2 rounded-full ${mode === 'pomodoro' ? 'bg-gray-900 text-white' : 'bg-gray-100 dark:bg-gray-700'}`}
                  onClick={() => handleModeChange('pomodoro')}
                >
                  Pomodoro
                </button>
                {settings.shortBreakEnabled && (
                  <button 
                    className={`px-4 py-2 rounded-full ${mode === 'shortBreak' ? 'bg-gray-900 text-white' : 'bg-gray-100 dark:bg-gray-700'}`}
                    onClick={() => handleModeChange('shortBreak')}
                  >
                    Short Break
                  </button>
                )}
                {settings.longBreakEnabled && (
                  <button 
                    className={`px-4 py-2 rounded-full ${mode === 'longBreak' ? 'bg-gray-900 text-white' : 'bg-gray-100 dark:bg-gray-700'}`}
                    onClick={() => handleModeChange('longBreak')}
                  >
                    Long Break
                  </button>
                )}
              </div>
              
              <div className="text-8xl font-bold tracking-tighter mb-8">
                {formatTime(time)}
              </div>
              
              <div className="flex justify-center space-x-4">
                {isActive && !isPaused ? (
                  <button
                    onClick={pauseTimer}
                    className="w-14 h-14 rounded-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 shadow-sm flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                  >
                    <Pause className="w-6 h-6" />
                  </button>
                ) : (
                  <button
                    onClick={startTimer}
                    className="w-14 h-14 rounded-full bg-gray-900 text-white shadow-sm flex items-center justify-center hover:bg-gray-800 transition-colors"
                  >
                    <Play className="w-6 h-6 ml-0.5" />
                  </button>
                )}
                
                <button
                  onClick={resetTimer}
                  className="w-14 h-14 rounded-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 shadow-sm flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                >
                  <RotateCcw className="w-6 h-6" />
                </button>
                
                <button
                  onClick={skipTimer}
                  className="w-14 h-14 rounded-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 shadow-sm flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                >
                  <SkipForward className="w-6 h-6" />
                </button>
              </div>
              
              <div className="mt-8 py-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-center">
                  <div className="text-left">
                    <div className="text-sm text-gray-500 dark:text-gray-400">Current Task</div>
                    <div className="font-medium">Complete UI Development</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500 dark:text-gray-400">Project</div>
                    <div className="font-medium">Work</div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Today's Sessions with drag and drop */}
            <SessionsList ref={sessionsListRef} />
          </div>
          
          {/* Right sidebar */}
          <div className="md:col-span-3 space-y-6">
            {/* Progress Tracker */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
              <h2 className="font-semibold text-lg mb-4">Progress to 10,000 Hours</h2>
              
              <div className="mb-2 flex justify-between text-sm">
                <span>2,500 hours</span>
                <span>10,000 hours</span>
              </div>
              
              <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-6">
                <div 
                  className="h-full bg-gray-400 dark:bg-gray-500" 
                  style={{ width: '25%' }}
                ></div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
                  <div className="text-sm text-gray-500 dark:text-gray-400">Daily Average</div>
                  <div className="text-xl font-bold">2.5 hrs</div>
                </div>
                
                <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
                  <div className="text-sm text-gray-500 dark:text-gray-400">Remaining</div>
                  <div className="text-xl font-bold">7,500 hrs</div>
                </div>
              </div>
            </div>
            
            {/* Achievements */}
            <Achievements />
            
            {/* Projects - moved from left sidebar */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-semibold text-lg">Projects</h2>
                <button className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              
              <div className="space-y-3">
                {projects.map(project => {
                  const progress = (project.completedTasks / project.tasks) * 100;
                  
                  return (
                    <div key={project.id} className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md cursor-pointer">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{project.name}</span>
                        <span className="text-xs text-gray-500">{project.completedTasks}/{project.tasks}</span>
                      </div>
                      
                      <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gray-400 dark:bg-gray-500" 
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function App() {
  // Fix the incorrect basename - just use "/" for root or blank for custom domain
  console.log("App component mounted");
  
  return (
    <ThemeProvider>
      <Router basename="/">
        <AuthProvider>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/" element={<MainApp />} />
              <Route path="/reset-password" element={<ResetPasswordForm />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </Router>
    </ThemeProvider>
  );
}

export default App; 