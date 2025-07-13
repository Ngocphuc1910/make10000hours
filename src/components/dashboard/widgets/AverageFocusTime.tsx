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
        target: 25,
        progress: 0
      },
      journey: {
        current: 0,
        target: 10000,
        progress: 0
      }
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const calculateFocusStats = () => {
      
        setIsLoading(true);
        
        const timeSpentByDate: Record<string, number> = {};
        let currentWeekTimeSpent = 0;
        const currentWeekStart = new Date();
        const dayToMinus = currentWeekStart.getDay() === 0 ? 6 : currentWeekStart.getDay() - 1;
        currentWeekStart.setDate(currentWeekStart.getDate() - dayToMinus); // Set to start of the week (Monday)
        currentWeekStart.setHours(0, 0, 0, 0); // Normalize to start of the day

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
            target: 25, // Default weekly goal
            progress: Math.min((currentWeekTimeSpent / 60 / 25) * 100, 100) // Calculate progress percentage
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
      <Card title="Average Focus Time">
        <div className="flex items-center justify-center h-[200px]">
          <div className="text-text-secondary">Loading focus statistics...</div>
        </div>
      </Card>
    );
  }

  return (
    <Card title="Average Focus Time">
      <div className="h-[200px] flex flex-col justify-between">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-3xl font-bold text-text-primary">
              {stats.dailyAverage.hours}h {stats.dailyAverage.minutes}m
            </div>
            <p className="text-sm text-text-secondary mt-2">Daily average</p>
          </div>
          <div>
            <div className="text-3xl font-bold text-text-primary">
              {stats.totalFocus.hours}h {stats.totalFocus.minutes}m
            </div>
            <p className="text-sm text-text-secondary mt-2">Total focus time</p>
          </div>
        </div>

        <div className="space-y-4 flex-shrink-0">
        {/* Weekly Goal Progress */}
        <div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-text-secondary">Weekly goal (25h)</span>
            <span className="font-medium text-text-primary">
              {stats.weeklyGoal.current}h / {stats.weeklyGoal.target}h
            </span>
          </div>
          <div className="w-full h-2 bg-background-container rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary rounded-full" 
              style={{ width: `${stats.weeklyGoal.progress}%` }}
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
              className="h-full bg-primary rounded-full" 
              style={{ width: `${stats.journey.progress}%` }}
            ></div>
          </div>
        </div>
      </div>
      </div>
    </Card>
  );
}; 