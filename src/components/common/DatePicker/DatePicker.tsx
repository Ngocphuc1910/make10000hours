import React, { useState, useEffect, useRef } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, startOfWeek, endOfWeek, isWithinInterval, addDays } from 'date-fns';
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
  // Multi-day support
  isMultiDayEnabled?: boolean;
  selectedEndDate?: Date;
  onEndDateSelect?: (date: Date) => void;
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
  // Multi-day props
  isMultiDayEnabled = false,
  selectedEndDate,
  onEndDateSelect,
}) => {
  const [currentMonth, setCurrentMonth] = useState(initialMonth);
  const [showTimeSelector, setShowTimeSelector] = useState(includeTime);
  const [selectedTime, setSelectedTime] = useState('00:00 - 00:00');
  const [isSelectingEndDate, setIsSelectingEndDate] = useState(false);
  
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

  // Reset end date selection state when multi-day mode changes
  useEffect(() => {
    if (!isMultiDayEnabled) {
      setIsSelectingEndDate(false);
    }
  }, [isMultiDayEnabled]);

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
    if (isMultiDayEnabled && isSelectingEndDate) {
      // Selecting end date for multi-day range
      onEndDateSelect?.(date);
      setIsSelectingEndDate(false);
    } else {
      // Selecting start date or single date
      onDateSelect(date);
      
      // For multi-day mode, if we just selected a start date and no end date exists yet, 
      // automatically switch to selecting end date
      if (isMultiDayEnabled && !selectedEndDate) {
        setIsSelectingEndDate(true);
      }
    }
    
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
    setIsSelectingEndDate(false);
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
              const isStartDate = selectedDate && isSameDay(day, selectedDate);
              const isEndDate = selectedEndDate && isSameDay(day, selectedEndDate);
              const isCurrentDay = isToday(day);
              const isDisabled = (minDate && day < minDate) || (maxDate && day > maxDate);
              const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
              
              // Check if this day is within the selected range (for multi-day)
              const isInRange = isMultiDayEnabled && selectedDate && selectedEndDate && 
                selectedDate < selectedEndDate && 
                isWithinInterval(day, { start: selectedDate, end: selectedEndDate });
              
              // Check if this day is invalid for end date selection (before start date)
              const isInvalidEndDate = isMultiDayEnabled && isSelectingEndDate && selectedDate && day < selectedDate;

              return (
                <button
                  key={idx}
                  onClick={() => !isDisabled && !isInvalidEndDate && handleDateClick(day)}
                  disabled={isDisabled || isInvalidEndDate}
                  className={`
                    h-7 w-7 flex items-center justify-center text-xs transition-colors relative
                    ${isDisabled || isInvalidEndDate ? 'text-text-secondary opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-background-container'}
                    ${!isCurrentMonth ? 'text-text-secondary opacity-60' : 'text-text-primary'}
                    ${isStartDate || isEndDate ? 'text-white font-medium rounded-full' : isInRange ? 'bg-[#BB5F5A] bg-opacity-20 text-[#BB5F5A] font-medium' : 'rounded-full'}
                    ${!isStartDate && !isEndDate && !isInRange && isCurrentDay ? 'text-[#BB5F5A] font-medium' : ''}
                  `}
                  style={(isStartDate || isEndDate) ? { backgroundColor: '#BB5F5A' } : {}}
                >
                  {format(day, 'd')}
                  {isSelectingEndDate && !isInvalidEndDate && day >= selectedDate! && (
                    <div className="absolute inset-0 border-2 border-[#BB5F5A] border-opacity-50 rounded-full pointer-events-none" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Multi-day Range Info */}
          {isMultiDayEnabled && (
            <div className="mb-3 p-2 bg-background-container rounded-md">
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-secondary">
                  {isSelectingEndDate ? 'Select end date:' : 'Date range:'}
                </span>
                <div className="flex gap-2">
                  {selectedDate && !isSelectingEndDate && (
                    <button
                      onClick={() => setIsSelectingEndDate(true)}
                      className="text-[#BB5F5A] hover:text-[#A04F4A] transition-colors"
                    >
                      Change end date
                    </button>
                  )}
                  {selectedDate && selectedEndDate && selectedEndDate !== selectedDate && (
                    <button
                      onClick={() => {
                        onEndDateSelect?.(selectedDate); // Reset end date to start date (single day)
                        setIsSelectingEndDate(false);
                      }}
                      className="text-[#BB5F5A] hover:text-[#A04F4A] transition-colors"
                    >
                      Make single day
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs">
                <span className="text-text-primary font-medium">
                  {selectedDate ? format(selectedDate, 'MMM dd, yyyy') : 'No start date'}
                </span>
                {isMultiDayEnabled && (
                  <>
                    <span className="text-text-secondary">→</span>
                    <span className="text-text-primary font-medium">
                      {selectedEndDate && selectedEndDate !== selectedDate ? 
                        format(selectedEndDate, 'MMM dd, yyyy') : 
                        isSelectingEndDate ? 'Choose end date' : 'Same day'
                      }
                    </span>
                  </>
                )}
              </div>
              {isSelectingEndDate && (
                <div className="mt-2 text-xs text-text-secondary">
                  Click a date on or after {selectedDate ? format(selectedDate, 'MMM dd') : 'start date'} for the end date
                </div>
              )}
            </div>
          )}

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