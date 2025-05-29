import React from 'react';
import { useTimerStore } from '../../store/timerStore';
import { useTaskStore } from '../../store/taskStore';
import TimerCircle from '../ui/TimerCircle';
import { formatTime } from '../../utils/timeUtils';
import { Icon } from '../ui/Icon';

interface TimerProps {
  className?: string;
}

export const Timer: React.FC<TimerProps> = ({ className = '' }) => {
  // Use selectors for the values that change frequently and need reactivity
  const currentTime = useTimerStore(state => state.currentTime);
  const totalTime = useTimerStore(state => state.totalTime);
  const isRunning = useTimerStore(state => state.isRunning);
  const mode = useTimerStore(state => state.mode);
  const sessionsCompleted = useTimerStore(state => state.sessionsCompleted);
  const currentTaskId = useTimerStore(state => state.currentTaskId);
  
  // Use selectors for less frequently changing values
  const isLoading = useTimerStore(state => state.isLoading);
  const isSyncing = useTimerStore(state => state.isSyncing);
  const isActiveDevice = useTimerStore(state => state.isActiveDevice);
  const syncError = useTimerStore(state => state.syncError);
  
  // Get action functions (these don't change, so we can destructure them)
  const { start, pause, reset, skip, setMode } = useTimerStore();
  
  const { tasks } = useTaskStore();
  
  // Find current task
  const currentTask = currentTaskId 
    ? tasks.find(task => task.id === currentTaskId) 
    : null;
  
  // Button handlers
  const handleStartPause = () => {
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
        <div className="inline-flex items-center bg-gray-100 p-1 rounded-full mb-2 flex-wrap justify-center">
          <button 
            className={`px-4 sm:px-6 py-2 rounded-full font-medium transition-all !rounded-button whitespace-nowrap text-sm sm:text-base
            ${mode === 'pomodoro' ? 'bg-primary text-white' : 'text-gray-600 hover:text-gray-800'}`}
            onClick={() => setMode('pomodoro')}
            disabled={isLoading}
          >
            Pomodoro
          </button>
          <button 
            className={`px-4 sm:px-6 py-2 rounded-full font-medium transition-all !rounded-button whitespace-nowrap text-sm sm:text-base
            ${mode === 'shortBreak' ? 'bg-primary text-white' : 'text-gray-600 hover:text-gray-800'}`}
            onClick={() => setMode('shortBreak')}
            disabled={isLoading}
          >
            Short Break
          </button>
          <button 
            className={`px-4 sm:px-6 py-2 rounded-full font-medium transition-all !rounded-button whitespace-nowrap text-sm sm:text-base
            ${mode === 'longBreak' ? 'bg-primary text-white' : 'text-gray-600 hover:text-gray-800'}`}
            onClick={() => setMode('longBreak')}
            disabled={isLoading}
          >
            Long Break
          </button>
        </div>
        <p className="text-sm text-gray-500">Session {sessionsCompleted + 1} of {useTimerStore.getState().settings.longBreakInterval}</p>
        {renderSyncStatus()}
      </div>
      
      <TimerCircle 
        currentTime={currentTime} 
        totalTime={totalTime} 
        className="mb-6"
        size={Math.min(300, window.innerWidth - 80)} // Responsive size
      >
        <div className="text-4xl sm:text-5xl font-bold text-gray-800">{timeDisplay}</div>
        <div className="text-sm text-gray-500">remaining</div>
      </TimerCircle>
      
      <div className="flex items-center space-x-4 mb-8 flex-wrap justify-center">
        <button 
          className="px-5 sm:px-6 py-3 rounded-full font-medium bg-primary text-white hover:bg-opacity-90 !rounded-button whitespace-nowrap m-1"
          onClick={handleStartPause}
          disabled={isLoading}
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
          className="p-3 rounded-full border border-gray-300 text-gray-700 hover:bg-gray-50 !rounded-button whitespace-nowrap m-1 disabled:opacity-50"
          onClick={handleReset}
          disabled={isLoading}
        >
          <div className="w-5 h-5 flex items-center justify-center">
            <Icon name="restart-line" size={20} />
          </div>
        </button>
        <button 
          className="p-3 rounded-full border border-gray-300 text-gray-700 hover:bg-gray-50 !rounded-button whitespace-nowrap m-1 disabled:opacity-50"
          onClick={handleSkip}
          disabled={isLoading}
        >
          <div className="w-5 h-5 flex items-center justify-center">
            <Icon name="skip-forward-line" size={20} />
          </div>
        </button>
      </div>
      
      <div className="w-full max-w-md bg-gray-50 rounded-lg p-4">
        <p className="text-gray-700 mb-2 break-words text-left">
          {currentTask 
            ? currentTask.title 
            : "Select a task to start working"}
        </p>
        <div className="flex items-center justify-between text-sm text-gray-500 flex-wrap gap-2 text-left">
          <span className="break-words text-left">
            {currentTask 
              ? `Project: ${useTaskStore.getState().projects.find(p => p.id === currentTask.projectId)?.name || 'Unknown Project'}`
              : "No project selected"}
          </span>
          <span className="text-left">
            {currentTask 
              ? `Est: ${currentTask.timeSpent}/${currentTask.timeEstimated}m`
              : "Est: --"}
          </span>
        </div>
      </div>
    </div>
  );
};

export default Timer; 