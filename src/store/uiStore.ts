import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  // Sidebar states
  isLeftSidebarOpen: boolean;
  isRightSidebarOpen: boolean;
  rightSidebarWidth: number;
  
  // Modal states
  isHelpModalOpen: boolean;
  isSettingsModalOpen: boolean;
  
  // Focus mode
  isFocusMode: boolean;
  
  // Help modal tab
  activeHelpTab: 'pomodoro' | 'features' | 'shortcuts';
  
  // Toast notification
  toastMessage: string | null;
  
  // Feature flags
  featureFlags: {
    multiDayTasks: boolean;
  };
  
  // Actions
  toggleLeftSidebar: () => void;
  toggleRightSidebar: () => void;
  setRightSidebarWidth: (width: number) => void;
  toggleHelpModal: () => void;
  toggleSettingsModal: () => void;
  toggleFocusMode: () => void;
  setActiveHelpTab: (tab: 'pomodoro' | 'features' | 'shortcuts') => void;
  showToast: (message: string) => void;
  hideToast: () => void;
  setFeatureFlag: (flag: keyof UIState['featureFlags'], enabled: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // Initial state
      isLeftSidebarOpen: false,
      isRightSidebarOpen: true,
      rightSidebarWidth: 480,
      isHelpModalOpen: false,
      isSettingsModalOpen: false,
      isFocusMode: false,
      activeHelpTab: 'pomodoro',
      toastMessage: null,
      
      // Feature flags - multi-day enabled for testing
      featureFlags: {
        multiDayTasks: true,
      },
      
      // Actions
      toggleLeftSidebar: () => set(state => ({ isLeftSidebarOpen: !state.isLeftSidebarOpen })),
      
      toggleRightSidebar: () => set(state => ({ isRightSidebarOpen: !state.isRightSidebarOpen })),
      
      setRightSidebarWidth: (width) => set({ rightSidebarWidth: width }),
      
      toggleHelpModal: () => set(state => ({ isHelpModalOpen: !state.isHelpModalOpen })),
      
      toggleSettingsModal: () => set(state => ({ isSettingsModalOpen: !state.isSettingsModalOpen })),
      
      toggleFocusMode: () => set(state => ({ isFocusMode: !state.isFocusMode })),
      
      setActiveHelpTab: (tab) => set({ activeHelpTab: tab }),
      
      showToast: (message) => {
        set({ toastMessage: message });
        // Auto-hide toast after 3 seconds
        setTimeout(() => {
          set(state => {
            // Only hide if this is still the current message
            if (state.toastMessage === message) {
              return { toastMessage: null };
            }
            return {};
          });
        }, 3000);
      },
      
      hideToast: () => set({ toastMessage: null }),
      
      // Feature flag actions
      setFeatureFlag: (flag, enabled) => set(state => ({
        featureFlags: {
          ...state.featureFlags,
          [flag]: enabled
        }
      }))
    }),
    {
      name: 'ui-store', // unique name for localStorage key
      partialize: (state) => ({ 
        rightSidebarWidth: state.rightSidebarWidth,
        isLeftSidebarOpen: state.isLeftSidebarOpen,
        isRightSidebarOpen: state.isRightSidebarOpen,
        featureFlags: state.featureFlags // persist feature flags
      }), // only persist specific UI preferences
    }
  )
);; 