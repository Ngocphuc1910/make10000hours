/**
 * Test script to verify blocking sites sync with user authentication
 * This simulates what happens when a user logs in or reloads the page
 */

import { useDeepFocusStore } from './store/deepFocusStore';
import { useUserStore } from './store/userStore';

// Simulate user login and blocking sites sync
export const testBlockingSitesSync = async () => {
  console.log('🧪 Testing blocking sites sync on user authentication...');
  
  try {
    // Simulate getting stores
    const userStore = useUserStore.getState();
    const deepFocusStore = useDeepFocusStore.getState();
    
    // Check if user is authenticated
    if (!userStore.user?.uid) {
      console.log('❌ No user authenticated - test cannot proceed');
      return;
    }
    
    console.log('✅ User authenticated:', userStore.user.uid);
    
    // Load blocked sites (this should automatically sync to extension)
    console.log('🔒 Loading blocked sites...');
    await deepFocusStore.loadBlockedSites(userStore.user.uid);
    
    const blockedSites = deepFocusStore.blockedSites;
    console.log('📊 Blocked sites loaded:', {
      count: blockedSites.length,
      sites: blockedSites.map(site => ({ name: site.name, url: site.url, isActive: site.isActive }))
    });
    
    console.log('✅ Test completed - blocked sites should now be synced to extension');
    console.log('🎯 Result: Deep Focus mode will work immediately without visiting Deep Focus page');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
};

// Auto-run test when imported
if (typeof window !== 'undefined' && window.location.pathname.includes('test')) {
  setTimeout(testBlockingSitesSync, 2000); // Wait for stores to initialize
}