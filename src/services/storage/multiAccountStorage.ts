import { 
  doc, 
  collection, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  writeBatch,
  DocumentReference,
  QueryDocumentSnapshot,
  DocumentData 
} from 'firebase/firestore';
import { db } from '../../api/firebase';
import { 
  UserGoogleAccount, 
  UserSyncSettings, 
  SyncState, 
  UserGoogleToken,
  GoogleCalendar 
} from '../../types/models';

/**
 * Multi-Account Storage Service
 * Manages Firestore operations for multi-account Google Calendar sync
 */
export class MultiAccountStorage {
  
  // =================== USER GOOGLE ACCOUNTS ===================
  
  /**
   * Get all Google accounts for a user
   */
  static async getUserGoogleAccounts(userId: string): Promise<UserGoogleAccount[]> {
    try {
      const accountsQuery = query(
        collection(db, 'userGoogleAccounts'),
        where('userId', '==', userId),
        orderBy('createdAt', 'asc')
      );
      
      const snapshot = await getDocs(accountsQuery);
      return snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        grantedAt: doc.data().grantedAt?.toDate() || new Date(),
        lastUsed: doc.data().lastUsed?.toDate() || new Date(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      } as UserGoogleAccount));
    } catch (error) {
      console.error('Error fetching user Google accounts:', error);
      throw error;
    }
  }

  /**
   * Get a specific Google account
   */
  static async getUserGoogleAccount(accountId: string): Promise<UserGoogleAccount | null> {
    try {
      const docRef = doc(db, 'userGoogleAccounts', accountId);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        return null;
      }
      
      const data = docSnap.data();
      return {
        ...data,
        id: docSnap.id,
        grantedAt: data.grantedAt?.toDate() || new Date(),
        lastUsed: data.lastUsed?.toDate() || new Date(),
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as UserGoogleAccount;
    } catch (error) {
      console.error('Error fetching Google account:', error);
      throw error;
    }
  }

  /**
   * Save or update a Google account
   */
  static async saveUserGoogleAccount(account: UserGoogleAccount): Promise<void> {
    try {
      const docRef = doc(db, 'userGoogleAccounts', account.id);
      await setDoc(docRef, {
        ...account,
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('Error saving Google account:', error);
      throw error;
    }
  }

  /**
   * Delete a Google account
   */
  static async deleteUserGoogleAccount(accountId: string): Promise<void> {
    try {
      const batch = writeBatch(db);
      
      // Delete the account
      const accountRef = doc(db, 'userGoogleAccounts', accountId);
      batch.delete(accountRef);
      
      // Delete related sync states
      const syncStatesQuery = query(
        collection(db, 'syncStates'),
        where('accountId', '==', accountId)
      );
      const syncStates = await getDocs(syncStatesQuery);
      syncStates.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
    } catch (error) {
      console.error('Error deleting Google account:', error);
      throw error;
    }
  }

  /**
   * Update account calendars
   */
  static async updateAccountCalendars(accountId: string, calendars: GoogleCalendar[]): Promise<void> {
    try {
      const docRef = doc(db, 'userGoogleAccounts', accountId);
      await updateDoc(docRef, {
        calendars,
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('Error updating account calendars:', error);
      throw error;
    }
  }

  /**
   * Update account token
   */
  static async updateAccountToken(
    accountId: string, 
    accessToken: string, 
    expiresAt: number
  ): Promise<void> {
    try {
      const docRef = doc(db, 'userGoogleAccounts', accountId);
      await updateDoc(docRef, {
        accessToken,
        expiresAt,
        lastUsed: new Date(),
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('Error updating account token:', error);
      throw error;
    }
  }

  /**
   * Set account as active (default)
   */
  static async setActiveAccount(userId: string, accountId: string): Promise<void> {
    try {
      const batch = writeBatch(db);
      
      // Get all user accounts
      const accounts = await this.getUserGoogleAccounts(userId);
      
      // Update all accounts: set target as active, others as inactive
      accounts.forEach(account => {
        const accountRef = doc(db, 'userGoogleAccounts', account.id);
        batch.update(accountRef, {
          isActive: account.id === accountId,
          updatedAt: new Date(),
        });
      });
      
      await batch.commit();
    } catch (error) {
      console.error('Error setting active account:', error);
      throw error;
    }
  }

  // =================== USER SYNC SETTINGS ===================

  /**
   * Get user sync settings
   */
  static async getUserSyncSettings(userId: string): Promise<UserSyncSettings | null> {
    try {
      const docRef = doc(db, 'userSyncSettings', userId);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        return null;
      }
      
      const data = docSnap.data();
      return {
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as UserSyncSettings;
    } catch (error) {
      console.error('Error fetching user sync settings:', error);
      throw error;
    }
  }

  /**
   * Save user sync settings
   */
  static async saveUserSyncSettings(settings: UserSyncSettings): Promise<void> {
    try {
      const docRef = doc(db, 'userSyncSettings', settings.userId);
      await setDoc(docRef, {
        ...settings,
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('Error saving user sync settings:', error);
      throw error;
    }
  }

  // =================== SYNC STATES ===================

  /**
   * Get sync states for a user
   */
  static async getUserSyncStates(userId: string): Promise<SyncState[]> {
    try {
      const syncStatesQuery = query(
        collection(db, 'syncStates'),
        where('userId', '==', userId)
      );
      
      const snapshot = await getDocs(syncStatesQuery);
      return snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        lastFullSync: doc.data().lastFullSync?.toDate() || new Date(),
        lastIncrementalSync: doc.data().lastIncrementalSync?.toDate() || new Date(),
        webhookExpirationTime: doc.data().webhookExpirationTime?.toDate(),
        lastWebhookNotification: doc.data().lastWebhookNotification?.toDate(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      } as SyncState));
    } catch (error) {
      console.error('Error fetching sync states:', error);
      throw error;
    }
  }

  /**
   * Get sync state for specific account/calendar
   */
  static async getSyncState(syncStateId: string): Promise<SyncState | null> {
    try {
      const docRef = doc(db, 'syncStates', syncStateId);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        return null;
      }
      
      const data = docSnap.data();
      return {
        ...data,
        id: docSnap.id,
        lastFullSync: data.lastFullSync?.toDate() || new Date(),
        lastIncrementalSync: data.lastIncrementalSync?.toDate() || new Date(),
        webhookExpirationTime: data.webhookExpirationTime?.toDate(),
        lastWebhookNotification: data.lastWebhookNotification?.toDate(),
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as SyncState;
    } catch (error) {
      console.error('Error fetching sync state:', error);
      throw error;
    }
  }

  /**
   * Save sync state
   */
  static async saveSyncState(syncState: SyncState): Promise<void> {
    try {
      const docRef = doc(db, 'syncStates', syncState.id);
      await setDoc(docRef, {
        ...syncState,
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('Error saving sync state:', error);
      throw error;
    }
  }

  // =================== MIGRATION HELPERS ===================

  /**
   * Migrate legacy single-account token to multi-account structure
   */
  static async migrateLegacyToken(userId: string): Promise<UserGoogleAccount | null> {
    try {
      // Check for legacy token
      const legacyTokenRef = doc(db, 'userGoogleTokens', userId);
      const legacyTokenSnap = await getDoc(legacyTokenRef);
      
      if (!legacyTokenSnap.exists()) {
        console.log('No legacy token found for migration');
        return null;
      }
      
      const legacyToken = legacyTokenSnap.data() as UserGoogleToken;
      console.log('Found legacy token, migrating to multi-account structure');
      
      // Create new multi-account structure
      const googleAccountId = `migrated_${userId}`; // Placeholder account ID
      const accountId = `${userId}_${googleAccountId}`;
      
      const newAccount: UserGoogleAccount = {
        id: accountId,
        userId: legacyToken.userId,
        googleAccountId,
        email: 'migrated-account@gmail.com', // Placeholder - will be updated on next auth
        name: 'Migrated Account',
        accessToken: legacyToken.accessToken,
        refreshToken: legacyToken.refreshToken,
        expiresAt: legacyToken.expiresAt,
        grantedAt: legacyToken.grantedAt,
        lastUsed: legacyToken.lastUsed,
        isActive: true,
        calendars: [
          {
            id: 'primary',
            name: 'Primary Calendar',
            primary: true,
            accessRole: 'owner',
            syncEnabled: true,
          }
        ],
        syncEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      // Save new account structure
      await this.saveUserGoogleAccount(newAccount);
      
      // Create default sync settings
      const syncSettings: UserSyncSettings = {
        userId,
        syncMode: 'single',
        defaultAccountId: accountId,
        accountCalendarMappings: {
          [accountId]: {
            'primary': true
          }
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      await this.saveUserSyncSettings(syncSettings);
      
      // Remove legacy token
      await deleteDoc(legacyTokenRef);
      
      console.log('Successfully migrated legacy token to multi-account structure');
      return newAccount;
      
    } catch (error) {
      console.error('Error migrating legacy token:', error);
      throw error;
    }
  }

  /**
   * Check if user has any Google accounts
   */
  static async hasAnyAccounts(userId: string): Promise<boolean> {
    try {
      const accounts = await this.getUserGoogleAccounts(userId);
      return accounts.length > 0;
    } catch (error) {
      console.error('Error checking for accounts:', error);
      return false;
    }
  }

  /**
   * Get active (default) account for user
   */
  static async getActiveAccount(userId: string): Promise<UserGoogleAccount | null> {
    try {
      const accounts = await this.getUserGoogleAccounts(userId);
      const activeAccount = accounts.find(account => account.isActive);
      
      // If no active account but accounts exist, return first account
      if (!activeAccount && accounts.length > 0) {
        return accounts[0];
      }
      
      return activeAccount || null;
    } catch (error) {
      console.error('Error getting active account:', error);
      return null;
    }
  }
}