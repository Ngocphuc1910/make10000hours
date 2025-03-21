import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getUserSettings, saveUserSettings } from '../lib/database';
import testSupabaseConnection from '../lib/testSupabase';

// Default timer settings
const defaultSettings = {
  pomodoroTime: 25,
  shortBreakTime: 5,
  shortBreakEnabled: true,
  longBreakTime: 15,
  longBreakEnabled: true,
  autoStartSessions: false
};

const SettingsModal = ({ onClose }) => {
  const { currentUser, isAuthLoading } = useAuth();
  const [settings, setSettings] = useState(defaultSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [diagnosticResult, setDiagnosticResult] = useState(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);

  // Load settings on component mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // First check if user is logged in
        if (currentUser && !isAuthLoading) {
          console.log("Loading settings from database for user:", currentUser.id);
          const userSettings = await getUserSettings(currentUser.id);
          
          // If user has settings in the database, use those
          if (userSettings) {
            console.log("User settings found:", userSettings);
            setSettings(userSettings);
            return;
          }
          
          // If no database settings but localStorage exists, save those to database
          const savedSettings = localStorage.getItem('timerSettings');
          if (savedSettings) {
            const parsedSettings = JSON.parse(savedSettings);
            console.log("Saving localStorage settings to database:", parsedSettings);
            await saveUserSettings(currentUser.id, parsedSettings);
            setSettings(parsedSettings);
            return;
          }
          
          // If no settings anywhere, save defaults to database
          console.log("Using default settings and saving to database");
          await saveUserSettings(currentUser.id, defaultSettings);
          setSettings(defaultSettings);
        } else {
          // Not logged in, use localStorage
          console.log("User not logged in, using localStorage");
          const savedSettings = localStorage.getItem('timerSettings');
          if (savedSettings) {
            setSettings(JSON.parse(savedSettings));
          } else {
            setSettings(defaultSettings);
          }
        }
      } catch (err) {
        console.error("Error loading settings:", err);
        setError("Failed to load settings. Using defaults.");
        
        // Fallback to localStorage or defaults
        const savedSettings = localStorage.getItem('timerSettings');
        if (savedSettings) {
          setSettings(JSON.parse(savedSettings));
        } else {
          setSettings(defaultSettings);
        }
      }
    };

    loadSettings();
  }, [currentUser, isAuthLoading]);

  // Update individual setting
  const updateSetting = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Save settings to storage and close modal
  const saveSettings = async () => {
    try {
      setIsSaving(true);
      setError(null);
      
      // Always save to localStorage for offline/non-logged-in use
      localStorage.setItem('timerSettings', JSON.stringify(settings));
      
      // If user is logged in, save to database
      if (currentUser) {
        console.log("Saving settings to database");
        try {
          await saveUserSettings(currentUser.id, settings);
        } catch (dbError) {
          console.error("Database error:", dbError);
          
          // Show specific error message and instructions
          let errorMessage = "Failed to save settings to your account. ";
          
          if (dbError.message.includes("table does not exist")) {
            errorMessage += "The user_settings table has not been created. Please run the SQL setup in Supabase.";
          } else if (dbError.message.includes("Authentication error")) {
            errorMessage += "Authentication issue. Please try logging out and back in.";
          } else if (dbError.message.includes("No active session")) {
            errorMessage += "Your session has expired. Please log in again.";
          } else {
            errorMessage += "Settings are saved locally only. Error: " + dbError.message;
          }
          
          setError(errorMessage);
          
          // But continue - the settings are still in localStorage
          console.log("Falling back to localStorage only");
        }
      }
      
      // Dispatch event for App.js to pick up the changes
      window.dispatchEvent(new CustomEvent('timerSettingsUpdated', { 
        detail: settings 
      }));
      
      // Only close if there were no errors with saving to the database when logged in
      if (!currentUser || !error) {
        onClose();
      }
    } catch (err) {
      console.error("Error saving settings:", err);
      setError("Failed to save settings. Please try again. Error: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Run diagnostic tests
  const runDiagnostics = async () => {
    try {
      setIsDiagnosing(true);
      setDiagnosticResult(null);
      const result = await testSupabaseConnection();
      setDiagnosticResult(result);
    } catch (err) {
      console.error("Error during diagnostics:", err);
      setDiagnosticResult({
        success: false,
        error: err.message || "Unknown error during diagnostics"
      });
    } finally {
      setIsDiagnosing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md p-6 relative">
        {/* Close button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <X className="w-5 h-5" />
        </button>
        
        <h2 className="text-xl font-semibold mb-6 dark:text-white">Settings</h2>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-md">
            <p className="font-semibold mb-1">Error:</p>
            <p>{error}</p>
            {error.includes("table does not exist") && (
              <div className="mt-2 text-sm">
                <p className="font-semibold">Troubleshooting steps:</p>
                <ol className="list-decimal pl-5 mt-1">
                  <li>Make sure you've run the SQL setup script in your Supabase project</li>
                  <li>Navigate to the SQL Editor in your Supabase dashboard</li>
                  <li>Run the SQL from the supabase_user_settings_table.sql file</li>
                </ol>
              </div>
            )}
            <button
              onClick={runDiagnostics}
              disabled={isDiagnosing}
              className="mt-2 px-3 py-1 bg-red-700 hover:bg-red-800 text-white text-sm rounded-md flex items-center"
            >
              {isDiagnosing ? (
                <>
                  <span className="inline-block animate-spin rounded-full h-3 w-3 border-t-2 border-b-2 border-white mr-2"></span>
                  Running tests...
                </>
              ) : 'Diagnose Connection'}
            </button>
          </div>
        )}
        
        {diagnosticResult && (
          <div className={`mb-4 p-3 rounded-md ${diagnosticResult.success ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200' : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-200'}`}>
            <p className="font-semibold mb-1">Diagnostic Results:</p>
            {diagnosticResult.success ? (
              <p>✅ Connection to Supabase is working correctly.</p>
            ) : (
              <p>❌ Found an issue: {diagnosticResult.error?.message || diagnosticResult.error}</p>
            )}
            
            {diagnosticResult.authenticated === false && (
              <p className="mt-1">⚠️ You are not logged in. Please log in to save settings to your account.</p>
            )}
            
            {diagnosticResult.message && (
              <p className="mt-1">{diagnosticResult.message}</p>
            )}
          </div>
        )}
        
        {currentUser && !error && (
          <div className="mb-4 p-3 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200 rounded-md">
            Your settings will sync across all your devices.
          </div>
        )}
        
        {/* Pomodoro Time */}
        <div className="mb-6">
          <label className="block text-gray-700 dark:text-gray-300 mb-2">
            Pomodoro Time (minutes)
          </label>
          <input 
            type="number"
            min="1"
            max="60"
            value={settings.pomodoroTime}
            onChange={(e) => updateSetting('pomodoroTime', parseInt(e.target.value))}
            className="w-16 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
        </div>
        
        {/* Short Break */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <label className="block text-gray-700 dark:text-gray-300 mb-2">
              Short Break (minutes)
            </label>
            <input 
              type="number"
              min="1"
              max="30"
              value={settings.shortBreakTime}
              onChange={(e) => updateSetting('shortBreakTime', parseInt(e.target.value))}
              className="w-16 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              disabled={!settings.shortBreakEnabled}
            />
          </div>
          <div className="flex items-center">
            <span className="mr-2 text-gray-700 dark:text-gray-300">Enable</span>
            <div 
              className={`relative inline-block w-12 h-6 transition-colors duration-200 ease-in-out rounded-full ${settings.shortBreakEnabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
              onClick={() => updateSetting('shortBreakEnabled', !settings.shortBreakEnabled)}
            >
              <span 
                className={`absolute left-1 top-1 w-4 h-4 transition-transform duration-200 ease-in-out transform ${settings.shortBreakEnabled ? 'translate-x-6 bg-white' : 'bg-white'} rounded-full`}
              ></span>
            </div>
          </div>
        </div>
        
        {/* Long Break */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <label className="block text-gray-700 dark:text-gray-300 mb-2">
              Long Break (minutes)
            </label>
            <input 
              type="number"
              min="1"
              max="60"
              value={settings.longBreakTime}
              onChange={(e) => updateSetting('longBreakTime', parseInt(e.target.value))}
              className="w-16 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              disabled={!settings.longBreakEnabled}
            />
          </div>
          <div className="flex items-center">
            <span className="mr-2 text-gray-700 dark:text-gray-300">Enable</span>
            <div 
              className={`relative inline-block w-12 h-6 transition-colors duration-200 ease-in-out rounded-full ${settings.longBreakEnabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
              onClick={() => updateSetting('longBreakEnabled', !settings.longBreakEnabled)}
            >
              <span 
                className={`absolute left-1 top-1 w-4 h-4 transition-transform duration-200 ease-in-out transform ${settings.longBreakEnabled ? 'translate-x-6 bg-white' : 'bg-white'} rounded-full`}
              ></span>
            </div>
          </div>
        </div>
        
        {/* Auto Start Sessions */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <label className="block text-gray-700 dark:text-gray-300">
              Auto Start Sessions
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Automatically start next session
            </p>
          </div>
          <div 
            className={`relative inline-block w-12 h-6 transition-colors duration-200 ease-in-out rounded-full ${settings.autoStartSessions ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
            onClick={() => updateSetting('autoStartSessions', !settings.autoStartSessions)}
          >
            <span 
              className={`absolute left-1 top-1 w-4 h-4 transition-transform duration-200 ease-in-out transform ${settings.autoStartSessions ? 'translate-x-6 bg-white' : 'bg-white'} rounded-full`}
            ></span>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex justify-between space-x-4 mt-8">
          {currentUser && (
            <button 
              onClick={runDiagnostics}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
              disabled={isSaving || isDiagnosing}
            >
              {isDiagnosing ? (
                <>
                  <span className="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-gray-500 dark:border-gray-400 mr-2"></span>
                  Testing...
                </>
              ) : 'Test Connection'}
            </button>
          )}
          <div className="flex justify-end space-x-4 flex-grow">
            <button 
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
              disabled={isSaving || isDiagnosing}
            >
              Cancel
            </button>
            <button 
              onClick={saveSettings}
              className="px-4 py-2 bg-gray-900 dark:bg-gray-800 text-white rounded-md hover:bg-gray-800 dark:hover:bg-gray-700 flex items-center"
              disabled={isSaving || isDiagnosing}
            >
              {isSaving ? (
                <>
                  <span className="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></span>
                  Saving...
                </>
              ) : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal; 