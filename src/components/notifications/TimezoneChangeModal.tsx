import React, { useState } from 'react';
import { timezoneUtils } from '../../utils/timezoneUtils';
import { useUserStore } from '../../store/userStore';
import { utcMonitoring } from '../../services/monitoring';

interface TimezoneChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  detectedTimezone: string;
  currentTimezone: string;
  onConfirm: (timezone: string, updateExistingData: boolean) => void;
}

export const TimezoneChangeModal: React.FC<TimezoneChangeModalProps> = ({
  isOpen,
  onClose,
  detectedTimezone,
  currentTimezone,
  onConfirm
}) => {
  const [selectedTimezone, setSelectedTimezone] = useState(detectedTimezone);
  const [updateExistingData, setUpdateExistingData] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  if (!isOpen) return null;

  const getTimezoneInfo = (timezone: string) => {
    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en', {
        timeZone: timezone,
        timeZoneName: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      const parts = formatter.formatToParts(now);
      const time = parts.find(p => p.type === 'hour')?.value + ':' + 
                  parts.find(p => p.type === 'minute')?.value;
      const tzName = parts.find(p => p.type === 'timeZoneName')?.value;
      
      return { time, tzName };
    } catch {
      return { time: '??:??', tzName: 'Unknown' };
    }
  };

  const currentInfo = getTimezoneInfo(currentTimezone);
  const detectedInfo = getTimezoneInfo(detectedTimezone);
  const selectedInfo = getTimezoneInfo(selectedTimezone);

  const handleConfirm = () => {
    onConfirm(selectedTimezone, updateExistingData);
    utcMonitoring.trackOperation('timezone_change_confirmed', true);
  };

  const handleKeepCurrent = () => {
    onClose();
    utcMonitoring.trackOperation('timezone_change_dismissed', true);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div>
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
        
        <div className="relative inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
          {/* Header */}
          <div className="flex items-center mb-4">
            <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100">
              <span className="text-2xl">🌍</span>
            </div>
            <div className="ml-4">
              <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                Timezone Change Detected
              </h3>
              <p className="text-sm text-gray-500">
                We've detected that your timezone may have changed
              </p>
            </div>
          </div>

          {/* Timezone Comparison */}
          <div className="mb-6">
            <div className="grid grid-cols-1 gap-4">
              {/* Current Timezone */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-medium text-gray-900">Current Setting</h4>
                    <p className="text-sm text-gray-600">{currentTimezone}</p>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-lg text-gray-900">{currentInfo.time}</div>
                    <div className="text-xs text-gray-500">{currentInfo.tzName}</div>
                  </div>
                </div>
              </div>

              {/* Detected Timezone */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-medium text-blue-900">Detected Location</h4>
                    <p className="text-sm text-blue-700">{detectedTimezone}</p>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-lg text-blue-900">{detectedInfo.time}</div>
                    <div className="text-xs text-blue-600">{detectedInfo.tzName}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Timezone Selection */}
          <div className="mb-6">
            <h4 className="font-medium text-gray-900 mb-3">Choose your timezone:</h4>
            
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="timezone"
                  value={detectedTimezone}
                  checked={selectedTimezone === detectedTimezone}
                  onChange={(e) => setSelectedTimezone(e.target.value)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <span className="ml-3 text-sm">
                  <span className="font-medium">Use detected timezone</span>
                  <span className="text-gray-500"> ({detectedTimezone})</span>
                </span>
              </label>
              
              <label className="flex items-center">
                <input
                  type="radio"
                  name="timezone"
                  value={currentTimezone}
                  checked={selectedTimezone === currentTimezone}
                  onChange={(e) => setSelectedTimezone(e.target.value)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <span className="ml-3 text-sm">
                  <span className="font-medium">Keep current setting</span>
                  <span className="text-gray-500"> ({currentTimezone})</span>
                </span>
              </label>
            </div>

            {/* Selected timezone preview */}
            {selectedTimezone !== currentTimezone && (
              <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-green-900">Selected timezone:</span>
                  <span className="font-mono text-green-900">{selectedInfo.time}</span>
                </div>
                <div className="text-xs text-green-700">{selectedTimezone} ({selectedInfo.tzName})</div>
              </div>
            )}
          </div>

          {/* Advanced Options */}
          <div className="mb-6">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center text-sm text-blue-600 hover:text-blue-800"
            >
              <span>{showAdvanced ? '▼' : '▶'}</span>
              <span className="ml-1">Advanced Options</span>
            </button>
            
            {showAdvanced && (
              <div className="mt-3 p-4 bg-gray-50 rounded-lg">
                <label className="flex items-start">
                  <input
                    type="checkbox"
                    checked={updateExistingData}
                    onChange={(e) => setUpdateExistingData(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-1"
                  />
                  <div className="ml-3">
                    <span className="text-sm font-medium text-gray-900">
                      Update existing session data
                    </span>
                    <p className="text-xs text-gray-600 mt-1">
                      This will trigger a migration to adjust timestamps of existing sessions 
                      to match the new timezone. This process is reversible but may take some time.
                    </p>
                    {updateExistingData && (
                      <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                        <p className="text-xs text-yellow-800">
                          ⚠️ This will start a background migration process. You can continue 
                          using the app while this happens.
                        </p>
                      </div>
                    )}
                  </div>
                </label>
              </div>
            )}
          </div>

          {/* Impact Warning */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">What this affects:</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• New timer sessions and work tracking</li>
              <li>• Calendar scheduling and time display</li>
              <li>• Productivity reports and analytics</li>
              {updateExistingData && (
                <li>• Historical session timestamps (with migration)</li>
              )}
            </ul>
          </div>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row sm:justify-end space-y-3 sm:space-y-0 sm:space-x-3">
            <button
              type="button"
              onClick={handleKeepCurrent}
              className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Keep Current ({currentTimezone})
            </button>
            
            <button
              type="button"
              onClick={handleConfirm}
              className="w-full sm:w-auto px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {selectedTimezone === currentTimezone ? 'Dismiss' : `Update to ${selectedTimezone}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};