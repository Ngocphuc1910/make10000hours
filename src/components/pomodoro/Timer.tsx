import React, { useState, useEffect } from 'react';
import { useTimerStore } from '../../store/timerStore';
import { useTaskStore } from '../../store/taskStore';
import TimerCircle from '../ui/TimerCircle';
import { formatTime } from '../../utils/timeUtils';
import { Icon } from '../ui/Icon';

// Custom hook to get live task data from taskStore
const useLiveCurrentTask = () => {
  const currentTaskId = useTimerStore(state => state.currentTask?.id);
  const tasks = useTaskStore(state => state.tasks);
  const projects = useTaskStore(state => state.projects);
  
  // Find the live task data by ID from taskStore
  const liveTask = currentTaskId ? tasks.find(task => task.id === currentTaskId) : null;
  const liveProject = liveTask ? projects.find(project => project.id === liveTask.projectId) : null;
  
  return { liveTask, liveProject };
};

interface TimerProps {
  className?: string;
}

export const Timer: React.FC<TimerProps> = ({ className = '' }) => {
  // State for responsive circle size
  const [circleSize, setCircleSize] = useState(300);

  // Use selectors for the values that change frequently and need reactivity
  const currentTime = useTimerStore(state => state.currentTime);
  const totalTime = useTimerStore(state => state.totalTime);
  const isRunning = useTimerStore(state => state.isRunning);
  const mode = useTimerStore(state => state.mode);
  const currentTask = useTimerStore(state => state.currentTask);
  const enableStartPauseBtn = useTimerStore(state => state.enableStartPauseBtn);
  
  // Get live task data with real-time timeSpent updates
  const { liveTask, liveProject } = useLiveCurrentTask();
  
  // Use selectors for less frequently changing values
  const isLoading = useTimerStore(state => state.isLoading);
  const isSyncing = useTimerStore(state => state.isSyncing);
  const syncError = useTimerStore(state => state.syncError);
  const isTaskLoading = useTimerStore(state => state.isTaskLoading);
  const taskLoadError = useTimerStore(state => state.taskLoadError);
  
  // Get action functions (these don't change, so we can destructure them)
  const { start, pause, reset, skip, setMode } = useTimerStore();

  // Update circle size on window resize
  useEffect(() => {
    const updateCircleSize = () => {
      const newSize = Math.min(300, Math.max(200, window.innerWidth * 0.3));
      setCircleSize(newSize);
    };

    updateCircleSize();
    window.addEventListener('resize', updateCircleSize);
    
    return () => window.removeEventListener('resize', updateCircleSize);
  }, []);
  
  // Button handlers
  const handleStartPause = () => {
    if (!enableStartPauseBtn) {
      console.warn('Start/Pause button is disabled');
      return;
    }
    if (isRunning) {
      pause();
    } else {
      start();
    }
  };
  
  const handleReset = () => {
    reset();
  };
  
  const handleSkip = () => {
    skip();
  };
  
  // Format time display (MM:SS)
  const timeDisplay = formatTime(currentTime);
  
  // Render sync status indicator - only show critical errors
  const renderSyncStatus = () => {
    if (isTaskLoading) {
      return (
        <div className="flex items-center text-sm text-text-secondary mb-2">
          <Icon name="loader-4-line" className="mr-1 animate-spin" size={16} />
          Recovering task state...
        </div>
      );
    }
    
    if (taskLoadError) {
      return (
        <div className="flex items-center text-sm text-red-500 mb-2">
          <Icon name="error-warning-line" className="mr-1" size={16} />
          {taskLoadError}
        </div>
      );
    }
    
    // Only show persistent connection errors that prevent functionality
    if (syncError && !isLoading && !isSyncing) {
      return (
        <div className="flex items-center text-sm text-red-500 mb-2">
          <Icon name="error-warning-line" className="mr-1" size={16} />
          Connection error
        </div>
      );
    }
    
    return null;
  };
  
  return (
    <div className={`flex flex-col items-center max-w-full w-full ${className}`}>
      <div className="mb-8 text-center w-full">
        <div className="inline-flex rounded-full bg-background-container p-1 mb-2">
          <button 
            type="button" 
            className={`px-6 py-2.5 text-base font-medium rounded-full focus:outline-none ${
              mode === 'pomodoro'
                ? 'bg-primary text-white shadow-sm' 
                : 'text-text-secondary hover:text-text-primary'
            }`}
            onClick={() => setMode('pomodoro')}
            disabled={isLoading || isTaskLoading}
          >
            Pomodoro
          </button>
          <button 
            type="button" 
            className={`px-6 py-2.5 text-base font-medium rounded-full focus:outline-none ${
              mode === 'shortBreak'
                ? 'bg-primary text-white shadow-sm' 
                : 'text-text-secondary hover:text-text-primary'
            }`}
            onClick={() => setMode('shortBreak')}
            disabled={isLoading || isTaskLoading}
          >
            Short Break
          </button>
          <button 
            type="button" 
            className={`px-6 py-2.5 text-base font-medium rounded-full focus:outline-none ${
              mode === 'longBreak'
                ? 'bg-primary text-white shadow-sm' 
                : 'text-text-secondary hover:text-text-primary'
            }`}
            onClick={() => setMode('longBreak')}
            disabled={isLoading || isTaskLoading}
          >
            Long Break
          </button>
        </div>
        {renderSyncStatus()}
      </div>
      
      <TimerCircle 
        currentTime={currentTime} 
        totalTime={totalTime} 
        className="mb-6"
        size={circleSize} // Use state-based responsive size
      >
        <div className="text-4xl sm:text-5xl font-bold text-text-primary">{timeDisplay}</div>
        <div className="text-sm text-text-secondary">remaining</div>
      </TimerCircle>
      
      <div className="flex items-center space-x-4 mb-8 flex-wrap justify-center">
        <button 
          className={`px-5 sm:px-6 py-3 rounded-full font-medium bg-primary text-white hover:bg-opacity-90 !rounded-button whitespace-nowrap m-1 focus:outline-none ${(!enableStartPauseBtn || isLoading || isTaskLoading) ? 'opacity-50 cursor-not-allowed' : ''}`}
          onClick={handleStartPause}
          disabled={isLoading || isTaskLoading || !enableStartPauseBtn}
        >
          <div className="flex items-center">
            <div className="w-5 h-5 flex items-center justify-center">
              <Icon name={`${isRunning ? 'pause' : 'play'}-line`} size={20} />
            </div>
            <span className="ml-2">
              {isRunning ? 'Pause' : 'Start'}
            </span>
          </div>
        </button>
        <button 
          className="p-3 rounded-full border border-border text-text-primary hover:bg-background-secondary !rounded-button whitespace-nowrap m-1 disabled:opacity-50 focus:outline-none"
          onClick={handleReset}
          disabled={isLoading || isTaskLoading}
        >
          <div className="w-5 h-5 flex items-center justify-center">
            <Icon name="restart-line" size={20} />
          </div>
        </button>
        <button 
          className="p-3 rounded-full border border-border text-text-primary hover:bg-background-secondary !rounded-button whitespace-nowrap m-1 disabled:opacity-50 focus:outline-none"
          onClick={handleSkip}
          disabled={isLoading || isTaskLoading}
        >
          <div className="w-5 h-5 flex items-center justify-center">
            <Icon name="skip-forward-line" size={20} />
          </div>
        </button>
      </div>
      
      <div className="w-full max-w-md bg-background-container rounded-lg p-4">
        <p className="text-text-primary mb-2 break-words text-left">
          {isTaskLoading ? (
            <span className="flex items-center">
              <Icon name="loader-4-line" className="mr-2 animate-spin" size={16} />
              Recovering task...
            </span>
          ) : currentTask ? (
            currentTask.title
          ) : (
            "Select a task to start working"
          )}
        </p>
        <div className="flex items-center justify-between text-sm text-text-secondary flex-wrap gap-2 text-left">
          <span className="break-words text-left">
            {liveProject 
              ? `Project: ${liveProject.name}`
              : currentTask 
                ? "Project: Unknown Project"
                : "No project selected"}
          </span>
          <span className="text-left">
            {liveTask 
              ? `Est: ${liveTask.timeSpent}/${liveTask.timeEstimated}m`
              : currentTask 
                ? `Est: ${currentTask.timeSpent}/${currentTask.timeEstimated}m`
                : "Est: --"}
          </span>
        </div>
      </div>
    </div>
  );
};

export default Timer;