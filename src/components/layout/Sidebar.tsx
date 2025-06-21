import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useUIStore } from '../../store/uiStore';
import { useUserStore } from '../../store/userStore';
import UserSection from '../auth/UserSection';
import { Icon } from '../ui/Icon';
import { ThemeSwitcher } from '../ui/ThemeSwitcher';

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

  // Debug logging for sidebar state changes
  useEffect(() => {
    console.log('🔧 Sidebar Component: State changed', { 
      isLeftSidebarOpen, 
      pathname: location.pathname,
      timestamp: new Date().toISOString() 
    });
  }, [isLeftSidebarOpen, location.pathname]);

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
      label: 'Productivity Insights',
      path: '/dashboard'
    },
    {
      icon: 'calendar-line',
      label: 'Calendar',
      path: '/calendar'
    },
    {
      icon: 'brain-line',
      label: 'Deep Focus',
      path: '/deep-focus'
    },
    {
      icon: 'database-2-line',
      label: 'Data Sync',
      path: '/data-sync'
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
    if (path === '/deep-focus' && location.pathname === '/deep-focus') {
      return true;
    }
    if (path === '/calendar' && location.pathname === '/calendar') {
      return true;
    }
    if (path === '/data-sync' && location.pathname === '/data-sync') {
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
        className={`bg-background-secondary border-r border-border flex flex-col
        ${isLeftSidebarOpen ? 'w-64' : 'w-0'} ${className}`}
        style={{ zIndex: 40 }}
      >
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h1 className="text-xl font-['Pacifico'] text-primary">Make10000hours</h1>
          <button
            onClick={handleToggleSidebar}
            className="p-1 hover:bg-background-primary hover:shadow-sm hover:scale-105 rounded-md transition-all duration-200 group"
          >
            <div className="w-5 h-5 flex items-center justify-center text-text-secondary group-hover:text-text-primary transition-colors duration-200">
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
                        ? 'text-primary bg-indigo-50 dark:bg-primary/10'
                        : 'text-text-secondary hover:bg-background-primary'
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

        <ThemeSwitcher />

        <div className="p-4 border-t border-border">
          <Link
            to="/support"
            onClick={(e) => {
              e.preventDefault();
              handleNavClick('/support');
            }}
            className="flex items-center px-3 py-2 text-sm font-medium text-text-secondary rounded-md hover:bg-background-secondary"
          >
            <div className="w-5 h-5 flex items-center justify-center mr-3">
              <Icon name="question-line" size={20} />
            </div>
            Help & Support
          </Link>
        </div>
      </aside>
    </>
  );
};

export default Sidebar; 