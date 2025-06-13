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
    <div className="p-4 border-t border-border">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-text-primary">Theme</span>
      </div>
      <div className="flex items-center bg-background-primary rounded-md p-1">
        {themes.map((theme) => (
          <button
            key={theme.mode}
            onClick={() => setMode(theme.mode)}
            className={`flex-1 flex items-center justify-center p-2 rounded text-xs font-medium transition-all ${
              mode === theme.mode
                ? 'bg-primary text-white shadow-sm'
                : 'text-text-secondary hover:text-text-primary hover:bg-background-secondary'
            }`}
            title={theme.label}
          >
            <Icon name={theme.icon} size={16} />
          </button>
        ))}
      </div>
    </div>
  );
}; 