import React, { useState, useEffect } from 'react';
import Card from '../../ui/Card';
import { useFocusStore } from '../../../store/useFocusStore';

export const FocusStreak: React.FC = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarDays, setCalendarDays] = useState<Array<{ date: Date, hasFocused: boolean } | null>>([]);
  const { focusStreak, setSelectedDate, selectedDate } = useFocusStore();

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
  const compareDates = (date1: Date, date2: Date | string): boolean => {
    const d1 = new Date(date1).toDateString();
    const d2 = typeof date2 === 'string' ? new Date(date2).toDateString() : date2.toDateString();
    return d1 === d2;
  };
  
  // Generate calendar data for current month view
  useEffect(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const startingDayOfWeek = firstDay.getDay(); // 0 for Sunday, 1 for Monday, etc.
    const daysInMonth = lastDay.getDate();
    
    const days: Array<{ date: Date, hasFocused: boolean } | null> = [];
    
    // Add empty spots for days before the first of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      
      // Check if this date is in our streak data
      const streakDay = focusStreak.streakDates.find(
        sd => {
          try {
            // Handle both Date objects and string dates
            const sdDate = sd.date instanceof Date ? sd.date : new Date(sd.date);
            return compareDates(date, sdDate);
          } catch (error) {
            console.error('Error comparing dates:', error);
            return false;
          }
        }
      );
      
      days.push({
        date,
        hasFocused: streakDay ? streakDay.hasFocused : false
      });
    }
    
    setCalendarDays(days);
  }, [currentMonth, focusStreak.streakDates]);

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
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="flex flex-col items-center">
            <div className="text-xs text-gray-500 mb-2">{day}</div>
          </div>
        ))}
      </div>
      
      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-2">
        {calendarDays.map((day, i) => (
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