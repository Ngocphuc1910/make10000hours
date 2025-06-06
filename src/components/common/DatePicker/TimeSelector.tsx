import React, { useState, useEffect } from 'react';

export interface TimeSelectorProps {
  onTimeSelect?: (time: string) => void;
  showTimezone?: boolean;
  initialTime?: string;
  is24Hour?: boolean;
}

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

  // Update times when initialTime prop changes
  useEffect(() => {
    if (initialTime.includes(' - ')) {
      const [newStartTime, newEndTime] = initialTime.split(' - ');
      setStartTime(newStartTime);
      setEndTime(newEndTime);
      updateSelectedTime(newStartTime, newEndTime);
    }
  }, [initialTime]);

  const updateSelectedTime = (start: string, end: string) => {
    if (onTimeSelect) {
      onTimeSelect(`${start} - ${end}`);
    }
  };

  return (
    <div className="space-y-3 border-t border-gray-100 pt-3">
      {/* Time Settings */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-600">Time format</span>
          <span className="text-xs text-gray-600">{is24Hour ? '24 hour' : '12 hour'}</span>
        </div>
        {showTimezone && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600">Timezone</span>
            <span className="text-xs text-gray-600">{Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
          </div>
        )}
      </div>

      {/* Time Input Fields */}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <div className="text-xs text-gray-600 mb-1">Start time</div>
          <div className="relative">
            <input
              type="time"
              value={startTime}
              onChange={(e) => handleStartTimeChange(e.target.value)}
              className="w-full pl-6 pr-2 py-1.5 border border-gray-200 rounded-md text-xs text-gray-700 focus:outline-none"
              onFocus={(e) => e.target.style.borderColor = '#BB5F5A'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            />
            <div className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 flex items-center justify-center text-gray-400">
              <i className="ri-time-line text-xs"></i>
            </div>
          </div>
        </div>
        <div className="flex-1">
          <div className="text-xs text-gray-600 mb-1">End time</div>
          <div className="relative">
            <input
              type="time"
              value={endTime}
              onChange={(e) => handleEndTimeChange(e.target.value)}
              className="w-full pl-6 pr-2 py-1.5 border border-gray-200 rounded-md text-xs text-gray-700 focus:outline-none"
              onFocus={(e) => e.target.style.borderColor = '#BB5F5A'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            />
            <div className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 flex items-center justify-center text-gray-400">
              <i className="ri-time-line text-xs"></i>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimeSelector; 