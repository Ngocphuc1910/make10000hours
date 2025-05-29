import React, { useEffect, useRef } from 'react';
import { useTimerStore } from '../../store/timerStore';
import { useTaskStore } from '../../store/taskStore';
import TimerCircle from '../ui/TimerCircle';
import { formatTime } from '../../utils/timeUtils';
import { Icon } from '../ui/Icon';

interface TimerProps {
  className?: string;
}

export const Timer: React.FC<TimerProps> = ({ className = '' }) => {
  const { 
    currentTime, 
    totalTime, 
    isRunning, 
    mode, 
    sessionsCompleted,
    start, 
    pause, 
    reset, 
    skip, 
    tick,
    currentTaskId
  } = useTimerStore();
  
  const { tasks } = useTaskStore();
  const originalTitleRef = useRef<string>('');
  
  // Store original title on mount
  useEffect(() => {
    originalTitleRef.current = document.title;
  }, []);
  
  // Find current task
  const currentTask = currentTaskId 
    ? tasks.find(task => task.id === currentTaskId) 
    : null;
  
  // Setup timer tick
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (isRunning) {
      interval = setInterval(() => {
        tick();
      }, 1000);
    } else if (interval) {
      clearInterval(interval);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, tick]);
  
  // Update browser tab title when timer is running
  useEffect(() => {
    if (isRunning) {
      const timeDisplay = formatTime(currentTime);
      const taskName = currentTask ? currentTask.title : 'Focus Session';
      document.title = `${timeDisplay} - ${taskName}`;
    } else {
      document.title = originalTitleRef.current;
    }
    
    // Cleanup: restore original title when component unmounts
    return () => {
      document.title = originalTitleRef.current;
    };
  }, [isRunning, currentTime, currentTask?.title]);
  
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
  
  return (
    <div className={`flex flex-col items-center max-w-full w-full ${className}`}>
      <div className="mb-8 text-center w-full">
        <div className="inline-flex items-center bg-gray-100 p-1 rounded-full mb-2 flex-wrap justify-center">
          <button 
            className={`px-4 sm:px-6 py-2 rounded-full font-medium transition-all !rounded-button whitespace-nowrap text-sm sm:text-base
            ${mode === 'pomodoro' ? 'bg-primary text-white' : 'text-gray-600 hover:text-gray-800'}`}
            onClick={() => useTimerStore.getState().setMode('pomodoro')}
          >
            Pomodoro
          </button>
          <button 
            className={`px-4 sm:px-6 py-2 rounded-full font-medium transition-all !rounded-button whitespace-nowrap text-sm sm:text-base
            ${mode === 'shortBreak' ? 'bg-primary text-white' : 'text-gray-600 hover:text-gray-800'}`}
            onClick={() => useTimerStore.getState().setMode('shortBreak')}
          >
            Short Break
          </button>
          <button 
            className={`px-4 sm:px-6 py-2 rounded-full font-medium transition-all !rounded-button whitespace-nowrap text-sm sm:text-base
            ${mode === 'longBreak' ? 'bg-primary text-white' : 'text-gray-600 hover:text-gray-800'}`}
            onClick={() => useTimerStore.getState().setMode('longBreak')}
          >
            Long Break
          </button>
        </div>
        <p className="text-sm text-gray-500">Session {sessionsCompleted + 1} of {useTimerStore.getState().settings.longBreakInterval}</p>
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
          className="px-5 sm:px-6 py-3 rounded-full bg-primary text-white font-medium hover:bg-opacity-90 !rounded-button whitespace-nowrap m-1"
          onClick={handleStartPause}
        >
          <div className="flex items-center">
            <div className="w-5 h-5 flex items-center justify-center">
              <Icon name={`${isRunning ? 'pause' : 'play'}-line`} size={20} />
            </div>
            <span className="ml-2">{isRunning ? 'Pause' : 'Start'}</span>
          </div>
        </button>
        <button 
          className="p-3 rounded-full border border-gray-300 text-gray-700 hover:bg-gray-50 !rounded-button whitespace-nowrap m-1"
          onClick={handleReset}
        >
          <div className="w-5 h-5 flex items-center justify-center">
            <Icon name="restart-line" size={20} />
          </div>
        </button>
        <button 
          className="p-3 rounded-full border border-gray-300 text-gray-700 hover:bg-gray-50 !rounded-button whitespace-nowrap m-1"
          onClick={handleSkip}
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