import React from 'react';
import { useUIStore } from '../../store/uiStore';
import { useTimerStore } from '../../store/timerStore';
import { useTaskStore } from '../../store/taskStore';
import { formatTime } from '../../utils/timeUtils';

interface FocusModeProps {
  className?: string;
}

export const FocusMode: React.FC<FocusModeProps> = ({ className = '' }) => {
  const { isFocusMode, toggleFocusMode } = useUIStore();
  
  // Use selectors to only subscribe to the specific values we need
  const currentTime = useTimerStore(state => state.currentTime);
  const currentTaskId = useTimerStore(state => state.currentTaskId);
  
  const { tasks, projects } = useTaskStore();
  
  // Find current task
  const currentTask = currentTaskId 
    ? tasks.find(task => task.id === currentTaskId) 
    : null;
  
  // Find project for current task
  const currentProject = currentTask && currentTask.projectId
    ? projects.find(p => p.id === currentTask.projectId)
    : null;
  
  // Format time display
  const timeDisplay = formatTime(currentTime);
  
  if (!isFocusMode) return null;
  
  return (
    <div className={`fixed inset-0 bg-black z-50 ${className}`}>
      <button 
        id="exitFocusMode" 
        className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-all"
        onClick={toggleFocusMode}
        aria-label="Exit Focus Mode"
      >
        <div className="w-6 h-6 flex items-center justify-center text-white">
          <i className="ri-fullscreen-exit-line"></i>
        </div>
      </button>
      
      <div className="h-full flex flex-col items-center justify-center">
        <div className="text-[120px] font-bold text-white mb-8 font-mono tracking-wider">
          {timeDisplay}
        </div>
        
        <h2 className="text-2xl text-white/90 mb-4">
          {currentTask ? currentTask.title : 'No task selected'}
        </h2>
        
        <div className="flex items-center gap-8 text-lg text-white/70">
          <div>
            {currentProject 
              ? `Project: ${currentProject.name}` 
              : 'No project selected'}
          </div>
          <div>
            {currentTask 
              ? `${currentTask.timeSpent}/${currentTask.timeEstimated}m` 
              : '--/--m'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FocusMode; 