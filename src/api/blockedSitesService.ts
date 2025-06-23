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
  };
}

class BlockedSitesService {
  private readonly collectionName = 'userBlockedSites';

  async getUserBlockedSites(userId: string): Promise<BlockedSite[]> {
    try {
      const docRef = doc(db, this.collectionName, userId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data() as UserBlockedSitesDocument;
        return data.sites || [];
      }
      
      return [];
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