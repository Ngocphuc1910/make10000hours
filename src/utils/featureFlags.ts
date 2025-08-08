import { useUIStore } from '../store/uiStore';

/**
 * Check if multi-day tasks feature is enabled
 */
export const isMultiDayEnabled = (): boolean => {
  const uiStore = useUIStore.getState();
  return uiStore.featureFlags?.multiDayTasks || false;
};

/**
 * Get all feature flags
 */
export const getFeatureFlags = () => {
  const uiStore = useUIStore.getState();
  return uiStore.featureFlags || {};
};

/**
 * Check if a specific feature flag is enabled
 */
export const isFeatureEnabled = (flag: string): boolean => {
  const uiStore = useUIStore.getState();
  return uiStore.featureFlags?.[flag] || false;
};