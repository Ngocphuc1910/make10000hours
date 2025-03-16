import React, { useState, useRef, useEffect } from 'react';
import { Moon, Sun, Monitor, X } from 'lucide-react';
import { useTheme } from './ThemeProvider';

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [showDialog, setShowDialog] = useState(false);
  const dialogRef = useRef(null);

  // Close dialog when clicking outside
  useEffect(() => {
    if (!showDialog) return;
    
    const handleClickOutside = (event) => {
      if (dialogRef.current && !dialogRef.current.contains(event.target)) {
        setShowDialog(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDialog]);

  // Get the current icon based on theme
  const getThemeIcon = () => {
    if (theme === 'system') {
      // When in system mode, show icon based on the actually applied theme
      return resolvedTheme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />;
    } else if (theme === 'light') {
      return <Sun className="w-5 h-5" />;
    } else {
      return <Moon className="w-5 h-5" />;
    }
  };

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
  };

  return (
    <>
      <button
        onClick={() => setShowDialog(true)}
        className="w-9 h-9 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
        aria-label="Change theme"
      >
        {getThemeIcon()}
        <span className="sr-only">Toggle theme</span>
      </button>

      {showDialog && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div 
            ref={dialogRef}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-64 overflow-hidden"
          >
            <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-medium">Choose Theme</h3>
              <button 
                onClick={() => setShowDialog(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 space-y-3">
              <label className={`flex items-center p-2 rounded-md cursor-pointer ${theme === 'light' ? 'bg-gray-100 dark:bg-gray-700' : ''}`}>
                <input
                  type="radio"
                  name="theme"
                  checked={theme === 'light'}
                  onChange={() => handleThemeChange('light')}
                  className="sr-only"
                />
                <Sun className="w-5 h-5 mr-3 text-amber-500" />
                <span>Light</span>
              </label>
              
              <label className={`flex items-center p-2 rounded-md cursor-pointer ${theme === 'dark' ? 'bg-gray-100 dark:bg-gray-700' : ''}`}>
                <input
                  type="radio"
                  name="theme"
                  checked={theme === 'dark'}
                  onChange={() => handleThemeChange('dark')}
                  className="sr-only"
                />
                <Moon className="w-5 h-5 mr-3 text-indigo-500" />
                <span>Dark</span>
              </label>
              
              <label className={`flex items-center p-2 rounded-md cursor-pointer ${theme === 'system' ? 'bg-gray-100 dark:bg-gray-700' : ''}`}>
                <input
                  type="radio"
                  name="theme"
                  checked={theme === 'system'}
                  onChange={() => handleThemeChange('system')}
                  className="sr-only"
                />
                <Monitor className="w-5 h-5 mr-3 text-gray-500" />
                <span>System</span>
              </label>
              
              {theme === 'system' && (
                <div className="mt-2 p-2 text-xs text-gray-500 bg-gray-50 dark:bg-gray-900 rounded-md">
                  Currently using {resolvedTheme === 'dark' ? 'dark' : 'light'} theme based on your system preferences.
                </div>
              )}
            </div>
            
            <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button
                onClick={() => setShowDialog(false)}
                className="px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 