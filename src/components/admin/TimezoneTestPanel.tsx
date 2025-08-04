import React, { useState, useEffect } from 'react';
import { useTimezoneChangeNotification } from '../../hooks/useTimezoneChangeNotification';
import { useUserStore } from '../../store/userStore';
import { timezoneUtils } from '../../utils/timezoneUtils';
import { quickTimezoneTest } from '../../utils/testTimezoneDetection';

/**
 * Admin panel for testing timezone detection functionality
 * Only use this in development/testing environments
 */
export const TimezoneTestPanel: React.FC = () => {
  const { user } = useUserStore();
  const {
    showTimezoneModal,
    detectedTimezone,
    currentTimezone,
    handleTimezoneConfirm,
    handleModalClose,
    triggerTimezoneCheck,
    getTimezoneStatus,
    isTimezoneFeatureEnabled
  } = useTimezoneChangeNotification();
  
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Get timezone status on component mount
  const [timezoneStatus, setTimezoneStatus] = useState<any>(null);
  
  useEffect(() => {
    const status = getTimezoneStatus();
    setTimezoneStatus(status);
  }, [getTimezoneStatus, user]);
  
  const runQuickTest = () => {
    setIsLoading(true);
    setTestResults([]);
    
    try {
      // Capture console output
      const originalLog = console.log;
      const logs: string[] = [];
      
      console.log = (...args) => {
        logs.push(args.join(' '));
        originalLog(...args);
      };
      
      quickTimezoneTest();
      
      // Restore console.log
      console.log = originalLog;
      
      setTestResults(logs);
    } catch (error) {
      setTestResults([`Error: ${error}`]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const simulateTimezoneChange = () => {
    // Force trigger timezone check
    triggerTimezoneCheck();
  };
  
  const handleConfirmChange = async (updateData: boolean) => {
    if (detectedTimezone) {
      await handleTimezoneConfirm(detectedTimezone, updateData);
    }
  };
  
  if (!user) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
        <p className="text-yellow-800">Please log in to test timezone functionality</p>
      </div>
    );
  }
  
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            🌍 Timezone Detection Test Panel
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Test and debug timezone functionality
          </p>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Current Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2">Current Status</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-600">Browser Detected:</span>
                  <span className="ml-2 font-mono">{timezoneUtils.getCurrentTimezone()}</span>
                </div>
                <div>
                  <span className="text-gray-600">User Saved:</span>
                  <span className="ml-2 font-mono">{user.timezone || 'Not set'}</span>
                </div>
                <div>
                  <span className="text-gray-600">Feature Enabled:</span>
                  <span className={`ml-2 font-medium ${isTimezoneFeatureEnabled ? 'text-green-600' : 'text-red-600'}`}>
                    {isTimezoneFeatureEnabled ? 'Yes' : 'No'}
                  </span>
                </div>
                {timezoneStatus && (
                  <div>
                    <span className="text-gray-600">In Sync:</span>
                    <span className={`ml-2 font-medium ${timezoneStatus.isInSync ? 'text-green-600' : 'text-orange-600'}`}>
                      {timezoneStatus.isInSync ? 'Yes' : 'No'}
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2">Test Actions</h3>
              <div className="space-y-2">
                <button
                  onClick={runQuickTest}
                  disabled={isLoading}
                  className="w-full px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {isLoading ? 'Running...' : 'Run Quick Test'}
                </button>
                <button
                  onClick={simulateTimezoneChange}
                  className="w-full px-3 py-2 text-sm bg-orange-600 text-white rounded hover:bg-orange-700"
                >
                  Trigger Timezone Check
                </button>
              </div>
            </div>
          </div>
          
          {/* Test Results */}
          {testResults.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg">
              <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="font-medium text-gray-900">Test Results</h3>
              </div>
              <div className="p-4">
                <pre className="text-xs text-gray-800 whitespace-pre-wrap font-mono bg-white p-3 rounded border overflow-x-auto">
                  {testResults.join('\n')}
                </pre>
              </div>
            </div>
          )}
          
          {/* Timezone Conversion Examples */}
          <div className="bg-green-50 border border-green-200 rounded-lg">
            <div className="px-4 py-3 border-b border-green-200">
              <h3 className="font-medium text-gray-900">Live Conversion Examples</h3>
            </div>
            <div className="p-4 space-y-3">
              <TimezoneConversionExample />
            </div>
          </div>
        </div>
      </div>
      
      {/* Timezone Change Modal */}
      {showTimezoneModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Timezone Change Detected
              </h3>
            </div>
            <div className="p-6">
              <p className="text-gray-700 mb-4">
                We detected that your timezone has changed:
              </p>
              <div className="bg-gray-50 p-3 rounded mb-4 space-y-2">
                <div>
                  <span className="text-gray-600">From:</span>
                  <span className="ml-2 font-mono text-red-600">{currentTimezone}</span>
                </div>
                <div>
                  <span className="text-gray-600">To:</span>
                  <span className="ml-2 font-mono text-green-600">{detectedTimezone}</span>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-6">
                Would you like to update your timezone and migrate existing data?
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={() => handleConfirmChange(true)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                >
                  Update & Migrate Data
                </button>
                <button
                  onClick={() => handleConfirmChange(false)}
                  className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
                >
                  Update Only
                </button>
                <button
                  onClick={handleModalClose}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Component to show live timezone conversions
const TimezoneConversionExample: React.FC = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  const commonTimezones = [
    'America/New_York',
    'America/Los_Angeles', 
    'Europe/London',
    'Europe/Paris',
    'Asia/Tokyo',
    'Australia/Sydney'
  ];
  
  return (
    <div>
      <div className="text-sm text-gray-600 mb-3">
        Current time in different timezones:
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
        {commonTimezones.map(tz => {
          try {
            const localTime = timezoneUtils.utcToUserTime(currentTime.toISOString(), tz);
            return (
              <div key={tz} className="flex justify-between">
                <span className="text-gray-600">{tz.split('/')[1]}:</span>
                <span className="font-mono">{localTime.toLocaleTimeString()}</span>
              </div>
            );
          } catch (error) {
            return (
              <div key={tz} className="flex justify-between">
                <span className="text-gray-600">{tz.split('/')[1]}:</span>
                <span className="font-mono text-red-500">Error</span>
              </div>
            );
          }
        })}
      </div>
    </div>
  );
};