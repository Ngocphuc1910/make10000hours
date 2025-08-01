import React, { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Settings, Timer, Bell, Palette, ChevronDown } from 'lucide-react';
import { useUserStore } from '../../store/userStore';
import { DEFAULT_SETTINGS, type AppSettings, type TimerSettings } from '../../types/models';
import { Button } from '../ui/Button';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsDialog: React.FC<SettingsDialogProps> = ({ isOpen, onClose }) => {
  const { user, updateUserData } = useUserStore();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [originalSettings, setOriginalSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [activeSection, setActiveSection] = useState('general');

  useEffect(() => {
    if (user) {
      setSettings(user.settings);
      setOriginalSettings(user.settings);
    }
  }, [user]);

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
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'appearance', label: 'Personalization', icon: Palette },
  ];

  if (!user) return null;

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[900px] h-[600px] -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
          {/* Content */}
          <div className="flex flex-1 relative">
            {/* Close Button */}
            <Dialog.Close asChild>
              <button className="absolute top-4 right-4 z-10 p-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                <X size={18} />
              </button>
            </Dialog.Close>
            {/* Sidebar */}
            <div className="w-64 border-r border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30">
              <nav className="p-6 space-y-2">
                {sections.map((section) => {
                  const IconComponent = section.icon;
                  return (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-all duration-200 text-sm ${
                        activeSection === section.id
                          ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 shadow-sm'
                          : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      <IconComponent size={18} className={activeSection === section.id ? 'text-white dark:text-gray-900' : 'text-gray-500 dark:text-gray-400'} />
                      <span className="font-medium">{section.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto flex flex-col">
              <div className="p-6 flex-1">
                {/* Section Title */}
                <Dialog.Title className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                  {sections.find(s => s.id === activeSection)?.label || 'Settings'}
                </Dialog.Title>

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
                      
                      <div className="space-y-8">
                        <div>
                          <div className="flex items-center justify-between py-3">
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">Theme</div>
                            </div>
                            <div className="relative">
                              <select 
                                className="appearance-none bg-transparent border-0 text-right pr-6 text-sm text-gray-500 dark:text-gray-400 focus:outline-none cursor-pointer min-w-[100px]"
                                value={settings.darkMode ? 'dark' : 'light'}
                                onChange={(e) => handleAppSettingChange('darkMode', e.target.value === 'dark')}
                              >
                                <option value="light">Light</option>
                                <option value="dark">Dark</option>
                                <option value="system">System</option>
                              </select>
                              <ChevronDown size={16} className="absolute right-0 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
                            </div>
                          </div>
                          <div className="border-b border-gray-200 dark:border-gray-700"></div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between py-3">
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">Language</div>
                            </div>
                            <div className="relative">
                              <select 
                                className="appearance-none bg-transparent border-0 text-right pr-6 text-sm text-gray-500 dark:text-gray-400 focus:outline-none cursor-pointer min-w-[100px]"
                                defaultValue="auto-detect"
                              >
                                <option value="auto-detect">Auto-detect</option>
                                <option value="en">English</option>
                                <option value="es">Spanish</option>
                                <option value="fr">French</option>
                              </select>
                              <ChevronDown size={16} className="absolute right-0 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
                            </div>
                          </div>
                          <div className="border-b border-gray-200 dark:border-gray-700"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Timer Section */}
                {activeSection === 'timer' && (
                  <div className="space-y-0">
                    <div>
                      
                      <div className="space-y-6">
                        <div>
                          <div className="flex items-center justify-between py-3">
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">Work Duration</div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">Focus session length in minutes</div>
                            </div>
                            <input
                              type="number"
                              min="1"
                              max="60"
                              value={settings.timer.pomodoro}
                              onChange={(e) => handleTimerSettingChange('pomodoro', parseInt(e.target.value))}
                              className="w-16 px-2 py-1 text-right bg-transparent border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div className="border-b border-gray-200 dark:border-gray-700"></div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between py-3">
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">Short Break</div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">Short break duration in minutes</div>
                            </div>
                            <input
                              type="number"
                              min="1"
                              max="30"
                              value={settings.timer.shortBreak}
                              onChange={(e) => handleTimerSettingChange('shortBreak', parseInt(e.target.value))}
                              className="w-16 px-2 py-1 text-right bg-transparent border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div className="border-b border-gray-200 dark:border-gray-700"></div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between py-3">
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">Long Break</div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">Extended break duration in minutes</div>
                            </div>
                            <input
                              type="number"
                              min="1"
                              max="60"
                              value={settings.timer.longBreak}
                              onChange={(e) => handleTimerSettingChange('longBreak', parseInt(e.target.value))}
                              className="w-16 px-2 py-1 text-right bg-transparent border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div className="border-b border-gray-200 dark:border-gray-700"></div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between py-3">
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">Long Break Interval</div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">Pomodoros before long break</div>
                            </div>
                            <input
                              type="number"
                              min="2"
                              max="10"
                              value={settings.timer.longBreakInterval}
                              onChange={(e) => handleTimerSettingChange('longBreakInterval', parseInt(e.target.value))}
                              className="w-16 px-2 py-1 text-right bg-transparent border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div className="border-b border-gray-200 dark:border-gray-700"></div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between py-3">
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">Auto-start breaks</div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">Automatically start break timers</div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={settings.timer.autoStartBreaks}
                                onChange={(e) => handleTimerSettingChange('autoStartBreaks', e.target.checked)}
                                className="sr-only peer"
                              />
                              <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                          </div>
                          <div className="border-b border-gray-200 dark:border-gray-700"></div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between py-3">
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">Auto-start pomodoros</div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">Automatically start work sessions</div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={settings.timer.autoStartPomodoros}
                                onChange={(e) => handleTimerSettingChange('autoStartPomodoros', e.target.checked)}
                                className="sr-only peer"
                              />
                              <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                          </div>
                          <div className="border-b border-gray-200 dark:border-gray-700"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Notifications Section */}
                {activeSection === 'notifications' && (
                  <div className="space-y-0">
                    <div>
                      
                      <div className="space-y-6">
                        <div>
                          <div className="flex items-center justify-between py-3">
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">Timer completion</div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">Get notified when timers complete</div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input type="checkbox" defaultChecked className="sr-only peer" />
                              <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                          </div>
                          <div className="border-b border-gray-200 dark:border-gray-700"></div>
                        </div>
                        
                        <div>
                          <div className="flex items-center justify-between py-3">
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">Task reminders</div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">Remind me about scheduled tasks</div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input type="checkbox" className="sr-only peer" />
                              <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                          </div>
                          <div className="border-b border-gray-200 dark:border-gray-700"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Personalization Section */}
                {activeSection === 'appearance' && (
                  <div className="space-y-0">
                    <div>
                      
                      <div className="space-y-6">
                        <div>
                          <div className="flex items-center justify-between py-3">
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">Compact task view</div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">Show more tasks in less space</div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={settings.compactTaskView}
                                onChange={(e) => handleAppSettingChange('compactTaskView', e.target.checked)}
                                className="sr-only peer"
                              />
                              <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                          </div>
                          <div className="border-b border-gray-200 dark:border-gray-700"></div>
                        </div>
                        
                        <div>
                          <div className="flex items-center justify-between py-3">
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">Animation speed</div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">Control interface animation speed</div>
                            </div>
                            <div className="relative">
                              <select className="appearance-none bg-transparent border-0 text-right pr-6 text-base text-gray-500 dark:text-gray-400 focus:outline-none cursor-pointer min-w-[100px]">
                                <option value="fast">Fast</option>
                                <option value="normal">Normal</option>
                                <option value="slow">Slow</option>
                              </select>
                              <ChevronDown size={16} className="absolute right-0 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
                            </div>
                          </div>
                          <div className="border-b border-gray-200 dark:border-gray-700"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Save/Cancel buttons inside content - Only show when there are changes */}
              {hasChanges && (
                <div className="flex justify-end items-center gap-2 px-6 py-4">
                  <button 
                    onClick={handleCancel} 
                    disabled={isLoading}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSave} 
                    disabled={isLoading}
                    className="px-4 py-2 text-sm font-medium text-white bg-gray-900 dark:bg-gray-100 dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 focus:bg-gray-800 dark:focus:bg-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  >
                    {isLoading ? 'Saving...' : 'Save'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default SettingsDialog;