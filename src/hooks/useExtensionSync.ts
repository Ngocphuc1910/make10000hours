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

  // Force fresh extension data load (bypasses debouncing and global sync flag)
  const forceFreshExtensionData = useCallback(async () => {
    console.log('🔄 Forcing fresh extension data load...');
    
    // Reset circuit breaker to ensure clean communication
    ExtensionDataService.resetCircuitBreaker();
    
    // Reset the last load time to bypass debouncing
    lastLoadTime = 0;
    
    // Force fresh data load
    try {
      await loadExtensionData();
      console.log('✅ Fresh extension data loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load fresh extension data:', error);
      throw error;
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
    const interval = setInterval(debouncedLoadExtensionData, 300000); // Every 5 minutes instead of 1 minute
    return () => clearInterval(interval);
  }, [debouncedLoadExtensionData]);

  // Manual refresh function
  const refreshData = useCallback(() => {
    debouncedLoadExtensionData();
  }, [debouncedLoadExtensionData]);

  return { 
    refreshData,
    forceFreshExtensionData
  };
}; 