import { useState, useEffect } from 'react';
import { timezoneUtils } from '../utils/timezoneUtils';
import { useUserStore } from '../store/userStore';

interface TimezoneDisplayState {
  currentTimezone: string;
  detectedTimezone: string;
  displayName: string;
  isLoading: boolean;
  lastUpdated: string | null;
}

/**
 * Custom hook for managing timezone display in settings
 */
export const useTimezoneDisplay = () => {
  const { user, initializeTimezone } = useUserStore();
  const [state, setState] = useState<TimezoneDisplayState>({
    currentTimezone: '',
    detectedTimezone: '',
    displayName: 'Auto-detect',
    isLoading: false,
    lastUpdated: null
  });

  // Initialize timezone display
  useEffect(() => {
    const initializeDisplay = async () => {
      try {
        setState(prev => ({ ...prev, isLoading: true }));
        
        const detected = timezoneUtils.getCurrentTimezone();
        const stored = (user?.settings as any)?.timezone?.current;
        const current = stored || detected;
        
        const displayName = formatTimezoneDisplayName(current, detected);
        
        setState({
          currentTimezone: current,
          detectedTimezone: detected,
          displayName,
          isLoading: false,
          lastUpdated: (user?.settings as any)?.timezone?.lastUpdated || null
        });
        
        // Initialize timezone in store if not already set
        if (!stored && user) {
          await initializeTimezone();
        }
      } catch (error) {
        console.error('Failed to initialize timezone display:', error);
        setState(prev => ({ 
          ...prev, 
          isLoading: false,
          displayName: 'Auto-detect'
        }));
      }
    };

    if (user) {
      initializeDisplay();
    }
  }, [user, initializeTimezone]);

  // Monitor for timezone changes
  useEffect(() => {
    const checkTimezone = () => {
      const newDetected = timezoneUtils.getCurrentTimezone();
      if (newDetected !== state.detectedTimezone) {
        setState(prev => ({
          ...prev,
          detectedTimezone: newDetected,
          displayName: formatTimezoneDisplayName(prev.currentTimezone, newDetected)
        }));
      }
    };

    const interval = setInterval(checkTimezone, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [state.detectedTimezone, state.currentTimezone]);

  const formatTimezoneDisplayName = (timezone: string, detectedTz: string): string => {
    try {
      if (!timezone) return 'Auto-detect';
      
      const formatter = new Intl.DateTimeFormat('en', {
        timeZone: timezone,
        timeZoneName: 'short'
      });
      const parts = formatter.formatToParts(new Date());
      const shortName = parts.find(part => part.type === 'timeZoneName')?.value || '';

      if (timezone === detectedTz) {
        // Auto-detected timezone
        return `Auto-detect (${timezone}${shortName ? ' - ' + shortName : ''})`;
      } else {
        // Manually set timezone
        return `${timezone}${shortName ? ' (' + shortName + ')' : ''}`;
      }
    } catch (error) {
      console.error('Failed to format timezone display name:', error);
      return timezone || 'Auto-detect';
    }
  };

  const updateDisplay = (newTimezone: string) => {
    setState(prev => ({
      ...prev,
      currentTimezone: newTimezone,
      displayName: formatTimezoneDisplayName(newTimezone, prev.detectedTimezone),
      lastUpdated: new Date().toISOString()
    }));
  };

  const setLoading = (loading: boolean) => {
    setState(prev => ({ ...prev, isLoading: loading }));
  };

  return {
    ...state,
    updateDisplay,
    setLoading,
    formatCurrentTime: () => {
      if (!state.currentTimezone) return '';
      try {
        return timezoneUtils.formatInTimezone(
          new Date().toISOString(), 
          state.currentTimezone, 
          'MMM dd, HH:mm'
        );
      } catch {
        return '';
      }
    },
    getTimezoneInfo: () => ({
      detected: state.detectedTimezone,
      current: state.currentTimezone,
      isAutoDetected: state.currentTimezone === state.detectedTimezone,
      lastUpdated: state.lastUpdated
    })
  };
};