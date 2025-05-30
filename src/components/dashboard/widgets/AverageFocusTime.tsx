import React, { useState, useEffect } from 'react';
import Card from '../../ui/Card';
import { useTaskStore } from '../../../store/taskStore';
import { useUserStore } from '../../../store/userStore';

export const AverageFocusTime: React.FC = () => {
  const { tasks } = useTaskStore();
  const { user } = useUserStore();
  const [dailyAverageMinutes, setDailyAverageMinutes] = useState(0);
  
  // Calculate daily average using daily time tracking
  useEffect(() => {
    const calculateDailyAverage = async () => {
      if (!user) return;
      
      try {
        const { dailyTimeSpentService } = await import('../../../api/dailyTimeSpentService');
        
        // Get data for the last 30 days to calculate average
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        
        const dailyRecords = await dailyTimeSpentService.getDailyTimeSpent(user.uid, startDate, endDate);
        
        if (dailyRecords.length > 0) {
          // Use daily tracking data if available
          const dailyTotals = new Map<string, number>();
          dailyRecords.forEach(record => {
            const existing = dailyTotals.get(record.date) || 0;
            dailyTotals.set(record.date, existing + record.timeSpent);
          });
          
          // Calculate average (only counting days with work)
          const workDays = dailyTotals.size;
          const totalMinutes = Array.from(dailyTotals.values()).reduce((sum, minutes) => sum + minutes, 0);
          const average = workDays > 0 ? totalMinutes / workDays : 0;
          
          setDailyAverageMinutes(average);
        } else {
          // No daily records exist yet - this means it's likely the first day or existing data
          const totalMinutes = tasks.reduce((total, task) => total + (task.timeSpent || 0), 0);
          
          if (totalMinutes > 0) {
            // Since no daily records exist, assume all time is from today (first working day)
            // Daily average = total time (because it's all from one day)
            setDailyAverageMinutes(totalMinutes);
          } else {
            setDailyAverageMinutes(0);
          }
        }
      } catch (error) {
        console.error('Error calculating daily average:', error);
        // Fallback: assume it's first day, so daily average = total time
        const totalMinutes = tasks.reduce((total, task) => total + (task.timeSpent || 0), 0);
        setDailyAverageMinutes(totalMinutes);
      }
    };
    
    calculateDailyAverage();
  }, [user, tasks]); // Re-calculate when tasks change (time increments)
  
  // Calculate real statistics from task timeSpent
  const calculateStats = () => {
    // Total focus time from all tasks
    const totalMinutes = tasks.reduce((total, task) => total + (task.timeSpent || 0), 0);
    const totalHours = Math.floor(totalMinutes / 60);
    const totalRemainingMinutes = totalMinutes % 60;

    // Daily average from our calculated value
    const dailyAverageHours = Math.floor(dailyAverageMinutes / 60);
    const dailyAverageRemainingMinutes = Math.floor(dailyAverageMinutes % 60);

    // Weekly goal calculation (estimate based on daily average)
    const weeklyGoalTarget = 25; // Default weekly goal
    const estimatedWeeklyHours = (dailyAverageMinutes / 60) * 7;
    const weeklyProgress = (estimatedWeeklyHours / weeklyGoalTarget) * 100;

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
        current: parseFloat(estimatedWeeklyHours.toFixed(1)),
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