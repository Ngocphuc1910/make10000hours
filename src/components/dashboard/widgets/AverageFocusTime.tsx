import React, { useState, useEffect } from 'react';
import Card from '../../ui/Card';
import { useTaskStore } from '../../../store/taskStore';
import { useUserStore } from '../../../store/userStore';

export const AverageFocusTime: React.FC = () => {
  const { tasks } = useTaskStore();
  const { user } = useUserStore();
  const [dailyAverageMinutes, setDailyAverageMinutes] = useState(0);
  const [totalFocusMinutes, setTotalFocusMinutes] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  
  // Calculate daily average and total focus time using DailyTimeSpent data
  useEffect(() => {
    const calculateFocusStats = async () => {
      if (!user) {
        setDailyAverageMinutes(0);
        setTotalFocusMinutes(0);
        setIsLoading(false);
        return;
      }
      
      try {
        setIsLoading(true);
        const { dailyTimeSpentService } = await import('../../../api/dailyTimeSpentService');
        
        // Get data for the last 30 days to calculate average
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        
        const dailyRecords = await dailyTimeSpentService.getDailyTimeSpent(user.uid, startDate, endDate);
        
        if (dailyRecords.length > 0) {
          // Use daily tracking data
          const dailyTotals = new Map<string, number>();
          let totalMinutes = 0;
          
          dailyRecords.forEach(record => {
            const existing = dailyTotals.get(record.date) || 0;
            const newTotal = existing + record.timeSpent;
            dailyTotals.set(record.date, newTotal);
            totalMinutes += record.timeSpent;
          });
          
          // Calculate average (only counting days with work)
          const workDays = dailyTotals.size;
          const average = workDays > 0 ? totalMinutes / workDays : 0;
          
          setDailyAverageMinutes(average);
          
          // For total focus time, also include legacy task.timeSpent data
          const legacyTotalMinutes = tasks.reduce((total, task) => total + (task.timeSpent || 0), 0);
          setTotalFocusMinutes(totalMinutes + legacyTotalMinutes);
        } else {
          // No daily records exist yet - fall back to task.timeSpent data
          const totalMinutes = tasks.reduce((total, task) => total + (task.timeSpent || 0), 0);
          
          if (totalMinutes > 0) {
            // Since no daily records exist, assume all time is from today (first working day)
            setDailyAverageMinutes(totalMinutes);
            setTotalFocusMinutes(totalMinutes);
          } else {
            setDailyAverageMinutes(0);
            setTotalFocusMinutes(0);
          }
        }
      } catch (error) {
        console.error('Error calculating focus stats:', error);
        // Fallback: use task.timeSpent data
        const totalMinutes = tasks.reduce((total, task) => total + (task.timeSpent || 0), 0);
        setDailyAverageMinutes(totalMinutes);
        setTotalFocusMinutes(totalMinutes);
      } finally {
        setIsLoading(false);
      }
    };
    
    calculateFocusStats();
  }, [user, tasks]);
  
  // Calculate statistics for display
  const calculateStats = () => {
    // Total focus time
    const totalHours = Math.floor(totalFocusMinutes / 60);
    const totalRemainingMinutes = totalFocusMinutes % 60;

    // Daily average
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

  if (isLoading) {
    return (
      <Card title="Average Focus Time">
        <div className="flex items-center justify-center h-40">
          <div className="text-gray-500">Loading focus statistics...</div>
        </div>
      </Card>
    );
  }

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