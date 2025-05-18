import React, { createContext, useState, useContext } from 'react';

// Step 1: Create the Context
const ThemeContext = createContext();

// Step 2: Create a Context Provider component
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState({
    color: 'Tomato',
    textColor: 'white'
  });

  // Function to change the theme color
  const changeTheme = (newColor) => {
    // Determine if the background color is dark (needs white text) or light (needs black text)
    // Simple algorithm: for common colors we can specify appropriate text colors
    let textColor;
    const darkColors = ['BlueViolet', 'CornflowerBlue', 'SaddleBrown'];
    
    if (darkColors.includes(newColor)) {
      textColor = 'white';
    } else {
      textColor = 'black';
    }
    
    setTheme({
      color: newColor,
      textColor: textColor
    });
  };

  // The value that will be provided to consumers
  const value = {
    theme,
    changeTheme
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// Step 3: Create a custom hook to use the theme context
export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}