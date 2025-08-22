import React, { useState, useEffect, useRef } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
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

// Theme constants - replace hardcoded colors
const THEME = {
  primary: '#BA4949', // Using the theme primary color
  primaryHover: '#A04F4A',
  primaryLight: 'rgba(186, 73, 73, 0.1)',
  primaryBorder: 'rgba(186, 73, 73, 0.3)',
  rangeBackground: 'rgba(186, 73, 73, 0.08)',
  switchGreen: '#22c55e', // Green color for date range switch
} as const;

// Date selection modes
type DateMode = 'single' | 'range';

// Utility functions for cleaner className logic
const getCalendarDayClasses = (params: {
  isDisabled: boolean;
  isCurrentMonth: boolean;
  isCurrentDay: boolean;
  isSelected: boolean;
  isInRange: boolean;
  isRangeStart: boolean;
  isRangeEnd: boolean;
}) => {
  const baseClasses = 'h-6 w-6 flex items-center justify-center text-xs transition-all duration-200 relative';
  
  if (params.isDisabled) {
    return `${baseClasses} text-text-secondary opacity-50 cursor-not-allowed`;
  }

  if (params.isSelected || params.isRangeStart || params.isRangeEnd) {
    return `${baseClasses} text-white font-semibold rounded-full cursor-pointer shadow-sm z-10 relative focus:outline-none`;
  }

  if (params.isInRange) {
    return `${baseClasses} text-text-primary font-medium cursor-pointer`;
  }

  if (params.isCurrentDay) {
    return `${baseClasses} text-primary font-semibold cursor-pointer rounded-full hover:bg-background-container`;
  }

  const textClass = params.isCurrentMonth ? 'text-text-primary' : 'text-text-secondary opacity-60';
  return `${baseClasses} ${textClass} cursor-pointer rounded-full hover:bg-background-container`;
};

const getCalendarDayStyles = (params: {
  isSelected: boolean;
  isInRange: boolean;
  isRangeStart: boolean;
  isRangeEnd: boolean;
}) => {
  if (params.isSelected || params.isRangeStart || params.isRangeEnd) {
    return { backgroundColor: THEME.primary };
  }

  if (params.isInRange) {
    return { backgroundColor: THEME.primaryLight };
  }

  return {};
};

// Helper function to get range background positioning
const getRangeBackgroundClasses = (params: {
  isInRange: boolean;
  isRangeStart: boolean;
  isRangeEnd: boolean;
  dayIndex: number;
}) => {
  if (!params.isInRange && !params.isRangeStart && !params.isRangeEnd) {
    return '';
  }

  let classes = 'absolute inset-0 -z-10';
  
  if (params.isRangeStart && params.isRangeEnd) {
    // Single day range
    classes += ' rounded-full';
  } else if (params.isRangeStart) {
    // Start of range - rounded left
    classes += ' rounded-l-full';
  } else if (params.isRangeEnd) {
    // End of range - rounded right
    classes += ' rounded-r-full';
  } else if (params.isInRange) {
    // Middle of range - no rounding
    classes += '';
  }
  
  return classes;
};

// Helper function to check if we have a valid date range
const hasValidDateRange = (startDate?: Date, endDate?: Date): boolean => {
  return !!(startDate && endDate && startDate.getTime() !== endDate.getTime());
};

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
  // State management
  const [currentMonth, setCurrentMonth] = useState(initialMonth);
  const [showTimeSelector, setShowTimeSelector] = useState(includeTime);
  const [selectedTime, setSelectedTime] = useState(`${initialStartTime} - ${initialEndTime}`);
  // Initialize isDateRangeEnabled based on actual data
  const [isDateRangeEnabled, setIsDateRangeEnabled] = useState(() => {
    return isMultiDayEnabled && hasValidDateRange(selectedDate, selectedEndDate);
  });
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  
  const datePickerRef = useRef<HTMLDivElement>(null);

  // Smart positioning
  const position = useSmartPosition({
    isOpen,
    triggerRef: triggerRef || { current: null },
    contentRef: datePickerRef,
    preferredPlacement: 'bottom',
    offset: 8,
    viewportPadding: 12,
    modalThreshold: 9999
  });

  // Calendar calculations
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Consolidated effects
  useEffect(() => {
    setShowTimeSelector(includeTime);
  }, [includeTime]);

  // Only sync on mount/initial load, not during user interaction
  useEffect(() => {
    const shouldEnableRange = isMultiDayEnabled && hasValidDateRange(selectedDate, selectedEndDate);
    setIsDateRangeEnabled(shouldEnableRange);
  }, [isMultiDayEnabled]); // Removed selectedDate, selectedEndDate dependencies

  // Removed delayed recalculation to prevent visible repositioning
  // The position should be calculated once and stay stable

  // Handle click outside to close
  useEffect(() => {
    if (!isOpen || !onClose) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
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

    document.addEventListener('mousedown', handleClickOutside, true);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose, triggerRef]);

  // Event handlers
  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const handleDateClick = (date: Date) => {
    if (!isDateRangeEnabled) {
      onDateSelect(date);
      // Clear end date when not in range mode
      if (onEndDateSelect) {
        onEndDateSelect(date);
      }
    } else {
      // Range mode logic - proper implementation
      if (!selectedDate || (selectedDate && selectedEndDate && selectedEndDate > selectedDate)) {
        // Start new range selection - only set start date
        onDateSelect(date);
        onEndDateSelect?.(date); // Clear end date to same as start temporarily
      } else if (selectedDate && (!selectedEndDate || selectedEndDate <= selectedDate)) {
        // We have start date, now setting end date
        if (date > selectedDate) {
          // Date is after start date - set as end date
          onEndDateSelect?.(date);
        } else if (date < selectedDate) {
          // Date is before start date - swap them
          onEndDateSelect?.(selectedDate); // Old start becomes end
          onDateSelect(date); // New date becomes start
        } else {
          // Same date clicked - keep as single date
          onEndDateSelect?.(date);
        }
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

  const handleCancel = () => {
    // Cancel changes and close DatePicker without applying
    onClose?.();
  };

  const handleConfirm = () => {
    onConfirm?.();
  };

  // Don't render if not open
  if (!isOpen) return null;

  // Dynamic classes for positioning - Fixed to prevent visible repositioning
  const getPlacementClasses = () => {
    const baseClasses = 'bg-background-secondary rounded-lg shadow-lg border border-border w-[300px] fixed z-[1001]';
    
    // Use visibility instead of opacity to completely hide during positioning
    if (!position.isReady) {
      return `${baseClasses} invisible`;
    }
    
    // Once positioned, show immediately without animation to prevent repositioning flash
    return `${baseClasses} visible`;
  };

  const isRangeMode = isDateRangeEnabled && isMultiDayEnabled;
  const hasDateRange = selectedDate && selectedEndDate && selectedEndDate > selectedDate;
  const hasValidRange = hasDateRange; // For cleaner code
  const isSelectingRange = isRangeMode && selectedDate && (!selectedEndDate || selectedEndDate <= selectedDate);
  
  // For hover preview during range selection
  const previewEndDate = isSelectingRange && hoverDate && hoverDate >= selectedDate ? hoverDate : null;
  const hasHoverRange = selectedDate && previewEndDate && previewEndDate > selectedDate;

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
        {/* Selected Date Display */}
        {selectedDate && (
          <div className="mb-3 p-2 bg-background-container rounded-md">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-text-primary">
                {format(selectedDate, 'MMM dd, yyyy')}
              </span>
              {isDateRangeEnabled && hasValidRange && (
                <>
                  <i className="ri-arrow-right-line text-text-secondary"></i>
                  <span className="font-medium text-text-primary">
                    {format(selectedEndDate, 'MMM dd, yyyy')}
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-3">
          <button 
            className="p-1.5 hover:bg-background-container rounded-full text-text-secondary hover:text-text-primary transition-colors"
            onClick={handlePrevMonth}
            type="button"
            aria-label="Previous month"
          >
            <i className="ri-arrow-left-s-line text-lg"></i>
          </button>
          <h3 className="text-sm font-medium text-text-primary">
            {format(currentMonth, 'MMMM yyyy')}
          </h3>
          <button 
            className="p-1.5 hover:bg-background-container rounded-full text-text-secondary hover:text-text-primary transition-colors"
            onClick={handleNextMonth}
            type="button"
            aria-label="Next month"
          >
            <i className="ri-arrow-right-s-line text-lg"></i>
          </button>
        </div>

        {/* Weekday Headers */}
        <div className="grid grid-cols-7 gap-0 mb-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="h-6 flex items-center justify-center text-xs font-medium text-text-secondary">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div 
          className="grid grid-cols-7 gap-1 mb-3"
          onMouseLeave={() => {
            if (isSelectingRange) {
              setHoverDate(null);
            }
          }}
        >
          {calendarDays.map((day, idx) => {
            const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
            const isCurrentDay = isToday(day);
            const isDisabled = (minDate && day < minDate) || (maxDate && day > maxDate);
            
            // Date selection states
            const isStartDate = selectedDate && isSameDay(day, selectedDate);
            const isEndDate = isDateRangeEnabled && selectedEndDate && isSameDay(day, selectedEndDate) && hasValidRange;
            const isSelected = isStartDate || isEndDate;
            
            // Range states - only show range when range mode is enabled and we have a valid range
            const isInRange = isDateRangeEnabled && isRangeMode && hasValidRange && 
              isWithinInterval(day, { start: selectedDate, end: selectedEndDate }) &&
              !isStartDate && !isEndDate;
              
            // Hover preview for range selection (when selecting second date)
            const isHoverPreviewEnd = isSelectingRange && hoverDate && isSameDay(day, hoverDate);
            const isHoverPreviewRange = isSelectingRange && hasHoverRange &&
              isWithinInterval(day, { start: selectedDate, end: previewEndDate }) &&
              !isStartDate && !isHoverPreviewEnd;
            const isHoverPreview = isHoverPreviewEnd || isHoverPreviewRange;

            const dayClasses = getCalendarDayClasses({
              isDisabled,
              isCurrentMonth,
              isCurrentDay,
              isSelected: (isSelected || isHoverPreviewEnd) && !isDateRangeEnabled, // Only show circle for single dates
              isInRange: isInRange || isHoverPreviewRange,
              isRangeStart: isDateRangeEnabled && (!!isStartDate && (hasValidRange || hasHoverRange)),
              isRangeEnd: isDateRangeEnabled && (!!isEndDate && hasValidRange || isHoverPreviewEnd),
            });

            const dayStyles = getCalendarDayStyles({
              isSelected: (isSelected || isHoverPreviewEnd) && !isDateRangeEnabled, // Only apply background for single dates
              isInRange: isInRange || isHoverPreviewRange,
              isRangeStart: isDateRangeEnabled && (!!isStartDate && (hasValidRange || hasHoverRange)),
              isRangeEnd: isDateRangeEnabled && (!!isEndDate && hasValidRange || isHoverPreviewEnd),
            });

            // Special styles for hover preview
            if (isHoverPreview && !isSelected) {
              if (isHoverPreviewEnd) {
                // Make hover end date look exactly like selected date
                dayStyles.backgroundColor = THEME.primary;
                dayStyles.opacity = '1';
              } else {
                // Light background for range preview
                dayStyles.backgroundColor = 'rgba(186, 73, 73, 0.05)';
              }
            }

            const rangeBackgroundClasses = getRangeBackgroundClasses({
              isInRange: isInRange || isHoverPreviewRange,
              isRangeStart: isDateRangeEnabled && (!!isStartDate && (hasValidRange || hasHoverRange)),
              isRangeEnd: isDateRangeEnabled && (!!isEndDate && hasValidRange || isHoverPreviewEnd),
              dayIndex: idx % 7,
            });

            return (
              <div key={idx} className="relative flex items-center justify-center h-7 group">
                {/* Range background - show oval shapes for start/end dates and background for middle range */}
                {isDateRangeEnabled && (isInRange || isHoverPreviewRange || (isStartDate && (hasValidRange || hasHoverRange)) || (isEndDate && hasValidRange) || isHoverPreviewEnd) && (
                  <div 
                    className={rangeBackgroundClasses}
                    style={{
                      backgroundColor: (isStartDate || isEndDate || isHoverPreviewEnd) ? THEME.primary : (isHoverPreview ? 'rgba(186, 73, 73, 0.05)' : THEME.primaryLight),
                      margin: '2px 0'
                    }}
                  />
                )}
                
                <button
                  onClick={() => !isDisabled && handleDateClick(day)}
                  onMouseEnter={() => {
                    if (!isDisabled && isSelectingRange && day >= selectedDate) {
                      setHoverDate(day);
                    }
                  }}
                  disabled={isDisabled}
                  className={dayClasses}
                  style={{
                    ...dayStyles,
                    outline: 'none',
                    border: 'none'
                  }}
                  aria-label={format(day, 'MMMM d, yyyy')}
                  type="button"
                  title={isRangeMode && selectedDate && !isDisabled ? 
                    (isStartDate ? 'Range start' : isEndDate ? 'Range end' : isInRange ? 'In selected range' : 'Click to select date') :
                    undefined
                  }
                >
                  {format(day, 'd')}
                </button>
              </div>
            );
          })}
        </div>

        {/* Time Selection Toggle */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between py-1.5 border-t border-border">
            <div className="flex items-center gap-2">
              <i className="ri-time-line text-text-secondary"></i>
              <span className="text-sm text-text-secondary">Include time</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={showTimeSelector}
                onChange={(e) => handleTimeToggle(e.target.checked)}
                className="sr-only"
              />
              <div 
                className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${
                  showTimeSelector ? 'shadow-sm' : 'bg-background-container'
                }`}
                style={showTimeSelector ? { backgroundColor: THEME.switchGreen } : {}}
              >
                <div 
                  className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-200 shadow-sm ${
                    showTimeSelector ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </div>
            </label>
          </div>

          {/* Date Range Toggle */}
          <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <i className="ri-calendar-2-line text-text-secondary"></i>
                <span className="text-sm text-text-secondary">Date Range</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDateRangeEnabled}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    setIsDateRangeEnabled(enabled);
                    if (!enabled) {
                      // When turning off range mode, clear end date selection
                      if (selectedDate) {
                        onEndDateSelect?.(selectedDate);
                      }
                    }
                  }}
                  className="sr-only"
                />
                <div 
                  className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${
                    isDateRangeEnabled ? 'shadow-sm' : 'bg-background-container'
                  }`}
                  style={isDateRangeEnabled ? { backgroundColor: THEME.switchGreen } : {}}
                >
                  <div 
                    className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-200 shadow-sm ${
                      isDateRangeEnabled ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
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
            onClick={handleCancel}
            className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1"
            type="button"
          >
            <i className="ri-close-line text-xs"></i>
            Cancel
          </button>
          <button
              onClick={handleConfirm}
              className="px-4 py-1.5 text-sm text-white rounded-md transition-all duration-200 hover:shadow-md font-medium flex items-center gap-1"
              style={{ backgroundColor: THEME.primary }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = THEME.primaryHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = THEME.primary;
              }}
              type="button"
            >
              <i className="ri-check-line text-xs"></i>
              Confirm
            </button>
        </div>
      </div>
    </div>
  );
};

export default DatePicker;