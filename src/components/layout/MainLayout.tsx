import React, { useState, useRef } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { useUIStore } from '../../store/uiStore';
import FocusMode from '../pomodoro/FocusMode';
import { Outlet, useLocation } from 'react-router-dom';
import TaskList from '../tasks/TaskList';
import { Icon } from '../ui/Icon';
import { Tooltip } from '../ui/Tooltip';
import SyncDebugPanel from '../sync/SyncDebugPanel';

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
          <div className="bg-background-primary rounded-lg border border-border">
            <div className="p-4">
              <h3 className="text-lg font-semibold text-text-primary mb-4">Tasks</h3>
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
    <div className={`main-layout-container flex h-screen overflow-hidden bg-background-primary ${location.pathname === '/pomodoro' ? 'pomodoro-page-container' : ''} ${className}`}>
      {/* Left Sidebar - Navigation */}
      <Sidebar className={location.pathname === '/pomodoro' ? 'pomodoro-sidebar' : ''} />
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <TopBar />
        
        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden relative" style={{ zIndex: 1 }}>
          {/* Timer Section */}
          <div 
            ref={timerSectionRef}
            className="flex-1 flex flex-col items-center justify-center p-6 bg-background-primary relative min-w-[300px] overflow-y-auto" 
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
            <div className="w-full h-full overflow-y-auto flex flex-col items-center justify-center">
              {children || <Outlet />}
            </div>
          </div>
          
          {/* Resizable Divider - Only render when right sidebar is open */}
          {isRightSidebarOpen && (
            <div 
              id="resizeDivider" 
              className="w-[1px] bg-border/20 cursor-col-resize hover:bg-primary/20 flex items-center justify-center group"
              onMouseDown={handleResizeStart}
            >
              <div className="w-4 h-full opacity-0"></div>
              <Tooltip text="Hide task list (Cmd + \)" placement="bottom" offset={32}>
                <button 
                  className="absolute w-6 h-12 bg-background-secondary border border-border rounded-l-md flex items-center justify-center shadow-sm hover:shadow-md -right-0 top-1/2 transform -translate-y-1/2 transition-all duration-200 hover:bg-background-primary group-hover:border-primary/30 sidebar-edge-toggle"
                  onClick={(e) => {
                    e.stopPropagation();
                    useUIStore.getState().toggleRightSidebar();
                  }}
                  aria-label="Hide task list (Cmd + \)"
                >
                  <div className="flex items-center justify-center">
                    <Icon name="arrow-right-s-line" size={14} className="text-gray-500 transition-colors group-hover:text-primary" />
                  </div>
                </button>
              </Tooltip>
            </div>
          )}
          
          {/* Right Sidebar - Task Management - Only render when open */}
          {isRightSidebarOpen && (
            <div 
              ref={rightSidebarRef}
              id="rightSidebar" 
              className="border-l border-border flex flex-col bg-background-primary min-w-[280px]"
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
            <Tooltip text="Show task list (Cmd + \)" placement="left" offset={24}>
              <button 
                className="fixed right-0 top-1/2 transform -translate-y-1/2 z-[100] w-6 h-12 bg-background-secondary border border-border border-r-0 rounded-l-md shadow-md hover:shadow-lg transition-all duration-200 hover:bg-background-primary hover:border-primary/30 group sidebar-edge-toggle sidebar-toggle-show"
                onClick={() => useUIStore.getState().toggleRightSidebar()}
                aria-label="Show task list (Cmd + \)"
              >
                <div className="w-4 h-4 flex items-center justify-center text-text-secondary group-hover:text-primary transition-colors">
                  <Icon name="arrow-left-s-line" size={14} />
                </div>
              </button>
            </Tooltip>
          )}
        </div>
      </div>
      
      {/* Focus Mode */}
      <FocusMode />
      
      {/* Sync Debug Panel */}
      <SyncDebugPanel />
    </div>
  );
};

export default MainLayout; 