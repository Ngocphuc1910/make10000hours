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
    if (this.isEmergencyDisabled()) {
      return 'disabled';
    }
    
    if (userId && !this.isUserInRollout(userId)) {
      return 'disabled';
    }
    
    return this.flags.transitionMode;
  }
  
  private isEmergencyDisabled(): boolean {
    return localStorage.getItem('utc-emergency-disable') === 'true';
  }
  
  emergencyDisable(): void {
    localStorage.setItem('utc-emergency-disable', 'true');
    console.warn('UTC features emergency disabled');
    
    // Broadcast to all tabs
    localStorage.setItem('timezone_emergency_disable', Date.now().toString());
    
    setTimeout(() => {
      window.location.reload();
    }, 100);
  }
  
  emergencyEnable(): void {
    localStorage.removeItem('utc-emergency-disable');
    console.log('UTC features emergency re-enabled');
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