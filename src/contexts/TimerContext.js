import React, { createContext, useState, useEffect, useRef, useCallback } from 'react';

export const TimerContext = createContext();

export const TimerProvider = ({ children }) => {
  // Timer states
  const [mode, setMode] = useState('pomodoro');
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(true);
  const [currentTime, setCurrentTime] = useState(25 * 60); // 25 mins in seconds
  
  // Timer settings
  const [pomodoroTime, setPomodoroTime] = useState(25 * 60);
  const [shortBreakTime, setShortBreakTime] = useState(5 * 60);
  const [longBreakTime, setLongBreakTime] = useState(15 * 60);
  const [autoStartBreaks, setAutoStartBreaks] = useState(false);
  const [autoStartPomodoros, setAutoStartPomodoros] = useState(false);
  const [completedPomodoros, setCompletedPomodoros] = useState(0);
  const [longBreakInterval, setLongBreakInterval] = useState(4);
  
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
        setCurrentTime(shortBreakTime);
        break;
      case 'longBreak':
        setCurrentTime(longBreakTime);
        break;
      default:
        setCurrentTime(pomodoroTime);
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
  
  // Load settings from localStorage
  useEffect(() => {
    const savedSettings = JSON.parse(localStorage.getItem('pomodoro-settings') || '{}');
    if (savedSettings.pomodoroTime) setPomodoroTime(savedSettings.pomodoroTime);
    if (savedSettings.shortBreakTime) setShortBreakTime(savedSettings.shortBreakTime);
    if (savedSettings.longBreakTime) setLongBreakTime(savedSettings.longBreakTime);
    if (savedSettings.autoStartBreaks !== undefined) setAutoStartBreaks(savedSettings.autoStartBreaks);
    if (savedSettings.autoStartPomodoros !== undefined) setAutoStartPomodoros(savedSettings.autoStartPomodoros);
    if (savedSettings.longBreakInterval) setLongBreakInterval(savedSettings.longBreakInterval);
    if (savedSettings.soundEnabled !== undefined) setSoundEnabled(savedSettings.soundEnabled);
    if (savedSettings.volume !== undefined) setVolume(savedSettings.volume);
    
    // Set initial time based on mode
    handleResetTimer();
  }, [handleResetTimer]); // Now handleResetTimer is a dependency
  
  // Save settings to localStorage when they change
  useEffect(() => {
    const settings = {
      pomodoroTime,
      shortBreakTime,
      longBreakTime,
      autoStartBreaks,
      autoStartPomodoros,
      longBreakInterval,
      soundEnabled,
      volume
    };
    
    localStorage.setItem('pomodoro-settings', JSON.stringify(settings));
  }, [
    pomodoroTime, 
    shortBreakTime, 
    longBreakTime, 
    autoStartBreaks, 
    autoStartPomodoros, 
    longBreakInterval,
    soundEnabled,
    volume
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
    if (settings.pomodoroTime !== undefined) {
      setPomodoroTime(settings.pomodoroTime);
      if (mode === 'pomodoro') setCurrentTime(settings.pomodoroTime);
    }
    
    if (settings.shortBreakTime !== undefined) {
      setShortBreakTime(settings.shortBreakTime);
      if (mode === 'shortBreak') setCurrentTime(settings.shortBreakTime);
    }
    
    if (settings.longBreakTime !== undefined) {
      setLongBreakTime(settings.longBreakTime);
      if (mode === 'longBreak') setCurrentTime(settings.longBreakTime);
    }
    
    if (settings.autoStartBreaks !== undefined) {
      setAutoStartBreaks(settings.autoStartBreaks);
    }
    
    if (settings.autoStartPomodoros !== undefined) {
      setAutoStartPomodoros(settings.autoStartPomodoros);
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
    updateTimerSettings
  };
  
  return (
    <TimerContext.Provider value={value}>
      {children}
    </TimerContext.Provider>
  );
}; 