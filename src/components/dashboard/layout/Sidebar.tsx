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
    { label: 'Dashboard', path: '/dashboard', icon: 'dashboard-line' },
    { label: 'Projects & Tasks', path: '/dashboard/projects', icon: 'task-line' },
    { label: 'Pomodoro Timer', path: '/dashboard/timer', icon: 'timer-line' },
    { label: 'Calendar', path: '/dashboard/calendar', icon: 'calendar-line' },
    { label: 'Settings', path: '/dashboard/settings', icon: 'settings-line' },
  ];

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <aside 
      className={clsx(
        'bg-white border-r border-gray-200 flex flex-col transition-all duration-300',
        isCollapsed ? 'w-0 overflow-hidden' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h1 className="text-xl font-pacifico text-primary">logo</h1>
        <button 
          onClick={toggleSidebar}
          className="p-1 hover:bg-gray-100 rounded"
        >
          <Icon name="arrow-left-s-line" className="text-gray-500" />
        </button>
      </div>

      {/* User Profile */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center">
          <Avatar initials="JD" bgColor="bg-primary" />
          <div className="ml-3">
            <p className="text-sm font-medium text-gray-900">John Doe</p>
            <p className="text-xs text-gray-500">Product Manager</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.path}>
              <Link
                to={item.path}
                className={clsx(
                  'flex items-center px-3 py-2 text-sm font-medium rounded-md',
                  location.pathname === item.path
                    ? 'text-primary bg-indigo-50'
                    : 'text-gray-600 hover:bg-gray-50'
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
      <div className="p-4 border-t border-gray-200">
        <Link
          to="/dashboard/support"
          className="flex items-center px-3 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-50"
        >
          <Icon name="question-line" className="mr-3" />
          Help & Support
        </Link>
      </div>
    </aside>
  );
}; 