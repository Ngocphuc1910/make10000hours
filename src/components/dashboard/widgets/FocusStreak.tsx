import React, { useState, useEffect } from 'react';
import Card from '../../ui/Card';
import { useDashboardStore } from '../../../store/useDashboardStore';
import { calculateFocusStreak } from '../../../utils/dashboardAdapter';
import { getDateISOString } from '../../../utils/timeUtils';
import { useUserStore } from '../../../store/userStore';
import { createTestWorkSessions } from '../../../utils/testWorkSessions';

export const FocusStreak: React.FC = () => {
  // Initialize to current month
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [calendarDays, setCalendarDays] = useState<Array<{ date: Date, hasFocused: boolean } | null>>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const { workSessions } = useDashboardStore();
  const { user } = useUserStore();
  
  // Calculate real focus streak from WorkSession data
  const focusStreak = calculateFocusStreak(workSessions);

  // Auto-navigate to current month when work sessions are loaded
  useEffect(() => {
    if (workSessions.length > 0) {
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      setCurrentMonth(currentMonthStart);
    }
  }, [workSessions.length]);

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
  
  // Check if a date has focus sessions - improved logic
  const hasFocusOnDate = (date: Date): boolean => {
    const dateString = getDateISOString(date);
    const hasSession = workSessions.some(session => session.date === dateString);
    
    // Temporary debug for critical dates
    if (dateString === getDateISOString(new Date())) {
      console.log(`Today (${dateString}): has session = ${hasSession}`);
    }
    if (hasSession) {
      console.log(`Date ${dateString} has work session`);
    }
    
    return hasSession;
  };

  useEffect(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    // Get first day of the month
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay()); // Go to start of week
    
    const days: Array<{ date: Date, hasFocused: boolean } | null> = [];
    
    // Generate 5 weeks of days (35 days total) - optimized from 6x7 to 5x7
    for (let i = 0; i < 35; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      
      // Only show days if they're in the current month or adjacent months
      if (currentDate.getMonth() === month || 
          Math.abs(currentDate.getMonth() - month) === 1 ||
          (month === 0 && currentDate.getMonth() === 11) ||
          (month === 11 && currentDate.getMonth() === 0)) {
        const hasFocused = hasFocusOnDate(currentDate);
        const dateString = getDateISOString(currentDate);
        
        days.push({
          date: currentDate,
          hasFocused: hasFocused
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
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate < today;
  };

  // Get day styling classes - improved logic
  const getDayClasses = (day: { date: Date, hasFocused: boolean }) => {
    const baseClasses = 'w-8 h-8 rounded-full flex items-center justify-center text-xs cursor-pointer transition-all duration-200';
    
    if (isToday(day.date)) {
      // Current day: red stroke (border)
      return `${baseClasses} bg-white border-2 border-primary border-dashed text-gray-700 font-medium`;
    } else if (isPastDay(day.date)) {
      if (day.hasFocused) {
        // Past day with work: red background
        return `${baseClasses} bg-primary text-white hover:bg-opacity-90 font-medium`;
      } else {
        // Past day without work: gray
        return `${baseClasses} bg-white border border-gray-200 text-gray-400 hover:bg-gray-50`;
      }
    } else {
      // Future day: light gray
      return `${baseClasses} bg-white border border-gray-200 text-gray-300`;
    }
  };

  // Test function to create work sessions
  const handleCreateTestSessions = async () => {
    if (user?.uid) {
      await createTestWorkSessions(
        user.uid,
        'test-task-id',
        'test-project-id'
      );
    }
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
          {/* Temporary test button */}
          {workSessions.length === 0 && (
            <button
              onClick={handleCreateTestSessions}
              className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Add Test Data
            </button>
          )}
          
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
                className={`${getDayClasses(day)}
                  ${selectedDate && compareDates(day.date, selectedDate)
                    ? 'ring-2 ring-primary ring-offset-2' 
                    : ''
                  }
                `}
                onClick={() => handleDayClick(day)}
              >
                {day.date.getDate()}
              </div>
            ) : (
              <div></div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}; 