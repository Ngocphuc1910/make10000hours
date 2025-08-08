export interface UTCFeatureFlags {
  utcDataStorage: boolean;
  utcDashboard: boolean;
  utcTimerIntegration: boolean;
  utcExtensionSync: boolean;
  utcMigrationTools: boolean;
  utcCalendarSync: boolean;
  transitionMode: 'disabled' | 'dual' | 'utc-only';
  rolloutPercentage: number;
}

export class UTCFeatureFlagService {
  private static instance: UTCFeatureFlagService;
  private flags: UTCFeatureFlags;
  private rolloutGroups = new Map<string, boolean>();
  
  constructor() {
    this.flags = this.getDefaultFlags();
    this.loadRemoteFlags();
  }
  
  static getInstance(): UTCFeatureFlagService {
    if (!UTCFeatureFlagService.instance) {
      UTCFeatureFlagService.instance = new UTCFeatureFlagService();
    }
    return UTCFeatureFlagService.instance;
  }
  
  private getDefaultFlags(): UTCFeatureFlags {
    return {
      utcDataStorage: true,           // ✅ Enable UTC storage
      utcDashboard: true,             // ✅ Enable UTC dashboard  
      utcTimerIntegration: true,      // ✅ Enable UTC timer
      utcExtensionSync: true,         // ✅ Enable extension sync
      utcMigrationTools: true,        // ✅ Enable migration tools
      utcCalendarSync: true,          // ✅ Enable calendar sync
      transitionMode: 'dual',         // ✅ Enable dual mode (both UTC + Legacy)
      rolloutPercentage: 100          // ✅ Enable for all users
    };
  }
  
  private async loadRemoteFlags(): Promise<void> {
    try {
      const storedFlags = localStorage.getItem('utc-feature-flags');
      if (storedFlags) {
        const parsed = JSON.parse(storedFlags);
        this.flags = { ...this.flags, ...parsed };
      }
      
      if (process.env.REACT_APP_UTC_ROLLOUT_PERCENTAGE) {
        this.flags.rolloutPercentage = parseInt(process.env.REACT_APP_UTC_ROLLOUT_PERCENTAGE);
      }
      
    } catch (error) {
      console.error('Failed to load UTC feature flags:', error);
    }
  }
  
  isUserInRollout(userId: string): boolean {
    if (this.rolloutGroups.has(userId)) {
      return this.rolloutGroups.get(userId)!;
    }
    
    const hash = this.hashUserId(userId);
    const isInRollout = hash < this.flags.rolloutPercentage;
    
    this.rolloutGroups.set(userId, isInRollout);
    return isInRollout;
  }
  
  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash) % 100;
  }
  
  isFeatureEnabled(feature: keyof Omit<UTCFeatureFlags, 'transitionMode' | 'rolloutPercentage'>, userId?: string): boolean {
    if (this.isEmergencyDisabled()) {
      return false;
    }
    
    if (!this.flags[feature]) {
      return false;
    }
    
    if (userId && !this.isUserInRollout(userId)) {
      return false;
    }
    
    return true;
  }
  
  getTransitionMode(userId?: string): 'disabled' | 'dual' | 'utc-only' {
    console.log('🔍 DEBUG getTransitionMode:', {
      userId: userId?.slice(0, 8) + '...',
      isEmergencyDisabled: this.isEmergencyDisabled(),
      rolloutPercentage: this.flags.rolloutPercentage,
      transitionMode: this.flags.transitionMode,
      allFlags: this.flags
    });
    
    if (this.isEmergencyDisabled()) {
      console.log('❌ Emergency disabled, returning disabled');
      return 'disabled';
    }
    
    // Skip rollout check if rollout percentage is 100% (all users enabled)
    if (userId && this.flags.rolloutPercentage < 100 && !this.isUserInRollout(userId)) {
      console.log('❌ User not in rollout, returning disabled');
      return 'disabled';
    }
    
    console.log('✅ Returning transition mode:', this.flags.transitionMode);
    return this.flags.transitionMode;
  }
  
  private isEmergencyDisabled(): boolean {
    // TEMPORARY FIX: Force disable emergency check for development
    const isDevelopment = process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost';
    if (isDevelopment) {
      console.log('🔧 DEV MODE: Bypassing emergency disable check');
      return false; // Always return false in development
    }
    
    return localStorage.getItem('utc-emergency-disable') === 'true';
  }
  
  emergencyDisable(): void {
    localStorage.setItem('utc-emergency-disable', 'true');
    console.warn('🚨 UTC features emergency disabled');
    
    // Broadcast to all tabs
    localStorage.setItem('timezone_emergency_disable', Date.now().toString());
    
    // Check if we're in a reload loop by counting recent disables
    const recentDisables = sessionStorage.getItem('utc-emergency-disable-count') || '0';
    const count = parseInt(recentDisables) + 1;
    sessionStorage.setItem('utc-emergency-disable-count', count.toString());
    
    // If we've disabled multiple times recently, don't reload to prevent infinite loops
    if (count >= 3) {
      console.error('🛑 EMERGENCY DISABLE LOOP DETECTED - Preventing automatic reload');
      console.error('🔧 Manual intervention required: Run resetUTCMonitoring() in console');
      
      // Show user-visible error
      const errorDiv = document.createElement('div');
      errorDiv.style.cssText = `
        position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
        background: #ff4444; color: white; padding: 15px 20px; border-radius: 8px;
        z-index: 10000; font-family: monospace; font-size: 14px; max-width: 500px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      `;
      errorDiv.innerHTML = `
        <div><strong>🚨 UTC System Error Loop Detected</strong></div>
        <div style="margin-top: 8px; font-size: 12px;">
          Work session creation temporarily disabled.<br>
          Open console and run: <code style="background: rgba(255,255,255,0.2); padding: 2px 4px; border-radius: 3px;">resetUTCMonitoring()</code>
        </div>
      `;
      document.body.appendChild(errorDiv);
      
      // Auto-remove error message after 15 seconds
      setTimeout(() => {
        if (errorDiv.parentNode) {
          errorDiv.parentNode.removeChild(errorDiv);
        }
      }, 15000);
      
      return; // Don't reload
    }
    
    // Check if we've already tried to reload recently
    const lastReloadTime = sessionStorage.getItem('utc-emergency-reload');
    const now = Date.now();
    
    if (!lastReloadTime || (now - parseInt(lastReloadTime)) > 30000) { // 30 second cooldown
      sessionStorage.setItem('utc-emergency-reload', now.toString());
      console.log('🔄 Reloading page due to UTC emergency disable...');
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } else {
      console.warn('⏸ Skipping reload to prevent infinite loop - UTC features disabled');
    }
  }
  
  emergencyEnable(): void {
    localStorage.removeItem('utc-emergency-disable');
    sessionStorage.removeItem('utc-emergency-disable-count');
    sessionStorage.removeItem('utc-emergency-reload');
    console.log('✅ UTC features emergency re-enabled and loop counters cleared');
  }
  
  /**
   * Reset emergency disable loop counters and state
   * Used when manually fixing the underlying issues
   */
  resetEmergencyState(): void {
    localStorage.removeItem('utc-emergency-disable');
    localStorage.removeItem('timezone_emergency_disable');
    sessionStorage.removeItem('utc-emergency-disable-count');
    sessionStorage.removeItem('utc-emergency-reload');
    sessionStorage.removeItem('monitoring-emergency-disable');
    console.log('🔄 Emergency disable state completely reset');
  }
  
  updateFlags(newFlags: Partial<UTCFeatureFlags>): void {
    this.flags = { ...this.flags, ...newFlags };
    localStorage.setItem('utc-feature-flags', JSON.stringify(this.flags));
  }
  
  getFlags(): UTCFeatureFlags {
    return { ...this.flags };
  }
}

export const utcFeatureFlags = UTCFeatureFlagService.getInstance();

// Hook for React components
export const useUTCFeatureFlag = (feature: keyof Omit<UTCFeatureFlags, 'transitionMode' | 'rolloutPercentage'>, userId?: string) => {
  return utcFeatureFlags.isFeatureEnabled(feature, userId);
};

export const useUTCTransitionMode = (userId?: string) => {
  return utcFeatureFlags.getTransitionMode(userId);
};

// Simple feature flag for multi-day task support
export const isMultiDayEnabled = (): boolean => {
  // Enable multi-day task support globally
  // This could be made configurable via feature flags in the future
  return true;
};
