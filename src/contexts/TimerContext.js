import React, { createContext, useState, useEffect, useRef, useCallback } from 'react';
import { getUserSettings } from '../lib/database';
import supabase from '../lib/supabase';

export const TimerContext = createContext();

export const TimerProvider = ({ children }) => {
  // Timer states
  const [mode, setMode] = useState('pomodoro');
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(true);
  const [currentTime, setCurrentTime] = useState(25 * 60); // 25 mins in seconds
  
  // Timer settings
  const [pomodoroTime, setPomodoroTime] = useState(25);
  const [shortBreakTime, setShortBreakTime] = useState(5);
  const [longBreakTime, setLongBreakTime] = useState(15);
  const [autoStartBreaks, setAutoStartBreaks] = useState(false);
  const [autoStartPomodoros, setAutoStartPomodoros] = useState(false);
  const [completedPomodoros, setCompletedPomodoros] = useState(0);
  const [longBreakInterval, setLongBreakInterval] = useState(4);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  
  // Sound settings
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [volume, setVolume] = useState(0.5); // 0 to 1
  
  // Refs
  const timerRef = useRef(null);
  const audioRef = useRef(null);
  
  // Initialize audio
  useEffect(() => {
    audioRef.current = new Audio();
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);
  
  // Helper function to reset timer based on current mode - use useCallback to avoid dependency issues
  const handleResetTimer = useCallback(() => {
    switch (mode) {
      case 'shortBreak':
        setCurrentTime(shortBreakTime * 60);
        break;
      case 'longBreak':
        setCurrentTime(longBreakTime * 60);
        break;
      default:
        setCurrentTime(pomodoroTime * 60);
    }
    
    setIsActive(false);
    setIsPaused(true);
  }, [mode, pomodoroTime, shortBreakTime, longBreakTime]);
  
  // Handle timer completion - use useCallback to avoid dependency issues
  const handleTimerComplete = useCallback(() => {
    // Play sound if enabled
    if (soundEnabled) {
      const soundFile = mode === 'pomodoro' 
        ? '/sounds/break.mp3' 
        : '/sounds/backtowork.mp3';
      
      if (audioRef.current) {
        audioRef.current.src = soundFile;
        audioRef.current.volume = volume;
        audioRef.current.play().catch(e => console.error('Error playing sound:', e));
      }
    }
    
    // Update completed pomodoros count
    if (mode === 'pomodoro') {
      setCompletedPomodoros(prev => prev + 1);
    }
    
    // Determine next timer mode
    let nextMode;
    if (mode === 'pomodoro') {
      // After pomodoro, check if we need a long break or short break
      const pomodoros = completedPomodoros + (mode === 'pomodoro' ? 1 : 0);
      nextMode = pomodoros % longBreakInterval === 0 ? 'longBreak' : 'shortBreak';
    } else {
      // After any break, go back to pomodoro
      nextMode = 'pomodoro';
    }
    
    // Update timer mode
    setMode(nextMode);
    
    // Auto-start next timer if setting is enabled
    const shouldAutoStart = 
      (nextMode === 'pomodoro' && autoStartPomodoros) || 
      ((nextMode === 'shortBreak' || nextMode === 'longBreak') && autoStartBreaks);
    
    if (shouldAutoStart) {
      setIsActive(true);
      setIsPaused(false);
    } else {
      setIsActive(false);
      setIsPaused(true);
    }
  }, [
    mode, 
    soundEnabled, 
    volume, 
    completedPomodoros, 
    longBreakInterval, 
    autoStartPomodoros, 
    autoStartBreaks
  ]);
  
  // Load settings from database first, then localStorage as fallback
  useEffect(() => {
    const loadSettings = async () => {
      try {
        console.log("TimerContext: Loading settings");
        let settingsLoaded = false;
        
        // Try to get user from Supabase session 
        const { data: { session }, error } = await supabase.auth.getSession();
        let user = null;
        
        if (error) {
          console.error("TimerContext: Session error:", error);
        } else if (session) {
          user = session.user;
          console.log("TimerContext: Found logged in user from session:", user?.id);
          
          // Load token expiry info for debugging
          if (session.expires_at) {
            const expiresAt = new Date(session.expires_at * 1000);
            const now = new Date();
            console.log("TimerContext: Session expires at:", expiresAt.toISOString());
            console.log("TimerContext: Time until expiry:", Math.floor((expiresAt - now) / 1000 / 60), "minutes");
          }
        } else {
          console.log("TimerContext: No active session found");
        }
        
        // If user is logged in, try to load settings from database
        if (user?.id) {
          try {
            console.log("TimerContext: Fetching settings from database");
            const dbSettings = await getUserSettings(user.id);
            
            if (dbSettings) {
              console.log("TimerContext: Loaded settings from database:", dbSettings);
              
              // Update all timer settings from database - ensure all values are set
              setPomodoroTime(Number(dbSettings.pomodoroTime) || 25);
              setShortBreakTime(Number(dbSettings.shortBreakTime) || 5);
              setLongBreakTime(Number(dbSettings.longBreakTime) || 15);
              setAutoStartPomodoros(!!dbSettings.autoStartSessions);
              setAutoStartBreaks(!!dbSettings.shortBreakEnabled);
              setLongBreakInterval(Number(dbSettings.longBreakInterval) || 4);
              
              // Also update localStorage for consistency
              localStorage.setItem('timerSettings', JSON.stringify(dbSettings));
              
              settingsLoaded = true;
              
              // Reset timer based on mode and new settings
              handleResetTimer();
              
              console.log("TimerContext: Settings applied from database");
            }
          } catch (err) {
            console.error("TimerContext: Error loading settings from database:", err);
            // Fall through to localStorage
          }
        }
        
        // If settings weren't loaded from DB, try localStorage
        if (!settingsLoaded) {
          try {
            // Fallback to localStorage
            const savedSettingsStr = localStorage.getItem('timerSettings');
            console.log("TimerContext: Loading from localStorage:", savedSettingsStr ? "found data" : "no data");
            
            if (savedSettingsStr) {
              const savedSettings = JSON.parse(savedSettingsStr);
              console.log("TimerContext: Parsed localStorage settings:", savedSettings);
              
              // Use values from localStorage, with fallbacks
              setPomodoroTime(Number(savedSettings.pomodoroTime) || 25);
              setShortBreakTime(Number(savedSettings.shortBreakTime) || 5);
              setLongBreakTime(Number(savedSettings.longBreakTime) || 15);
              setAutoStartBreaks(savedSettings.autoStartBreaks === true || savedSettings.shortBreakEnabled === true);
              setAutoStartPomodoros(savedSettings.autoStartPomodoros === true || savedSettings.autoStartSessions === true);
              setLongBreakInterval(Number(savedSettings.longBreakInterval) || 4);
              setSoundEnabled(savedSettings.soundEnabled !== false);
              setVolume(Number(savedSettings.volume) || 0.5);
              
              console.log("TimerContext: Applied settings from localStorage");
            } else {
              console.log("TimerContext: No localStorage settings found, using defaults");
            }
          } catch (err) {
            console.error("TimerContext: Error parsing localStorage settings:", err);
          }
        }
        
        // Mark settings as loaded regardless of source
        setSettingsLoaded(true);
        
        // Set initial time based on mode
        handleResetTimer();
      } catch (err) {
        console.error("TimerContext: Unexpected error loading settings:", err);
        // Still mark as loaded so app can function
        setSettingsLoaded(true);
      }
    };
    
    loadSettings();
  }, []);
  
  // Save settings to localStorage when they change, but only after initial load
  useEffect(() => {
    if (!settingsLoaded) return;
    
    const settings = {
      pomodoroTime,
      shortBreakTime,
      longBreakTime,
      autoStartBreaks,
      autoStartPomodoros,
      longBreakInterval,
      soundEnabled,
      volume,
      // Include these for compatibility with the rest of the app
      shortBreakEnabled: true,
      longBreakEnabled: true,
      autoStartSessions: autoStartPomodoros
    };
    
    console.log("TimerContext: Saving settings to localStorage:", settings);
    localStorage.setItem('timerSettings', JSON.stringify(settings));
    
    // Listen for timerSettingsUpdated events
    useEffect(() => {
      const handleSettingsUpdated = (event) => {
        const newSettings = event.detail;
        console.log("TimerContext: Received settings update event:", newSettings);
        
        if (!newSettings) {
          console.warn("TimerContext: Received empty settings update event");
          return;
        }
        
        // Update all settings from the event with type validation
        if (newSettings.pomodoroTime !== undefined) {
          const value = Number(newSettings.pomodoroTime);
          if (!isNaN(value) && value > 0) setPomodoroTime(value);
        }
        
        if (newSettings.shortBreakTime !== undefined) {
          const value = Number(newSettings.shortBreakTime);
          if (!isNaN(value) && value > 0) setShortBreakTime(value);
        }
        
        if (newSettings.longBreakTime !== undefined) {
          const value = Number(newSettings.longBreakTime);
          if (!isNaN(value) && value > 0) setLongBreakTime(value);
        }
        
        if (newSettings.autoStartSessions !== undefined) setAutoStartPomodoros(!!newSettings.autoStartSessions);
        if (newSettings.autoStartBreaks !== undefined) setAutoStartBreaks(!!newSettings.autoStartBreaks);
        if (newSettings.shortBreakEnabled !== undefined) setAutoStartBreaks(!!newSettings.shortBreakEnabled);
        
        if (newSettings.longBreakInterval !== undefined) {
          const value = Number(newSettings.longBreakInterval);
          if (!isNaN(value) && value > 0) setLongBreakInterval(value);
        }
        
        if (newSettings.soundEnabled !== undefined) setSoundEnabled(!!newSettings.soundEnabled);
        
        if (newSettings.volume !== undefined) {
          const value = Number(newSettings.volume);
          if (!isNaN(value) && value >= 0 && value <= 1) setVolume(value);
        }
        
        // Reset the timer with new settings if needed
        if (mode === 'pomodoro' && newSettings.pomodoroTime !== undefined) {
          const value = Number(newSettings.pomodoroTime);
          if (!isNaN(value) && value > 0) setCurrentTime(value * 60);
        } else if (mode === 'shortBreak' && newSettings.shortBreakTime !== undefined) {
          const value = Number(newSettings.shortBreakTime);
          if (!isNaN(value) && value > 0) setCurrentTime(value * 60);
        } else if (mode === 'longBreak' && newSettings.longBreakTime !== undefined) {
          const value = Number(newSettings.longBreakTime);
          if (!isNaN(value) && value > 0) setCurrentTime(value * 60);
        }
        
        console.log("TimerContext: Applied settings from event");
      };
      
      window.addEventListener('timerSettingsUpdated', handleSettingsUpdated);
      
      return () => {
        window.removeEventListener('timerSettingsUpdated', handleSettingsUpdated);
      };
    }, [mode]);
  }, [
    settingsLoaded,
    pomodoroTime, 
    shortBreakTime, 
    longBreakTime, 
    autoStartBreaks, 
    autoStartPomodoros, 
    longBreakInterval,
    soundEnabled,
    volume,
    mode
  ]);
  
  // Reset timer when mode changes
  useEffect(() => {
    handleResetTimer();
  }, [mode, handleResetTimer]); // Now handleResetTimer is a dependency
  
  // Timer interval
  useEffect(() => {
    if (isActive && !isPaused) {
      timerRef.current = setInterval(() => {
        setCurrentTime((prevTime) => {
          if (prevTime <= 1) {
            clearInterval(timerRef.current);
            handleTimerComplete();
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    
    return () => clearInterval(timerRef.current);
  }, [isActive, isPaused, handleTimerComplete]); // Make sure handleTimerComplete is included
  
  // Timer control functions
  const startTimer = () => {
    setIsActive(true);
    setIsPaused(false);
  };
  
  const pauseTimer = () => {
    setIsPaused(true);
  };
  
  const resetTimer = () => {
    handleResetTimer();
  };
  
  const skipTimer = () => {
    handleTimerComplete();
  };
  
  // Update timer settings
  const updateTimerSettings = (settings) => {
    if (!settingsLoaded) return;
    
    console.log("TimerContext: Updating settings:", settings);
    
    if (settings.pomodoroTime !== undefined) {
      setPomodoroTime(settings.pomodoroTime);
      if (mode === 'pomodoro') setCurrentTime(settings.pomodoroTime * 60);
    }
    
    if (settings.shortBreakTime !== undefined) {
      setShortBreakTime(settings.shortBreakTime);
      if (mode === 'shortBreak') setCurrentTime(settings.shortBreakTime * 60);
    }
    
    if (settings.longBreakTime !== undefined) {
      setLongBreakTime(settings.longBreakTime);
      if (mode === 'longBreak') setCurrentTime(settings.longBreakTime * 60);
    }
    
    if (settings.autoStartBreaks !== undefined) {
      setAutoStartBreaks(settings.autoStartBreaks);
    }
    
    if (settings.autoStartPomodoros !== undefined || settings.autoStartSessions !== undefined) {
      // Handle both names for compatibility
      const newValue = settings.autoStartPomodoros !== undefined ? 
        settings.autoStartPomodoros : settings.autoStartSessions;
      setAutoStartPomodoros(newValue);
    }
    
    if (settings.longBreakInterval !== undefined) {
      setLongBreakInterval(settings.longBreakInterval);
    }
    
    if (settings.soundEnabled !== undefined) {
      setSoundEnabled(settings.soundEnabled);
    }
    
    if (settings.volume !== undefined) {
      setVolume(settings.volume);
    }
    
    // Also update localStorage to keep everything in sync
    const updatedSettings = {
      pomodoroTime: settings.pomodoroTime !== undefined ? settings.pomodoroTime : pomodoroTime,
      shortBreakTime: settings.shortBreakTime !== undefined ? settings.shortBreakTime : shortBreakTime,
      longBreakTime: settings.longBreakTime !== undefined ? settings.longBreakTime : longBreakTime,
      autoStartBreaks: settings.autoStartBreaks !== undefined ? settings.autoStartBreaks : autoStartBreaks,
      autoStartPomodoros: settings.autoStartPomodoros !== undefined ? settings.autoStartPomodoros : autoStartPomodoros,
      autoStartSessions: settings.autoStartSessions !== undefined ? settings.autoStartSessions : autoStartPomodoros,
      longBreakInterval: settings.longBreakInterval !== undefined ? settings.longBreakInterval : longBreakInterval,
      soundEnabled: settings.soundEnabled !== undefined ? settings.soundEnabled : soundEnabled,
      volume: settings.volume !== undefined ? settings.volume : volume,
      shortBreakEnabled: true,
      longBreakEnabled: true
    };
    
    localStorage.setItem('timerSettings', JSON.stringify(updatedSettings));
  };
  
  const value = {
    mode,
    setMode,
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