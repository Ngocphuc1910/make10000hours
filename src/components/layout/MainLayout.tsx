import React, { useState, useRef } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import VerticalNavigation from './VerticalNavigation';
import { useUIStore } from '../../store/uiStore';
import FocusMode from '../pomodoro/FocusMode';
import { Outlet, useLocation } from 'react-router-dom';
import TaskList from '../tasks/TaskList';
import { Icon } from '../ui/Icon';
import { Tooltip } from '../ui/Tooltip';

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
        <div className="h-full">
          {/* Task List */}
          <TaskList />
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
    
    const minSidebarWidth = 280;
    const maxSidebarWidth = Math.floor(containerRect.width * 0.5); // 50% of screen width
    const dividerWidth = 8;
    
    // Calculate new sidebar width based on mouse position from the right edge
    let newSidebarWidth = containerRect.right - e.clientX;
    
    // Apply constraints
    if (newSidebarWidth < minSidebarWidth) newSidebarWidth = minSidebarWidth;
    if (newSidebarWidth > maxSidebarWidth) newSidebarWidth = maxSidebarWidth;
    
    // Update sidebar width
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
  }, [isResizing, currentWidth]);
  
  // Sync local state with store state when store changes (but not during resize)
  React.useEffect(() => {
    if (!isResizing) {
      setCurrentWidth(rightSidebarWidth);
    }
  }, [rightSidebarWidth, isResizing]);

  // Handle window resize for responsive behavior
  React.useEffect(() => {
    const handleWindowResize = () => {
      if (typeof window !== 'undefined' && isRightSidebarOpen && rightSidebarRef.current) {
        const maxSidebarWidth = Math.floor(window.innerWidth * 0.5); // 50% of screen width
        const minSidebarWidth = 280;
        const defaultSidebarWidth = 400; // Default preferred width
        
        let newWidth = currentWidth;
        
        // If window expanded and current width is too small, expand to default or max available
        if (window.innerWidth > 1200 && currentWidth < defaultSidebarWidth) {
          newWidth = Math.min(defaultSidebarWidth, maxSidebarWidth);
        }
        // If window shrunk and current width is too large, shrink to fit
        else if (currentWidth > maxSidebarWidth) {
          newWidth = maxSidebarWidth;
        }
        // Ensure minimum width
        else if (currentWidth < minSidebarWidth) {
          newWidth = minSidebarWidth;
        }
        
        if (newWidth !== currentWidth) {
          // Update the actual sidebar width
          rightSidebarRef.current.style.width = `${newWidth}px`;
          setCurrentWidth(newWidth);
          setRightSidebarWidth(newWidth);
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleWindowResize);
      
      return () => window.removeEventListener('resize', handleWindowResize);
    }
  }, [isRightSidebarOpen, currentWidth, setRightSidebarWidth]);
  
  // Get the right sidebar content
  const actualSidebarContent = rightSidebarContent || getSidebarContent();
  
  return (
    <div className={`main-layout-container flex h-screen w-screen overflow-hidden bg-white ${location.pathname === '/pomodoro' ? 'pomodoro-page-container' : ''} ${className}`}>
      {/* Left Sidebar - Navigation */}
      <Sidebar />
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Bar */}
        <TopBar />
        
        {/* Main Content */}
        <div className="flex-1 flex h-full overflow-hidden relative w-full" style={{ zIndex: 1 }}>
          {/* Timer Section */}
          <div 
            ref={timerSectionRef}
            className="flex-1 flex flex-col items-center justify-center p-6 bg-white relative min-w-[300px] h-full overflow-y-auto scrollbar-thin" 
            id="timerSection" 
            style={
              // Responsive behavior for both sidebar states
              isRightSidebarOpen ? {
                flex: '1 1 auto',
                minWidth: '300px',
                height: '100%'
              } : {
                width: '100%',
                height: '100%'
              }
            }
          >
            <div className="w-full h-full overflow-y-auto flex flex-col items-center justify-center timer-scroll-container">
              {children || <Outlet />}
            </div>
          </div>
          
          {/* Right Sidebar - Task Management - Only render when open */}
          {isRightSidebarOpen && (
            <div 
              ref={rightSidebarRef}
              id="rightSidebar" 
              className="border-l border-t border-b border-border flex flex-col bg-white min-w-[280px] rounded-tl-lg rounded-bl-lg flex-shrink-0 relative group"
              style={{ 
                width: `${currentWidth}px`,
                minWidth: '280px',
                maxWidth: '50vw',
                height: 'calc(100% - 64px)',
                marginBottom: '64px'
              }}
            >
              {/* Resizable left border */}
              <div 
                className="absolute -left-1 top-2 w-3 h-[calc(100%-8px)] cursor-col-resize bg-transparent hover:bg-border/30 transition-colors duration-200 z-10 flex items-center justify-center"
                onMouseDown={handleResizeStart}
              >
                <div className="w-px h-full bg-transparent hover:bg-border/30 transition-colors duration-200" />
              </div>
              <div className="flex-1 h-full overflow-y-auto overflow-x-visible">
                {actualSidebarContent}
              </div>
            </div>
          )}
          
          {/* Show Sidebar Button - appears when sidebar is hidden */}
          {!isRightSidebarOpen && (
            <Tooltip text="Show task list (Cmd + \)" placement="left">
              <button 
                onClick={() => useUIStore.getState().toggleRightSidebar()}
                className="fixed right-4 top-1/2 transform -translate-y-1/2 z-50 w-10 h-10 bg-background-secondary border border-border rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:bg-background-primary hover:border-primary/30 group flex items-center justify-center"
                aria-label="Show task list"
              >
                <Icon name="menu-line" size={18} className="text-text-secondary group-hover:text-primary transition-colors" />
              </button>
            </Tooltip>
          )}
          
        </div>
      </div>
      
      {/* Vertical Navigation - shows when left sidebar is closed */}
      <VerticalNavigation />
      
      {/* Focus Mode */}
      <FocusMode />
    </div>
  );
};

export default MainLayout; 