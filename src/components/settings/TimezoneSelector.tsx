import React, { useState, useEffect } from 'react';
import { useUserStore } from '../../store/userStore';
import { timezoneUtils } from '../../utils/timezoneUtils';
import { utcMonitoring } from '../../services/monitoring';
// Temporarily hardcode to bypass import issues
const COMPREHENSIVE_TIMEZONES = [
  'UTC',
  'America/Adak', 'America/Anchorage', 'America/Phoenix', 'America/Los_Angeles', 'America/Denver',
  'America/Chicago', 'America/New_York', 'America/Halifax', 'America/St_Johns',
  'America/Mexico_City', 'America/Guatemala', 'America/Belize', 'America/Costa_Rica', 'America/Panama',
  'America/Havana', 'America/Jamaica', 'America/Puerto_Rico', 'America/Barbados',
  'America/Caracas', 'America/Bogota', 'America/Lima', 'America/La_Paz', 'America/Santiago',
  'America/Buenos_Aires', 'America/Montevideo', 'America/Sao_Paulo', 'America/Manaus', 'America/Cayenne',
  'Europe/London', 'Europe/Dublin', 'Europe/Lisbon', 'Europe/Madrid', 'Europe/Paris',
  'Europe/Amsterdam', 'Europe/Brussels', 'Europe/Luxembourg', 'Europe/Zurich', 'Europe/Berlin',
  'Europe/Copenhagen', 'Europe/Stockholm', 'Europe/Oslo', 'Europe/Rome', 'Europe/Vienna',
  'Europe/Prague', 'Europe/Budapest', 'Europe/Warsaw', 'Europe/Helsinki', 'Europe/Tallinn',
  'Europe/Riga', 'Europe/Vilnius', 'Europe/Kiev', 'Europe/Moscow', 'Europe/Istanbul',
  'Europe/Athens', 'Europe/Bucharest', 'Europe/Sofia', 'Europe/Belgrade', 'Europe/Zagreb',
  'Africa/Casablanca', 'Africa/Lagos', 'Africa/Cairo', 'Africa/Johannesburg', 'Africa/Nairobi',
  'Africa/Addis_Ababa', 'Africa/Khartoum', 'Africa/Algiers', 'Africa/Tunis',
  'Asia/Riyadh', 'Asia/Kuwait', 'Asia/Qatar', 'Asia/Dubai', 'Asia/Muscat', 'Asia/Tehran',
  'Asia/Baghdad', 'Asia/Jerusalem', 'Asia/Beirut', 'Asia/Damascus', 'Asia/Tashkent',
  'Asia/Almaty', 'Asia/Bishkek', 'Asia/Dushanbe', 'Asia/Ashgabat', 'Asia/Kabul',
  'Asia/Karachi', 'Asia/Kolkata', 'Asia/Kathmandu', 'Asia/Dhaka', 'Asia/Shanghai',
  'Asia/Hong_Kong', 'Asia/Taipei', 'Asia/Tokyo', 'Asia/Seoul', 'Asia/Pyongyang',
  'Asia/Ulaanbaatar', 'Asia/Bangkok', 'Asia/Ho_Chi_Minh', 'Asia/Phnom_Penh', 'Asia/Vientiane',
  'Asia/Kuala_Lumpur', 'Asia/Singapore', 'Asia/Jakarta', 'Asia/Manila', 'Asia/Brunei',
  'Asia/Yangon', 'Asia/Colombo', 'Indian/Maldives',
  'Australia/Perth', 'Australia/Darwin', 'Australia/Adelaide', 'Australia/Brisbane',
  'Australia/Sydney', 'Australia/Melbourne', 'Australia/Hobart', 'Pacific/Auckland',
  'Pacific/Chatham', 'Pacific/Honolulu', 'Pacific/Midway', 'Pacific/Samoa', 'Pacific/Fiji',
  'Pacific/Tongatapu', 'Pacific/Guam', 'Pacific/Palau', 'Pacific/Tahiti', 'Pacific/Marquesas',
  'Pacific/Easter', 'America/Vancouver', 'America/Edmonton', 'America/Edmonton',
  'America/Winnipeg', 'America/Toronto', 'America/Montreal', 'America/Toronto',
  'America/Los_Angeles', 'America/Detroit', 'America/New_York'
];

function getTimezoneDisplayName(timezone: string): string {
  const specialNames: { [key: string]: string } = {
    'UTC': 'UTC - Coordinated Universal Time',
    'America/New_York': 'New York (Eastern Time)',
    'America/Chicago': 'Chicago (Central Time)',
    'America/Denver': 'Denver (Mountain Time)', 
    'America/Los_Angeles': 'Los Angeles (Pacific Time)',
    'America/Phoenix': 'Phoenix (Arizona Time)',
    'Europe/London': 'London (Greenwich Mean Time)',
    'Europe/Paris': 'Paris (Central European Time)',
    'Asia/Tokyo': 'Tokyo (Japan Standard Time)',
    'Asia/Shanghai': 'Shanghai (China Standard Time)',
    'Asia/Kolkata': 'Mumbai/Kolkata (India Standard Time)',
    'Asia/Dubai': 'Dubai (Gulf Standard Time)',
    'Australia/Sydney': 'Sydney (Australian Eastern Time)',
    'America/Sao_Paulo': 'São Paulo (Brazil Time)',
    'Asia/Ho_Chi_Minh': 'Ho Chi Minh City (Vietnam Time)',
    'Asia/Yangon': 'Yangon (Myanmar Time)',
    'Indian/Maldives': 'Maldives (Maldives Time)',
    'Pacific/Tongatapu': 'Tonga (Tonga Time)',
  };

  if (specialNames[timezone]) {
    return specialNames[timezone];
  }

  const parts = timezone.split('/');
  if (parts.length >= 2) {
    const region = parts[0];
    const city = parts[1].replace(/_/g, ' ');
    return `${city} (${region})`;
  }

  return timezone.replace(/_/g, ' ');
}

// import { COMPREHENSIVE_TIMEZONES, getTimezoneDisplayName, getGroupedTimezones } from '../../utils/timezoneList';

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

  // Initialize timezone options with comprehensive list
  useEffect(() => {
    const loadTimezones = () => {
      try {
        const now = new Date();
        
        const options: TimezoneOption[] = COMPREHENSIVE_TIMEZONES.map(tz => {
          try {
            // Calculate offset using proper timezone calculation
            const utcDate = new Date(now.getTime() + now.getTimezoneOffset() * 60000);
            const targetDate = new Date(utcDate.toLocaleString('en-US', { timeZone: tz }));
            const offsetMs = targetDate.getTime() - utcDate.getTime();
            const offsetMinutes = offsetMs / (1000 * 60);
            
            // Format offset as ±HH:MM
            const absMinutes = Math.abs(offsetMinutes);
            const hours = Math.floor(absMinutes / 60);
            const minutes = absMinutes % 60;
            const sign = offsetMinutes >= 0 ? '+' : '-';
            const offsetStr = `${sign}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

            return {
              value: tz,
              label: getTimezoneDisplayName(tz),
              offset: `UTC${offsetStr}`,
              region: tz === 'UTC' ? 'UTC' : tz.split('/')[0]
            };
          } catch (error) {
            console.error(`Error processing timezone ${tz}:`, error);
            return {
              value: tz,
              label: getTimezoneDisplayName(tz),
              offset: 'Unknown',
              region: tz === 'UTC' ? 'UTC' : tz.split('/')[0]
            };
          }
        });

        // Sort options by region, then by label
        const sortedOptions = options.sort((a, b) => {
          if (a.region === 'UTC') return -1;
          if (b.region === 'UTC') return 1;
          if (a.region !== b.region) {
            return a.region.localeCompare(b.region);
          }
          return a.label.localeCompare(b.label);
        });

        setTimezoneOptions(sortedOptions);
        console.log(`✅ Loaded ${sortedOptions.length} timezone options from comprehensive list`);
        console.log('First 5 timezones:', sortedOptions.slice(0, 5).map(opt => opt.value));
      } catch (error) {
        console.error('❌ TIMEZONE LOADING ERROR - This is why you only see limited options:', error);
        console.error('Error details:', error.message, error.stack);
        console.error('COMPREHENSIVE_TIMEZONES available?', typeof COMPREHENSIVE_TIMEZONES, COMPREHENSIVE_TIMEZONES?.length);
        console.error('getTimezoneDisplayName available?', typeof getTimezoneDisplayName);
        // Fallback to minimal list if comprehensive loading fails
        console.warn('🔄 Falling back to minimal timezone list due to error above');
        setTimezoneOptions([
          { value: 'UTC', label: 'UTC', offset: 'UTC+00:00', region: 'UTC' },
          { value: 'America/New_York', label: 'New York', offset: 'UTC-05:00', region: 'America' },
          { value: 'America/Los_Angeles', label: 'Los Angeles', offset: 'UTC-08:00', region: 'America' },
        ]);
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

      // Notify extension of timezone change for coordination
      try {
        if (typeof (window as any).chrome !== 'undefined' && 
            (window as any).chrome?.runtime?.sendMessage) {
          (window as any).chrome.runtime.sendMessage({
            type: 'TIMEZONE_PREFERENCE_CHANGED',
            timezone: timezone,
            timestamp: Date.now()
          });
          console.log('🌍 Notified extension of timezone change:', timezone);
        }
      } catch (error) {
        console.warn('Could not notify extension of timezone change:', error);
      }

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

      // Notify extension of timezone change for coordination
      try {
        if (typeof (window as any).chrome !== 'undefined' && 
            (window as any).chrome?.runtime?.sendMessage) {
          (window as any).chrome.runtime.sendMessage({
            type: 'TIMEZONE_PREFERENCE_CHANGED',
            timezone: newTimezone,
            timestamp: Date.now()
          });
          console.log('🌍 Notified extension of auto-detected timezone:', newTimezone);
        }
      } catch (error) {
        console.warn('Could not notify extension of timezone change:', error);
      }

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
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-80 overflow-y-auto">
                {filteredOptions.length > 0 ? (
                  (() => {
                    // Group filtered options by region for better organization
                    const groupedOptions: { [region: string]: TimezoneOption[] } = {};
                    filteredOptions.forEach(option => {
                      if (!groupedOptions[option.region]) {
                        groupedOptions[option.region] = [];
                      }
                      groupedOptions[option.region].push(option);
                    });

                    const regions = Object.keys(groupedOptions).sort((a, b) => {
                      if (a === 'UTC') return -1;
                      if (b === 'UTC') return 1;
                      return a.localeCompare(b);
                    });

                    return regions.map(region => (
                      <div key={region}>
                        {/* Region Header */}
                        {regions.length > 1 && (
                          <div className="px-3 py-1 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-600 uppercase tracking-wider">
                            {region === 'UTC' ? 'Universal Time' : region.replace('_', ' ')}
                          </div>
                        )}
                        
                        {/* Timezone Options */}
                        {groupedOptions[region].map((option) => (
                          <button
                            key={option.value}
                            onClick={() => handleTimezoneSelect(option.value)}
                            className={`w-full px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none border-b border-gray-50 last:border-b-0 ${
                              option.value === selectedTimezone ? 'bg-blue-50 text-blue-700' : ''
                            }`}
                          >
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium">{option.label}</span>
                              <span className="text-xs text-gray-500 font-mono">{option.offset}</span>
                            </div>
                            {option.value !== 'UTC' && (
                              <div className="text-xs text-gray-400 mt-0.5">{option.value}</div>
                            )}
                          </button>
                        ))}
                      </div>
                    ));
                  })()
                ) : (
                  <div className="px-3 py-4 text-center text-gray-500 text-sm">
                    <div className="mb-1">No timezones found</div>
                    <div className="text-xs text-gray-400">Try searching for a city or region</div>
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