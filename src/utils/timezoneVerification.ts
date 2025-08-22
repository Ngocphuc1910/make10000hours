/**
 * Verify all required timezone utilities exist before implementation
 */
import { useUserStore } from '../store/userStore';
import { timezoneUtils } from './timezoneUtils';

export const verifyTimezoneInfrastructure = (): {
  ready: boolean;
  missing: string[];
  warnings: string[]
} => {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Check userStore methods
  try {
    const userStore = useUserStore.getState();
    if (typeof userStore.getTimezone !== 'function') {
      missing.push('userStore.getTimezone()');
    }
  } catch (error) {
    missing.push('useUserStore access');
  }

  // Check timezoneUtils methods
  if (typeof timezoneUtils.userTimeToUTC !== 'function') {
    missing.push('timezoneUtils.userTimeToUTC()');
  }
  if (typeof timezoneUtils.getCurrentTimezone !== 'function') {
    missing.push('timezoneUtils.getCurrentTimezone()');
  }

  // Check date-fns-tz availability
  try {
    import('date-fns-tz').then((dateFnsTz) => {
      if (typeof dateFnsTz.fromZonedTime !== 'function') {
        missing.push('date-fns-tz library');
      }
    }).catch(() => {
      missing.push('date-fns-tz library');
    });
  } catch (error) {
    missing.push('date-fns-tz library');
  }

  return {
    ready: missing.length === 0,
    missing,
    warnings
  };
};