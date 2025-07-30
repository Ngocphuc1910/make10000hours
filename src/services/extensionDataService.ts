// Chrome Extension types

import { DailySiteUsage } from "../api/siteUsageService";
import { DailyUsage, SiteUsage, TimeMetrics } from "../types/deepFocus";

interface ExtensionTimeData {
  totalTime: number;
  sitesVisited: number;
  productivityScore: number;
  sites: Record<string, { timeSpent: number; visits: number }>;
}

interface ExtensionResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

interface ExtensionSettings {
  trackingEnabled: boolean;
  blockingEnabled: boolean;
  focusMode: boolean;
  blockedSites: string[];
}

// Circuit breaker for extension communication
class ExtensionCircuitBreaker {
  private static instance: ExtensionCircuitBreaker;
  private failureCount = 0;
  private lastFailureTime = 0;
  private lastResetTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private readonly FAILURE_THRESHOLD = 5;
  private readonly TIMEOUT = 60000;
  private readonly RETRY_TIMEOUT = 10000;
  private readonly MIN_RESET_INTERVAL = 30000; // Prevent reset spam
  private lastLogTime = 0;
  private readonly LOG_THROTTLE = 5000; // Throttle logs to every 5 seconds

  static getInstance(): ExtensionCircuitBreaker {
    if (!ExtensionCircuitBreaker.instance) {
      ExtensionCircuitBreaker.instance = new ExtensionCircuitBreaker();
    }
    return ExtensionCircuitBreaker.instance;
  }

  private throttledLog(message: string): void {
    const now = Date.now();
    if (now - this.lastLogTime >= this.LOG_THROTTLE) {
      console.log(message);
      this.lastLogTime = now;
    }
  }

  reset(): void {
    const now = Date.now();
    
    // Prevent reset spam - only allow reset if enough time has passed
    if (now - this.lastResetTime < this.MIN_RESET_INTERVAL && this.state === 'CLOSED') {
      return; // Skip reset if called too frequently
    }
    
    this.failureCount = 0;
    this.state = 'CLOSED';
    this.lastFailureTime = 0;
    this.lastResetTime = now;
    this.throttledLog('🔄 Extension circuit breaker RESET');
  }

  canExecute(): boolean {
    const now = Date.now();
    
    if (this.state === 'OPEN') {
      if (now - this.lastFailureTime >= this.TIMEOUT) {
        this.state = 'HALF_OPEN';
        return true;
      }
      return false;
    }
    
    return true;
  }

  onSuccess(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.FAILURE_THRESHOLD) {
      this.state = 'OPEN';
      this.throttledLog(`🚫 Extension circuit breaker OPEN - preventing further calls for ${this.TIMEOUT/1000}s`);
    }
  }

  isOpen(): boolean {
    return this.state === 'OPEN';
  }

  getStatus(): { state: string; failureCount: number; timeUntilRetry: number } {
    const now = Date.now();
    const timeUntilRetry = this.state === 'OPEN' ? 
      Math.max(0, this.TIMEOUT - (now - this.lastFailureTime)) : 0;
    
    return {
      state: this.state,
      failureCount: this.failureCount,
      timeUntilRetry
    };
  }
}

class ExtensionDataService {
  private static extensionId: string | null = null;
  private static circuitBreaker = ExtensionCircuitBreaker.getInstance();
  private static lastCallTimes = new Map<string, number>(); // Track by message type
  private static readonly CALL_DEBOUNCE_MS = 500; // Reduced from 1000ms
  private static readonly CRITICAL_DEBOUNCE_MS = 200; // For focus mode and blocking operations

  static isExtensionInstalled(): boolean {
    // Since we use window.postMessage communication, we don't need chrome.runtime
    // Just check if we're in a browser environment that supports postMessage
    return typeof window !== 'undefined' && typeof window.postMessage === 'function';
  }

  static async testRealExtensionConnection(timeout: number = 1500): Promise<boolean> {
    try {
      console.log('🔄 Sending GET_TODAY_STATS test message to extension...');
      // Use a simple ping message that we know the extension handles
      const response = await this.sendMessage({ type: 'GET_TODAY_STATS' }, timeout);
      console.log('📨 Extension response:', response);
      const isValid = response && (response.success !== false);
      console.log('✅ Extension test result:', isValid);
      return isValid;
    } catch (error) {
      console.log('❌ Extension connection test failed:', error);
      return false;
    }
  }

  static async getExtensionSetupState(): Promise<'NOT_INSTALLED' | 'READY'> {
    console.log('🔍 Checking extension setup state...');
    
    // Check circuit breaker first
    const circuitBreakerOpen = this.circuitBreaker.isOpen();
    console.log('🐛 Circuit breaker isOpen():', circuitBreakerOpen);
    if (circuitBreakerOpen) {
      console.log('❌ Circuit breaker is OPEN, extension unavailable');
      return 'NOT_INSTALLED';
    }

    // Test actual extension connection with short timeout for faster feedback
    console.log('🔄 Testing extension connection...');
    const isConnected = await this.testRealExtensionConnection(1000); // Very short timeout for initial test
    console.log(`📡 Extension connection test result: ${isConnected ? 'CONNECTED' : 'FAILED'}`);
    
    if (!isConnected) {
      // If connection failed, try to wake up the extension
      console.log('🔄 Extension not responding, attempting to activate...');
      const activated = await this.tryActivateExtension();
      
      if (!activated) {
        console.log('❌ Extension activation failed - extension not installed');
        return 'NOT_INSTALLED';
      }
    }

    // Extension is connected, now check if user info is synced and sync if needed
    console.log('🔄 Extension connected, checking user sync status...');
    const synced = await this.ensureUserInfoSynced();
    
    if (synced) {
      console.log('✅ Extension is ready with user info synced');
      return 'READY';
    } else {
      console.log('⚠️ User info sync failed, but extension is responding');
      console.log('🔄 Allowing Deep Focus to work anyway - user can manually sync later');
      
      // Since extension is responding, let's allow it to work
      // User info will sync eventually when extension is used
      return 'READY';
    }
  }

  static async ensureUserInfoSynced(): Promise<boolean> {
    try {
      console.log('🔄 Syncing user info to extension...');
      
      // Import user store dynamically to get current user
      const { useUserStore } = await import('../store/userStore');
      const { user } = useUserStore.getState();
      
      if (!user) {
        console.log('❌ No user found, cannot sync');
        return false;
      }

      console.log('👤 Current user:', { uid: user.uid, userName: user.userName });

      // Try multiple sync methods to ensure user info reaches extension
      const syncMethods = [
        // Method 1: Direct user info sync
        async () => {
          console.log('🔄 Method 1: Sending user info directly...');
          return await this.sendMessage({
            type: 'SYNC_USER_INFO',
            payload: {
              userId: user.uid,
              userName: user.userName,
              userEmail: user.userName, // Fallback if needed
            }
          });
        },
        
        // Method 2: Force sync from web app
        async () => {
          console.log('🔄 Method 2: Force sync from webapp...');
          return await this.forceSyncFromWebApp();
        },
        
        // Method 3: Update extension settings with user info
        async () => {
          console.log('🔄 Method 3: Update extension settings...');
          return await this.updateExtensionSettings({
            blockedSites: [], // Start with empty, will be populated later
            userId: user.uid,
            userName: user.userName
          });
        },
        
        // Method 4: Try to get current extension user info to verify sync
        async () => {
          console.log('🔄 Method 4: Verify extension user info...');
          const response = await this.sendMessage({ type: 'GET_USER_INFO' });
          console.log('👤 Extension user info:', response);
          
          // If extension shows correct user info, sync is working
          if (response && (response.userId === user.uid || response.userName === user.userName)) {
            return { success: true };
          } else {
            return { success: false, error: 'User info not matching in extension' };
          }
        }
      ];

      // Try each method until one succeeds
      for (let i = 0; i < syncMethods.length; i++) {
        try {
          const result = await syncMethods[i]();
          console.log(`📨 Method ${i + 1} result:`, result);
          
          if (result && result.success !== false) {
            console.log(`✅ User info synced successfully using method ${i + 1}`);
            
            // Give extension a moment to process the sync
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Verify sync worked by testing connection again
            const verifyResult = await this.testRealExtensionConnection();
            console.log('🔍 Verification result:', verifyResult);
            
            return verifyResult;
          }
        } catch (error) {
          console.log(`❌ Method ${i + 1} failed:`, error);
        }
      }

      console.log('❌ All sync methods failed');
      return false;
    } catch (error) {
      console.log('❌ Error syncing user info to extension:', error);
      return false;
    }
  }

  static async tryActivateExtension(): Promise<boolean> {
    try {
      // Send a simple activation ping with longer timeout
      console.log('🔔 Sending activation ping to extension...');
      
      // Try multiple activation strategies
      const activationMessages = [
        { type: 'PING' },
        { type: 'GET_TODAY_STATS' },
        { type: 'ACTIVATE_EXTENSION' }
      ];

      for (const message of activationMessages) {
        try {
          console.log(`🔄 Trying activation with: ${message.type}`);
          const response = await this.sendMessage(message, 2000);
          if (response && response.success !== false) {
            console.log('✅ Extension activated with:', message.type);
            return true;
          }
        } catch (error) {
          console.log(`❌ Activation attempt failed with ${message.type}:`, error);
        }
      }
      
      return false;
    } catch (error) {
      console.log('❌ Extension activation failed:', error);
      return false;
    }
  }

  private static isCriticalOperation(message: any): boolean {
    const criticalTypes = [
      'ENABLE_FOCUS_MODE',
      'DISABLE_FOCUS_MODE', 
      'BLOCK_SITE',
      'UNBLOCK_SITE',
      'GET_FOCUS_STATE',
      'ADD_BLOCKED_SITE',
      'REMOVE_BLOCKED_SITE',
      'BLOCK_MULTIPLE_SITES', // Add batch blocking as critical operation
      'GET_TODAY_DEEP_FOCUS_SESSIONS',
      'GET_DEEP_FOCUS_SESSIONS_DATE_RANGE',
      'GET_ACTIVE_DEEP_FOCUS_SESSION',
      'GET_ALL_DEEP_FOCUS_SESSIONS',
      'GET_RECENT_7_DAYS_DEEP_FOCUS_SESSIONS',
      'GET_LAST_10_DEEP_FOCUS_SESSIONS'
    ];
    return criticalTypes.includes(message.type);
  }

  static async sendMessage(message: any, timeout?: number): Promise<any> {
    if (!this.isExtensionInstalled()) {
      throw new Error('Extension not installed');
    }

    // Smart debouncing based on message type
    const now = Date.now();
    const messageType = message.type || 'unknown';
    const lastCallTime = this.lastCallTimes.get(messageType) || 0;
    const debounceTime = this.isCriticalOperation(message) ? 
      this.CRITICAL_DEBOUNCE_MS : this.CALL_DEBOUNCE_MS;
    
    if (now - lastCallTime < debounceTime) {
      throw new Error(`Extension call debounced - ${messageType} too frequent`);
    }
    this.lastCallTimes.set(messageType, now);

    if (!this.circuitBreaker.canExecute()) {
      throw new Error('Extension communication temporarily disabled - circuit breaker open');
    }
    
    try {
      // Use only postMessage method for reliability
      const response = await this.sendMessageViaContentScript(message, timeout);
      this.circuitBreaker.onSuccess();
      return response;
    } catch (error) {
      this.circuitBreaker.onFailure();
      if (!this.circuitBreaker.isOpen()) {
        console.error('Extension communication failed:', error);
      }
      throw error;
    }
  }

  // Simplified content script communication
  static async sendMessageViaContentScript(message: any, timeout: number = 2000): Promise<any> {
    return new Promise((resolve, reject) => {
      const messageId = Math.random().toString(36);
      const timeoutId = setTimeout(() => {
        window.removeEventListener('message', responseHandler);
        reject(new Error('Extension communication timeout'));
      }, timeout);

      const responseHandler = (event: MessageEvent) => {
        if (event.data?.extensionResponseId === messageId) {
          clearTimeout(timeoutId);
          window.removeEventListener('message', responseHandler);
          resolve(event.data.response);
        }
      };

      window.addEventListener('message', responseHandler);
      
      window.postMessage({
        type: 'EXTENSION_REQUEST',
        messageId,
        payload: message
      }, '*');
    });
  }

  static async getTodayStats(): Promise<ExtensionResponse<ExtensionTimeData>> {
    return await this.sendMessage({ type: 'GET_TODAY_STATS' });
  }

  static async getTimeDataRange(startDate: string, endDate: string): Promise<ExtensionResponse<Record<string, ExtensionTimeData>>> {
    return await this.sendMessage({ 
      type: 'GET_TIME_DATA_RANGE', 
      payload: { startDate, endDate } 
    });
  }

  static async getSettings(): Promise<ExtensionSettings> {
    return await this.sendMessage({ type: 'GET_SETTINGS' });
  }

  static async toggleFocusMode(): Promise<boolean> {
    const response = await this.sendMessage({ type: 'TOGGLE_FOCUS_MODE' });
    return response.focusMode;
  }

  static async enableFocusMode(): Promise<void> {
    const response = await this.sendMessage({ type: 'ENABLE_FOCUS_MODE' });
    if (!response?.success) {
      throw new Error(response?.error || 'Failed to enable focus mode');
    }
  }

  static async disableFocusMode(): Promise<void> {
    const response = await this.sendMessage({ type: 'DISABLE_FOCUS_MODE' });
    if (!response?.success) {
      throw new Error(response?.error || 'Failed to disable focus mode');
    }
  }

  static async getFocusStatus(): Promise<{ focusMode: boolean }> {
    const response = await this.sendMessage({ type: 'GET_FOCUS_STATE' });
    if (!response?.success && response?.error) {
      throw new Error(response.error);
    }
    return response.data || response;
  }

  static async blockSite(domain: string): Promise<void> {
    await this.sendMessage({ 
      type: 'ADD_BLOCKED_SITE', 
      payload: { domain } 
    });
  }

  static async blockMultipleSites(domains: string[]): Promise<{ success: boolean; results: any[]; summary: any }> {
    if (!domains || domains.length === 0) {
      return { success: true, results: [], summary: { successCount: 0, failureCount: 0, total: 0 } };
    }
    
    try {
      // Try batch blocking first
      const response = await this.sendMessage({ 
        type: 'BLOCK_MULTIPLE_SITES', 
        payload: { domains } 
      });
      
      // Ensure response has the expected structure
      if (response && response.success && !response.summary) {
        response.summary = { 
          successCount: response.results?.filter((r: any) => r.success).length || 0,
          failureCount: response.results?.filter((r: any) => !r.success).length || 0,
          total: domains.length 
        };
      }
      
      return response;
    } catch (error) {
      console.warn('⚠️ Batch blocking failed, falling back to individual blocking:', error);
      
      // Fallback to individual blocking
      const results = [];
      let successCount = 0;
      let failureCount = 0;
      
      for (const domain of domains) {
        try {
          await this.blockSite(domain);
          results.push({ domain, success: true });
          successCount++;
        } catch (err) {
          results.push({ domain, success: false, error: err instanceof Error ? err.message : String(err) });
          failureCount++;
        }
      }
      
      return { 
        success: successCount > 0, 
        results,
        summary: { successCount, failureCount, total: domains.length }
      };
    }
  }

  static async unblockSite(domain: string): Promise<void> {
    await this.sendMessage({ 
      type: 'REMOVE_BLOCKED_SITE', 
      payload: { domain } 
    });
  }

  static async getAnalyticsData(period: 'week' | 'month' | 'quarter' = 'week') {
    return await this.sendMessage({ 
      type: 'GET_ANALYTICS_DATA', 
      payload: { period } 
    });
  }

  static mapExtensionDataToWebApp(extensionData: ExtensionTimeData) {
    const sites = Object.entries(extensionData.sites).map(([domain, data], index) => ({
      id: (index + 1).toString(),
      name: this.getDomainDisplayName(domain),
      url: domain,
      icon: this.getDomainIcon(domain),
      backgroundColor: this.getDomainColor(domain),
      timeSpent: Math.round(data.timeSpent / (1000 * 60)), // Convert ms to minutes
      sessions: data.visits,
      percentage: Math.round((data.timeSpent / extensionData.totalTime) * 100)
    }));

    return {
      timeMetrics: {
        onScreenTime: Math.round(extensionData.totalTime / (1000 * 60)), // Convert to minutes
        workingTime: Math.round(extensionData.totalTime / (1000 * 60)),
        deepFocusTime: Math.round(extensionData.totalTime / (1000 * 60)),
        overrideTime: 0
      },
      siteUsage: sites.sort((a, b) => b.timeSpent - a.timeSpent),
      productivityScore: extensionData.productivityScore
    };
  }

  static mapArrSiteUsage(data: DailySiteUsage[]) {
    const siteUsages: {[domain: string]: SiteUsage} = {};
    let totalTime = 0;
    const timeMetrics: TimeMetrics = {
      onScreenTime: 0,
      workingTime: 0,
      deepFocusTime: 0,
      overrideTime: 0
    };
    const dailyUsages: DailyUsage[] = [];

    data.forEach((item) => {
      Object.entries(item.sites).forEach(([domain, siteData]) => {
        if (!siteUsages[domain]) {
          siteUsages[domain] = {
            id: domain,
            name: this.getDomainDisplayName(domain),
            url: domain,
            icon: this.getDomainIcon(domain),
            backgroundColor: this.getDomainColor(domain),
            timeSpent: 0,
            sessions: 0,
            percentage: 0, // Will be calculated later
          };
        }
        
        // Aggregate site usage data
        siteUsages[domain].timeSpent += Math.round(siteData.timeSpent / (1000 * 60)); // Convert ms to minutes
        siteUsages[domain].sessions += siteData.visits;
        // Update total time for percentage calculation
        totalTime += siteData.timeSpent;
      });

      // Map time metrics
      timeMetrics.onScreenTime += Math.round(item.totalTime / (1000 * 60));

      // Map daily usage
      dailyUsages.push({
        date: item.date,
        onScreenTime: Math.round(item.totalTime / (1000 * 60)),
        workingTime: 0, // Will be calculated later
        deepFocusTime: 0, // will be calculated later
      });
    });

    // Calculate percentages and sort site usage
    const siteUsageArray = Object.values(siteUsages).map(site => {
      const percentage = totalTime > 0 ? Math.round((site.timeSpent / totalTime) * 100) : 0;
      return {
        ...site,
        percentage
      };
    }).sort((a, b) => b.timeSpent - a.timeSpent);
    
    return {
      timeMetrics,
      dailyUsage: dailyUsages,
      siteUsage: siteUsageArray,
    };
  }

  private static getDomainDisplayName(domain: string): string {
    const nameMap: Record<string, string> = {
      'youtube.com': 'YouTube',
      'github.com': 'GitHub',
      'stackoverflow.com': 'Stack Overflow',
      'figma.com': 'Figma',
      'notion.so': 'Notion',
      'twitter.com': 'Twitter',
      'facebook.com': 'Facebook',
      'instagram.com': 'Instagram',
      'linkedin.com': 'LinkedIn'
    };
    return nameMap[domain] || domain.replace(/^www\./, '');
  }

  private static getDomainIcon(domain: string): string {
    const iconMap: Record<string, string> = {
      'youtube.com': 'ri-youtube-line',
      'github.com': 'ri-github-line',
      'stackoverflow.com': 'ri-stack-overflow-line',
      'figma.com': 'ri-file-text-line',
      'notion.so': 'ri-file-list-line',
      'twitter.com': 'ri-twitter-line',
      'facebook.com': 'ri-facebook-line',
      'instagram.com': 'ri-instagram-line',
      'linkedin.com': 'ri-linkedin-box-line'
    };
    return iconMap[domain] || 'ri-global-line';
  }

  private static getDomainColor(domain: string): string {
    const colorMap: Record<string, string> = {
      'youtube.com': 'rgba(251,191,114,1)',
      'github.com': 'rgba(141,211,199,1)',
      'stackoverflow.com': 'rgba(252,141,98,1)',
      'figma.com': 'rgba(87,181,231,1)',
      'notion.so': '#E5E7EB',
      'twitter.com': '#1DA1F2',
      'facebook.com': '#4267B2',
      'instagram.com': '#E4405F',
      'linkedin.com': '#0A66C2'
    };
    return colorMap[domain] || '#6B7280';
  }

  static async syncBlockedSitesFromWebApp(sites: string[]): Promise<{ success: boolean; synced?: number; failed?: number; error?: string }> {
    try {
      const response = await this.sendMessage({ 
        type: 'SYNC_BLOCKED_SITES_FROM_WEBAPP', 
        payload: { sites } 
      });
      return response;
    } catch (error) {
      console.error('Failed to sync blocked sites from web app:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  static async updateExtensionSettings(settings: { blockedSites: string[]; userId?: string; userName?: string }): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await this.sendMessage({ 
        type: 'UPDATE_SETTINGS_FROM_WEBAPP', 
        payload: settings 
      });
      return response;
    } catch (error) {
      console.error('Failed to update extension settings:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  static async forceSyncFromWebApp(): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await this.sendMessage({ 
        type: 'FORCE_SYNC_FROM_WEBAPP'
      });
      return response;
    } catch (error) {
      console.error('Failed to force sync from web app:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  static resetCircuitBreaker(): void {
    // Only allow manual reset if circuit breaker is actually open or has failures
    const status = this.circuitBreaker.getStatus();
    if (status.state === 'OPEN' || status.failureCount > 0) {
      this.circuitBreaker.reset();
    }
  }

  static getCircuitBreakerStatus() {
    return this.circuitBreaker.getStatus();
  }

  // Simplified connection test - doesn't auto-reset circuit breaker
  static async testConnection(): Promise<boolean> {
    try {
      const response = await this.sendMessage({ type: 'GET_TODAY_STATS' });
      return response && response.success !== false;
    } catch (error) {
      return false;
    }
  }

  // Deep Focus session data retrieval methods
  static async getDeepFocusSessionsForDateRange(startDate: string, endDate: string): Promise<ExtensionResponse<any[]>> {
    return await this.sendMessage({
      type: 'GET_DEEP_FOCUS_SESSIONS_DATE_RANGE',
      payload: { startDate, endDate }
    });
  }

  static async getTodayDeepFocusSessions(): Promise<ExtensionResponse<any[]>> {
    return await this.sendMessage({
      type: 'GET_TODAY_DEEP_FOCUS_SESSIONS'
    });
  }

  static async getActiveDeepFocusSession(): Promise<ExtensionResponse<any | null>> {
    return await this.sendMessage({
      type: 'GET_ACTIVE_DEEP_FOCUS_SESSION'
    });
  }

  static async getAllDeepFocusSessions(): Promise<ExtensionResponse<any[]>> {
    return await this.sendMessage({
      type: 'GET_ALL_DEEP_FOCUS_SESSIONS'
    });
  }

  static async getRecent7DaysDeepFocusSessions(): Promise<ExtensionResponse<any[]>> {
    return await this.sendMessage({
      type: 'GET_RECENT_7_DAYS_DEEP_FOCUS_SESSIONS'
    });
  }

  static async getLast10DeepFocusSessions(): Promise<ExtensionResponse<any[]>> {
    return await this.sendMessage({
      type: 'GET_LAST_10_DEEP_FOCUS_SESSIONS'
    });
  }

  static resetCircuitBreaker(): void {
    console.log('🔄 Manually resetting extension circuit breaker...');
    this.circuitBreaker.reset();
  }

  static getCircuitBreakerStatus(): { state: string; failureCount: number; timeUntilRetry: number } {
    return this.circuitBreaker.getStatus();
  }

  /**
   * Ultra-fast extension check for instant UI feedback
   * Returns true if extension is available, false otherwise
   */
  static async quickExtensionCheck(): Promise<boolean> {
    try {
      console.log('⚡ Quick extension check - very short timeout');
      
      // If circuit breaker is open, try to bypass for quick checks only
      if (this.circuitBreaker.isOpen()) {
        console.log('⚡ Circuit breaker open, attempting bypass for quick check');
        // For rapid toggles, bypass circuit breaker and try direct connection
        try {
          const response = await this.sendMessageViaContentScript({ type: 'PING' }, 300);
          const isAvailable = response && response.success !== false;
          if (isAvailable) {
            // If successful, reset circuit breaker since extension is actually working
            this.circuitBreaker.onSuccess();
            console.log('⚡ Quick check succeeded, circuit breaker reset');
          }
          return isAvailable;
        } catch (bypassError) {
          console.log('⚡ Bypass attempt failed, extension truly unavailable');
          return false;
        }
      }
      
      // Check for recent debounce errors for PING messages specifically
      const lastPingTime = this.lastCallTimes.get('PING') || 0;
      const now = Date.now();
      
      // If we just sent a PING recently, assume extension is available to avoid debounce errors
      if (now - lastPingTime < this.CRITICAL_DEBOUNCE_MS) {
        console.log('⚡ Recent PING detected, assuming extension available to avoid debounce');
        return true;
      }
      
      // Single very fast test with minimal timeout
      const response = await this.sendMessage({ type: 'PING' }, 300); // 300ms only
      const isAvailable = response && response.success !== false;
      console.log('⚡ Quick check result:', isAvailable);
      
      return isAvailable;
    } catch (error) {
      // Don't fail on debounce errors for quick checks
      if (error.message.includes('debounced')) {
        console.log('⚡ Quick check hit debounce, assuming extension available');
        return true;
      }
      console.log('⚡ Quick check failed (expected for no extension):', error.message);
      return false;
    }
  }
}

export default ExtensionDataService; 