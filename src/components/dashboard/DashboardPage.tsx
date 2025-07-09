import React, { useEffect } from 'react';
import { AverageFocusTime } from './widgets/AverageFocusTime';
import { FocusStreak } from './widgets/FocusStreak';
import { TopProjects } from './widgets/TopProjects';
import { TopTasks } from './widgets/TopTasks';
import { FocusTimeTrend } from './widgets/FocusTimeTrend';
import { useDashboardStore } from '../../store/useDashboardStore';
import { useUserStore } from '../../store/userStore';

export const DashboardContent: React.FC = () => {
  const { loadWorkSessionsForRange, selectedRange, useEventDrivenLoading } = useDashboardStore();
  const { user, isAuthenticated } = useUserStore();

  // Load data when component mounts or when user changes
  useEffect(() => {
    if (isAuthenticated && user && useEventDrivenLoading) {
      console.log('DashboardContent - Component mounted, loading data for current range');
      loadWorkSessionsForRange(user.uid, selectedRange);
    }
  }, [isAuthenticated, user?.uid, loadWorkSessionsForRange, selectedRange, useEventDrivenLoading]);
  return (
    <div className="space-y-6">
      {/* Focus Time Statistics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <AverageFocusTime />
        <div className="lg:col-span-2">
          <FocusStreak />
        </div>
      </div>
      
      {/* Projects and Tasks Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopProjects />
        <TopTasks />
      </div>
      
      {/* Focus Time Chart Section */}
      <FocusTimeTrend />
    </div>
  );
}; 