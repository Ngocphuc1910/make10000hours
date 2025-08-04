import React, { useState, useEffect } from 'react';
import { useUserStore } from '../../store/userStore';
import { timezoneUtils } from '../../utils/timezoneUtils';
import { utcMonitoring } from '../../services/monitoring';

interface TimezoneSelectorProps {
  className?: string;
  showAutoDetect?: boolean;
  onTimezoneChange?: (timezone: string) => void;
}

interface TimezoneOption {
  value: string;
  label: string;
  offset: string;
  region: string;
}

export const TimezoneSelector: React.FC<TimezoneSelectorProps> = ({
  className = '',
  showAutoDetect = true,
  onTimezoneChange
}) => {
  const { user, updateTimezone, confirmTimezone, autoDetectTimezone } = useUserStore();
  const [selectedTimezone, setSelectedTimezone] = useState<string>('');
  const [detectedTimezone, setDetectedTimezone] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [timezoneOptions, setTimezoneOptions] = useState<TimezoneOption[]>([]);

  // Initialize timezone options
  useEffect(() => {
    const loadTimezones = () => {
      try {
        const now = new Date();
        const commonTimezones = [
          'UTC',
          'America/New_York',
          'America/Chicago', 
          'America/Denver',
          'America/Los_Angeles',
          'America/Toronto',
          'America/Vancouver',
          'Europe/London',
          'Europe/Paris',
          'Europe/Berlin',
          'Europe/Rome',
          'Europe/Madrid',
          'Europe/Amsterdam',
          'Asia/Tokyo',
          'Asia/Shanghai',
          'Asia/Singapore',
          'Asia/Dubai',
          'Asia/Kolkata',
          'Australia/Sydney',
          'Australia/Melbourne',
          'Australia/Perth',
        ];

        const options: TimezoneOption[] = commonTimezones.map(tz => {
          try {
            const formatter = new Intl.DateTimeFormat('en', {
              timeZone: tz,
              timeZoneName: 'short'
            });
            const parts = formatter.formatToParts(now);
            const timeZoneName = parts.find(part => part.type === 'timeZoneName')?.value || '';
            
            // Calculate offset
            const utcDate = new Date(now.getTime() + now.getTimezoneOffset() * 60000);
            const targetDate = new Date(utcDate.toLocaleString('en-US', { timeZone: tz }));
            const offsetMs = targetDate.getTime() - utcDate.getTime();
            const offsetHours = offsetMs / (1000 * 60 * 60);
            const offsetStr = offsetHours >= 0 ? `+${offsetHours}` : `${offsetHours}`;

            return {
              value: tz,
              label: tz.replace(/_/g, ' '),
              offset: `UTC${offsetStr}`,
              region: tz.split('/')[0]
            };
          } catch {
            return {
              value: tz,
              label: tz.replace(/_/g, ' '),
              offset: 'Unknown',
              region: tz.split('/')[0]
            };
          }
        });

        setTimezoneOptions(options);
      } catch (error) {
        console.error('Failed to load timezone options:', error);
      }
    };

    loadTimezones();
  }, []);

  // Initialize selected timezone from user settings
  useEffect(() => {
    if (user?.timezone) {
      setSelectedTimezone(user.timezone);
    } else {
      const current = timezoneUtils.getCurrentTimezone();
      setSelectedTimezone(current);
    }
  }, [user?.timezone]);

  // Detect current timezone
  useEffect(() => {
    const detected = timezoneUtils.getCurrentTimezone();
    setDetectedTimezone(detected);
  }, []);

  const filteredOptions = timezoneOptions.filter(option =>
    option.label.toLowerCase().includes(searchFilter.toLowerCase()) ||
    option.value.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const handleTimezoneSelect = async (timezone: string) => {
    if (timezone === selectedTimezone) return;

    setIsUpdating(true);
    try {
      setSelectedTimezone(timezone);
      setShowDropdown(false);
      setSearchFilter('');

      // Update user timezone
      await updateTimezone(timezone);
      
      // Notify parent component
      if (onTimezoneChange) {
        onTimezoneChange(timezone);
      }

      utcMonitoring.trackOperation('timezone_manual_update', true);
      
      console.log('Timezone updated:', {
        old: user?.timezone,
        new: timezone,
        method: 'manual'
      });

    } catch (error) {
      console.error('Failed to update timezone:', error);
      setSelectedTimezone(user?.timezone || detectedTimezone);
      utcMonitoring.trackOperation('timezone_manual_update', false);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAutoDetect = async () => {
    setIsUpdating(true);
    try {
      await autoDetectTimezone();
      const newTimezone = timezoneUtils.getCurrentTimezone();
      setSelectedTimezone(newTimezone);
      
      if (onTimezoneChange) {
        onTimezoneChange(newTimezone);
      }

      utcMonitoring.trackOperation('timezone_auto_detect', true);
      
      console.log('Timezone auto-detected:', {
        detected: newTimezone,
        method: 'auto'
      });

    } catch (error) {
      console.error('Failed to auto-detect timezone:', error);
      utcMonitoring.trackOperation('timezone_auto_detect', false);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleConfirmTimezone = async () => {
    if (!selectedTimezone) return;

    setIsUpdating(true);
    try {
      await confirmTimezone(selectedTimezone);
      utcMonitoring.trackOperation('timezone_confirm', true);
    } catch (error) {
      console.error('Failed to confirm timezone:', error);
      utcMonitoring.trackOperation('timezone_confirm', false);
    } finally {
      setIsUpdating(false);
    }
  };

  const getTimezoneDisplay = (timezone: string): string => {
    const option = timezoneOptions.find(opt => opt.value === timezone);
    return option ? `${option.label} (${option.offset})` : timezone;
  };

  const isDifferentFromDetected = selectedTimezone !== detectedTimezone;
  const isDifferentFromUser = selectedTimezone !== user?.timezone;

  return (
    <div className={`bg-white rounded-lg border ${className}`}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Timezone Settings</h3>
          {showAutoDetect && (
            <button
              onClick={handleAutoDetect}
              disabled={isUpdating}
              className="text-sm px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
            >
              {isUpdating ? 'Detecting...' : 'Auto-detect'}
            </button>
          )}
        </div>

        {/* Current Status */}
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="text-sm">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-600">Current Timezone:</span>
              <span className="font-medium text-gray-900">
                {getTimezoneDisplay(selectedTimezone)}
              </span>
            </div>
            
            {isDifferentFromDetected && (
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600">Detected:</span>
                <span className="text-orange-600">
                  {getTimezoneDisplay(detectedTimezone)}
                </span>
              </div>
            )}

            <div className="flex justify-between items-center">
              <span className="text-gray-600">Current Time:</span>
              <span className="font-mono text-gray-900">
                {timezoneUtils.formatInTimezone(
                  new Date().toISOString(),
                  selectedTimezone,
                  'yyyy-MM-dd HH:mm:ss'
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Timezone Selector */}
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Timezone
          </label>
          
          <div className="relative">
            <input
              type="text"
              placeholder="Search timezones..."
              value={showDropdown ? searchFilter : getTimezoneDisplay(selectedTimezone)}
              onChange={(e) => {
                setSearchFilter(e.target.value);
                if (!showDropdown) setShowDropdown(true);
              }}
              onFocus={() => {
                setShowDropdown(true);
                setSearchFilter('');
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            
            {showDropdown && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                {filteredOptions.length > 0 ? (
                  filteredOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleTimezoneSelect(option.value)}
                      className={`w-full px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none ${
                        option.value === selectedTimezone ? 'bg-blue-50 text-blue-700' : ''
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span>{option.label}</span>
                        <span className="text-sm text-gray-500">{option.offset}</span>
                      </div>
                      <div className="text-xs text-gray-400">{option.region}</div>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-gray-500 text-sm">
                    No timezones found
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        {isDifferentFromUser && (
          <div className="mt-4 flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div>
              <p className="text-sm font-medium text-yellow-800">
                Timezone Changed
              </p>
              <p className="text-xs text-yellow-600">
                Click confirm to save your timezone preference
              </p>
            </div>
            <button
              onClick={handleConfirmTimezone}
              disabled={isUpdating}
              className="px-4 py-2 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 disabled:opacity-50"
            >
              {isUpdating ? 'Saving...' : 'Confirm'}
            </button>
          </div>
        )}

        {/* Warning for different detected timezone */}
        {isDifferentFromDetected && !isDifferentFromUser && (
          <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <span className="text-orange-500">⚠️</span>
              <div>
                <p className="text-sm font-medium text-orange-800">
                  Timezone Mismatch Detected
                </p>
                <p className="text-xs text-orange-600 mt-1">
                  Your saved timezone differs from your detected timezone. 
                  This might affect time tracking accuracy.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Close dropdown when clicking outside */}
        {showDropdown && (
          <div
            className="fixed inset-0 z-0"
            onClick={() => {
              setShowDropdown(false);
              setSearchFilter('');
            }}
          />
        )}
      </div>
    </div>
  );
};