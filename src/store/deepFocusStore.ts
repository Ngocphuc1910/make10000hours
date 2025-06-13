import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DeepFocusData, SiteUsage, BlockedSite } from '../types/deepFocus';
import { DeepFocusSession } from '../types/models';
import ExtensionDataService from '../services/extensionDataService';
import { deepFocusSessionService } from '../api/deepFocusSessionService';

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
  loadDeepFocusSessions: (userId: string, startDate?: Date, endDate?: Date) => Promise<void>;
  subscribeToSessions: (userId: string) => void;
  unsubscribeFromSessions: () => void;
  activeSessionId: string | null;
  activeSessionStartTime: Date | null;
  activeSessionDuration: number;
  activeSessionElapsedSeconds: number;
  timer: NodeJS.Timeout | null;
  secondTimer: NodeJS.Timeout | null;
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

  loadExtensionData: async () => {
    try {
      if (!ExtensionDataService.isExtensionInstalled()) {
        console.log('Chrome extension API not available, using mock data');
        set({ isExtensionConnected: false });
        return;
      }

      // Test connection first
      const isConnected = await ExtensionDataService.testConnection();
      if (!isConnected) {
        console.log('Extension not responding, using mock data');
        set({ isExtensionConnected: false });
        return;
      }

      const extensionResponse = await ExtensionDataService.getTodayStats();
      console.log('Extension response received:', extensionResponse);
      
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

      console.log('Extension data successfully loaded and mapped');
    } catch (error) {
      console.error('Failed to load extension data:', error);
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
              const newDuration = Math.floor((Date.now() - startTime.getTime()) / 60000);
              set({ activeSessionDuration: newDuration });
              await deepFocusSessionService.updateSessionDuration(newSessionId, newDuration);
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
      if (!ExtensionDataService.isExtensionInstalled()) {
        return;
      }

      const isConnected = await ExtensionDataService.testConnection();
      if (!isConnected) {
        return;
      }

      const extensionStatus = await ExtensionDataService.getFocusStatus();
      const currentLocalState = get().isDeepFocusActive;
      
      // Always prioritize persisted local state and sync extension to match
      if (extensionStatus.focusMode !== currentLocalState) {
        console.log(`Initial sync: Setting extension focus mode to match persisted local state: ${currentLocalState}`);
        if (currentLocalState) {
          await ExtensionDataService.enableFocusMode();
          // Update blocked sites in extension to match local state
          const blockedSites = get().blockedSites.filter(site => site.isActive);
          for (const site of blockedSites) {
            await ExtensionDataService.blockSite(site.url);
          }
        } else {
          await ExtensionDataService.disableFocusMode();
          // Unblock all sites in extension
          const blockedSites = get().blockedSites;
          for (const site of blockedSites) {
            await ExtensionDataService.unblockSite(site.url);
          }
        }
      }
      
      // Notify all subscribers about the current state
      window.dispatchEvent(new CustomEvent('deepFocusChanged', { 
        detail: { isActive: currentLocalState } 
      }));
      
    } catch (error) {
      console.error('Failed to initialize focus sync:', error);
    }
  },

  // Method to sync focus status without extension call (for internal state sync)
  syncFocusStatus: (isActive: boolean) => {
    set({ isDeepFocusActive: isActive });
  },

  enableDeepFocus: async () => {
    const state = get();
    console.log('enableDeepFocus called. State:', state);
    
    try {
      // Start a new Deep Focus session if we have user data
      let sessionId: string | null = null;
      let startTime = new Date();
      try {
        const { useUserStore } = await import('./userStore');
        const user = useUserStore.getState().user;
        if (user?.uid) {
          sessionId = await deepFocusSessionService.startSession(user.uid);
          startTime = new Date();
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
            }
          }, 60000);
          
          set({ timer, secondTimer });
        }
      } catch (error) {
        console.error('Failed to start Deep Focus session:', error);
      }

      // Enable focus mode in extension
      if (ExtensionDataService.isExtensionInstalled()) {
        await ExtensionDataService.enableFocusMode();
      }

      // Enable all blocked sites and block them in extension
      const updatedSites = state.blockedSites.map(site => ({ ...site, isActive: true }));
      
      for (const site of updatedSites) {
        await state.blockSiteInExtension(site.url);
      }

      set({ 
        isDeepFocusActive: true,
        currentSessionId: sessionId,
        blockedSites: updatedSites
      });

      // Notify all subscribers that focus mode is now active
      window.dispatchEvent(new CustomEvent('deepFocusChanged', { 
        detail: { isActive: true } 
      }));

      console.log('Deep Focus enabled successfully - all sites are now blocked', sessionId ? `Session ID: ${sessionId}` : '');
    } catch (error) {
      console.error('Failed to enable Deep Focus:', error);
      throw error;
    }
  },

  disableDeepFocus: async () => {
    const state = get();
    console.log('disableDeepFocus called. State:', state);
    
    try {
      // End the current Deep Focus session if active
      if (state.activeSessionId) {
        try {
          await deepFocusSessionService.endSession(state.activeSessionId);
          console.log('Deep Focus session ended:', state.activeSessionId);
        } catch (error) {
          console.error('Failed to end Deep Focus session:', error);
        }
      }

      // Disable focus mode in extension
      if (ExtensionDataService.isExtensionInstalled()) {
        await ExtensionDataService.disableFocusMode();
      }

      // Disable all blocked sites and unblock them in extension
      const updatedSites = state.blockedSites.map(site => ({ ...site, isActive: false }));
      
      for (const site of updatedSites) {
        await state.unblockSiteInExtension(site.url);
      }

      // Clear timers
      if (state.timer) {
        clearInterval(state.timer);
      }
      if (state.secondTimer) {
        clearInterval(state.secondTimer);
      }
      set({ timer: null, secondTimer: null });

      set({ 
        isDeepFocusActive: false,
        currentSessionId: null,
        blockedSites: updatedSites,
        activeSessionId: null,
        activeSessionStartTime: null,
        activeSessionDuration: 0,
        activeSessionElapsedSeconds: 0
      });

      // Notify all subscribers that focus mode is now inactive
      window.dispatchEvent(new CustomEvent('deepFocusChanged', { 
        detail: { isActive: false } 
      }));

      console.log('Deep Focus disabled successfully - all sites are now unblocked');
    } catch (error) {
      console.error('Failed to disable Deep Focus:', error);
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
  }
}),
{
  name: 'deep-focus-storage',
  partialize: (state) => ({
    isDeepFocusActive: state.isDeepFocusActive,
    blockedSites: state.blockedSites
  })
}
)
); 