import React, { useState, useRef } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { useUIStore } from '../../store/uiStore';
import FocusMode from '../pomodoro/FocusMode';
import { Outlet, useLocation } from 'react-router-dom';
import TaskList from '../tasks/TaskList';
import { Icon } from '../ui/Icon';

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
  const { isRightSidebarOpen, isLeftSidebarOpen, rightSidebarWidth, setRightSidebarWidth } = useUIStore();
  const [isResizing, setIsResizing] = useState(false);
  const [currentWidth, setCurrentWidth] = useState(rightSidebarWidth);
  const timerSectionRef = useRef<HTMLDivElement>(null);
  const rightSidebarRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  
  // Determine the right sidebar content based on the current route
  const getSidebarContent = () => {
    if (location.pathname === '/pomodoro') {
      return (
        <div className="p-4 space-y-4">
          {/* Task List */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Tasks</h3>
              <TaskList />
            </div>
          </div>
        </div>
      );
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
    const maxSidebarWidth = Math.floor(containerRect.width * 0.5); // 50% of screen width
    const maxTimerWidth = containerRect.width - minSidebarWidth;
    
    let newTimerWidth = e.clientX - containerRect.left;
    
    // Apply constraints
    if (newTimerWidth < minTimerWidth) newTimerWidth = minTimerWidth;
    if (newTimerWidth > maxTimerWidth) newTimerWidth = maxTimerWidth;
    
    // Calculate sidebar width and apply 50% constraint
    let newSidebarWidth = containerRect.width - newTimerWidth - 1; // -1 for the divider
    
    // Ensure sidebar doesn't exceed 50% of screen width
    if (newSidebarWidth > maxSidebarWidth) {
      newSidebarWidth = maxSidebarWidth;
      newTimerWidth = containerRect.width - newSidebarWidth - 1;
    }
    
    // Update widths immediately for smooth visual feedback
    timerSectionRef.current.style.width = `${newTimerWidth}px`;
    timerSectionRef.current.style.flex = 'none';
    
    // Calculate and update sidebar width
    rightSidebarRef.current.style.width = `${newSidebarWidth}px`;
    
    // Update local state for immediate visual feedback
    setCurrentWidth(newSidebarWidth);
    
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
    
    // Only update the store when resizing is finished
    if (currentWidth !== rightSidebarWidth) {
      setRightSidebarWidth(currentWidth);
    }
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
  }, [isResizing, currentWidth]);
  
  // Sync local state with store state when store changes (but not during resize)
  React.useEffect(() => {
    if (!isResizing) {
      setCurrentWidth(rightSidebarWidth);
    }
  }, [rightSidebarWidth, isResizing]);
  
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
        <div className="flex-1 flex overflow-hidden relative" style={{ zIndex: 1 }}>
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
          
          {/* Resizable Divider - Only render when right sidebar is open */}
          {isRightSidebarOpen && (
            <div 
              id="resizeDivider" 
              className="w-[1px] bg-gray-200/20 cursor-col-resize hover:bg-primary/20 flex items-center justify-center"
              onMouseDown={handleResizeStart}
            >
              <div className="w-4 h-full opacity-0"></div>
              <button 
                className="absolute w-6 h-16 bg-white border border-gray-200 rounded-l-md flex items-center justify-center shadow-sm -right-0 top-1/2 transform -translate-y-1/2"
                onClick={() => useUIStore.getState().toggleRightSidebar()}
                aria-label="Hide Tasks Panel"
              >
                <div className="flex items-center justify-center">
                  <Icon name="arrow-right-s-line" size={16} className="text-gray-500" />
                </div>
              </button>
            </div>
          )}
          
          {/* Right Sidebar - Task Management - Only render when open */}
          {isRightSidebarOpen && (
            <div 
              ref={rightSidebarRef}
              id="rightSidebar" 
              className="border-l border-gray-200 flex flex-col bg-white min-w-[280px]"
              style={{ 
                width: `${currentWidth}px`,
                flexShrink: 0
              }}
            >
              <div className="flex-1 overflow-y-auto overflow-x-visible">
                {actualSidebarContent}
              </div>
            </div>
          )}
          
          {/* Right sidebar show button - displayed when sidebar is hidden */}
          {!isRightSidebarOpen && (
            <button 
              className="p-2 rounded-l-lg bg-white shadow-md hover:bg-gray-100 fixed right-0 top-1/2 transform -translate-y-1/2 z-20"
              onClick={() => useUIStore.getState().toggleRightSidebar()}
              aria-label="Show Tasks Panel"
            >
              <div className="w-5 h-5 flex items-center justify-center text-gray-700">
                <Icon name="layout-right-line" size={20} />
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