import React, { useState, useEffect, useCallback, useRef } from 'react';

export interface TimeSelectorProps {
  onTimeSelect?: (time: string) => void;
  showTimezone?: boolean;
  initialTime?: string;
  is24Hour?: boolean;
}

// Theme constants - consistent with DatePicker
const THEME = {
  primary: '#BA4949',
  focusBorder: '#BA4949',
} as const;

const TimeSelector: React.FC<TimeSelectorProps> = ({
  onTimeSelect,
  showTimezone = false,
  initialTime = '09:00 - 10:00',
  is24Hour = true,
}) => {
  const [startTime, setStartTime] = useState(() => {
    // Handle both single time and time range formats
    if (initialTime.includes(' - ')) {
      return initialTime.split(' - ')[0];
    }
    return initialTime;
  });
  const [endTime, setEndTime] = useState(() => {
    // Handle both single time and time range formats
    if (initialTime.includes(' - ')) {
      return initialTime.split(' - ')[1];
    }
    // Default end time is 1 hour after start time
    const [hours, minutes] = initialTime.split(':');
    const endHour = (parseInt(hours) + 1) % 24;
    return `${endHour.toString().padStart(2, '0')}:${minutes}`;
  });

  const handleStartTimeChange = (time: string) => {
    setStartTime(time);
    updateSelectedTime(time, endTime);
  };

  const handleEndTimeChange = (time: string) => {
    setEndTime(time);
    updateSelectedTime(startTime, time);
  };

  const lastReportedTime = useRef<string>('');

  const updateSelectedTime = useCallback((start: string, end: string) => {
    const timeString = `${start} - ${end}`;
    // Only call onTimeSelect if the value actually changed
    if (onTimeSelect && timeString !== lastReportedTime.current) {
      lastReportedTime.current = timeString;
      onTimeSelect(timeString);
    }
  }, [onTimeSelect]);

  // Update times when initialTime prop changes
  useEffect(() => {
    if (initialTime.includes(' - ')) {
      const [newStartTime, newEndTime] = initialTime.split(' - ');
      // Only update if the values actually changed
      if (newStartTime !== startTime || newEndTime !== endTime) {
        setStartTime(newStartTime);
        setEndTime(newEndTime);
        updateSelectedTime(newStartTime, newEndTime);
      }
    }
  }, [initialTime, updateSelectedTime, startTime, endTime]);

  return (
    <div className="space-y-3 border-t border-border pt-3">
      {/* Time Settings */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-secondary">Time format</span>
          <span className="text-xs text-text-secondary">{is24Hour ? '24 hour' : '12 hour'}</span>
        </div>
        {showTimezone && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-secondary">Timezone</span>
            <span className="text-xs text-text-secondary">{Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
          </div>
        )}
      </div>

      {/* Time Input Fields */}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <div className="text-xs text-text-secondary mb-1">Start time</div>
          <div className="relative">
            <input
              type="time"
              value={startTime}
              onChange={(e) => handleStartTimeChange(e.target.value)}
              className="w-full pl-6 pr-2 py-1.5 border border-border rounded-md text-xs text-text-primary bg-background-primary focus:outline-none"
              onFocus={(e) => e.target.style.borderColor = THEME.focusBorder}
              onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
            />
            <div className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 flex items-center justify-center text-text-secondary">
              <i className="ri-time-line text-xs"></i>
            </div>
          </div>
        </div>
        <div className="flex-1">
          <div className="text-xs text-text-secondary mb-1">End time</div>
          <div className="relative">
            <input
              type="time"
              value={endTime}
              onChange={(e) => handleEndTimeChange(e.target.value)}
              className="w-full pl-6 pr-2 py-1.5 border border-border rounded-md text-xs text-text-primary bg-background-primary focus:outline-none"
              onFocus={(e) => e.target.style.borderColor = THEME.focusBorder}
              onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
            />
            <div className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 flex items-center justify-center text-text-secondary">
              <i className="ri-time-line text-xs"></i>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimeSelector;