import React from 'react';
import { useFocusStore } from '../../../store/useFocusStore';
import { formatMinutes } from '../../../utils/timeUtils';
import { WeeklyBreakdown as WeeklyBreakdownType } from '../../../types';

// Generate mock weekly data
const generateWeeklyData = (): WeeklyBreakdownType[] => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const data = [
    { day: 'Monday', shortDay: 'Mon', focusMinutes: 135, date: new Date() }, // 2h 15m
    { day: 'Tuesday', shortDay: 'Tue', focusMinutes: 225, date: new Date() }, // 3h 45m
    { day: 'Wednesday', shortDay: 'Wed', focusMinutes: 180, date: new Date() }, // 3h 00m
    { day: 'Thursday', shortDay: 'Thu', focusMinutes: 240, date: new Date() }, // 4h 00m
    { day: 'Friday', shortDay: 'Fri', focusMinutes: 165, date: new Date() }, // 2h 45m
    { day: 'Saturday', shortDay: 'Sat', focusMinutes: 60, date: new Date() }, // 1h 00m
    { day: 'Sunday', shortDay: 'Sun', focusMinutes: 30, date: new Date() }, // 0h 30m
  ];
  
  // Find the maximum time to calculate percentages
  const maxTime = Math.max(...data.map(d => d.focusMinutes));
  
  return data;
};

export const WeeklyBreakdown: React.FC = () => {
  // For now, using mock data
  const weeklyData = generateWeeklyData();
  const maxTime = Math.max(...weeklyData.map(d => d.focusMinutes));
  
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-800">
          Weekly Breakdown
        </h3>
        <button className="text-gray-400 hover:text-gray-600">
          <div className="w-5 h-5 flex items-center justify-center">
            <i className="ri-more-2-line"></i>
          </div>
        </button>
      </div>
      <div className="space-y-3">
        {weeklyData.map((day) => (
          <div key={day.shortDay} className="flex items-center">
            <div className="w-8 text-xs text-gray-500">{day.shortDay}</div>
            <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full"
                style={{
                  width: `${(day.focusMinutes / maxTime) * 100}%`,
                }}
              ></div>
            </div>
            <div className="w-16 text-right text-sm text-gray-600 ml-2">
              {formatMinutes(day.focusMinutes)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}; 