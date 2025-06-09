import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useUIStore } from '../../store/uiStore';
import { getCurrentFormattedDate } from '../../utils/timeUtils';
import { Icon } from '../ui/Icon';
import { Tooltip } from '../ui/Tooltip';

interface TopBarProps {
  className?: string;
}

export const TopBar: React.FC<TopBarProps> = ({ className = '' }) => {
  const navigate = useNavigate();
  const { toggleFocusMode } = useUIStore();
  const currentDate = getCurrentFormattedDate();
  
  return (
    <div className={`h-16 border-b border-gray-200 flex items-center justify-between px-6 bg-white ${className}`}>
      <div className="flex items-center">
        <div className="text-lg font-semibold text-gray-800">Pomodoro Timer</div>
        <div className="ml-4 text-sm text-gray-500">{currentDate}</div>
      </div>
      
      <div className="flex items-center space-x-4">
        {/* Focus Mode Icon */}
        <Tooltip text="Focus mode">
          <button 
            id="focusModeBtn" 
            className="p-2 rounded-full hover:bg-gray-100 !rounded-button whitespace-nowrap"
            onClick={toggleFocusMode}
            aria-label="Toggle Focus Mode"
          >
            <span className="w-5 h-5 flex items-center justify-center">
              <Icon name="fullscreen-line" size={20} />
            </span>
          </button>
        </Tooltip>
        
        {/* Navigation Icons */}
        <Tooltip text="Pomodoro Timer">
          <button 
            className="p-2 rounded-full bg-gray-100 !rounded-button whitespace-nowrap"
            aria-label="Current page: Pomodoro Timer"
          >
            <span className="w-5 h-5 flex items-center justify-center">
              <Icon name="timer-line" size={20} />
            </span>
          </button>
        </Tooltip>
        
        <Tooltip text="Task management">
          <button 
            className="p-2 rounded-full hover:bg-gray-100 !rounded-button whitespace-nowrap"
            onClick={() => navigate('/projects')}
            aria-label="Go to Task Management"
          >
            <span className="w-5 h-5 flex items-center justify-center">
              <Icon name="task-line" size={20} />
            </span>
          </button>
        </Tooltip>
        
        <Tooltip text="Productivity Insights">
          <button 
            className="p-2 rounded-full hover:bg-gray-100 !rounded-button whitespace-nowrap"
            onClick={() => navigate('/dashboard')}
            aria-label="Go to Dashboard"
          >
            <span className="w-5 h-5 flex items-center justify-center">
              <Icon name="dashboard-line" size={20} />
            </span>
          </button>
        </Tooltip>
        
        <Tooltip text="Calendar">
          <button 
            className="p-2 rounded-full hover:bg-gray-100 !rounded-button whitespace-nowrap"
            onClick={() => navigate('/calendar')}
            aria-label="Go to Calendar"
          >
            <span className="w-5 h-5 flex items-center justify-center">
              <Icon name="calendar-line" size={20} />
            </span>
          </button>
        </Tooltip>
      </div>
    </div>
  );
};

export default TopBar; 