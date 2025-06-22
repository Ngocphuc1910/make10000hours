import { useEffect, useCallback } from 'react';
import { useDeepFocusStore } from '../store/deepFocusStore';
import ExtensionDataService from '../services/extensionDataService';

// Request debouncing
let lastLoadTime = 0;
const LOAD_DEBOUNCE_MS = 2000; // 2 seconds

// Global flag to track if sync has been initialized in this session
let hasInitializedSync = false;

export const useExtensionSync = () => {
  const loadExtensionData = useDeepFocusStore(state => state.loadExtensionData);
  const initializeFocusSync = useDeepFocusStore(state => state.initializeFocusSync);

  // Debounced extension data loader
  const debouncedLoadExtensionData = useCallback(async () => {
    const now = Date.now();
    if (now - lastLoadTime < LOAD_DEBOUNCE_MS) {
      return; // Skip if called too recently
    }
    lastLoadTime = now;
    
    try {
      await loadExtensionData();
    } catch (error) {
      // Silently handle - circuit breaker will manage this
    }
  }, [loadExtensionData]);

  // Initialize extension sync only once per session
  useEffect(() => {
    const initializeSync = async () => {
      if (hasInitializedSync) {
        return;
      }
      
      hasInitializedSync = true;
      console.log('🚀 Initializing extension sync...');
      
      // Load extension data with circuit breaker protection
      await debouncedLoadExtensionData();
      
      // Initialize focus sync with delay
      setTimeout(async () => {
        try {
          await initializeFocusSync();
        } catch (error) {
          // Silently handle - circuit breaker will manage this
        }
      }, 100);
    };
    
    initializeSync();
  }, []); // Only run once on mount

  // Reduced frequency auto-refresh (circuit breaker will prevent spam)
  useEffect(() => {
    const interval = setInterval(debouncedLoadExtensionData, 60000); // Every 60 seconds instead of 30
    return () => clearInterval(interval);
  }, [debouncedLoadExtensionData]);

  // Manual refresh function
  const refreshData = useCallback(() => {
    debouncedLoadExtensionData();
  }, [debouncedLoadExtensionData]);

  return { refreshData };
}; 