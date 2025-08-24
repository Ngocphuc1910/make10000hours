import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { BlockedSite } from '../types/deepFocus';
import { FaviconService } from '../utils/faviconUtils';

interface UserBlockedSitesDocument {
  userId: string;
  sites: BlockedSite[];
  metadata: {
    totalSites: number;
    createdAt: Timestamp | any;
    updatedAt: Timestamp | any;
    syncedAt?: Timestamp | any;
    version: string;
    defaultsInitialized?: boolean;  // Track if user has been initialized with defaults
    initializationMethod?: 'defaults' | 'empty' | 'imported';  // How the user was initialized
  };
}

class BlockedSitesService {
  private readonly collectionName = 'userBlockedSites';

  /**
   * Get the default list of 15 most distracting websites for new users
   */
  private getDefaultBlockedSites(): Omit<BlockedSite, 'id'>[] {
    const defaultSites = [
      'facebook.com',
      'x.com',
      'instagram.com',
      'youtube.com',
      'tiktok.com',
      'reddit.com',
      'pinterest.com',
      'tumblr.com',
      'netflix.com',
      'hulu.com',
      'amazon.com',
      'ebay.com',
      'craigslist.org',
      'etsy.com',
      'buzzfeed.com'
    ];

    return defaultSites.map(url => ({
      name: url.replace('.com', '').replace('.tv', '').replace('.org', '').charAt(0).toUpperCase() + url.replace('.com', '').replace('.tv', '').replace('.org', '').slice(1), // e.g., "facebook.com" -> "Facebook"
      url,
      isActive: true,
      icon: FaviconService.getDomainIcon(url),
      backgroundColor: '#6B7280' // Default gray color
    }));
  }

  async getUserBlockedSites(userId: string): Promise<BlockedSite[]> {
    try {
      const docRef = doc(db, this.collectionName, userId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data() as UserBlockedSitesDocument;
        return data.sites || [];
      }
      
      // New user - initialize with default 15 most distracting sites
      console.log('🆕 New user detected - initializing with default blocked sites');
      const defaultSites = this.getDefaultBlockedSites();
      
      // Create BlockedSite objects with IDs
      const sitesWithIds: BlockedSite[] = defaultSites.map((site, index) => ({
        ...site,
        id: `default-${index + 1}-${Date.now()}`
      }));
      
      // Save the default sites to Firestore with initialization metadata
      const userDoc: UserBlockedSitesDocument = {
        userId,
        sites: sitesWithIds,
        metadata: {
          totalSites: sitesWithIds.length,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          version: '1.0.0',
          defaultsInitialized: true,  // Mark that user has been initialized with defaults
          initializationMethod: 'defaults'  // Track how user was initialized
        }
      };
      
      await setDoc(docRef, userDoc);
      console.log('💾 Saved default blocked sites to Firestore:', sitesWithIds.length, 'sites');
      
      return sitesWithIds;
    } catch (error) {
      console.error('Failed to get blocked sites:', error);
      throw error;
    }
  }

  async addBlockedSite(userId: string, site: Omit<BlockedSite, 'id'>): Promise<void> {
    try {
      const currentSites = await this.getUserBlockedSites(userId);
      
      // Ensure icon is always populated with smart fallback
      const siteWithIcon = {
        ...site,
        icon: site.icon || FaviconService.getDomainIcon(site.url),
        backgroundColor: site.backgroundColor || '#6B7280'
      };
      
      const newSite: BlockedSite = {
        ...siteWithIcon,
        id: `site_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };
      
      const updatedSites = [...currentSites, newSite];
      await this.updateAllBlockedSites(userId, updatedSites);
    } catch (error) {
      console.error('Failed to add blocked site:', error);
      throw error;
    }
  }

  async removeBlockedSite(userId: string, siteId: string): Promise<void> {
    try {
      const currentSites = await this.getUserBlockedSites(userId);
      const updatedSites = currentSites.filter(site => site.id !== siteId);
      await this.updateAllBlockedSites(userId, updatedSites);
    } catch (error) {
      console.error('Failed to remove blocked site:', error);
      throw error;
    }
  }

  async toggleBlockedSite(userId: string, siteId: string): Promise<void> {
    try {
      const currentSites = await this.getUserBlockedSites(userId);
      const updatedSites = currentSites.map(site =>
        site.id === siteId ? { ...site, isActive: !site.isActive } : site
      );
      await this.updateAllBlockedSites(userId, updatedSites);
    } catch (error) {
      console.error('Failed to toggle blocked site:', error);
      throw error;
    }
  }

  async updateAllBlockedSites(userId: string, sites: BlockedSite[]): Promise<void> {
    try {
      const docRef = doc(db, this.collectionName, userId);
      const docSnap = await getDoc(docRef);
      
      const documentData: UserBlockedSitesDocument = {
        userId,
        sites,
        metadata: {
          totalSites: sites.length,
          createdAt: docSnap.exists() ? docSnap.data()?.metadata?.createdAt : serverTimestamp(),
          updatedAt: serverTimestamp(),
          syncedAt: serverTimestamp(),
          version: '1.0'
        }
      };

      await setDoc(docRef, documentData, { merge: true });
    } catch (error) {
      console.error('Failed to update blocked sites:', error);
      throw error;
    }
  }
}

export const blockedSitesService = new BlockedSitesService();
export default blockedSitesService; 