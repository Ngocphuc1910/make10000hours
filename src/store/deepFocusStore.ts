import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DeepFocusData, SiteUsage, BlockedSite, ComparisonMetrics, ComparisonData } from '../types/deepFocus';
import { DeepFocusSession, Source } from '../types/models';
import ExtensionDataService from '../services/extensionDataService';
import { deepFocusSessionService } from '../api/deepFocusSessionService';
import { siteUsageService } from '../api/siteUsageService';
import HybridDataService from '../api/hybridDataService';
import { overrideSessionService, OverrideSession } from '../api/overrideSessionService';
import { blockedSitesService } from '../api/blockedSitesService';
import { useUserStore } from './userStore';
import { calculateComparisonDateRange, formatComparisonResult, calculatePercentageChange } from '../utils/comparisonUtils';
import { formatLocalDate } from '../utils/timeUtils';

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
  toggleBlockedSite: (id: string) => Promise<void>;
  removeBlockedSite: (id: string) => Promise<void>;
  addBlockedSite: (site: Omit<BlockedSite, 'id'>) => Promise<void>;
  loadBlockedSites: (userId: string) => Promise<void>;
  loadExtensionData: () => Promise<void>;
  loadAllTimeExtensionData: () => Promise<void>;
  loadAllTimeDailyUsage: () => Promise<void>;
  blockSiteInExtension: (domain: string) => Promise<void>;
  unblockSiteInExtension: (domain: string) => Promise<void>;
  enableDeepFocus: (source?: Source) => Promise<void>;
  disableDeepFocus: () => Promise<void>;
  toggleDeepFocus: () => Promise<void>;
  loadFocusStatus: () => Promise<void>;
  syncFocusStatus: (isActive: boolean) => void;
  syncCompleteFocusState: (isActive: boolean, blockedSites: string[]) => Promise<void>;
  initializeFocusSync: () => Promise<void>;
  syncBlockedSitesToExtension: () => Promise<void>;
  handleExtensionBlockedSitesUpdate: (sites: string[]) => Promise<void>;
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
  // Manual retry method for users
  retryBackup: () => Promise<void>;
  // Get current sync status including circuit breaker info
  getSyncStatus: () => {
    isBackingUp: boolean;
    lastBackupTime: Date | null;
    backupError: string | null;
    circuitBreaker: { state: string };
    canRetry: boolean;
  };
  // new flag
  hasRecoveredSession: boolean;
  recoveryInProgress: boolean;
  isReloading: boolean;
  setReloading: (isReloading: boolean) => void;
  // Comparison data
  comparisonData: ComparisonData | null;
  isLoadingComparison: boolean;
  comparisonError: string | null;
  loadComparisonData: (selectedRange: any) => Promise<void>;
  loadWorkSessionsForComparison: (userId: string, startDate: Date, endDate: Date) => Promise<number>;
  loadDeepFocusSessionsForComparison: (userId: string, startDate: Date, endDate: Date) => Promise<number>;
}

// Helper function to get user-specific storage key
// Cached storage key to prevent store re-initialization
let cachedStorageKey = 'deep-focus-storage-anonymous';
let lastKnownUserId: string | null = null;

// Extension call deduplication
let inFlightExtensionCalls = new Set<string>();
const deduplicateExtensionCall = async (callId: string, fn: () => Promise<void>) => {
  if (inFlightExtensionCalls.has(callId)) {
    return; // Skip duplicate call
  }
  inFlightExtensionCalls.add(callId);
  try {
    await fn();
  } finally {
    inFlightExtensionCalls.delete(callId);
  }
};

const getUserSpecificStorageKey = () => {
  try {
    const userStorage = localStorage.getItem('user-store');
    if (userStorage) {
      const parsed = JSON.parse(userStorage);
      const userId = parsed?.state?.user?.uid;
      
      // Only update cache if user actually changed and we haven't set it yet
      if (userId && userId !== lastKnownUserId && cachedStorageKey === 'deep-focus-storage-anonymous') {
        lastKnownUserId = userId;
        cachedStorageKey = `deep-focus-storage-${userId}`;
        console.log('🔑 Storage key updated for user:', userId);
      }
    }
  } catch (error) {
    console.warn('Failed to get user ID for deep focus storage:', error);
  }
  return cachedStorageKey;
};

// Helper function to clear storage when user changes
const clearPreviousUserStorage = () => {
  // Get all localStorage keys that match our pattern
  const keys = Object.keys(localStorage);
  const deepFocusKeys = keys.filter(key => 
    key.startsWith('deep-focus-storage-') && 
    key !== cachedStorageKey
  );
  
  // Clear old user storage but keep current user's data
  deepFocusKeys.forEach(key => {
    if (!key.includes('anonymous')) { // Keep anonymous as fallback
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.warn('Failed to clear old deep focus storage:', error);
      }
    }
  });
};

// Helper function to create timers
const createTimers = (set: any, get: any, sessionId: string, startTime: Date) => {
  console.log('🕒 Creating new timers for session:', sessionId);
  
  // Clear any existing timers first
  const state = get();
  if (state.timer) {
    console.log('⚠️ Clearing existing timer');
    clearInterval(state.timer);
  }
  if (state.secondTimer) {
    console.log('⚠️ Clearing existing second timer');
    clearInterval(state.secondTimer);
  }

  // Create new timers
  const secondTimer = setInterval(() => {
    const elapsedSeconds = Math.floor((Date.now() - startTime.getTime()) / 1000);
    set({ activeSessionElapsedSeconds: elapsedSeconds });
  }, 1000);

  const timer = setInterval(async () => {
    console.log('⏱️ Timer tick for session:', sessionId);
    const currentDuration = get().activeSessionDuration + 1;
    set({ activeSessionDuration: currentDuration });
    if (sessionId) {
      await deepFocusSessionService.incrementSessionDuration(sessionId, 1);
      console.log('⏱️ Deep Focus: +1 minute added to session', sessionId);
    }
  }, 60000);

  set({ timer, secondTimer });
  console.log('✅ New timers created for session:', sessionId);
};

// Add window message listener for extension communication
if (typeof window !== 'undefined') {
  window.addEventListener('message', (event) => {
    if (event.data?.type === 'EXTENSION_BLOCKED_SITES_UPDATED') {
      console.log('📨 Web app received blocked sites update from extension');
      
      // Get the store instance and call the handler
      const store = useDeepFocusStore.getState();
      if (store.handleExtensionBlockedSitesUpdate) {
        store.handleExtensionBlockedSitesUpdate(event.data.payload.sites).catch(error => {
          console.error('❌ Failed to handle extension blocked sites update:', error);
        });
      }
    }
  });
}

export const useDeepFocusStore = create<DeepFocusStore>()(
  persist(
    (set, get) => ({
      timeMetrics: {
        onScreenTime: 0,
        workingTime: 0,
        deepFocusTime: 0,
        overrideTime: 0
      },
      dailyUsage: [],
      siteUsage: [],
      blockedSites: [],
      isExtensionConnected: false,
      isDeepFocusActive: false,
      currentSessionId: null,
      deepFocusSessions: [],
      totalSessionsCount: 0,
      totalFocusTime: 0,
      unsubscribe: null,
      hasRecoveredSession: false,
      recoveryInProgress: false,
      activeSessionId: null,
      activeSessionStartTime: null,
      activeSessionDuration: 0,
      activeSessionElapsedSeconds: 0,
      timer: null,
      secondTimer: null,
      isBackingUp: false,
      lastBackupTime: null,
      backupError: null,
      isSessionPaused: false,
      pausedAt: null,
      totalPausedTime: 0,
      autoSessionManagement: true,
      overrideSessions: [],
      isReloading: false,
      // Comparison data
      comparisonData: null,
      isLoadingComparison: false,
      comparisonError: null,

      setReloading: (isReloading: boolean) => set({ isReloading }),

      loadExtensionData: async () => {
        try {
          if (!ExtensionDataService.isExtensionInstalled()) {
            set({ isExtensionConnected: false });
            return;
          }

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

          // Also load historical daily usage data
          await get().loadAllTimeDailyUsage();
        } catch (error) {
          console.error('Extension data loading failed:', error);
          set({ isExtensionConnected: false });
        }
      },

      loadAllTimeExtensionData: async () => {
        try {
          if (!ExtensionDataService.isExtensionInstalled()) {
            set({ isExtensionConnected: false });
            return;
          }
          const user = useUserStore.getState().user;
          if (!user?.uid) {
            console.warn('⚠️ User not authenticated - skipping all time extension data load');
            set({ isExtensionConnected: false });
            return;
          }

          const dailySiteUsage = await siteUsageService.getAllTimeDailyUsage(user.uid);
          
          const mappedData = ExtensionDataService.mapArrSiteUsage(dailySiteUsage);

          console.log('khanhnq6', mappedData);
          
          set({
            timeMetrics: mappedData.timeMetrics,
            siteUsage: mappedData.siteUsage,
            dailyUsage: mappedData.dailyUsage,
            isExtensionConnected: true
          });
        } catch (error) {
          console.error('Extension data all time loading failed:', error);
          set({ isExtensionConnected: false });
        }
      },


      loadAllTimeDailyUsage: async () => {
        try {
          const { useUserStore } = await import('./userStore');
          const user = useUserStore.getState().user;
          
          if (!user?.uid) {
            console.warn('⚠️ User not authenticated - skipping daily usage load');
            return;
          }

          // Load last 30 days of data for "All time" view
          const endDate = new Date();
          const startDate = new Date(endDate);
          startDate.setDate(endDate.getDate() - 30);

          const response = await get().loadHybridTimeRangeData(
            startDate.toISOString().split('T')[0],
            endDate.toISOString().split('T')[0]
          );

          console.log('🔍 Hybrid response structure:', {
            hasData: !!response.data,
            dataKeys: response.data ? Object.keys(response.data).length : 0,
            hasAggregated: !!response.aggregated,
            sampleDate: response.data ? Object.keys(response.data)[0] : null
          });

          if (response.data && Object.keys(response.data).length > 0) {
            // Convert data object to DailyUsage array format
            const dailyUsage = Object.entries(response.data).map(([date, dayData]: [string, any]) => ({
              date,
              onScreenTime: Math.round(dayData.totalTime / (1000 * 60)), // Convert to minutes
              workingTime: Math.round(dayData.totalTime / (1000 * 60) * 0.6), // Estimated
              deepFocusTime: 0 // Will be filled from sessions
            })).sort((a, b) => a.date.localeCompare(b.date)); // Sort by date

            set({ dailyUsage });
            console.log('✅ Loaded daily usage data for all time:', dailyUsage.length, 'days');
          }
        } catch (error) {
          console.error('❌ Failed to load all time daily usage:', error);
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

      toggleBlockedSite: async (id) => {
        const { useUserStore } = await import('./userStore');
        const user = useUserStore.getState().user;
        if (user?.uid) {
          await blockedSitesService.toggleBlockedSite(user.uid, id);
          await get().loadBlockedSites(user.uid);
          
          // Comprehensive sync is handled by loadBlockedSites, no need for individual sync
          console.log('🔄 Blocked site toggled and synced via loadBlockedSites');
        }
      },

      removeBlockedSite: async (id) => {
        const { useUserStore } = await import('./userStore');
        const user = useUserStore.getState().user;
        if (user?.uid) {
          await blockedSitesService.removeBlockedSite(user.uid, id);
          await get().loadBlockedSites(user.uid);
          
          // Comprehensive sync is handled by loadBlockedSites, no need for individual sync
          console.log('🔄 Blocked site removed and synced via loadBlockedSites');
        }
      },

      addBlockedSite: async (site) => {
        const { useUserStore } = await import('./userStore');
        const user = useUserStore.getState().user;
        
        if (user?.uid) {
          try {
            await blockedSitesService.addBlockedSite(user.uid, site);
            await get().loadBlockedSites(user.uid);
            
            // Comprehensive sync is handled by loadBlockedSites, no need for individual sync
            console.log('🔄 Blocked site added and synced via loadBlockedSites');
          } catch (error) {
            console.error('Error in addBlockedSite:', error);
          }
        } else {
          console.error('No user logged in, cannot add blocked site');
        }
      },

      loadBlockedSites: async (userId: string) => {
        try {
          const sites = await blockedSitesService.getUserBlockedSites(userId);
          set({ blockedSites: sites });
          
          // Always sync to extension if installed (regardless of focus mode state)
          if (ExtensionDataService.isExtensionInstalled()) {
            try {
              // First force clear extension to remove any default sites
              await ExtensionDataService.forceSyncFromWebApp();
              console.log('✅ Cleared default sites from extension');
              
              // Then sync current sites
              const allSiteUrls = sites.map(site => site.url);
              await ExtensionDataService.syncBlockedSitesFromWebApp(allSiteUrls);
              console.log('🔄 Synced all blocking sites to extension:', allSiteUrls.length);
            } catch (error) {
              console.warn('⚠️ Failed to sync blocking sites to extension:', error);
            }
          }
        } catch (error) {
          console.error('Failed to load blocked sites:', error);
        }
      },

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
          
          // DISABLED: Aggressive session recovery logic that was creating sessions at wrong times
          // This was causing sessions to be created during page load instead of user toggle
          // Instead, only clean up orphaned sessions on load without creating new ones
          if (currentLocalState && !get().activeSessionId && !get().recoveryInProgress) {
            set({recoveryInProgress: true});
            try {
              const { useUserStore } = await import('./userStore');
              const user = useUserStore.getState().user;
              if (user?.uid) {
                // Only clean up orphaned sessions, don't create new ones
                console.log('🧹 Cleaning up any orphaned sessions on page load...');
                const cleaned = await deepFocusSessionService.cleanupOrphanedSessions(user.uid);
                if (cleaned > 0) {
                  console.log(`✅ Cleaned up ${cleaned} orphaned session(s)`);
                  await get().loadDeepFocusSessions(user.uid);
                }
                
                // Reset state to inactive since no active session exists
                set({
                  isDeepFocusActive: false,
                  activeSessionId: null,
                  activeSessionStartTime: null,
                  activeSessionDuration: 0,
                  activeSessionElapsedSeconds: 0,
                  timer: null,
                  secondTimer: null,
                  recoveryInProgress: false
                });
                
                console.log('🔄 Reset deep focus state to inactive (no active session)');
              }
            } catch (error) {
              console.error('❌ Failed to handle session cleanup:', error);
              set({recoveryInProgress: false});
            }
          }
          
          // Only update local state if extension state differs AND we don't have a persisted state
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
        // Prevent concurrent initialization
        if (get().recoveryInProgress) {
          return;
        }
        
        set({ recoveryInProgress: true });
        
        try {
          const currentLocalState = get().isDeepFocusActive;
          
          // Check if extension is available
          if (!ExtensionDataService.isExtensionInstalled()) {
            console.log('📱 Extension not available, using local state only');
            set({ recoveryInProgress: false });
            return;
          }
          
          // Sync blocked sites to extension first
          await get().syncBlockedSitesToExtension();
          
          // Get extension focus status with timeout
          let extensionStatus: { focusMode: boolean };
          try {
            extensionStatus = await Promise.race([
              ExtensionDataService.getFocusStatus(),
              new Promise<{ focusMode: boolean }>((_, reject) => 
                setTimeout(() => reject(new Error('Extension status timeout')), 3000)
              )
            ]);
          } catch (error) {
            console.warn('⚠️ Failed to get extension focus status, using local state');
            set({ recoveryInProgress: false });
            return;
          }
          
          // Always prioritize persisted local state and sync extension to match
          if (extensionStatus.focusMode !== currentLocalState) {
            // Throttle this log message
            const lastLogKey = 'lastPriorityLog';
            const lastLogTime = sessionStorage.getItem(lastLogKey);
            const now = Date.now();
            
            if (!lastLogTime || now - parseInt(lastLogTime) > 10000) { // Log max once per 10 seconds
              console.log(`🔄 Prioritizing persisted local state over extension state`);
              sessionStorage.setItem(lastLogKey, now.toString());
            }
            
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
          
          console.log('✅ Focus sync completed');
        } catch (error) {
          console.error('❌ Focus sync failed:', error);
        } finally {
          set({ recoveryInProgress: false });
        }
      },

      syncBlockedSitesToExtension: async () => {
        try {
          if (!ExtensionDataService.isExtensionInstalled()) {
            console.log('📱 Extension not available, skipping sync');
            return;
          }

          const blockedSites = get().blockedSites;
          const siteUrls = blockedSites.map(site => site.url);
          
          console.log('🔄 Syncing blocked sites to extension:', siteUrls.length, siteUrls.length === 0 ? '(clearing all sites)' : 'sites');
          
          // Use the new sync method - this works for both adding sites and clearing all sites
          const result = await ExtensionDataService.syncBlockedSitesFromWebApp(siteUrls);
          
          if (result.success) {
            console.log(`✅ Successfully synced ${result.synced} sites to extension`);
            if (result.failed && result.failed > 0) {
              console.warn(`⚠️ ${result.failed} sites failed to sync`);
            }
            
            // Special logging for clearing all sites
            if (siteUrls.length === 0) {
              console.log('🧹 All blocked sites cleared from extension');
            }
          } else {
            console.warn('⚠️ Failed to sync blocked sites to extension:', result.error);
          }
        } catch (error) {
          console.error('❌ Error syncing blocked sites to extension:', error);
        }
      },

      handleExtensionBlockedSitesUpdate: async (sites: string[]) => {
        try {
          const { useUserStore } = await import('./userStore');
          const user = useUserStore.getState().user;
          if (!user?.uid) {
            console.warn('⚠️ User not authenticated - cannot sync extension sites to web app');
            return;
          }

          console.log('📨 Handling blocked sites update from extension:', sites.length);

          // Get current blocked sites from Firebase
          const currentSites = await blockedSitesService.getUserBlockedSites(user.uid);
          const currentUrls = currentSites.map(site => site.url);

          // Find sites to add and remove
          const sitesToAdd = sites.filter(url => !currentUrls.includes(url));
          const sitesToRemove = currentSites.filter(site => !sites.includes(site.url));

          // Add new sites from extension
          for (const url of sitesToAdd) {
            try {
              await blockedSitesService.addBlockedSite(user.uid, {
                name: url.replace(/^www\./, '').split('.')[0] || url,
                url: url,
                icon: 'ri-global-line',
                backgroundColor: '#6B7280',
                isActive: true
              });
              console.log('✅ Added site from extension:', url);
            } catch (error) {
              console.warn('⚠️ Failed to add site from extension:', url, error);
            }
          }

          // Remove sites that are no longer in extension
          for (const site of sitesToRemove) {
            try {
              await blockedSitesService.removeBlockedSite(user.uid, site.id);
              console.log('✅ Removed site synced from extension:', site.url);
            } catch (error) {
              console.warn('⚠️ Failed to remove site during extension sync:', site.url, error);
            }
          }

          // Reload blocked sites to refresh the UI (but don't sync back to extension to avoid loop)
          const updatedSites = await blockedSitesService.getUserBlockedSites(user.uid);
          set({ blockedSites: updatedSites });
          
          console.log('✅ Successfully synced blocked sites from extension to web app');
        } catch (error) {
          console.error('❌ Failed to handle extension blocked sites update:', error);
        }
      },

      // Method to sync focus status without extension call (for internal state sync)
      syncFocusStatus: (isActive: boolean) => {
        set({ isDeepFocusActive: isActive });
      },

      // Method to sync complete focus state including blocked sites
      syncCompleteFocusState: async (isActive: boolean, blockedSites: string[] = []) => {
        console.log('🔄 Syncing complete focus state:', { isActive, blockedSites: blockedSites.length });
        
        try {
          // Authentication guard - prevent sync if user not authenticated
          const { useUserStore } = await import('./userStore');
          const user = useUserStore.getState().user;
          if (!user?.uid) {
            console.warn('⚠️ User not authenticated - skipping focus state sync');
            return;
          }

          if (isActive) {
            // Enable focus mode
            const currentState = get();
            let sessionId = currentState.activeSessionId;
            let startTime = currentState.activeSessionStartTime || new Date();

            // Start a new session if we don't have one
            if (!sessionId) {
              try {
                sessionId = await deepFocusSessionService.startSession(user.uid);
                startTime = new Date();
                console.log('✅ New Deep Focus session started:', sessionId);
                
                set({ 
                  activeSessionId: sessionId, 
                  activeSessionStartTime: startTime, 
                  activeSessionDuration: 0, 
                  activeSessionElapsedSeconds: 0 
                });
                
                // Use the consolidated timer creation
                createTimers(set, get, sessionId, startTime);
              } catch (error) {
                console.error('❌ Failed to start Deep Focus session:', error);
              }
            }

            // Update local state with active sites
            const updatedSites = get().blockedSites.map(site => ({
              ...site,
              isActive: blockedSites.length > 0 ? blockedSites.includes(site.url) : true
            }));
            
            set({ 
              isDeepFocusActive: true,
              blockedSites: updatedSites
            });

            // Sync updated blocking sites list to Firebase
            try {
              await blockedSitesService.updateAllBlockedSites(user.uid, updatedSites);
              console.log('🔄 Synced blocking sites to Firebase:', updatedSites.length);
            } catch (error) {
              console.warn('⚠️ Failed to sync blocking sites to Firebase:', error);
            }

            // Use batch blocking for better performance and fewer API calls
            if (ExtensionDataService.isExtensionInstalled()) {
              const sitesToBlock = updatedSites.filter(site => site.isActive).map(site => site.url);
              
              if (sitesToBlock.length > 0) {
                try {
                  console.log(`📦 Batch blocking ${sitesToBlock.length} sites...`);
                  const batchResult = await ExtensionDataService.blockMultipleSites(sitesToBlock);
                  
                  if (batchResult.success && batchResult.summary) {
                    const { successCount, failureCount } = batchResult.summary;
                    console.log(`✅ Batch blocking completed: ${successCount} sites blocked, ${failureCount} failed`);
                    
                    if (failureCount > 0) {
                      console.warn(`⚠️ ${failureCount} sites failed to block, but continuing...`);
                    }
                  } else {
                    console.warn('⚠️ Batch blocking failed, falling back to individual blocking');
                    // Fallback to individual blocking with error tolerance
                    let successCount = 0;
                    let failureCount = 0;
                    
                    for (const site of sitesToBlock) {
                      try {
                        await Promise.race([
                          ExtensionDataService.blockSite(site),
                          new Promise((_, reject) => 
                            setTimeout(() => reject(new Error('Block site timeout')), 2000)
                          )
                        ]);
                        successCount++;
                      } catch (error) {
                        failureCount++;
                        if (failureCount <= 3) {
                          console.warn(`⚠️ Failed to block site during fallback: ${site}`, error);
                        }
                      }
                    }
                    
                    if (failureCount > 3) {
                      console.warn(`⚠️ ${failureCount} additional sites failed to block (suppressed logs)`);
                    }
                    
                    console.log(`✅ Fallback blocking completed: ${successCount} sites blocked, ${failureCount} failed`);
                  }
                } catch (error) {
                  console.warn('⚠️ Both batch and fallback blocking failed:', error);
                }
              }
            }

            console.log('✅ Focus state sync completed');
          } else {
            // Disable focus mode - end session and update local state
            const currentState = get();
            
            // CRITICAL: End the active session in Firebase before clearing state
            if (currentState.activeSessionId) {
              try {
                console.log('🛑 Ending active Deep Focus session:', currentState.activeSessionId);
                await deepFocusSessionService.endSession(currentState.activeSessionId);
                console.log('✅ Deep Focus session ended successfully');
                
                // Reload sessions to update the UI with completed session
                const { useUserStore } = await import('./userStore');
                const user = useUserStore.getState().user;
                if (user?.uid) {
                  await get().loadDeepFocusSessions(user.uid);
                }
              } catch (error) {
                console.error('❌ Failed to end Deep Focus session:', error);
                // Continue with state cleanup even if session ending fails
              }
            }
            
            // Clear any active timers
            if (currentState.timer) {
              clearInterval(currentState.timer);
            }
            if (currentState.secondTimer) {
              clearInterval(currentState.secondTimer);
            }
            
            // Update all state for disabled focus mode
            const updatedSites = get().blockedSites.map(site => ({ ...site, isActive: false }));
            set({ 
              isDeepFocusActive: false, // CRITICAL: Set this to false for proper UI sync
              blockedSites: updatedSites,
              activeSessionId: null,
              activeSessionStartTime: null,
              activeSessionDuration: 0,
              activeSessionElapsedSeconds: 0,
              isSessionPaused: false,
              pausedAt: null,
              totalPausedTime: 0,
              timer: null,
              secondTimer: null
            });
            
            // Sync disabled state to Firebase
            try {
              await blockedSitesService.updateAllBlockedSites(user.uid, updatedSites);
              console.log('🔄 Synced disabled blocking sites to Firebase');
            } catch (error) {
              console.warn('⚠️ Failed to sync disabled blocking sites to Firebase:', error);
            }
            
            console.log('✅ Focus state disabled - session ended and state cleared');
          }
        } catch (error) {
          console.error('❌ Failed to sync complete focus state:', error);
        }
      },

      enableDeepFocus: async (source: Source = 'extension') => {
        const state = get();
        
        // Authentication guard - prevent operation if user not authenticated
        const user = useUserStore.getState().user;
        if (!user?.uid) {
          console.warn('⚠️ User not authenticated - cannot enable deep focus');
          return;
        }
        
        // Comprehensive guards to prevent duplicate sessions
        if (state.isDeepFocusActive) {
          console.log('🟢 enableDeepFocus ignored – already active for user:', user.uid);
          return;
        }
        
        if (state.activeSessionId) {
          console.log('🟢 enableDeepFocus ignored – session already exists:', state.activeSessionId);
          return;
        }
        
        if (state.recoveryInProgress) {
          console.log('🟢 enableDeepFocus ignored – recovery in progress');
          return;
        }
        
        // Clean up any orphaned sessions before creating new one
        try {
          console.log('🧹 Cleaning up any orphaned sessions before creating new session...');
          const cleanedCount = await deepFocusSessionService.cleanupOrphanedSessions(user.uid);
          if (cleanedCount > 0) {
            console.log(`✅ Cleaned up ${cleanedCount} orphaned session(s)`);
          }
        } catch (error) {
          console.warn('⚠️ Failed to cleanup orphaned sessions (continuing anyway):', error);
        }
        
        console.log('🟢 enableDeepFocus called for user:', user.uid, 'Current state:', {
          isDeepFocusActive: state.isDeepFocusActive,
          extensionConnected: state.isExtensionConnected,
          activeSessionId: state.activeSessionId
        });
        
        try {
          // Start a new Deep Focus session if we have user data
          let sessionId: string | null = null;
          let startTime = new Date();
          try {
            const user = useUserStore.getState().user;
            console.log('🔍 User state for session:', user ? { uid: user.uid, email: user.email } : 'No user');
            
            if (user?.uid) {
              console.log('📝 Starting Deep Focus session for user:', user.uid);
              sessionId = await deepFocusSessionService.startSession(user.uid, source);
              startTime = new Date();
              console.log('✅ Deep Focus session started:', sessionId);
              
              set({ activeSessionId: sessionId, activeSessionStartTime: startTime, activeSessionDuration: 0, activeSessionElapsedSeconds: 0 });
              
              // Use the consolidated timer creation
              createTimers(set, get, sessionId, startTime);
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

          // Try to enable focus mode in extension
          if (ExtensionDataService.isExtensionInstalled()) {
            deduplicateExtensionCall('enable-focus', async () => {
              console.log('📡 Attempting to enable focus mode in extension...');
              try {
                await ExtensionDataService.enableFocusMode();
                console.log('✅ Extension focus mode enabled');
                
                // Use batch blocking instead of individual calls to prevent debouncing errors
                const activeSites = updatedSites.filter(site => site.isActive);
                const sitesToBlock = activeSites.map(site => site.url);
                
                if (sitesToBlock.length > 0) {
                  try {
                    console.log(`📦 Batch blocking ${sitesToBlock.length} sites during enable...`);
                    const batchResult = await ExtensionDataService.blockMultipleSites(sitesToBlock);
                    
                    if (batchResult.success && batchResult.summary) {
                      const { successCount, failureCount } = batchResult.summary;
                      console.log(`✅ Batch blocking during enable completed: ${successCount} sites blocked, ${failureCount} failed`);
                    } else {
                      console.warn('⚠️ Batch blocking during enable failed, continuing anyway');
                    }
                  } catch (error) {
                    console.warn('⚠️ Batch blocking during enable failed (continuing anyway):', error);
                  }
                }

                // Also send the WEB_APP_FOCUS_STATE_CHANGED message for redundant sync
                window.postMessage({
                  type: 'WEB_APP_FOCUS_STATE_CHANGED',
                  payload: {
                    focusMode: true,
                    timestamp: Date.now(),
                    source: 'web-app-store'
                  }
                }, '*');
                console.log('📡 Sent WEB_APP_FOCUS_STATE_CHANGED message for redundant sync');
              } catch (error) {
                console.warn('⚠️ Extension communication failed (Deep Focus still enabled locally):', error);
              }
            });
          } else {
            console.log('⚠️ Extension not installed, Deep Focus enabled in web app only');
          }

          // Notify all subscribers that focus mode is now active
          window.dispatchEvent(new CustomEvent('deepFocusChanged', { 
            detail: { isActive: true, fromExtension: false } 
          }));

          // Skip redundant extension sync to prevent feedback loops
          // Extension communication already handled above in deduplicateExtensionCall
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
        
        // Authentication guard - prevent operation if user not authenticated
        const user = useUserStore.getState().user;
        if (!user?.uid) {
          console.warn('⚠️ User not authenticated - cannot disable deep focus');
          return;
        }
        
        console.log('🔴 disableDeepFocus called for user:', user.uid, 'Current state:', {
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

          // Clear timers immediately to prevent memory leaks
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

          // Try to disable focus mode in extension
          if (ExtensionDataService.isExtensionInstalled()) {
            deduplicateExtensionCall('disable-focus', async () => {
              console.log('📡 Attempting to disable focus mode in extension...');
              try {
                await ExtensionDataService.disableFocusMode();
                console.log('✅ Extension focus mode disabled');

                // Unblock all sites at once
                for (const site of updatedSites) {
                  try {
                    await state.unblockSiteInExtension(site.url);
                  } catch (error) {
                    console.warn('⚠️ Failed to unblock site in extension (continuing anyway):', site.url, error);
                  }
                }

                // Also send the WEB_APP_FOCUS_STATE_CHANGED message for redundant sync
                window.postMessage({
                  type: 'WEB_APP_FOCUS_STATE_CHANGED',
                  payload: {
                    focusMode: false,
                    timestamp: Date.now(),
                    source: 'web-app-store'
                  }
                }, '*');
                console.log('📡 Sent WEB_APP_FOCUS_STATE_CHANGED message for redundant sync');
              } catch (error) {
                console.warn('⚠️ Extension communication failed (Deep Focus still disabled locally):', error);
              }
            });
          }

          // Notify all subscribers that focus mode is now inactive
          window.dispatchEvent(new CustomEvent('deepFocusChanged', { 
            detail: { isActive: false, fromExtension: false } 
          }));

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
              const currentDuration = get().activeSessionDuration + 1;
              set({ activeSessionDuration: currentDuration });
              if (state.activeSessionId) {
                await deepFocusSessionService.incrementSessionDuration(state.activeSessionId, 1);
                console.log('⏱️ Deep Focus: +1 minute added to session', state.activeSessionId);
              }
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

          // Get today's data from extension with timeout - no circuit breaker reset
          if (!ExtensionDataService.isExtensionInstalled()) {
            console.log('📱 Extension not available, using fallback backup mode');
            // Fallback: Create minimal backup entry to maintain sync schedule
            const today = new Date().toISOString().split('T')[0];
            const fallbackData = {
              totalTime: 0,
              sitesVisited: 0,
              productivityScore: 0,
              sites: {},
              version: '1.0.0',
              source: 'fallback'
            };
            
            await siteUsageService.backupDayData(user.uid, today, fallbackData);
            set({ 
              lastBackupTime: new Date(),
              backupError: 'Extension offline - using fallback mode'
            });
            console.log('✅ Fallback backup completed');
            return;
          }

          console.log('📡 Getting today\'s stats from extension...');
          const extensionResponse = await Promise.race([
            ExtensionDataService.getTodayStats(),
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('Extension backup timeout')), 15000)
            )
          ]);
          
          if (extensionResponse.success === false) {
            throw new Error(extensionResponse.error || 'Failed to get extension data');
          }

          const today = new Date().toISOString().split('T')[0];
          console.log('💾 Saving backup data to Firebase...');
          await siteUsageService.backupDayData(user.uid, today, extensionResponse.data || extensionResponse);
          
          set({ lastBackupTime: new Date(), backupError: null });
          console.log('✅ Successfully backed up today\'s data');
        } catch (error) {
          console.error('❌ Failed to backup today\'s data:', error);
          
          // If extension timeout, try fallback backup
          if (error instanceof Error && error.message.includes('timeout')) {
            console.log('🔄 Extension timeout detected, attempting fallback backup...');
            try {
              const { useUserStore } = await import('./userStore');
              const user = useUserStore.getState().user;
              
              if (user?.uid) {
                const today = new Date().toISOString().split('T')[0];
                const fallbackData = {
                  totalTime: 0,
                  sitesVisited: 0,
                  productivityScore: 0,
                  sites: {},
                  version: '1.0.0',
                  source: 'timeout-fallback'
                };
                
                await siteUsageService.backupDayData(user.uid, today, fallbackData);
                set({ 
                  lastBackupTime: new Date(),
                  backupError: 'Extension timeout - fallback backup used'
                });
                console.log('✅ Fallback backup after timeout completed');
                return;
              }
            } catch (fallbackError) {
              console.error('❌ Fallback backup also failed:', fallbackError);
            }
          }
          
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
        // Wait for user authentication before starting backup scheduler
        const startBackupScheduler = async () => {
          const { useUserStore } = await import('./userStore');
          const user = useUserStore.getState().user;
          if (!user?.uid) {
            console.log('⏳ Waiting for user authentication before starting backup scheduler...');
            setTimeout(startBackupScheduler, 2000); // Check every 2 seconds
            return;
          }
          
          console.log('✅ User authenticated, starting backup scheduler for:', user.uid);
          
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

          // Initial backup after authentication (wait for extension)
          setTimeout(() => {
            get().backupTodayData();
          }, 5000);
        };
        
        startBackupScheduler();
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

      // Manual retry method for users
      retryBackup: async () => {
        console.log('🔄 Manual backup retry triggered');
        
        // Only reset circuit breaker if it's actually in an error state
        const status = ExtensionDataService.getCircuitBreakerStatus();
        if (status.state === 'OPEN') {
          ExtensionDataService.resetCircuitBreaker();
        }
        
        // Wait a moment then trigger backup
        setTimeout(() => {
          get().backupTodayData();
        }, 1000);
      },

      // Get current sync status including circuit breaker info
      getSyncStatus: () => {
        const state = get();
        const circuitBreakerStatus = ExtensionDataService.getCircuitBreakerStatus();
        
        return {
          isBackingUp: state.isBackingUp,
          lastBackupTime: state.lastBackupTime,
          backupError: state.backupError,
          circuitBreaker: circuitBreakerStatus,
          canRetry: !state.isBackingUp && circuitBreakerStatus.state !== 'OPEN'
        };
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
      },

      loadComparisonData: async (selectedRange: any) => {
        try {
          const { useUserStore } = await import('./userStore');
          const user = useUserStore.getState().user;
          
          // Authentication guard
          if (!user?.uid) {
            console.warn('⚠️ User not authenticated - skipping comparison data load');
            set({ comparisonData: null, comparisonError: 'User not authenticated' });
            return;
          }

          // Check if comparison should be shown for this range type
          if (selectedRange.rangeType === 'all time') {
            set({ comparisonData: null, comparisonError: null });
            return;
          }

          set({ isLoadingComparison: true, comparisonError: null });

          // Calculate comparison period
          const comparisonPeriod = calculateComparisonDateRange(selectedRange);
          if (!comparisonPeriod) {
            set({ 
              comparisonData: null, 
              isLoadingComparison: false,
              comparisonError: 'Invalid date range for comparison' 
            });
            return;
          }

          console.log('🔍 Loading comparison data:', {
            current: {
              start: formatLocalDate(selectedRange.startDate),
              end: formatLocalDate(selectedRange.endDate),
              type: selectedRange.rangeType
            },
            comparison: {
              start: formatLocalDate(comparisonPeriod.startDate),
              end: formatLocalDate(comparisonPeriod.endDate),
              label: comparisonPeriod.label
            }
          });

          // Load current period data using the same method as comparison period
          const currentStartStr = formatLocalDate(selectedRange.startDate);
          const currentEndStr = formatLocalDate(selectedRange.endDate);
          
          const hybridCurrentData = await get().loadHybridTimeRangeData(currentStartStr, currentEndStr);
          
          // Calculate current period metrics (same approach as comparison period)
          const currentWorkSessions = await get().loadWorkSessionsForComparison(user.uid, selectedRange.startDate, selectedRange.endDate);
          const currentDeepFocusSessions = await get().loadDeepFocusSessionsForComparison(user.uid, selectedRange.startDate, selectedRange.endDate);
          const currentOverrideSessions = await overrideSessionService.getUserOverrides(user.uid, selectedRange.startDate, selectedRange.endDate);

          const currentMetrics: ComparisonMetrics = {
            onScreenTime: hybridCurrentData.timeMetrics.onScreenTime,
            workingTime: currentWorkSessions,
            deepFocusTime: currentDeepFocusSessions,
            overrideTime: currentOverrideSessions.reduce((total, session) => total + session.duration, 0)
          };

          // Load comparison period data
          const comparisonStartStr = formatLocalDate(comparisonPeriod.startDate);
          const comparisonEndStr = formatLocalDate(comparisonPeriod.endDate);
          
          const hybridComparisonData = await get().loadHybridTimeRangeData(comparisonStartStr, comparisonEndStr);
          
          // Calculate comparison period metrics
          const comparisonWorkSessions = await get().loadWorkSessionsForComparison(user.uid, comparisonPeriod.startDate, comparisonPeriod.endDate);
          const comparisonDeepFocusSessions = await get().loadDeepFocusSessionsForComparison(user.uid, comparisonPeriod.startDate, comparisonPeriod.endDate);
          const comparisonOverrideSessions = await overrideSessionService.getUserOverrides(user.uid, comparisonPeriod.startDate, comparisonPeriod.endDate);

          const previousMetrics: ComparisonMetrics = {
            onScreenTime: hybridComparisonData.timeMetrics.onScreenTime,
            workingTime: comparisonWorkSessions,
            deepFocusTime: comparisonDeepFocusSessions,
            overrideTime: comparisonOverrideSessions.reduce((total, session) => total + session.duration, 0)
          };

          // Calculate percentage changes
          const percentageChanges = {
            onScreenTime: calculatePercentageChange(currentMetrics.onScreenTime, previousMetrics.onScreenTime),
            workingTime: calculatePercentageChange(currentMetrics.workingTime, previousMetrics.workingTime),
            deepFocusTime: calculatePercentageChange(currentMetrics.deepFocusTime, previousMetrics.deepFocusTime),
            overrideTime: calculatePercentageChange(currentMetrics.overrideTime, previousMetrics.overrideTime)
          };

          const comparisonData: ComparisonData = {
            current: currentMetrics,
            previous: previousMetrics,
            percentageChanges
          };

          set({ 
            comparisonData, 
            isLoadingComparison: false,
            comparisonError: null 
          });

          console.log('✅ Comparison data loaded successfully:', {
            label: comparisonPeriod.label,
            currentPeriod: {
              start: currentStartStr,
              end: currentEndStr,
              metrics: currentMetrics
            },
            previousPeriod: {
              start: comparisonStartStr,
              end: comparisonEndStr,
              metrics: previousMetrics
            },
            changes: percentageChanges
          });

        } catch (error) {
          console.error('❌ Failed to load comparison data:', error);
          set({ 
            comparisonData: null, 
            isLoadingComparison: false,
            comparisonError: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      },

      // Helper methods for comparison data loading
      loadWorkSessionsForComparison: async (userId: string, startDate: Date, endDate: Date): Promise<number> => {
        try {
          const { useDashboardStore } = await import('./useDashboardStore');
          const { workSessions } = useDashboardStore.getState();
          
          return workSessions
            .filter(session => session.sessionType === 'pomodoro' || session.sessionType === 'manual')
            .filter(session => {
              const sessionDate = new Date(session.date);
              return sessionDate >= startDate && sessionDate <= endDate;
            })
            .reduce((total, session) => total + (session.duration || 0), 0);
        } catch (error) {
          console.warn('Failed to load work sessions for comparison:', error);
          return 0;
        }
      },

      loadDeepFocusSessionsForComparison: async (userId: string, startDate: Date, endDate: Date): Promise<number> => {
        try {
          const sessions = await deepFocusSessionService.getUserSessions(userId, startDate, endDate);
          return sessions
            .filter(session => session.status === 'completed' && session.duration)
            .reduce((total, session) => total + (session.duration || 0), 0);
        } catch (error) {
          console.warn('Failed to load deep focus sessions for comparison:', error);
          return 0;
        }
      }
    }),
    {
      name: getUserSpecificStorageKey(),
      partialize: (state) => {
        return {
          ...state,
          timer: null, // Always reset timers
          secondTimer: null,
          isReloading: false // Reset after persistence
        };
      }
    }
  )
); 