import React, { createContext, useState, useEffect } from 'react';
import { getUserSettings } from '../lib/database';
import supabase from '../lib/supabase';

// Create the context
export const SettingsContext = createContext();

// Default settings
const defaultSettings = {
  pomodoroTime: 25,
  shortBreakTime: 5,
  longBreakTime: 15,
  shortBreakEnabled: true,
  longBreakEnabled: true,
  longBreakInterval: 4,
  autoStartSessions: false,
  soundEnabled: true,
  volume: 0.5
};

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(defaultSettings);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Load settings from database or localStorage
  useEffect(() => {
    const loadSettings = async () => {
      try {
        console.log("SettingsContext: Loading settings");
        
        // Try to get user session from Supabase
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("SettingsContext: Error getting session:", error);
        }
        
        if (session?.user) {
          try {
            console.log("SettingsContext: User logged in, fetching settings from database");
            const userSettings = await getUserSettings(session.user.id);
            
            if (userSettings) {
              console.log("SettingsContext: Got settings from database:", userSettings);
              setSettings(userSettings);
              setSettingsLoaded(true);
              
              // Store in localStorage for offline access
              localStorage.setItem('timerSettings', JSON.stringify(userSettings));
              return;
            } else {
              console.log("SettingsContext: No settings found in database");
            }
          } catch (dbError) {
            console.error("SettingsContext: Error loading settings from database:", dbError);
          }
        } else {
          console.log("SettingsContext: No user session found");
        }
        
        // If we get here, try localStorage as fallback
        try {
          const savedSettings = localStorage.getItem('timerSettings');
          if (savedSettings) {
            const parsedSettings = JSON.parse(savedSettings);
            console.log("SettingsContext: Got settings from localStorage:", parsedSettings);
            
            // Ensure all required settings are present
            const mergedSettings = {
              ...defaultSettings,
              ...parsedSettings
            };
            
            setSettings(mergedSettings);
          } else {
            console.log("SettingsContext: No settings in localStorage, using defaults");
            setSettings(defaultSettings);
          }
        } catch (storageError) {
          console.error("SettingsContext: Error reading from localStorage:", storageError);
          setSettings(defaultSettings);
        }
        
        setSettingsLoaded(true);
      } catch (error) {
        console.error("SettingsContext: Unexpected error loading settings:", error);
        setSettings(defaultSettings);
        setSettingsLoaded(true);
      }
    };
    
    loadSettings();
  }, []);
  
  // Function to update settings
  const updateSettings = (newSettings) => {
    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);
    
    // Save to localStorage
    localStorage.setItem('timerSettings', JSON.stringify(updatedSettings));
    
    // Broadcast event for other components
    const event = new CustomEvent('timerSettingsUpdated', { 
      detail: updatedSettings 
    });
    window.dispatchEvent(event);
    
    return updatedSettings;
  };
  
  return (
    <SettingsContext.Provider value={{ settings, updateSettings, settingsLoaded }}>
      {children}
    </SettingsContext.Provider>
  );
};

export default SettingsProvider; 