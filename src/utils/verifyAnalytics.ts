import { analytics } from '../api/firebase';
import { trackCustomEvent, trackPageView } from './analytics';

export const verifyAnalyticsSetup = () => {
  console.log('🔍 Verifying Google Analytics Setup...');
  
  // Check if Analytics is initialized
  if (analytics) {
    console.log('✅ Firebase Analytics is initialized');
    console.log('📊 Measurement ID: G-X6YHGN5WRS');
    
    // Test basic tracking
    trackCustomEvent('analytics_verification', {
      timestamp: new Date().toISOString(),
      verification_step: 'setup_complete'
    });
    
    trackPageView('verification_test', 'Analytics Verification Page');
    
    console.log('✅ Test events sent successfully!');
    console.log('📈 Check Firebase Console in 24-48 hours for data');
    console.log('🔗 https://console.firebase.google.com/project/make10000hours/analytics');
    
    return true;
  } else {
    console.error('❌ Firebase Analytics is not initialized');
    console.log('🔧 Check environment variables:');
    console.log('   - VITE_FIREBASE_API_KEY');
    console.log('   - VITE_FIREBASE_APP_ID');
    return false;
  }
};

// Make it available globally for testing
if (typeof window !== 'undefined') {
  (window as any).verifyAnalytics = verifyAnalyticsSetup;
} 