import React, { createContext, useContext, useEffect, useState } from 'react';

// Create a context for the theme
const ThemeContext = createContext({
  theme: 'dark',
  toggleTheme: () => {}
});

// Export a hook to use the theme context
export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ defaultTheme = 'dark', children }) => {
  // Initialize theme from localStorage or use default
  const [theme, setTheme] = useState(() => {
    // Try to get the theme from localStorage
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      // If we have a saved theme, use it
      if (savedTheme) {
        return savedTheme;
      }
      
      // If no saved theme but user prefers dark mode
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    }
    
    // Otherwise use the default theme
    return defaultTheme;
  });

  // Apply the theme class to the root HTML element
  useEffect(() => {
    // Use the selected theme regardless of environment
    const finalTheme = theme;
    
    console.log('Theme change detected:', finalTheme, 'in environment:', process.env.NODE_ENV);
    
    // Remove both classes first
    document.documentElement.classList.remove('light', 'dark');
    // Add the current theme class
    document.documentElement.classList.add(finalTheme);
    console.log('Applied theme class:', finalTheme, 'to document.documentElement');
    
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', finalTheme);
      console.log('Saved theme to localStorage:', finalTheme);
    }
  }, [theme]);

  // Toggle between light and dark themes
  const toggleTheme = () => {
    console.log('Toggle theme called. Current theme:', theme);
    const newTheme = theme === 'light' ? 'dark' : 'light';
    console.log('Setting new theme to:', newTheme);
    setTheme(newTheme);
  };

  // The value that will be provided to consumers of this context
  const value = {
    theme,
    toggleTheme
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeProvider; 