import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeProviderContext = createContext({
  theme: 'system',
  setTheme: () => null,
  resolvedTheme: 'light',
});

export function ThemeProvider({ children, defaultTheme = 'system', ...props }) {
  const [theme, setTheme] = useState(
    () => localStorage.getItem('theme') || defaultTheme
  );
  const [resolvedTheme, setResolvedTheme] = useState('light');

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    const handleMediaQuery = (event) => {
      const systemTheme = event?.matches ? 'dark' : 'light';
      
      if (theme === 'system') {
        root.classList.add(systemTheme);
        setResolvedTheme(systemTheme);
      } else {
        root.classList.add(theme);
        setResolvedTheme(theme);
      }
    };

    // Initial check
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    // First, handle the initial state
    const initialSystemTheme = mediaQuery.matches ? 'dark' : 'light';
    
    if (theme === 'system') {
      root.classList.add(initialSystemTheme);
      setResolvedTheme(initialSystemTheme);
    } else {
      root.classList.add(theme);
      setResolvedTheme(theme);
    }

    // Then set up the listener for changes
    // Use the modern addEventListener if available, otherwise fall back to the deprecated addListener
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleMediaQuery);
    } else {
      mediaQuery.addListener(handleMediaQuery); // For older browsers
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleMediaQuery);
      } else {
        mediaQuery.removeListener(handleMediaQuery); // For older browsers
      }
    };
  }, [theme]);

  const value = {
    theme,
    setTheme: (newTheme) => {
      localStorage.setItem('theme', newTheme);
      setTheme(newTheme);
    },
    resolvedTheme,
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider');

  return context;
}; 