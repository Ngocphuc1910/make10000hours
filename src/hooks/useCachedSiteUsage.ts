import { useState, useCallback } from 'react';
import { SiteUsage } from '../types/deepFocus';
import { siteUsageCacheService } from '../services/siteUsageCacheService';

export const useCachedSiteUsage = () => {
  const [siteUsage, setSiteUsage] = useState<SiteUsage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadUsageData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await siteUsageCacheService.getLast30DaysUsage();
      setSiteUsage(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load usage data');
      console.error('❌ Error loading cached site usage:', err);
      // Return empty array on error to stop infinite loading
      setSiteUsage([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearCache = () => {
    siteUsageCacheService.clearCache();
    setSiteUsage([]);
  };

  return {
    siteUsage,
    isLoading,
    error,
    loadUsageData,
    clearCache
  };
}; 