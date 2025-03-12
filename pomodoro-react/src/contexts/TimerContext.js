import React, { createContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';

export const TimerContext = createContext();

export const TimerProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const [timerMode, setTimerMode] = useState('pomodoro');
  const [time, setTime] = useState(25 * 60); // Default 25 minutes for pomodoro
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [pomodoroCount, setPomodoroCount] = useState(0);
  const [intervalId, setIntervalId] = useState(null);
  
  // Reset timer when mode changes
  useEffect(() => {
    handleResetTimer();
    
    // Set time based on timer mode
    switch (timerMode) {
      case 'pomodoro':
        setTime(25 * 60); // 25 minutes
        document.body.setAttribute('data-timer-mode', 'pomodoro');
        break;
      case 'shortBreak':
        setTime(5 * 60); // 5 minutes
        document.body.setAttribute('data-timer-mode', 'shortBreak');
        break;
      case 'longBreak':
        setTime(15 * 60); // 15 minutes
        document.body.setAttribute('data-timer-mode', 'longBreak');
        break;
      default:
        setTime(25 * 60);
        document.body.setAttribute('data-timer-mode', 'pomodoro');
    }
  }, [timerMode]);
  
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
  }, [time, isActive]);
  
  const handleTimerComplete = useCallback(() => {
    setIsActive(false);
    setIsPaused(false);
    
    if (intervalId) {
      clearInterval(intervalId);
      setIntervalId(null);
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
  
  const handleResetTimer = () => {
    if (intervalId) {
      clearInterval(intervalId);
      setIntervalId(null);
    }
    
    setIsActive(false);
    setIsPaused(false);
    
    // Reset time based on current mode
    switch (timerMode) {
      case 'pomodoro':
        setTime(25 * 60);
        break;
      case 'shortBreak':
        setTime(5 * 60);
        break;
      case 'longBreak':
        setTime(15 * 60);
        break;
      default:
        setTime(25 * 60);
    }
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