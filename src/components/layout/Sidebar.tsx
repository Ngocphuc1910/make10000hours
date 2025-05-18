import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useUIStore } from '../../store/uiStore';

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
  
  const navItems: NavItem[] = [
    { 
      icon: 'dashboard-line', 
      label: 'Dashboard', 
      path: '/dashboard'
    },
    { 
      icon: 'task-line', 
      label: 'Projects & Tasks', 
      path: '/projects'
    },
    { 
      icon: 'timer-line', 
      label: 'Pomodoro Timer', 
      path: '/pomodoro'
    },
    { 
      icon: 'calendar-line', 
      label: 'Calendar', 
      path: '/calendar'
    },
    { 
      icon: 'settings-line', 
      label: 'Settings', 
      path: '/settings'
    }
  ];
  
  const handleNavClick = (path: string) => {
    navigate(path);
    
    // On mobile, close the sidebar after navigation
    if (window.innerWidth < 768) {
      toggleLeftSidebar();
    }
  };
  
  return (
    <>
      <aside 
        id="sidebar" 
        className={`bg-white border-r border-gray-200 flex flex-col transition-all duration-300
        ${isLeftSidebarOpen ? 'w-64' : 'w-0'} ${className}`}
      >
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h1 className="text-xl font-['Pacifico'] text-primary">Make10000hours</h1>
          <button 
            id="toggle-sidebar" 
            onClick={toggleLeftSidebar}
            className="p-1 hover:bg-gray-100 rounded-md"
          >
            <div className="w-5 h-5 flex items-center justify-center text-gray-500">
              <i className="ri-arrow-left-s-line"></i>
            </div>
          </button>
        </div>
        
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white">
              <span className="font-medium">JD</span>
            </div>
            <div className="ml-3 text-left">
              <p className="text-sm font-medium text-gray-900">John Doe</p>
              <p className="text-xs text-gray-500">Product Manager</p>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-1">
            {navItems.map((item, index) => {
              const isActive = location.pathname === item.path;
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
                      <i className={`ri-${item.icon}`}></i>
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
              <i className="ri-question-line"></i>
            </div>
            Help & Support
          </Link>
        </div>
      </aside>
      
      {/* Mobile sidebar toggle button - shown when sidebar is hidden */}
      {!isLeftSidebarOpen && (
        <button 
          id="show-sidebar" 
          onClick={toggleLeftSidebar}
          className="p-2 rounded-lg bg-white shadow-md hover:bg-gray-100 fixed left-4 top-4 z-50"
          aria-label="Show Sidebar"
        >
          <div className="w-5 h-5 flex items-center justify-center text-gray-700">
            <i className="ri-menu-line"></i>
          </div>
        </button>
      )}
    </>
  );
};

export default Sidebar; 