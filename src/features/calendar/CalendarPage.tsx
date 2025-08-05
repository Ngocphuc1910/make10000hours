import React, { useEffect } from 'react';
import Calendar from './Calendar';
import Sidebar from '../../components/layout/Sidebar';
import VerticalNavigation from '../../components/layout/VerticalNavigation';
import { useUIStore } from '../../store/uiStore';
import { useUserStore } from '../../store/userStore';

const CalendarPage: React.FC = () => {
  const { isLeftSidebarOpen } = useUIStore();
  const { user } = useUserStore();

  return (
    <div className="calendar-page-container flex h-screen overflow-hidden bg-background-primary dark:bg-[#141414]">
      {/* Left Sidebar - Navigation */}
      <Sidebar />
      
      {/* Calendar Content - Now uses regular Calendar with UTC backend support */}
      <div className="flex-1 overflow-hidden">
        <Calendar />
      </div>
      
      {/* Vertical Navigation - shows when left sidebar is closed */}
      <VerticalNavigation />
    </div>
  );
};

export default CalendarPage; 