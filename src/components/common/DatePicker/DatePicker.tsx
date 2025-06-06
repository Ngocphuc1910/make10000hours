import React, { useState, useEffect } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, startOfWeek, endOfWeek } from 'date-fns';
import TimeSelector from './TimeSelector';

export interface DatePickerProps {
  selectedDate?: Date;
  onDateSelect: (date: Date) => void;
  includeTime?: boolean;
  onTimeSelect?: (time: string) => void;
  onTimeToggle?: (enabled: boolean) => void;
  onConfirm?: () => void;
  onClear?: () => void;
  className?: string;
  minDate?: Date;
  maxDate?: Date;
  initialMonth?: Date;
  showTimezone?: boolean;
  initialStartTime?: string;
  initialEndTime?: string;
}

export const DatePicker: React.FC<DatePickerProps> = ({
  selectedDate,
  onDateSelect,
  includeTime = false,
  onTimeSelect,
  onTimeToggle,
  onConfirm,
  onClear,
  className = '',
  minDate,
  maxDate,
  initialMonth = new Date(),
  showTimezone = false,
  initialStartTime = '09:00',
  initialEndTime = '10:00',
}) => {
  const [currentMonth, setCurrentMonth] = useState(initialMonth);
  const [showTimeSelector, setShowTimeSelector] = useState(includeTime);
  const [selectedTime, setSelectedTime] = useState('00:00 - 00:00');

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  
  // Get the start and end of the calendar view (including days from previous/next month)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const handleDateClick = (date: Date) => {
    onDateSelect(date);
    // Update current month to match selected date
    if (date.getMonth() !== currentMonth.getMonth() || date.getFullYear() !== currentMonth.getFullYear()) {
      setCurrentMonth(date);
    }
  };

  const handleTimeToggle = (enabled: boolean) => {
    setShowTimeSelector(enabled);
    onTimeToggle?.(enabled);
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    onTimeSelect?.(time);
  };

  const handleClear = () => {
    setSelectedTime('00:00 - 00:00');
    onClear?.();
  };

  const handleConfirm = () => {
    onConfirm?.();
  };

  // Format the selected date for display
  const getDisplayDate = () => {
    if (!selectedDate) return 'Select a date';
    return format(selectedDate, 'MMM dd, yyyy');
  };

  return (
    <div className={`bg-white rounded-lg shadow-lg border border-gray-200 w-[300px] ${className}`}>
      <div className="p-3">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-3">
          <button 
            className="p-1.5 hover:bg-gray-100 rounded-full text-gray-600 transition-colors"
            onClick={handlePrevMonth}
            type="button"
          >
            <i className="ri-arrow-left-s-line text-base"></i>
          </button>
          <h3 className="text-sm font-medium text-gray-800">
            {format(currentMonth, 'MMMM yyyy')}
          </h3>
          <button 
            className="p-1.5 hover:bg-gray-100 rounded-full text-gray-600 transition-colors"
            onClick={handleNextMonth}
            type="button"
          >
            <i className="ri-arrow-right-s-line text-base"></i>
          </button>
        </div>

        {/* Weekday Headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
            <div key={day} className="h-6 flex items-center justify-center text-xs font-medium text-gray-500">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1 mb-3">
          {calendarDays.map((day, idx) => {
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const isCurrentDay = isToday(day);
            const isDisabled = (minDate && day < minDate) || (maxDate && day > maxDate);
            const isCurrentMonth = day.getMonth() === currentMonth.getMonth();

            return (
              <button
                key={idx}
                onClick={() => !isDisabled && handleDateClick(day)}
                disabled={isDisabled}
                className={`
                  h-7 w-7 flex items-center justify-center text-xs rounded-full transition-colors
                  ${isDisabled ? 'text-gray-300 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-100'}
                  ${!isCurrentMonth ? 'text-gray-400' : ''}
                  ${isSelected ? 'text-white font-medium' : ''}
                  ${!isSelected && isCurrentDay ? 'text-[#BB5F5A] font-medium' : ''}
                `}
                style={isSelected ? { backgroundColor: '#BB5F5A' } : {}}
              >
                {format(day, 'd')}
              </button>
            );
          })}
        </div>

        {/* Time Selection Toggle */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600">Include time</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={showTimeSelector}
                onChange={(e) => handleTimeToggle(e.target.checked)}
                className="sr-only"
              />
              <div 
                className={`relative w-9 h-5 rounded-full transition-colors ${showTimeSelector ? '' : 'bg-gray-200'}`}
                style={showTimeSelector ? { backgroundColor: '#BB5F5A' } : {}}
              >
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${showTimeSelector ? 'translate-x-4' : 'translate-x-0'}`}></div>
              </div>
            </label>
          </div>

          {/* Time Selector Component */}
          {showTimeSelector && (
            <TimeSelector
              onTimeSelect={handleTimeSelect}
              showTimezone={showTimezone}
              initialTime={`${initialStartTime} - ${initialEndTime}`}
            />
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
          <button
            onClick={handleClear}
            className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 transition-colors"
          >
            Clear
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-1.5 text-xs text-white rounded-md transition-colors"
            style={{ backgroundColor: '#BB5F5A' }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

export default DatePicker; 