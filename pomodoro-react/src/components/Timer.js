import React, { useEffect, useRef, useState } from 'react';
import { useTimer } from '../hooks/useTimer';
import '../styles/Timer.css';

const Timer = () => {
  const {
    time,
    timerMode,
    isActive,
    isPaused,
    setTimerMode,
    pomodoroTime,
    shortBreakTime,
    longBreakTime,
    updateTimerSettings,
    startTimer,
    pauseTimer,
    resetTimer,
    skipTimer
  } = useTimer();

  const audioRef = useRef(null);
  const [showSettings, setShowSettings] = useState(false);
  
  // Add state for background image
  const [backgroundImage, setBackgroundImage] = useState('');
  
  // Local state for timer settings form
  const [settingsForm, setSettingsForm] = useState({
    pomodoro: pomodoroTime,
    shortBreak: shortBreakTime,
    longBreak: longBreakTime
  });

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
  
  // Apply background image to body when it changes
  useEffect(() => {
    if (backgroundImage) {
      document.body.style.backgroundImage = `url(${backgroundImage})`;
    } else {
      document.body.style.backgroundImage = 'none';
    }
    
    return () => {
      document.body.style.backgroundImage = 'none';
    };
  }, [backgroundImage]);

  // Handle background image upload
  const handleBackgroundUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type.match('image.*')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setBackgroundImage(e.target.result);
        // Save to localStorage
        localStorage.setItem('pomodoro-background', e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };
  
  // Load background from localStorage on mount
  useEffect(() => {
    const savedBackground = localStorage.getItem('pomodoro-background');
    if (savedBackground) {
      setBackgroundImage(savedBackground);
    }
  }, []);
  
  // Update settings form when context values change
  useEffect(() => {
    setSettingsForm({
      pomodoro: pomodoroTime,
      shortBreak: shortBreakTime,
      longBreak: longBreakTime
    });
  }, [pomodoroTime, shortBreakTime, longBreakTime]);
  
  // Handle settings form changes
  const handleSettingsChange = (e) => {
    const { name, value } = e.target;
    setSettingsForm(prev => ({
      ...prev,
      [name]: parseInt(value) || 1 // Ensure value is at least 1
    }));
  };
  
  // Save settings
  const handleSaveSettings = () => {
    updateTimerSettings(
      settingsForm.pomodoro,
      settingsForm.shortBreak,
      settingsForm.longBreak
    );
    setShowSettings(false);
  };

  // Calculate progress percentage for the circle
  const calculateProgress = () => {
    let totalTime;
    switch (timerMode) {
      case 'pomodoro':
        totalTime = pomodoroTime * 60;
        break;
      case 'shortBreak':
        totalTime = shortBreakTime * 60;
        break;
      case 'longBreak':
        totalTime = longBreakTime * 60;
        break;
      default:
        totalTime = pomodoroTime * 60;
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
      
      {/* Settings and background upload buttons */}
      <div className="timer-settings">
        <button 
          className="settings-button" 
          onClick={() => setShowSettings(!showSettings)}
          title="Timer Settings"
        >
          ⚙️
        </button>
        
        <label className="upload-label" title="Upload Background">
          🖼️
          <input 
            type="file" 
            className="file-input" 
            accept="image/*" 
            onChange={handleBackgroundUpload} 
          />
        </label>
      </div>
      
      {/* Settings panel */}
      {showSettings && (
        <div className="settings-panel">
          <h3>Configure Timer</h3>
          <label>
            Pomodoro Time (min):
            <input 
              type="number" 
              name="pomodoro"
              min="1" 
              max="60" 
              value={settingsForm.pomodoro}
              onChange={handleSettingsChange}
            />
          </label>
          <label>
            Short Break (min):
            <input 
              type="number" 
              name="shortBreak"
              min="1" 
              max="30" 
              value={settingsForm.shortBreak}
              onChange={handleSettingsChange}
            />
          </label>
          <label>
            Long Break (min):
            <input 
              type="number" 
              name="longBreak"
              min="1" 
              max="60" 
              value={settingsForm.longBreak}
              onChange={handleSettingsChange}
            />
          </label>
          <div className="settings-buttons">
            <button onClick={() => setShowSettings(false)}>Cancel</button>
            <button onClick={handleSaveSettings}>Save</button>
          </div>
        </div>
      )}
      
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
      
      <audio ref={audioRef} src="/sounds/backtowork.mp3" data-sound="pomodoro"></audio>
      <audio src="/sounds/break.mp3" data-sound="shortBreak"></audio>
      <audio src="/sounds/break.mp3" data-sound="longBreak"></audio>
    </div>
  );
};

export default Timer; 