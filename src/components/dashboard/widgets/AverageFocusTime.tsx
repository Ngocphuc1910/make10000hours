import React from 'react';
import Card from '../../ui/Card';
import { useWorkSessionStore } from '../../../store/useWorkSessionStore';
import { useUserStore } from '../../../store/userStore';

export const AverageFocusTime: React.FC = () => {
  const { workSessions } = useWorkSessionStore();
  const { user } = useUserStore();
  
  // Calculate real statistics from work sessions
  const calculateStats = () => {
    if (workSessions.length === 0) {
      return {
        dailyAverage: { hours: 0, minutes: 0 },
        totalFocus: { hours: 0, minutes: 0 },
        weeklyGoal: { current: 0, target: 25, progress: 0 },
        journey: { current: 0, target: 10000, progress: 0 }
      };
    }

    // Total focus time
    const totalMinutes = workSessions.reduce((total, session) => total + session.duration, 0);
    const totalHours = Math.floor(totalMinutes / 60);
    const totalRemainingMinutes = totalMinutes % 60;

    // Group sessions by date for daily average
    const sessionsByDate = new Map<string, number>();
    workSessions.forEach(session => {
      const dateKey = session.startTime.toDateString();
      sessionsByDate.set(dateKey, (sessionsByDate.get(dateKey) || 0) + session.duration);
    });

    // Daily average
    const totalDays = sessionsByDate.size;
    const dailyAverageMinutes = totalDays > 0 ? totalMinutes / totalDays : 0;
    const dailyAverageHours = Math.floor(dailyAverageMinutes / 60);
    const dailyAverageRemainingMinutes = Math.floor(dailyAverageMinutes % 60);

    // Weekly goal (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const thisWeekSessions = workSessions.filter(session => 
      session.startTime >= weekAgo
    );
    const thisWeekMinutes = thisWeekSessions.reduce((total, session) => total + session.duration, 0);
    const thisWeekHours = thisWeekMinutes / 60;
    const weeklyGoalTarget = 25; // Default weekly goal
    const weeklyProgress = (thisWeekHours / weeklyGoalTarget) * 100;

    // 10000 hours journey
    const journeyTarget = 10000; // Default journey goal
    const journeyProgress = (totalHours / journeyTarget) * 100;

    return {
      dailyAverage: {
        hours: dailyAverageHours,
        minutes: dailyAverageRemainingMinutes
      },
      totalFocus: {
        hours: totalHours,
        minutes: totalRemainingMinutes
      },
      weeklyGoal: {
        current: parseFloat(thisWeekHours.toFixed(1)),
        target: weeklyGoalTarget,
        progress: Math.min(weeklyProgress, 100)
      },
      journey: {
        current: totalHours,
        target: journeyTarget,
        progress: parseFloat(journeyProgress.toFixed(2))
      }
    };
  };

  const stats = calculateStats();

  return (
    <Card title="Average Focus Time">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="text-3xl font-bold text-gray-900">
            {stats.dailyAverage.hours}h {stats.dailyAverage.minutes}m
          </div>
          <p className="text-sm text-gray-500 mt-2">Daily average</p>
        </div>
        <div>
          <div className="text-3xl font-bold text-gray-900">
            {stats.totalFocus.hours}h {stats.totalFocus.minutes}m
          </div>
          <p className="text-sm text-gray-500 mt-2">Total focus time</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Weekly Goal Progress */}
        <div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-600">Weekly goal (25h)</span>
            <span className="font-medium text-gray-700">
              {stats.weeklyGoal.current}h / {stats.weeklyGoal.target}h
            </span>
          </div>
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary rounded-full" 
              style={{ width: `${stats.weeklyGoal.progress}%` }}
            ></div>
          </div>
        </div>

        {/* Journey Progress */}
        <div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-600">Journey to 10,000 hours</span>
            <span className="font-medium text-gray-700">
              {stats.journey.current}h / {stats.journey.target}h
            </span>
          </div>
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary rounded-full" 
              style={{ width: `${stats.journey.progress}%` }}
            ></div>
          </div>
        </div>
      </div>
    </Card>
  );
}; 