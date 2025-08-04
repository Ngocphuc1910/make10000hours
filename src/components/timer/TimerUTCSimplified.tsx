import React, { useState, useEffect, useMemo } from 'react';
import { useUTCTimerStore } from '../../store/timerStoreUTC';
import { useTimerStore } from '../../store/timerStore';
import { useUserStore } from '../../store/userStore';
import { utcFeatureFlags } from '../../services/featureFlags';
import { timezoneUtils } from '../../utils/timezoneUtils';
import { utcMonitoring } from '../../services/monitoring';
import type { Task, TimerMode } from '../../types/models';

interface TimerUTCProps {
  className?: string;
  currentTask?: Task | null;
}

interface TimerState {
  isRunning: boolean;
  currentTime: number;
  mode: TimerMode;
  sessionsCompleted: number;
  currentTask: Task | null;
  activeSession: any;
  isLoading: boolean;
  syncError: string | null;
  start: () => void;
  pause: () => void;
  reset: () => void;
  skip: () => void;
  setMode: (mode: TimerMode) => void;
  setCurrentTask?: (task: Task | null) => void;
  timerType: 'UTC' | 'Legacy';
  userTimezone?: string;
}

export const TimerUTCSimplified: React.FC<TimerUTCProps> = ({
  className = '',
  currentTask
}) => {
  const { user } = useUserStore();
  const [timezoneDetected, setTimezoneDetected] = useState(timezoneUtils.getCurrentTimezone());
  const [showTimezoneWarning, setShowTimezoneWarning] = useState(false);

  // Get both timer stores
  const utcTimer = useUTCTimerStore();
  const legacyTimer = useTimerStore();

  // Determine which timer to use based on feature flags
  const timerState: TimerState = useMemo(() => {
    if (!user) {
      // Return safe default state when no user
      return {
        isRunning: false,
        currentTime: 25 * 60, // 25 minutes default
        mode: 'pomodoro' as TimerMode,
        sessionsCompleted: 0,
        currentTask: null,
        activeSession: null,
        isLoading: false,
        syncError: null,
        start: () => console.log('No user - start disabled'),
        pause: () => console.log('No user - pause disabled'),
        reset: () => console.log('No user - reset disabled'),
        skip: () => console.log('No user - skip disabled'),
        setMode: () => console.log('No user - setMode disabled'),
        timerType: 'Legacy'
      };
    }

    const transitionMode = utcFeatureFlags.getTransitionMode(user.uid);
    const shouldUseUTC = transitionMode === 'utc-only' || 
      (transitionMode === 'dual' && utcFeatureFlags.isFeatureEnabled('utcTimerIntegration', user.uid));
    
    if (shouldUseUTC) {
      return {
        isRunning: utcTimer.isRunning,
        currentTime: utcTimer.currentTime,
        mode: utcTimer.mode,
        sessionsCompleted: utcTimer.sessionsCompleted,
        currentTask: utcTimer.currentTask,
        activeSession: utcTimer.activeSession,
        isLoading: utcTimer.isLoading,
        syncError: utcTimer.syncError,
        start: utcTimer.start,
        pause: utcTimer.pause,
        reset: utcTimer.reset,
        skip: utcTimer.skip,
        setMode: utcTimer.setMode,
        setCurrentTask: utcTimer.setCurrentTask,
        timerType: 'UTC',
        userTimezone: utcTimer.userTimezone
      };
    } else {
      return {
        isRunning: legacyTimer.isRunning,
        currentTime: legacyTimer.currentTime,
        mode: legacyTimer.mode,
        sessionsCompleted: legacyTimer.sessionsCompleted,
        currentTask: legacyTimer.currentTask,
        activeSession: legacyTimer.activeSession,
        isLoading: legacyTimer.isLoading,
        syncError: legacyTimer.syncError,
        start: legacyTimer.start,
        pause: legacyTimer.pause,
        reset: legacyTimer.reset,
        skip: legacyTimer.skip,
        setMode: legacyTimer.setMode,
        setCurrentTask: legacyTimer.setCurrentTask,
        timerType: 'Legacy'
      };
    }
  }, [user, utcTimer, legacyTimer]);

  // Monitor timezone changes (only for UTC timer)
  useEffect(() => {
    if (timerState.timerType !== 'UTC') return;

    const interval = setInterval(() => {
      const currentTimezone = timezoneUtils.getCurrentTimezone();
      if (currentTimezone !== timezoneDetected) {
        console.log('Timezone change detected:', {
          old: timezoneDetected,
          new: currentTimezone
        });
        
        setTimezoneDetected(currentTimezone);
        setShowTimezoneWarning(true);
        
        // Only handle timezone change for UTC timer
        if (utcTimer.updateUserTimezone && utcTimer.handleTimezoneChange) {
          utcTimer.updateUserTimezone(currentTimezone);
          utcTimer.handleTimezoneChange();
        }
        
        utcMonitoring.trackOperation('timezone_change_detected', true);
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [timezoneDetected, timerState.timerType, utcTimer]);

  // Sync current task between stores
  useEffect(() => {
    if (currentTask && timerState.setCurrentTask) {
      timerState.setCurrentTask(currentTask);
    }
  }, [currentTask, timerState.setCurrentTask]);

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getModeColor = (mode: TimerMode): string => {
    switch (mode) {
      case 'pomodoro': return 'text-red-600 bg-red-50';
      case 'shortBreak': return 'text-green-600 bg-green-50';
      case 'longBreak': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getModeLabel = (mode: TimerMode): string => {
    switch (mode) {
      case 'pomodoro': return 'Focus Time';
      case 'shortBreak': return 'Short Break';
      case 'longBreak': return 'Long Break';
      default: return mode;
    }
  };

  const dismissTimezoneWarning = () => {
    setShowTimezoneWarning(false);
  };

  if (!user) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <p className="text-center text-gray-500">Please log in to use the timer</p>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow ${className}`}>
      {/* Header with Timer Type Indicator */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Timer</h2>
          <div className="flex items-center space-x-2">
            <span className={`text-xs px-2 py-1 rounded ${
              timerState.timerType === 'UTC' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
            }`}>
              {timerState.timerType}
            </span>
            {timerState.userTimezone && (
              <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                {timerState.userTimezone}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Timezone Warning */}
      {showTimezoneWarning && timerState.timerType === 'UTC' && (
        <div className="p-4 bg-yellow-50 border-b border-yellow-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-yellow-600">⚠️</span>
              <div>
                <p className="text-sm font-medium text-yellow-800">
                  Timezone Changed
                </p>
                <p className="text-xs text-yellow-600">
                  Detected: {timezoneDetected}
                  {timerState.userTimezone && timerState.userTimezone !== timezoneDetected && 
                    ` (Timer: ${timerState.userTimezone})`
                  }
                </p>
              </div>
            </div>
            <button
              onClick={dismissTimezoneWarning}
              className="text-yellow-600 hover:text-yellow-800"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Error Display */}
      {timerState.syncError && (
        <div className="p-4 bg-red-50 border-b border-red-200">
          <div className="flex items-center space-x-2">
            <span className="text-red-600">❌</span>
            <div>
              <p className="text-sm font-medium text-red-800">Sync Error</p>
              <p className="text-xs text-red-600">{timerState.syncError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Timer Display */}
      <div className="p-6 text-center">
        {/* Mode Display */}
        <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium mb-4 ${getModeColor(timerState.mode)}`}>
          {getModeLabel(timerState.mode)}
        </div>

        {/* Time Display */}
        <div className="text-6xl font-mono font-bold text-gray-900 mb-4">
          {formatTime(timerState.currentTime)}
        </div>

        {/* Current Task */}
        {timerState.currentTask && (
          <div className="mb-4">
            <p className="text-sm text-gray-500">Working on:</p>
            <p className="font-medium text-gray-900">{timerState.currentTask.title}</p>
          </div>
        )}

        {/* UTC Session Info */}
        {timerState.timerType === 'UTC' && timerState.activeSession && (
          <div className="text-xs text-gray-500 mb-4">
            <div>Session started: {timezoneUtils.formatInTimezone(
              timerState.activeSession.startTimeUTC,
              timerState.activeSession.timezoneContext?.timezone || 'UTC',
              'HH:mm'
            )}</div>
            <div>Timezone: {timerState.activeSession.timezoneContext?.timezone || 'UTC'}</div>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-center space-x-4">
          <button
            onClick={timerState.start}
            disabled={timerState.isRunning || timerState.isLoading}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {timerState.isLoading ? 'Loading...' : 'Start'}
          </button>

          <button
            onClick={timerState.pause}
            disabled={!timerState.isRunning || timerState.isLoading}
            className="px-6 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Pause
          </button>

          <button
            onClick={timerState.reset}
            disabled={timerState.isLoading}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Reset
          </button>

          <button
            onClick={timerState.skip}
            disabled={timerState.isLoading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Skip
          </button>
        </div>

        {/* Sessions Completed */}
        <div className="mt-4 text-sm text-gray-600">
          Sessions completed: {timerState.sessionsCompleted}
        </div>
      </div>

      {/* Mode Selector */}
      <div className="p-4 border-t bg-gray-50">
        <div className="flex items-center justify-center space-x-2">
          {(['pomodoro', 'shortBreak', 'longBreak'] as TimerMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => timerState.setMode(mode)}
              disabled={timerState.isRunning || timerState.isLoading}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                timerState.mode === mode
                  ? getModeColor(mode)
                  : 'text-gray-600 bg-gray-200 hover:bg-gray-300'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {getModeLabel(mode)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};