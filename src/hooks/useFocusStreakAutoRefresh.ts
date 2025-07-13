import { useEffect } from 'react';
import { useFocusStreakStore } from '../store/focusStreakStore';
import { useUserStore } from '../store/userStore';

/**
 * Hook to automatically refresh Focus Streak cache when work sessions are updated
 * This ensures the current year data stays fresh when users complete pomodoro sessions
 */
export const useFocusStreakAutoRefresh = () => {
  const { user } = useUserStore();
  const { refreshCurrentYear, invalidateYear } = useFocusStreakStore();
  
  useEffect(() => {
    if (!user?.uid) return;
    
    // Listen for custom events that indicate work session updates
    const handleWorkSessionUpdate = async () => {
      const currentYear = new Date().getFullYear();
      console.log('FocusStreakAutoRefresh - Work session updated, refreshing current year');
      await refreshCurrentYear(user.uid);
    };
    
    // Listen for timer completion events (custom events that should be dispatched by timer)
    window.addEventListener('pomodoro-completed', handleWorkSessionUpdate);
    window.addEventListener('work-session-updated', handleWorkSessionUpdate);
    
    // Also refresh when the date changes (new day)
    const checkDateChange = () => {
      const today = new Date().toDateString();
      const lastCheck = localStorage.getItem('focus-streak-last-date-check');
      
      if (lastCheck && lastCheck !== today) {
        console.log('FocusStreakAutoRefresh - New day detected, refreshing current year');
        refreshCurrentYear(user.uid);
      }
      
      localStorage.setItem('focus-streak-last-date-check', today);
    };
    
    // Check date change on mount and every hour
    checkDateChange();
    const dateCheckInterval = setInterval(checkDateChange, 60 * 60 * 1000); // Every hour
    
    return () => {
      window.removeEventListener('pomodoro-completed', handleWorkSessionUpdate);
      window.removeEventListener('work-session-updated', handleWorkSessionUpdate);
      clearInterval(dateCheckInterval);
    };
  }, [user?.uid, refreshCurrentYear]);
};