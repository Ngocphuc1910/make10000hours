import React from 'react';
import { useThemeStore, type ThemeMode } from '../../store/themeStore';
import { Icon } from './Icon';

export const ThemeSwitcher: React.FC = () => {
  const { mode, setMode } = useThemeStore();

  const themes: { mode: ThemeMode; icon: string; label: string }[] = [
    { mode: 'light', icon: 'sun-line', label: 'Light' },
    { mode: 'dark', icon: 'moon-line', label: 'Dark' },
    { mode: 'system', icon: 'computer-line', label: 'System' },
  ];

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-600 dark:text-gray-300">Theme</span>
      <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-gray-100 dark:bg-gray-800">
        {themes.map((theme) => (
          <button
            key={theme.mode}
            onClick={() => setMode(theme.mode)}
            className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors focus:outline-none ${
              mode === theme.mode
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'hover:bg-white/50 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-400'
            }`}
            title={theme.label}
          >
            <Icon name={theme.icon} size={14} />
          </button>
        ))}
      </div>
    </div>
  );
}; 