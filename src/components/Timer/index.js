import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, SkipForward, RotateCcw, Settings, Image } from 'lucide-react';
import { useTimer } from '../../hooks/useTimer';
import { useTasks } from '../../hooks/useTasks';
import '../../styles/Timer.css';

const Timer = () => {
  const {
    currentTime,
    isActive,
    isPaused,
    mode,
    setMode,
    pomodoroTime,
    shortBreakTime,
    longBreakTime,
    updateTimerSettings,
    startTimer,
    pauseTimer,
    resetTimer,
    skipTimer
  } = useTimer();
  
  const { tasks, activeTaskId } = useTasks();
  
  // Find the active task
  const activeTask = tasks.find(task => task.id === activeTaskId);
  
  // Additional state from the standalone Timer
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
  const formatTime = (timeInSeconds) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = timeInSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  // Get mode label
  const getModeLabel = () => {
    switch (mode) {
      case 'pomodoro':
        return 'Focus Session';
      case 'shortBreak':
        return 'Short Break';
      case 'longBreak':
        return 'Long Break';
      default:
        return 'Focus Session';
    }
  };
  
  // Get background color based on mode
  const getBackgroundColor = () => {
    switch (mode) {
      case 'pomodoro':
        return 'bg-primary/10 dark:bg-primary/20';
      case 'shortBreak':
        return 'bg-green-100 dark:bg-green-900/20';
      case 'longBreak':
        return 'bg-blue-100 dark:bg-blue-900/20';
      default:
        return 'bg-primary/10 dark:bg-primary/20';
    }
  };
  
  // Update document title with timer
  useEffect(() => {
    document.title = `${formatTime(currentTime)} - ${mode.charAt(0).toUpperCase() + mode.slice(1)}`;
    
    // Play sound when timer ends
    if (currentTime === 0 && isActive) {
      audioRef.current?.play();
    }
    
    return () => {
      document.title = 'Make 10,000 Hours';
    };
  }, [currentTime, mode, isActive]);
  
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
    updateTimerSettings({
      pomodoroTime: settingsForm.pomodoro,
      shortBreakTime: settingsForm.shortBreak,
      longBreakTime: settingsForm.longBreak
    });
    setShowSettings(false);
  };
  
  return (
    <div className={`rounded-xl p-6 ${getBackgroundColor()}`}>
      <div className="text-center mb-6">
        <h2 className="text-lg font-medium">{getModeLabel()}</h2>
      </div>
      
      {/* Settings and background upload buttons */}
      <div className="absolute top-4 right-4 flex gap-2">
        <button 
          onClick={() => setShowSettings(!showSettings)}
          className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          title="Timer Settings"
        >
          <Settings className="w-4 h-4 text-white/80" />
        </button>
        
        <label className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer" title="Upload Background">
          <Image className="w-4 h-4 text-white/80" />
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
        <div className="absolute top-14 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 z-10 w-64">
          <h3 className="font-semibold mb-4 text-center">Timer Settings</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                Pomodoro Time (min)
              </label>
              <input 
                type="number" 
                name="pomodoro"
                min="1" 
                max="60" 
                value={settingsForm.pomodoro}
                onChange={handleSettingsChange}
                className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                Short Break (min)
              </label>
              <input 
                type="number" 
                name="shortBreak"
                min="1" 
                max="30" 
                value={settingsForm.shortBreak}
                onChange={handleSettingsChange}
                className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                Long Break (min)
              </label>
              <input 
                type="number" 
                name="longBreak"
                min="1" 
                max="60" 
                value={settingsForm.longBreak}
                onChange={handleSettingsChange}
                className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-md"
              />
            </div>
            <div className="flex justify-between pt-2">
              <button 
                onClick={() => setShowSettings(false)}
                className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 rounded-md"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveSettings}
                className="px-3 py-1.5 bg-primary text-white rounded-md"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="text-center mb-8">
        <div className="text-7xl font-bold tracking-tighter">
          {formatTime(currentTime)}
        </div>
      </div>
      
      <div className="flex justify-center space-x-4">
        {isActive && !isPaused ? (
          <button
            onClick={pauseTimer}
            className="w-12 h-12 rounded-full bg-white dark:bg-gray-800 shadow-md flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <Pause className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={startTimer}
            className="w-12 h-12 rounded-full bg-primary text-white shadow-md flex items-center justify-center hover:bg-primary-dark transition-colors"
          >
            <Play className="w-5 h-5 ml-0.5" />
          </button>
        )}
        
        <button
          onClick={resetTimer}
          className="w-12 h-12 rounded-full bg-white dark:bg-gray-800 shadow-md flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
        
        <button
          onClick={skipTimer}
          className="w-12 h-12 rounded-full bg-white dark:bg-gray-800 shadow-md flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <SkipForward className="w-5 h-5" />
        </button>
      </div>
      
      {/* Current task display */}
      <div className="border-t border-gray-200 dark:border-gray-800 pt-6 mt-6 w-full grid grid-cols-2 gap-4">
        {activeTask ? (
          <>
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Current Task</div>
              <div className="font-medium">{activeTask.text}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Project</div>
              <div className="font-medium">Work</div>
            </div>
          </>
        ) : (
          <div className="col-span-2 text-center text-gray-500 dark:text-gray-400">
            No active task selected
          </div>
        )}
      </div>
      
      {/* Audio elements for sounds */}
      <audio ref={audioRef} src="/sounds/backtowork.mp3"></audio>
    </div>
  );
};

export default Timer; 