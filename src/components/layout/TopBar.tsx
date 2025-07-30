import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUIStore } from '../../store/uiStore';
import { Icon } from '../ui/Icon';
import { Tooltip } from '../ui/Tooltip';
import { DeepFocusSwitch } from '../ui/DeepFocusSwitch';

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
    <div className={`h-16 flex items-center justify-between px-4 bg-background-secondary transition-colors duration-200 relative ${className}`}>
      <div className="flex items-center">
        {!isLeftSidebarOpen && (
          <button
            onClick={toggleLeftSidebar}
            className="p-2 mr-2 rounded-md hover:bg-background-primary hover:shadow-sm hover:scale-105 transition-all duration-200 group"
            aria-label="Show Sidebar"
          >
            <div className="w-5 h-5 flex items-center justify-center text-text-secondary group-hover:text-text-primary transition-colors duration-200">
              <Icon name="menu-line" size={20} />
            </div>
          </button>
        )}
        <DeepFocusSwitch 
          size="medium" 
          showLabel={false} 
          showPageTitle={true} 
          pageTitle={getPageTitle()}
        />
      </div>

      <div className="flex items-center">
        {/* Navigation removed - now handled by VerticalNavigation component */}
      </div>
    </div>
  );
};

export default TopBar; 