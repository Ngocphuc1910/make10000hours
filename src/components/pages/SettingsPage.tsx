import React, { useEffect, useState } from 'react';
import { useUserStore } from '../../store/userStore';
import { DEFAULT_SETTINGS, type AppSettings, type TimerSettings } from '../../types/models';
import { OpenAISettings } from '../settings/OpenAISettings';
import GoogleCalendarSync from '../settings/GoogleCalendarSync';
import WebhookDebugPanel from '../sync/WebhookDebugPanel';
import Sidebar from '../layout/Sidebar';
import { Header } from '../dashboard/layout/Header';
import { useUIStore } from '../../store/uiStore';

const SettingsPage = () => {
  const { user, updateUserData } = useUserStore();
  const { featureFlags, setFeatureFlag } = useUIStore();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    if (user) {
      // Handle migration from darkMode to theme field
      let migratedSettings = { ...user.settings };
      if ('darkMode' in migratedSettings && !('theme' in migratedSettings)) {
        migratedSettings.theme = migratedSettings.darkMode ? 'dark' : 'light';
        delete (migratedSettings as any).darkMode;
      }
      setSettings(migratedSettings);
    }
  }, [user]);

  const handleTimerSettingChange = (key: keyof TimerSettings, value: number | boolean) => {
    setSettings(prev => ({
      ...prev,
      timer: {
        ...prev.timer,
        [key]: value
      }
    }));
  };

  const handleAppSettingChange = (key: keyof Omit<AppSettings, 'timer'>, value: boolean | string | 'today' | 'empty') => {
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
        settings,
        subscription: user.subscription
      });
      setMessage({ type: 'success', text: 'Settings saved successfully!' });
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({ type: 'error', text: 'Failed to save settings. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    if (user?.settings) {
      setSettings(user.settings);
      setMessage(null);
    }
  };

  if (!user) {
    return (
      <div className="dashboard-layout flex h-screen overflow-hidden bg-background-primary">
        <Sidebar />
        <main className="dashboard-main flex-1 flex flex-col overflow-hidden">
          <Header />
          <div className="dashboard-content scrollbar-thin flex-1 overflow-y-auto">
            <div className="max-w-none mx-auto px-6 py-8">
              <div className="w-full max-w-4xl mx-auto">
                <h1 className="text-2xl font-bold mb-4">Settings</h1>
                <p className="text-gray-600">Please sign in to access your settings.</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="dashboard-layout flex h-screen overflow-hidden bg-background-primary">
      <Sidebar />
      <main className="dashboard-main flex-1 flex flex-col overflow-hidden">
        <Header />
        <div className="dashboard-content scrollbar-thin flex-1 overflow-y-auto">
          <div className="max-w-none mx-auto px-6 py-8">
            <div className="w-full max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>
      
      {message && (
        <div className={`mb-6 p-4 rounded-lg ${
          message.type === 'success' 
            ? 'bg-green-100 text-green-700 border border-green-200' 
            : 'bg-red-100 text-red-700 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      <div className="space-y-8">
        {/* Timer Settings */}
        <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Timer Settings</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pomodoro Duration (minutes)
              </label>
              <input
                id="pomodoroDuration"
                type="number"
                min="1"
                max="60"
                value={settings.timer.pomodoro}
                onChange={(e) => handleTimerSettingChange('pomodoro', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Short Break Duration (minutes)
              </label>
              <input
                id="shortBreakDuration"
                type="number"
                min="1"
                max="30"
                value={settings.timer.shortBreak}
                onChange={(e) => handleTimerSettingChange('shortBreak', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Long Break Duration (minutes)
              </label>
              <input
                id="longBreakDuration"
                type="number"
                min="1"
                max="60"
                value={settings.timer.longBreak}
                onChange={(e) => handleTimerSettingChange('longBreak', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Long Break Interval (pomodoros)
              </label>
              <input
                id="longBreakInterval"
                type="number"
                min="2"
                max="10"
                value={settings.timer.longBreakInterval}
                onChange={(e) => handleTimerSettingChange('longBreakInterval', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="autoStartBreaks"
                checked={settings.timer.autoStartBreaks}
                onChange={(e) => handleTimerSettingChange('autoStartBreaks', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="autoStartBreaks" className="ml-2 text-sm text-gray-700">
                Auto-start breaks
              </label>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="autoStartPomodoros"
                checked={settings.timer.autoStartPomodoros}
                onChange={(e) => handleTimerSettingChange('autoStartPomodoros', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="autoStartPomodoros" className="ml-2 text-sm text-gray-700">
                Auto-start pomodoros
              </label>
            </div>
          </div>
        </section>

        {/* Appearance Settings */}
        <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Appearance</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label htmlFor="theme" className="text-sm text-gray-700">
                Theme
              </label>
              <select
                id="theme"
                value={settings.theme}
                onChange={(e) => handleAppSettingChange('theme', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="compactTaskView"
                checked={settings.compactTaskView}
                onChange={(e) => handleAppSettingChange('compactTaskView', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="compactTaskView" className="ml-2 text-sm text-gray-700">
                Compact task view
              </label>
            </div>
          </div>
        </section>

        {/* Task Management Settings */}
        <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Task Management</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Default Date for New Tasks
              </label>
              <div className="space-y-2">
                <div className="flex items-center">
                  <input
                    type="radio"
                    id="defaultDateToday"
                    name="defaultTaskDate"
                    value="today"
                    checked={settings.defaultTaskDate === 'today'}
                    onChange={(e) => handleAppSettingChange('defaultTaskDate', e.target.value as 'today' | 'empty')}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <label htmlFor="defaultDateToday" className="ml-2 text-sm text-gray-700">
                    Set to today's date
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="radio"
                    id="defaultDateEmpty"
                    name="defaultTaskDate"
                    value="empty"
                    checked={settings.defaultTaskDate === 'empty'}
                    onChange={(e) => handleAppSettingChange('defaultTaskDate', e.target.value as 'today' | 'empty')}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <label htmlFor="defaultDateEmpty" className="ml-2 text-sm text-gray-700">
                    Leave empty (let me choose)
                  </label>
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Note: Tasks created from Pomodoro timer will always use today's date regardless of this setting.
              </p>
            </div>
          </div>
        </section>

        {/* Beta Features */}
        <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Beta Features</h2>
          <p className="text-sm text-gray-600 mb-4">
            Enable experimental features that are currently in development. These features may not be fully stable.
          </p>
          
          <div className="space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="multiDayTasks"
                checked={featureFlags?.multiDayTasks || false}
                onChange={(e) => setFeatureFlag('multiDayTasks', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="multiDayTasks" className="ml-2 text-sm text-gray-700">
                Multi-day tasks
              </label>
              <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">Beta</span>
            </div>
            <p className="ml-6 text-xs text-gray-500">
              Allow tasks to span multiple consecutive days in the calendar view. Longer tasks will be positioned above shorter ones.
            </p>
          </div>
        </section>

        {/* Google Calendar Sync */}
        <GoogleCalendarSync />

        {/* Webhook Debug Panel */}
        <WebhookDebugPanel />

        {/* OpenAI Settings */}
        <OpenAISettings />
      </div>

      {/* Action Buttons */}
      <div className="mt-8 flex justify-end space-x-4">
        <button
          onClick={handleReset}
          disabled={isLoading}
          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
        >
          Reset
        </button>
        <button
          onClick={handleSave}
          disabled={isLoading}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {isLoading ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default SettingsPage;