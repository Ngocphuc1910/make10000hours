import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useUIStore } from '../../store/uiStore';
import { useUserStore } from '../../store/userStore';
import UserSection from '../auth/UserSection';
import { Icon } from '../ui/Icon';

interface SidebarProps {
  className?: string;
}

interface NavItem {
  icon: string;
  label: string;
  path: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ className = '' }) => {
  const { isLeftSidebarOpen, toggleLeftSidebar } = useUIStore();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useUserStore();

  const navItems: NavItem[] = [
    {
      icon: 'timer-line',
      label: 'Pomodoro Timer',
      path: '/pomodoro'
    },
    {
      icon: 'task-line',
      label: 'Task Management',
      path: '/projects'
    },
    {
      icon: 'dashboard-line',
      label: 'Dashboard',
      path: '/dashboard'
    },
    {
      icon: 'calendar-line',
      label: 'Calendar',
      path: '/calendar'
    },
    {
      icon: 'settings-line',
      label: 'Settings',
      path: '/dashboard/settings'
    }
  ];

  const handleNavClick = (path: string) => {
    navigate(path);

    // On mobile, close the sidebar after navigation
    if (window.innerWidth < 768) {
      toggleLeftSidebar();
    }
  };

  // Function to check if a route is active, including partial matches for nested routes
  const isRouteActive = (path: string): boolean => {
    if (path === '/dashboard' && location.pathname === '/dashboard') {
      return true;
    }
    if (path === '/pomodoro' && location.pathname === '/pomodoro') {
      return true;
    }
    if (path === '/projects' && location.pathname === '/projects') {
      return true;
    }
    if (path.startsWith('/dashboard/') && location.pathname.startsWith(path)) {
      return true;
    }
    return false;
  };

  // Function to handle sidebar toggle - simplified
  const handleToggleSidebar = () => {
    toggleLeftSidebar();
  };

  return (
    <>
      <aside
        id="sidebar"
        className={`bg-white border-r border-gray-200 flex flex-col transition-all duration-300
        ${isLeftSidebarOpen ? 'w-64' : 'w-0'} ${className}`}
        style={{ zIndex: 40 }}
      >
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h1 className="text-xl font-['Pacifico'] text-primary">Make10000hours</h1>
          <button
            id="toggle-sidebar"
            onClick={handleToggleSidebar}
            className="p-1 hover:bg-gray-100 rounded-md"
          >
            <div className="w-5 h-5 flex items-center justify-center text-gray-500">
              <Icon name="arrow-left-s-line" size={20} />
            </div>
          </button>
        </div>

        <UserSection />

        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-1">
            {navItems.map((item, index) => {
              const isActive = isRouteActive(item.path);
              return (
                <li key={index}>
                  <Link
                    to={item.path}
                    onClick={(e) => {
                      e.preventDefault();
                      handleNavClick(item.path);
                    }}
                    className={`flex items-center px-3 py-2 text-sm font-medium rounded-md text-left
                    ${isActive
                        ? 'text-primary bg-indigo-50'
                        : 'text-gray-600 hover:bg-gray-50'
                      }`}
                  >
                    <div className="w-5 h-5 flex items-center justify-center mr-3">
                      <Icon name={item.icon} size={20} />
                    </div>
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-gray-200">
          <Link
            to="/support"
            onClick={(e) => {
              e.preventDefault();
              handleNavClick('/support');
            }}
            className="flex items-center px-3 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-50"
          >
            <div className="w-5 h-5 flex items-center justify-center mr-3">
              <Icon name="question-line" size={20} />
            </div>
            Help & Support
          </Link>
        </div>
      </aside>

      {/* Mobile sidebar toggle button - shown when sidebar is hidden */}
      {!isLeftSidebarOpen && (
        <button
          id="show-sidebar"
          onClick={handleToggleSidebar}
          className="fixed left-4 top-4 z-50 p-2 rounded-lg bg-white shadow-md hover:bg-gray-100"
          aria-label="Show Sidebar"
        >
          <div className="w-5 h-5 flex items-center justify-center text-gray-700">
            <Icon name="menu-line" size={20} />
          </div>
        </button>
      )}
    </>
  );
};

export default Sidebar; 