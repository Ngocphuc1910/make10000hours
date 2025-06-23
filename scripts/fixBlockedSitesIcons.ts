import { blockedSitesService } from '../src/api/blockedSitesService';
import { FaviconService } from '../src/utils/faviconUtils';

/**
 * Migration script to fix blocked sites that are missing proper icons
 * Run this once to update existing data in Firebase
 */
async function fixBlockedSitesIcons(userId: string) {
  console.log('🔧 Fixing blocked sites icons...');
  
  try {
    // Get current blocked sites
    const sites = await blockedSitesService.getUserBlockedSites(userId);
    console.log('📄 Found', sites.length, 'blocked sites');
    
    let fixedCount = 0;
    
    // Fix each site that has missing or invalid icon
    const fixedSites = sites.map(site => {
      const hasValidIcon = site.icon && site.icon.length > 0 && site.icon !== 'undefined';
      
      if (!hasValidIcon) {
        const smartIcon = FaviconService.getDomainIcon(site.url);
        console.log(`🔧 Fixing ${site.name} (${site.url}): ${site.icon} → ${smartIcon}`);
        fixedCount++;
        
        return {
          ...site,
          icon: smartIcon,
          backgroundColor: site.backgroundColor || '#6B7280'
        };
      }
      
      return site;
    });
    
    // Update all sites if any were fixed
    if (fixedCount > 0) {
      await blockedSitesService.updateAllBlockedSites(userId, fixedSites);
      console.log('✅ Fixed', fixedCount, 'blocked sites with proper icons');
    } else {
      console.log('✅ All blocked sites already have proper icons');
    }
    
    return fixedCount;
  } catch (error) {
    console.error('❌ Failed to fix blocked sites icons:', error);
    throw error;
  }
}

export { fixBlockedSitesIcons }; 