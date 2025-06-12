import { useEffect, useCallback } from 'react';
import { useDeepFocusStore } from '../store/deepFocusStore';
import ExtensionDataService from '../services/extensionDataService';

export const useExtensionSync = () => {
  const loadExtensionData = useDeepFocusStore(state => state.loadExtensionData);
  
  // Auto-refresh data every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadExtensionData();
    }, 30000);

    return () => clearInterval(interval);
  }, [loadExtensionData]);

  // Refresh on window focus (user switches back to web app)
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