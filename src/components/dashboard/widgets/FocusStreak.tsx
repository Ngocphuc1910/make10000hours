import React, { useState, useEffect } from 'react';
import Card from '../../ui/Card';
import { useDashboardStore } from '../../../store/useDashboardStore';
import { calculateFocusStreak } from '../../../utils/dashboardAdapter';
import { getDateISOString } from '../../../utils/timeUtils';

export const FocusStreak: React.FC = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarDays, setCalendarDays] = useState<Array<{ date: Date, hasFocused: boolean } | null>>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const { workSessions } = useDashboardStore();
  
  // Calculate real focus streak from WorkSession data
  const focusStreak = calculateFocusStreak(workSessions);

  // Navigate to previous month
  const prevMonth = () => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() - 1);
    setCurrentMonth(newDate);
  };

  // Navigate to next month
  const nextMonth = () => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + 1);
    setCurrentMonth(newDate);
  };

  // Helper function to handle date comparison
  const compareDates = (date1: Date, date2: Date | string | null): boolean => {
    if (!date2) return false;
    const d1 = new Date(date1).toDateString();
    const d2 = typeof date2 === 'string' ? new Date(date2).toDateString() : date2.toDateString();
    return d1 === d2;
  };
  
  // Check if a date has focus sessions
  const hasFocusOnDate = (date: Date): boolean => {
    const dateString = getDateISOString(date);
    return workSessions.some(session => 
      session.date === dateString
    );
  };

  useEffect(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    // Get first day of the month
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay()); // Go to start of week
    
    const days: Array<{ date: Date, hasFocused: boolean } | null> = [];
    
    // Generate 6 weeks of days (42 days total)
    for (let i = 0; i < 42; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      
      // Only show days if they're in the current month or adjacent months
      if (currentDate.getMonth() === month || 
          Math.abs(currentDate.getMonth() - month) === 1 ||
          (month === 0 && currentDate.getMonth() === 11) ||
          (month === 11 && currentDate.getMonth() === 0)) {
        days.push({
          date: currentDate,
          hasFocused: hasFocusOnDate(currentDate)
        });
      } else {
        days.push(null);
      }
    }
    
    setCalendarDays(days);
  }, [currentMonth, workSessions]);

  // Format month name
  const monthName = currentMonth.toLocaleDateString('en-US', { 
    month: 'long', 
    year: 'numeric' 
  });
  
  // Handler for day selection
  const handleDayClick = (day: { date: Date, hasFocused: boolean }) => {
    setSelectedDate(day.date);
  };
  
  // Check if a date is today
  const isToday = (date: Date): boolean => {
    const today = new Date();
    return date.getDate() === today.getDate() && 
           date.getMonth() === today.getMonth() && 
           date.getFullYear() === today.getFullYear();
  };
  
  // Check if a date is in the past (before today)
  const isPastDay = (date: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  return (
    <Card title="Focus Streak">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center text-sm text-green-500 font-medium">
          <div className="w-4 h-4 flex items-center justify-center mr-1">
            <i className="ri-fire-line"></i>
          </div>
          <span>{focusStreak.currentStreak} days</span>
        </div>
        
        <div className="flex items-center space-x-2">
          <button 
            onClick={prevMonth}
            className="p-1.5 rounded-full hover:bg-gray-100"
          >
            <div className="w-4 h-4 flex items-center justify-center text-gray-600">
              <i className="ri-arrow-left-s-line"></i>
            </div>
          </button>
          <span className="text-sm font-medium text-gray-700">{monthName}</span>
          <button
            onClick={nextMonth}
            className="p-1.5 rounded-full hover:bg-gray-100"
          >
            <div className="w-4 h-4 flex items-center justify-center text-gray-600">
              <i className="ri-arrow-right-s-line"></i>
            </div>
          </button>
        </div>
      </div>
      
      {/* Day labels */}
      <div className="grid grid-cols-7 gap-2 mb-4">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day: string) => (
          <div key={day} className="text-center text-xs font-medium text-gray-500 py-1">
            {day}
          </div>
        ))}
      </div>
      
      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-2">
        {calendarDays.map((day: { date: Date, hasFocused: boolean } | null, i: number) => (
          <div key={i} className="flex items-center justify-center">
            {day ? (
              <div 
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs cursor-pointer
                  ${isToday(day.date)
                    ? 'bg-white border-2 border-primary border-dashed text-gray-600'
                    : day.hasFocused && isPastDay(day.date)
                      ? 'bg-primary text-white hover:bg-opacity-90'
                      : isPastDay(day.date)
                        ? 'bg-white border border-gray-200 text-gray-400 hover:bg-gray-50'
                        : 'bg-white border border-gray-200 text-gray-300'
                  }
                  ${selectedDate && compareDates(day.date, selectedDate)
                    ? 'ring-2 ring-primary ring-offset-2' 
                    : ''
                  }
                `}
                onClick={() => isPastDay(day.date) && handleDayClick(day)}
              >
                {day.date.getDate()}
              </div>
            ) : (
              <div></div>
            )}
          </div>
        ))}
      </div>
      
      {/* Streak information */}
      <div className="flex items-center justify-between mt-6">
        <div className="flex items-center">
          <span className="text-sm text-gray-600 mr-2">Longest streak</span>
          <span className="text-sm font-medium text-gray-800">{focusStreak.longestStreak} days</span>
        </div>
        <div className="flex items-center">
          <span className="text-sm text-gray-600 mr-2">Current streak</span>
          <span className="text-sm font-medium text-gray-800">{focusStreak.currentStreak} days</span>
        </div>
        <div className="flex items-center">
          <span className="text-sm text-gray-600 mr-2">Total focus days</span>
          <span className="text-sm font-medium text-gray-800">{focusStreak.totalFocusDays} days</span>
        </div>
      </div>
    </Card>
  );
}; 