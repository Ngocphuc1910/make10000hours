import { googleOAuthService } from '../auth/googleOAuth';
import { MultiAccountStorage } from '../storage/multiAccountStorage';
import { UserGoogleAccount, UserSyncSettings } from '../../types/models';

/**
 * Multi-Account Migration Service
 * Handles migration from single-account to multi-account architecture
 */
export class MultiAccountMigration {

  /**
   * Check if user needs migration from legacy single-account system
   */
  static async needsMigration(userId: string): Promise<boolean> {
    try {
      // Check if user already has multi-account setup
      const hasMultiAccounts = await MultiAccountStorage.hasAnyAccounts(userId);
      
      if (hasMultiAccounts) {
        return false; // Already migrated
      }

      // Check if user has legacy single-account token
      const legacyToken = await googleOAuthService.getStoredToken();
      return !!legacyToken;
    } catch (error) {
      console.error('Error checking migration status:', error);
      return false;
    }
  }

  /**
   * Perform migration from single-account to multi-account
   */
  static async performMigration(userId: string): Promise<UserGoogleAccount | null> {
    try {
      console.log('🔄 Starting migration from single-account to multi-account for user:', userId);

      // Use the migration function from MultiAccountStorage
      const migratedAccount = await MultiAccountStorage.migrateLegacyToken(userId);
      
      if (migratedAccount) {
        console.log('✅ Migration completed successfully:', {
          accountId: migratedAccount.id,
          email: migratedAccount.email,
          calendarsCount: migratedAccount.calendars.length
        });

        // Update the migrated account with real Google profile info
        await this.updateMigratedAccountProfile(migratedAccount);
        
        return migratedAccount;
      } else {
        console.log('ℹ️ No legacy token found for migration');
        return null;
      }
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }

  /**
   * Update migrated account with real Google profile information
   */
  private static async updateMigratedAccountProfile(account: UserGoogleAccount): Promise<void> {
    try {
      // Get real user profile from Google
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${account.accessToken}`,
        },
      });

      if (response.ok) {
        const profile = await response.json();
        
        // Update account with real profile data
        const updatedAccount: UserGoogleAccount = {
          ...account,
          googleAccountId: profile.id,
          email: profile.email,
          name: profile.name,
          picture: profile.picture,
          updatedAt: new Date(),
        };

        // Also update the account ID to use real Google ID
        const newAccountId = `${account.userId}_${profile.id}`;
        updatedAccount.id = newAccountId;

        // Save updated account (this will create a new document with correct ID)
        await MultiAccountStorage.saveUserGoogleAccount(updatedAccount);

        // Update sync settings to reference new account ID
        const syncSettings = await MultiAccountStorage.getUserSyncSettings(account.userId);
        if (syncSettings && syncSettings.defaultAccountId === account.id) {
          syncSettings.defaultAccountId = newAccountId;
          
          // Update calendar mappings
          if (syncSettings.accountCalendarMappings[account.id]) {
            syncSettings.accountCalendarMappings[newAccountId] = syncSettings.accountCalendarMappings[account.id];
            delete syncSettings.accountCalendarMappings[account.id];
          }

          await MultiAccountStorage.saveUserSyncSettings(syncSettings);
        }

        // Delete old account with placeholder ID if it's different
        if (account.id !== newAccountId) {
          await MultiAccountStorage.deleteUserGoogleAccount(account.id);
        }

        console.log('✅ Updated migrated account with real Google profile');
      }
    } catch (error) {
      console.warn('⚠️ Could not update migrated account profile (non-critical):', error);
      // This is non-critical - the account will work with placeholder data
    }
  }

  /**
   * Auto-migrate user on app initialization
   */
  static async autoMigrate(userId: string): Promise<UserGoogleAccount | null> {
    try {
      const needsMigration = await this.needsMigration(userId);
      
      if (!needsMigration) {
        return null;
      }

      console.log('🔄 Auto-migrating user to multi-account system:', userId);
      return await this.performMigration(userId);
    } catch (error) {
      console.error('❌ Auto-migration failed:', error);
      return null;
    }
  }

  /**
   * Get migration status for user
   */
  static async getMigrationStatus(userId: string): Promise<{
    isLegacyUser: boolean;
    hasMultiAccount: boolean;
    needsMigration: boolean;
    accountCount: number;
  }> {
    try {
      const hasMultiAccounts = await MultiAccountStorage.hasAnyAccounts(userId);
      const accounts = await MultiAccountStorage.getUserGoogleAccounts(userId);
      const legacyToken = await googleOAuthService.getStoredToken();
      
      return {
        isLegacyUser: !!legacyToken,
        hasMultiAccount: hasMultiAccounts,
        needsMigration: !hasMultiAccounts && !!legacyToken,
        accountCount: accounts.length,
      };
    } catch (error) {
      console.error('Error getting migration status:', error);
      return {
        isLegacyUser: false,
        hasMultiAccount: false,
        needsMigration: false,
        accountCount: 0,
      };
    }
  }

  /**
   * Validate migration was successful
   */
  static async validateMigration(userId: string): Promise<boolean> {
    try {
      const accounts = await MultiAccountStorage.getUserGoogleAccounts(userId);
      const syncSettings = await MultiAccountStorage.getUserSyncSettings(userId);
      
      if (accounts.length === 0) {
        console.warn('❌ Migration validation failed: No accounts found');
        return false;
      }

      if (!syncSettings) {
        console.warn('❌ Migration validation failed: No sync settings found');
        return false;
      }

      // Check that default account exists
      if (syncSettings.defaultAccountId) {
        const defaultAccount = accounts.find(acc => acc.id === syncSettings.defaultAccountId);
        if (!defaultAccount) {
          console.warn('❌ Migration validation failed: Default account not found');
          return false;
        }
      }

      // Check that at least one account is active
      const hasActiveAccount = accounts.some(acc => acc.isActive);
      if (!hasActiveAccount) {
        console.warn('❌ Migration validation failed: No active account found');
        return false;
      }

      console.log('✅ Migration validation passed');
      return true;
    } catch (error) {
      console.error('❌ Migration validation error:', error);
      return false;
    }
  }
}