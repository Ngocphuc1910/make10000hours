import React, { useState, useRef } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { useUIStore } from '../../store/uiStore';
import FocusMode from '../pomodoro/FocusMode';
import { Outlet, useLocation } from 'react-router-dom';
import TaskList from '../tasks/TaskList';

interface MainLayoutProps {
  children?: React.ReactNode;
  className?: string;
  rightSidebarContent?: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ 
  children,
  className = '',
  rightSidebarContent
}) => {
  const { isRightSidebarOpen, isLeftSidebarOpen } = useUIStore();
  const [isResizing, setIsResizing] = useState(false);
  const timerSectionRef = useRef<HTMLDivElement>(null);
  const rightSidebarRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  
  // Determine the right sidebar content based on the current route
  const getSidebarContent = () => {
    if (location.pathname === '/pomodoro') {
      return <TaskList />;
    }
    return null;
  };
  
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };
  
  const handleResizeMove = (e: MouseEvent) => {
    if (!isResizing) return;
    if (!timerSectionRef.current || !rightSidebarRef.current) return;
    
    const containerRect = timerSectionRef.current.parentElement?.getBoundingClientRect();
    if (!containerRect) return;
    
    const minTimerWidth = 300;
    const minSidebarWidth = 280;
    const maxTimerWidth = containerRect.width - minSidebarWidth;
    
    let newTimerWidth = e.clientX - containerRect.left;
    
    // Apply constraints
    if (newTimerWidth < minTimerWidth) newTimerWidth = minTimerWidth;
    if (newTimerWidth > maxTimerWidth) newTimerWidth = maxTimerWidth;
    
    // Update widths
    timerSectionRef.current.style.width = `${newTimerWidth}px`;
    timerSectionRef.current.style.flex = 'none';
    
    // Update sidebar width
    const newSidebarWidth = containerRect.width - newTimerWidth - 1; // -1 for the divider
    rightSidebarRef.current.style.width = `${newSidebarWidth}px`;
    
    // Add compact view class if sidebar gets too narrow
    if (newSidebarWidth < 400) {
      rightSidebarRef.current.classList.add('compact-view');
    } else {
      rightSidebarRef.current.classList.remove('compact-view');
    }
  };
  
  const handleResizeEnd = () => {
    setIsResizing(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };
  
  React.useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleResizeMove);
      window.addEventListener('mouseup', handleResizeEnd);
    } else {
      window.removeEventListener('mousemove', handleResizeMove);
      window.removeEventListener('mouseup', handleResizeEnd);
    }
    
    return () => {
      window.removeEventListener('mousemove', handleResizeMove);
      window.removeEventListener('mouseup', handleResizeEnd);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isResizing]);
  
  // Get the right sidebar content
  const actualSidebarContent = rightSidebarContent || getSidebarContent();
  
  return (
    <div className={`flex h-screen overflow-hidden bg-white ${className}`}>
      {/* Left Sidebar - Navigation */}
      <Sidebar />
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <TopBar />
        
        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Timer Section */}
          <div 
            ref={timerSectionRef}
            className="flex-1 flex flex-col items-center justify-center p-6 bg-white relative min-w-[300px]" 
            id="timerSection" 
            style={
              // When both sidebars are hidden, remove width constraints for perfect centering
              (!isLeftSidebarOpen && !isRightSidebarOpen) ? {} : {
                margin: '0 auto', 
                width: isRightSidebarOpen ? '100%' : '800px',
                maxWidth: isRightSidebarOpen ? '100%' : '800px'
              }
            }
          >
            {children || <Outlet />}
          </div>
          
          {/* Resizable Divider */}
          <div 
            id="resizeDivider" 
            className={`w-[1px] bg-gray-200/20 cursor-col-resize hover:bg-primary/20 flex items-center justify-center
            ${isRightSidebarOpen ? 'opacity-100' : 'opacity-0 w-0'}`}
            onMouseDown={handleResizeStart}
          >
            <div className="w-4 h-full opacity-0"></div>
            {isRightSidebarOpen && (
              <button 
                className="absolute w-6 h-16 bg-white border border-gray-200 rounded-l-md flex items-center justify-center shadow-sm -right-0 top-1/2 transform -translate-y-1/2"
                onClick={() => useUIStore.getState().toggleRightSidebar()}
                aria-label="Hide Tasks Panel"
              >
                <div className="flex items-center justify-center">
                  <i className="ri-arrow-right-s-line text-gray-500"></i>
                </div>
              </button>
            )}
          </div>
          
          {/* Right Sidebar - Task Management */}
          <div 
            ref={rightSidebarRef}
            id="rightSidebar" 
            className={`border-l border-gray-200 flex flex-col bg-white min-w-[280px] transform transition-transform duration-300
            ${isRightSidebarOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 w-0'}`}
            style={{ 
              width: isRightSidebarOpen ? '480px' : '0',
              flexShrink: 0
            }}
          >
            {isRightSidebarOpen && (
              <div className="flex-1 overflow-y-auto">
                {actualSidebarContent}
              </div>
            )}
          </div>
          
          {/* Right sidebar show button - displayed when sidebar is hidden */}
          {!isRightSidebarOpen && (
            <button 
              className="p-2 rounded-l-lg bg-white shadow-md hover:bg-gray-100 fixed right-0 top-1/2 transform -translate-y-1/2 z-20"
              onClick={() => useUIStore.getState().toggleRightSidebar()}
              aria-label="Show Tasks Panel"
            >
              <div className="w-5 h-5 flex items-center justify-center text-gray-700">
                <i className="ri-layout-right-line"></i>
              </div>
            </button>
          )}
        </div>
      </div>
      
      {/* Focus Mode */}
      <FocusMode />
    </div>
  );
};

export default MainLayout; 