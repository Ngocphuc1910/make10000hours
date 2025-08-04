import { useState, useEffect, useCallback } from 'react';
import { timezoneUtils } from '../utils/timezoneUtils';
import { useUserStore } from '../store/userStore';
import { utcFeatureFlags } from '../services/featureFlags';
import { utcMonitoring } from '../services/monitoring';
import { enhancedMigrationService } from '../services/migration/enhancedMigrationService';

interface TimezoneChangeState {
  showModal: boolean;
  detectedTimezone: string;
  currentTimezone: string;
  lastCheck: number;
}

export const useTimezoneChangeNotification = () => {
  const { user, updateTimezone } = useUserStore();
  const [changeState, setChangeState] = useState<TimezoneChangeState>({
    showModal: false,
    detectedTimezone: timezoneUtils.getCurrentTimezone(),
    currentTimezone: timezoneUtils.getCurrentTimezone(),
    lastCheck: Date.now()
  });

  // Check for timezone changes periodically
  useEffect(() => {
    if (!user) return;

    // Only enable for users with UTC features
    const hasUTCFeatures = utcFeatureFlags.isFeatureEnabled('utcDataStorage', user.uid);
    if (!hasUTCFeatures) return;

    const checkTimezoneChange = () => {
      const currentDetected = timezoneUtils.getCurrentTimezone();
      const userTimezone = user.timezone || timezoneUtils.getCurrentTimezone();
      
      // Only show modal if:
      // 1. Detected timezone is different from user's saved timezone
      // 2. It's been at least 5 minutes since last check
      // 3. Modal is not already showing
      const timeSinceLastCheck = Date.now() - changeState.lastCheck;
      const shouldNotify = (
        currentDetected !== userTimezone &&
        timeSinceLastCheck > 5 * 60 * 1000 && // 5 minutes
        !changeState.showModal
      );

      if (shouldNotify) {
        console.log('Timezone change detected:', {
          detected: currentDetected,
          saved: userTimezone,
          user: user.uid
        });

        utcMonitoring.trackOperation('timezone_change_detected', true);

        setChangeState({
          showModal: true,
          detectedTimezone: currentDetected,
          currentTimezone: userTimezone,
          lastCheck: Date.now()
        });
      }
    };

    // Check immediately
    checkTimezoneChange();

    // Set up periodic checks every 5 minutes
    const interval = setInterval(checkTimezoneChange, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user, changeState.lastCheck, changeState.showModal]);

  // Handle timezone change confirmation
  const handleTimezoneConfirm = useCallback(async (
    newTimezone: string, 
    updateExistingData: boolean
  ) => {
    if (!user) return;

    try {
      // Update user's timezone setting
      await updateTimezone(newTimezone);

      // If user chose to update existing data, trigger migration
      if (updateExistingData && newTimezone !== changeState.currentTimezone) {
        console.log('Starting timezone migration:', {
          from: changeState.currentTimezone,
          to: newTimezone,
          userId: user.uid
        });

        // Start background migration
        enhancedMigrationService.migrateTimezoneData(
          user.uid,
          changeState.currentTimezone,
          newTimezone
        ).then((result) => {
          if (result.success) {
            console.log('Timezone migration completed successfully');
            utcMonitoring.trackOperation('timezone_migration_success', true);
          } else {
            console.error('Timezone migration failed:', result.error);
            utcMonitoring.trackOperation('timezone_migration_success', false);
          }
        }).catch((error) => {
          console.error('Timezone migration error:', error);
          utcMonitoring.trackOperation('timezone_migration_success', false);
        });
      }

      // Close modal and update state
      setChangeState(prev => ({
        ...prev,
        showModal: false,
        currentTimezone: newTimezone,
        lastCheck: Date.now()
      }));

      utcMonitoring.trackOperation('timezone_update_success', true);

    } catch (error) {
      console.error('Failed to update timezone:', error);
      utcMonitoring.trackOperation('timezone_update_success', false);
    }
  }, [user, updateTimezone, changeState.currentTimezone]);

  // Handle modal dismissal
  const handleModalClose = useCallback(() => {
    setChangeState(prev => ({
      ...prev,
      showModal: false,
      lastCheck: Date.now()
    }));

    utcMonitoring.trackOperation('timezone_change_dismissed', true);
  }, []);

  // Manually trigger timezone check (for testing or user action)
  const triggerTimezoneCheck = useCallback(() => {
    if (!user) return;

    const currentDetected = timezoneUtils.getCurrentTimezone();
    const userTimezone = user.timezone || timezoneUtils.getCurrentTimezone();

    if (currentDetected !== userTimezone) {
      setChangeState({
        showModal: true,
        detectedTimezone: currentDetected,
        currentTimezone: userTimezone,
        lastCheck: Date.now()
      });
    } else {
      console.log('No timezone change detected');
    }
  }, [user]);

  // Get current timezone status
  const getTimezoneStatus = useCallback(() => {
    if (!user) return null;

    const detectedTimezone = timezoneUtils.getCurrentTimezone();
    const userTimezone = user.timezone || detectedTimezone;
    
    return {
      userTimezone,
      detectedTimezone,
      isInSync: userTimezone === detectedTimezone,
      hasUTCFeatures: utcFeatureFlags.isFeatureEnabled('utcTimezoneDetection', user.uid)
    };
  }, [user]);

  return {
    // Modal state
    showTimezoneModal: changeState.showModal,
    detectedTimezone: changeState.detectedTimezone,
    currentTimezone: changeState.currentTimezone,
    
    // Actions
    handleTimezoneConfirm,
    handleModalClose,
    triggerTimezoneCheck,
    getTimezoneStatus,
    
    // Utilities
    isTimezoneFeatureEnabled: user ? utcFeatureFlags.isFeatureEnabled('utcDataStorage', user.uid) : false
  };
};