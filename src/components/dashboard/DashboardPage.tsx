import React, { useState } from 'react';
import { AverageFocusTime } from './widgets/AverageFocusTime';
import { FocusStreak } from './widgets/FocusStreak';
import { TopProjects } from './widgets/TopProjects';
import { TopTasks } from './widgets/TopTasks';
import { FocusTimeTrend } from './widgets/FocusTimeTrend';
import { useUserStore } from '../../store/userStore';
import { useDashboardStore } from '../../store/useDashboardStore';
import { workSessionService } from '../../api/workSessionService';
import { getDateISOString } from '../../utils/timeUtils';

export const DashboardContent: React.FC = () => {
  const { user } = useUserStore();
  const { workSessions } = useDashboardStore();
  const [showDebug, setShowDebug] = useState(false);
  
  const createTestSession = async () => {
    if (!user) return;
    
    console.log('Creating test work session...');
    try {
      await workSessionService.upsertWorkSession({
        userId: user.uid,
        taskId: 'test-task-1',
        projectId: 'no-project',
        date: getDateISOString(),
      }, 25); // 25 minutes
      
      console.log('Test work session created successfully');
    } catch (error) {
      console.error('Failed to create test work session:', error);
    }
  };
  
  const createMultipleTestSessions = async () => {
    if (!user) return;
    
    console.log('Creating multiple test work sessions...');
    try {
      // Create sessions for today and yesterday
      const today = getDateISOString();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayString = yesterday.toISOString().split('T')[0];
      
      await workSessionService.upsertWorkSession({
        userId: user.uid,
        taskId: 'test-task-1',
        projectId: 'no-project',
        date: today,
      }, 30);
      
      await workSessionService.upsertWorkSession({
        userId: user.uid,
        taskId: 'test-task-2',
        projectId: 'no-project',
        date: yesterdayString,
      }, 45);
      
      console.log('Multiple test work sessions created successfully');
    } catch (error) {
      console.error('Failed to create multiple test work sessions:', error);
    }
  };
  
  return (
    <div className="space-y-6">
      {/* Debug section */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-yellow-800">Debug: Dashboard Data</h3>
          <button 
            onClick={() => setShowDebug(!showDebug)}
            className="text-xs text-yellow-600 hover:text-yellow-800"
          >
            {showDebug ? 'Hide' : 'Show'} Debug Info
          </button>
        </div>
        
        <div className="flex gap-2 mb-3">
          <button 
            onClick={createTestSession}
            className="px-3 py-1 bg-yellow-600 text-white text-xs rounded hover:bg-yellow-700"
          >
            Create Test Session (25 mins)
          </button>
          <button 
            onClick={createMultipleTestSessions}
            className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
          >
            Create Multiple Sessions
          </button>
        </div>
        
        {showDebug && (
          <div className="text-xs text-yellow-800 bg-yellow-100 p-2 rounded">
            <p><strong>User ID:</strong> {user?.uid || 'Not logged in'}</p>
            <p><strong>Work Sessions Count:</strong> {workSessions.length}</p>
            <p><strong>Work Sessions:</strong></p>
            <pre className="text-xs overflow-auto max-h-32">
              {JSON.stringify(workSessions, null, 2)}
            </pre>
          </div>
        )}
      </div>
      
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