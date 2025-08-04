import React, { useEffect } from 'react';
import Calendar from './Calendar';
import { CalendarUTC } from './CalendarUTC';
import Sidebar from '../../components/layout/Sidebar';
import VerticalNavigation from '../../components/layout/VerticalNavigation';
import { useUIStore } from '../../store/uiStore';
import { useUserStore } from '../../store/userStore';
import { utcFeatureFlags } from '../../services/featureFlags';

const CalendarPage: React.FC = () => {
  const { isLeftSidebarOpen } = useUIStore();
  const { user } = useUserStore();

  // Determine which calendar component to use based on UTC feature flags
  const shouldUseUTC = user?.uid && utcFeatureFlags.getTransitionMode(user.uid) !== 'disabled';
  
  console.log('🗓️ CalendarPage: Using', shouldUseUTC ? 'UTC' : 'Legacy', 'calendar for user:', user?.uid);

  return (
    <div className="calendar-page-container flex h-screen overflow-hidden bg-background-primary dark:bg-[#141414]">
      {/* Left Sidebar - Navigation */}
      <Sidebar />
      
      {/* Calendar Content - Route to UTC or Legacy calendar based on feature flags */}
      <div className="flex-1 overflow-hidden">
        {shouldUseUTC ? <CalendarUTC /> : <Calendar />}
      </div>
      
      {/* Vertical Navigation - shows when left sidebar is closed */}
      <VerticalNavigation />
    </div>
  );
};

export default CalendarPage; 