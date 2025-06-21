import { useEffect, useCallback } from 'react';
import { useDeepFocusStore } from '../store/deepFocusStore';
import ExtensionDataService from '../services/extensionDataService';

// Global flag to track if sync has been initialized in this session
let hasInitializedSync = false;

export const useExtensionSync = () => {
  const loadExtensionData = useDeepFocusStore(state => state.loadExtensionData);
  const initializeFocusSync = useDeepFocusStore(state => state.initializeFocusSync);

  // Initialize extension sync only once per session
  useEffect(() => {
    const initializeSync = async () => {
      try {
        // Only sync once per session to avoid overriding persisted state
        if (hasInitializedSync) {
          // Just load data without syncing focus state
          console.log('🔄 Extension sync already initialized, refreshing data only');
          try {
            await Promise.race([
              loadExtensionData(),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Extension data load timeout')), 5000)
              )
            ]);
          } catch (error) {
            console.warn('⚠️ Failed to refresh extension data (continuing without extension):', error);
          }
          return;
        }
        
        hasInitializedSync = true;
        console.log('🚀 Initializing extension sync for first time...');
        
        // Load extension data first (with timeout)
        try {
          await Promise.race([
            loadExtensionData(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Extension data load timeout')), 5000)
            )
          ]);
          console.log('✅ Extension data loaded successfully');
        } catch (error) {
          console.warn('⚠️ Failed to load extension data (continuing without extension):', error);
        }
        
        // Small delay to ensure persisted state is fully restored
        setTimeout(async () => {
          try {
            // Use the new initialization method that respects persisted state (with timeout)
            await Promise.race([
              initializeFocusSync(),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Focus sync initialization timeout')), 3000)
              )
            ]);
            console.log('✅ Focus sync initialized successfully');
          } catch (error) {
            console.warn('⚠️ Failed to initialize focus sync (continuing without extension sync):', error);
          }
        }, 100);
      } catch (error) {
        console.error('❌ Extension sync initialization failed:', error);
      }
    };
    
    initializeSync();
  }, []); // Only run once on mount
  
  // Auto-refresh data every 30 seconds (but don't sync focus state)
  useEffect(() => {
    const interval = setInterval(() => {
      loadExtensionData();
    }, 30000);

    return () => clearInterval(interval);
  }, [loadExtensionData]);

  // Refresh on window focus (user switches back to web app) - only data, not focus state
  useEffect(() => {
    const handleFocus = () => {
      loadExtensionData();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [loadExtensionData]);

  // Listen for focus state changes from extension via content script
  useEffect(() => {
    const handleExtensionMessage = (event: MessageEvent) => {
      if (event.data?.type === 'EXTENSION_FOCUS_STATE_CHANGED') {
        console.log('🔄 Received focus state change from extension:', event.data.payload.isActive);
        // Update local state without triggering extension sync
        const { syncFocusStatus } = useDeepFocusStore.getState();
        syncFocusStatus(event.data.payload.isActive);
      }
    };

    window.addEventListener('message', handleExtensionMessage);
    return () => window.removeEventListener('message', handleExtensionMessage);
  }, []);

  // Manual refresh function
  const refreshData = useCallback(() => {
    loadExtensionData();
  }, [loadExtensionData]);

  return { refreshData };
}; 