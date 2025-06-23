import { blockedSitesService } from '../src/api/blockedSitesService';

// Simple test to create blocked sites schema in Firebase
async function createTestBlockedSites() {
  console.log('🧪 Creating test blocked sites in Firebase...');
  
  // Use a test user ID or your actual user ID
  const testUserId = '7Y4oV5qJm4MFo0ZJBXkH0cJNk0z1'; // Replace with your actual user ID
  
  try {
    // Test 1: Add Instagram
    console.log('1. Adding Instagram...');
    await blockedSitesService.addBlockedSite(testUserId, {
      name: 'Instagram',
      url: 'instagram.com',
      icon: 'ri-instagram-line',
      backgroundColor: '#E4405F',
      isActive: true
    });
    
    // Test 2: Add YouTube
    console.log('2. Adding YouTube...');
    await blockedSitesService.addBlockedSite(testUserId, {
      name: 'YouTube',
      url: 'youtube.com',
      icon: 'ri-youtube-line',
      backgroundColor: '#FF0000',
      isActive: true
    });
    
    // Test 3: Add Facebook (inactive)
    console.log('3. Adding Facebook (inactive)...');
    await blockedSitesService.addBlockedSite(testUserId, {
      name: 'Facebook',
      url: 'facebook.com',
      icon: 'ri-facebook-line',
      backgroundColor: '#1877F2',
      isActive: false
    });
    
    // Test 4: Get all sites to verify
    console.log('4. Verifying all sites...');
    const allSites = await blockedSitesService.getUserBlockedSites(testUserId);
    
    console.log('✅ Success! Created blocked sites schema with', allSites.length, 'sites:');
    allSites.forEach((site, index) => {
      console.log(`   ${index + 1}. ${site.name} (${site.url}) - ${site.isActive ? 'Active' : 'Inactive'}`);
    });
    
    console.log('🔍 Check Firebase Console -> Firestore -> userBlockedSites collection');
    console.log('📄 Document ID:', testUserId);
    
  } catch (error) {
    console.error('❌ Failed to create test data:', error);
  }
}

// Export for manual testing
export { createTestBlockedSites };

// Run immediately if called directly
if (require.main === module) {
  createTestBlockedSites();
} 