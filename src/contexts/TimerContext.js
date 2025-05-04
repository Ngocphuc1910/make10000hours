import React, { createContext, useState, useEffect, useRef, useCallback } from 'react';
import { getUserSettings } from '../lib/database';
import supabase from '../lib/supabase';

export const TimerContext = createContext();

// Constants for storage keys with a unique prefix to avoid conflicts
const TIMER_PREFIX = 'make10000hrs_timer_';
const STORAGE_END_TIME = `${TIMER_PREFIX}end_time`;
const STORAGE_START_TIMESTAMP = `${TIMER_PREFIX}start_timestamp`; // When timer was started (for absolute reference)
const STORAGE_DURATION = `${TIMER_PREFIX}duration`; // Original duration in seconds
const STORAGE_MODE = `${TIMER_PREFIX}mode`;
const STORAGE_IS_ACTIVE = `${TIMER_PREFIX}is_active`;
const STORAGE_IS_PAUSED = `${TIMER_PREFIX}is_paused`;
const STORAGE_PAUSED_REMAINING = `${TIMER_PREFIX}paused_remaining`;
const STORAGE_COMPLETED_POMODOROS = `${TIMER_PREFIX}completed_pomos`;

const DEBUG_MODE = true; // Set to true to enable detailed console logging

// Debugging function
const timerLog = (message, data = null) => {
  if (!DEBUG_MODE) return;
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  if (data) {
    console.log(`[Timer ${timestamp}] ${message}`, data);
  } else {
    console.log(`[Timer ${timestamp}] ${message}`);
  }
};

const saveToStorage = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error saving to localStorage: ${key}`, error);
  }
};

const getFromStorage = (key, defaultValue = null) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : defaultValue;
  } catch (error) {
    console.error(`Error reading from localStorage: ${key}`, error);
    return defaultValue;
  }
};

export const TimerProvider = ({ children }) => {
  // Timer states
  const [mode, setMode] = useState('pomodoro');
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(true);
  const [currentTime, setCurrentTime] = useState(25 * 60); // 25 mins in seconds
  const [completedPomodoros, setCompletedPomodoros] = useState(0);
  
  // Timer settings
  const [pomodoroTime, setPomodoroTime] = useState(25);
  const [shortBreakTime, setShortBreakTime] = useState(5);
  const [longBreakTime, setLongBreakTime] = useState(15);
  const [autoStartBreaks, setAutoStartBreaks] = useState(false);
  const [autoStartPomodoros, setAutoStartPomodoros] = useState(false);
  const [longBreakInterval, setLongBreakInterval] = useState(4);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  
  // Sound settings
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [volume, setVolume] = useState(0.5);
  
  // Refs
  const timerRef = useRef(null);
  const audioRef = useRef(null);
  
  // Initialize audio
  useEffect(() => {
    audioRef.current = new Audio();
    
    // Load completed pomodoros from storage
    const storedPomodoros = getFromStorage(STORAGE_COMPLETED_POMODOROS, 0);
    setCompletedPomodoros(storedPomodoros);
    
    // Cleanup on unmount
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Get timer duration based on mode
  const getTimerDuration = useCallback((timerMode) => {
    const modeToUse = timerMode || mode;
    switch (modeToUse) {
      case 'shortBreak': return shortBreakTime * 60;
      case 'longBreak': return longBreakTime * 60;
      default: return pomodoroTime * 60;
    }
  }, [mode, pomodoroTime, shortBreakTime, longBreakTime]);

  // Calculate remaining time based on end time (or paused time)
  const calculateRemainingTime = useCallback(() => {
    // Get the current state from localStorage
    const storedIsActive = getFromStorage(STORAGE_IS_ACTIVE, false);
    const storedIsPaused = getFromStorage(STORAGE_IS_PAUSED, true);
    
    if (!storedIsActive) {
      // If timer is not active, return the default duration for the current mode
      timerLog('Timer not active, returning default duration');
      return getTimerDuration();
    }
    
    if (storedIsPaused) {
      // If timer is paused, return the stored remaining time
      const pausedRemaining = getFromStorage(STORAGE_PAUSED_REMAINING);
      timerLog('Timer paused, returning stored remaining time', pausedRemaining);
      return pausedRemaining !== null ? pausedRemaining : getTimerDuration();
    }
    
    // If timer is active and not paused, calculate the remaining time
    const endTime = getFromStorage(STORAGE_END_TIME);
    const duration = getFromStorage(STORAGE_DURATION);
    const startTime = getFromStorage(STORAGE_START_TIMESTAMP);
    
    if (!endTime || !startTime || !duration) {
      timerLog('Missing timer data, returning default duration', { endTime, startTime, duration });
      return getTimerDuration();
    }
    
    const now = Date.now();
    
    // Check if timer started in the past and verification is possible
    if (now < endTime) {
      // Timer is still running
      const remaining = Math.max(0, Math.ceil((endTime - now) / 1000));
      timerLog('Timer running, calculated remaining time', { remaining, endTime, now });
      return remaining;
    } else {
      // Timer has completed
      timerLog('Timer completed, returning 0');
      return 0;
    }
  }, [getTimerDuration]);

  // Sync UI with localStorage state
  const syncUIWithStorage = useCallback(() => {
    const storedMode = getFromStorage(STORAGE_MODE, 'pomodoro');
    const storedIsActive = getFromStorage(STORAGE_IS_ACTIVE, false);
    const storedIsPaused = getFromStorage(STORAGE_IS_PAUSED, true);
    
    // Update React state with localStorage values
    setMode(storedMode);
    setIsActive(storedIsActive);
    setIsPaused(storedIsPaused);
    
    // Calculate and set the current time
    const remaining = calculateRemainingTime();
    setCurrentTime(remaining);
    
    timerLog('Synced UI with localStorage', { 
      mode: storedMode, 
      isActive: storedIsActive, 
      isPaused: storedIsPaused, 
      time: remaining 
    });
    
    // If timer has completed (remaining = 0 but timer is active and not paused)
    if (remaining === 0 && storedIsActive && !storedIsPaused) {
      timerLog('Detected completed timer during sync, handling completion');
      handleTimerComplete();
      return;
    }
    
    // Setup interval if timer is active and not paused
    if (storedIsActive && !storedIsPaused) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      timerRef.current = setInterval(() => {
        const remaining = calculateRemainingTime();
        setCurrentTime(remaining);
        
        if (remaining === 0) {
          timerLog('Timer reached zero during interval, handling completion');
          handleTimerComplete();
        }
      }, 1000);
      
      timerLog('Started timer interval');
    }
  }, [calculateRemainingTime, handleTimerComplete]);

  // Handle timer completion
  const handleTimerComplete = useCallback(() => {
    timerLog('Handling timer completion');
    
    // Stop the timer interval
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Get the current mode before changing it
    const completedMode = getFromStorage(STORAGE_MODE, mode);
    
    // Clear the active timer
    saveToStorage(STORAGE_IS_ACTIVE, false);
    saveToStorage(STORAGE_IS_PAUSED, true);
    saveToStorage(STORAGE_END_TIME, null);
    saveToStorage(STORAGE_START_TIMESTAMP, null);
    
    // Update UI state
    setIsActive(false);
    setIsPaused(true);
    
    // Play completion sound
    if (soundEnabled) {
      const soundFile = completedMode === 'pomodoro' ? '/sounds/break.mp3' : '/sounds/backtowork.mp3';
      try {
        if (audioRef.current) {
          audioRef.current.src = soundFile;
          audioRef.current.volume = volume;
          audioRef.current.play().catch(e => console.error('Error playing sound:', e));
        }
      } catch (error) {
        console.error('Error playing sound:', error);
      }
    }
    
    // Update completed pomodoros count if we just completed a pomodoro
    if (completedMode === 'pomodoro') {
      const newCount = completedPomodoros + 1;
      setCompletedPomodoros(newCount);
      saveToStorage(STORAGE_COMPLETED_POMODOROS, newCount);
      timerLog('Updated completed pomodoros', newCount);
    }
    
    // Determine next mode
    let nextMode;
    if (completedMode === 'pomodoro') {
      const pomodoros = completedPomodoros + (completedMode === 'pomodoro' ? 1 : 0);
      nextMode = pomodoros % longBreakInterval === 0 ? 'longBreak' : 'shortBreak';
    } else {
      nextMode = 'pomodoro';
    }
    
    // Set next mode
    setMode(nextMode);
    saveToStorage(STORAGE_MODE, nextMode);
    
    // Get duration for next mode
    const nextDuration = getTimerDuration(nextMode);
    setCurrentTime(nextDuration);
    
    timerLog(`Set next mode to ${nextMode} with duration ${nextDuration}`);
    
    // Auto-start next timer?
    const shouldAutoStart = 
      (nextMode === 'pomodoro' && autoStartPomodoros) || 
      ((nextMode === 'shortBreak' || nextMode === 'longBreak') && autoStartBreaks);
    
    if (shouldAutoStart) {
      timerLog(`Auto-starting next timer: ${nextMode}`);
      // Start with a slight delay
      setTimeout(() => {
        startTimer(nextDuration);
      }, 300);
    }
  }, [
    mode,
    soundEnabled,
    volume,
    completedPomodoros,
    longBreakInterval,
    autoStartPomodoros,
    autoStartBreaks,
    getTimerDuration
  ]);

  // Function to start the timer
  const startTimer = useCallback((duration) => {
    const seconds = duration || currentTime;
    const now = Date.now();
    const endTime = now + (seconds * 1000);
    
    timerLog(`Starting timer for ${seconds} seconds`, { now, endTime });
    
    // Clear any existing interval
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    // Store timer state in localStorage
    saveToStorage(STORAGE_END_TIME, endTime);
    saveToStorage(STORAGE_START_TIMESTAMP, now);
    saveToStorage(STORAGE_DURATION, seconds);
    saveToStorage(STORAGE_IS_ACTIVE, true);
    saveToStorage(STORAGE_IS_PAUSED, false);
    saveToStorage(STORAGE_PAUSED_REMAINING, null);
    saveToStorage(STORAGE_MODE, mode);
    
    // Update React state
    setIsActive(true);
    setIsPaused(false);
    
    // Start interval to update timer display
    timerRef.current = setInterval(() => {
      const remaining = calculateRemainingTime();
      setCurrentTime(remaining);
      
      if (remaining <= 0) {
        timerLog('Timer reached zero');
        handleTimerComplete();
      }
    }, 1000);
  }, [currentTime, mode, calculateRemainingTime, handleTimerComplete]);

  // Function to pause the timer
  const pauseTimer = useCallback(() => {
    timerLog('Pausing timer');
    
    // Stop interval
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Calculate the current remaining time
    const remaining = calculateRemainingTime();
    
    // Store pause state
    saveToStorage(STORAGE_IS_PAUSED, true);
    saveToStorage(STORAGE_PAUSED_REMAINING, remaining);
    saveToStorage(STORAGE_END_TIME, null); // Clear end time when paused
    
    // Update React state
    setIsPaused(true);
    setCurrentTime(remaining);
    
    timerLog(`Paused with ${remaining} seconds remaining`);
  }, [calculateRemainingTime]);

  // Function to reset the timer
  const resetTimer = useCallback(() => {
    timerLog('Resetting timer');
    
    // Stop interval
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Clear timer state in localStorage
    saveToStorage(STORAGE_END_TIME, null);
    saveToStorage(STORAGE_START_TIMESTAMP, null);
    saveToStorage(STORAGE_IS_ACTIVE, false);
    saveToStorage(STORAGE_IS_PAUSED, true);
    saveToStorage(STORAGE_PAUSED_REMAINING, null);
    
    // Get default time for current mode
    const defaultTime = getTimerDuration();
    
    // Update React state
    setIsActive(false);
    setIsPaused(true);
    setCurrentTime(defaultTime);
    
    timerLog(`Reset to ${defaultTime} seconds`);
  }, [getTimerDuration]);

  // Function to skip the current timer
  const skipTimer = useCallback(() => {
    timerLog('Skipping timer');
    
    // Stop interval
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Handle completion to set up next timer
    handleTimerComplete();
  }, [handleTimerComplete]);

  // Update timer when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        timerLog('Tab became visible, syncing timer state');
        
        // Force a re-calculation of remaining time and sync UI
        syncUIWithStorage();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Also sync when component mounts
    if (document.visibilityState === 'visible') {
      // Small delay to ensure all hooks are set up first
      setTimeout(() => {
        timerLog('Initial visibility sync');
        syncUIWithStorage();
      }, 300);
    }
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [syncUIWithStorage]);

  // Load settings once on mount
  useEffect(() => {
    const loadSettings = async () => {
      timerLog('Loading settings');
      
      try {
        let loadedFromDB = false;
        
        // Try to get settings from database if logged in
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          try {
            const dbSettings = await getUserSettings(session.user.id);
            if (dbSettings) {
              timerLog('Loaded settings from database', dbSettings);
              
              // Apply settings
              setPomodoroTime(Number(dbSettings.pomodoroTime) || 25);
              setShortBreakTime(Number(dbSettings.shortBreakTime) || 5);
              setLongBreakTime(Number(dbSettings.longBreakTime) || 15);
              setAutoStartPomodoros(!!dbSettings.autoStartSessions);
              setAutoStartBreaks(!!dbSettings.shortBreakEnabled);
              setLongBreakInterval(Number(dbSettings.longBreakInterval) || 4);
              
              // Save to localStorage
              localStorage.setItem('timerSettings', JSON.stringify(dbSettings));
              
              loadedFromDB = true;
            }
          } catch (error) {
            console.error('Error loading settings from database:', error);
          }
        }
        
        // If not loaded from database, try localStorage
        if (!loadedFromDB) {
          const savedSettingsStr = localStorage.getItem('timerSettings');
          if (savedSettingsStr) {
            try {
              const savedSettings = JSON.parse(savedSettingsStr);
              timerLog('Loaded settings from localStorage', savedSettings);
              
              // Apply settings
              setPomodoroTime(Number(savedSettings.pomodoroTime) || 25);
              setShortBreakTime(Number(savedSettings.shortBreakTime) || 5);
              setLongBreakTime(Number(savedSettings.longBreakTime) || 15);
              setAutoStartBreaks(savedSettings.autoStartBreaks === true || savedSettings.shortBreakEnabled === true);
              setAutoStartPomodoros(savedSettings.autoStartPomodoros === true || savedSettings.autoStartSessions === true);
              setLongBreakInterval(Number(savedSettings.longBreakInterval) || 4);
              setSoundEnabled(savedSettings.soundEnabled !== false);
              setVolume(Number(savedSettings.volume) || 0.5);
            } catch (error) {
              console.error('Error parsing localStorage settings:', error);
            }
          }
        }
        
        // Mark settings as loaded
        setSettingsLoaded(true);
        timerLog('Settings loaded');
      } catch (error) {
        console.error('Error loading settings:', error);
        setSettingsLoaded(true); // Mark as loaded anyway
      }
    };
    
    loadSettings();
  }, []);

  // Handle timer settings update events
  useEffect(() => {
    const handleSettingsUpdated = (event) => {
      const newSettings = event.detail;
      if (!newSettings) return;
      
      timerLog('Received settings update event', newSettings);
      
      // Apply settings
      if (newSettings.pomodoroTime !== undefined) setPomodoroTime(Number(newSettings.pomodoroTime));
      if (newSettings.shortBreakTime !== undefined) setShortBreakTime(Number(newSettings.shortBreakTime));
      if (newSettings.longBreakTime !== undefined) setLongBreakTime(Number(newSettings.longBreakTime));
      if (newSettings.autoStartSessions !== undefined) setAutoStartPomodoros(!!newSettings.autoStartSessions);
      if (newSettings.autoStartBreaks !== undefined) setAutoStartBreaks(!!newSettings.autoStartBreaks);
      if (newSettings.shortBreakEnabled !== undefined) setAutoStartBreaks(!!newSettings.shortBreakEnabled);
      if (newSettings.longBreakInterval !== undefined) setLongBreakInterval(Number(newSettings.longBreakInterval));
      if (newSettings.soundEnabled !== undefined) setSoundEnabled(!!newSettings.soundEnabled);
      if (newSettings.volume !== undefined) setVolume(Number(newSettings.volume));
      
      // If timer is not active, update display time
      if (!isActive) {
        const newTime = getTimerDuration();
        setCurrentTime(newTime);
        timerLog(`Updated display time to ${newTime} seconds`);
      }
      
      // Save settings to localStorage
      try {
        const settingsToSave = {
          pomodoroTime: Number(newSettings.pomodoroTime) || pomodoroTime,
          shortBreakTime: Number(newSettings.shortBreakTime) || shortBreakTime,
          longBreakTime: Number(newSettings.longBreakTime) || longBreakTime,
          autoStartSessions: newSettings.autoStartSessions !== undefined ? !!newSettings.autoStartSessions : autoStartPomodoros,
          shortBreakEnabled: newSettings.shortBreakEnabled !== undefined ? !!newSettings.shortBreakEnabled : autoStartBreaks,
          longBreakInterval: Number(newSettings.longBreakInterval) || longBreakInterval,
          soundEnabled: newSettings.soundEnabled !== undefined ? !!newSettings.soundEnabled : soundEnabled,
          volume: newSettings.volume !== undefined ? Number(newSettings.volume) : volume
        };
        localStorage.setItem('timerSettings', JSON.stringify(settingsToSave));
        timerLog('Saved settings to localStorage', settingsToSave);
      } catch (error) {
        console.error('Error saving settings to localStorage:', error);
      }
    };
    
    window.addEventListener('timerSettingsUpdated', handleSettingsUpdated);
    
    return () => {
      window.removeEventListener('timerSettingsUpdated', handleSettingsUpdated);
    };
  }, [isActive, getTimerDuration, pomodoroTime, shortBreakTime, longBreakTime, autoStartPomodoros, autoStartBreaks, longBreakInterval, soundEnabled, volume]);

  // Function to switch timer mode
  const switchMode = useCallback((newMode) => {
    if (newMode === mode) return;
    
    timerLog(`Switching mode to ${newMode}`);
    
    // Reset timer
    resetTimer();
    
    // Change mode
    setMode(newMode);
    saveToStorage(STORAGE_MODE, newMode);
    
    // Set appropriate time
    const newDuration = getTimerDuration(newMode);
    setCurrentTime(newDuration);
    
    timerLog(`Switched to ${newMode} with duration ${newDuration}`);
  }, [mode, resetTimer, getTimerDuration]);

  // Settings update function (for external components)
  const updateTimerSettings = useCallback((settings) => {
    timerLog('Dispatching settings update event', settings);
    const event = new CustomEvent('timerSettingsUpdated', { detail: settings });
    window.dispatchEvent(event);
  }, []);

  // Context value
  const value = {
    mode,
    switchMode,
    isActive,
    isPaused,
    currentTime,
    startTimer,
    pauseTimer,
    resetTimer,
    skipTimer,
    completedPomodoros,
    pomodoroTime,
    shortBreakTime,
    longBreakTime,
    autoStartBreaks,
    autoStartPomodoros,
    longBreakInterval,
    soundEnabled,
    volume,
    updateTimerSettings,
    settingsLoaded
  };

  return (
    <TimerContext.Provider value={value}>
      {children}
    </TimerContext.Provider>
  );
}; 