import { useUserStore } from '../store/userStore';

/**
 * Simple utility to create consistent date fields across web app and extension
 * This solves the timezone inconsistency with minimal code changes
 */
export class DateUtils {
  
  /**
   * Get current date in user's timezone as YYYY-MM-DD string
   * This is the CORE FIX - ensures consistent date creation
   */
  static getCurrentDateInUserTimezone(): string {
    try {
      // Get user's timezone setting
      const userTimezone = useUserStore.getState().getTimezone() || 
                           Intl.DateTimeFormat().resolvedOptions().timeZone;
      
      // Create date string in user's timezone (not physical location)
      const userDate = new Date().toLocaleDateString('en-CA', { 
        timeZone: userTimezone 
      });
      
      console.log('📅 Date created in user timezone:', {
        userTimezone,
        dateString: userDate,
        physicalTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      });
      
      return userDate; // YYYY-MM-DD format
      
    } catch (error) {
      console.error('❌ Error creating date in user timezone:', error);
      // Fallback to current date in system timezone
      return new Date().toLocaleDateString('en-CA');
    }
  }
  
  /**
   * Get date in specific timezone as YYYY-MM-DD string
   * Used for extension sync and testing
   */
  static getDateInTimezone(timezone: string, date?: Date): string {
    try {
      const targetDate = date || new Date();
      return targetDate.toLocaleDateString('en-CA', { 
        timeZone: timezone 
      });
    } catch (error) {
      console.error('❌ Error creating date in timezone:', timezone, error);
      return new Date().toLocaleDateString('en-CA');
    }
  }
  
  /**
   * Validate that web app and extension create same date
   * Used for testing and debugging
   */
  static validateDateConsistency(webDate: string, extensionDate: string): boolean {
    const isConsistent = webDate === extensionDate;
    
    if (!isConsistent) {
      console.warn('⚠️ Date inconsistency detected:', {
        webAppDate: webDate,
        extensionDate: extensionDate,
        issue: 'Web app and extension creating different dates'
      });
    }
    
    return isConsistent;
  }
  
  /**
   * Get timezone-aware "today" date for filtering
   * This ensures filtering uses same logic as creation
   */
  static getTodayInUserTimezone(): string {
    return this.getCurrentDateInUserTimezone();
  }
}

// Export simple function for easy import
export const getCurrentUserDate = DateUtils.getCurrentDateInUserTimezone;