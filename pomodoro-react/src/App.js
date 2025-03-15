import React from 'react';
import './styles/globals.css';
import { AuthProvider } from './contexts/AuthContext';
import { TimerProvider } from './contexts/TimerContext';
import { TaskProvider } from './contexts/TaskContext';
import Header from './components/Header';
import Timer from './components/Timer';
import QuickActions from './components/QuickActions';
import Projects from './components/Projects';
import ProgressTracker from './components/ProgressTracker';
import Achievements from './components/Achievements';
import { AuthModalProvider } from './components/Auth';
import './styles/App.css';

function App() {
  return (
    <AuthProvider>
      <TaskProvider>
        <TimerProvider>
          <AuthModalProvider>
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
              <Header />
              
              <div className="container mx-auto px-4 py-6 grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* Left sidebar */}
                <div className="md:col-span-3 space-y-6">
                  <QuickActions />
                  <Projects />
                </div>
                
                {/* Main content */}
                <div className="md:col-span-6 space-y-6 flex flex-col items-center justify-center">
                  <Timer />
                </div>
                
                {/* Right sidebar */}
                <div className="md:col-span-3 space-y-6">
                  <ProgressTracker />
                  <Achievements />
                </div>
              </div>
            </div>
          </AuthModalProvider>
        </TimerProvider>
      </TaskProvider>
    </AuthProvider>
  );
}

export default App; 