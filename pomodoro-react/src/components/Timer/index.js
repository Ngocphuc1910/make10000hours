import React, { useEffect, useRef, useState } from 'react';
import { useTimer } from '../../hooks/useTimer';
import { Button } from '../ui/button';
import { Settings, SkipForward, Play, Pause, RotateCcw, Upload } from 'lucide-react';
import { cn } from '../../utils/cn';

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
    <div className="w-full max-w-xl mx-auto p-6 relative">
      {/* Mode selector tabs */}
      <div className="flex justify-center gap-2 mb-8">
        <Button
          variant={timerMode === 'pomodoro' ? 'timer-active' : 'timer'}
          size="pill"
          onClick={() => setTimerMode('pomodoro')}
          className="min-w-[110px]"
        >
          Pomodoro
        </Button>
        <Button
          variant={timerMode === 'shortBreak' ? 'timer-active' : 'timer'}
          size="pill"
          onClick={() => setTimerMode('shortBreak')}
          className="min-w-[110px]"
        >
          Short Break
        </Button>
        <Button
          variant={timerMode === 'longBreak' ? 'timer-active' : 'timer'}
          size="pill"
          onClick={() => setTimerMode('longBreak')}
          className="min-w-[110px]"
        >
          Long Break
        </Button>
      </div>
      
      {/* Settings and background upload buttons */}
      <div className="absolute top-6 right-6 flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-8 h-8 p-0"
          onClick={() => setShowSettings(!showSettings)}
          title="Timer Settings"
        >
          <Settings className="w-5 h-5" />
          <span className="sr-only">Settings</span>
        </Button>
        
        <label
          className={cn(
            "flex items-center justify-center w-8 h-8 rounded-md cursor-pointer",
            "bg-transparent text-white hover:bg-white/20"
          )}
          title="Upload Background"
        >
          <Upload className="w-5 h-5" />
          <span className="sr-only">Upload Background</span>
          <input 
            type="file" 
            className="hidden" 
            accept="image/*" 
            onChange={handleBackgroundUpload} 
          />
        </label>
      </div>
      
      {/* Settings panel */}
      {showSettings && (
        <div className="absolute top-16 right-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg z-10 p-4 w-64 text-left text-gray-800 dark:text-white">
          <h3 className="text-lg font-medium mb-4 text-center">Configure Timer</h3>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block font-medium">
                Pomodoro (min)
              </label>
              <input 
                type="number" 
                name="pomodoro"
                min="1" 
                max="60" 
                value={settingsForm.pomodoro}
                onChange={handleSettingsChange}
                className="w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-700"
              />
            </div>
            
            <div className="space-y-2">
              <label className="block font-medium">
                Short Break (min)
              </label>
              <input 
                type="number" 
                name="shortBreak"
                min="1" 
                max="30" 
                value={settingsForm.shortBreak}
                onChange={handleSettingsChange}
                className="w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-700"
              />
            </div>
            
            <div className="space-y-2">
              <label className="block font-medium">
                Long Break (min)
              </label>
              <input 
                type="number" 
                name="longBreak"
                min="1" 
                max="60" 
                value={settingsForm.longBreak}
                onChange={handleSettingsChange}
                className="w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-700"
              />
            </div>
          </div>
          
          <div className="flex justify-between mt-6">
            <Button
              variant="secondary"
              onClick={() => setShowSettings(false)}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={handleSaveSettings}
            >
              Save
            </Button>
          </div>
        </div>
      )}
      
      {/* Timer circle */}
      <div className="relative w-72 h-72 mx-auto mb-8">
        <svg className="w-full h-full" viewBox="0 0 300 300">
          <circle 
            className="opacity-20 stroke-white"
            cx="150"
            cy="150"
            r={circleRadius}
            strokeWidth="10"
            fill="none"
          />
          <circle 
            className="stroke-white transition-all duration-1000 ease-linear"
            cx="150"
            cy="150"
            r={circleRadius}
            strokeWidth="10"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 150 150)"
          />
          <text 
            className="fill-white text-4xl font-light"
            x="150" 
            y="160" 
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {formatTime(time)}
          </text>
        </svg>
      </div>
      
      {/* Timer controls */}
      <div className="flex justify-center items-center gap-4">
        {!isActive && !isPaused && (
          <Button 
            variant="timer"
            size="lg"
            className="rounded-full px-8 py-6"
            onClick={startTimer}
          >
            <Play className="w-5 h-5 mr-2" />
            Start
          </Button>
        )}
        
        {isActive && !isPaused && (
          <>
            <Button 
              variant="timer"
              size="lg"
              className="rounded-full"
              onClick={pauseTimer}
            >
              <Pause className="w-5 h-5 mr-2" />
              Pause
            </Button>
            
            <Button 
              variant="timer"
              size="lg"
              className="rounded-full"
              onClick={skipTimer}
            >
              <SkipForward className="w-5 h-5 mr-2" />
              Skip
            </Button>
          </>
        )}
        
        {isPaused && (
          <>
            <Button 
              variant="timer"
              size="lg"
              className="rounded-full"
              onClick={startTimer}
            >
              <Play className="w-5 h-5 mr-2" />
              Resume
            </Button>
            
            <Button 
              variant="timer"
              size="lg"
              className="rounded-full"
              onClick={resetTimer}
            >
              <RotateCcw className="w-5 h-5 mr-2" />
              Reset
            </Button>
          </>
        )}
      </div>
      
      <audio ref={audioRef} src="/sounds/backtowork.mp3" data-sound="pomodoro"></audio>
      <audio src="/sounds/break.mp3" data-sound="shortBreak"></audio>
      <audio src="/sounds/break.mp3" data-sound="longBreak"></audio>
    </div>
  );
};

export default Timer; 