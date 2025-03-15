import React, { createContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';

export const TimerContext = createContext();

export const TimerProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const [timerMode, setTimerMode] = useState('pomodoro');
  const [pomodoroTime, setPomodoroTime] = useState(25);
  const [shortBreakTime, setShortBreakTime] = useState(5);
  const [longBreakTime, setLongBreakTime] = useState(15);
  const [time, setTime] = useState(pomodoroTime * 60); // Default 25 minutes for pomodoro
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [pomodoroCount, setPomodoroCount] = useState(0);
  const [intervalId, setIntervalId] = useState(null);
  
  // Load timer settings from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem('pomodoro-settings');
    if (savedSettings) {
      const { pomodoro, shortBreak, longBreak } = JSON.parse(savedSettings);
      setPomodoroTime(pomodoro);
      setShortBreakTime(shortBreak);
      setLongBreakTime(longBreak);
    }
  }, []);
  
  // Handle reset timer function
  const handleResetTimer = useCallback(() => {
    if (intervalId) {
      clearInterval(intervalId);
      setIntervalId(null);
    }
    
    setIsActive(false);
    setIsPaused(false);
    
    // Reset time based on current mode
    switch (timerMode) {
      case 'pomodoro':
        setTime(pomodoroTime * 60);
        break;
      case 'shortBreak':
        setTime(shortBreakTime * 60);
        break;
      case 'longBreak':
        setTime(longBreakTime * 60);
        break;
      default:
        setTime(pomodoroTime * 60);
    }
  }, [intervalId, timerMode, pomodoroTime, shortBreakTime, longBreakTime]);
  
  // Update timer settings
  const updateTimerSettings = useCallback((pomodoro, shortBreak, longBreak) => {
    setPomodoroTime(pomodoro);
    setShortBreakTime(shortBreak);
    setLongBreakTime(longBreak);
    
    // Save to localStorage
    localStorage.setItem('pomodoro-settings', JSON.stringify({
      pomodoro,
      shortBreak,
      longBreak
    }));
    
    // Reset current timer based on mode
    handleResetTimer();
  }, [handleResetTimer]);
  
  // Handle timer completion
  const handleTimerComplete = useCallback(() => {
    setIsActive(false);
    setIsPaused(false);
    
    if (intervalId) {
      clearInterval(intervalId);
      setIntervalId(null);
    }
    
    // Play sound based on timer mode
    const sound = document.querySelector(`audio[data-sound="${timerMode}"]`);
    if (sound) {
      sound.play().catch(err => console.error('Error playing sound:', err));
    }
    
    // Handle pomodoro completion
    if (timerMode === 'pomodoro') {
      const newCount = pomodoroCount + 1;
      setPomodoroCount(newCount);
      
      // After 4 pomodoros, take a long break
      if (newCount % 4 === 0) {
        setTimerMode('longBreak');
      } else {
        setTimerMode('shortBreak');
      }
    } else {
      // After a break, start a new pomodoro
      setTimerMode('pomodoro');
    }
  }, [intervalId, pomodoroCount, timerMode]);
  
  // Reset timer when mode changes
  useEffect(() => {
    handleResetTimer();
    
    // Set time based on timer mode
    switch (timerMode) {
      case 'pomodoro':
        setTime(pomodoroTime * 60); // Convert minutes to seconds
        document.body.setAttribute('data-timer-mode', 'pomodoro');
        break;
      case 'shortBreak':
        setTime(shortBreakTime * 60);
        document.body.setAttribute('data-timer-mode', 'shortBreak');
        break;
      case 'longBreak':
        setTime(longBreakTime * 60);
        document.body.setAttribute('data-timer-mode', 'longBreak');
        break;
      default:
        setTime(pomodoroTime * 60);
        document.body.setAttribute('data-timer-mode', 'pomodoro');
    }
  }, [timerMode, pomodoroTime, shortBreakTime, longBreakTime, handleResetTimer]);
  
  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [intervalId]);
  
  // Handle timer completion
  useEffect(() => {
    if (time === 0 && isActive) {
      handleTimerComplete();
    }
  }, [time, isActive, handleTimerComplete]);
  
  const startTimer = () => {
    setIsActive(true);
    setIsPaused(false);
    
    const id = setInterval(() => {
      setTime(prevTime => {
        if (prevTime === 0) {
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);
    
    setIntervalId(id);
  };
  
  const pauseTimer = () => {
    if (intervalId) {
      clearInterval(intervalId);
      setIntervalId(null);
    }
    
    setIsPaused(true);
  };
  
  const resetTimer = () => {
    handleResetTimer();
  };
  
  const skipTimer = () => {
    // Skip to the end of the current timer
    setTime(0);
  };
  
  const value = {
    timerMode,
    setTimerMode,
    time,
    isActive,
    isPaused,
    pomodoroCount,
    pomodoroTime,
    shortBreakTime,
    longBreakTime,
    updateTimerSettings,
    startTimer,
    pauseTimer,
    resetTimer,
    skipTimer
  };
  
  return (
    <TimerContext.Provider value={value}>
      {children}
    </TimerContext.Provider>
  );
}; 