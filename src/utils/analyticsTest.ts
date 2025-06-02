import { trackCustomEvent } from './analytics';

// Test function to verify Analytics is working
export const testAnalytics = () => {
  console.log('Testing Firebase Analytics...');
  
  trackCustomEvent('analytics_test', {
    test_timestamp: new Date().toISOString(),
    test_source: 'manual_test'
  });
  
  console.log('Analytics test event sent!');
};

// For debugging in the browser console
if (typeof window !== 'undefined') {
  (window as any).testAnalytics = testAnalytics;
} 