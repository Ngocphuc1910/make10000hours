import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DeepFocusData, SiteUsage, BlockedSite } from '../types/deepFocus';
import { DeepFocusSession } from '../types/models';
import ExtensionDataService from '../services/extensionDataService';
import { deepFocusSessionService } from '../api/deepFocusSessionService';
import { siteUsageService } from '../api/siteUsageService';
import HybridDataService from '../api/hybridDataService';
import { overrideSessionService, OverrideSession } from '../api/overrideSessionService';

// Mock data with exact colors from AI design
const mockSiteUsage: SiteUsage[] = [
  {
    id: '1',
    name: 'YouTube',
    url: 'youtube.com',
    icon: 'ri-youtube-line',
    backgroundColor: 'rgba(251,191,114,1)',
    timeSpent: 449, // 7h 29m 28s
    sessions: 31,
    percentage: 58
  },
  {
    id: '2',
    name: 'make10000hours.com',
    url: 'make10000hours.com',
    icon: 'ri-global-line',
    backgroundColor: 'rgba(87,181,231,1)',
    timeSpent: 85, // 1h 24m 55s
    sessions: 187,
    percentage: 11
  },
  {
    id: '3',
    name: 'stockchart.vietstock.vn',
    url: 'stockchart.vietstock.vn',
    icon: 'ri-bar-chart-line',
    backgroundColor: 'rgba(141,211,199,1)',
    timeSpent: 51, // 51m 11s
    sessions: 56,
    percentage: 6
  },
  {
    id: '4',
    name: 'Figma',
    url: 'figma.com',
    icon: 'ri-file-text-line',
    backgroundColor: 'rgba(252,141,98,1)',
    timeSpent: 48, // 48m 13s
    sessions: 83,
    percentage: 6
  },
  {
    id: '5',
    name: 'Notion',
    url: 'notion.com',
    icon: 'ri-file-list-line',
    backgroundColor: '#E5E7EB',
    timeSpent: 38, // 38m 33s
    sessions: 69,
    percentage: 3
  },
  {
    id: '6',
    name: 'Facebook Messenger',
    url: 'messenger.com',
    icon: 'ri-messenger-line',
    backgroundColor: '#3B82F6',
    timeSpent: 17, // 17m 39s
    sessions: 29,
    percentage: 2
  },
  {
    id: '7',
    name: 'localhost',
    url: 'localhost',
    icon: 'ri-server-line',
    backgroundColor: '#6B7280',
    timeSpent: 14, // 14m 22s
    sessions: 79,
    percentage: 1
  },
  {
    id: '8',
    name: 'social.zalopay.vn',
    url: 'social.zalopay.vn',
    icon: 'ri-global-line',
    backgroundColor: '#3B82F6',
    timeSpent: 11, // 11m 47s
    sessions: 61,
    percentage: 1
  },
  {
    id: '9',
    name: 'bitzit.app',
    url: 'bitzit.app',
    icon: 'ri-code-line',
    backgroundColor: '#3B82F6',
    timeSpent: 18, // 18m 39s
    sessions: 14,
    percentage: 1
  }
];

const mockBlockedSites: BlockedSite[] = [
  {
    id: '1',
    name: 'Instagram',
    url: 'instagram.com',
    icon: 'ri-instagram-line',
    backgroundColor: '#E4405F',
    isActive: true
  },
  {
    id: '2',
    name: 'LinkedIn',
    url: 'linkedin.com',
    icon: 'ri-linkedin-box-line',
    backgroundColor: '#0A66C2',
    isActive: true
  }
];

interface DeepFocusStore extends DeepFocusData {
  isExtensionConnected: boolean;
  isDeepFocusActive: boolean;
  currentSessionId: string | null;
  deepFocusSessions: DeepFocusSession[];
  totalSessionsCount: number;
  totalFocusTime: number; // in minutes
  unsubscribe: (() => void) | null;
  toggleBlockedSite: (id: string) => void;
  removeBlockedSite: (id: string) => void;
  addBlockedSite: (site: Omit<BlockedSite, 'id'>) => void;
  loadExtensionData: () => Promise<void>;
  blockSiteInExtension: (domain: string) => Promise<void>;
  unblockSiteInExtension: (domain: string) => Promise<void>;
  enableDeepFocus: () => Promise<void>;
  disableDeepFocus: () => Promise<void>;
  toggleDeepFocus: () => Promise<void>;
  loadFocusStatus: () => Promise<void>;
  syncFocusStatus: (isActive: boolean) => void;
  initializeFocusSync: () => Promise<void>;
  syncWithExtension: (isActive: boolean) => Promise<void>;
  loadDeepFocusSessions: (userId: string, startDate?: Date, endDate?: Date) => Promise<void>;
  subscribeToSessions: (userId: string) => void;
  unsubscribeFromSessions: () => void;
  activeSessionId: string | null;
  activeSessionStartTime: Date | null;
  activeSessionDuration: number;
  activeSessionElapsedSeconds: number;
  timer: NodeJS.Timeout | null;
  secondTimer: NodeJS.Timeout | null;
  // Site usage backup methods
  backupTodayData: () => Promise<void>;
  performDailyBackup: () => Promise<void>;
  initializeDailyBackup: () => void;
  restoreFromBackup: (date: string) => Promise<void>;
  getBackupStatus: () => Promise<{ lastSyncDate: string | null; totalDays: number }>;
  // Hybrid data fetching for date ranges
  loadHybridTimeRangeData: (startDate: string, endDate: string) => Promise<any>;
  // Internal sync state
  isBackingUp: boolean;
  lastBackupTime: Date | null;
  backupError: string | null;
  // Activity detection and auto-session management
  isSessionPaused: boolean;
  pausedAt: Date | null;
  totalPausedTime: number; // in seconds
  autoSessionManagement: boolean;
  pauseSessionOnInactivity: (inactivityDuration: number) => Promise<void>;
  resumeSessionOnActivity: () => Promise<void>;
  setAutoSessionManagement: (enabled: boolean) => void;
  // Override sessions
  overrideSessions: OverrideSession[];
  recordOverrideSession: (domain: string, duration: number) => Promise<void>;
  loadOverrideSessions: (userId: string, startDate?: Date, endDate?: Date) => Promise<void>;
}

export const useDeepFocusStore = create<DeepFocusStore>()(
  persist(
    (set, get) => ({
  timeMetrics: {
    onScreenTime: 770, // 12h 50m
    workingTime: 770,
    deepFocusTime: 770,
    overrideTime: 770
  },
  dailyUsage: [
    { date: '12/05', onScreenTime: 120, workingTime: 100, deepFocusTime: 80 },
    { date: '13/05', onScreenTime: 160, workingTime: 140, deepFocusTime: 120 },
    { date: '14/05', onScreenTime: 190, workingTime: 170, deepFocusTime: 150 },
    { date: '15/05', onScreenTime: 120, workingTime: 100, deepFocusTime: 80 },
    { date: '16/05', onScreenTime: 110, workingTime: 90, deepFocusTime: 70 },
    { date: '17/05', onScreenTime: 150, workingTime: 130, deepFocusTime: 110 },
    { date: '18/05', onScreenTime: 170, workingTime: 150, deepFocusTime: 130 }
  ],
  siteUsage: mockSiteUsage,
  blockedSites: mockBlockedSites,
  isExtensionConnected: false,
  isDeepFocusActive: false,
  currentSessionId: null,
  deepFocusSessions: [],
  totalSessionsCount: 0,
  totalFocusTime: 0,
  unsubscribe: null,
  activeSessionId: null,
  activeSessionStartTime: null,
  activeSessionDuration: 0,
  activeSessionElapsedSeconds: 0,
  timer: null,
  secondTimer: null,
  // Backup state
  isBackingUp: false,
  lastBackupTime: null,
  backupError: null,
  
  // Activity detection and auto-session management state
  isSessionPaused: false,
  pausedAt: null,
  totalPausedTime: 0,
  autoSessionManagement: true,
  
  // Override sessions state
  overrideSessions: [], // enabled by default

  loadExtensionData: async () => {
    try {
      if (!ExtensionDataService.isExtensionInstalled()) {
        set({ isExtensionConnected: false });
        return;
      }

      // Circuit breaker will handle connection testing
      const extensionResponse = await ExtensionDataService.getTodayStats();
      
      if (extensionResponse.success === false) {
        throw new Error(extensionResponse.error || 'Extension returned error');
      }

      const extensionData = extensionResponse.data || extensionResponse;
      const mappedData = ExtensionDataService.mapExtensionDataToWebApp(extensionData as any);
      
      set({
        timeMetrics: mappedData.timeMetrics,
        siteUsage: mappedData.siteUsage,
        isExtensionConnected: true
      });
    } catch (error) {
      // Circuit breaker handles error logging
      set({ isExtensionConnected: false });
    }
  },

  blockSiteInExtension: async (domain: string) => {
    try {
      if (ExtensionDataService.isExtensionInstalled()) {
        await ExtensionDataService.blockSite(domain);
      }
    } catch (error) {
      console.error('Failed to block site in extension:', error);
    }
  },

  unblockSiteInExtension: async (domain: string) => {
    try {
      if (ExtensionDataService.isExtensionInstalled()) {
        await ExtensionDataService.unblockSite(domain);
      }
    } catch (error) {
      console.error('Failed to unblock site in extension:', error);
    }
  },

  toggleBlockedSite: (id) =>
    set((state) => ({
      blockedSites: state.blockedSites.map((site) =>
        site.id === id ? { ...site, isActive: !site.isActive } : site
      )
    })),

  removeBlockedSite: (id) =>
    set((state) => ({
      blockedSites: state.blockedSites.filter((site) => site.id !== id)
    })),

  addBlockedSite: (site) =>
    set((state) => ({
      blockedSites: [
        ...state.blockedSites,
        { ...site, id: Date.now().toString() + Math.random().toString(36).substr(2, 9) }
      ]
    })),

  loadFocusStatus: async () => {
    try {
      if (!ExtensionDataService.isExtensionInstalled()) {
        return;
      }

      const isConnected = await ExtensionDataService.testConnection();
      if (!isConnected) {
        return;
      }

      const focusStatus = await ExtensionDataService.getFocusStatus();
      const currentLocalState = get().isDeepFocusActive;
      
      // Handle active session recovery/restart on page reload
      if (currentLocalState && !get().activeSessionId) {
        try {
          const { useUserStore } = await import('./userStore');
          const user = useUserStore.getState().user;
          if (user?.uid) {
            // First, clean up any orphaned sessions (sessions that were never properly ended)
            console.log('🧹 Cleaning up any orphaned sessions...');
            const cleanedCount = await deepFocusSessionService.cleanupOrphanedSessions(user.uid);
            
            if (cleanedCount > 0) {
              console.log(`✅ Cleaned up ${cleanedCount} orphaned session(s)`);
            }
            
            // Now start a fresh new session
            console.log('🆕 Starting fresh session after page reload...');
            const newSessionId = await deepFocusSessionService.startSession(user.uid);
            const startTime = new Date();
            
            set({ 
              activeSessionId: newSessionId, 
              activeSessionStartTime: startTime, 
              activeSessionDuration: 0,
              activeSessionElapsedSeconds: 0
            });
            
            // Start timers for new session
            const secondTimer = setInterval(() => {
              const elapsed = Math.floor((Date.now() - startTime.getTime()) / 1000);
              set({ activeSessionElapsedSeconds: elapsed });
            }, 1000);
            
            const timer = setInterval(async () => {
              const duration = Math.floor((Date.now() - startTime.getTime()) / 60000);
              set({ activeSessionDuration: duration });
              if (newSessionId) {
                await deepFocusSessionService.updateSessionDuration(newSessionId, duration);
                console.log('⏱️ Deep Focus: Updated session duration:', duration, 'minutes (incremental tracking)');
              }
            }, 60000);
            
            set({ timer, secondTimer });
            
            console.log('✅ Started fresh deep focus session:', newSessionId);
          }
        } catch (error) {
          console.error('❌ Failed to handle session recovery/restart:', error);
        }
      }
      
      // Only update local state if extension state differs AND we don't have a persisted state
      // This prevents overriding user's persisted preference
      if (focusStatus.focusMode !== currentLocalState) {
        // Check if this is the first load (no persisted state) or if extension was manually changed
        const hasPersistedState = localStorage.getItem('deep-focus-storage');
        
        if (!hasPersistedState) {
          // No persisted state exists, use extension state
          set({ isDeepFocusActive: focusStatus.focusMode });
          
          // Sync focus status across all components
          window.dispatchEvent(new CustomEvent('deepFocusChanged', { 
            detail: { isActive: focusStatus.focusMode } 
          }));
        } else {
          // Persisted state exists, prioritize it and sync extension to match
          console.log('Prioritizing persisted local state over extension state');
          if (currentLocalState) {
            await ExtensionDataService.enableFocusMode();
          } else {
            await ExtensionDataService.disableFocusMode();
          }
        }
      }
    } catch (error) {
      console.error('Failed to load focus status:', error);
    }
  },

  // New method for initial sync that respects persisted state
  initializeFocusSync: async () => {
    try {
      console.log('🔄 Initializing focus sync...');
      
      if (!ExtensionDataService.isExtensionInstalled()) {
        console.log('📱 Extension not installed, skipping focus sync');
        return;
      }

      console.log('🔍 Testing extension connection...');
      const isConnected = await Promise.race([
        ExtensionDataService.testConnection(),
        new Promise<boolean>((resolve) => 
          setTimeout(() => resolve(false), 3000)
        )
      ]);
      
      if (!isConnected) {
        console.warn('⚠️ Extension not responding, skipping focus sync');
        return;
      }

      console.log('✅ Extension connected, checking focus status...');
      const extensionStatus = await Promise.race([
        ExtensionDataService.getFocusStatus(),
        new Promise<{ focusMode: boolean }>((_, reject) => 
          setTimeout(() => reject(new Error('Focus status timeout')), 3000)
        )
      ]);
      
      const currentLocalState = get().isDeepFocusActive;
      
      // Always prioritize persisted local state and sync extension to match
      if (extensionStatus.focusMode !== currentLocalState) {
        console.log(`🔄 Syncing extension focus mode to match local state: ${currentLocalState}`);
        try {
          if (currentLocalState) {
            await Promise.race([
              ExtensionDataService.enableFocusMode(),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Enable focus timeout')), 3000)
              )
            ]);
            
            // Update blocked sites in extension to match local state
            const blockedSites = get().blockedSites.filter(site => site.isActive);
            for (const site of blockedSites) {
              try {
                await Promise.race([
                  ExtensionDataService.blockSite(site.url),
                  new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Block site timeout')), 1000)
                  )
                ]);
              } catch (error) {
                console.warn('⚠️ Failed to block site during sync:', site.url, error);
              }
            }
          } else {
            await Promise.race([
              ExtensionDataService.disableFocusMode(),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Disable focus timeout')), 3000)
              )
            ]);
            
            // Unblock all sites in extension
            const blockedSites = get().blockedSites;
            for (const site of blockedSites) {
              try {
                await Promise.race([
                  ExtensionDataService.unblockSite(site.url),
                  new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Unblock site timeout')), 1000)
                  )
                ]);
              } catch (error) {
                console.warn('⚠️ Failed to unblock site during sync:', site.url, error);
              }
            }
          }
          console.log('✅ Extension focus mode synced successfully');
        } catch (error) {
          console.warn('⚠️ Failed to sync extension focus mode (continuing anyway):', error);
        }
      } else {
        console.log('✅ Extension and local focus states already match');
      }
      
      // Notify all subscribers about the current state
      window.dispatchEvent(new CustomEvent('deepFocusChanged', { 
        detail: { isActive: currentLocalState } 
      }));
      
      console.log('✅ Focus sync initialization completed');
    } catch (error) {
      console.warn('⚠️ Failed to initialize focus sync (continuing without extension):', error);
      // Don't throw - sync failure shouldn't break the app
    }
  },

  // Method to sync focus status without extension call (for internal state sync)
  syncFocusStatus: (isActive: boolean) => {
    set({ isDeepFocusActive: isActive });
  },

  enableDeepFocus: async () => {
    const state = get();
    console.log('🟢 enableDeepFocus called. Current state:', {
      isDeepFocusActive: state.isDeepFocusActive,
      extensionConnected: state.isExtensionConnected,
      activeSessionId: state.activeSessionId
    });
    
    try {
      // Start a new Deep Focus session if we have user data
      let sessionId: string | null = null;
      let startTime = new Date();
      try {
        const { useUserStore } = await import('./userStore');
        const user = useUserStore.getState().user;
        console.log('🔍 User state for session:', user ? { uid: user.uid, email: user.email } : 'No user');
        
        if (user?.uid) {
          console.log('📝 Starting Deep Focus session for user:', user.uid);
          sessionId = await deepFocusSessionService.startSession(user.uid);
          startTime = new Date();
          console.log('✅ Deep Focus session started:', sessionId);
          
          set({ activeSessionId: sessionId, activeSessionStartTime: startTime, activeSessionDuration: 0, activeSessionElapsedSeconds: 0 });
          
          // Start second timer for real-time display
          const secondTimer = setInterval(() => {
            const elapsedSeconds = Math.floor((Date.now() - startTime.getTime()) / 1000);
            set({ activeSessionElapsedSeconds: elapsedSeconds });
          }, 1000);
          
          // Start minute timer for database updates
          const timer = setInterval(async () => {
            const duration = Math.floor((Date.now() - startTime.getTime()) / 60000);
            set({ activeSessionDuration: duration });
            if (sessionId) {
              await deepFocusSessionService.updateSessionDuration(sessionId, duration);
              console.log('⏱️ Deep Focus: Updated session duration:', duration, 'minutes (incremental tracking)');
            }
          }, 60000);
          
          set({ timer, secondTimer });
        } else {
          console.warn('⚠️ No user found, skipping session creation');
        }
      } catch (error) {
        console.error('❌ Failed to start Deep Focus session:', error);
      }

      // Update local state first (this makes the UI responsive)
      const updatedSites = state.blockedSites.map(site => ({ ...site, isActive: true }));
      set({ 
        isDeepFocusActive: true,
        currentSessionId: sessionId,
        blockedSites: updatedSites
      });

      // Try to enable focus mode in extension (but don't block the UI if it fails)
      if (ExtensionDataService.isExtensionInstalled()) {
        console.log('📡 Attempting to enable focus mode in extension...');
        try {
          // Add timeout to prevent hanging
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Extension communication timeout')), 3000)
          );
          
          await Promise.race([
            ExtensionDataService.enableFocusMode(),
            timeoutPromise
          ]);
          console.log('✅ Extension focus mode enabled');
          
          // Try to block sites in extension
          for (const site of updatedSites) {
            try {
              await Promise.race([
                state.blockSiteInExtension(site.url),
                new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('Block site timeout')), 1000)
                )
              ]);
              console.log('🚫 Blocked site in extension:', site.url);
            } catch (error) {
              console.warn('⚠️ Failed to block site in extension (continuing anyway):', site.url, error);
            }
          }
        } catch (error) {
          console.warn('⚠️ Extension communication failed (Deep Focus still enabled locally):', error);
        }
      } else {
        console.log('⚠️ Extension not installed, Deep Focus enabled in web app only');
      }

      // Notify all subscribers that focus mode is now active
      window.dispatchEvent(new CustomEvent('deepFocusChanged', { 
        detail: { isActive: true } 
      }));

      // Try to sync with extension (but don't wait for it)
      get().syncWithExtension(true).catch(error => {
        console.warn('⚠️ Extension sync failed (continuing anyway):', error);
      });

      console.log('✅ Deep Focus enabled successfully - all sites are now blocked', sessionId ? `Session ID: ${sessionId}` : '');
    } catch (error) {
      console.error('❌ Failed to enable Deep Focus:', error);
      console.error('🔍 Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : 'No stack trace'
      });
      throw error;
    }
  },

  disableDeepFocus: async () => {
    const state = get();
    console.log('🔴 disableDeepFocus called. Current state:', {
      isDeepFocusActive: state.isDeepFocusActive,
      extensionConnected: state.isExtensionConnected,
      activeSessionId: state.activeSessionId
    });
    
    try {
      // End the current Deep Focus session if active
      if (state.activeSessionId) {
        try {
          await deepFocusSessionService.endSession(state.activeSessionId);
          console.log('✅ Deep Focus session ended:', state.activeSessionId);
        } catch (error) {
          console.error('❌ Failed to end Deep Focus session:', error);
        }
      }

      // Clear timers
      if (state.timer) {
        clearInterval(state.timer);
      }
      if (state.secondTimer) {
        clearInterval(state.secondTimer);
      }
      set({ timer: null, secondTimer: null });

      // Update local state first (this makes the UI responsive)
      const updatedSites = state.blockedSites.map(site => ({ ...site, isActive: false }));
      set({ 
        isDeepFocusActive: false,
        currentSessionId: null,
        blockedSites: updatedSites,
        activeSessionId: null,
        activeSessionStartTime: null,
        activeSessionDuration: 0,
        activeSessionElapsedSeconds: 0,
        // Reset pause state
        isSessionPaused: false,
        pausedAt: null,
        totalPausedTime: 0
      });

      // Try to disable focus mode in extension (but don't block the UI if it fails)
      if (ExtensionDataService.isExtensionInstalled()) {
        console.log('📡 Attempting to disable focus mode in extension...');
        try {
          // Add timeout to prevent hanging
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Extension communication timeout')), 3000)
          );
          
          await Promise.race([
            ExtensionDataService.disableFocusMode(),
            timeoutPromise
          ]);
          console.log('✅ Extension focus mode disabled');

          // Try to unblock sites in extension
          for (const site of updatedSites) {
            try {
              await Promise.race([
                state.unblockSiteInExtension(site.url),
                new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('Unblock site timeout')), 1000)
                )
              ]);
              console.log('✅ Unblocked site in extension:', site.url);
            } catch (error) {
              console.warn('⚠️ Failed to unblock site in extension (continuing anyway):', site.url, error);
            }
          }
        } catch (error) {
          console.warn('⚠️ Extension communication failed (Deep Focus still disabled locally):', error);
        }
      } else {
        console.log('⚠️ Extension not installed, Deep Focus disabled in web app only');
      }

      // Notify all subscribers that focus mode is now inactive
      window.dispatchEvent(new CustomEvent('deepFocusChanged', { 
        detail: { isActive: false } 
      }));

      // Try to sync with extension (but don't wait for it)
      get().syncWithExtension(false).catch(error => {
        console.warn('⚠️ Extension sync failed (continuing anyway):', error);
      });

      console.log('✅ Deep Focus disabled successfully - all sites are now unblocked');
    } catch (error) {
      console.error('❌ Failed to disable Deep Focus:', error);
      console.error('🔍 Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : 'No stack trace'
      });
      throw error;
    }
  },

  toggleDeepFocus: async () => {
    const state = get();
    
    if (state.isDeepFocusActive) {
      await state.disableDeepFocus();
    } else {
      await state.enableDeepFocus();
    }
  },

  // Sync focus state with extension
  syncWithExtension: async (isActive: boolean) => {
    try {
      if (!ExtensionDataService.isExtensionInstalled()) {
        return;
      }
      
      // Use specific enable/disable messages for clearer intent
      if (isActive) {
        await ExtensionDataService.enableFocusMode();
      } else {
        await ExtensionDataService.disableFocusMode();
      }
    } catch (error) {
      console.error('Failed to sync with extension:', error);
    }
  },

  loadDeepFocusSessions: async (userId: string, startDate?: Date, endDate?: Date) => {
    try {
      console.log('🔍 DeepFocusStore: Loading sessions for userId:', userId);
      console.log('🔍 DeepFocusStore: Date filters:', { startDate, endDate });
      const sessions = await deepFocusSessionService.getUserSessions(userId, startDate, endDate);
      console.log('📊 DeepFocusStore: Loaded sessions:', sessions.length, 'sessions');
      console.log('📊 DeepFocusStore: Session details:', sessions.map(s => ({
        id: s.id,
        status: s.status,
        duration: s.duration,
        createdAt: s.createdAt,
        userId: s.userId
      })));
      const completedCount = sessions.filter(s => s.status === 'completed').length;
      const completedWithDuration = sessions.filter(s => s.status === 'completed' && s.duration);
      const totalTime = completedWithDuration.reduce((total, s) => total + (s.duration || 0), 0);
      console.log('📊 DeepFocusStore: Completed sessions count:', completedCount);
      console.log('📊 DeepFocusStore: Completed with duration:', completedWithDuration.length);
      console.log('📊 DeepFocusStore: Total time:', totalTime, 'minutes');
      set({ 
        deepFocusSessions: sessions,
        totalSessionsCount: completedCount,
        totalFocusTime: totalTime
      });
    } catch (error) {
      console.error('❌ Failed to load Deep Focus sessions:', error);
    }
  },

  subscribeToSessions: (userId: string) => {
    console.log('DeepFocusStore: Subscribing to sessions for userId:', userId);
    const unsubscribe = deepFocusSessionService.subscribeToUserSessions(userId, (sessions) => {
      console.log('DeepFocusStore: Subscription received sessions:', sessions);
      const completedCount = sessions.filter(s => s.status === 'completed').length;
      const totalTime = sessions
        .filter(s => s.status === 'completed' && s.duration)
        .reduce((total, s) => total + (s.duration || 0), 0);
      console.log('DeepFocusStore: Subscription completed count:', completedCount, 'Total time:', totalTime);
      set({ 
        deepFocusSessions: sessions,
        totalSessionsCount: completedCount,
        totalFocusTime: totalTime
      });
    });
    
    // Store unsubscribe function for cleanup
    set({ unsubscribe });
  },

      unsubscribeFromSessions: () => {
      const state = get();
      if (state.unsubscribe) {
        state.unsubscribe();
        set({ unsubscribe: null });
      }
    },

    // Activity detection and auto-session management methods
    pauseSessionOnInactivity: async (inactivityDuration: number) => {
      const state = get();
      
      // Only pause if deep focus is active, not already paused, and auto-management is enabled
      if (!state.isDeepFocusActive || state.isSessionPaused || !state.autoSessionManagement) {
        return;
      }

      console.log('🛑 Pausing deep focus session due to inactivity:', inactivityDuration, 'seconds');
      
      try {
        // Pause the timers but don't end the session
        if (state.timer) {
          clearInterval(state.timer);
        }
        if (state.secondTimer) {
          clearInterval(state.secondTimer);
        }

        // Mark session as paused
        set({
          isSessionPaused: true,
          pausedAt: new Date(),
          timer: null,
          secondTimer: null
        });

        console.log('✅ Deep focus session paused due to inactivity');
      } catch (error) {
        console.error('❌ Failed to pause deep focus session:', error);
      }
    },

    resumeSessionOnActivity: async () => {
      const state = get();
      
      // Only resume if deep focus is active, currently paused, and auto-management is enabled
      if (!state.isDeepFocusActive || !state.isSessionPaused || !state.autoSessionManagement) {
        return;
      }

      console.log('▶️ Resuming deep focus session after activity detected');
      
      try {
        // Calculate total paused time
        const pausedDuration = state.pausedAt 
          ? Math.floor((Date.now() - state.pausedAt.getTime()) / 1000)
          : 0;

        // Add to total paused time
        const newTotalPausedTime = state.totalPausedTime + pausedDuration;

        // Resume timers if we have an active session
        let timer: NodeJS.Timeout | null = null;
        let secondTimer: NodeJS.Timeout | null = null;

        if (state.activeSessionId && state.activeSessionStartTime) {
          // Resume second timer for real-time display
          secondTimer = setInterval(() => {
            const elapsed = Math.floor((Date.now() - state.activeSessionStartTime!.getTime()) / 1000) - get().totalPausedTime;
            set({ activeSessionElapsedSeconds: Math.max(0, elapsed) });
          }, 1000);
          
          // Resume minute timer for database updates
          timer = setInterval(async () => {
            const totalElapsed = Math.floor((Date.now() - state.activeSessionStartTime!.getTime()) / 60000);
            const activeDuration = Math.max(0, totalElapsed - Math.floor(get().totalPausedTime / 60));
            set({ activeSessionDuration: activeDuration });
            await deepFocusSessionService.updateSessionDuration(state.activeSessionId!, activeDuration);
          }, 60000);
        }

        // Mark session as resumed
        set({
          isSessionPaused: false,
          pausedAt: null,
          totalPausedTime: newTotalPausedTime,
          timer,
          secondTimer
        });

        console.log('✅ Deep focus session resumed, total paused time:', newTotalPausedTime, 'seconds');
      } catch (error) {
        console.error('❌ Failed to resume deep focus session:', error);
      }
    },

    setAutoSessionManagement: (enabled: boolean) => {
      set({ autoSessionManagement: enabled });
      console.log('🔧 Auto session management:', enabled ? 'enabled' : 'disabled');
    },

    // Site usage backup methods
    backupTodayData: async () => {
      const state = get();
      if (state.isBackingUp) return; // Prevent concurrent backups
      
      try {
        set({ isBackingUp: true, backupError: null });
        console.log('🔄 Starting backup of today\'s data...');
        
        const { useUserStore } = await import('./userStore');
        const user = useUserStore.getState().user;
        
        // Authentication guard - prevent backup if user not authenticated
        if (!user?.uid) {
          console.warn('⚠️ User not authenticated, skipping backup');
          return;
        }

        // Get today's data from extension with timeout
        if (!ExtensionDataService.isExtensionInstalled()) {
          console.log('📱 Extension not available, skipping backup');
          return;
        }

        console.log('📡 Getting today\'s stats from extension...');
        const extensionResponse = await Promise.race([
          ExtensionDataService.getTodayStats(),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Extension backup timeout')), 5000)
          )
        ]);
        
        if (extensionResponse.success === false) {
          throw new Error(extensionResponse.error || 'Failed to get extension data');
        }

        const today = new Date().toISOString().split('T')[0];
        console.log('💾 Saving backup data to Firebase...');
        await siteUsageService.backupDayData(user.uid, today, extensionResponse.data || extensionResponse);
        
        set({ lastBackupTime: new Date() });
        console.log('✅ Successfully backed up today\'s data');
      } catch (error) {
        console.error('❌ Failed to backup today\'s data:', error);
        set({ backupError: error instanceof Error ? error.message : 'Backup failed' });
      } finally {
        set({ isBackingUp: false });
      }
    },

    performDailyBackup: async () => {
      const state = get();
      if (state.isBackingUp) return; // Prevent concurrent backups
      
      try {
        set({ isBackingUp: true, backupError: null });
        console.log('🔄 Starting daily backup...');
        
        const { useUserStore } = await import('./userStore');
        const user = useUserStore.getState().user;
        
        // Authentication guard - prevent backup if user not authenticated
        if (!user?.uid) {
          console.warn('⚠️ User not authenticated, skipping daily backup');
          return;
        }
        
        // First backup today's data
        await get().backupTodayData();
        
        // Also clean up old data (keep last 90 days)
        await siteUsageService.cleanupOldData(user.uid, 90);
        
        set({ lastBackupTime: new Date() });
        console.log('✅ Successfully performed daily backup');
      } catch (error) {
        console.error('❌ Failed to perform daily backup:', error);
        set({ backupError: error instanceof Error ? error.message : 'Daily backup failed' });
      } finally {
        set({ isBackingUp: false });
      }
    },

    initializeDailyBackup: () => {
      // Run backup every 4 hours
      setInterval(() => {
        get().backupTodayData();
      }, 4 * 60 * 60 * 1000);

      // Run full daily backup at 2 AM
      const scheduleNextDailyBackup = () => {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(2, 0, 0, 0); // 2 AM tomorrow
        
        const msUntilTomorrow = tomorrow.getTime() - now.getTime();
        
        setTimeout(() => {
          get().performDailyBackup();
          // Schedule the next one
          setInterval(() => {
            get().performDailyBackup();
          }, 24 * 60 * 60 * 1000); // Every 24 hours
        }, msUntilTomorrow);
      };

      scheduleNextDailyBackup();

      // Initial backup on app start (but wait a bit for extension to be ready)
      setTimeout(() => {
        get().backupTodayData();
      }, 5000);
    },

    restoreFromBackup: async (date: string) => {
      try {
        const { useUserStore } = await import('./userStore');
        const user = useUserStore.getState().user;
        if (!user?.uid) {
          throw new Error('User not authenticated');
        }

        const restoredData = await siteUsageService.restoreToExtension(user.uid, date);
        console.log(`✅ Restored data for ${date}:`, restoredData);
        
        // Could also update local state here if needed
        return restoredData;
      } catch (error) {
        console.error(`❌ Failed to restore data for ${date}:`, error);
        throw error;
      }
    },

    getBackupStatus: async () => {
      try {
        const { useUserStore } = await import('./userStore');
        const user = useUserStore.getState().user;
        if (!user?.uid) {
          return { lastSyncDate: null, totalDays: 0 };
        }

        return await siteUsageService.getLastSyncInfo(user.uid);
      } catch (error) {
        console.error('❌ Failed to get backup status:', error);
        return { lastSyncDate: null, totalDays: 0 };
      }
    },

    // Hybrid data fetching for date ranges (Firebase + Extension)
    loadHybridTimeRangeData: async (startDate: string, endDate: string) => {
      try {
        const { useUserStore } = await import('./userStore');
        const user = useUserStore.getState().user;
        
        // Authentication guard - prevent sync if user not authenticated
        if (!user?.uid) {
          console.warn('⚠️ User not authenticated - skipping hybrid data load');
          throw new Error('User not authenticated');
        }

        console.log('🔄 Loading hybrid data for range:', { startDate, endDate, userId: user.uid });
        
        const response = await HybridDataService.getTimeRangeData(user.uid, startDate, endDate);
        
        if (!response.success) {
          throw new Error('Failed to fetch hybrid data');
        }

        // Convert aggregated data to web app format
        const webAppData = HybridDataService.convertToWebAppFormat({
          totalTime: response.aggregated.totalTime,
          sitesVisited: response.aggregated.sitesVisited,
          productivityScore: response.aggregated.avgProductivityScore,
          sites: response.aggregated.sites
        });

        console.log('✅ Hybrid data loaded successfully:', {
          dateRange: response.aggregated.dateRange,
          totalSites: Object.keys(response.aggregated.sites).length,
          totalTime: Math.round(response.aggregated.totalTime / (1000 * 60)), // minutes
        });

        return {
          timeMetrics: webAppData.timeMetrics,
          siteUsage: webAppData.siteUsage,
          productivityScore: webAppData.productivityScore,
          aggregated: response.aggregated,
          dailyData: response.data
        };
      } catch (error) {
        console.error('❌ Failed to load hybrid time range data:', error);
        throw error;
      }
    },

    // Override session methods
    recordOverrideSession: async (domain: string, duration: number) => {
      try {
        const { useUserStore } = await import('./userStore');
        const user = useUserStore.getState().user;
        const state = get();
        
        // Authentication guard - prevent Firebase operation if user not authenticated
        if (!user?.uid) {
          console.warn('⚠️ User not authenticated - skipping override session recording');
          return;
        }
        
        console.log('🎯 Recording override session:', { domain, duration, userId: user.uid });
        
        // Create temporary local override session for immediate UI update
        const tempOverride = {
          id: `temp-${Date.now()}`,
          userId: user.uid,
          domain,
          duration,
          deepFocusSessionId: state.activeSessionId || undefined,
          createdAt: new Date()
        };
        
        // Add to local state immediately
        set(state => ({
          overrideSessions: [tempOverride, ...state.overrideSessions]
        }));
        
        try {
          // Try to save to Firebase
          const docId = await overrideSessionService.createOverrideSession({
            userId: user.uid,
            domain,
            duration,
            deepFocusSessionId: state.activeSessionId || undefined
          });
          
          console.log('✅ Override session saved to Firebase:', docId);
          
          // Replace temp with real data
          set(state => ({
            overrideSessions: state.overrideSessions.map(session => 
              session.id === tempOverride.id 
                ? { ...session, id: docId }
                : session
            )
          }));
          
        } catch (firebaseError) {
          console.warn('⚠️ Firebase save failed, keeping local override:', firebaseError);
          // Keep the temporary override in local state
        }
      } catch (error) {
        console.error('Failed to record override session:', error);
      }
    },

    loadOverrideSessions: async (userId: string, startDate?: Date, endDate?: Date) => {
      try {
        // Authentication guard - ensure userId is provided
        if (!userId) {
          console.warn('⚠️ No userId provided - skipping override sessions load');
          set({ overrideSessions: [] });
          return;
        }
        
        const overrides = await overrideSessionService.getUserOverrides(userId, startDate, endDate);
        set({ overrideSessions: overrides });
        console.log('✅ Loaded override sessions:', overrides.length);
      } catch (error) {
        console.warn('Could not load override sessions (this is normal if index is still building):', error);
        // Set empty array instead of leaving it undefined
        set({ overrideSessions: [] });
      }
    }
}),
{
  name: 'deep-focus-storage',
  partialize: (state) => ({
    isDeepFocusActive: state.isDeepFocusActive,
    blockedSites: state.blockedSites,
    autoSessionManagement: state.autoSessionManagement
  })
}
)
); 