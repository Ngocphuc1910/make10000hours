import React from 'react';
import { Play, Pause, SkipForward, RotateCcw } from 'lucide-react';
import { useTimer } from '../../hooks/useTimer';
import { useTasks } from '../../hooks/useTasks';

const Timer = () => {
  const {
    currentTime,
    isActive,
    mode,
    startTimer,
    pauseTimer,
    resetTimer,
    skipTimer
  } = useTimer();
  
  const { tasks, activeTaskId } = useTasks();
  
  // Find the active task
  const activeTask = tasks.find(task => task.id === activeTaskId);
  
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
  
  return (
    <div className={`rounded-xl p-6 ${getBackgroundColor()}`}>
      <div className="text-center mb-6">
        <h2 className="text-lg font-medium">{getModeLabel()}</h2>
      </div>
      
      <div className="text-center mb-8">
        <div className="text-7xl font-bold tracking-tighter">
          {formatTime(currentTime)}
        </div>
      </div>
      
      <div className="flex justify-center space-x-4">
        {isActive ? (
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
      <div className="border-t border-gray-200 dark:border-gray-800 pt-6 w-full grid grid-cols-2 gap-4">
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
    </div>
  );
};

export default Timer; 