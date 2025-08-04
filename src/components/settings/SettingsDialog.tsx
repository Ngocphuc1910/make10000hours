import React, { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Select from '@radix-ui/react-select';
import { X, Settings, Timer, Bell, Palette, ChevronDown, Keyboard, Check } from 'lucide-react';
import { useUserStore } from '../../store/userStore';
import { DEFAULT_SETTINGS, type AppSettings, type TimerSettings } from '../../types/models';
import { Button } from '../ui/Button';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialSection?: string;
}

const SettingsDialog: React.FC<SettingsDialogProps> = ({ isOpen, onClose, initialSection }) => {
  const { user, updateUserData } = useUserStore();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [originalSettings, setOriginalSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [activeSection, setActiveSection] = useState(initialSection || 'general');

  useEffect(() => {
    if (user) {
      setSettings(user.settings);
      setOriginalSettings(user.settings);
    }
  }, [user]);

  useEffect(() => {
    if (initialSection) {
      setActiveSection(initialSection);
    }
  }, [initialSection]);

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

  const handleAppSettingChange = (key: keyof Omit<AppSettings, 'timer'>, value: boolean) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSave = async () => {
    if (!user) return;
    
    setIsLoading(true);
    setMessage(null);
    
    try {
      await updateUserData({
        uid: user.uid,
        userName: user.userName,
        settings
      });
      setOriginalSettings(settings);
      setMessage({ type: 'success', text: 'Settings saved successfully!' });
      setTimeout(() => {
        setMessage(null);
      }, 2000);
    } catch (error) {
      console.error('Error saving settings:', error);
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
                              value={settings.darkMode ? 'dark' : 'light'} 
                              onValueChange={(value) => handleAppSettingChange('darkMode', value === 'dark')}
                            >
                              <Select.Trigger className="inline-flex items-center justify-between rounded px-2 py-1 text-sm leading-none bg-transparent border-0 focus:outline-none hover:bg-gray-50 dark:hover:bg-gray-800 min-w-[100px] text-gray-600 dark:text-gray-400">
                                <Select.Value />
                                <Select.Icon>
                                  <ChevronDown size={16} className="text-gray-400" />
                                </Select.Icon>
                              </Select.Trigger>
                              <Select.Portal>
                                <Select.Content className="overflow-hidden bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50" position="popper" side="bottom" align="end">
                                  <Select.Viewport className="p-2">
                                    <Select.Item value="light" className="text-sm leading-none rounded-md flex items-center h-8 pr-8 pl-8 relative select-none data-[disabled]:text-gray-300 data-[disabled]:pointer-events-none data-[highlighted]:bg-gray-100 dark:data-[highlighted]:bg-gray-700 data-[highlighted]:text-gray-900 dark:data-[highlighted]:text-gray-100 cursor-pointer transition-colors">
                                      <Select.ItemText>Light</Select.ItemText>
                                      <Select.ItemIndicator className="absolute left-0 w-6 inline-flex items-center justify-center">
                                        <Check size={12} />
                                      </Select.ItemIndicator>
                                    </Select.Item>
                                    <Select.Item value="dark" className="text-sm leading-none rounded-md flex items-center h-8 pr-8 pl-8 relative select-none data-[disabled]:text-gray-300 data-[disabled]:pointer-events-none data-[highlighted]:bg-gray-100 dark:data-[highlighted]:bg-gray-700 data-[highlighted]:text-gray-900 dark:data-[highlighted]:text-gray-100 cursor-pointer transition-colors">
                                      <Select.ItemText>Dark</Select.ItemText>
                                      <Select.ItemIndicator className="absolute left-0 w-6 inline-flex items-center justify-center">
                                        <Check size={12} />
                                      </Select.ItemIndicator>
                                    </Select.Item>
                                    <Select.Item value="system" className="text-sm leading-none rounded-md flex items-center h-8 pr-8 pl-8 relative select-none data-[disabled]:text-gray-300 data-[disabled]:pointer-events-none data-[highlighted]:bg-gray-100 dark:data-[highlighted]:bg-gray-700 data-[highlighted]:text-gray-900 dark:data-[highlighted]:text-gray-100 cursor-pointer transition-colors">
                                      <Select.ItemText>System</Select.ItemText>
                                      <Select.ItemIndicator className="absolute left-0 w-6 inline-flex items-center justify-center">
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
                            <Select.Root defaultValue="auto-detect">
                              <Select.Trigger className="inline-flex items-center justify-between rounded px-2 py-1 text-sm leading-none bg-transparent border-0 focus:outline-none hover:bg-gray-50 dark:hover:bg-gray-800 min-w-[100px] text-gray-600 dark:text-gray-400">
                                <Select.Value />
                                <Select.Icon>
                                  <ChevronDown size={16} className="text-gray-400" />
                                </Select.Icon>
                              </Select.Trigger>
                              <Select.Portal>
                                <Select.Content className="overflow-hidden bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50" position="popper" side="bottom" align="end">
                                  <Select.Viewport className="p-2">
                                    <Select.Item value="auto-detect" className="text-sm leading-none rounded-md flex items-center h-8 pr-8 pl-8 relative select-none data-[disabled]:text-gray-300 data-[disabled]:pointer-events-none data-[highlighted]:bg-gray-100 dark:data-[highlighted]:bg-gray-700 data-[highlighted]:text-gray-900 dark:data-[highlighted]:text-gray-100 cursor-pointer transition-colors">
                                      <Select.ItemText>Auto-detect</Select.ItemText>
                                      <Select.ItemIndicator className="absolute left-0 w-6 inline-flex items-center justify-center">
                                        <Check size={12} />
                                      </Select.ItemIndicator>
                                    </Select.Item>
                                    <Select.Item value="en" className="text-sm leading-none rounded-md flex items-center h-8 pr-8 pl-8 relative select-none data-[disabled]:text-gray-300 data-[disabled]:pointer-events-none data-[highlighted]:bg-gray-100 dark:data-[highlighted]:bg-gray-700 data-[highlighted]:text-gray-900 dark:data-[highlighted]:text-gray-100 cursor-pointer transition-colors">
                                      <Select.ItemText>English</Select.ItemText>
                                      <Select.ItemIndicator className="absolute left-0 w-6 inline-flex items-center justify-center">
                                        <Check size={12} />
                                      </Select.ItemIndicator>
                                    </Select.Item>
                                    <Select.Item value="es" className="text-sm leading-none rounded-md flex items-center h-8 pr-8 pl-8 relative select-none data-[disabled]:text-gray-300 data-[disabled]:pointer-events-none data-[highlighted]:bg-gray-100 dark:data-[highlighted]:bg-gray-700 data-[highlighted]:text-gray-900 dark:data-[highlighted]:text-gray-100 cursor-pointer transition-colors">
                                      <Select.ItemText>Spanish</Select.ItemText>
                                      <Select.ItemIndicator className="absolute left-0 w-6 inline-flex items-center justify-center">
                                        <Check size={12} />
                                      </Select.ItemIndicator>
                                    </Select.Item>
                                    <Select.Item value="fr" className="text-sm leading-none rounded-md flex items-center h-8 pr-8 pl-8 relative select-none data-[disabled]:text-gray-300 data-[disabled]:pointer-events-none data-[highlighted]:bg-gray-100 dark:data-[highlighted]:bg-gray-700 data-[highlighted]:text-gray-900 dark:data-[highlighted]:text-gray-100 cursor-pointer transition-colors">
                                      <Select.ItemText>French</Select.ItemText>
                                      <Select.ItemIndicator className="absolute left-0 w-6 inline-flex items-center justify-center">
                                        <Check size={12} />
                                      </Select.ItemIndicator>
                                    </Select.Item>
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