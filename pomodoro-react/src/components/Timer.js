import React, { useEffect, useRef } from 'react';
import { useTimer } from '../hooks/useTimer';
import '../styles/Timer.css';

const Timer = () => {
  const {
    time,
    timerMode,
    isActive,
    isPaused,
    setTimerMode,
    startTimer,
    pauseTimer,
    resetTimer,
    skipTimer
  } = useTimer();

  const audioRef = useRef(null);

  // Format time as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Update document title with timer
  useEffect(() => {
    document.title = `${formatTime(time)} - ${timerMode.charAt(0).toUpperCase() + timerMode.slice(1)} Timer`;
    
    // Play sound when timer ends
    if (time === 0 && isActive) {
      audioRef.current.play();
    }
    
    return () => {
      document.title = 'Pomodoro Timer';
    };
  }, [time, timerMode, isActive]);

  // Calculate progress percentage for the circle
  const calculateProgress = () => {
    let totalTime;
    switch (timerMode) {
      case 'pomodoro':
        totalTime = 25 * 60;
        break;
      case 'shortBreak':
        totalTime = 5 * 60;
        break;
      case 'longBreak':
        totalTime = 15 * 60;
        break;
      default:
        totalTime = 25 * 60;
    }
    
    return ((totalTime - time) / totalTime) * 100;
  };

  // Calculate the stroke dasharray and dashoffset for the progress circle
  const circleRadius = 120;
  const circumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circumference - (calculateProgress() / 100) * circumference;

  return (
    <div className="timer-container">
      <div className="timer-header">
        <button 
          className={`timer-mode-button ${timerMode === 'pomodoro' ? 'active' : ''}`}
          onClick={() => setTimerMode('pomodoro')}
        >
          Pomodoro
        </button>
        <button 
          className={`timer-mode-button ${timerMode === 'shortBreak' ? 'active' : ''}`}
          onClick={() => setTimerMode('shortBreak')}
        >
          Short Break
        </button>
        <button 
          className={`timer-mode-button ${timerMode === 'longBreak' ? 'active' : ''}`}
          onClick={() => setTimerMode('longBreak')}
        >
          Long Break
        </button>
      </div>
      
      <div className="timer-circle-container">
        <svg className="timer-circle" width="300" height="300" viewBox="0 0 300 300">
          <circle 
            className="timer-circle-bg"
            cx="150"
            cy="150"
            r={circleRadius}
            strokeWidth="10"
            fill="none"
          />
          <circle 
            className="timer-circle-progress"
            cx="150"
            cy="150"
            r={circleRadius}
            strokeWidth="10"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 150 150)"
          />
          <text className="timer-text" x="150" y="165" textAnchor="middle">
            {formatTime(time)}
          </text>
        </svg>
      </div>
      
      <div className="timer-controls">
        {!isActive && !isPaused && (
          <button className="timer-button start-button" onClick={startTimer}>
            Start
          </button>
        )}
        
        {isActive && !isPaused && (
          <button className="timer-button pause-button" onClick={pauseTimer}>
            Pause
          </button>
        )}
        
        {isPaused && (
          <button className="timer-button resume-button" onClick={startTimer}>
            Resume
          </button>
        )}
        
        {(isActive || isPaused) && (
          <button className="timer-button reset-button" onClick={resetTimer}>
            Reset
          </button>
        )}
        
        {isActive && !isPaused && (
          <button className="timer-button skip-button" onClick={skipTimer}>
            Skip
          </button>
        )}
      </div>
      
      <audio ref={audioRef} src="/notification.mp3"></audio>
    </div>
  );
};

export default Timer; 