import React from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { TimerProvider } from './contexts/TimerContext';
import { TaskProvider } from './contexts/TaskContext';
import Auth from './components/Auth';
import Timer from './components/Timer';
import TaskList from './components/TaskList';
import SpotifyEmbed from './components/SpotifyEmbed';

function App() {
  return (
    <AuthProvider>
      <TimerProvider>
        <TaskProvider>
          <div className="min-h-screen flex flex-col relative bg-pomodoro text-white">
            <Auth />
            
            <main className="container mx-auto px-4 py-8 flex-1 flex flex-col lg:flex-row gap-8 items-start justify-center">
              <div className="flex-1 w-full max-w-xl">
                <Timer />
              </div>
              
              <div className="w-full max-w-md">
                <TaskList />
              </div>
            </main>
            
            <SpotifyEmbed />
            
            <footer className="py-6 text-center text-white/70 text-sm">
              <p>Pomodoro Timer &copy; {new Date().getFullYear()}</p>
            </footer>
          </div>
        </TaskProvider>
      </TimerProvider>
    </AuthProvider>
  );
}

export default App; 