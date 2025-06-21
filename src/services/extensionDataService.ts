// Chrome Extension types

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

class ExtensionDataService {
  // Extension ID will be dynamically detected or set
  private static extensionId: string | null = null;

  static isExtensionInstalled(): boolean {
    // Re-enabled for testing - check if Chrome extension API is available
    console.log('🔄 ExtensionDataService: Checking Chrome extension API availability');
    const isAvailable = typeof (window as any).chrome !== 'undefined' && 
           !!(window as any).chrome.runtime;
    console.log('🔄 Chrome extension API available:', isAvailable);
    return isAvailable;
    
    // Original implementation (commented out):
    // return typeof (window as any).chrome !== 'undefined' && 
    //        !!(window as any).chrome.runtime;
  }

  // Alternative method: Use window postMessage to communicate with content script
  static async sendMessageViaContentScript(message: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const messageId = Math.random().toString(36);
      const timeoutId = setTimeout(() => {
        window.removeEventListener('message', responseHandler);
        reject(new Error('Content script communication timeout'));
      }, 5000);

      const responseHandler = (event: MessageEvent) => {
        if (event.data?.extensionResponseId === messageId) {
          clearTimeout(timeoutId);
          window.removeEventListener('message', responseHandler);
          resolve(event.data.response);
        }
      };

      window.addEventListener('message', responseHandler);
      
      // Send message to content script
      window.postMessage({
        type: 'EXTENSION_REQUEST',
        messageId,
        payload: message
      }, '*');
    });
  }

  static async sendMessage(message: any): Promise<any> {
    if (!this.isExtensionInstalled()) {
      throw new Error('Extension not installed');
    }
    
    try {
      // Method 1: Try via content script (most reliable for externally_connectable)
      try {
        const response = await this.sendMessageViaContentScript(message);
        if (response && response.success !== false) {
          return response;
        }
      } catch (error) {
        console.log('Content script method failed, trying direct methods...');
      }

      // Method 2: Try sending without extension ID (for injected content scripts)
      try {
        const response = await (window as any).chrome.runtime.sendMessage(message);
        if (response && response.success !== false) {
          return response;
        }
      } catch (error) {
        console.log('Direct message failed, trying extension ID methods...');
      }

             // Method 3: Try with known extension ID patterns
      const possibleIds = await this.detectExtensionIds();
      for (const id of possibleIds) {
        try {
          const response = await (window as any).chrome.runtime.sendMessage(id, message);
          if (response && response.success !== false) {
            this.extensionId = id; // Cache successful ID
            console.log('Extension connected with ID:', id);
            return response;
          }
        } catch (error) {
          continue; // Try next ID
        }
      }

      throw new Error('Could not establish connection with Focus Time Tracker extension');
    } catch (error) {
      console.error('Extension communication failed:', error);
      throw error;
    }
  }

  // Try to detect extension IDs
  static async detectExtensionIds(): Promise<string[]> {
    const ids: string[] = [];
    
    // Method 1: Try to query extension management (if available)
    try {
      if ((window as any).chrome?.management) {
        const extensions = await (window as any).chrome.management.getAll();
        const focusExtension = extensions.find((ext: any) => 
          ext.name.includes('Focus') || ext.name.includes('Tracker')
        );
        if (focusExtension) {
          ids.push(focusExtension.id);
        }
      }
    } catch (error) {
      // Management API might not be available
    }

    // Method 2: Try common development extension ID patterns
    // Chrome generates predictable IDs for unpacked extensions
    ids.push(
      'kbfnbcaeplbcioakkpcpgfkobkghlhen', // Common dev pattern
      'fmkadmapgofadopljbjfkapdkoienihi', // Another common pattern
      'lmhkpmbekcpmknklioeibfkpmmfibljd'  // Yet another pattern
    );

    return ids;
  }

  static setExtensionId(id: string) {
    this.extensionId = id;
  }

  // Test connection method
  static async testConnection(): Promise<boolean> {
    try {
      console.log('🔍 Testing extension connection...');
      
      // Method 1: Try postMessage approach (most reliable for web pages)
      const isPostMessageAvailable = await this.testPostMessageConnection();
      if (isPostMessageAvailable) {
        console.log('✅ Extension connected via postMessage');
        return true;
      }
      
      // Method 2: Try direct chrome.runtime approach
      const response = await this.sendMessage({ type: 'GET_TODAY_STATS' });
      const isConnected = response && response.success !== false;
      console.log('🔗 Extension connection test result:', isConnected);
      return isConnected;
    } catch (error) {
      console.log('❌ Extension connection test failed:', error);
      return false;
    }
  }

  // Test postMessage connection
  static async testPostMessageConnection(): Promise<boolean> {
    return new Promise((resolve) => {
      const messageId = Math.random().toString(36);
      let resolved = false;
      
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          window.removeEventListener('message', responseHandler);
          resolve(false);
        }
      }, 2000);

      const responseHandler = (event: MessageEvent) => {
        if (event.data?.type === 'EXTENSION_PONG' && event.data?.messageId === messageId && !resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          window.removeEventListener('message', responseHandler);
          resolve(true);
        }
      };

      window.addEventListener('message', responseHandler);
      
      // Send ping message
      window.postMessage({
        type: 'EXTENSION_PING',
        messageId,
        source: 'make10000hours-webapp'
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
}

export default ExtensionDataService; 