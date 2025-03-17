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
    // Default to dark theme on production to match the local development appearance
    const isProduction = process.env.NODE_ENV === 'production';
    const finalTheme = isProduction ? 'dark' : theme;
    
    console.log('Applying theme:', finalTheme, 'in environment:', process.env.NODE_ENV);
    
    // Remove both classes first
    document.documentElement.classList.remove('light', 'dark');
    // Add the current theme class
    document.documentElement.classList.add(finalTheme);
    
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', finalTheme);
    }
  }, [theme]);

  // Toggle between light and dark themes
  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
    console.log('Theme toggled');
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