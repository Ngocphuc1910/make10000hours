import React, { useState, useEffect, useRef } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, startOfWeek, endOfWeek } from 'date-fns';
import { useSmartPosition } from '../../../hooks/useSmartPosition';
import TimeSelector from './TimeSelector';

export interface DatePickerProps {
  selectedDate?: Date;
  onDateSelect: (date: Date) => void;
  includeTime?: boolean;
  onTimeSelect?: (time: string) => void;
  onTimeToggle?: (enabled: boolean) => void;
  onConfirm?: () => void;
  onClear?: () => void;
  onClose?: () => void;
  className?: string;
  minDate?: Date;
  maxDate?: Date;
  initialMonth?: Date;
  showTimezone?: boolean;
  initialStartTime?: string;
  initialEndTime?: string;
  triggerRef?: React.RefObject<HTMLElement | null>;
  isOpen?: boolean;
}

export const DatePicker: React.FC<DatePickerProps> = ({
  selectedDate,
  onDateSelect,
  includeTime = false,
  onTimeSelect,
  onTimeToggle,
  onConfirm,
  onClear,
  onClose,
  className = '',
  minDate,
  maxDate,
  initialMonth = new Date(),
  showTimezone = false,
  initialStartTime = '09:00',
  initialEndTime = '10:00',
  triggerRef,
  isOpen = true,
}) => {
  const [currentMonth, setCurrentMonth] = useState(initialMonth);
  const [showTimeSelector, setShowTimeSelector] = useState(includeTime);
  const [selectedTime, setSelectedTime] = useState('00:00 - 00:00');
  
  const datePickerRef = useRef<HTMLDivElement>(null);

  // Use smart positioning hook
  const position = useSmartPosition({
    isOpen,
    triggerRef: triggerRef || { current: null },
    contentRef: datePickerRef,
    preferredPlacement: 'bottom',
    offset: 8,
    viewportPadding: 12,
    modalThreshold: 9999 // Disable modal mode - always use popup positioning
  });

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  
  // Get the start and end of the calendar view (including days from previous/next month)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Update showTimeSelector when includeTime prop changes
  useEffect(() => {
    setShowTimeSelector(includeTime);
  }, [includeTime]);
  
  // Recalculate position when time selector visibility changes
  useEffect(() => {
    // Use a small timeout to allow the DOM to update first
    const timer = setTimeout(() => {
      position.recalculate();
    }, 100);
    
    return () => clearTimeout(timer);
  }, [showTimeSelector, position.recalculate]);

  // Initialize selected time based on props
  useEffect(() => {
    if (initialStartTime && initialEndTime) {
      setSelectedTime(`${initialStartTime} - ${initialEndTime}`);
    }
  }, [initialStartTime, initialEndTime]);

  // Handle click outside to close
  useEffect(() => {
    if (!isOpen || !onClose) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      // Check if click is outside both trigger and date picker
      if (
        datePickerRef.current && !datePickerRef.current.contains(target) &&
        triggerRef?.current && !triggerRef.current.contains(target)
      ) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    // Use capture phase to ensure we get events before they bubble
    document.addEventListener('mousedown', handleClickOutside, true);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose, triggerRef]);

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

  // Don't render if not open
  if (!isOpen) return null;

  // Get dynamic classes based on placement
  const getPlacementClasses = () => {
    const baseClasses = 'bg-background-secondary rounded-lg shadow-lg border border-border w-[300px] fixed transition-all duration-200 ease-out z-50';
    const visibilityClass = position.isReady ? 'opacity-100' : 'opacity-0 pointer-events-none';
    
    switch (position.placement) {
      case 'top':
        return `${baseClasses} ${visibilityClass} animate-slide-up`;
      case 'bottom':
      default:
        return `${baseClasses} ${visibilityClass} animate-slide-down`;
    }
  };

  return (
    <div 
        ref={datePickerRef}
        className={`${getPlacementClasses()} ${className}`}
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
          transformOrigin: position.transformOrigin,
        }}
        data-datepicker
      >
        <div className="p-3">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-3">
            <button 
              className="p-1.5 hover:bg-background-container rounded-full text-text-secondary hover:text-text-primary transition-colors"
              onClick={handlePrevMonth}
              type="button"
            >
              <i className="ri-arrow-left-s-line text-base"></i>
            </button>
            <h3 className="text-sm font-medium text-text-primary">
              {format(currentMonth, 'MMMM yyyy')}
            </h3>
            <button 
              className="p-1.5 hover:bg-background-container rounded-full text-text-secondary hover:text-text-primary transition-colors"
              onClick={handleNextMonth}
              type="button"
            >
              <i className="ri-arrow-right-s-line text-base"></i>
            </button>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
              <div key={day} className="h-6 flex items-center justify-center text-xs font-medium text-text-secondary">
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
                    ${isDisabled ? 'text-text-secondary opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-background-container'}
                    ${!isCurrentMonth ? 'text-text-secondary opacity-60' : 'text-text-primary'}
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
              <span className="text-xs text-text-secondary">Include time</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={showTimeSelector}
                  onChange={(e) => handleTimeToggle(e.target.checked)}
                  className="sr-only"
                />
                <div 
                  className={`relative w-9 h-5 rounded-full transition-colors ${showTimeSelector ? '' : 'bg-background-container'}`}
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
                initialTime={selectedTime}
                is24Hour={true}
              />
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
            <button
              onClick={handleClear}
              className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors"
            >
              Clear
            </button>
            <button
              onClick={handleConfirm}
              className="px-4 py-1.5 text-xs text-white rounded-md transition-colors hover:opacity-90"
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