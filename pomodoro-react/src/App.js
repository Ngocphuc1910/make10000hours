import React from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { TimerProvider } from './contexts/TimerContext';
import { TaskProvider } from './contexts/TaskContext';
import Auth from './components/Auth';
import Timer from './components/Timer';
import TaskList from './components/TaskList';
import './styles/App.css';

function App() {
  return (
    <AuthProvider>
      <TimerProvider>
        <TaskProvider>
          <div className="app">
            <Auth />
            <main className="app-content">
              <Timer />
              <TaskList />
            </main>
            <footer className="app-footer">
              <p>Pomodoro Timer App &copy; {new Date().getFullYear()}</p>
            </footer>
          </div>
        </TaskProvider>
      </TimerProvider>
    </AuthProvider>
  );
}

export default App; 