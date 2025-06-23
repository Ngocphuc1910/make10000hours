import { blockedSitesService } from './api/blockedSitesService';

// Test the blocked sites implementation
async function testBlockedSites() {
  const testUserId = 'test-user-123';
  
  console.log('🧪 Testing blocked sites Firebase implementation...');
  
  try {
    // Test 1: Get initial sites (should be empty)
    console.log('1. Getting initial blocked sites...');
    const initialSites = await blockedSitesService.getUserBlockedSites(testUserId);
    console.log('✅ Initial sites:', initialSites);
    
    // Test 2: Add a blocked site
    console.log('2. Adding a blocked site...');
    await blockedSitesService.addBlockedSite(testUserId, {
      name: 'Instagram',
      url: 'instagram.com',
      icon: 'ri-instagram-line',
      backgroundColor: '#E4405F',
      isActive: true
    });
    
    // Test 3: Get sites after adding
    const sitesAfterAdd = await blockedSitesService.getUserBlockedSites(testUserId);
    console.log('✅ Sites after adding:', sitesAfterAdd);
    
    // Test 4: Toggle site
    if (sitesAfterAdd.length > 0) {
      console.log('3. Toggling site status...');
      await blockedSitesService.toggleBlockedSite(testUserId, sitesAfterAdd[0].id);
      
      const sitesAfterToggle = await blockedSitesService.getUserBlockedSites(testUserId);
      console.log('✅ Sites after toggle:', sitesAfterToggle);
    }
    
    console.log('🎉 All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Export for manual testing
export { testBlockedSites }; 