import { useTheme } from './ThemeContext';
import { Theme } from './types';

interface ThemeManager {
  theme: Theme;
  toggleTheme: () => void;
}

function useThemeManager(): ThemeManager {
  const { theme, changeTheme } = useTheme();

  const toggleTheme = (): void => {
    changeTheme(theme.color === 'white' ? '#333' : 'white');
  };

  return { theme, toggleTheme };
}

export default useThemeManager; 