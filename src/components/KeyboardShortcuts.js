import { useEffect } from 'react';
import { useTheme } from './theme';

// Component for global keyboard shortcuts
function KeyboardShortcuts({ openTaskDialog }) {
  const { toggleTheme } = useTheme();
  
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Check for Shift+N to add a new task
      if (e.shiftKey && e.key === 'N') {
        e.preventDefault(); // Prevent default browser behavior
        if (openTaskDialog) {
          openTaskDialog(); // Open the task dialog
        }
      }
      
      // Check for Shift+T to toggle theme
      if (e.shiftKey && e.key === 'T') {
        e.preventDefault(); // Prevent default browser behavior
        toggleTheme(); // Toggle between light and dark themes
        console.log('Theme toggled with Shift+T shortcut');
      }
    };

    // Add event listener
    window.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [toggleTheme, openTaskDialog]);
  
  // This component doesn't render anything
  return null;
}

export default KeyboardShortcuts; 