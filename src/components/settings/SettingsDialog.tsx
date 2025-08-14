import React, { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Select from '@radix-ui/react-select';
import { X, Settings, Timer, Bell, Palette, ChevronDown, Keyboard, Check, Sun, Moon, Monitor, Globe, Clock } from 'lucide-react';
import { useUserStore } from '../../store/userStore';
import { useThemeStore } from '../../store/themeStore';
import { DEFAULT_SETTINGS, type AppSettings, type TimerSettings } from '../../types/models';
import { Button } from '../ui/Button';
import { timezoneUtils } from '../../utils/timezoneUtils';
import { utcMonitoring } from '../../services/monitoring';

import { useTimezoneDisplay } from '../../hooks/useTimezoneDisplay';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialSection?: string;
}

const SettingsDialog: React.FC<SettingsDialogProps> = ({ isOpen, onClose, initialSection }) => {
  const { user, updateUserData, updateTimezone, autoDetectTimezone } = useUserStore();
  const { mode, setMode } = useThemeStore();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [originalSettings, setOriginalSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [activeSection, setActiveSection] = useState(initialSection || 'general');

  
  // Use timezone display hook
  const {
    currentTimezone,
    detectedTimezone,
    displayName: timezoneDisplayName,
    isLoading: isTimezoneLoading,
    updateDisplay,
    setLoading: setTimezoneLoading,
    formatCurrentTime,
    getTimezoneInfo
  } = useTimezoneDisplay();

  useEffect(() => {
    if (user) {
      // Handle migration from darkMode to theme field
      let migratedSettings = { ...user.settings };
      if ('darkMode' in migratedSettings && !('theme' in migratedSettings)) {
        migratedSettings.theme = migratedSettings.darkMode ? 'dark' : 'light';
        delete (migratedSettings as any).darkMode;
      }
      setSettings(migratedSettings);
      setOriginalSettings(migratedSettings);
      
      // Sync theme mode with user settings
      if (migratedSettings.theme) {
        setMode(migratedSettings.theme);
      }
    }
  }, [user]);

  useEffect(() => {
    if (initialSection) {
      setActiveSection(initialSection);
    }
  }, [initialSection]);

  // Sync with user settings when mode changes
  useEffect(() => {
    if (user && settings) {
      if (settings.theme !== mode) {
        setSettings(prev => ({
          ...prev,
          theme: mode
        }));
      }
    }
  }, [user, mode, settings]);

  const handleTimezoneAutoDetect = async () => {
    setTimezoneLoading(true);
    try {
      await autoDetectTimezone();
      const detected = timezoneUtils.getCurrentTimezone();
      updateDisplay(detected);
      
      setMessage({ type: 'success', text: `Timezone updated to ${detected}` });
      setTimeout(() => setMessage(null), 3000);
      
      utcMonitoring.trackOperation('settings_timezone_auto_detect', true);
    } catch (error) {
      console.error('Failed to auto-detect timezone:', error);
      setMessage({ type: 'error', text: 'Failed to detect timezone' });
      setTimeout(() => setMessage(null), 3000);
      utcMonitoring.trackOperation('settings_timezone_auto_detect', false);
    } finally {
      setTimezoneLoading(false);
    }
  };

  const handleTimezoneChange = async (newTimezone: string) => {
    try {
      setTimezoneLoading(true);
      setMessage(null);
      
      // If "auto" is selected, use the detected timezone
      const timezoneToUse = newTimezone === 'auto' ? detectedTimezone : newTimezone;
      
      if (!timezoneToUse) {
        throw new Error('No timezone available');
      }
      
      // Skip if same timezone
      if (timezoneToUse === currentTimezone) {
        setTimezoneLoading(false);
        return;
      }
      
      await updateTimezone(timezoneToUse);
      updateDisplay(timezoneToUse);
      
      const displayText = newTimezone === 'auto' 
        ? `Auto-detect (${timezoneToUse.split('/').pop()})`
        : timezoneToUse.split('/').pop() || timezoneToUse;
      
      setMessage({ type: 'success', text: `Timezone updated to ${displayText}` });
      setTimeout(() => setMessage(null), 3000);
      
      utcMonitoring.trackOperation('settings_timezone_manual_update', true);
    } catch (error) {
      console.error('Failed to update timezone:', error);
      setMessage({ type: 'error', text: 'Failed to update timezone' });
      setTimeout(() => setMessage(null), 3000);
      utcMonitoring.trackOperation('settings_timezone_manual_update', false);
    } finally {
      setTimezoneLoading(false);
    }
  };

  // Check if there are unsaved changes
  const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);

  const handleTimerSettingChange = (key: keyof TimerSettings, value: number | boolean) => {
    setSettings(prev => ({
      ...prev,
      timer: {
        ...prev.timer,
        [key]: value
      }
    }));
  };

  const handleAppSettingChange = (key: keyof Omit<AppSettings, 'timer'>, value: boolean | string) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleThemeChange = (themeValue: string) => {
    console.log('🎨 SettingsDialog: Theme changed to:', themeValue);
    setMode(themeValue as 'light' | 'dark' | 'system');
    handleAppSettingChange('theme', themeValue as 'light' | 'dark' | 'system');
  };

  const handleSave = async () => {
    if (!user) return;
    
    console.log('💾 SettingsDialog: Saving settings:', settings);
    setIsLoading(true);
    setMessage(null);
    
    try {
      await updateUserData({
        uid: user.uid,
        userName: user.userName,
        settings,
        subscription: user.subscription
      });
      setOriginalSettings(settings);
      console.log('✅ SettingsDialog: Settings saved successfully');
      setMessage({ type: 'success', text: 'Settings saved successfully!' });
      setTimeout(() => {
        setMessage(null);
      }, 2000);
    } catch (error) {
      console.error('❌ SettingsDialog: Error saving settings:', error);
      setMessage({ type: 'error', text: 'Failed to save settings. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setSettings(originalSettings);
    setMessage(null);
  };

  const handleReset = () => {
    if (user?.settings) {
      setSettings(user.settings);
      setOriginalSettings(user.settings);
      setMessage(null);
    }
  };

  const sections = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'timer', label: 'Timer', icon: Timer },
    // { id: 'notifications', label: 'Notifications', icon: Bell }, // Temporarily hidden
    { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
    // { id: 'appearance', label: 'Personalization', icon: Palette }, // Temporarily hidden
  ];

  if (!user) return null;

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[900px] h-[600px] -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col"
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderColor: 'var(--border-color)'
        }}>
          {/* Content */}
          <div className="flex flex-1 relative">
            {/* Close Button */}
            <Dialog.Close asChild>
              <button className="absolute top-4 right-4 z-10 p-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none">
                <X size={18} />
              </button>
            </Dialog.Close>
            {/* Sidebar */}
            <div className="w-48 border-r bg-gray-50/50"
            style={{
              backgroundColor: document.documentElement.classList.contains('dark') ? 'var(--bg-secondary)' : '#FCFCFD',
              borderColor: 'var(--border-color)'
            }}>
              <nav className="p-4 space-y-1">
                {sections.map((section) => {
                  const IconComponent = section.icon;
                  return (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left transition-all duration-200 text-sm focus:outline-none ${
                        activeSection === section.id
                          ? 'shadow-sm'
                          : 'hover:bg-gray-100'
                      }`}
                      style={{
                        backgroundColor: activeSection === section.id ? 'var(--bg-container)' : 'transparent',
                        color: 'var(--text-primary)'
                      }}
                    >
                      <IconComponent size={18} style={{ color: 'var(--text-secondary)' }} />
                      <span className="font-medium">{section.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col h-full">
              {/* Fixed Header */}
              <div className="px-6 pt-6 pb-4" style={{ 
                backgroundColor: 'var(--bg-primary)'
              }}>
                <Dialog.Title className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {sections.find(s => s.id === activeSection)?.label || 'Settings'}
                </Dialog.Title>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto scrollbar-thin" style={{ maxHeight: '460px' }}>
                <div className="px-6 pt-4 pb-4">

                  {/* Success/Error Message */}
                  {message && (
                    <div className={`mb-6 p-3 rounded-lg text-sm ${
                      message.type === 'success' 
                        ? 'bg-green-50 text-green-700 border border-green-200' 
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                      {message.text}
                    </div>
                  )}

                {/* General Section */}
                {activeSection === 'general' && (
                  <div className="space-y-0">
                    <div>
                      
                      <div className="space-y-3">
                        <div>
                          <div className="flex items-center justify-between py-3">
                            <div>
                              <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Theme</div>
                            </div>
                            <Select.Root 
                              value={mode} 
                              onValueChange={handleThemeChange}
                            >
                              <Select.Trigger className="inline-flex items-center justify-between rounded px-2 py-1 text-sm leading-none bg-transparent border-0 focus:outline-none hover:bg-gray-50 dark:hover:bg-gray-800 min-w-[100px] text-gray-600 dark:text-gray-400">
                                <div className="flex items-center">
                                  {mode === 'light' && <Sun size={16} className="mr-2 text-gray-600 dark:text-gray-400" />}
                                  {mode === 'dark' && <Moon size={16} className="mr-2 text-gray-600 dark:text-gray-400" />}
                                  {mode === 'system' && <Monitor size={16} className="mr-2 text-gray-600 dark:text-gray-400" />}
                                  <Select.Value />
                                </div>
                                <Select.Icon>
                                  <ChevronDown size={16} className="text-gray-400" />
                                </Select.Icon>
                              </Select.Trigger>
                              <Select.Portal>
                                <Select.Content className="overflow-hidden bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50" position="popper" side="bottom" align="end">
                                  <Select.Viewport className="p-2">
                                    <Select.Item value="light" className="text-sm leading-none rounded-md flex items-center h-8 pr-8 pl-3 relative select-none data-[disabled]:text-gray-300 data-[disabled]:pointer-events-none data-[highlighted]:bg-gray-100 dark:data-[highlighted]:bg-gray-700 data-[highlighted]:text-gray-900 dark:data-[highlighted]:text-gray-100 cursor-pointer transition-colors">
                                      <Sun size={16} className="mr-2 text-gray-600 dark:text-gray-400" />
                                      <Select.ItemText>Light</Select.ItemText>
                                      <Select.ItemIndicator className="absolute right-2 w-6 inline-flex items-center justify-center">
                                        <Check size={12} />
                                      </Select.ItemIndicator>
                                    </Select.Item>
                                    <Select.Item value="dark" className="text-sm leading-none rounded-md flex items-center h-8 pr-8 pl-3 relative select-none data-[disabled]:text-gray-300 data-[disabled]:pointer-events-none data-[highlighted]:bg-gray-100 dark:data-[highlighted]:bg-gray-700 data-[highlighted]:text-gray-900 dark:data-[highlighted]:text-gray-100 cursor-pointer transition-colors">
                                      <Moon size={16} className="mr-2 text-gray-600 dark:text-gray-400" />
                                      <Select.ItemText>Dark</Select.ItemText>
                                      <Select.ItemIndicator className="absolute right-2 w-6 inline-flex items-center justify-center">
                                        <Check size={12} />
                                      </Select.ItemIndicator>
                                    </Select.Item>
                                    <Select.Item value="system" className="text-sm leading-none rounded-md flex items-center h-8 pr-8 pl-3 relative select-none data-[disabled]:text-gray-300 data-[disabled]:pointer-events-none data-[highlighted]:bg-gray-100 dark:data-[highlighted]:bg-gray-700 data-[highlighted]:text-gray-900 dark:data-[highlighted]:text-gray-100 cursor-pointer transition-colors">
                                      <Monitor size={16} className="mr-2 text-gray-600 dark:text-gray-400" />
                                      <Select.ItemText>System</Select.ItemText>
                                      <Select.ItemIndicator className="absolute right-2 w-6 inline-flex items-center justify-center">
                                        <Check size={12} />
                                      </Select.ItemIndicator>
                                    </Select.Item>
                                  </Select.Viewport>
                                </Select.Content>
                              </Select.Portal>
                            </Select.Root>
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between py-3">
                            <div>
                              <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Language</div>
                            </div>
                            <Select.Root defaultValue="en">
                              <Select.Trigger className="inline-flex items-center justify-between rounded px-2 py-1 text-sm leading-none bg-transparent border-0 focus:outline-none hover:bg-gray-50 dark:hover:bg-gray-800 min-w-[100px] text-gray-600 dark:text-gray-400">
                                <div className="flex items-center">
                                  <Globe size={16} className="mr-2 text-gray-600 dark:text-gray-400" />
                                  <Select.Value />
                                </div>
                                <Select.Icon>
                                  <ChevronDown size={16} className="text-gray-400" />
                                </Select.Icon>
                              </Select.Trigger>
                              <Select.Portal>
                                <Select.Content className="overflow-hidden bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50" position="popper" side="bottom" align="end">
                                  <Select.Viewport className="p-2">
                                    <Select.Item value="en" className="text-sm leading-none rounded-md flex items-center h-8 pr-8 pl-3 relative select-none data-[disabled]:text-gray-300 data-[disabled]:pointer-events-none data-[highlighted]:bg-gray-100 dark:data-[highlighted]:bg-gray-700 data-[highlighted]:text-gray-900 dark:data-[highlighted]:text-gray-100 cursor-pointer transition-colors">
                                      <Globe size={16} className="mr-2 text-gray-600 dark:text-gray-400" />
                                      <Select.ItemText>English</Select.ItemText>
                                      <Select.ItemIndicator className="absolute right-2 w-6 inline-flex items-center justify-center">
                                        <Check size={12} />
                                      </Select.ItemIndicator>
                                    </Select.Item>
                                  </Select.Viewport>
                                </Select.Content>
                              </Select.Portal>
                            </Select.Root>
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between py-3">
                            <div>
                              <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Time Zone</div>
                              <div className="text-xs text-gray-500 mt-1">
                                {currentTimezone && (
                                  <span>Current: {formatCurrentTime()}</span>
                                )}
                              </div>
                            </div>
                            <Select.Root 
                              value={
                                !currentTimezone || currentTimezone === detectedTimezone 
                                  ? 'auto' 
                                  : currentTimezone
                              } 
                              onValueChange={handleTimezoneChange}
                            >
                              <Select.Trigger className="inline-flex items-center justify-between rounded px-2 py-1 text-sm leading-none bg-transparent border-0 focus:outline-none hover:bg-gray-50 dark:hover:bg-gray-800 min-w-[140px] text-gray-600 dark:text-gray-400">
                                <div className="flex items-center">
                                  <Clock size={16} className="mr-2 text-gray-600 dark:text-gray-400" />
                                  <Select.Value />
                                </div>
                                <Select.Icon>
                                  <ChevronDown size={16} className="text-gray-400" />
                                </Select.Icon>
                              </Select.Trigger>
                              <Select.Portal>
                                <Select.Content className="overflow-hidden bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 max-h-80 overflow-y-auto" position="popper" side="bottom" align="end">
                                  <Select.Viewport className="p-2">
                                    <Select.Item value="auto" className="text-sm leading-none rounded-md flex items-center h-8 pr-8 pl-3 relative select-none data-[disabled]:text-gray-300 data-[disabled]:pointer-events-none data-[highlighted]:bg-gray-100 dark:data-[highlighted]:bg-gray-700 data-[highlighted]:text-gray-900 dark:data-[highlighted]:text-gray-100 cursor-pointer transition-colors">
                                      <Globe size={16} className="mr-2 text-gray-600 dark:text-gray-400" />
                                      <Select.ItemText>Auto-detect ({detectedTimezone?.split('/').pop() || 'Unknown'})</Select.ItemText>
                                      <Select.ItemIndicator className="absolute right-2 w-6 inline-flex items-center justify-center">
                                        <Check size={12} />
                                      </Select.ItemIndicator>
                                    </Select.Item>
                                    
                                    <Select.Separator className="h-px bg-gray-200 dark:bg-gray-600 m-1" />
                                    
                                    {/* 24 Standard timezone options */}
                                    {[
                                      { value: 'UTC', label: 'UTC' },
                                      { value: 'America/New_York', label: 'New York (Eastern Time)' },
                                      { value: 'America/Chicago', label: 'Chicago (Central Time)' },
                                      { value: 'America/Denver', label: 'Denver (Mountain Time)' },
                                      { value: 'America/Los_Angeles', label: 'Los Angeles (Pacific Time)' },
                                      { value: 'America/Anchorage', label: 'Anchorage (Alaska Time)' },
                                      { value: 'America/Toronto', label: 'Toronto (Eastern Time)' },
                                      { value: 'America/Mexico_City', label: 'Mexico City' },
                                      { value: 'America/Sao_Paulo', label: 'São Paulo (Brazil Time)' },
                                      { value: 'America/Buenos_Aires', label: 'Buenos Aires' },
                                      { value: 'Europe/London', label: 'London (GMT)' },
                                      { value: 'Europe/Paris', label: 'Paris (Central European Time)' },
                                      { value: 'Europe/Berlin', label: 'Berlin (Central European Time)' },
                                      { value: 'Europe/Moscow', label: 'Moscow (Moscow Time)' },
                                      { value: 'Africa/Cairo', label: 'Cairo (Eastern European Time)' },
                                      { value: 'Africa/Lagos', label: 'Lagos (West Africa Time)' },
                                      { value: 'Africa/Johannesburg', label: 'Johannesburg (South Africa Time)' },
                                      { value: 'Asia/Dubai', label: 'Dubai (Gulf Standard Time)' },
                                      { value: 'Asia/Kolkata', label: 'Mumbai/Kolkata (India Standard Time)' },
                                      { value: 'Asia/Shanghai', label: 'Shanghai (China Standard Time)' },
                                      { value: 'Asia/Tokyo', label: 'Tokyo (Japan Standard Time)' },
                                      { value: 'Asia/Ho_Chi_Minh', label: 'Ho Chi Minh City (Vietnam Time)' },
                                      { value: 'Australia/Sydney', label: 'Sydney (Australian Eastern Time)' },
                                      { value: 'Pacific/Auckland', label: 'Auckland (New Zealand Time)' }
                                    ].map((timezone) => (
                                      <Select.Item 
                                        key={timezone.value} 
                                        value={timezone.value} 
                                        className="text-sm leading-none rounded-md flex items-center h-8 pr-8 pl-3 relative select-none data-[disabled]:text-gray-300 data-[disabled]:pointer-events-none data-[highlighted]:bg-gray-100 dark:data-[highlighted]:bg-gray-700 data-[highlighted]:text-gray-900 dark:data-[highlighted]:text-gray-100 cursor-pointer transition-colors"
                                      >
                                        <Clock size={16} className="mr-2 text-gray-600 dark:text-gray-400" />
                                        <Select.ItemText>{timezone.label}</Select.ItemText>
                                        <Select.ItemIndicator className="absolute right-2 w-6 inline-flex items-center justify-center">
                                          <Check size={12} />
                                        </Select.ItemIndicator>
                                      </Select.Item>
                                    ))}
                                  </Select.Viewport>
                                </Select.Content>
                              </Select.Portal>
                            </Select.Root>
                          </div>
                          

                        </div>


                      </div>
                    </div>
                  </div>
                )}

                {/* Timer Section */}
                {activeSection === 'timer' && (
                  <div className="space-y-0">
                    <div>
                      
                      <div className="space-y-3">
                        <div>
                          <div className="flex items-center justify-between py-3">
                            <div>
                              <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Work Duration</div>
                              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Focus session length in minutes</div>
                            </div>
                            <input
                              type="number"
                              min="1"
                              max="60"
                              value={settings.timer.pomodoro}
                              onChange={(e) => handleTimerSettingChange('pomodoro', parseInt(e.target.value))}
                              className="w-16 px-2 py-1 text-right bg-transparent border rounded text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500"
                              style={{
                                borderColor: 'var(--border-color)',
                                color: 'var(--text-primary)'
                              }}
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between py-3">
                            <div>
                              <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Short Break</div>
                              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Short break duration in minutes</div>
                            </div>
                            <input
                              type="number"
                              min="1"
                              max="30"
                              value={settings.timer.shortBreak}
                              onChange={(e) => handleTimerSettingChange('shortBreak', parseInt(e.target.value))}
                              className="w-16 px-2 py-1 text-right bg-transparent border rounded text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500"
                              style={{
                                borderColor: 'var(--border-color)',
                                color: 'var(--text-primary)'
                              }}
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between py-3">
                            <div>
                              <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Long Break</div>
                              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Extended break duration in minutes</div>
                            </div>
                            <input
                              type="number"
                              min="1"
                              max="60"
                              value={settings.timer.longBreak}
                              onChange={(e) => handleTimerSettingChange('longBreak', parseInt(e.target.value))}
                              className="w-16 px-2 py-1 text-right bg-transparent border rounded text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500"
                              style={{
                                borderColor: 'var(--border-color)',
                                color: 'var(--text-primary)'
                              }}
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between py-3">
                            <div>
                              <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Long Break Interval</div>
                              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Pomodoros before long break</div>
                            </div>
                            <input
                              type="number"
                              min="2"
                              max="10"
                              value={settings.timer.longBreakInterval}
                              onChange={(e) => handleTimerSettingChange('longBreakInterval', parseInt(e.target.value))}
                              className="w-16 px-2 py-1 text-right bg-transparent border rounded text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500"
                              style={{
                                borderColor: 'var(--border-color)',
                                color: 'var(--text-primary)'
                              }}
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between py-3">
                            <div>
                              <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Auto-start breaks</div>
                              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Automatically start break timers</div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={settings.timer.autoStartBreaks}
                                onChange={(e) => handleTimerSettingChange('autoStartBreaks', e.target.checked)}
                                className="sr-only peer focus:outline-none"
                              />
                              <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                            </label>
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between py-3">
                            <div>
                              <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Auto-start pomodoros</div>
                              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Automatically start work sessions</div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={settings.timer.autoStartPomodoros}
                                onChange={(e) => handleTimerSettingChange('autoStartPomodoros', e.target.checked)}
                                className="sr-only peer focus:outline-none"
                              />
                              <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Notifications Section */}
                {activeSection === 'notifications' && (
                  <div className="space-y-0">
                    <div>
                      
                      <div className="space-y-3">
                        <div>
                          <div className="flex items-center justify-between py-3">
                            <div>
                              <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Timer completion</div>
                              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Get notified when timers complete</div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input type="checkbox" defaultChecked className="sr-only peer focus:outline-none" />
                              <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                            </label>
                          </div>
                        </div>
                        
                        <div>
                          <div className="flex items-center justify-between py-3">
                            <div>
                              <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Task reminders</div>
                              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Remind me about scheduled tasks</div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input type="checkbox" className="sr-only peer focus:outline-none" />
                              <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Shortcuts Section */}
                {activeSection === 'shortcuts' && (
                  <div className="space-y-6">
                    {/* Keyboard Shortcuts Toggle */}
                    <div>
                      <div className="flex items-center justify-between py-2">
                        <div>
                          <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Keyboard Shortcuts</div>
                          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Enable keyboard shortcuts for faster navigation</div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            defaultChecked
                            className="sr-only peer focus:outline-none"
                          />
                          <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                        </label>
                      </div>
                    </div>

                    {/* Page Navigation */}
                    <div>
                      <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Page Navigation</h3>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between py-1">
                          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Open Pomodoro Timer</span>
                          <div className="px-2 py-1 rounded border text-xs font-mono" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>P</div>
                        </div>
                        <div className="flex items-center justify-between py-1">
                          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Open Calendar</span>
                          <div className="px-2 py-1 rounded border text-xs font-mono" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>C</div>
                        </div>
                        <div className="flex items-center justify-between py-1">
                          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Open Task Management</span>
                          <div className="px-2 py-1 rounded border text-xs font-mono" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>T</div>
                        </div>
                        <div className="flex items-center justify-between py-1">
                          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Open Productivity Insights</span>
                          <div className="px-2 py-1 rounded border text-xs font-mono" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>I</div>
                        </div>
                        <div className="flex items-center justify-between py-1">
                          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Open Deep Focus</span>
                          <div className="px-2 py-1 rounded border text-xs font-mono" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>F</div>
                        </div>
                          </div>
                        </div>

                    {/* Calendar Views */}
                    <div>
                      <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Calendar Views</h3>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between py-1">
                          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Open Day View</span>
                          <div className="px-2 py-1 rounded border text-xs font-mono" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>D</div>
                        </div>
                        <div className="flex items-center justify-between py-1">
                          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Open Week View</span>
                          <div className="px-2 py-1 rounded border text-xs font-mono" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>W</div>
                        </div>
                        <div className="flex items-center justify-between py-1">
                          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Open Month View</span>
                          <div className="px-2 py-1 rounded border text-xs font-mono" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>M</div>
                        </div>
                          </div>
                        </div>

                    {/* Timer Controls */}
                    <div>
                      <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Timer Controls</h3>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between py-1">
                          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Start/Pause Timer</span>
                          <div className="px-3 py-1 rounded border text-xs font-mono" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>Space</div>
                        </div>
                          </div>
                        </div>

                    {/* Focus & Productivity */}
                    <div>
                      <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Focus & Productivity</h3>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between py-1">
                          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Toggle Deep Focus Mode</span>
                          <div className="flex gap-1">
                            <div className="px-2 py-1 rounded border text-xs font-mono" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>Shift</div>
                            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>+</span>
                            <div className="px-2 py-1 rounded border text-xs font-mono" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>D</div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between py-1">
                          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Create New Task</span>
                          <div className="flex gap-1">
                            <div className="px-2 py-1 rounded border text-xs font-mono" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>Shift</div>
                            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>+</span>
                            <div className="px-2 py-1 rounded border text-xs font-mono" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>N</div>
                          </div>
                        </div>
                          </div>
                        </div>

                    {/* Interface Controls */}
                    <div>
                      <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Interface Controls</h3>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between py-1">
                          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Toggle Left Sidebar</span>
                          <div className="flex gap-1">
                            <div className="px-2 py-1 rounded border text-xs font-mono" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>Alt</div>
                            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>+</span>
                            <div className="px-2 py-1 rounded border text-xs font-mono" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>\</div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between py-1">
                          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Toggle Right Sidebar</span>
                          <div className="flex gap-1">
                            <div className="px-2 py-1 rounded border text-xs font-mono" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>Cmd</div>
                            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>+</span>
                            <div className="px-2 py-1 rounded border text-xs font-mono" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>\</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Personalization Section */}
                {activeSection === 'appearance' && (
                  <div className="space-y-0">
                    <div>
                      
                      <div className="space-y-3">
                        <div>
                          <div className="flex items-center justify-between py-3">
                            <div>
                              <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Compact task view</div>
                              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Show more tasks in less space</div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={settings.compactTaskView}
                                onChange={(e) => handleAppSettingChange('compactTaskView', e.target.checked)}
                                className="sr-only peer focus:outline-none"
                              />
                              <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                            </label>
                          </div>
                        </div>
                        
                        <div>
                          <div className="flex items-center justify-between py-3">
                            <div>
                              <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Animation speed</div>
                              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Control interface animation speed</div>
                            </div>
                            <div className="relative">
                              <select className="appearance-none bg-transparent border-0 text-right pr-6 text-sm focus:outline-none cursor-pointer min-w-[100px] focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 rounded"
                                style={{ color: 'var(--text-secondary)' }}>
                                <option value="fast">Fast</option>
                                <option value="normal">Normal</option>
                                <option value="slow">Slow</option>
                              </select>
                              <ChevronDown size={16} className="absolute right-0 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                </div>
              </div>

            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default SettingsDialog;