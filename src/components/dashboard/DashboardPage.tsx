import React, { useEffect } from 'react';
import { AverageFocusTime } from './widgets/AverageFocusTime';
import { FocusStreak } from './widgets/FocusStreak';
import { TopProjects } from './widgets/TopProjects';
import { TopTasks } from './widgets/TopTasks';
import { FocusTimeTrend } from './widgets/FocusTimeTrend';
import { useDashboardStore } from '../../store/useDashboardStore';
import { useUserStore } from '../../store/userStore';
import Sidebar from '../layout/Sidebar';
import { Header } from './layout/Header';
import VerticalNavigation from '../layout/VerticalNavigation';
import { useUIStore } from '../../store/uiStore';

export const DashboardContent: React.FC = () => {
  const { loadWorkSessionsForRange, selectedRange, useEventDrivenLoading } = useDashboardStore();
  const { user, isAuthenticated } = useUserStore();
  const { isLeftSidebarOpen } = useUIStore();

  // Load data when component mounts or when user changes
  useEffect(() => {
    if (isAuthenticated && user && useEventDrivenLoading) {
      console.log('DashboardContent - Component mounted, loading data for current range');
      loadWorkSessionsForRange(user.uid, selectedRange);
    }
  }, [isAuthenticated, user?.uid, loadWorkSessionsForRange, selectedRange, useEventDrivenLoading]);
  
  return (
    <div className="dashboard-layout flex h-screen overflow-hidden bg-background-primary">
      <Sidebar />
      
      <main className="dashboard-main flex-1 flex flex-col overflow-hidden">
        <Header />
        
        <div className="dashboard-content scrollbar-thin flex-1 overflow-y-auto !py-0">
          <div className="max-w-none mx-auto px-12 pt-6">
            <div className="space-y-8 w-full max-w-none">
              {/* Focus Time Statistics Section */}
              <div className="grid grid-cols-1 lg:grid-cols-10 gap-8">
                <div className="lg:col-span-3">
                  <AverageFocusTime />
                </div>
                <div className="lg:col-span-7">
                  <FocusStreak />
                </div>
              </div>
              
              {/* Projects and Tasks Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <TopProjects />
                <TopTasks />
              </div>
              
              {/* Focus Time Chart Section */}
              <div className="w-full">
                <FocusTimeTrend />
              </div>
            </div>
          </div>
        </div>
      </main>
      
      {/* Vertical Navigation - shows when left sidebar is closed */}
      <VerticalNavigation />
    </div>
  );
}; 