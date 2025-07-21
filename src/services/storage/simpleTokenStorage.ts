// Simple token storage for per-user Google Calendar access
// Much simpler than the complex multi-account storage

import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../api/firebase';
import { UserGoogleCalendarToken } from '../../types/models';

export class SimpleTokenStorage {
  
  /**
   * Get Google Calendar token for a user
   */
  static async getUserToken(userId: string): Promise<UserGoogleCalendarToken | null> {
    try {
      const tokenDoc = await getDoc(doc(db, 'googleCalendarTokens', userId));
      return tokenDoc.exists() ? tokenDoc.data() as UserGoogleCalendarToken : null;
    } catch (error) {
      console.error('Error getting user token:', error);
      return null;
    }
  }

  /**
   * Save Google Calendar token for a user
   */
  static async saveUserToken(token: UserGoogleCalendarToken): Promise<void> {
    try {
      await setDoc(doc(db, 'googleCalendarTokens', token.userId), token);
      console.log('✅ Token saved for user:', token.userId);
    } catch (error) {
      console.error('Error saving user token:', error);
      throw error;
    }
  }

  /**
   * Delete Google Calendar token for a user
   */
  static async deleteUserToken(userId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'googleCalendarTokens', userId));
      console.log('✅ Token deleted for user:', userId);
    } catch (error) {
      console.error('Error deleting user token:', error);
      throw error;
    }
  }

  /**
   * Check if user has a valid token
   */
  static async hasValidToken(userId: string): Promise<boolean> {
    const token = await this.getUserToken(userId);
    if (!token) return false;
    
    // Check if token is not expired and sync is enabled
    return Date.now() < token.expiresAt && token.syncEnabled;
  }

  /**
   * Update token sync status
   */
  static async updateSyncStatus(userId: string, syncEnabled: boolean): Promise<void> {
    const token = await this.getUserToken(userId);
    if (!token) {
      throw new Error('No token found for user');
    }

    const updatedToken: UserGoogleCalendarToken = {
      ...token,
      syncEnabled,
      updatedAt: new Date(),
    };

    await this.saveUserToken(updatedToken);
  }
}