import React, { useEffect } from 'react';
import './App.css';
import './styles.css';
import { Routes, Route, Navigate, Link, BrowserRouter as Router } from 'react-router-dom';
import PomodoroPage from './components/pages/PomodoroPage';
import DashboardPage from './components/pages/DashboardPage';
import MainLayout from './components/layout/MainLayout';
import { useTimerStore } from './store/timerStore';
import TaskList from './components/tasks/TaskList';
import { DashboardLayout } from './components/dashboard/layout/DashboardLayout';

// Placeholder components for routes that don't have pages yet
const ProjectsPage = () => (
  <div className="w-full max-w-7xl mx-auto">
    <h1 className="text-2xl font-bold mb-4">Projects & Tasks Page</h1>
    <p>This page is under construction</p>
  </div>
);

const CalendarPage = () => (
  <div className="w-full max-w-7xl mx-auto">
    <h1 className="text-2xl font-bold mb-4">Calendar Page</h1>
    <p>This page is under construction</p>
  </div>
);

const SettingsPage = () => (
  <div className="w-full max-w-7xl mx-auto">
    <h1 className="text-2xl font-bold mb-4">Settings Page</h1>
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
  // Initialize timer tick
  const { tick, isRunning } = useTimerStore();
  
  useEffect(() => {
    const interval = setInterval(() => {
      if (isRunning) {
        tick();
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [tick, isRunning]);
  
  return (
    <Router>
      <Routes>
        <Route path="/pomodoro" element={<PomodoroPage />} />
        <Route path="/dashboard/*" element={<DashboardLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="timer" element={<div>Pomodoro Timer Coming Soon</div>} />
          <Route path="calendar" element={<div>Calendar Coming Soon</div>} />
          <Route path="settings" element={<div>Settings Coming Soon</div>} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;