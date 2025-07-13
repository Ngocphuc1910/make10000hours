import React, { useState, useEffect } from 'react';
import Card from '../../ui/Card';
import { useDashboardStore } from '../../../store/useDashboardStore';

export const AverageFocusTime: React.FC = () => {
  const { workSessions } = useDashboardStore();
  const [ stats, setStats ] = useState({
    dailyAverage: {
        hours: 0,
        minutes: 0
      },
      totalFocus: {
        hours: 0,
        minutes: 0
      },
      weeklyGoal: {
        current: 0,
        target: 50, // Changed from 25h to 50h
        progress: 0
      },
      monthlyGoal: {
        current: 0,
        target: 200, // Monthly goal of 200h
        progress: 0
      },
      journey: {
        current: 0,
        target: 10000,
        progress: 0
      }
  });
  const [isLoading, setIsLoading] = useState(false);

  // Helper functions to get date ranges
  const getCurrentWeekRange = () => {
    const now = new Date();
    const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1; // Monday = 0, Sunday = 6
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - dayOfWeek);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    const formatDate = (date: Date) => {
      return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    };
    
    return `${formatDate(weekStart)} - ${formatDate(weekEnd)}`;
  };

  const getCurrentMonth = () => {
    const now = new Date();
    return now.toLocaleDateString('en-US', { month: 'long' });
  };

  useEffect(() => {
    const calculateFocusStats = () => {
      
        setIsLoading(true);
        
        const timeSpentByDate: Record<string, number> = {};
        let currentWeekTimeSpent = 0;
        let currentMonthTimeSpent = 0;
        
        const currentWeekStart = new Date();
        const dayToMinus = currentWeekStart.getDay() === 0 ? 6 : currentWeekStart.getDay() - 1;
        currentWeekStart.setDate(currentWeekStart.getDate() - dayToMinus); // Set to start of the week (Monday)
        currentWeekStart.setHours(0, 0, 0, 0); // Normalize to start of the day

        const currentMonthStart = new Date();
        currentMonthStart.setDate(1); // Set to first day of current month
        currentMonthStart.setHours(0, 0, 0, 0);

        // Filter out break sessions and calculate time spent
        workSessions
          .filter(session => session.sessionType === 'pomodoro' || session.sessionType === 'manual')
          .forEach(session => {
            const date = session.date;
            const duration = session.duration; // duration in minutes
            if (!timeSpentByDate[date]) {
              timeSpentByDate[date] = duration;
            } else {
              timeSpentByDate[date] += duration;
            }

            // Calculate weekly time spent
            const sessionDate = new Date(date);
            if (sessionDate >= currentWeekStart) {
              currentWeekTimeSpent += duration;
            }

            // Calculate monthly time spent
            if (sessionDate >= currentMonthStart) {
              currentMonthTimeSpent += duration;
            }
          });
        const totalFocusMinutes = Object.values(timeSpentByDate).reduce((sum, minutes) => sum + minutes, 0);
        const dailyAverageMinutes = totalFocusMinutes / Object.keys(timeSpentByDate).length || 0;
        setStats({
          dailyAverage: {
            hours: Math.floor(dailyAverageMinutes / 60),
            minutes: Math.floor(dailyAverageMinutes % 60)
          },
          totalFocus: {
            hours: Math.floor(totalFocusMinutes / 60),
            minutes: totalFocusMinutes % 60
          },
          weeklyGoal: {
            current: parseFloat(((currentWeekTimeSpent / 60).toFixed(1))),
            target: 50, // Updated weekly goal to 50h
            progress: Math.min((currentWeekTimeSpent / 60 / 50) * 100, 100) // Calculate progress percentage
          },
          monthlyGoal: {
            current: parseFloat(((currentMonthTimeSpent / 60).toFixed(1))),
            target: 200, // Monthly goal of 200h
            progress: Math.min((currentMonthTimeSpent / 60 / 200) * 100, 100) // Calculate progress percentage
          },
          journey: {
            current: Math.floor(totalFocusMinutes / 60),
            target: 10000, // Default journey goal
            progress: parseFloat(((totalFocusMinutes / 60 / 10000) * 100).toFixed(2)) // Calculate progress percentage
          }
        });
        setIsLoading(false);
    };
    
    calculateFocusStats();
  }, [workSessions]);

  if (isLoading) {
    return (
      <Card title="Overal Insights">
        <div className="flex items-center justify-center h-[200px]">
          <div className="text-text-secondary">Loading focus statistics...</div>
        </div>
      </Card>
    );
  }

  return (
    <Card title="Overal Insights">
      <div className="h-[200px] flex flex-col justify-between">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-2xl font-bold text-text-primary">
              {stats.dailyAverage.hours}h {stats.dailyAverage.minutes}m
            </div>
            <p className="text-sm text-text-secondary mt-1">Daily average</p>
          </div>
          <div>
            <div className="text-2xl font-bold text-text-primary">
              {stats.totalFocus.hours}h {stats.totalFocus.minutes}m
            </div>
            <p className="text-sm text-text-secondary mt-1">Total focus time</p>
          </div>
        </div>

        <div className="space-y-4 flex-shrink-0">
        {/* Weekly Goal Progress */}
        <div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-text-secondary">Weekly goal ({getCurrentWeekRange()})</span>
            <span className="font-medium text-text-primary">
              {stats.weeklyGoal.current}h / {stats.weeklyGoal.target}h
            </span>
          </div>
          <div className="w-full h-2 bg-background-container rounded-full overflow-hidden">
            <div 
              className="h-full rounded-full" 
              style={{ 
                width: `${stats.weeklyGoal.progress}%`,
                backgroundColor: '#BA4949'
              }}
            ></div>
          </div>
        </div>

        {/* Monthly Goal Progress */}
        <div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-text-secondary">Monthly goal ({getCurrentMonth()})</span>
            <span className="font-medium text-text-primary">
              {stats.monthlyGoal.current}h / {stats.monthlyGoal.target}h
            </span>
          </div>
          <div className="w-full h-2 bg-background-container rounded-full overflow-hidden">
            <div 
              className="h-full rounded-full" 
              style={{ 
                width: `${stats.monthlyGoal.progress}%`,
                backgroundColor: '#BA4949'
              }}
            ></div>
          </div>
        </div>

        {/* Journey Progress */}
        <div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-text-secondary">Journey to 10,000 hours</span>
            <span className="font-medium text-text-primary">
              {stats.journey.current}h / {stats.journey.target}h
            </span>
          </div>
          <div className="w-full h-2 bg-background-container rounded-full overflow-hidden">
            <div 
              className="h-full rounded-full" 
              style={{ 
                width: `${stats.journey.progress}%`,
                backgroundColor: '#BA4949'
              }}
            ></div>
          </div>
        </div>
      </div>
      </div>
    </Card>
  );
}; 