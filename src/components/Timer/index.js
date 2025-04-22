import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, SkipForward, RotateCcw, Settings, Image, Clock, ChevronDown } from 'lucide-react';
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
  
  const { tasks, activeTaskId, setActiveTask } = useTasks();
  
  // Find the active task
  const activeTask = tasks.find(task => task.id === activeTaskId);
  
  // Additional state from the standalone Timer
  const audioRef = useRef(null);
  const [showSettings, setShowSettings] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState('');
  const [showTaskDropdown, setShowTaskDropdown] = useState(false);
  
  // Convert pomodoros to minutes (assuming 1 pomodoro = 25 minutes)
  const pomoToMinutes = (pomodoros) => (pomodoros || 0) * 25;
  
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

  // Handle task switch
  const handleTaskSwitch = (taskId) => {
    setActiveTask(taskId);
    setShowTaskDropdown(false);
  };
  
  // Close task dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showTaskDropdown && !event.target.closest('.task-dropdown-container')) {
        setShowTaskDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showTaskDropdown]);
  
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
      <div className="border-t border-gray-200 dark:border-gray-800 pt-6 mt-6 w-full">
        <div className="text-sm text-gray-500 dark:text-gray-400 mb-2 flex justify-between items-center">
          <span>Current Task</span>
          {mode === 'pomodoro' && (
            <button 
              onClick={() => setShowTaskDropdown(!showTaskDropdown)}
              className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20 flex items-center gap-1"
            >
              Switch task <ChevronDown className="w-3 h-3" />
            </button>
          )}
        </div>
        
        {activeTask ? (
          <div className="relative task-dropdown-container">
            <div className="p-3 rounded-md bg-white/5 hover:bg-white/10 transition-colors cursor-pointer">
              <div className="font-medium mb-1">{activeTask.title || activeTask.text}</div>
              
              <div className="flex justify-between items-center text-xs text-gray-400">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>
                    {pomoToMinutes(activeTask.pomodoros || 0)}/{pomoToMinutes(activeTask.estimatedPomodoros || 1)}m
                  </span>
                </div>
                {activeTask.projectId && (
                  <div className="bg-white/10 px-2 py-0.5 rounded text-white/70">
                    Project
                  </div>
                )}
              </div>
            </div>
            
            {/* Task dropdown */}
            {showTaskDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 rounded-md shadow-lg z-10 max-h-60 overflow-y-auto">
                <div className="p-2 text-sm font-medium border-b border-gray-200 dark:border-gray-700">
                  Switch active task
                </div>
                {tasks.filter(task => !task.completed).length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    No tasks available
                  </div>
                ) : (
                  <div className="py-1">
                    {tasks
                      .filter(task => !task.completed)
                      .map(task => (
                        <div
                          key={task.id}
                          className={`px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex justify-between items-center ${
                            task.id === activeTaskId ? 'bg-gray-100 dark:bg-gray-700' : ''
                          }`}
                          onClick={() => handleTaskSwitch(task.id)}
                        >
                          <span className="truncate">{task.title || task.text}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                            {pomoToMinutes(task.pomodoros || 0)}/{pomoToMinutes(task.estimatedPomodoros || 1)}m
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 text-center bg-white/5 rounded-md">
            <p className="text-gray-400 mb-2">No active task selected</p>
            <button 
              onClick={() => setShowTaskDropdown(!showTaskDropdown)}
              className="text-xs px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 flex items-center gap-1 mx-auto"
            >
              Select a task <ChevronDown className="w-3 h-3" />
            </button>
            
            {/* Task dropdown when no active task */}
            {showTaskDropdown && (
              <div className="absolute left-4 right-4 mt-1 bg-white dark:bg-gray-800 rounded-md shadow-lg z-10 max-h-60 overflow-y-auto">
                <div className="p-2 text-sm font-medium border-b border-gray-200 dark:border-gray-700">
                  Select a task
                </div>
                {tasks.filter(task => !task.completed).length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    No tasks available
                  </div>
                ) : (
                  <div className="py-1">
                    {tasks
                      .filter(task => !task.completed)
                      .map(task => (
                        <div
                          key={task.id}
                          className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex justify-between items-center"
                          onClick={() => handleTaskSwitch(task.id)}
                        >
                          <span className="truncate">{task.title || task.text}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                            {pomoToMinutes(task.pomodoros || 0)}/{pomoToMinutes(task.estimatedPomodoros || 1)}m
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Audio elements for sounds */}
      <audio ref={audioRef} src="/sounds/backtowork.mp3"></audio>
    </div>
  );
};

export default Timer; 