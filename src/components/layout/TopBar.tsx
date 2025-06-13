import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useUIStore } from '../../store/uiStore';
import { useDeepFocusStore } from '../../store/deepFocusStore';
import { useDeepFocusSync } from '../../hooks/useDeepFocusSync';
import { formatElapsedTime } from '../../utils/timeFormat';
import { Icon } from '../ui/Icon';
import { Tooltip } from '../ui/Tooltip';

interface TopBarProps {
  className?: string;
}

export const TopBar: React.FC<TopBarProps> = ({ className = '' }) => {
  const navigate = useNavigate();
  const { toggleFocusMode } = useUIStore();
  const { 
    isDeepFocusActive, 
    enableDeepFocus, 
    disableDeepFocus,
    activeSessionId,
    activeSessionElapsedSeconds
  } = useDeepFocusStore();
  useDeepFocusSync(); // Sync Deep Focus state across pages
  
  return (
    <div className={`h-16 border-b border-gray-200 flex items-center justify-between px-6 bg-white transition-all duration-500 relative ${className}`}>
      <div className="flex items-center">
        <div className={`text-lg font-semibold transition-all duration-500 ${
          isDeepFocusActive 
            ? 'bg-gradient-to-r from-[rgb(187,95,90)] via-[rgb(236,72,153)] to-[rgb(251,146,60)] bg-clip-text text-transparent font-bold' 
            : 'text-gray-800'
        }`}>
          Pomodoro Timer
        </div>
        <div className="ml-4 flex items-center">
          <label className="relative inline-flex items-center cursor-pointer group">
            <input 
              type="checkbox" 
              className="sr-only peer" 
              checked={isDeepFocusActive}
              onChange={(e) => {
                if (e.target.checked) {
                  enableDeepFocus();
                } else {
                  disableDeepFocus();
                }
              }}
            />
            <div className={`w-[150px] h-[50px] flex flex-col items-center justify-center rounded-full transition-all duration-500 relative ${
              isDeepFocusActive 
                ? 'bg-gradient-to-r from-[rgba(187,95,90,0.9)] via-[rgba(236,72,153,0.9)] to-[rgba(251,146,60,0.9)] shadow-[0_0_15px_rgba(236,72,153,0.3)] border border-white/20' 
                : 'bg-gray-100/80 backdrop-blur-sm'
            }`}>
              <span className={`text-sm font-medium transition-colors duration-500 relative z-10 whitespace-nowrap ${
                isDeepFocusActive 
                  ? 'text-white font-semibold [text-shadow:0_0_12px_rgba(255,255,255,0.5)]' 
                  : 'text-gray-500'
              }`}>
                {isDeepFocusActive ? 'Deep Focus' : 'Focus Off'}
              </span>
              {isDeepFocusActive && activeSessionId && (
                <span className="text-xs text-white/90 font-mono [text-shadow:0_0_8px_rgba(255,255,255,0.3)]">
                  {formatElapsedTime(activeSessionElapsedSeconds)}
                </span>
              )}
            </div>
            <div className={`absolute w-6 h-6 bg-white rounded-full shadow-lg transition-all duration-500 ${
              isDeepFocusActive 
                ? 'right-2 shadow-[0_6px_20px_rgba(187,95,90,0.2)]' 
                : 'left-2 shadow-[0_2px_8px_rgba(0,0,0,0.1)]'
            }`}></div>
          </label>
        </div>
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
              <Icon 
                name="fullscreen-line" 
                size={20}
              />
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
              <Icon 
                name="timer-line" 
                size={20}
              />
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
              <Icon 
                name="task-line" 
                size={20}
              />
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
              <Icon 
                name="dashboard-line" 
                size={20}
              />
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
              <Icon 
                name="calendar-line" 
                size={20}
              />
            </span>
          </button>
        </Tooltip>
        
        <Tooltip text="Deep Focus">
          <button 
            className="p-2 rounded-full hover:bg-gray-100 !rounded-button whitespace-nowrap"
            onClick={() => navigate('/deep-focus')}
            aria-label="Go to Deep Focus"
          >
            <span className="w-5 h-5 flex items-center justify-center">
              <Icon 
                name="brain-line" 
                size={20}
              />
            </span>
          </button>
        </Tooltip>
      </div>
    </div>
  );
};

export default TopBar; 