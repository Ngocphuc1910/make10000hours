import React from 'react';
import Card from '../../ui/Card';

export const AverageFocusTime: React.FC = () => {
  // Mock data for focus time statistics
  const stats = {
    dailyAverage: {
      hours: 3,
      minutes: 24
    },
    totalFocus: {
      hours: 23,
      minutes: 48
    },
    weeklyGoal: {
      current: 17.2, // Hours
      target: 25, // Hours
      progress: 68 // Percentage (17.2 / 25 * 100)
    },
    journey: {
      current: 1248, // Hours
      target: 10000, // Hours
      progress: 12.48 // Percentage (1248 / 10000 * 100)
    }
  };

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