import React, { useEffect } from 'react';
import './App.css';
import './remixicon.css';
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

// Placeholder components for routes that don't have pages yet
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
      <Routes>
        <Route path="/pomodoro" element={<PomodoroPageWithLayout />} />
        <Route path="/projects" element={<ProjectsPageWithLayout />} />
        <Route path="/dashboard/*" element={<DashboardLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="/support" element={<SupportPageWithLayout />} />
        <Route path="*" element={<Navigate to="/pomodoro" replace />} />
      </Routes>
      <ToastContainer />
    </Router>
  );
}

export default App;