import { create } from 'zustand';
import { DeepFocusData, SiteUsage, BlockedSite } from '../types/deepFocus';
import ExtensionDataService from '../services/extensionDataService';

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
}

export const useDeepFocusStore = create<DeepFocusStore>((set, get) => ({
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
      set({ isDeepFocusActive: focusStatus.focusMode });
    } catch (error) {
      console.error('Failed to load focus status:', error);
    }
  },

  enableDeepFocus: async () => {
    const state = get();
    
    try {
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
        blockedSites: updatedSites
      });
      console.log('Deep Focus enabled successfully - all sites are now blocked');
    } catch (error) {
      console.error('Failed to enable Deep Focus:', error);
      throw error;
    }
  },

  disableDeepFocus: async () => {
    const state = get();
    
    try {
      // Disable focus mode in extension
      if (ExtensionDataService.isExtensionInstalled()) {
        await ExtensionDataService.disableFocusMode();
      }

      // Disable all blocked sites and unblock them in extension
      const updatedSites = state.blockedSites.map(site => ({ ...site, isActive: false }));
      
      for (const site of updatedSites) {
        await state.unblockSiteInExtension(site.url);
      }

      set({ 
        isDeepFocusActive: false,
        blockedSites: updatedSites
      });
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
  }
})); 