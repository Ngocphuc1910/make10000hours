import { useEffect, useRef, useState } from 'react';

interface ActivityState {
  isActive: boolean;
  isVisible: boolean;
  lastActivity: Date;
  inactivityDuration: number; // in seconds
}

interface ActivityDetectionOptions {
  inactivityThreshold?: number; // seconds before considering user inactive
  heartbeatInterval?: number; // seconds between heartbeat checks
  onActivityChange?: (state: ActivityState) => void;
  onInactivityTimeout?: (duration: number) => void;
  onVisibilityChange?: (isVisible: boolean) => void;
}

export const useActivityDetection = (options: ActivityDetectionOptions = {}) => {
  const {
    inactivityThreshold = 300, // 5 minutes default
    heartbeatInterval = 30, // 30 seconds default
    onActivityChange,
    onInactivityTimeout,
    onVisibilityChange
  } = options;

  const [activityState, setActivityState] = useState<ActivityState>({
    isActive: true,
    isVisible: !document.hidden,
    lastActivity: new Date(),
    inactivityDuration: 0
  });

  const lastActivityRef = useRef<Date>(new Date());
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const inactivityCheckRef = useRef<NodeJS.Timeout | null>(null);

  // Update last activity timestamp
  const updateActivity = () => {
    const now = new Date();
    lastActivityRef.current = now;
    
    const newState: ActivityState = {
      isActive: true,
      isVisible: !document.hidden,
      lastActivity: now,
      inactivityDuration: 0
    };

    setActivityState(newState);
    onActivityChange?.(newState);
  };

  // Check for inactivity
  const checkInactivity = () => {
    const now = new Date();
    const timeSinceLastActivity = Math.floor((now.getTime() - lastActivityRef.current.getTime()) / 1000);
    
    const newState: ActivityState = {
      isActive: timeSinceLastActivity < inactivityThreshold,
      isVisible: !document.hidden,
      lastActivity: lastActivityRef.current,
      inactivityDuration: timeSinceLastActivity
    };

    setActivityState(newState);
    onActivityChange?.(newState);

    // Trigger inactivity timeout if threshold exceeded
    if (timeSinceLastActivity >= inactivityThreshold) {
      onInactivityTimeout?.(timeSinceLastActivity);
    }
  };

  // Handle page visibility changes
  const handleVisibilityChange = () => {
    const isVisible = !document.hidden;
    
    if (isVisible) {
      // Page became visible - user returned
      updateActivity();
    } else {
      // Page became hidden - potential inactivity
      checkInactivity();
    }

    onVisibilityChange?.(isVisible);
  };

  // Handle window focus/blur events
  const handleWindowFocus = () => {
    updateActivity();
  };

  const handleWindowBlur = () => {
    // Don't immediately mark as inactive, but schedule a check
    setTimeout(checkInactivity, 1000);
  };

  useEffect(() => {
    // Activity detection events
    const activityEvents = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click'
    ];

    // Add activity listeners
    activityEvents.forEach(eventType => {
      document.addEventListener(eventType, updateActivity, { passive: true });
    });

    // Add visibility and focus listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('blur', handleWindowBlur);

    // Start heartbeat interval for periodic checks
    heartbeatIntervalRef.current = setInterval(checkInactivity, heartbeatInterval * 1000);

    // Cleanup function
    return () => {
      // Remove activity listeners
      activityEvents.forEach(eventType => {
        document.removeEventListener(eventType, updateActivity);
      });

      // Remove visibility and focus listeners
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('blur', handleWindowBlur);

      // Clear intervals
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      if (inactivityCheckRef.current) {
        clearTimeout(inactivityCheckRef.current);
      }
    };
  }, [inactivityThreshold, heartbeatInterval, onActivityChange, onInactivityTimeout, onVisibilityChange]);

  // Exposed methods for manual control
  const forceActivityUpdate = () => updateActivity();
  const forceInactivityCheck = () => checkInactivity();

  return {
    activityState,
    forceActivityUpdate,
    forceInactivityCheck,
    isActive: activityState.isActive,
    isVisible: activityState.isVisible,
    inactivityDuration: activityState.inactivityDuration,
    lastActivity: activityState.lastActivity
  };
}; 