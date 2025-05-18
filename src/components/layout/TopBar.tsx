import React from 'react';
import { useUIStore } from '../../store/uiStore';
import { getCurrentFormattedDate } from '../../utils/timeUtils';

interface TopBarProps {
  className?: string;
}

export const TopBar: React.FC<TopBarProps> = ({ className = '' }) => {
  const { toggleFocusMode, toggleRightSidebar, isRightSidebarOpen } = useUIStore();
  const currentDate = getCurrentFormattedDate();
  
  return (
    <div className={`h-16 border-b border-gray-200 flex items-center justify-between px-6 bg-white ${className}`}>
      <div className="flex items-center">
        <div className="text-lg font-semibold text-gray-800">Pomodoro Timer</div>
        <div className="ml-4 text-sm text-gray-500">{currentDate}</div>
      </div>
      
      <div className="flex items-center space-x-4">
        <button 
          className="p-2 rounded-full hover:bg-gray-100 !rounded-button whitespace-nowrap"
          onClick={toggleRightSidebar}
          aria-label={isRightSidebarOpen ? "Hide Tasks Panel" : "Show Tasks Panel"}
        >
          <div className="w-5 h-5 flex items-center justify-center">
            <i className={`ri-${isRightSidebarOpen ? 'layout-right-2-line' : 'layout-right-line'}`}></i>
          </div>
        </button>
        
        <button 
          className="p-2 rounded-full hover:bg-gray-100 !rounded-button whitespace-nowrap"
          aria-label="Notifications"
        >
          <div className="w-5 h-5 flex items-center justify-center">
            <i className="ri-notification-line"></i>
          </div>
        </button>
        
        <button 
          id="focusModeBtn" 
          className="p-2 rounded-full hover:bg-gray-100 !rounded-button whitespace-nowrap"
          onClick={toggleFocusMode}
          aria-label="Toggle Focus Mode"
        >
          <div className="w-5 h-5 flex items-center justify-center">
            <i className="ri-fullscreen-line" id="focusModeIcon"></i>
          </div>
        </button>
      </div>
    </div>
  );
};

export default TopBar; 