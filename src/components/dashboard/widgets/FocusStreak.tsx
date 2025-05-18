import React, { useState, useEffect } from 'react';
import Card from '../../ui/Card';
import { Icon } from '../../ui/Icon';
import { useDashboardStore } from '../../../store/useDashboardStore';

export const FocusStreak: React.FC = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date(2025, 4)); // May 2025
  const { selectedDate, setSelectedDate } = useDashboardStore();
  
  // When selectedDate changes from outside, update component if needed
  useEffect(() => {
    // If the selected date is in a different month, update currentMonth
    if (selectedDate.getMonth() !== currentMonth.getMonth() || 
        selectedDate.getFullYear() !== currentMonth.getFullYear()) {
      setCurrentMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth()));
    }
  }, [selectedDate, currentMonth]);
  
  // Mock data for focus streak
  const streakData = {
    currentStreak: 5,
    longestStreak: 12,
    totalFocusDays: 87,
    // Mock data for focus days (1 = focused, 0 = not focused)
    calendarData: Array.from({ length: 31 }, (_, i) => {
      // First 16 days of May (up to the current day)
      if (i < 16) {
        return Math.random() > 0.3 ? 1 : 0; // 70% chance of having focused
      }
      // Future days are undefined
      return undefined;
    })
  };
  
  // Days of the week
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  // Get the first day of the month (0 = Sunday, 1 = Monday, etc.)
  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };
  
  // Get the number of days in the month
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };
  
  // Navigate to previous month
  const gotoPrevMonth = () => {
    setCurrentMonth(prev => {
      const prevMonth = new Date(prev);
      prevMonth.setMonth(prev.getMonth() - 1);
      return prevMonth;
    });
  };
  
  // Navigate to next month
  const gotoNextMonth = () => {
    setCurrentMonth(prev => {
      const nextMonth = new Date(prev);
      nextMonth.setMonth(prev.getMonth() + 1);
      return nextMonth;
    });
  };
  
  // Format month and year
  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };
  
  // Handle day click - update selected date in store
  const handleDayClick = (date: Date, hasFocusTime: boolean) => {
    // Only allow clicking on past days or today
    const today = new Date(2025, 4, 16); // Mock current date
    if (date <= today) {
      setSelectedDate(date);
    }
  };
  
  // Generate calendar grid
  const generateCalendarGrid = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = getFirstDayOfMonth(year, month);
    const totalDays = getDaysInMonth(year, month);
    const today = new Date(2025, 4, 16); // Mock current date as May 16, 2025
    
    // Create empty cells for days before the first day of the month
    const blanks = Array(firstDay).fill(null).map((_, i) => (
      <div key={`blank-${i}`}></div>
    ));
    
    // Create cells for each day of the month
    const daysArray = Array.from({ length: totalDays }, (_, i) => {
      const day = i + 1;
      const date = new Date(year, month, day);
      const isToday = date.toDateString() === today.toDateString();
      const isPastDay = date < today;
      const isSelected = date.toDateString() === selectedDate.toDateString();
      
      // For the demo, use the mock data for the current month (May 2025)
      // and generate random data for other months
      let hasFocusTime = false;
      if (month === 4 && year === 2025 && day <= 16) { // May 2025
        hasFocusTime = streakData.calendarData[day - 1] === 1;
      } else if (isPastDay) {
        hasFocusTime = Math.random() > 0.3; // 70% chance for past days
      }
      
      let dayClass = '';
      if (isPastDay && hasFocusTime) {
        dayClass = `w-8 h-8 rounded-full bg-primary flex items-center justify-center text-xs text-white cursor-pointer hover:bg-opacity-90 ${
          isSelected ? 'ring-2 ring-offset-2 ring-primary' : ''
        }`;
      } else if (isPastDay) {
        dayClass = `w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-xs text-gray-400 cursor-pointer hover:bg-gray-50 ${
          isSelected ? 'ring-2 ring-offset-2 ring-primary' : ''
        }`;
      } else if (isToday) {
        dayClass = `w-8 h-8 rounded-full bg-white border-2 border-primary border-dashed flex items-center justify-center text-xs text-gray-600 ${
          isSelected ? 'ring-2 ring-offset-2 ring-primary' : ''
        }`;
      } else {
        dayClass = 'w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-xs text-gray-300';
      }
      
      return (
        <div key={`day-${day}`} className="flex items-center justify-center">
          <div 
            className={dayClass}
            onClick={() => handleDayClick(date, hasFocusTime)}
          >
            {day}
          </div>
        </div>
      );
    });
    
    return [...blanks, ...daysArray];
  };

  return (
    <Card 
      title="Focus Streak"
      action={
        <div className="flex items-center space-x-4">
          <div className="flex items-center text-sm text-green-500 font-medium">
            <Icon name="fire-line" className="mr-1" />
            <span>{streakData.currentStreak} days</span>
          </div>
          <div className="flex items-center space-x-2">
            <button 
              className="p-1.5 rounded-full hover:bg-gray-100"
              onClick={gotoPrevMonth}
            >
              <Icon name="arrow-left-s-line" className="text-gray-600" />
            </button>
            <span className="text-sm font-medium text-gray-700">
              {formatMonthYear(currentMonth)}
            </span>
            <button 
              className="p-1.5 rounded-full hover:bg-gray-100"
              onClick={gotoNextMonth}
            >
              <Icon name="arrow-right-s-line" className="text-gray-600" />
            </button>
          </div>
        </div>
      }
    >
      {/* Calendar header (weekdays) */}
      <div className="grid grid-cols-7 gap-2 mb-4">
        {weekdays.map(day => (
          <div key={day} className="flex flex-col items-center">
            <div className="text-xs text-gray-500 mb-2">{day}</div>
          </div>
        ))}
      </div>
      
      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-2">
        {generateCalendarGrid()}
      </div>
      
      {/* Streak stats */}
      <div className="flex items-center justify-between mt-6">
        <div className="flex items-center">
          <span className="text-sm text-gray-600 mr-2">Longest streak</span>
          <span className="text-sm font-medium text-gray-800">{streakData.longestStreak} days</span>
        </div>
        <div className="flex items-center">
          <span className="text-sm text-gray-600 mr-2">Current streak</span>
          <span className="text-sm font-medium text-gray-800">{streakData.currentStreak} days</span>
        </div>
        <div className="flex items-center">
          <span className="text-sm text-gray-600 mr-2">Total focus days</span>
          <span className="text-sm font-medium text-gray-800">{streakData.totalFocusDays} days</span>
        </div>
      </div>
    </Card>
  );
}; 