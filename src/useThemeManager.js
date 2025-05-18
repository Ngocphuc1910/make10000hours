import { useTheme } from './ThemeContext';

function useThemeManager() {
  const { theme, changeTheme } = useTheme();

  const toggleTheme = () => {
    changeTheme(theme.color === 'white' ? '#333' : 'white');
  };

  return { theme, toggleTheme };
}

export default useThemeManager; 