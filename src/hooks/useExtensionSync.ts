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
      // Only sync once per session to avoid overriding persisted state
      if (hasInitializedSync) {
        // Just load data without syncing focus state
        await loadExtensionData();
        return;
      }
      
      hasInitializedSync = true;
      
      // Load extension data first
      await loadExtensionData();
      
      // Small delay to ensure persisted state is fully restored
      setTimeout(async () => {
        // Use the new initialization method that respects persisted state
        await initializeFocusSync();
      }, 100);
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

  // Manual refresh function
  const refreshData = useCallback(() => {
    loadExtensionData();
  }, [loadExtensionData]);

  return { refreshData };
}; 