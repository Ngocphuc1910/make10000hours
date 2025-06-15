import React, { useEffect } from 'react';
import Calendar from './Calendar';
import Sidebar from '../../components/layout/Sidebar';
import { useUIStore } from '../../store/uiStore';

const CalendarPage: React.FC = () => {
  const { isLeftSidebarOpen } = useUIStore();

  // Ensure sidebar state is properly synchronized on mount and state changes
  useEffect(() => {
    console.log('🔧 Calendar: Sidebar state changed', { 
      isLeftSidebarOpen, 
      timestamp: new Date().toISOString() 
    });
    
    // Force re-render by triggering a layout recalculation
    requestAnimationFrame(() => {
      const sidebarElement = document.getElementById('sidebar');
      if (sidebarElement) {
        console.log('🔧 Calendar: Sidebar element found', {
          currentWidth: sidebarElement.style.width,
          className: sidebarElement.className,
          isOpen: isLeftSidebarOpen
        });
        
        // Force layout recalculation
        sidebarElement.style.display = 'flex';
        
        // Ensure proper width based on state
        if (isLeftSidebarOpen) {
          sidebarElement.style.width = '16rem'; // w-64
          sidebarElement.classList.remove('w-0');
          sidebarElement.classList.add('w-64');
        } else {
          sidebarElement.style.width = '0px'; // w-0
          sidebarElement.classList.remove('w-64');
          sidebarElement.classList.add('w-0');
        }
      }
    });
  }, [isLeftSidebarOpen]);

  return (
    <div className="flex h-screen overflow-hidden bg-background-primary">
      {/* Left Sidebar - Navigation */}
      <Sidebar />
      
      {/* Calendar Content */}
      <div className="flex-1 overflow-hidden">
        <Calendar />
      </div>
    </div>
  );
};

export default CalendarPage; 