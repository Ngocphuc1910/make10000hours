import React, { createContext, useState, useContext } from 'react';
import { Theme } from './types';

// Define the context type
interface ThemeContextType {
  theme: Theme;
  changeTheme: (newColor: string) => void;
}

// Step 1: Create the Context
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Step 2: Create a Context Provider component
interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>({
    color: 'Tomato',
    textColor: 'white'
  });

  // Function to change the theme color
  const changeTheme = (newColor: string) => {
    // Determine if the background color is dark (needs white text) or light (needs black text)
    // Simple algorithm: for common colors we can specify appropriate text colors
    let textColor: string;
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
  const value: ThemeContextType = {
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
export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
} 