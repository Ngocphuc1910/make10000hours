import React from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { AverageFocusTime } from './widgets/AverageFocusTime';
import { FocusStreak } from './widgets/FocusStreak';
import { TopProjects } from './widgets/TopProjects';
import { TopTasks } from './widgets/TopTasks';
import { FocusTimeTrend } from './widgets/FocusTimeTrend';

export const DashboardPage: React.FC = () => {
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