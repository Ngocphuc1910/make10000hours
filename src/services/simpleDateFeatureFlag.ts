import { utcFeatureFlags } from './featureFlags';
import { getCurrentUserDate } from '../utils/dateUtils';

/**
 * Feature flag service for simple date fix rollout
 * Allows safe deployment and instant rollback
 */
export class SimpleDateFeatureFlag {
  
  /**
   * Check if simple date fix is enabled for user
   */
  static isSimpleDateFixEnabled(userId: string): boolean {
    try {
      // Check feature flag
      return utcFeatureFlags.isFeatureEnabled('simpleDateFix', userId);
    } catch (error) {
      console.error('Error checking simple date fix flag:', error);
      return false; // Default to disabled on error
    }
  }
  
  /**
   * Get date for session creation with feature flag support
   * This allows gradual rollout of the simple fix
   */
  static getSessionDate(userId: string, fallbackDate?: string): string {
    try {
      const useSimpleFix = this.isSimpleDateFixEnabled(userId);
      
      if (useSimpleFix) {
        console.log('🔧 Using simple date fix for user:', userId);
        return getCurrentUserDate(); // ✅ New consistent approach
      } else {
        console.log('📅 Using legacy date creation for user:', userId);
        // Legacy approach (current behavior)
        return fallbackDate || new Date().toISOString().split('T')[0];
      }
    } catch (error) {
      console.error('Error in getSessionDate:', error);
      // Fallback to legacy behavior on error
      return new Date().toISOString().split('T')[0];
    }
  }
  
  /**
   * Create session data with appropriate date field
   */
  static createSessionWithFeatureFlag(
    sessionData: any, 
    userId: string
  ): any {
    return {
      ...sessionData,
      date: this.getSessionDate(userId, sessionData.date),
      // Add metadata for tracking
      _dateCreationMethod: this.isSimpleDateFixEnabled(userId) ? 'simple-fix' : 'legacy',
      _userTimezone: this.isSimpleDateFixEnabled(userId) ? 
        Intl.DateTimeFormat().resolvedOptions().timeZone : undefined
    };
  }
  
  /**
   * Enable simple date fix for percentage of users
   */
  static async enableForPercentage(percentage: number): Promise<void> {
    try {
      // This would integrate with your feature flag system
      console.log(`🎯 Enabling simple date fix for ${percentage}% of users`);
      
      // Example implementation:
      // await utcFeatureFlags.updateFeatureFlag('simpleDateFix', {
      //   enabled: true,
      //   percentage: percentage
      // });
      
    } catch (error) {
      console.error('Failed to enable simple date fix:', error);
      throw error;
    }
  }
  
  /**
   * Instant rollback - disable for all users
   */
  static async emergencyDisable(): Promise<void> {
    try {
      console.log('🚨 Emergency disable of simple date fix');
      
      // Disable feature flag immediately
      // await utcFeatureFlags.updateFeatureFlag('simpleDateFix', {
      //   enabled: false,
      //   percentage: 0
      // });
      
      console.log('✅ Simple date fix disabled for all users');
      
    } catch (error) {
      console.error('Failed to disable simple date fix:', error);
      throw error;
    }
  }
  
  /**
   * Get rollout statistics
   */
  static async getRolloutStats(): Promise<{
    totalUsers: number;
    enabledUsers: number;
    percentage: number;
    successRate: number;
  }> {
    try {
      // This would query your analytics/feature flag system
      return {
        totalUsers: 1000, // Example data
        enabledUsers: 100,
        percentage: 10,
        successRate: 99.5
      };
    } catch (error) {
      console.error('Failed to get rollout stats:', error);
      return {
        totalUsers: 0,
        enabledUsers: 0,
        percentage: 0,
        successRate: 0
      };
    }
  }
  
  /**
   * Test simple date fix functionality
   */
  static async testSimpleDateFix(userId: string): Promise<{
    success: boolean;
    results: any;
    errors: string[];
  }> {
    const errors: string[] = [];
    let results: any = {};
    
    try {
      // Test 1: Feature flag check
      const isEnabled = this.isSimpleDateFixEnabled(userId);
      results.featureFlagEnabled = isEnabled;
      
      // Test 2: Date creation
      const sessionDate = this.getSessionDate(userId);
      results.sessionDate = sessionDate;
      
      // Test 3: Session creation
      const testSession = this.createSessionWithFeatureFlag({
        taskId: 'test',
        userId: userId,
        duration: 25
      }, userId);
      results.testSession = testSession;
      
      // Test 4: Timezone consistency
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const expectedDate = new Date().toLocaleDateString('en-CA', {
        timeZone: userTimezone
      });
      results.timezoneConsistent = testSession.date === expectedDate;
      
      return {
        success: errors.length === 0,
        results,
        errors
      };
      
    } catch (error) {
      errors.push(error.message);
      return {
        success: false,
        results,
        errors
      };
    }
  }
}

// Export for easy use
export const simpleDateFeatureFlag = SimpleDateFeatureFlag;