import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUIStore } from '../../store/uiStore';
import { formatElapsedTime } from '../../utils/timeFormat';
import { Icon } from '../ui/Icon';
import { Tooltip } from '../ui/Tooltip';
import { DeepFocusSwitch } from '../ui/DeepFocusSwitch';
import { useDeepFocusContext } from '../../contexts/DeepFocusContext';

interface TopBarProps {
  className?: string;
}

export const TopBar: React.FC<TopBarProps> = ({ className = '' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toggleFocusMode, isLeftSidebarOpen, toggleLeftSidebar } = useUIStore();
  
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
        return 'Make 10000 Hours';
    }
  };

  return (
    <div className={`flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 ${className}`}>
      <div className="flex items-center space-x-4">
        <button
          onClick={toggleLeftSidebar}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          aria-label="Toggle sidebar"
        >
          <Icon name={isLeftSidebarOpen ? 'menu-fold' : 'menu-unfold'} className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </button>
        <h1 className="text-xl font-semibold text-gray-800 dark:text-white">
          {getPageTitle()}
        </h1>
      </div>

      <div className="flex items-center space-x-4">
        <DeepFocusSwitch
          size="medium"
          showLabel={false}
          className="mr-4"
        />
        {/* Add other top bar items here */}
      </div>
    </div>
  );
};

export default TopBar; 