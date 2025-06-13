import React from 'react';
import Calendar from './Calendar';
import Sidebar from '../../components/layout/Sidebar';
import { useUIStore } from '../../store/uiStore';

const CalendarPage: React.FC = () => {
  const { isLeftSidebarOpen } = useUIStore();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background-primary">
      {/* Left Sidebar - Navigation */}
      <Sidebar />
      
      {/* Calendar Content */}
      <div className="flex-1 overflow-hidden">
        <Calendar />
      </div>
    </div>
  );
};

export default CalendarPage; 