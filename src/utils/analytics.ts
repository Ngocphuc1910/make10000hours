import { logEvent, setUserId, setUserProperties } from 'firebase/analytics';
import { analytics } from '../api/firebase';

// Track page views
export const trackPageView = (pageName: string, pageTitle?: string) => {
  if (analytics) {
    logEvent(analytics, 'page_view', {
      page_title: pageTitle || pageName,
      page_location: window.location.href,
      page_path: window.location.pathname
    });
  }
};

// Track user authentication
export const trackUserLogin = (method: string) => {
  if (analytics) {
    logEvent(analytics, 'login', {
      method: method
    });
  }
};

export const trackUserSignup = (method: string) => {
  if (analytics) {
    logEvent(analytics, 'sign_up', {
      method: method
    });
  }
};

// Track task management actions
export const trackTaskCreated = (projectId?: string) => {
  if (analytics) {
    logEvent(analytics, 'task_created', {
      project_id: projectId || 'no-project',
      timestamp: new Date().toISOString()
    });
  }
};

export const trackTaskCompleted = (taskId: string, timeSpent: number, projectId?: string) => {
  if (analytics) {
    logEvent(analytics, 'task_completed', {
      task_id: taskId,
      time_spent_minutes: timeSpent,
      project_id: projectId || 'no-project',
      timestamp: new Date().toISOString()
    });
  }
};

export const trackPomodoroStarted = (taskId: string, estimatedTime: number) => {
  if (analytics) {
    logEvent(analytics, 'pomodoro_started', {
      task_id: taskId,
      estimated_time_minutes: estimatedTime,
      timestamp: new Date().toISOString()
    });
  }
};

export const trackPomodoroCompleted = (taskId: string, actualTime: number) => {
  if (analytics) {
    logEvent(analytics, 'pomodoro_completed', {
      task_id: taskId,
      actual_time_minutes: actualTime,
      timestamp: new Date().toISOString()
    });
  }
};

// Track project management
export const trackProjectCreated = (projectName: string) => {
  if (analytics) {
    logEvent(analytics, 'project_created', {
      project_name: projectName,
      timestamp: new Date().toISOString()
    });
  }
};

// Track user engagement
export const trackFeatureUsed = (featureName: string, additionalData?: any) => {
  if (analytics) {
    logEvent(analytics, 'feature_used', {
      feature_name: featureName,
      ...additionalData,
      timestamp: new Date().toISOString()
    });
  }
};

// Set user properties
export const setAnalyticsUserId = (userId: string) => {
  if (analytics) {
    setUserId(analytics, userId);
  }
};

export const setAnalyticsUserProperties = (properties: { [key: string]: any }) => {
  if (analytics) {
    setUserProperties(analytics, properties);
  }
};

// Track custom events
export const trackCustomEvent = (eventName: string, parameters?: { [key: string]: any }) => {
  if (analytics) {
    logEvent(analytics, eventName, {
      ...parameters,
      timestamp: new Date().toISOString()
    });
  }
}; 