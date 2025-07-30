import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUIStore } from '../../store/uiStore';
import { Icon } from '../ui/Icon';
import { Tooltip } from '../ui/Tooltip';

interface VerticalNavigationProps {
  className?: string;
}

export const VerticalNavigation: React.FC<VerticalNavigationProps> = ({ className = '' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLeftSidebarOpen } = useUIStore();

  // Don't render if left sidebar is open
  if (isLeftSidebarOpen) {
    return null;
  }

  const navigationItems = [
    {
      icon: 'timer-line',
      tooltip: 'Pomodoro Timer',
      path: '/pomodoro',
      shortcut: 'P'
    },
    {
      icon: 'task-line',
      tooltip: 'Task Management', 
      path: '/projects',
      shortcut: 'T'
    },
    {
      icon: 'dashboard-line',
      tooltip: 'Productivity Insights',
      path: '/dashboard', 
      shortcut: 'I'
    },
    {
      icon: 'calendar-line',
      tooltip: 'Calendar',
      path: '/calendar',
      shortcut: 'C'
    },
    {
      icon: 'brain-line',
      tooltip: 'Deep Focus',
      path: '/deep-focus',
      shortcut: 'F'
    }
  ];

  return (
    <div className={`fixed left-4 top-16 z-30 flex flex-col space-y-2 ${className}`}>
      {navigationItems.map((item) => {
        const isActive = location.pathname === item.path;
        
        return (
          <Tooltip key={item.path} text={`${item.tooltip} (${item.shortcut})`} placement="right">
            <button 
              className={`p-2 rounded-full !rounded-button whitespace-nowrap text-text-secondary ${
                isActive
                  ? 'bg-background-container text-text-primary' 
                  : 'hover:bg-background-container hover:text-text-primary'
              }`}
              onClick={() => navigate(item.path)}
              aria-label={isActive ? `Current page: ${item.tooltip}` : `Go to ${item.tooltip}`}
            >
              <span className="w-5 h-5 flex items-center justify-center">
                <Icon name={item.icon} size={20} />
              </span>
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
};

export default VerticalNavigation;