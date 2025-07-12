import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Avatar } from '../../ui/Avatar';
import { Icon } from '../../ui/Icon';
import clsx from 'clsx';

interface NavItem {
  label: string;
  path: string;
  icon: string;
}

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navItems: NavItem[] = [
    { label: 'Productivity Insights', path: '/dashboard', icon: 'dashboard-line' },
    { label: 'Task Management', path: '/projects', icon: 'task-line' },
    { label: 'Pomodoro Timer', path: '/pomodoro', icon: 'timer-line' },
    { label: 'Calendar', path: '/calendar', icon: 'calendar-line' },
    { label: 'Settings', path: '/dashboard/settings', icon: 'settings-line' },
  ];

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <aside 
      className={clsx(
        'bg-background-secondary border-r border-border flex flex-col',
        isCollapsed ? 'w-0 overflow-hidden' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h1 className="text-xl font-pacifico text-primary">logo</h1>
        <button 
          onClick={toggleSidebar}
          className="p-1 hover:bg-background-container rounded"
        >
          <Icon name="arrow-left-s-line" className="text-text-secondary" />
        </button>
      </div>

      {/* User Profile */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center">
          <Avatar initials="JD" bgColor="bg-primary" />
          <div className="ml-3">
            <p className="text-sm font-medium text-text-primary">John Doe</p>
            <p className="text-xs text-text-secondary">Product Manager</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4 scrollbar-thin">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.path}>
              <Link
                to={item.path}
                className={clsx(
                  'flex items-center px-3 py-2 text-sm font-medium rounded-md',
                  (location.pathname === item.path || 
                   (item.path === '/pomodoro' && location.pathname === '/pomodoro'))
                    ? 'text-primary bg-background-container'
                    : 'text-text-secondary hover:bg-background-container'
                )}
              >
                <Icon name={item.icon} className="mr-3" />
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Help & Support */}
      <div className="p-4 border-t border-border">
        <Link
          to="/dashboard/support"
          className="flex items-center px-3 py-2 text-sm font-medium text-text-secondary rounded-md hover:bg-background-container"
        >
          <Icon name="question-line" className="mr-3" />
          Help & Support
        </Link>
      </div>
    </aside>
  );
}; 