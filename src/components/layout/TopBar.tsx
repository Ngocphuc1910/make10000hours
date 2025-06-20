import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUIStore } from '../../store/uiStore';
import { useDeepFocusStore } from '../../store/deepFocusStore';
import { useEnhancedDeepFocusSync } from '../../hooks/useEnhancedDeepFocusSync';
import { useExtensionSync } from '../../hooks/useExtensionSync';
import { formatElapsedTime } from '../../utils/timeFormat';
import { Icon } from '../ui/Icon';
import { Tooltip } from '../ui/Tooltip';

interface TopBarProps {
  className?: string;
}

export const TopBar: React.FC<TopBarProps> = ({ className = '' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toggleFocusMode, isLeftSidebarOpen, toggleLeftSidebar } = useUIStore();
  const { 
    isDeepFocusActive, 
    enableDeepFocus, 
    disableDeepFocus,
    activeSessionId,
    activeSessionElapsedSeconds
  } = useDeepFocusStore();
  useEnhancedDeepFocusSync(); // Enhanced sync with activity detection
  useExtensionSync(); // Bidirectional extension sync
  
  // Get page title based on current route
  const getPageTitle = () => {
    switch (location.pathname) {
      case '/pomodoro':
        return 'Pomodoro Timer';
      case '/projects':
        return 'Task Management';
      case '/dashboard':
        return 'Productivity Insights';
      case '/calendar':
        return 'Calendar';
      case '/deep-focus':
        return 'Deep Focus';
      case '/dashboard/settings':
        return 'Settings';
      default:
        return 'Pomodoro Timer';
    }
  };
  
  return (
    <div className={`top-bar-header h-16 border-b border-border flex items-center justify-between px-4 bg-background-primary transition-all duration-500 relative ${className}`}>
      <div className="flex items-center">
        {!isLeftSidebarOpen && (
          <button
            onClick={toggleLeftSidebar}
            className="p-2 mr-2 rounded-md hover:bg-background-secondary hover:shadow-sm hover:scale-105 transition-all duration-200 group"
            aria-label="Show Sidebar"
          >
            <div className="w-5 h-5 flex items-center justify-center text-text-secondary group-hover:text-text-primary transition-colors duration-200">
              <Icon name="menu-line" size={20} />
            </div>
          </button>
        )}
        <div className={`text-lg font-semibold transition-all duration-500 ${
          isDeepFocusActive 
            ? 'bg-gradient-to-r from-[rgb(187,95,90)] via-[rgb(236,72,153)] to-[rgb(251,146,60)] bg-clip-text text-transparent font-bold' 
            : 'text-text-primary'
        }`}>
          {getPageTitle()}
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
            <div className={`w-[120px] h-[33px] flex items-center rounded-full transition-all duration-500 relative ${
              isDeepFocusActive 
                ? 'bg-gradient-to-r from-[rgba(187,95,90,0.9)] via-[rgba(236,72,153,0.9)] to-[rgba(251,146,60,0.9)] shadow-[0_0_15px_rgba(236,72,153,0.3)] border border-white/20 justify-start pl-[10.5px]' 
                : 'bg-gray-100/80 border-0 justify-end pr-[10.5px]'
            }`}>
              <span className={`text-sm font-medium transition-colors duration-500 relative z-10 whitespace-nowrap ${
                isDeepFocusActive 
                  ? 'text-white font-semibold [text-shadow:0_0_12px_rgba(255,255,255,0.5)]' 
                  : 'text-gray-600 font-semibold'
              }`}>
                {isDeepFocusActive ? 'Deep Focus' : 'Focus Off'}
              </span>
            </div>
            <div className={`absolute w-6 h-6 bg-white rounded-full shadow-lg transition-all duration-500 ${
              isDeepFocusActive 
                ? 'left-[calc(100%-27px)] shadow-[0_6px_20px_rgba(187,95,90,0.2)]' 
                : 'left-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.1)]'
            }`}></div>
          </label>
        </div>
      </div>
      
      <div className="flex items-center space-x-4">
        {/* Focus Mode Icon */}
        <Tooltip text="Focus mode">
          <button 
            id="focusModeBtn" 
            className="p-2 rounded-full hover:bg-background-secondary !rounded-button whitespace-nowrap text-text-secondary hover:text-text-primary"
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
            className={`p-2 rounded-full !rounded-button whitespace-nowrap text-text-secondary ${
              location.pathname === '/pomodoro' 
                ? 'bg-background-container text-text-primary' 
                : 'hover:bg-background-container hover:text-text-primary'
            }`}
            onClick={location.pathname === '/pomodoro' ? undefined : () => navigate('/pomodoro')}
            aria-label={location.pathname === '/pomodoro' ? 'Current page: Pomodoro Timer' : 'Go to Pomodoro Timer'}
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
            className={`p-2 rounded-full !rounded-button whitespace-nowrap text-text-secondary ${
              location.pathname === '/projects' 
                ? 'bg-background-container text-text-primary' 
                : 'hover:bg-background-container hover:text-text-primary'
            }`}
            onClick={location.pathname === '/projects' ? undefined : () => navigate('/projects')}
            aria-label={location.pathname === '/projects' ? 'Current page: Task Management' : 'Go to Task Management'}
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
            className={`p-2 rounded-full !rounded-button whitespace-nowrap text-text-secondary ${
              location.pathname === '/dashboard' 
                ? 'bg-background-container text-text-primary' 
                : 'hover:bg-background-container hover:text-text-primary'
            }`}
            onClick={location.pathname === '/dashboard' ? undefined : () => navigate('/dashboard')}
            aria-label={location.pathname === '/dashboard' ? 'Current page: Productivity Insights' : 'Go to Productivity Insights'}
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
            className={`p-2 rounded-full !rounded-button whitespace-nowrap text-text-secondary ${
              location.pathname === '/calendar' 
                ? 'bg-background-container text-text-primary' 
                : 'hover:bg-background-container hover:text-text-primary'
            }`}
            onClick={location.pathname === '/calendar' ? undefined : () => navigate('/calendar')}
            aria-label={location.pathname === '/calendar' ? 'Current page: Calendar' : 'Go to Calendar'}
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
            className={`p-2 rounded-full !rounded-button whitespace-nowrap text-text-secondary ${
              location.pathname === '/deep-focus' 
                ? 'bg-background-container text-text-primary' 
                : 'hover:bg-background-container hover:text-text-primary'
            }`}
            onClick={location.pathname === '/deep-focus' ? undefined : () => navigate('/deep-focus')}
            aria-label={location.pathname === '/deep-focus' ? 'Current page: Deep Focus' : 'Go to Deep Focus'}
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