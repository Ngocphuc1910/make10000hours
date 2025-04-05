import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getUserSettings, saveUserSettings } from '../lib/database';
import testSupabaseConnection from '../lib/testSupabase';
import { defaultSettings } from '../types/settings';
import supabase from '../lib/supabase';
import { generateSettingsSql, generateTestSql } from '../utils/settingsUtil';

// Default timer settings are now imported from types/settings.js

const SettingsModal = ({ onClose }) => {
  const { currentUser, isAuthLoading } = useAuth();
  const [settings, setSettings] = useState(defaultSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [diagnosticResult, setDiagnosticResult] = useState(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [isCheckingPermissions, setIsCheckingPermissions] = useState(false);
  const [permissionsStatus, setPermissionsStatus] = useState(null);
  const [sqlScript, setSqlScript] = useState(null);
  const [showSqlModal, setShowSqlModal] = useState(false);

  // Load settings on component mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setError(null);
        console.log("SettingsModal: Loading settings");
        
        // Wait for auth to finish loading
        if (isAuthLoading) {
          console.log("SettingsModal: Auth is still loading, will try loading settings later");
          return;
        }
        
        // First check if user is logged in
        if (currentUser) {
          console.log("SettingsModal: Loading settings from database for user:", currentUser.id);
          
          try {
            const userSettings = await getUserSettings(currentUser.id);
            
            // getUserSettings should always return valid settings now
            console.log("SettingsModal: User settings loaded:", userSettings);
            setSettings(userSettings);
          } catch (dbError) {
            console.error("SettingsModal: Error loading settings from database:", dbError);
            setError(`Failed to load settings from database: ${dbError.message}`);
            
            // Try from localStorage if database fails
            const savedSettings = localStorage.getItem('timerSettings');
            if (savedSettings) {
              try {
                const parsedSettings = JSON.parse(savedSettings);
                console.log("SettingsModal: Falling back to localStorage settings:", parsedSettings);
                setSettings(parsedSettings);
              } catch (parseError) {
                console.error("SettingsModal: Error parsing localStorage settings:", parseError);
                setSettings(defaultSettings);
              }
            } else {
              console.log("SettingsModal: No localStorage settings, using defaults");
              setSettings(defaultSettings);
            }
          }
        } else {
          // Not logged in, use localStorage
          console.log("SettingsModal: User not logged in, using localStorage");
          const savedSettings = localStorage.getItem('timerSettings');
          if (savedSettings) {
            try {
              const parsedSettings = JSON.parse(savedSettings);
              console.log("SettingsModal: Settings loaded from localStorage:", parsedSettings);
              setSettings(parsedSettings);
            } catch (parseError) {
              console.error("SettingsModal: Error parsing localStorage settings:", parseError);
              setSettings(defaultSettings);
            }
          } else {
            console.log("SettingsModal: No localStorage settings, using defaults");
            setSettings(defaultSettings);
          }
        }
      } catch (err) {
        console.error("SettingsModal: Error loading settings:", err);
        setError("Failed to load settings. Using defaults.");
        setSettings(defaultSettings);
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
      
      console.log("SettingsModal: Starting settings save process");
      
      // Validate settings before saving
      if (settings.pomodoroTime <= 0 || settings.shortBreakTime <= 0 || settings.longBreakTime <= 0) {
        setError("Time values must be greater than 0");
        setIsSaving(false);
        return;
      }
      
      // Make a copy of settings to ensure we don't have any issues with references
      const settingsCopy = JSON.parse(JSON.stringify(settings));
      
      // Always save to localStorage for offline/non-logged-in use
      localStorage.setItem('timerSettings', JSON.stringify(settingsCopy));
      console.log("SettingsModal: Settings saved to localStorage:", settingsCopy);
      
      // Always dispatch the event to update the timer immediately
      // This ensures changes are applied even if database save fails
      console.log("SettingsModal: Dispatching settings update event");
      window.dispatchEvent(new CustomEvent('timerSettingsUpdated', { 
        detail: settingsCopy
      }));
      
      // If user is logged in, save to database
      if (currentUser) {
        console.log("SettingsModal: Attempting to save settings to database for user:", currentUser.id);
        try {
          // Show detailed user info for debugging
          console.log("SettingsModal: Current user:", {
            id: currentUser.id,
            email: currentUser.email,
            aud: currentUser.aud,
            role: currentUser.role
          });
          
          const result = await saveUserSettings(currentUser.id, settingsCopy);
          console.log("SettingsModal: Settings saved to database successfully:", result);
          
          // Close the modal after successful save
          setTimeout(() => {
            onClose();
          }, 500); // Short delay to ensure event processing completes
        } catch (dbError) {
          console.error("SettingsModal: Database error:", dbError);
          
          // Show specific error message and instructions
          let errorMessage = "Failed to save settings to your account. ";
          
          if (dbError.message.includes("table does not exist")) {
            errorMessage += "The user_settings table has not been created. Please run the SQL setup in Supabase.";
          } else if (dbError.message.includes("Authentication error")) {
            errorMessage += "Authentication issue. Please try logging out and back in.";
          } else if (dbError.message.includes("No active session")) {
            errorMessage += "Your session has expired. Please log in again.";
          } else if (dbError.message.includes("Method Not Allowed")) {
            errorMessage += "API permission issue. Check your Supabase Row Level Security (RLS) policies.";
          } else {
            errorMessage += "Settings are saved locally only. Error: " + dbError.message;
          }
          
          setError(errorMessage);
          
          // Settings are still applied because we've already dispatched the event and saved to localStorage
          console.log("SettingsModal: Settings were saved locally and applied, but not saved to database");
        }
      } else {
        // Not logged in, just use localStorage and update the app
        console.log("SettingsModal: User not logged in, using localStorage only");
        
        // Close the modal if not logged in (no errors possible)
        setTimeout(() => {
          onClose();
        }, 500); // Short delay to ensure event processing completes
      }
    } catch (err) {
      console.error("SettingsModal: Error saving settings:", err);
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

  // Check RLS permissions
  const checkPermissions = async () => {
    setIsCheckingPermissions(true);
    setPermissionsStatus(null);
    setError(null);
    
    try {
      console.log("Checking RLS permissions for user:", currentUser?.id);
      
      if (!currentUser) {
        setPermissionsStatus("You must be logged in to check permissions");
        return;
      }
      
      // Try a lightweight SELECT query to check read permissions
      const { data: readData, error: readError } = await supabase
        .from('user_settings')
        .select('id')
        .eq('user_id', currentUser.id)
        .limit(1);
      
      if (readError) {
        console.error("Read permission check failed:", readError);
        setPermissionsStatus(`Read permission error: ${readError.message}`);
        return;
      }
      
      console.log("Read permission check passed:", readData);
      
      // Try a simple update with the same data to test write permissions
      // First get the current settings if they exist
      const { data: existingSettings, error: getError } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', currentUser.id)
        .maybeSingle();
      
      if (getError && getError.code !== 'PGRST116') {
        console.error("Error fetching existing settings:", getError);
        setPermissionsStatus(`Error fetching settings: ${getError.message}`);
        return;
      }
      
      // If settings exist, try to update them with the same data
      if (existingSettings) {
        const { error: updateError } = await supabase
          .from('user_settings')
          .update({ 
            updated_at: new Date()
          })
          .eq('user_id', currentUser.id);
        
        if (updateError) {
          console.error("Write permission check failed:", updateError);
          setPermissionsStatus(`Write permission error: ${updateError.message}`);
          return;
        }
        
        console.log("Write permission check passed");
        setPermissionsStatus("All permissions OK: You have both read and write access");
      } else {
        // Try to insert a test record and then delete it
        const { data: insertData, error: insertError } = await supabase
          .from('user_settings')
          .insert({
            user_id: currentUser.id,
            settings: settings,
            created_at: new Date(),
            updated_at: new Date()
          })
          .select();
        
        if (insertError) {
          console.error("Insert permission check failed:", insertError);
          setPermissionsStatus(`Insert permission error: ${insertError.message}`);
          return;
        }
        
        console.log("Insert permission check passed:", insertData);
        
        // Delete the test record
        if (insertData && insertData.length > 0) {
          const { error: deleteError } = await supabase
            .from('user_settings')
            .delete()
            .eq('id', insertData[0].id);
          
          if (deleteError) {
            console.warn("Couldn't clean up test record:", deleteError);
            // Not critical, still mark permissions as OK
          }
        }
        
        setPermissionsStatus("All permissions OK: You have insert access");
      }
    } catch (err) {
      console.error("Permission check error:", err);
      setPermissionsStatus(`Error checking permissions: ${err.message}`);
    } finally {
      setIsCheckingPermissions(false);
    }
  };

  // Generate SQL scripts for direct database updates
  const generateSql = () => {
    if (!currentUser) {
      setError("You must be logged in to generate SQL");
      return;
    }
    
    const sql = generateSettingsSql(currentUser.id, settings);
    setSqlScript(sql);
    setShowSqlModal(true);
  };
  
  // Generate test SQL
  const generateTestScript = () => {
    const sql = generateTestSql();
    setSqlScript(sql);
    setShowSqlModal(true);
  };
  
  // Copy SQL to clipboard
  const copyToClipboard = () => {
    if (sqlScript) {
      navigator.clipboard.writeText(sqlScript)
        .then(() => {
          alert("SQL copied to clipboard!");
        })
        .catch(err => {
          console.error("Failed to copy: ", err);
          // Fallback - select the text for manual copy
          const sqlElement = document.getElementById('sql-content');
          if (sqlElement) {
            const range = document.createRange();
            range.selectNode(sqlElement);
            window.getSelection().removeAllRanges();
            window.getSelection().addRange(range);
          }
        });
    }
  };

  // Add move buttons as alternative to dragging
  const moveItem = (item, direction) => {
    // Implement the logic to move the item in the desired direction
    console.log(`Moving item: ${item} in direction: ${direction}`);
  };

  return (
    <>
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
                    <li>Run the SQL from the supabase/migrations/20240317_user_settings_table.sql file</li>
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
          
          {/* Debugging section - show more info when there are errors */}
          {(error || permissionsStatus) && (
            <div className="debugging-section">
              {error && <div className="error-message">{error}</div>}
              {permissionsStatus && <div className="permissions-status">{permissionsStatus}</div>}
            </div>
          )}
          
          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 mt-8">
            {/* Diagnostic buttons */}
            <div className="flex flex-wrap gap-2">
              {(error || diagnosticResult) && (
                <button
                  onClick={runDiagnostics}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                  disabled={isSaving || isDiagnosing || isCheckingPermissions}
                >
                  {isDiagnosing ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Testing...
                    </span>
                  ) : (
                    'Test Connection'
                  )}
                </button>
              )}
              <button 
                onClick={checkPermissions}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                disabled={isSaving || isDiagnosing || isCheckingPermissions}
              >
                {isCheckingPermissions ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Checking...
                  </span>
                ) : 'Check Permissions'}
              </button>
              
              {/* SQL Generation Buttons */}
              {currentUser && (
                <button 
                  onClick={generateSql}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                  disabled={isSaving || isDiagnosing || isCheckingPermissions}
                >
                  Generate SQL
                </button>
              )}
              <button 
                onClick={generateTestScript}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                disabled={isSaving || isDiagnosing || isCheckingPermissions}
              >
                Test SQL
              </button>
            </div>
            
            <div className="flex justify-end space-x-4 flex-grow">
              <button 
                onClick={onClose}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                disabled={isSaving || isDiagnosing || isCheckingPermissions}
              >
                Cancel
              </button>
              <button 
                onClick={saveSettings}
                className="px-4 py-2 bg-gray-900 dark:bg-gray-800 text-white rounded-md hover:bg-gray-800 dark:hover:bg-gray-700 flex items-center"
                disabled={isSaving || isDiagnosing || isCheckingPermissions}
              >
                {isSaving ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </span>
                ) : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* SQL Script Modal */}
      {showSqlModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl p-6 relative">
            <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">SQL Script</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Copy this SQL and run it in the Supabase SQL Editor to directly update settings
            </p>
            
            <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded max-h-96 overflow-auto">
              <pre id="sql-content" className="text-sm font-mono whitespace-pre-wrap break-words text-gray-800 dark:text-gray-300">
                {sqlScript}
              </pre>
            </div>
            
            <div className="flex justify-end space-x-4 mt-4">
              <button 
                onClick={copyToClipboard}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Copy to Clipboard
              </button>
              <button 
                onClick={() => setShowSqlModal(false)}
                className="px-4 py-2 bg-gray-900 dark:bg-gray-800 text-white rounded-md hover:bg-gray-800 dark:hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SettingsModal; 