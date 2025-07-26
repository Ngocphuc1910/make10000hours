import React, { useState, useRef } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
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
    <div className={`main-layout-container flex h-screen w-screen overflow-hidden bg-background-primary ${location.pathname === '/pomodoro' ? 'pomodoro-page-container' : ''} ${className}`}>
      {/* Left Sidebar - Navigation */}
      <Sidebar className={location.pathname === '/pomodoro' ? 'pomodoro-sidebar' : ''} />
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Bar */}
        <TopBar />
        
        {/* Main Content */}
        <div className="flex-1 flex h-full overflow-hidden relative w-full" style={{ zIndex: 1 }}>
          {/* Timer Section */}
          <div 
            ref={timerSectionRef}
            className="flex-1 flex flex-col items-center justify-center p-6 bg-background-primary relative min-w-[300px] h-full overflow-y-auto scrollbar-thin" 
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
            <div className="w-full h-full overflow-y-auto scrollbar-thin flex flex-col items-center justify-center">
              {children || <Outlet />}
            </div>
          </div>
          
          {/* Resizable Divider - Only render when right sidebar is open */}
          {isRightSidebarOpen && (
            <div 
              id="resizeDivider" 
              className="w-[8px] bg-transparent cursor-col-resize group flex-shrink-0 relative"
              style={{ 
                height: 'calc(100% - 16px)',
                marginTop: '16px'
              }}
              onMouseDown={handleResizeStart}
            >
              {/* Thin visual line - positioned at right edge to connect with sidebar */}
              <div className="w-[1px] h-full bg-border opacity-30 group-hover:opacity-60 transition-opacity duration-200 absolute right-0"></div>
              {/* Toggle button positioned to the right of the divider, overlapping the sidebar border */}
              <Tooltip text="Hide task list (Cmd + \)" placement="bottom" offset={32}>
                <button 
                  className="absolute w-6 h-12 bg-background-secondary border border-border rounded-l-md flex items-center justify-center shadow-sm hover:bg-background-primary group-hover:border-primary/30 sidebar-edge-toggle transition-colors duration-200 -right-0"
                  style={{ top: 'calc(50% + 88px)', transform: 'translateY(-50%)' }}
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
              className="border-l border-t border-border flex flex-col bg-background-primary min-w-[280px] rounded-t-lg h-full flex-shrink-0"
              style={{ 
                width: `${currentWidth}px`,
                minWidth: '280px',
                maxWidth: '50vw',
                height: '100%'
              }}
            >
              <div className="flex-1 h-full overflow-y-auto overflow-x-visible">
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
    </div>
  );
};

export default MainLayout; 