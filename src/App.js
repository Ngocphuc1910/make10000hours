import React, { useState, useEffect, useRef, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './styles/globals.css';
import { Play, Pause, RotateCcw, SkipForward, Plus, FolderPlus } from 'lucide-react';
import SessionsList from './components/SessionsList';
import Header from './components/Header';
import { AuthProvider } from './hooks/useAuth';
import ResetPasswordForm from './components/ResetPasswordForm';
import AuthCallback from './components/AuthCallback';

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
  const [loading, setLoading] = useState(true);
  const [time, setTime] = useState(25 * 60); // 25 minutes in seconds
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
    setTime(25 * 60);
    setIsActive(false);
    setIsPaused(true);
  };
  
  const skipTimer = () => {
    resetTimer();
    setSessionsCompleted(prev => prev + 1);
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
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);
    } else {
      clearInterval(interval);
    }
    
    return () => clearInterval(interval);
  }, [isActive, isPaused]);
  
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
                  onClick={() => setMode('pomodoro')}
                >
                  Pomodoro
                </button>
                <button 
                  className={`px-4 py-2 rounded-full ${mode === 'shortBreak' ? 'bg-gray-900 text-white' : 'bg-gray-100 dark:bg-gray-700'}`}
                  onClick={() => setMode('shortBreak')}
                >
                  Short Break
                </button>
                <button 
                  className={`px-4 py-2 rounded-full ${mode === 'longBreak' ? 'bg-gray-900 text-white' : 'bg-gray-100 dark:bg-gray-700'}`}
                  onClick={() => setMode('longBreak')}
                >
                  Long Break
                </button>
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
  );
}

export default App; 